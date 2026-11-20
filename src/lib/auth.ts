import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "./db";
import { emailLayout, sendMail } from "./mailer";

const appUrl = process.env.APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

// Accounts created by administrators (or the dev seed) are verified directly and
// receive a password-setup email instead, so their sign-up verification mail is skipped.
const suppressed = new Set<string>();
export function suppressVerificationEmail(email: string) {
  suppressed.add(email.toLowerCase());
  setTimeout(() => suppressed.delete(email.toLowerCase()), 60_000).unref?.();
}

/**
 * Better Auth with database-backed sessions (Session table) and
 * email + password credentials. Public sign-up can only ever create CITIZEN
 * accounts: `role` is not an auth field, so it always takes the column default.
 */
export const auth = betterAuth({
  appName: "Smart Ward India",
  baseURL: appUrl,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [appUrl],
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 60 * 30, // 30 minutes, single use (stored in Verification, deleted on use)
    sendResetPassword: async ({ user, url }) => {
      await sendMail(
        user.email,
        "Reset your Smart Ward India password",
        emailLayout({
          heading: "Reset your password",
          paragraphs: [
            `Hello ${user.name},`,
            "We received a request to reset your password. The link below works once and expires in 30 minutes.",
            "If you did not ask for this, you can ignore this email — your password will not change.",
          ],
          cta: { label: "Choose a new password", url },
        }),
      );
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60, // 1 hour
    sendVerificationEmail: async ({ user, url }) => {
      if (suppressed.has(user.email.toLowerCase()) || process.env.SEEDING === "1") return;
      await sendMail(
        user.email,
        "Verify your email for Smart Ward India",
        emailLayout({
          heading: "Confirm your email address",
          paragraphs: [`Hello ${user.name},`, "Confirm your email to start reporting and tracking issues in your ward. This link expires in 1 hour."],
          cta: { label: "Verify email", url },
        }),
      );
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,     // refresh expiry at most daily
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 300, max: 5 },
      "/forget-password": { window: 300, max: 3 },
      "/reset-password": { window: 300, max: 5 },
      "/send-verification-email": { window: 300, max: 3 },
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  databaseHooks: {
    session: {
      create: {
        // Deactivated accounts cannot start new sessions.
        before: async (session) => {
          const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { isActive: true } });
          if (!user?.isActive) return false;
        },
      },
    },
  },
  plugins: [nextCookies()],
});
