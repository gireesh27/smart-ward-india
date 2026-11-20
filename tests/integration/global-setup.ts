// Load .env if present (Node >= 20.12); existing variables take precedence.
try { process.loadEnvFile(".env"); } catch { /* no .env file */ }
import { execSync } from "node:child_process";

/** Sync the schema into the dedicated test database before integration tests run. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    console.warn("[vitest] TEST_DATABASE_URL not set — integration tests will be skipped.");
    return;
  }
  execSync("npx prisma db push --skip-generate --accept-data-loss", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
}
