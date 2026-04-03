import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { getPublicProfile, type PublicProfile } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import HashDisplay from "@/components/HashDisplay";
import { motion } from "motion/react";
import {
  ShieldCheck,
  Swords,
  Trophy,
  Link as LinkIcon,
} from "lucide-react";
import GlyphPet from "@/components/GlyphPet";

export default function UserProfile() {
  const { hash } = useParams<{ hash: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hash) return;
    getPublicProfile(hash)
      .then(setProfile)
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [hash]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-4xl tracking-wide text-chalk">
            USER
          </h1>
        </div>
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-chalk-dim text-sm">
              {error || "User not found"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl tracking-wide text-chalk">
          {profile.nickname ? profile.nickname.toUpperCase() : "USER"}
        </h1>
        <p className="text-chalk-dim text-sm mt-1">Public profile</p>
      </div>

      {/* Identity card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <Card
          className={profile.verified ? "border-win/30" : ""}
        >
          <CardContent className="space-y-5">
            <div className="flex items-start gap-4">
              <div className="shrink-0">
                <GlyphPet hash={profile.identity_hash} seed={profile.avatar_seed} size={64} />
              </div>

              <div className="flex-1 min-w-0 space-y-2">
                {profile.nickname && (
                  <h2 className="text-xl font-semibold text-chalk">
                    {profile.nickname}
                  </h2>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  {profile.verified && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-win/15 text-win">
                      <ShieldCheck className="size-3" />
                      Verified
                    </span>
                  )}
                  <span className="text-amber-400 text-sm font-semibold">
                    {profile.beer_balance} {profile.beer_balance === 1 ? "beer" : "beers"}
                  </span>
                </div>
              </div>
            </div>

            <HashDisplay label="Identity Hash" hash={profile.identity_hash} />
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="py-4 text-center space-y-1">
              <LinkIcon className="size-5 text-accent mx-auto" />
              <p className="text-2xl font-semibold text-chalk">
                {profile.stats.on_chain}
              </p>
              <p className="text-xs text-chalk-dim">On-Chain</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center space-y-1">
              <Swords className="size-5 text-lose mx-auto" />
              <p className="text-2xl font-semibold text-chalk">
                {profile.stats.bets}
              </p>
              <p className="text-xs text-chalk-dim">Bets</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center space-y-1">
              <Trophy className="size-5 text-win mx-auto" />
              <p className="text-2xl font-semibold text-chalk">
                {profile.stats.wins}
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
                {profile.stats.losses}
              </p>
              <p className="text-xs text-chalk-dim">Losses</p>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </div>
  );
}
