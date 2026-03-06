import { Input } from "@/components/ui/input";

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
    <Input
      type="tel"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      autoComplete="tel"
      className={className}
    />
  );
}
