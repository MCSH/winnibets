import { cn } from "@/lib/utils";

interface ToggleGroupProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: { value: T; label: string; description?: string }[];
  className?: string;
}

export function ToggleGroup<T extends string>({
  value,
  onValueChange,
  options,
  className,
}: ToggleGroupProps<T>) {
  return (
    <div className={cn("flex gap-2", className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onValueChange(opt.value)}
          className={cn(
            "flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer border",
            value === opt.value
              ? "bg-accent/15 border-accent/50 text-accent shadow-sm shadow-accent/5"
              : "bg-ink border-ink-border text-chalk-dim hover:border-ink-muted hover:text-chalk",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
