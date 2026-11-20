import nodemailer, { type Transporter } from "nodemailer";
import { env } from "./env";
import { log } from "./logger";

let transport: Transporter | null = null;
function transporter(): Transporter {
  if (transport) return transport;
  const e = env();
  transport = nodemailer.createTransport({
    host: e.SMTP_HOST,
    port: e.SMTP_PORT,
    secure: e.SMTP_SECURE,
    auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASSWORD } : undefined,
  });
  return transport;
}

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function emailLayout(opts: { heading: string; paragraphs: string[]; cta?: { label: string; url: string } }) {
  const body = opts.paragraphs.map((p) => `<p style="margin:0 0 14px;font:15px/1.55 Arial,sans-serif;color:#2b3a55">${escapeHtml(p)}</p>`).join("");
  const cta = opts.cta
    ? `<p style="margin:22px 0"><a href="${escapeHtml(opts.cta.url)}" style="background:#0059bc;color:#fff;padding:12px 22px;border-radius:24px;text-decoration:none;font:600 15px Arial,sans-serif">${escapeHtml(opts.cta.label)}</a></p><p style="font:12px Arial,sans-serif;color:#5d6b85">If the button does not work, paste this link into your browser:<br>${escapeHtml(opts.cta.url)}</p>`
    : "";
  const html = `<div style="background:#eef5fd;padding:24px"><div style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden">
<div style="background:#002e64;color:#fff;padding:18px 24px;font:700 18px Arial,sans-serif">Smart Ward India</div>
<div style="padding:24px"><h1 style="margin:0 0 16px;font:700 20px Arial,sans-serif;color:#0d3a73">${escapeHtml(opts.heading)}</h1>${body}${cta}</div>
<div style="padding:14px 24px;background:#f5f8fc;font:12px Arial,sans-serif;color:#5d6b85">Independent demonstration platform. Not an official government service.</div></div></div>`;
  const text = [opts.heading, "", ...opts.paragraphs, ...(opts.cta ? ["", `${opts.cta.label}: ${opts.cta.url}`] : [])].join("\n");
  return { html, text };
}

export async function sendMail(to: string, subject: string, content: { html: string; text: string }) {
  if (env().MAIL_TRANSPORT === "console") {
    // Development fallback when no SMTP inbox is available: print the email (including links) to the server terminal.
    if (env().NODE_ENV === "production") { log.warn("mail.console_transport_in_production", { subject }); return; }
    console.log(`\n──── Email (MAIL_TRANSPORT=console) ─────────────────\nTo: ${to}\nSubject: ${subject}\n\n${content.text}\n─────────────────────────────────────────────────────\n`);
    return;
  }
  try {
    await transporter().sendMail({ from: env().MAIL_FROM, to, subject, html: content.html, text: content.text });
  } catch (err) {
    // Never block the user's action on mail delivery; surface in logs instead.
    log.error("mail.send_failed", { subject, err });
  }
}
