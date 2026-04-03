import { useState, useEffect, type FormEvent } from "react";
import {
  lookupBlock,
  verifyIntegrity,
  listBlocks,
  type BlockSummary,
} from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import HashDisplay from "@/components/HashDisplay";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  X,
  Swords,
  MessageSquare,
  Eye,
  EyeOff,
  Fingerprint,
} from "lucide-react";
import GlyphPet from "@/components/GlyphPet";

interface BlockData {
  block_index: number;
  timestamp: number;
  record_type: string;
  data: Record<string, unknown>;
}

interface IntegrityResult {
  valid: boolean;
  blocks?: number;
  first_invalid_block?: number;
}

const PAGE_SIZE = 20;

function timeAgo(ts: number): string {
  if (ts === 0) return "Genesis";
  const seconds = Math.floor(Date.now() / 1000 - ts);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(ts * 1000).toLocaleDateString();
}

const typeConfig: Record<
  string,
  {
    label: string;
    icon: React.ReactNode;
    variant: "muted" | "gold" | "green" | "red" | "default";
    description: string;
  }
> = {
  genesis: {
    label: "Genesis",
    icon: <Fingerprint className="size-4" />,
    variant: "muted",
    description: "Chain origin block",
  },
  hidden_message: {
    label: "Secret",
    icon: <EyeOff className="size-4" />,
    variant: "gold",
    description: "Hidden message recorded",
  },
  open_message: {
    label: "Message",
    icon: <Eye className="size-4" />,
    variant: "green",
    description: "Public message recorded",
  },
  bet: {
    label: "Bet",
    icon: <Swords className="size-4" />,
    variant: "red",
    description: "Bet accepted and locked in",
  },
};

const fallbackConfig = {
  label: "Entry",
  icon: <MessageSquare className="size-4" />,
  variant: "default" as const,
  description: "Ledger entry",
};

function friendlyDataLabel(key: string): string {
  const labels: Record<string, string> = {
    identity_hash: "From",
    message_hash: "Message proof",
    initiator_identity_hash: "Challenger",
    counterparty_identity_hash: "Opponent",
    terms_hash: "Terms proof",
    bet_terms: "Terms",
    amount: "Amount",
    beer_wager: "Beer Wager",
    visibility: "Visibility",
  };
  return labels[key] ?? key.replace(/_/g, " ");
}

