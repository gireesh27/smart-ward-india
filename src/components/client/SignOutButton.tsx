"use client";
import { useRouter } from "next/navigation";
import { LogOut } from "@/components/app-icons";
import { authClient } from "@/lib/auth-client";

export function SignOutButton({ className = "btn-ghost", withIcon = true }: { className?: string; withIcon?: boolean }) {
  const router = useRouter();
  return (
    <button type="button" className={className} onClick={async () => { await authClient.signOut(); router.push("/"); router.refresh(); }}>
      {withIcon && <LogOut className="h-5 w-5" aria-hidden="true" />}<span>Logout</span>
    </button>
  );
}
