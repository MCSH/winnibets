import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getLeaderboard, type LeaderboardEntry } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "motion/react";
import {
  Trophy,
  Swords,
  ShieldCheck,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import GlyphPet from "@/components/GlyphPet";

type SortKey = "beers" | "wins" | "losses" | "bets";

const SORT_CONFIG: {
  key: SortKey;
  label: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  { key: "beers", label: "Beers", icon: <span>🍺</span>, color: "text-amber-400" },
  { key: "wins", label: "Wins", icon: <Trophy className="size-3.5" />, color: "text-win" },
  { key: "losses", label: "Losses", icon: <span className="text-[10px] font-bold">L</span>, color: "text-lose" },
  { key: "bets", label: "Bets", icon: <Swords className="size-3.5" />, color: "text-accent" },
];

function getValue(entry: LeaderboardEntry, key: SortKey): number {
  switch (key) {
    case "beers":
      return entry.beer_balance;
    case "wins":
      return entry.wins;
    case "losses":
      return entry.losses;
    case "bets":
      return entry.bets;
  }
}

function rankBadge(rank: number) {
  if (rank === 1)
    return (
      <span className="size-7 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 text-xs font-bold">
        1
      </span>
    );
  if (rank === 2)
    return (
      <span className="size-7 rounded-full bg-chalk/10 flex items-center justify-center text-chalk-dim text-xs font-bold">
        2
      </span>
    );
  if (rank === 3)
    return (
      <span className="size-7 rounded-full bg-amber-700/20 flex items-center justify-center text-amber-600 text-xs font-bold">
        3
      </span>
    );
  return (
    <span className="size-7 rounded-full bg-ink-lighter flex items-center justify-center text-ink-muted text-xs font-medium">
      {rank}
    </span>
  );
}

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("beers");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    getLeaderboard()
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const sorted = [...entries].sort((a, b) => {
    const av = getValue(a, sortKey);
    const bv = getValue(b, sortKey);
    return sortAsc ? av - bv : bv - av;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl tracking-wide text-chalk">
          LEADERBOARD
        </h1>
        <p className="text-chalk-dim text-sm mt-1">
          Who&apos;s on top? Sort by what matters.
        </p>
      </div>

      {/* Sort controls */}
      <div className="flex flex-wrap gap-2">
        {SORT_CONFIG.map((s) => {
          const active = sortKey === s.key;
          return (
            <button
              key={s.key}
              onClick={() => toggleSort(s.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                active
                  ? "bg-ink-lighter border-accent/50 text-chalk"
                  : "bg-ink-light border-ink-border/50 text-chalk-dim hover:text-chalk hover:border-ink-muted"
              }`}
            >
              <span className={active ? s.color : ""}>{s.icon}</span>
              {s.label}
              {active &&
                (sortAsc ? (
                  <ChevronUp className="size-3" />
                ) : (
                  <ChevronDown className="size-3" />
                ))}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sorted.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-chalk-dim text-sm">
              No one has placed a bet yet. Be the first!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sorted.map((entry, i) => (
            <motion.div
              key={entry.identity_hash}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.2 }}
            >
              <Link
                to={`/user/${entry.identity_hash}`}
                className="no-underline"
              >
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-ink-light hover:bg-ink-lighter border border-ink-border/50 hover:border-accent/30 transition-all duration-200 group">
                  {/* Rank */}
                  {rankBadge(i + 1)}

                  {/* Avatar + name */}
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <div className="shrink-0">
                      <GlyphPet hash={entry.identity_hash} seed={entry.avatar_seed} size={36} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-chalk truncate">
                          {entry.nickname ?? entry.identity_hash.slice(0, 12) + "..."}
                        </span>
                        {entry.verified && (
                          <ShieldCheck className="size-3 text-win shrink-0" />
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-ink-muted">
                        {entry.identity_hash.slice(0, 16)}...
                      </span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-center hidden sm:block">
                      <p
                        className={`text-sm font-semibold ${
                          sortKey === "beers" ? "text-amber-400" : "text-chalk"
                        }`}
                      >
                        {entry.beer_balance}
                      </p>
                      <p className="text-[10px] text-ink-muted">beers</p>
                    </div>
                    <div className="text-center hidden sm:block">
                      <p
                        className={`text-sm font-semibold ${
                          sortKey === "wins" ? "text-win" : "text-chalk"
                        }`}
                      >
                        {entry.wins}
                      </p>
                      <p className="text-[10px] text-ink-muted">wins</p>
                    </div>
                    <div className="text-center hidden sm:block">
                      <p
                        className={`text-sm font-semibold ${
                          sortKey === "losses" ? "text-lose" : "text-chalk"
                        }`}
                      >
                        {entry.losses}
                      </p>
                      <p className="text-[10px] text-ink-muted">losses</p>
                    </div>
                    <div className="text-center hidden sm:block">
                      <p
                        className={`text-sm font-semibold ${
                          sortKey === "bets" ? "text-accent" : "text-chalk"
                        }`}
                      >
                        {entry.bets}
                      </p>
                      <p className="text-[10px] text-ink-muted">bets</p>
                    </div>
                    {/* Mobile: show only active sort value */}
                    <div className="text-center sm:hidden">
                      <p
                        className={`text-sm font-semibold ${
                          SORT_CONFIG.find((s) => s.key === sortKey)?.color ?? "text-chalk"
                        }`}
                      >
                        {getValue(entry, sortKey)}
                      </p>
                      <p className="text-[10px] text-ink-muted">
                        {SORT_CONFIG.find((s) => s.key === sortKey)?.label.toLowerCase()}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
