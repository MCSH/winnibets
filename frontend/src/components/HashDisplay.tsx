import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Copy, Check } from "lucide-react";

export default function HashDisplay({
  label,
  hash,
}: {
  label: string;
  hash: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">
        {label}
      </span>
      <button
        onClick={copy}
        className="group w-full text-left bg-ink/60 border border-ink-border/40 rounded-lg px-3 py-2.5 font-mono text-xs text-accent-dim hover:text-accent hover:border-accent/30 break-all transition-all duration-200 cursor-pointer flex items-start gap-2"
        title="Click to copy"
      >
        <span className="flex-1">{hash}</span>
        <span className="shrink-0 mt-0.5">
          <AnimatePresence mode="wait">
            {copied ? (
              <motion.span
                key="check"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <Check className="size-3.5 text-win" />
              </motion.span>
            ) : (
              <motion.span
                key="copy"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Copy className="size-3.5 text-ink-muted" />
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </button>
    </div>
  );
}
