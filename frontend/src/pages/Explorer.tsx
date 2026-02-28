import { useState, useEffect, type FormEvent } from "react";
import {
  lookupBlock,
  verifyIntegrity,
  listBlocks,
  type BlockSummary,
} from "../lib/api";
import Card from "../components/Card";
import HashDisplay from "../components/HashDisplay";
import { motion, AnimatePresence } from "motion/react";

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
      // silently fail — list section just stays empty
    } finally {
      setListLoading(false);
    }
  };

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

  const typeColor = (type: string) => {
    switch (type) {
      case "genesis":
        return "bg-chalk/10 text-chalk-dim border-chalk/20";
      case "hidden_message":
        return "bg-gold/10 text-gold border-gold/25";
      case "open_message":
        return "bg-win/10 text-win border-win/25";
      case "bet":
        return "bg-lose/10 text-lose border-lose/25";
      default:
        return "bg-ink-lighter text-chalk-dim border-ink-border";
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
        <div className="flex items-center justify-between mb-4">
          <label className="text-xs font-medium text-chalk-dim uppercase tracking-wider">
            Chain
          </label>
          <span className="text-xs text-ink-muted font-mono">
            {total} block{total !== 1 && "s"}
          </span>
        </div>

        {listLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : blocks.length === 0 ? (
          <p className="text-sm text-ink-muted py-4 text-center">
            No blocks found.
          </p>
        ) : (
          <div className="space-y-2">
            {blocks.map((b) => (
              <div key={b.block_index}>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedBlock(
                      expandedBlock === b.block_index ? null : b.block_index,
                    )
                  }
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded bg-ink hover:bg-ink-lighter border border-ink-border/50 hover:border-gold/30 transition-colors cursor-pointer text-left"
                >
                  <span className="font-mono text-xs text-chalk-dim w-8 shrink-0">
                    #{b.block_index}
                  </span>
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border ${typeColor(b.record_type)}`}
                  >
                    {typeLabel(b.record_type)}
                  </span>
                  <span className="flex-1 font-mono text-[11px] text-ink-muted truncate">
                    {b.block_hash}
                  </span>
                  <span className="text-[10px] text-ink-muted whitespace-nowrap">
                    {b.timestamp === 0
                      ? "origin"
                      : new Date(b.timestamp * 1000).toLocaleDateString()}
                  </span>
                </button>

                <AnimatePresence>
                  {expandedBlock === b.block_index && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="ml-11 mt-1 mb-2 p-3 rounded bg-ink-light border border-ink-border/30 space-y-3">
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
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-ink-border/30">
            <button
              onClick={() => loadBlocks(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0 || listLoading}
              className="text-xs font-medium text-chalk-dim hover:text-gold disabled:opacity-30 disabled:hover:text-chalk-dim transition-colors cursor-pointer disabled:cursor-default"
            >
              Previous
            </button>
            <span className="text-[10px] text-ink-muted font-mono">
              {offset + 1}&ndash;{Math.min(offset + PAGE_SIZE, total)} of{" "}
              {total}
            </span>
            <button
              onClick={() => loadBlocks(offset + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= total || listLoading}
              className="text-xs font-medium text-chalk-dim hover:text-gold disabled:opacity-30 disabled:hover:text-chalk-dim transition-colors cursor-pointer disabled:cursor-default"
            >
              Next
            </button>
          </div>
        )}
      </Card>

      {/* Lookup */}
      <Card>
        <form onSubmit={handleLookup} className="space-y-4">
          <label className="block text-xs font-medium text-chalk-dim mb-2 uppercase tracking-wider">
            Block Hash
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={hash}
              onChange={(e) => setHash(e.target.value)}
              placeholder="64-character SHA-256 hex digest"
              className="flex-1 bg-ink border border-ink-border rounded px-4 py-2.5 text-chalk font-mono text-xs placeholder:text-ink-muted focus:outline-none focus:border-gold/60 transition-colors"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-gold hover:bg-gold-bright text-ink font-semibold px-5 py-2.5 rounded transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              {loading ? "..." : "Lookup"}
            </button>
          </div>
          {error && <p className="text-lose text-xs font-medium">{error}</p>}
        </form>
      </Card>

      {/* Block result */}
      <AnimatePresence>
        {block && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Card className="space-y-4 border-gold/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-gold/15 text-gold border border-gold/30">
                    {block.record_type}
                  </span>
                  <span className="text-xs text-chalk-dim">
                    Block #{block.block_index}
                  </span>
                </div>
                <span className="text-xs text-ink-muted">
                  {new Date(block.timestamp * 1000).toLocaleString()}
                </span>
              </div>

              {/* Data fields */}
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
          <button
            onClick={handleIntegrity}
            disabled={intLoading}
            className="bg-ink-lighter border border-ink-border hover:border-gold/40 text-chalk-dim hover:text-gold font-medium px-5 py-2.5 rounded transition-colors disabled:opacity-50 cursor-pointer"
          >
            {intLoading ? "Verifying..." : "Run Check"}
          </button>
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
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${integrity.valid ? "bg-win" : "bg-lose"}`}
                  />
                  <div>
                    <p
                      className={`font-semibold text-sm ${integrity.valid ? "text-win" : "text-lose"}`}
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
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
