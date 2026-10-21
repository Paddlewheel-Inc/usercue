import { env } from "./env";
import { decryptSecret } from "./secret";
import { sendSmtpEmail, smtpEnabled } from "./smtp";
import { getWorkspace } from "./workspace";

export async function resendCredentials(): Promise<{ key: string; from: string } | null> {
  const workspace = await getWorkspace();
  const key = workspace.resend_key_cipher
    ? decryptSecret(workspace.resend_key_cipher)
    : env.resendApiKey;
  const from = workspace.resend_from || env.resendFrom;
  return key && from ? { key, from } : null;
}

export async function resendConfigured(): Promise<boolean> {
  return (await resendCredentials()) !== null;
}

export async function resendEnabled(): Promise<boolean> {
  return (await resendConfigured()) && (await getWorkspace()).resend_enabled === 1;
}

export async function sendInviteEmail(
  to: string,
  url: string,
): Promise<{ sent: boolean; error?: string }> {
  const creds = await resendCredentials();
  const subject = "You're invited to a UserCue workspace";
  const html = `<div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:440px;margin:0 auto;padding:32px 8px;color:#18181b">
  <p style="font-size:16px;font-weight:600;margin:0 0 8px">Join the workspace</p>
  <p style="font-size:14px;line-height:1.5;color:#52525b;margin:0 0 20px">
    You were invited to help triage feedback. Use this link to create your staff account.
  </p>
  <p style="margin:0 0 24px">
    <a href="${url}" style="display:inline-block;background:#ff2b87;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:999px">
      Accept invite
    </a>
  </p>
  <p style="font-size:12px;line-height:1.5;color:#a1a1aa;margin:0;word-break:break-all">${url}</p>
</div>`;

  if (creds && (await getWorkspace()).resend_enabled === 1) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: creds.from, to, subject, html }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      return { sent: false, error: body?.message ?? "Could not send the invite email" };
    }
    return { sent: true };
  }

  if (await smtpEnabled()) return sendSmtpEmail({ to, subject, html });
  return { sent: false, error: "Invite email is turned off" };
}
