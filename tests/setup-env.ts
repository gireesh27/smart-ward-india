// Load .env if present (Node >= 20.12); existing variables take precedence.
try { process.loadEnvFile(".env"); } catch { /* no .env file */ }
// Point every test at the isolated test database and provide safe defaults.
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.BETTER_AUTH_SECRET ??= "test-secret-test-secret-test-secret";
process.env.APP_URL ??= "http://localhost:3000";
process.env.SMTP_HOST ??= "127.0.0.1";
process.env.SMTP_PORT ??= "1025";
