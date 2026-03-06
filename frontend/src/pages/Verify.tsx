import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { verifyToken } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

export default function Verify() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setError("Missing token");
      return;
    }

    verifyToken(token)
      .then((res) => {
        login(res.session_token);
        if (res.pending_bet_id) {
          navigate("/pending", { replace: true });
        } else {
          navigate("/", { replace: true });
        }
      })
      .catch((err) => {
        setError((err as Error).message);
      });
  }, [params, login, navigate]);

  return (
    <div className="min-h-dvh flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center space-y-4"
      >
        {error ? (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <XCircle className="size-12 text-lose mx-auto" />
            </motion.div>
            <h2 className="text-lg font-semibold text-chalk">
              Verification failed
            </h2>
            <p className="text-sm text-chalk-dim">{error}</p>
            <Button
              variant="link"
              onClick={() => navigate("/login", { replace: true })}
            >
              Try again
            </Button>
          </>
        ) : (
          <>
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-chalk-dim">Verifying...</p>
          </>
        )}
      </motion.div>
    </div>
  );
}
