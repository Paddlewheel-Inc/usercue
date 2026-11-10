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

export async function emailEnabled(): Promise<boolean> {
  return (await resendEnabled()) || (await smtpEnabled());
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ sent: boolean; error?: string }> {
  const creds = await resendCredentials();
  if (creds && (await getWorkspace()).resend_enabled === 1) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: creds.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
      }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      return { sent: false, error: body?.message ?? "Could not send the email" };
    }
    return { sent: true };
  }

  if (await smtpEnabled()) {
    return sendSmtpEmail({
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
  }

  return { sent: false, error: "Email is turned off" };
}

export async function sendInviteEmail(
  to: string,
  url: string,
): Promise<{ sent: boolean; error?: string }> {
  return sendEmail({
    to,
    subject: "You're invited to a UserCue workspace",
    html: `<div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:440px;margin:0 auto;padding:32px 8px;color:#18181b">
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
</div>`,
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

function plainSubject(value: string): string {
  return value
    .replace(/[\r\n\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, 120);
}

export async function sendMentionEmail(options: {
  to: string;
  authorName: string;
  title: string;
  url: string;
}): Promise<{ sent: boolean; error?: string }> {
  const url = safeHttpUrl(options.url);
  if (!url) return { sent: false, error: "Invalid link" };
  const author = plainSubject(options.authorName) || "Someone";
  const title = plainSubject(options.title) || "a post";
  return sendEmail({
    to: options.to,
    subject: `${author} mentioned you on “${title}”`,
    html: `<div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:440px;margin:0 auto;padding:32px 8px;color:#18181b">
  <p style="font-size:16px;font-weight:600;margin:0 0 8px">${escapeHtml(author)} mentioned you</p>
  <p style="font-size:14px;line-height:1.5;color:#52525b;margin:0 0 20px">
    You were mentioned in a comment on <strong>${escapeHtml(title)}</strong>.
  </p>
  <p style="margin:0 0 24px">
    <a href="${escapeHtml(url)}" style="display:inline-block;background:#ff2b87;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:999px">
      Open comment
    </a>
  </p>
  <p style="font-size:12px;line-height:1.5;color:#a1a1aa;margin:0;word-break:break-all">${escapeHtml(url)}</p>
</div>`,
  });
}

export interface DigestSection {
  heading: string;
  items: { title: string; url: string; note: string }[];
}

function emailPage(options: {
  heading: string;
  intro: string;
  body?: string;
  action: { label: string; url: string };
  footer: string;
}): string {
  const url = escapeHtml(options.action.url);
  return `<div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 8px;color:#18181b">
  <p style="font-size:16px;font-weight:600;margin:0 0 8px">${options.heading}</p>
  <p style="font-size:14px;line-height:1.5;color:#52525b;margin:0 0 20px">${options.intro}</p>
  ${options.body ?? ""}
  <p style="margin:0 0 24px">
    <a href="${url}" style="display:inline-block;background:#ff2b87;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:999px">
      ${escapeHtml(options.action.label)}
    </a>
  </p>
  <p style="font-size:12px;line-height:1.5;color:#a1a1aa;margin:0">${options.footer}</p>
</div>`;
}

function preferencesFooter(accountUrl: string): string {
  const url = safeHttpUrl(accountUrl);
  return url
    ? `You can change which emails you get in <a href="${escapeHtml(url)}" style="color:#a1a1aa">your account settings</a>.`
    : "You can change which emails you get in your account settings.";
}

export async function sendShippedEmail(options: {
  to: string;
  title: string;
  statusName: string;
  url: string;
  accountUrl: string;
}): Promise<{ sent: boolean; error?: string }> {
  const url = safeHttpUrl(options.url);
  if (!url) return { sent: false, error: "Invalid link" };
  const title = plainSubject(options.title) || "your suggestion";
  return sendEmail({
    to: options.to,
    subject: `${plainSubject(options.statusName) || "Shipped"}: ${title}`,
    html: emailPage({
      heading: `${escapeHtml(options.statusName)}: ${escapeHtml(title)}`,
      intro: `Something you voted for just moved to <strong>${escapeHtml(options.statusName)}</strong>.`,
      action: { label: "See the update", url },
      footer: preferencesFooter(options.accountUrl),
    }),
  });
}

export async function sendDigestEmail(options: {
  to: string;
  siteName: string;
  url: string;
  accountUrl: string;
  sections: DigestSection[];
}): Promise<{ sent: boolean; error?: string }> {
  const url = safeHttpUrl(options.url);
  if (!url) return { sent: false, error: "Invalid link" };
  const site = plainSubject(options.siteName) || "UserCue";
  const body = options.sections
    .map((section) => {
      const items = section.items
        .map((item) => {
          const link = safeHttpUrl(item.url);
          const label = escapeHtml(item.title);
          const title = link
            ? `<a href="${escapeHtml(link)}" style="color:#18181b;font-weight:600;text-decoration:none">${label}</a>`
            : label;
          return `<li style="margin:0 0 8px;font-size:14px;line-height:1.4">${title}<br><span style="color:#71717a;font-size:12px">${escapeHtml(item.note)}</span></li>`;
        })
        .join("");
      return `<p style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:#71717a;margin:0 0 8px">${escapeHtml(section.heading)}</p>
  <ul style="margin:0 0 24px;padding-left:18px">${items}</ul>`;
    })
    .join("\n  ");
  return sendEmail({
    to: options.to,
    subject: `Your weekly ${site} digest`,
    html: emailPage({
      heading: `This week on ${escapeHtml(site)}`,
      intro: "Here is what changed since the last digest.",
      body,
      action: { label: "Open the workspace", url },
      footer: preferencesFooter(options.accountUrl),
    }),
  });
}
