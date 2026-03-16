import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-muted text-foreground",
        destructive: "border-transparent bg-danger text-danger-foreground",
        success: "border-transparent bg-success text-success-foreground",
        warning: "border-border bg-[#fff1d7] text-[#855615]",
        outline: "text-foreground border-border",
        new: "bg-[#fff5e8] text-[#8a5a2a] border-[#e8c89a]",
        progress: "bg-muted text-foreground border-border",
        pending: "bg-[#fff1d7] text-[#855615] border-[#ebcc8f]",
        approved: "bg-[#e7f7ed] text-[#2d6a1e] border-[#98d4af]",
        rejected: "bg-[#fdeaea] text-[#882f2f] border-[#ebb2b2]",
        revision: "bg-[#faeadf] text-[#854c1d] border-[#e7be9b]",
        closed: "bg-[#f0ece8] text-[#5a5a5a] border-[#d0c8c0]",
        active: "bg-[#e7f7ed] text-[#2d6a1e] border-[#98d4af]",
        inactive: "bg-[#fdeaea] text-[#882f2f] border-[#ebb2b2]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
