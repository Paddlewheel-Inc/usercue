import nodemailer from "nodemailer";
import { env } from "./env";
import { decryptSecret } from "./secret";
import { getWorkspace } from "./workspace";

export interface SmtpCredentials {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  secure: boolean;
}

export async function smtpCredentials(): Promise<SmtpCredentials | null> {
  const workspace = await getWorkspace();
  const host = (workspace.smtp_host || env.smtpHost).trim();
  const from = (workspace.smtp_from || env.smtpFrom).trim();
  if (!host || !from) return null;

  return {
    host,
    port: workspace.smtp_host ? workspace.smtp_port : env.smtpPort,
    user: workspace.smtp_host ? workspace.smtp_user : env.smtpUser,
    pass: workspace.smtp_pass_cipher ? decryptSecret(workspace.smtp_pass_cipher) : env.smtpPass,
    from,
    secure: workspace.smtp_host ? workspace.smtp_secure === 1 : env.smtpSecure,
  };
}

export async function smtpConfigured(): Promise<boolean> {
  return (await smtpCredentials()) !== null;
}

export async function smtpEnabled(): Promise<boolean> {
  return (await smtpConfigured()) && (await getWorkspace()).smtp_enabled === 1;
}

export async function sendSmtpEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ sent: boolean; error?: string }> {
  const credentials = await smtpCredentials();
  if (!credentials) return { sent: false, error: "SMTP email is not configured" };

  try {
    const transporter = nodemailer.createTransport({
      host: credentials.host,
      port: credentials.port,
      secure: credentials.secure,
      auth:
        credentials.user || credentials.pass
          ? { user: credentials.user, pass: credentials.pass }
          : undefined,
    });
    await transporter.sendMail({
      from: credentials.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send the email";
    return { sent: false, error: message };
  }
}
