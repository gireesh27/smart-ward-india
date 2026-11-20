import type { GeoPath } from "@/lib/geo-types";
import { GeoPicker } from "@/components/client/GeoPicker";
import { ApiForm, FieldError, SubmitButton } from "@/components/client/ApiForm";
import { toDateInput } from "@/lib/format";

type P = { id?: string; name: string; description: string; categoryId: string; wardId: string; departmentId: string | null; budget: string; expenditure: string; startDate: Date | null; targetDate: Date | null; status: string; progressMode: string; isPublic: boolean };

export function ProjectForm({ project, path, categories, departments }: {
  project?: P; path?: GeoPath; categories: Array<{ id: string; name: string }>; departments: Array<{ id: string; name: string }>;
}) {
  const p = project;
  return (
    <ApiForm action={p?.id ? `/api/projects/${p.id}` : "/api/projects"} method={p?.id ? "PUT" : "POST"} booleans={["isPublic"]} successMessage={p?.id ? "Project saved." : "Project created."} redirectTo={p?.id ? undefined : "/admin/projects/{id}"} className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2"><label className="label" htmlFor="pf-name">Project name</label><input id="pf-name" name="name" className="input" defaultValue={p?.name} required minLength={4} maxLength={140} /><FieldError name="name" /></div>
      <div className="md:col-span-2"><label className="label" htmlFor="pf-desc">Description</label><textarea id="pf-desc" name="description" className="input min-h-[110px]" defaultValue={p?.description} required minLength={10} /><FieldError name="description" /></div>
      <fieldset className="md:col-span-2"><legend className="label">Location</legend><GeoPicker defaultValue={path} names={{ ward: "wardId" }} scoped required idPrefix="pf" /><FieldError name="wardId" /></fieldset>
      <div><label className="label" htmlFor="pf-cat">Category</label><select id="pf-cat" name="categoryId" className="select" defaultValue={p?.categoryId} required>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <div><label className="label" htmlFor="pf-dept">Responsible department</label><select id="pf-dept" name="departmentId" className="select" defaultValue={p?.departmentId ?? ""}><option value="">Not set</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
      <div><label className="label" htmlFor="pf-status">Status</label><select id="pf-status" name="status" className="select" defaultValue={p?.status ?? "PLANNED"}>{["PLANNED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"].map((s) => <option key={s} value={s}>{s.replace("_", " ").toLowerCase()}</option>)}</select></div>
      <div><label className="label" htmlFor="pf-budget">Budget (₹)</label><input id="pf-budget" name="budget" type="number" min="0" step="1" className="input" defaultValue={p?.budget} required /><FieldError name="budget" /></div>
      <div><label className="label" htmlFor="pf-spent">Expenditure to date (₹)</label><input id="pf-spent" name="expenditure" type="number" min="0" step="1" className="input" defaultValue={p?.expenditure ?? "0"} /></div>
      <div><label className="label" htmlFor="pf-start">Start date</label><input id="pf-start" name="startDate" type="date" className="input" defaultValue={toDateInput(p?.startDate)} required /></div>
      <div><label className="label" htmlFor="pf-target">Target date</label><input id="pf-target" name="targetDate" type="date" className="input" defaultValue={toDateInput(p?.targetDate)} required /><FieldError name="targetDate" /></div>
      <div><label className="label" htmlFor="pf-mode">Progress calculated from</label><select id="pf-mode" name="progressMode" className="select" defaultValue={p?.progressMode ?? "MILESTONES"}><option value="MILESTONES">Completed milestones (weighted)</option><option value="MANUAL">Manual updates (audited)</option></select></div>
      <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="isPublic" defaultChecked={p?.isPublic ?? true} />Show on the public dashboard</label>
      <div className="md:col-span-2"><SubmitButton>{p?.id ? "Save changes" : "Create project"}</SubmitButton></div>
    </ApiForm>
  );
}
