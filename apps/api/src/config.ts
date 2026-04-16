/**
 * Centralized configuration — every env var is read once and validated here.
 * Import `config` wherever you need a setting instead of reading process.env directly.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

function optionalBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw.toLowerCase() === "true";
}

function optionalInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return Number(raw);
}

const isProd = process.env.NODE_ENV === "production";

export const config = {
  isProd,
  port: optionalInt("PORT", 4000),
  host: optional("HOST", "0.0.0.0"),

  // Web app base URL (used in emails, redirect links)
  webBaseUrl: optional("APP_WEB_BASE_URL", "http://localhost:3000"),

  // Public API base URL (used for attachment download links)
  publicApiBaseUrl: optional("PUBLIC_API_BASE_URL", "http://localhost:4000").replace(/\/+$/, ""),

  // SMTP / Email
  smtp: {
    host: optional("SMTP_HOST", ""),
    port: optionalInt("SMTP_PORT", 587),
    user: optional("SMTP_USER", ""),
    pass: optional("SMTP_PASS", ""),
    from: optional("SMTP_FROM", "noreply@rfq-platform.local"),
    get enabled() {
      return !!this.host;
    },
  },

  // S3 / Object storage
  storage: {
    endpoint: optional("STORAGE_ENDPOINT", "localhost"),
    port: optionalInt("STORAGE_PORT", 9000),
    useSsl: optionalBool("STORAGE_USE_SSL", false),
    accessKey: optional("STORAGE_ACCESS_KEY", "minio"),
    secretKey: optional("STORAGE_SECRET_KEY", "minio123"),
    region: optional("STORAGE_REGION", "us-east-1"),
    bucket: optional("STORAGE_BUCKET", "rfq-attachments"),
  },

  // Cron / scheduled tasks
  cronSecret: optional("CRON_SECRET", ""),

  // Bootstrap admin (first-run only)
  bootstrap: {
    email: process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase(),
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim(),
    name: optional("BOOTSTRAP_ADMIN_NAME", "Bootstrap Admin").trim(),
  },
} as const;
