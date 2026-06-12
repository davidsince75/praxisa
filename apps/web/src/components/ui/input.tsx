import { forwardRef } from "react";
import { cn } from "@/lib/utils.js";

const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    className={cn(
      "flex h-11 w-full border border-input bg-background px-3 py-2 text-base placeholder:text-muted-foreground transition-colors duration-200 hover:border-mid focus:border-teal disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
