/**
 * Production-safe bootstrap of the first super administrator. No password is
 * set or printed: the user receives a single-use password-setup email.
 *
 *   npm run admin:create -- --email admin@your-domain --name "Jane Doe" [--force]
 */
import { randomBytes } from "node:crypto";
import { prisma } from "../src/lib/db";
import { auth, suppressVerificationEmail } from "../src/lib/auth";

async function main() {
  const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i > -1 ? process.argv[i + 1] : undefined; };
  const email = arg("email")?.trim().toLowerCase();
  const name = arg("name")?.trim();
  if (!email || !name) { console.error('Usage: npm run admin:create -- --email you@example.org --name "Full Name"'); process.exit(1); }
  if (!process.argv.includes("--force") && (await prisma.user.count({ where: { role: "SUPER_ADMIN" } })) > 0) {
    console.error("A super administrator already exists. Create further admins from Settings → Users, or pass --force.");
    process.exit(1);
  }
  if (await prisma.user.findUnique({ where: { email } })) {
    await prisma.user.update({ where: { email }, data: { role: "SUPER_ADMIN", emailVerified: true, isActive: true } });
    console.log(`Promoted existing account ${email} to super administrator.`);
  } else {
    suppressVerificationEmail(email);
    await auth.api.signUpEmail({ body: { name, email, password: randomBytes(24).toString("base64url") } });
    await prisma.user.update({ where: { email }, data: { role: "SUPER_ADMIN", emailVerified: true } });
    await auth.api.forgetPassword({ body: { email, redirectTo: "/reset-password?welcome=1" } });
    console.log(`Created ${email}. A password-setup email has been sent (link valid 30 minutes).`);
  }
  await prisma.user.findUnique({ where: { email } }).then((u) => prisma.auditLog.create({ data: { actorId: null, action: "user.bootstrap_super_admin", entityType: "User", entityId: u?.id, summary: email } }));
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
