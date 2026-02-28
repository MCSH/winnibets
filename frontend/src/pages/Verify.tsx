import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { verifyToken } from "../lib/api";
import { useAuth } from "../lib/auth";
import { motion } from "motion/react";

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
        navigate("/", { replace: true });
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
            <div className="w-12 h-12 rounded-full bg-lose/10 border border-lose/30 flex items-center justify-center mx-auto">
              <svg
                className="w-6 h-6 text-lose"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-chalk">
              Verification failed
            </h2>
            <p className="text-sm text-chalk-dim">{error}</p>
            <button
              onClick={() => navigate("/login", { replace: true })}
              className="text-sm text-gold hover:text-gold-bright transition-colors cursor-pointer"
            >
              Try again
            </button>
          </>
        ) : (
          <>
            <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-chalk-dim">Verifying...</p>
          </>
        )}
      </motion.div>
    </div>
  );
}
