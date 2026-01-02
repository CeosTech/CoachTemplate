import { env } from "../config/env";

type EmailPayload = { to: string; subject: string; text: string };

const httpFetch = (globalThis as any).fetch as typeof fetch | undefined;

async function sendGridEmail(payload: EmailPayload) {
  if (!env.SENDGRID_API_KEY || !env.WELCOME_EMAIL_FROM || !httpFetch) return false;
  const response = await httpFetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.SENDGRID_API_KEY}`
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: payload.to }] }],
      from: { email: env.WELCOME_EMAIL_FROM },
      subject: payload.subject,
      content: [{ type: "text/plain", value: payload.text }]
    })
  });
  if (!response.ok) throw new Error(`SendGrid error: ${await response.text()}`);
  return true;
}

export async function sendWelcomeEmail(to: string, steps: string[]) {
  const text = `Bienvenue ! Au programme:\n${steps.map((s, idx) => `${idx + 1}. ${s}`).join("\n")}`;
  try {
    const delivered = await sendGridEmail({ to, subject: "Bienvenue dans le programme", text });
    if (!delivered) console.info(`[email stub] ${to}: ${text}`);
  } catch (err) {
    console.warn("SendGrid failed", err);
  }
}

export async function sendPasswordResetEmail(to: string, resetLink: string) {
  const text = `Tu as demandé à réinitialiser ton mot de passe.\nClique sur le lien suivant (valide 1h): ${resetLink}`;
  try {
    const delivered = await sendGridEmail({ to, subject: "Réinitialisation de ton accès coaching", text });
    if (!delivered) console.info(`[email stub][reset] ${to}: ${resetLink}`);
  } catch (err) {
    console.warn("Password reset email failed", err);
  }
}
