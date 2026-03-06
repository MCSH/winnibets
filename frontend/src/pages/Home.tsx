import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Lock, Zap, Search, ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

const FEATURES: {
  to: string;
  title: string;
  desc: string;
  icon: ReactNode;
  cta: string;
}[] = [
  {
    to: "/message",
    title: "Drop a Message",
    desc: "Lock your words on-chain. Only the hash is stored — your secret stays yours.",
    icon: <Lock className="size-5" />,
    cta: "Write Message",
  },
  {
    to: "/bet",
    title: "Challenge a Friend",
    desc: "Set the terms, pick your opponent, and let the blockchain settle it. No take-backs.",
    icon: <Zap className="size-5" />,
    cta: "Place a Bet",
  },
  {
    to: "/explorer",
    title: "Global Ledger",
    desc: "Every bet and message lives here for good. Browse the public record and verify any claim.",
    icon: <Search className="size-5" />,
    cta: "View Ledger",
  },
];

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="space-y-14">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center pt-10 pb-2"
      >
        <h1 className="font-display text-5xl sm:text-7xl tracking-wider text-accent leading-none">
          WINNIBETS
        </h1>
        <p className="text-chalk-dim mt-3 max-w-lg mx-auto text-lg">
          Make it official. Prove it on-chain.
        </p>
        {user ? (
          <p className="text-xs text-ink-muted mt-4 font-mono">
            Welcome back, {user.identifier}
          </p>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6"
          >
            <Link to="/login" className="no-underline">
              <Button size="lg">
                Get Started
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          </motion.div>
        )}
      </motion.div>

      {/* Feature cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.to}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.15 + i * 0.1 }}
            whileHover={{ y: -6, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Link
              to={f.to}
              className="block group bg-ink-light border border-ink-border/60 rounded-xl p-6 hover:border-accent/50 transition-all duration-300 no-underline h-full hover:shadow-xl hover:shadow-accent/10"
            >
              <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent mb-4 group-hover:bg-accent/20 group-hover:border-accent/40 group-hover:shadow-lg group-hover:shadow-accent/10 transition-all duration-300">
                {f.icon}
              </div>
              <h3 className="font-display text-2xl tracking-wide text-chalk mb-2 group-hover:text-accent transition-colors">
                {f.title}
              </h3>
              <p className="text-sm text-chalk-dim leading-relaxed mb-4">
                {f.desc}
              </p>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent group-hover:gap-2.5 transition-all">
                {f.cta}
                <ArrowRight className="size-3.5" />
              </span>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Trust bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex items-center gap-3 justify-center"
      >
        <div className="flex-1 max-w-[80px] h-px bg-ink-border/40" />
        <span className="text-[10px] text-ink-muted font-mono uppercase tracking-widest">
          SHA-256 &middot; Private Chain &middot; Zero Trust
        </span>
        <div className="flex-1 max-w-[80px] h-px bg-ink-border/40" />
      </motion.div>
    </div>
  );
}
