import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { respondToBet } from "../lib/api";
import { useAuth } from "../lib/auth";
import Card from "../components/Card";
import HashDisplay from "../components/HashDisplay";
import { motion } from "motion/react";

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
        <button
          onClick={() => navigate("/login")}
          className="text-gold hover:text-gold-bright transition-colors cursor-pointer"
        >
          Log in
        </button>
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
        <Card className="space-y-6">
          <p className="text-sm text-chalk-dim">
            Review the bet terms from the SMS you received, then accept or
            decline below.
          </p>

          {error && <p className="text-lose text-xs font-medium">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={() => handleRespond(true)}
              disabled={loading}
              className="flex-1 bg-win/15 border border-win/40 text-win font-semibold py-3 rounded hover:bg-win/25 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? "..." : "Accept"}
            </button>
            <button
              onClick={() => handleRespond(false)}
              disabled={loading}
              className="flex-1 bg-lose/10 border border-lose/30 text-lose font-semibold py-3 rounded hover:bg-lose/20 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Decline
            </button>
          </div>
        </Card>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card
            className={`space-y-4 ${result.status === "accepted" ? "border-win/30" : "border-lose/30"}`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${result.status === "accepted" ? "bg-win" : "bg-lose"}`}
              />
              <span
                className={`text-xs font-semibold uppercase tracking-wider ${result.status === "accepted" ? "text-win" : "text-lose"}`}
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
          </Card>
        </motion.div>
      )}
    </div>
  );
}
