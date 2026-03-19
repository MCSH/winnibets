import { useEffect, useState } from "react";
import { getMyActivity, type ActivityBlock, type ActivityBet } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import HashDisplay from "@/components/HashDisplay";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronDown,
  Swords,
  Eye,
  EyeOff,
  Clock,
  Inbox,
  Send,
  MessageSquare,
} from "lucide-react";

type Tab = "all" | "messages" | "bets";

function timeAgo(ts: number): string {
  const seconds = Math.floor(Date.now() / 1000 - ts);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(ts * 1000).toLocaleDateString();
}

function statusBadge(status: string) {
  switch (status) {
    case "pending":
      return <Badge variant="gold">Pending</Badge>;
    case "accepted":
      return <Badge variant="green">Accepted</Badge>;
    case "declined":
      return <Badge variant="red">Declined</Badge>;
    case "expired":
      return <Badge variant="muted">Expired</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
}

function roleBadge(role: string) {
  switch (role) {
    case "initiator":
      return (
        <span className="text-[10px] text-accent font-medium flex items-center gap-1">
          <Send className="size-3" />
          You challenged
        </span>
      );
    case "counterparty":
      return (
        <span className="text-[10px] text-highlight font-medium flex items-center gap-1">
          <Swords className="size-3" />
          Challenged you
        </span>
      );
    case "author":
      return (
        <span className="text-[10px] text-chalk-dim font-medium flex items-center gap-1">
          <MessageSquare className="size-3" />
          Your message
        </span>
      );
    default:
      return null;
  }
}

function timeRemaining(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function friendlyDataLabel(key: string): string {
  const labels: Record<string, string> = {
    identity_hash: "From",
    message_hash: "Message proof",
    initiator_identity_hash: "Challenger",
    counterparty_identity_hash: "Opponent",
    bet_terms_hash: "Terms proof",
    bet_terms: "Terms",
    visibility: "Visibility",
  };
  return labels[key] ?? key.replace(/_/g, " ");
}

export default function MyActivity() {
  const [blocks, setBlocks] = useState<ActivityBlock[]>([]);
  const [bets, setBets] = useState<ActivityBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [expandedBlock, setExpandedBlock] = useState<number | null>(null);

  useEffect(() => {
    getMyActivity()
      .then((res) => {
        setBlocks(res.blocks);
        setBets(res.bets);
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const filteredBlocks =
    tab === "bets"
      ? blocks.filter((b) => b.record_type === "bet")
      : tab === "messages"
        ? blocks.filter((b) =>
            ["hidden_message", "open_message"].includes(b.record_type),
          )
        : blocks;

  const filteredBets =
    tab === "messages" ? [] : tab === "bets" || tab === "all" ? bets : [];

  const messageCount = blocks.filter((b) =>
    ["hidden_message", "open_message"].includes(b.record_type),
  ).length;
  const betBlockCount = blocks.filter((b) => b.record_type === "bet").length;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: "All", count: blocks.length + bets.length },
    { key: "messages", label: "Messages", count: messageCount },
    { key: "bets", label: "Bets", count: betBlockCount + bets.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-4xl tracking-wide text-chalk">
          MY ACTIVITY
        </h1>
        <p className="text-chalk-dim text-sm mt-1">
          Your messages and bets on the chain.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-ink-light border border-ink-border/50">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              tab === t.key
                ? "bg-accent text-ink"
                : "text-chalk-dim hover:text-chalk hover:bg-ink-lighter"
            }`}
          >
            {t.label}
            <span
              className={`ml-1.5 text-[10px] ${
                tab === t.key ? "text-ink/70" : "text-ink-muted"
              }`}
            >
              {t.count}
            </span>
          </button>
        ))}
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

      {!loading && filteredBlocks.length === 0 && filteredBets.length === 0 && (
        <Card>
          <CardContent className="text-center py-10 space-y-3">
            <Inbox className="size-10 text-ink-muted mx-auto" />
            <p className="text-chalk-dim text-sm">
              No activity yet. Send a message or place a bet to get started.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pending / active bets section */}
      {filteredBets.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-chalk">Your Bets</h2>
            <div className="flex-1 h-px bg-ink-border/30" />
          </div>
          <div className="space-y-2">
            {filteredBets.map((bet, i) => (
              <motion.div
                key={bet.bet_id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card className="hover:border-ink-muted transition-colors">
                  <CardContent className="space-y-3 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {statusBadge(bet.status)}
                        <Badge
                          variant={
                            bet.visibility === "hidden" ? "default" : "green"
                          }
                        >
                          {bet.visibility}
                        </Badge>
                        {roleBadge(bet.role)}
                      </div>
                      {bet.status === "pending" && (
                        <div className="flex items-center gap-1 text-[10px] text-ink-muted">
                          <Clock className="size-3" />
                          {timeRemaining(bet.expires_at)} left
                        </div>
                      )}
                    </div>

                    <div className="bg-ink rounded-lg px-4 py-3 border border-ink-border/40">
                      <p className="text-sm text-chalk">{bet.bet_terms}</p>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-chalk-dim">
                      {bet.role === "initiator" &&
                        bet.counterparty_identifier && (
                          <span>
                            vs{" "}
                            <span className="font-mono text-chalk">
                              {bet.counterparty_identifier}
                            </span>
                          </span>
                        )}
                      {bet.role === "counterparty" &&
                        bet.initiator_identifier && (
                          <span>
                            From{" "}
                            <span className="font-mono text-chalk">
                              {bet.initiator_identifier}
                            </span>
                          </span>
                        )}
                      <span>
                        {new Date(bet.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* On-chain blocks section */}
      {filteredBlocks.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-chalk">
              On-Chain Records
            </h2>
            <div className="flex-1 h-px bg-ink-border/30" />
          </div>
          <div className="space-y-2">
            {filteredBlocks.map((b, i) => {
              const isExpanded = expandedBlock === b.block_index;
              const isBet = b.record_type === "bet";
              const isHidden = b.record_type === "hidden_message";
              const isOpen = b.record_type === "open_message";

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
                    <span
                      className={`shrink-0 size-9 rounded-lg flex items-center justify-center ${
                        isBet
                          ? "bg-lose/10 text-lose"
                          : isHidden
                            ? "bg-amber-500/10 text-amber-400"
                            : isOpen
                              ? "bg-win/10 text-win"
                              : "bg-ink text-ink-muted"
                      }`}
                    >
                      {isBet ? (
                        <Swords className="size-4" />
                      ) : isHidden ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            isBet
                              ? "red"
                              : isHidden
                                ? "gold"
                                : isOpen
                                  ? "green"
                                  : "muted"
                          }
                        >
                          {isBet
                            ? "Bet"
                            : isHidden
                              ? "Secret"
                              : isOpen
                                ? "Message"
                                : b.record_type}
                        </Badge>
                        {roleBadge(b.role)}
                      </div>
                      <span className="block font-mono text-[11px] text-ink-muted truncate mt-0.5">
                        {b.block_hash}
                      </span>
                    </div>

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
                              {new Date(b.timestamp * 1000).toLocaleString()}
                            </span>
                          </div>
                          {Object.entries(b.data).map(([key, value]) => {
                            const strVal = String(value);
                            const isHash = /^[a-f0-9]{64}$/.test(strVal);
                            if (isHash) {
                              return (
                                <HashDisplay
                                  key={key}
                                  label={friendlyDataLabel(key)}
                                  hash={strVal}
                                />
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
        </div>
      )}
    </div>
  );
}
