"use client";
import type { SelectHTMLAttributes } from "react";

/** A <select> inside a GET filter form that applies itself on change (the form still works without JS). */
export function AutoSubmitSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
