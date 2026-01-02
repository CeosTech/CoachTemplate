/**
 * Simple smoke tests to ensure API + front are reachable.
 * Requires the API (default http://localhost:4000) and web app (http://localhost:5173)
 * to be running locally. Override with API_URL / WEB_URL env vars.
 */
const API_URL = process.env.API_URL ?? "http://localhost:4000";
const WEB_URL = process.env.WEB_URL ?? "http://localhost:5173";
const MEMBER_EMAIL = process.env.SMOKE_MEMBER_EMAIL ?? "member@demo.com";
const COACH_EMAIL = process.env.SMOKE_COACH_EMAIL ?? "coach@demo.com";
const DEFAULT_PASSWORD = process.env.SMOKE_PASSWORD ?? "Password123!";

type StepResult = { name: string; success: true; details?: string } | { name: string; success: false; error: string };
const results: StepResult[] = [];

async function runStep(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, success: true });
    console.info(`✅ ${name}`);
  } catch (err: any) {
    const message = err?.message ?? String(err);
    results.push({ name, success: false, error: message });
    console.error(`❌ ${name}: ${message}`);
  }
}

async function jsonRequest<T>(path: string, options: RequestInit = {}, base = API_URL) {
  const res = await fetch(`${base}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    ...options
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.message ?? `Request failed (${res.status})`);
  }
  return body as T;
}

async function login(email: string, password: string) {
  const data = await jsonRequest<{ accessToken: string; user: { id: string; role: string } }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  if (!data.accessToken) throw new Error("Missing access token in response");
  return data.accessToken;
}

async function checkFrontend() {
  const res = await fetch(WEB_URL);
  if (!res.ok) throw new Error(`Front responded with ${res.status}`);
  const html = await res.text();
  if (!html.toLowerCase().includes("coach") && !html.toLowerCase().includes("programme")) {
    throw new Error("Unexpected landing content");
  }
}

async function main() {
  await runStep("API health", async () => {
    await jsonRequest("/health");
  });

  await runStep("Public brand", async () => {
    await jsonRequest("/api/public/brand");
  });

  await runStep("Public site", async () => {
    await jsonRequest("/api/public/site");
  });

  let memberToken = "";
  await runStep("Member login + dashboard", async () => {
    memberToken = await login(MEMBER_EMAIL, DEFAULT_PASSWORD);
    await jsonRequest("/api/member/dashboard", {
      headers: { Authorization: `Bearer ${memberToken}` }
    });
  });

  await runStep("Member offers API", async () => {
    await jsonRequest("/api/member/packs", {
      headers: { Authorization: `Bearer ${memberToken}` }
    });
  });

  let coachToken = "";
  await runStep("Coach login + products", async () => {
    coachToken = await login(COACH_EMAIL, DEFAULT_PASSWORD);
    await jsonRequest("/api/coach/products", {
      headers: { Authorization: `Bearer ${coachToken}` }
    });
  });

  await runStep("Coach calendar feed", async () => {
    await jsonRequest("/api/coach/bookings", {
      headers: { Authorization: `Bearer ${coachToken}` }
    });
  });

  await runStep("Frontend landing page", checkFrontend);

  const failed = results.filter((r) => !r.success);
  console.info("\nSmoke summary:");
  results.forEach((result) => {
    if (result.success) {
      console.info(`  • ${result.name}`);
    } else {
      console.info(`  • ${result.name} (FAILED) - ${result.error}`);
    }
  });

  if (failed.length > 0) {
    process.exitCode = 1;
  } else {
    console.info("\nAll integration checks passed ✅");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
