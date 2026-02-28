import { useState, type FormEvent } from "react";
import { submitHiddenMessage } from "../lib/api";
import { motion, AnimatePresence } from "motion/react";
import Card from "../components/Card";
import HashDisplay from "../components/HashDisplay";

interface Receipt {
  message_hash: string;
  block_hash: string;
  block_index: number;
  timestamp: number;
}

export default function HiddenMessage() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setError("");
    setLoading(true);

    try {
      const res = await submitHiddenMessage(text);
      setReceipt(res);
      setText("");
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
          HIDDEN MESSAGE
        </h1>
        <p className="text-chalk-dim text-sm mt-1">
          Your plaintext is hashed and immediately discarded. Only the
          cryptographic proof lives on-chain.
        </p>
      </div>

      {/* Form */}
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-chalk-dim mb-2 uppercase tracking-wider">
              Message
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder="Type your message here..."
              className="w-full bg-ink border border-ink-border rounded px-4 py-3 text-chalk text-sm placeholder:text-ink-muted focus:outline-none focus:border-gold/60 transition-colors resize-none"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-ink-muted uppercase tracking-widest">
              SHA-256 &middot; Zero-knowledge
            </span>
            <button
              type="submit"
              disabled={loading || !text.trim()}
              className="bg-gold hover:bg-gold-bright text-ink font-semibold px-6 py-2.5 rounded transition-colors disabled:opacity-40 cursor-pointer"
            >
              {loading ? "Hashing..." : "Commit to Chain"}
            </button>
          </div>

          {error && <p className="text-lose text-xs font-medium">{error}</p>}
        </form>
      </Card>

      {/* Receipt */}
      <AnimatePresence>
        {receipt && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Card className="space-y-4 border-gold/30">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-win animate-pulse" />
                <span className="text-xs font-semibold text-win uppercase tracking-wider">
                  Committed to chain
                </span>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <HashDisplay label="Message Hash" hash={receipt.message_hash} />
                <HashDisplay label="Block Hash" hash={receipt.block_hash} />
              </div>

              <div className="flex gap-6 text-xs text-chalk-dim">
                <span>
                  Block{" "}
                  <span className="font-mono text-chalk">
                    #{receipt.block_index}
                  </span>
                </span>
                <span>
                  {new Date(receipt.timestamp * 1000).toLocaleString()}
                </span>
              </div>

              <div className="bg-ink/40 border border-ink-border/30 rounded px-3 py-2">
                <p className="text-[11px] text-ink-muted">
                  Save your original message securely. It is the only way to
                  prove this hash belongs to you. WinniBets does not store your
                  plaintext.
                </p>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
