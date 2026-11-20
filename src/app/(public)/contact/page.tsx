import { ApiForm, FieldError, SubmitButton } from "@/components/client/ApiForm";
import { getSiteContent } from "@/lib/settings";

export const metadata = { title: "Contact", description: "Contact the Smart Ward India team about pilots, government collaboration, CSR partnerships or support for your ward.", alternates: { canonical: "/contact" } };
const TYPES = [["GENERAL", "General question"], ["GOVERNMENT", "Government collaboration"], ["CSR", "CSR partnership"], ["INNOVATION", "Innovation support"]];

export default async function ContactPage({ searchParams }: { searchParams: { type?: string } }) {
  const content = await getSiteContent();
  const type = TYPES.some(([v]) => v === searchParams.type) ? searchParams.type : "GENERAL";
  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 md:grid-cols-[1fr_320px]">
      <div>
        <h1 className="text-3xl font-bold text-navy-700">Contact us</h1>
        <p className="mt-2 text-ink-700">To report a local problem, use <a className="link" href="/report">Report a problem</a> instead — it reaches your ward office directly.</p>
        <ApiForm action="/api/contact" successMessage="Message sent. We will reply by email." resetOnSuccess refresh={false} className="card mt-6 space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="name">Your name</label><input id="name" name="name" className="input" required maxLength={80} autoComplete="name" /><FieldError name="name" /></div>
            <div><label className="label" htmlFor="organization">Organisation <span className="font-normal text-ink-500">(optional)</span></label><input id="organization" name="organization" className="input" maxLength={120} autoComplete="organization" /></div>
            <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" className="input" required autoComplete="email" /><FieldError name="email" /></div>
            <div><label className="label" htmlFor="phone">Phone <span className="font-normal text-ink-500">(optional)</span></label><input id="phone" name="phone" className="input" maxLength={20} autoComplete="tel" /></div>
          </div>
          <div><label className="label" htmlFor="type">Topic</label><select id="type" name="type" className="select" defaultValue={type}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div><label className="label" htmlFor="message">Message</label><textarea id="message" name="message" className="input min-h-[140px]" required minLength={20} maxLength={2000} /><FieldError name="message" /></div>
          <div className="hidden" aria-hidden="true"><label htmlFor="website">Website</label><input id="website" name="website" tabIndex={-1} autoComplete="off" /></div>
          <SubmitButton className="btn-orange" pendingText="Sending…">Send message</SubmitButton>
        </ApiForm>
      </div>
      <aside className="card h-fit space-y-2 p-5 text-sm">
        <h2 className="text-lg font-semibold">Reach us</h2>
        <p>{content.location}</p>
        <p><a className="link" href={`mailto:${content.contactEmail}`}>{content.contactEmail}</a></p>
        <p>{content.website}</p>
        <p className="pt-2 text-xs text-ink-500">We use your details only to reply to this message. See the <a className="link" href="/privacy">privacy policy</a>.</p>
      </aside>
    </div>
  );
}
