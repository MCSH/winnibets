import { useState } from "react";

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
    <div className="space-y-1">
      <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">
        {label}
      </span>
      <button
        onClick={copy}
        className="w-full text-left bg-ink/60 border border-ink-border/40 rounded px-3 py-2 font-mono text-xs text-gold-dim hover:text-gold break-all transition-colors cursor-pointer"
        title="Click to copy"
      >
        {hash}
        <span className="ml-2 text-ink-muted text-[10px]">
          {copied ? "copied" : ""}
        </span>
      </button>
    </div>
  );
}
