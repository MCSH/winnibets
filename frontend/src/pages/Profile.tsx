import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import {
  getVerificationStatus,
  getMyActivity,
  type VerificationStatus,
} from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "motion/react";
import {
  ShieldCheck,
  ShieldX,
  ShieldQuestion,
  MessageSquare,
  Swords,
  Trophy,
  Mail,
  Phone,
  ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import GlyphPet from "@/components/GlyphPet";

export default function Profile() {
  const { user } = useAuth();
  const [verification, setVerification] = useState<VerificationStatus | null>(
    null,
  );
  const [stats, setStats] = useState({
    messages: 0,
    bets: 0,
    wins: 0,
    losses: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getVerificationStatus().catch(() => null),
      getMyActivity().catch(() => null),
    ]).then(([vs, activity]) => {
      if (vs) setVerification(vs);
      if (activity) {
        const messages = activity.blocks.filter((b) =>
          ["hidden_message", "open_message"].includes(b.record_type),
        ).length;
        const bets = activity.bets.length;
        const wins = activity.bets.filter(
          (b) =>
            b.resolution?.status === "accepted" &&
            b.resolution.winner === b.role,
        ).length;
        const losses = activity.bets.filter(
          (b) =>
            b.resolution?.status === "accepted" &&
            b.resolution.winner !== b.role,
        ).length;
        setStats({ messages, bets, wins, losses });
      }
      setLoading(false);
    });
  }, []);

  if (!user) return null;

  const isVerified = verification?.status === "verified";
  const isFailed = verification?.status === "failed";
  const isPhone = user.identifier_type === "phone";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-4xl tracking-wide text-chalk">
          PROFILE
        </h1>
        <p className="text-chalk-dim text-sm mt-1">
          Your identity and stats on WinniBets.
        </p>
      </div>

      {/* Identity card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <Card
          className={
            isVerified ? "border-win/30" : isFailed ? "border-lose/30" : ""
          }
        >
          <CardContent className="space-y-5">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="shrink-0">
                <GlyphPet hash={user.identity_hash} size={64} />
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                {user.nickname && (
                  <h2 className="text-xl font-semibold text-chalk truncate">
                    {user.nickname}
                  </h2>
                )}
                <div className="flex items-center gap-2 text-sm text-chalk-dim">
                  {isPhone ? (
                    <Phone className="size-3.5" />
                  ) : (
                    <Mail className="size-3.5" />
                  )}
                  <span className="font-mono truncate">{user.identifier}</span>
                </div>
              </div>
            </div>

            {/* Verification status */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-ink border border-ink-border/40">
              <div className="flex items-center gap-2.5">
                {isVerified ? (
                  <ShieldCheck className="size-5 text-win" />
                ) : isFailed ? (
                  <ShieldX className="size-5 text-lose" />
                ) : (
                  <ShieldQuestion className="size-5 text-ink-muted" />
                )}
                <div>
                  <p className="text-sm font-medium text-chalk">
                    {isVerified
                      ? "Identity Verified"
                      : isFailed
                        ? "Verification Failed"
                        : "Not Verified"}
                  </p>
                  {isVerified && verification?.extracted_name && (
                    <p className="text-xs text-chalk-dim">
                      Government name: {verification.extracted_name}
                    </p>
                  )}
                  {isFailed && verification?.failure_reason && (
                    <p className="text-xs text-lose">
                      {verification.failure_reason}
                    </p>
                  )}
                </div>
              </div>
              {!isVerified && (
                <Link to="/verification">
                  <Button size="sm" variant="outline">
                    Verify
                    <ArrowRight className="size-3 ml-1" />
                  </Button>
                </Link>
              )}
            </div>

            {/* Member since */}
            {verification?.created_at && isVerified && (
              <p className="text-xs text-ink-muted">
                Verified on{" "}
                {new Date(verification.created_at).toLocaleDateString()}
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-chalk">Stats</h2>
          <div className="flex-1 h-px bg-ink-border/30" />
        </div>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Card>
              <CardContent className="py-4 text-center space-y-1">
                <span className="text-xl mx-auto block">🍺</span>
                <p className="text-2xl font-semibold text-amber-400">
                  {user.beer_balance}
                </p>
                <p className="text-xs text-chalk-dim">Beers</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center space-y-1">
                <MessageSquare className="size-5 text-accent mx-auto" />
                <p className="text-2xl font-semibold text-chalk">
                  {stats.messages}
                </p>
                <p className="text-xs text-chalk-dim">Messages</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center space-y-1">
                <Swords className="size-5 text-lose mx-auto" />
                <p className="text-2xl font-semibold text-chalk">
                  {stats.bets}
                </p>
                <p className="text-xs text-chalk-dim">Bets</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center space-y-1">
                <Trophy className="size-5 text-win mx-auto" />
                <p className="text-2xl font-semibold text-chalk">
                  {stats.wins}
                </p>
                <p className="text-xs text-chalk-dim">Wins</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center space-y-1">
                <Badge variant="red" className="mx-auto">
                  L
                </Badge>
                <p className="text-2xl font-semibold text-chalk">
                  {stats.losses}
                </p>
                <p className="text-xs text-chalk-dim">Losses</p>
              </CardContent>
            </Card>
          </div>
        )}
      </motion.div>
    </div>
  );
}
