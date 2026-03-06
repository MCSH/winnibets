import PhoneInput from "react-phone-number-input/input";
import type { E164Number } from "libphonenumber-js/core";
import { cn } from "@/lib/utils";

interface PhoneFieldProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  autoFocus?: boolean;
  placeholder?: string;
}

export function PhoneField({
  value,
  onChange,
  className,
  autoFocus,
  placeholder = "(204) 555-1234",
}: PhoneFieldProps) {
  return (
    <PhoneInput
      country="US"
      international={false}
      value={(value || undefined) as E164Number | undefined}
      onChange={(v) => onChange(v ?? "")}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className={cn(
        "flex h-10 w-full rounded-lg border border-ink-border bg-ink px-4 py-2 text-[16px] text-chalk placeholder:text-ink-muted transition-colors focus-visible:outline-none focus-visible:border-accent/60 focus-visible:ring-1 focus-visible:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm",
        className,
      )}
    />
  );
}
