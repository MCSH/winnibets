import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { requestMagicLink } from "@/lib/api";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { PhoneField } from "@/components/ui/phone-input";
import { Card, CardContent } from "@/components/ui/card";
import { MessageCircle, Mail, ArrowLeft } from "lucide-react";

type AuthMode = "phone" | "email";

export default function Login() {
  const lastLogin = (() => {
    try {
      const raw = localStorage.getItem("winnibets_last_login");
      if (raw) return JSON.parse(raw) as { mode: AuthMode; identifier: string };
    } catch { /* ignore */ }
    return null;
  })();

  const [mode, setMode] = useState<AuthMode>(lastLogin?.mode ?? "phone");
  const [identifier, setIdentifier] = useState(lastLogin?.identifier ?? "");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    let cleaned = identifier.trim();

    if (mode === "phone") {
      if (!cleaned || cleaned.length < 10) {
        setError("Enter a valid phone number");
        return;
      }
      // react-phone-number-input already returns E.164 format
      // but if someone types raw digits, normalize
      if (!cleaned.startsWith("+")) {
        const digits = cleaned.replace(/\D/g, "");
        if (digits.length === 10) {
          cleaned = `+1${digits}`;
        } else if (digits.length === 11 && digits.startsWith("1")) {
          cleaned = `+${digits}`;
        } else {
          setError("Enter a valid 10-digit phone number");
          return;
        }
      }
    } else {
      if (!cleaned.includes("@") || cleaned.length < 5) {
        setError("Enter a valid email address");
        return;
      }
    }

    setLoading(true);
    try {
      await requestMagicLink(cleaned, mode);
      localStorage.setItem("winnibets_last_login", JSON.stringify({ mode, identifier: cleaned }));
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm"
      >
        {/* Brand */}
        <div className="text-center mb-10">
          <Link to="/" className="no-underline">
            <h1 className="font-display text-6xl tracking-wider text-accent leading-none">
              WINNIBETS
            </h1>
          </Link>
          <p className="text-chalk-dim text-sm mt-2">
            Sign in to start betting
          </p>
        </div>

        {/* Card */}
        <Card>
          <CardContent>
            {!sent ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Mode Toggle */}
                <ToggleGroup
                  value={mode}
                  onValueChange={(m) => {
                    setMode(m);
                    setIdentifier("");
                    setError("");
                  }}
                  options={[
                    { value: "phone", label: "Phone" },
                    { value: "email", label: "Email" },
                  ]}
                />

                <div className="space-y-2">
                  <Label>
                    {mode === "phone" ? "Phone Number" : "Email Address"}
                  </Label>
                  {mode === "phone" ? (
                    <PhoneField
                      value={identifier}
                      onChange={setIdentifier}
                      autoFocus
                    />
                  ) : (
                    <Input
                      type="email"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="you@example.com"
                      autoFocus
                    />
                  )}
                </div>

                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-lose text-xs font-medium"
                  >
                    {error}
                  </motion.p>
                )}

                <Button type="submit" disabled={loading} className="w-full" size="lg">
                  {loading ? "Sending..." : "Continue"}
                </Button>

                <p className="text-[11px] text-ink-muted text-center">
                  No password needed — we&apos;ll send you a secure login link
                </p>
              </form>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-4 space-y-4"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
                  className="w-14 h-14 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center mx-auto"
                >
                  {mode === "phone" ? (
                    <MessageCircle className="size-6 text-accent" />
                  ) : (
                    <Mail className="size-6 text-accent" />
                  )}
                </motion.div>
                <h2 className="text-lg font-semibold text-chalk">
                  {mode === "phone" ? "Check your phone" : "Check your inbox"}
                </h2>
                <p className="text-sm text-chalk-dim">
                  We sent a magic link to{" "}
                  <span className="font-mono text-accent">{identifier}</span>
                </p>
                <p className="text-xs text-ink-muted">
                  The link expires in 15 minutes
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSent(false);
                    setIdentifier("");
                  }}
                >
                  <ArrowLeft className="size-3.5" />
                  {mode === "phone"
                    ? "Use a different number"
                    : "Use a different email"}
                </Button>
              </motion.div>
            )}
          </CardContent>
        </Card>

        {/* Decorative line */}
        <div className="mt-8 flex items-center gap-3">
          <div className="flex-1 h-px bg-ink-border/40" />
          <span className="text-[10px] text-ink-muted font-mono uppercase tracking-widest">
            Tamper-Proof
          </span>
          <div className="flex-1 h-px bg-ink-border/40" />
        </div>
      </motion.div>
    </div>
  );
}
