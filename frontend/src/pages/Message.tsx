import { useState, type FormEvent } from "react";
import { submitMessage } from "@/lib/api";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { Card, CardContent } from "@/components/ui/card";
import HashDisplay from "@/components/HashDisplay";
import { Check, AlertTriangle } from "lucide-react";

type Visibility = "visible" | "hidden";

interface Receipt {
  message_hash: string;
  block_hash: string;
  block_index: number;
  timestamp: number;
  visibility: string;
}

export default function Message() {
  const [text, setText] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("hidden");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setError("");
    setLoading(true);

    try {
      const res = await submitMessage(text, visibility);
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
          DROP A MESSAGE
        </h1>
        <p className="text-chalk-dim text-sm mt-1">
          {visibility === "hidden"
            ? "Your words get hashed and the original is destroyed. Only the proof stays on-chain."
            : "This goes on the blockchain in full — anyone can see it."}
        </p>
      </div>

      {/* Form */}
      <Card>
        <CardContent>
          <form
            onSubmit={handleSubmit}
            className="space-y-5"
            autoComplete="off"
          >
            {/* Visibility toggle */}
            <div className="space-y-2">
              <Label>Visibility</Label>
              <ToggleGroup
                value={visibility}
                onValueChange={setVisibility}
                options={[
                  { value: "hidden", label: "Hidden" },
                  { value: "visible", label: "Open" },
                ]}
              />
            </div>

            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                placeholder="Type your message here..."
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-ink-muted uppercase tracking-widest">
                SHA-256{" "}
                {visibility === "hidden" && <>&middot; Zero-knowledge</>}
              </span>
              <Button type="submit" disabled={loading || !text.trim()}>
                {loading ? "Submitting..." : "Commit to Chain"}
              </Button>
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-lose text-xs font-medium"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
          </form>
        </CardContent>
      </Card>

      {/* Receipt */}
      <AnimatePresence>
        {receipt && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Card className="border-accent/30">
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 15,
                      delay: 0.1,
                    }}
                    className="w-8 h-8 rounded-full bg-win/15 flex items-center justify-center"
                  >
                    <Check className="size-4 text-win" />
                  </motion.div>
                  <span className="text-sm font-semibold text-win">
                    Committed to chain
                    {receipt.visibility === "visible" ? " (open)" : " (hidden)"}
                  </span>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <HashDisplay
                    label="Message Hash"
                    hash={receipt.message_hash}
                  />
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

                {receipt.visibility === "hidden" && (
                  <div className="flex items-start gap-2 bg-ink/40 border border-ink-border/30 rounded-lg px-3 py-2.5">
                    <AlertTriangle className="size-3.5 text-highlight mt-0.5 shrink-0" />
                    <p className="text-[11px] text-ink-muted">
                      Save your original message securely. It is the only way to
                      prove this hash belongs to you. WinniBets does not store
                      your plaintext.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
