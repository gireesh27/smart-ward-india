import { PublicHeader } from "@/components/site/PublicHeader";
import { PublicFooter } from "@/components/site/PublicFooter";
import { getSiteContent } from "@/lib/settings";
import { getActor } from "@/lib/session";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [content, actor] = await Promise.all([getSiteContent(), getActor()]);
  return (
    <div className="bg-page flex min-h-screen flex-col overflow-x-clip">
      <PublicHeader content={content} actor={actor ? { name: actor.name, isAdmin: actor.isAdmin } : null} />
      <main id="main" className="flex-1">{children}</main>
      <PublicFooter content={content} />
    </div>
  );
}
