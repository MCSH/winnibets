import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default:
          "bg-accent text-white font-bold hover:bg-accent-bright shadow-md shadow-accent/25 hover:shadow-accent/40",
        destructive:
          "bg-lose/15 text-lose border border-lose/30 hover:bg-lose/25",
        outline:
          "border border-ink-border bg-transparent text-chalk-dim hover:bg-ink-lighter hover:text-chalk hover:border-ink-muted",
        secondary:
          "bg-ink-lighter text-chalk-dim border border-ink-border hover:text-chalk hover:border-ink-muted",
        ghost:
          "text-chalk-dim hover:bg-ink-lighter hover:text-chalk",
        link: "text-accent underline-offset-4 hover:underline hover:text-accent-bright",
        success:
          "bg-win/15 text-win border border-win/40 hover:bg-win/25",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-12 rounded-lg px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
