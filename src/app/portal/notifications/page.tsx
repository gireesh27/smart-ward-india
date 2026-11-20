import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/session";
import { fmtRelative } from "@/lib/format";
import { EmptyState, PageTitle } from "@/components/ui";
import { ActionButton } from "@/components/client/ActionButton";

export const metadata = { title: "Notifications" };

export default async function Notifications() {
  const actor = await requireActor("/portal/notifications");
  const items = await prisma.notification.findMany({ where: { userId: actor.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const unread = items.filter((i) => !i.readAt).length;
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Notifications" subtitle={`${unread} unread`} actions={unread > 0 ? <ActionButton action="/api/notifications" body={{ all: true }} successMessage="All marked as read." className="btn-outline btn-sm">Mark all as read</ActionButton> : undefined} />
      {items.length === 0 ? <EmptyState title="No notifications yet">Updates about your complaints and ward announcements will appear here.</EmptyState> : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id} className={`card flex gap-3 p-4 ${n.readAt ? "opacity-75" : "border-l-4 border-l-brand-600"}`}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink-900">{n.title}</p>
                <p className="text-sm">{n.body}</p>
                <p className="text-xs text-ink-500">{fmtRelative(n.createdAt)}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                {n.link && <Link href={n.link} className="link text-sm">Open</Link>}
                {!n.readAt && <ActionButton action="/api/notifications" body={{ ids: [n.id] }} className="btn-ghost btn-sm">Mark read</ActionButton>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
