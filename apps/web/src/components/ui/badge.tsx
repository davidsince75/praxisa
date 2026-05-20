import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils.js";

const badgeVariants = cva(
  "inline-flex items-center px-2 py-0.5 text-xs font-bold uppercase tracking-wider",
  {
    variants: {
      variant: {
        default: "bg-teal/15 text-teal-dark",
        pending: "bg-sand/20 text-[#8A6A30]",
        in_progress: "bg-steel/20 text-[#4A6270]",
        completed: "bg-olive/20 text-[#4A5230]",
        rejected: "bg-rose/20 text-rose",
        destructive: "bg-destructive/15 text-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
