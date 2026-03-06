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
import { Label } from "@/components/ui/label";
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
} from "lucide-react";

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

export default function Explorer() {
  const [hash, setHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [block, setBlock] = useState<BlockData | null>(null);

  const [intLoading, setIntLoading] = useState(false);
  const [integrity, setIntegrity] = useState<IntegrityResult | null>(null);

  // Block list state
  const [blocks, setBlocks] = useState<BlockSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [expandedBlock, setExpandedBlock] = useState<number | null>(null);

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
    } catch {
      // silently fail
    } finally {
      setListLoading(false);
    }
  };

  // Reverse blocks so most recent appear first
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

  const typeBadgeVariant = (
    type: string,
  ): "muted" | "gold" | "green" | "red" | "default" => {
    switch (type) {
      case "genesis":
        return "muted";
      case "hidden_message":
        return "gold";
      case "open_message":
        return "green";
      case "bet":
        return "red";
      default:
        return "default";
    }
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case "hidden_message":
        return "hidden msg";
      case "open_message":
        return "open msg";
      default:
        return type;
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl tracking-wide text-chalk">
          BLOCK EXPLORER
        </h1>
        <p className="text-chalk-dim text-sm mt-1">
          Browse the blockchain, look up blocks by hash, or verify chain
          integrity.
        </p>
      </div>

      {/* Block list */}
      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <Label className="text-xs">Chain</Label>
            <span className="text-xs text-ink-muted font-mono">
              {total} block{total !== 1 && "s"}
            </span>
          </div>

          {listLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : displayBlocks.length === 0 ? (
            <p className="text-sm text-ink-muted py-4 text-center">
              No blocks found.
            </p>
          ) : (
            <div className="space-y-2">
              {displayBlocks.map((b, i) => (
                <motion.div
                  key={b.block_index}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02, duration: 0.2 }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedBlock(
                        expandedBlock === b.block_index ? null : b.block_index,
                      )
                    }
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-ink hover:bg-ink-lighter border border-ink-border/50 hover:border-accent/30 transition-all duration-200 cursor-pointer text-left group"
                  >
                    <span className="font-mono text-xs text-chalk-dim w-8 shrink-0">
                      #{b.block_index}
                    </span>
                    <Badge variant={typeBadgeVariant(b.record_type)}>
                      {typeLabel(b.record_type)}
                    </Badge>
                    <span className="flex-1 font-mono text-[11px] text-ink-muted truncate">
                      {b.block_hash}
                    </span>
                    <span className="text-[10px] text-ink-muted whitespace-nowrap hidden sm:block">
                      {b.timestamp === 0
                        ? "origin"
                        : new Date(b.timestamp * 1000).toLocaleDateString()}
                    </span>
                    <ChevronDown
                      className={`size-3.5 text-ink-muted transition-transform duration-200 ${
                        expandedBlock === b.block_index ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  <AnimatePresence>
                    {expandedBlock === b.block_index && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="ml-11 mt-1 mb-2 p-4 rounded-lg bg-ink-light border border-ink-border/30 space-y-3">
                          {Object.entries(b.data).map(([key, value]) => {
                            const strVal = String(value);
                            const isHash = /^[a-f0-9]{64}$/.test(strVal);
                            if (isHash) {
                              return (
                                <HashDisplay
                                  key={key}
                                  label={key.replace(/_/g, " ")}
                                  hash={strVal}
                                />
                              );
                            }
                            return (
                              <div key={key} className="space-y-0.5">
                                <span className="text-[10px] font-medium text-ink-muted uppercase tracking-wider">
                                  {key.replace(/_/g, " ")}
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
              ))}
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
                Previous
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
                Next
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lookup */}
      <Card>
        <CardContent>
          <form onSubmit={handleLookup} className="space-y-4">
            <Label>Block Hash Lookup</Label>
            <div className="flex gap-2">
              <Input
                type="text"
                value={hash}
                onChange={(e) => setHash(e.target.value)}
                placeholder="64-character SHA-256 hex digest"
                className="font-mono text-xs"
              />
              <Button type="submit" disabled={loading}>
                {loading ? (
                  "..."
                ) : (
                  <>
                    <Search className="size-3.5" />
                    Lookup
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
                    <Badge variant="gold">{block.record_type}</Badge>
                    <span className="text-xs text-chalk-dim">
                      Block #{block.block_index}
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
                    if (isHash) {
                      return (
                        <HashDisplay
                          key={key}
                          label={key.replace(/_/g, " ")}
                          hash={strVal}
                        />
                      );
                    }
                    return (
                      <div key={key} className="space-y-1">
                        <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">
                          {key.replace(/_/g, " ")}
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
            <h2 className="font-display text-2xl tracking-wide text-chalk">
              CHAIN INTEGRITY
            </h2>
            <p className="text-chalk-dim text-xs mt-0.5">
              Verify the hash linkage of every block in the chain
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleIntegrity}
            disabled={intLoading}
          >
            <ShieldCheck className="size-3.5" />
            {intLoading ? "Verifying..." : "Run Check"}
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
                        {integrity.valid ? "Chain Valid" : "Chain Invalid"}
                      </p>
                      <p className="text-xs text-chalk-dim">
                        {integrity.valid
                          ? `${integrity.blocks} blocks verified`
                          : `First invalid block at index ${integrity.first_invalid_block}`}
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
