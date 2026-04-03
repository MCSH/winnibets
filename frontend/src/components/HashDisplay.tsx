import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Copy, Check, ExternalLink } from "lucide-react";

export default function HashDisplay({
  label,
  hash,
  linkTo,
}: {
  label: string;
  hash: string;
  linkTo?: string;
}) {
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleClick = linkTo ? () => navigate(linkTo) : copy;

  return (
    <div className="space-y-1.5">
      {label && (
        <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">
          {label}
        </span>
      )}
      <div className="flex items-start gap-1">
        <button
          onClick={handleClick}
          className={`group flex-1 text-left bg-ink/60 border border-ink-border/40 rounded-lg px-3 py-2.5 font-mono text-xs break-all transition-all duration-200 cursor-pointer flex items-start gap-2 ${
            linkTo
              ? "text-accent hover:text-accent-bright hover:border-accent/50"
              : "text-accent-dim hover:text-accent hover:border-accent/30"
          }`}
          title={linkTo ? "View profile" : "Click to copy"}
        >
          <span className="flex-1">{hash}</span>
          <span className="shrink-0 mt-0.5">
            {linkTo ? (
              <ExternalLink className="size-3.5 text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity" />
            ) : (
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
            )}
          </span>
        </button>
        {linkTo && (
          <button
            onClick={copy}
            className="shrink-0 mt-0.5 p-2 rounded-lg text-ink-muted hover:text-chalk transition-colors cursor-pointer"
            title="Copy hash"
          >
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
                >
                  <Copy className="size-3.5" />
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        )}
      </div>
    </div>
  );
}
