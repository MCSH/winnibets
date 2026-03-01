import { useState, type FormEvent } from "react";
import { createBet } from "../lib/api";
import Card from "../components/Card";
import { motion, AnimatePresence } from "motion/react";

interface BetResult {
  bet_id: number;
  message: string;
}

type CounterpartyMode = "phone" | "email";

export default function Bet() {
  const [terms, setTerms] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [counterpartyMode, setCounterpartyMode] =
    useState<CounterpartyMode>("phone");
  const [visibility, setVisibility] = useState<"visible" | "hidden">("visible");
  const [expiryHours, setExpiryHours] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BetResult | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!terms.trim() || !counterparty.trim()) return;

    let cleaned = counterparty.trim();

    if (counterpartyMode === "phone") {
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
        setError("Enter a valid email address for the counterparty");
        return;
      }
    }

    setLoading(true);
    try {
      const res = await createBet({
        bet_terms: terms,
        counterparty_identifier: cleaned,
        counterparty_identifier_type: counterpartyMode,
        visibility,
        ...(expiryHours ? { expiry_hours: Number(expiryHours) } : {}),
      });
      setResult(res);
      setTerms("");
      setCounterparty("");
      setExpiryHours("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-4xl tracking-wide text-chalk">
          PLACE A BET
        </h1>
        <p className="text-chalk-dim text-sm mt-1">
          Create a two-party wager. Your counterparty will receive an invitation
          to accept or decline.
        </p>
      </div>

      {/* Form */}
      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Terms */}
          <div>
            <label className="block text-xs font-medium text-chalk-dim mb-2 uppercase tracking-wider">
              Bet Terms
            </label>
            <textarea
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              rows={3}
              placeholder="I bet that..."
              className="w-full bg-ink border border-ink-border rounded px-4 py-3 text-chalk text-sm placeholder:text-ink-muted focus:outline-none focus:border-gold/60 transition-colors resize-none"
            />
          </div>

          {/* Counterparty */}
          <div>
            <label className="block text-xs font-medium text-chalk-dim mb-2 uppercase tracking-wider">
              Counterparty
            </label>
            <div className="flex gap-2 mb-2">
              {(["phone", "email"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setCounterpartyMode(m);
                    setCounterparty("");
                    setError("");
                  }}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer border uppercase tracking-wider ${
                    counterpartyMode === m
                      ? "bg-gold/15 border-gold/50 text-gold"
                      : "bg-ink border-ink-border text-chalk-dim hover:border-ink-muted"
                  }`}
                >
                  {m === "phone" ? "Phone" : "Email"}
                </button>
              ))}
            </div>
            <input
              type={counterpartyMode === "phone" ? "tel" : "email"}
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              placeholder={
                counterpartyMode === "phone"
                  ? "(204) 555-1234"
                  : "them@example.com"
              }
              className="w-full bg-ink border border-ink-border rounded px-4 py-3 text-chalk font-mono text-sm placeholder:text-ink-muted focus:outline-none focus:border-gold/60 transition-colors"
            />
          </div>

          {/* Visibility & Expiry */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-chalk-dim mb-2 uppercase tracking-wider">
                Terms Visibility
              </label>
              <div className="flex gap-2">
                {(["visible", "hidden"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVisibility(v)}
                    className={`flex-1 py-2.5 rounded text-sm font-medium transition-colors cursor-pointer border ${
                      visibility === v
                        ? "bg-gold/15 border-gold/50 text-gold"
                        : "bg-ink border-ink-border text-chalk-dim hover:border-ink-muted"
                    }`}
                  >
                    {v === "visible" ? "Visible" : "Hidden"}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-ink-muted mt-1.5">
                {visibility === "visible"
                  ? "Terms stored as plaintext on-chain"
                  : "Only a hash of the terms is stored on-chain"}
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-chalk-dim mb-2 uppercase tracking-wider">
                Expires In (hours)
              </label>
              <input
                type="number"
                value={expiryHours}
                onChange={(e) => setExpiryHours(e.target.value)}
                placeholder="72"
                min={1}
                className="w-full bg-ink border border-ink-border rounded px-4 py-2.5 text-chalk font-mono text-sm placeholder:text-ink-muted focus:outline-none focus:border-gold/60 transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[10px] font-mono text-ink-muted uppercase tracking-widest">
              Two-party agreement
            </span>
            <button
              type="submit"
              disabled={loading || !terms.trim() || !counterparty.trim()}
              className="bg-gold hover:bg-gold-bright text-ink font-semibold px-6 py-2.5 rounded transition-colors disabled:opacity-40 cursor-pointer"
            >
              {loading ? "Sending..." : "Send Bet"}
            </button>
          </div>

          {error && <p className="text-lose text-xs font-medium">{error}</p>}
        </form>
      </Card>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Card className="border-gold/30 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />
                <span className="text-xs font-semibold text-gold uppercase tracking-wider">
                  Invitation Sent
                </span>
              </div>
              <p className="text-sm text-chalk">{result.message}</p>
              <p className="text-xs text-ink-muted">
                Bet ID:{" "}
                <span className="font-mono text-chalk-dim">
                  {result.bet_id}
                </span>
                . The bet will be committed to the chain once your counterparty
                accepts.
              </p>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
