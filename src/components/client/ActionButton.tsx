"use client";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "./ApiForm";
import { useToast } from "./Toast";

/** One-click API action with an optional confirmation dialog (used for destructive actions). */
export function ActionButton({
  action, method = "POST", body, children, className = "btn-outline btn-sm", successMessage, redirectTo, confirm,
}: {
  action: string; method?: "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown; children: ReactNode; className?: string;
  successMessage?: string; redirectTo?: string; confirm?: { title: string; message: string; confirmLabel: string; danger?: boolean };
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function run() {
    setPending(true);
    const res = await apiRequest(action, method, body ?? {});
    setPending(false);
    setOpen(false);
    if (!res.ok) { toast.error(res.message); return; }
    if (successMessage) toast.success(successMessage);
    if (redirectTo) router.push(redirectTo); else router.refresh();
  }

  return (
    <>
      <button type="button" className={className} disabled={pending} aria-busy={pending} onClick={() => (confirm ? setOpen(true) : run())}>{children}</button>
      {confirm && (
        <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
          <DialogContent>
              <DialogTitle>{confirm.title}</DialogTitle>
              <DialogDescription>{confirm.message}</DialogDescription>
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" className="btn-outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</button>
                <button type="button" className={confirm.danger ? "btn-danger" : "btn-primary"} onClick={run} disabled={pending}>{pending ? "Working…" : confirm.confirmLabel}</button>
              </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
