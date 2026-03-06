import { useState } from "react";
import { Input } from "@/components/ui/input";

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  // Strip leading 1 for display formatting
  const d =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`;
}

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
  const [focused, setFocused] = useState(false);

  return (
    <Input
      type="tel"
      value={focused ? value : formatPhone(value)}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      autoComplete="tel"
      className={className}
    />
  );
}
