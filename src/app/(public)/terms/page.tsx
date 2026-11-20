export const metadata = { title: "Terms of use" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 prose-page">
      <h1 className="text-3xl font-bold text-navy-700">Terms of use</h1>
      <p className="text-sm text-ink-500">Template for the demonstration deployment.</p>
      <h2>Independent demonstration</h2>
      <p>Smart Ward India is an independent demonstration platform. It is not an official government service, and submitting a complaint here does not create any legal obligation for a public authority. In an emergency, contact local emergency services.</p>
      <h2>Your responsibilities</h2>
      <ul>
        <li>Report genuine issues truthfully and without abusive or unlawful content.</li>
        <li>Only upload photos you have the right to share, and avoid photographing people&apos;s faces or private information.</li>
        <li>Keep your password secure and do not share your account.</li>
      </ul>
      <h2>Moderation</h2>
      <p>Administrators may reject duplicate, abusive or out-of-scope reports and will record a reason that you can see.</p>
      <h2>Availability</h2>
      <p>The service is provided as is, without guarantees of availability or accuracy. Development scores and alerts are calculated from recorded data and may be incomplete.</p>
    </div>
  );
}
