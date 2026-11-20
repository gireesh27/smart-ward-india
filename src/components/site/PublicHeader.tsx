import type { SiteContent } from "@/lib/settings";
import { FloatingNav } from "./FloatingNav";
import { ASSET } from "@/lib/assets";

export function PublicHeader({ content, actor }: { content: SiteContent; actor: { name: string; isAdmin: boolean } | null }) {
  return <FloatingNav subtitle={content.subtitle} taglineOne={content.taglineOne} taglineTwo={content.taglineTwo} actor={actor} logoSrc={ASSET.logo()} />;
}
