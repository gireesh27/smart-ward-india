export const metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 prose-page">
      <h1 className="text-3xl font-bold text-navy-700">Privacy policy</h1>
      <p className="text-sm text-ink-500">Template for the demonstration deployment. Review with legal counsel (including India&apos;s Digital Personal Data Protection Act, 2023) before any real-world use.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Account details: name, email address, optional phone number and home ward.</li>
        <li>Complaint details you submit: description, category, address, optional map location and photos.</li>
        <li>Technical data needed to keep the service secure: session records, IP address for rate limiting, and audit logs of administrative actions.</li>
      </ul>
      <h2>How we use it</h2>
      <ul>
        <li>To route your complaint to the responsible ward office and keep you informed.</li>
        <li>To publish aggregated, anonymous statistics on the public dashboard.</li>
        <li>We do not sell personal data or use it for advertising.</li>
      </ul>
      <h2>Who can see your complaint</h2>
      <p>You and administrators responsible for your ward can see your complaint in full. The public dashboard shows only counts and ward-level figures — never your name, contact details, photos, exact location or internal notes. Exported reports exclude reporter identity.</p>
      <h2>Optional AI summaries</h2>
      <p>If an operator enables external narrative summaries, only aggregated, rule-generated alert text is sent. Personal data is never included.</p>
      <h2>Retention and your choices</h2>
      <p>You can update your profile and notification preferences at any time. To request access, correction or deletion of your data, contact us through the contact page.</p>
    </div>
  );
}
