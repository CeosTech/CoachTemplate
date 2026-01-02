import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function optional(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

export const env = {
  PORT: Number(process.env.PORT ?? 4000),
  API_BASE_URL: optional("API_BASE_URL"),
  DATABASE_URL: required("DATABASE_URL"),
  JWT_ACCESS_SECRET: required("JWT_ACCESS_SECRET"),
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  STRIPE_SECRET_KEY: optional("STRIPE_SECRET_KEY"),
  STRIPE_WEBHOOK_SECRET: optional("STRIPE_WEBHOOK_SECRET"),
  SENDGRID_API_KEY: optional("SENDGRID_API_KEY"),
  WELCOME_EMAIL_FROM: optional("WELCOME_EMAIL_FROM"),
  // plus de SMS externes pour l'instant → notification in-app uniquement
};
