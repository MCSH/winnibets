import { useEffect, useState } from "react";
import { listPendingBets, respondToBet, type PendingBet } from "../lib/api";
import Card from "../components/Card";
import HashDisplay from "../components/HashDisplay";
import { motion, AnimatePresence } from "motion/react";

interface BetResult {
  betId: number;
  status: "accepted" | "declined";
  block_hash?: string;
  block_index?: number;
  timestamp?: number;
}

export default function PendingBets() {
  const [bets, setBets] = useState<PendingBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [responding, setResponding] = useState<number | null>(null);
  const [results, setResults] = useState<Record<number, BetResult>>({});

  useEffect(() => {
    listPendingBets()
      .then(setBets)
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const handleRespond = async (betId: number, accept: boolean) => {
    setResponding(betId);
    try {
      const res = await respondToBet(betId, accept);
      setResults((prev) => ({ ...prev, [betId]: { betId, ...res } }));
      setBets((prev) => prev.filter((b) => b.bet_id !== betId));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setResponding(null);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString();
  };

  const timeRemaining = (expiresAt: string) => {
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) return "Expired";
    const hours = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl tracking-wide text-chalk">
          PENDING BETS
        </h1>
        <p className="text-chalk-dim text-sm mt-1">
          Bets waiting for your response. Accept or decline each one.
        </p>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && <p className="text-lose text-xs font-medium">{error}</p>}

      {!loading && bets.length === 0 && Object.keys(results).length === 0 && (
        <Card>
          <p className="text-chalk-dim text-sm text-center py-6">
            No pending bets. You're all caught up.
          </p>
        </Card>
      )}

      {/* Resolved results */}
      <AnimatePresence>
        {Object.values(results).map((r) => (
          <motion.div
            key={r.betId}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Card
              className={`space-y-3 ${r.status === "accepted" ? "border-win/30" : "border-lose/30"}`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${r.status === "accepted" ? "bg-win" : "bg-lose"}`}
                />
                <span
                  className={`text-xs font-semibold uppercase tracking-wider ${r.status === "accepted" ? "text-win" : "text-lose"}`}
                >
                  Bet #{r.betId} {r.status}
                </span>
              </div>
              {r.status === "accepted" && r.block_hash && (
                <div className="space-y-2">
                  <HashDisplay label="Block Hash" hash={r.block_hash} />
                  <div className="flex gap-6 text-xs text-chalk-dim">
                    <span>
                      Block{" "}
                      <span className="font-mono text-chalk">
                        #{r.block_index}
                      </span>
                    </span>
                    {r.timestamp && (
                      <span>
                        {new Date(r.timestamp * 1000).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              )}
              {r.status === "declined" && (
                <p className="text-sm text-chalk-dim">
                  The bet has been declined and the initiator has been notified.
                </p>
              )}
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Pending bets */}
      <div className="space-y-4">
        {bets.map((bet, i) => (
          <motion.div
            key={bet.bet_id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gold uppercase tracking-wider">
                  Bet #{bet.bet_id}
                </span>
                <span className="text-[10px] font-mono text-ink-muted">
                  {timeRemaining(bet.expires_at)} left
                </span>
              </div>

              <div>
                <p className="text-xs text-chalk-dim mb-1 uppercase tracking-wider">
                  Terms
                </p>
                <p className="text-sm text-chalk bg-ink rounded px-3 py-2 border border-ink-border">
                  {bet.bet_terms}
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs text-chalk-dim">
                <span>
                  From{" "}
                  <span className="font-mono text-chalk">
                    {bet.initiator_identifier}
                  </span>
                </span>
                <span>
                  {bet.visibility === "hidden" ? "Hidden" : "Visible"} bet
                </span>
                <span>Created {formatTime(bet.created_at)}</span>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => handleRespond(bet.bet_id, true)}
                  disabled={responding === bet.bet_id}
                  className="flex-1 bg-win/15 border border-win/40 text-win font-semibold py-2.5 rounded hover:bg-win/25 transition-colors disabled:opacity-50 cursor-pointer text-sm"
                >
                  {responding === bet.bet_id ? "..." : "Accept"}
                </button>
                <button
                  onClick={() => handleRespond(bet.bet_id, false)}
                  disabled={responding === bet.bet_id}
                  className="flex-1 bg-lose/10 border border-lose/30 text-lose font-semibold py-2.5 rounded hover:bg-lose/20 transition-colors disabled:opacity-50 cursor-pointer text-sm"
                >
                  Decline
                </button>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
