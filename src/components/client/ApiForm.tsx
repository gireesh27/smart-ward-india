"use client";
import { createContext, useContext, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./Toast";

type FieldErrors = Record<string, string[] | undefined>;
const FormCtx = createContext<{ errors: FieldErrors; pending: boolean }>({ errors: {}, pending: false });

/** FormData → JSON. `name[]` collects arrays; listed boolean fields become true/false. */
export function formToObject(fd: FormData, booleans: string[] = []) {
  const out: Record<string, unknown> = {};
  fd.forEach((v, k) => {
    if (typeof v !== "string") return;
    if (k.endsWith("[]")) {
      const key = k.slice(0, -2);
      const arr = (out[key] as string[] | undefined) ?? [];
      if (v !== "") arr.push(v);
      out[key] = arr;
    } else {
      out[k] = v === "" ? undefined : v;
    }
  });
  for (const b of booleans) out[b] = out[b] === "on" || out[b] === "true";
  return out;
}

export async function apiRequest<T = unknown>(url: string, method: string, body?: unknown): Promise<{ ok: true; data: T } | { ok: false; message: string; fieldErrors: FieldErrors; status: number }> {
  try {
    const res = await fetch(url, { method, headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, status: res.status, message: json?.error?.message ?? `Request failed (${res.status}).`, fieldErrors: json?.error?.details?.fieldErrors ?? {} };
    return { ok: true, data: json.data as T };
  } catch {
    return { ok: false, status: 0, message: "Network error. Check your connection and try again.", fieldErrors: {} };
  }
}

export function ApiForm({
  action, method = "POST", children, className, successMessage, redirectTo, resetOnSuccess = false, booleans = [], refresh = true, id,
}: {
  action: string; method?: "POST" | "PUT" | "PATCH" | "DELETE"; children: ReactNode; className?: string; successMessage?: string;
  /** May contain "{id}", replaced by the id returned from the API. */
  redirectTo?: string; resetOnSuccess?: boolean; booleans?: string[]; refresh?: boolean; id?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const ref = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setPending(true); setErrors({}); setFormError(null);
    const res = await apiRequest<{ id?: string }>(action, method, formToObject(new FormData(e.currentTarget), booleans));
    setPending(false);
    if (!res.ok) {
      setErrors(res.fieldErrors);
      setFormError(res.message);
      return;
    }
    if (successMessage) toast.success(successMessage);
    if (resetOnSuccess) ref.current?.reset();
    if (redirectTo) router.push(redirectTo.replace("{id}", encodeURIComponent(res.data?.id ?? "")));
    else if (refresh) router.refresh();
  }

  return (
    <FormCtx.Provider value={{ errors, pending }}>
      <form ref={ref} id={id} onSubmit={onSubmit} className={className} noValidate={false}>
        {children}
        {formError && <p role="alert" className="mt-3 rounded-md bg-alert-100 px-3 py-2 text-sm font-medium text-alert-600">{formError}</p>}
      </form>
    </FormCtx.Provider>
  );
}

export function FieldError({ name }: { name: string }) {
  const { errors } = useContext(FormCtx);
  const msg = errors[name]?.[0];
  return msg ? <p className="field-error" id={`${name}-error`}>{msg}</p> : null;
}

export function SubmitButton({ children, className = "btn-primary", pendingText = "Saving…" }: { children: ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useContext(FormCtx);
  return <button type="submit" className={className} disabled={pending} aria-busy={pending}>{pending ? pendingText : children}</button>;
}
