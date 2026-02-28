import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { motion } from "motion/react";

const FEATURES = [
  {
    to: "/message",
    title: "Hidden Message",
    desc: "Record a tamper-proof, hash-only statement on the blockchain. Your plaintext is never stored.",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
        />
      </svg>
    ),
  },
  {
    to: "/bet",
    title: "Place a Bet",
    desc: "Create a two-party wager with visible or hidden terms. Your counterparty is invited via SMS.",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5"
        />
      </svg>
    ),
  },
  {
    to: "/explorer",
    title: "Block Explorer",
    desc: "Look up any block by hash or verify the integrity of the entire chain.",
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
        />
      </svg>
    ),
  },
] as const;

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="space-y-12">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center pt-8 pb-4"
      >
        <h1 className="font-display text-5xl sm:text-7xl tracking-wider text-gold leading-none">
          WINNIBETS
        </h1>
        <p className="text-chalk-dim mt-3 max-w-md mx-auto">
          Tamper-proof hidden messages and provable bets on a community
          blockchain.
        </p>
        {user && (
          <p className="text-xs text-ink-muted mt-4 font-mono">
            Logged in as {user.identifier}
          </p>
        )}
      </motion.div>

      {/* Feature cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.to}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}
          >
            <Link
              to={f.to}
              className="block group bg-ink-light border border-ink-border/60 rounded-lg p-6 hover:border-gold/40 transition-colors no-underline h-full"
            >
              <div className="w-10 h-10 rounded bg-gold/10 border border-gold/20 flex items-center justify-center text-gold mb-4 group-hover:bg-gold/15 transition-colors">
                {f.icon}
              </div>
              <h3 className="font-display text-xl tracking-wide text-chalk mb-2">
                {f.title}
              </h3>
              <p className="text-xs text-chalk-dim leading-relaxed">{f.desc}</p>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Info */}
      <div className="flex items-center gap-3 justify-center">
        <div className="flex-1 max-w-[80px] h-px bg-ink-border/40" />
        <span className="text-[10px] text-ink-muted font-mono uppercase tracking-widest">
          SHA-256 &middot; Private Chain &middot; Zero Trust
        </span>
        <div className="flex-1 max-w-[80px] h-px bg-ink-border/40" />
      </div>
    </div>
  );
}