export default function Explorer() {
  const [hash, setHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [block, setBlock] = useState<BlockData | null>(null);

  const [intLoading, setIntLoading] = useState(false);
  const [integrity, setIntegrity] = useState<IntegrityResult | null>(null);

  const [blocks, setBlocks] = useState<BlockSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [expandedBlock, setExpandedBlock] = useState<number | null>(null);
  const [nicknames, setNicknames] = useState<Record<string, string>>({});

  useEffect(() => {
    loadBlocks(0);
  }, []);

  const loadBlocks = async (newOffset: number) => {
    setListLoading(true);
    try {
      const res = await listBlocks(newOffset, PAGE_SIZE);
      setBlocks(res.blocks);
      setTotal(res.total);
      setOffset(newOffset);
      setNicknames(res.nicknames ?? {});
    } catch {
      // silently fail
    } finally {
      setListLoading(false);
    }
  };

  const displayBlocks = [...blocks].reverse();

  const handleLookup = async (e: FormEvent) => {
    e.preventDefault();
    const cleaned = hash.trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(cleaned)) {
      setError("Enter a valid 64-character SHA-256 hex hash");
      return;
    }
    setError("");
    setBlock(null);
    setLoading(true);
    try {
      const res = await lookupBlock(cleaned);
      setBlock(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleIntegrity = async () => {
    setIntLoading(true);
    setIntegrity(null);
    try {
      const res = await verifyIntegrity();
      setIntegrity(res);
    } catch {
      setIntegrity({ valid: false });
    } finally {
      setIntLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl tracking-wide text-chalk">
            GLOBAL LEDGER
          </h1>
          <p className="text-chalk-dim text-sm mt-1">
            Every bet and message, permanently recorded. Nothing gets deleted.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-ink-light border border-ink-border/50">
            <div className="size-2 rounded-full bg-win animate-pulse" />
            <span className="text-xs font-medium text-chalk-dim">
              {total} entries
            </span>
          </div>
        </div>
      </div>

      {/* Activity feed */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-sm font-semibold text-chalk">Recent Activity</h2>
          <div className="flex-1 h-px bg-ink-border/30" />
        </div>

        {listLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayBlocks.length === 0 ? (
          <Card>
            <CardContent>
              <p className="text-sm text-chalk-dim py-4 text-center">
                No activity yet. Be the first to make a bet or drop a message.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {displayBlocks.map((b, i) => {
              const cfg = typeConfig[b.record_type] ?? fallbackConfig;
              const isExpanded = expandedBlock === b.block_index;
              // Resolve nickname for the primary actor on this block
              const primaryHash =
                (b.data.identity_hash as string) ??
                (b.data.initiator_identity_hash as string);
              const blockNick = primaryHash ? nicknames[primaryHash] : undefined;

              return (
                <motion.div
                  key={b.block_index}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02, duration: 0.2 }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedBlock(isExpanded ? null : b.block_index)
                    }
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-ink-light hover:bg-ink-lighter border border-ink-border/50 hover:border-accent/30 transition-all duration-200 cursor-pointer text-left group"
                  >
                    {/* Icon / GlyphPet */}
                    {primaryHash ? (
                      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                        <GlyphPet hash={primaryHash} size={36} />
                      </div>
                    ) : (
                      <span
                        className={`shrink-0 size-9 rounded-lg flex items-center justify-center ${
                          b.record_type === "bet"
                            ? "bg-lose/10 text-lose"
                            : b.record_type === "hidden_message"
                              ? "bg-amber-500/10 text-amber-400"
                              : b.record_type === "open_message"
                                ? "bg-win/10 text-win"
                                : "bg-ink text-ink-muted"
                        }`}
                      >
                        {cfg.icon}
                      </span>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                        {blockNick ? (
                          <span className="text-xs text-accent font-medium">
                            {blockNick}
                          </span>
                        ) : (
                          <span className="text-xs text-chalk-dim">
                            {cfg.description}
                          </span>
                        )}
                      </div>
                      <span className="block font-mono text-[11px] text-ink-muted truncate mt-0.5">
                        {b.block_hash}
                      </span>
                    </div>

                    {/* Time & expand */}
                    <span className="text-xs text-ink-muted whitespace-nowrap shrink-0">
                      {timeAgo(b.timestamp)}
                    </span>
                    <ChevronDown
                      className={`size-4 text-ink-muted transition-transform duration-200 shrink-0 ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="ml-[52px] mt-1 mb-2 p-4 rounded-xl bg-ink border border-ink-border/30 space-y-3">
                          <div className="flex items-center gap-2 text-[10px] text-ink-muted font-mono">
                            <span>Entry #{b.block_index}</span>
                            <span>&middot;</span>
                            <span>
                              {b.timestamp === 0
                                ? "Origin"
                                : new Date(
                                    b.timestamp * 1000,
                                  ).toLocaleString()}
                            </span>
                          </div>
                          {Object.entries(b.data).map(([key, value]) => {
                            const strVal = String(value);
                            const isHash = /^[a-f0-9]{64}$/.test(strVal);
                            const nick = isHash ? nicknames[strVal] : undefined;
                            const isIdentityHash = key.endsWith("identity_hash");
                            if (isHash) {
                              return (
                                <div key={key} className="space-y-0.5">
                                  <span className="text-[10px] font-medium text-ink-muted uppercase tracking-wider">
                                    {friendlyDataLabel(key)}
                                  </span>
                                  {nick && (
                                    <p className="text-sm text-accent font-medium">
                                      {nick}
                                    </p>
                                  )}
                                  <HashDisplay
                                    label=""
                                    hash={strVal}
                                    linkTo={isIdentityHash ? `/user/${strVal}` : undefined}
                                  />
                                </div>
                              );
                            }
                            return (
                              <div key={key} className="space-y-0.5">
                                <span className="text-[10px] font-medium text-ink-muted uppercase tracking-wider">
                                  {friendlyDataLabel(key)}
                                </span>
                                <p className="text-sm text-chalk">{strVal}</p>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-ink-border/30">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadBlocks(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0 || listLoading}
            >
              <ChevronLeft className="size-3.5" />
              Newer
            </Button>
            <span className="text-[10px] text-ink-muted font-mono">
              {offset + 1}&ndash;{Math.min(offset + PAGE_SIZE, total)} of{" "}
              {total}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadBlocks(offset + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= total || listLoading}
            >
              Older
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Lookup */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-sm font-semibold text-chalk">Verify a Record</h2>
          <div className="flex-1 h-px bg-ink-border/30" />
        </div>
        <Card>
          <CardContent>
            <p className="text-xs text-chalk-dim mb-3">
              Got a receipt hash? Paste it here to look up the original record.
            </p>
            <form onSubmit={handleLookup} className="space-y-3">
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={hash}
                  onChange={(e) => setHash(e.target.value)}
                  placeholder="Paste SHA-256 hash..."
                  className="font-mono text-xs"
                />
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    "..."
                  ) : (
                    <>
                      <Search className="size-3.5" />
                      Find
                    </>
                  )}
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
      </div>

      {/* Block result */}
      <AnimatePresence>
        {block && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Card className="border-accent/30">
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        (typeConfig[block.record_type] ?? fallbackConfig)
                          .variant
                      }
                    >
                      {(typeConfig[block.record_type] ?? fallbackConfig).label}
                    </Badge>
                    <span className="text-xs text-chalk-dim">
                      Entry #{block.block_index}
                    </span>
                  </div>
                  <span className="text-xs text-ink-muted">
                    {new Date(block.timestamp * 1000).toLocaleString()}
                  </span>
                </div>

                <div className="space-y-3">
                  {Object.entries(block.data).map(([key, value]) => {
                    const strVal = String(value);
                    const isHash = /^[a-f0-9]{64}$/.test(strVal);
                    const isIdentity = key.endsWith("identity_hash");
                    if (isHash) {
                      return (
                        <HashDisplay
                          key={key}
                          label={friendlyDataLabel(key)}
                          hash={strVal}
                          linkTo={isIdentity ? `/user/${strVal}` : undefined}
                        />
                      );
                    }
                    return (
                      <div key={key} className="space-y-1">
                        <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">
                          {friendlyDataLabel(key)}
                        </span>
                        <p className="text-sm text-chalk">{strVal}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Integrity check */}
      <div className="border-t border-ink-border/30 pt-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-chalk">
              Tamper-Proof Guarantee
            </h2>
            <p className="text-chalk-dim text-xs mt-0.5">
              Verify that no record has been altered or deleted
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleIntegrity}
            disabled={intLoading}
          >
            <ShieldCheck className="size-3.5" />
            {intLoading ? "Checking..." : "Verify"}
          </Button>
        </div>

        <AnimatePresence>
          {integrity && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <Card
                className={integrity.valid ? "border-win/30" : "border-lose/30"}
              >
                <CardContent>
                  <div className="flex items-center gap-3">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 15,
                      }}
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        integrity.valid ? "bg-win/15" : "bg-lose/15"
                      }`}
                    >
                      {integrity.valid ? (
                        <Check className="size-4 text-win" />
                      ) : (
                        <X className="size-4 text-lose" />
                      )}
                    </motion.div>
                    <div>
                      <p
                        className={`font-semibold text-sm ${
                          integrity.valid ? "text-win" : "text-lose"
                        }`}
                      >
                        {integrity.valid
                          ? "All records verified"
                          : "Integrity issue detected"}
                      </p>
                      <p className="text-xs text-chalk-dim">
                        {integrity.valid
                          ? `${integrity.blocks} entries checked — no tampering found`
                          : `Problem found at entry #${integrity.first_invalid_block}`}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
