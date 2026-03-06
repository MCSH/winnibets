import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import Shell from "@/components/Shell";
import Login from "@/pages/Login";
import Verify from "@/pages/Verify";
import Home from "@/pages/Home";
import Message from "@/pages/Message";
import Bet from "@/pages/Bet";
import BetRespond from "@/pages/BetRespond";
import PendingBets from "@/pages/PendingBets";
import Explorer from "@/pages/Explorer";
import type { ReactNode } from "react";

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      {/* Public */}
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />
      <Route path="/auth/verify" element={<Verify />} />

      {/* Shell layout (handles both auth and public states) */}
      <Route element={<Shell />}>
        {/* Public */}
        <Route path="/explorer" element={<Explorer />} />

        {/* Protected */}
        <Route
          index
          element={user ? <Home /> : <Navigate to="/explorer" replace />}
        />
        <Route
          path="/message"
          element={
            <RequireAuth>
              <Message />
            </RequireAuth>
          }
        />
        <Route
          path="/bet"
          element={
            <RequireAuth>
              <Bet />
            </RequireAuth>
          }
        />
        <Route
          path="/pending"
          element={
            <RequireAuth>
              <PendingBets />
            </RequireAuth>
          }
        />
        <Route
          path="/bets/:betId/respond"
          element={
            <RequireAuth>
              <BetRespond />
            </RequireAuth>
          }
        />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
