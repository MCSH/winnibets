import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { requestMagicLink } from "../lib/api";
import { motion } from "motion/react";

type AuthMode = "phone" | "email";

export default function Login() {
  const [mode, setMode] = useState<AuthMode>("phone");
  const [identifier, setIdentifier] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    let cleaned = identifier.trim();

    if (mode === "phone") {
      // Strip formatting: spaces, dashes, parens, dots
      const digits = cleaned.replace(/[\s\-().+]/g, "");
      if (digits.length === 10) {
        cleaned = `+1${digits}`;
      } else if (digits.length === 11 && digits.startsWith("1")) {
        cleaned = `+${digits}`;
      } else {
        setError("Enter a 10-digit phone number, e.g. 4155551234");
        return;
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
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        {/* Brand */}
        <div className="text-center mb-10">
          <Link to="/" className="no-underline">
            <h1 className="font-display text-6xl tracking-wider text-gold leading-none">
              WINNIBETS
            </h1>
          </Link>
          <p className="text-chalk-dim text-sm mt-2">
            Community Blockchain Ledger
          </p>
        </div>

        {/* Card */}
        <div className="bg-ink-light border border-ink-border/60 rounded-lg p-6">
          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Mode Toggle */}
              <div className="flex gap-2">
                {(["phone", "email"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMode(m);
                      setIdentifier("");
                      setError("");
                    }}
                    className={`flex-1 py-2 rounded text-xs font-medium transition-colors cursor-pointer border uppercase tracking-wider ${
                      mode === m
                        ? "bg-gold/15 border-gold/50 text-gold"
                        : "bg-ink border-ink-border text-chalk-dim hover:border-ink-muted"
                    }`}
                  >
                    {m === "phone" ? "Phone" : "Email"}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-chalk-dim mb-2 uppercase tracking-wider">
                  {mode === "phone" ? "Phone Number" : "Email Address"}
                </label>
                <input
                  type={mode === "phone" ? "tel" : "email"}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={
                    mode === "phone" ? "(204) 555-1234" : "you@example.com"
                  }
                  className="w-full bg-ink border border-ink-border rounded px-4 py-3 text-chalk font-mono text-sm placeholder:text-ink-muted focus:outline-none focus:border-gold/60 transition-colors"
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-lose text-xs font-medium">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gold hover:bg-gold-bright text-ink font-semibold py-3 rounded transition-colors disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Sending..." : "Send Magic Link"}
              </button>
            </form>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-4 space-y-3"
            >
              <div className="w-12 h-12 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center mx-auto">
                {mode === "phone" ? (
                  <svg
                    className="w-6 h-6 text-gold"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-6 h-6 text-gold"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                )}
              </div>
              <h2 className="text-lg font-semibold text-chalk">
                {mode === "phone" ? "Check your phone" : "Check your inbox"}
              </h2>
              <p className="text-sm text-chalk-dim">
                We sent a magic link to{" "}
                <span className="font-mono text-gold">{identifier}</span>
              </p>
              <p className="text-xs text-ink-muted">
                The link expires in 15 minutes
              </p>
              <button
                onClick={() => {
                  setSent(false);
                  setIdentifier("");
                }}
                className="text-xs text-chalk-dim hover:text-chalk transition-colors cursor-pointer mt-2"
              >
                {mode === "phone"
                  ? "Use a different number"
                  : "Use a different email"}
              </button>
            </motion.div>
          )}
        </div>

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
