import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium [&_svg]:size-3", {
  variants: {
    variant: {
      default: "bg-brand-soft text-brand-strong",
      outline: "border text-foreground",
      muted: "bg-muted text-muted-foreground",
      positive: "bg-positive-soft text-positive",
      warning: "bg-warning-soft text-warning-strong",
      risk: "bg-risk-soft text-risk",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
