import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/session";
import { geoPathFor } from "@/lib/services/geo";
import { AdminTopBar } from "@/components/admin/AdminChrome";
import { Card } from "@/components/ui";
import { ProjectForm } from "@/components/admin/ProjectForm";

export const metadata = { title: "New project" };

export default async function NewProject() {
  const actor = await requireAdminPage("/admin/projects/new");
  const [path, categories, departments] = await Promise.all([geoPathFor({}), prisma.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }), prisma.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" } })]);
  return (
    <>
      <AdminTopBar actor={actor} title="New project" />
      <Card variant="admin" title="Project details"><ProjectForm path={path} categories={categories} departments={departments} /></Card>
    </>
  );
}
