import { useEffect, useState } from "react";
import { listPendingBets, respondToBet, type PendingBet } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import HashDisplay from "@/components/HashDisplay";
import { motion, AnimatePresence } from "motion/react";
import { Check, X, Clock, Inbox } from "lucide-react";

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
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-lose text-xs font-medium"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {!loading && bets.length === 0 && Object.keys(results).length === 0 && (
        <Card>
          <CardContent className="text-center py-10 space-y-3">
            <Inbox className="size-10 text-ink-muted mx-auto" />
            <p className="text-chalk-dim text-sm">
              No pending bets. You&apos;re all caught up.
            </p>
          </CardContent>
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
              className={
                r.status === "accepted"
                  ? "border-win/30"
                  : "border-lose/30"
              }
            >
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      r.status === "accepted"
                        ? "bg-win/15"
                        : "bg-lose/15"
                    }`}
                  >
                    {r.status === "accepted" ? (
                      <Check className="size-4 text-win" />
                    ) : (
                      <X className="size-4 text-lose" />
                    )}
                  </motion.div>
                  <span
                    className={`text-sm font-semibold ${
                      r.status === "accepted" ? "text-win" : "text-lose"
                    }`}
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
                    The bet has been declined and the initiator has been
                    notified.
                  </p>
                )}
              </CardContent>
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
            <Card className="hover:border-ink-muted transition-colors">
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="gold">Bet #{bet.bet_id}</Badge>
                    <Badge
                      variant={
                        bet.visibility === "hidden" ? "default" : "green"
                      }
                    >
                      {bet.visibility}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                    <Clock className="size-3" />
                    {timeRemaining(bet.expires_at)} left
                  </div>
                </div>

                <div className="bg-ink rounded-lg px-4 py-3 border border-ink-border/40">
                  <p className="text-sm text-chalk">{bet.bet_terms}</p>
                </div>

                <div className="flex items-center gap-4 text-xs text-chalk-dim">
                  <span>
                    From{" "}
                    <span className="font-mono text-chalk">
                      {bet.initiator_identifier}
                    </span>
                  </span>
                  <span>Created {formatTime(bet.created_at)}</span>
                </div>

                <div className="flex gap-3 pt-1">
                  <Button
                    variant="success"
                    className="flex-1"
                    onClick={() => handleRespond(bet.bet_id, true)}
                    disabled={responding === bet.bet_id}
                  >
                    {responding === bet.bet_id ? (
                      "..."
                    ) : (
                      <>
                        <Check className="size-3.5" />
                        Accept
                      </>
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => handleRespond(bet.bet_id, false)}
                    disabled={responding === bet.bet_id}
                  >
                    <X className="size-3.5" />
                    Decline
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
