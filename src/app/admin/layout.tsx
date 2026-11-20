import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/session";
import { complaintScopeWhere } from "@/lib/authz";
import { AdminFooter, AdminSidebar } from "@/components/admin/AdminChrome";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireAdminPage();
  const newComplaints = await prisma.complaint.count({ where: { status: "SUBMITTED", ...complaintScopeWhere(actor) } });
  return (
    <div className="admin-canvas min-h-screen lg:grid lg:grid-cols-[228px_minmax(0,1fr)]">
      <AdminSidebar newComplaints={newComplaints} />
      <div className="flex min-h-screen min-w-0 flex-col">
        <main id="main" className="flex-1 px-3 py-3 md:px-4">{children}</main>
        <AdminFooter />
      </div>
    </div>
  );
}
