import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/config";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      <rect width="32" height="32" rx="9" className="fill-brand" />
      <path d="M8 21.5c3.2-1.2 5.3-3.6 6.6-7.2.6 2.6 1.9 4.4 3.9 4.4 2.3 0 3.7-2.6 5.5-8.2" fill="none" className="stroke-brand-foreground" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24" cy="10.5" r="2.2" className="fill-brand-foreground" />
    </svg>
  );
}

export function Logo({ href = "/", suffix }: { href?: string; suffix?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
      <LogoMark />
      <span>{PRODUCT_NAME}</span>
      {suffix && <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">{suffix}</span>}
    </Link>
  );
}
