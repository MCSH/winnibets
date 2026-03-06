import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { respondToBet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import HashDisplay from "@/components/HashDisplay";
import { motion } from "motion/react";
import { Check, X, LogIn } from "lucide-react";

export default function BetRespond() {
  const { betId } = useParams<{ betId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    status: "accepted" | "declined";
    block_hash?: string;
    block_index?: number;
    timestamp?: number;
  } | null>(null);

  const handleRespond = async (accept: boolean) => {
    if (!betId) return;
    setError("");
    setLoading(true);
    try {
      const res = await respondToBet(Number(betId), accept);
      setResult(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="text-chalk-dim">
          You need to verify your identity first.
        </p>
        <Button variant="link" onClick={() => navigate("/login")}>
          <LogIn className="size-3.5" />
          Log in
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-8">
      <div>
        <h1 className="font-display text-4xl tracking-wide text-chalk">
          RESPOND TO BET
        </h1>
        <p className="text-chalk-dim text-sm mt-1">Bet #{betId}</p>
      </div>

      {!result ? (
        <Card>
          <CardContent className="space-y-6">
            <p className="text-sm text-chalk-dim">
              Review the bet terms from the message you received, then accept or
              decline below.
            </p>

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-lose text-xs font-medium"
              >
                {error}
              </motion.p>
            )}

            <div className="flex gap-3">
              <Button
                variant="success"
                className="flex-1"
                onClick={() => handleRespond(true)}
                disabled={loading}
              >
                {loading ? (
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
                onClick={() => handleRespond(false)}
                disabled={loading}
              >
                <X className="size-3.5" />
                Decline
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <Card
            className={
              result.status === "accepted"
                ? "border-win/30"
                : "border-lose/30"
            }
          >
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 15,
                    delay: 0.1,
                  }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    result.status === "accepted"
                      ? "bg-win/15"
                      : "bg-lose/15"
                  }`}
                >
                  {result.status === "accepted" ? (
                    <Check className="size-4 text-win" />
                  ) : (
                    <X className="size-4 text-lose" />
                  )}
                </motion.div>
                <span
                  className={`text-sm font-semibold ${
                    result.status === "accepted" ? "text-win" : "text-lose"
                  }`}
                >
                  Bet {result.status}
                </span>
              </div>

              {result.status === "accepted" && result.block_hash && (
                <div className="space-y-3">
                  <HashDisplay label="Block Hash" hash={result.block_hash} />
                  <div className="flex gap-6 text-xs text-chalk-dim">
                    <span>
                      Block{" "}
                      <span className="font-mono text-chalk">
                        #{result.block_index}
                      </span>
                    </span>
                    {result.timestamp && (
                      <span>
                        {new Date(result.timestamp * 1000).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {result.status === "declined" && (
                <p className="text-sm text-chalk-dim">
                  The bet has been declined and the initiator has been notified.
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
