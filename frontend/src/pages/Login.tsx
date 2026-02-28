import { useState, type FormEvent } from "react";
import { requestMagicLink } from "../lib/api";
import { motion } from "motion/react";

export default function Login() {
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    const cleaned = phone.trim();
    if (!cleaned.startsWith("+") || cleaned.length < 8) {
      setError("Enter phone in E.164 format, e.g. +14155551234");
      return;
    }

    setLoading(true);
    try {
      await requestMagicLink(cleaned);
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
          <h1 className="font-display text-6xl tracking-wider text-gold leading-none">
            WINNIBETS
          </h1>
          <p className="text-chalk-dim text-sm mt-2">
            Community Blockchain Ledger
          </p>
        </div>

        {/* Card */}
        <div className="bg-ink-light border border-ink-border/60 rounded-lg p-6">
          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-chalk-dim mb-2 uppercase tracking-wider">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+14155551234"
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
              </div>
              <h2 className="text-lg font-semibold text-chalk">
                Check your phone
              </h2>
              <p className="text-sm text-chalk-dim">
                We sent a magic link to{" "}
                <span className="font-mono text-gold">{phone}</span>
              </p>
              <p className="text-xs text-ink-muted">
                The link expires in 15 minutes
              </p>
              <button
                onClick={() => {
                  setSent(false);
                  setPhone("");
                }}
                className="text-xs text-chalk-dim hover:text-chalk transition-colors cursor-pointer mt-2"
              >
                Use a different number
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
