import { z } from "zod";

const bool = z.enum(["true", "false"]).transform((v) => v === "true");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  BETTER_AUTH_SECRET: z.string().min(16, "BETTER_AUTH_SECRET must be at least 16 characters"),
  // "local" stores uploads on disk (default; no extra services). "s3" uses any S3-compatible store.
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  UPLOAD_DIR: z.string().default("./storage/uploads"),
  S3_CREATE_BUCKET: bool.default("false"),
  S3_ENDPOINT: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().default("smartward-uploads"),
  S3_ACCESS_KEY_ID: z.string().default(""),
  S3_SECRET_ACCESS_KEY: z.string().default(""),
  S3_FORCE_PATH_STYLE: bool.default("true"),
  // "smtp" sends real mail (Mailpit locally). "console" prints emails to the dev server terminal.
  MAIL_TRANSPORT: z.enum(["smtp", "console"]).default("smtp"),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().default(1025),
  SMTP_SECURE: bool.default("false"),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().default("Smart Ward India <no-reply@smartward.test>"),
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
  UPLOAD_MAX_VIDEO_BYTES: z.coerce.number().int().positive().default(50 * 1024 * 1024),
  LGD_DATA_DIR: z.string().default("data/lgd/andhra-pradesh"),
  UPLOAD_MAX_FILES: z.coerce.number().int().positive().max(20).default(6),
  // LLM insights (docs/AI.md). none | ollama | openai | anthropic
  AI_PROVIDER: z.enum(["", "none", "ollama", "openai", "anthropic"]).optional(),
  AI_MODEL: z.string().optional(),
  AI_BASE_URL: z.string().url().optional().or(z.literal("")),
  AI_API_KEY: z.string().optional(),
  AI_TIMEOUT_MS: z.coerce.number().int().min(5000).max(600000).default(120000),
  // Deprecated aliases kept for older .env files.
  AI_SUMMARY_PROVIDER: z.string().optional(),
  AI_SUMMARY_API_KEY: z.string().optional(),
  AI_SUMMARY_MODEL: z.string().optional(),
});

export type Env = z.infer<typeof schema>;
let cached: Env | null = null;

/** Validated environment, parsed lazily so `next build` never needs secrets. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration — ${problems}. See .env.example.`);
  }
  cached = parsed.data;
  return cached;
}
