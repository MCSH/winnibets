import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { motion, AnimatePresence } from "motion/react";

const AUTH_NAV = [
  { to: "/message", label: "Message" },
  { to: "/bet", label: "Place Bet" },
  { to: "/pending", label: "Pending" },
  { to: "/explorer", label: "Explorer" },
] as const;

const PUBLIC_NAV = [{ to: "/explorer", label: "Explorer" }] as const;

export default function Shell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const nav = user ? AUTH_NAV : PUBLIC_NAV;

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Header */}
      <header className="border-b border-ink-border/50 bg-ink-light/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 no-underline">
            <span className="font-display text-2xl tracking-wider text-gold leading-none pt-1">
              WINNIBETS
            </span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            {nav.map((n) => {
              const active = location.pathname === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`relative px-3 py-1.5 text-sm font-medium no-underline transition-colors ${
                    active ? "text-gold" : "text-chalk-dim hover:text-chalk"
                  }`}
                >
                  {n.label}
                  {active && (
                    <motion.span
                      layoutId="nav-underline"
                      className="absolute inset-x-1 -bottom-[1px] h-[2px] bg-gold"
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 35,
                      }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <span className="text-xs font-mono text-ink-muted hidden sm:block">
                  {user.identifier}
                </span>
                <button
                  onClick={logout}
                  className="text-xs text-chalk-dim hover:text-lose transition-colors cursor-pointer"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="text-xs font-medium text-gold hover:text-gold-bright no-underline transition-colors"
              >
                Login
              </Link>
            )}
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="sm:hidden flex items-center gap-1 px-4 pb-2 overflow-x-auto">
          {nav.map((n) => {
            const active = location.pathname === n.to;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`relative px-3 py-1 text-xs font-medium no-underline whitespace-nowrap transition-colors ${
                  active ? "text-gold" : "text-chalk-dim"
                }`}
              >
                {n.label}
                {active && (
                  <motion.span
                    layoutId="nav-underline-mobile"
                    className="absolute inset-x-1 -bottom-0.5 h-[2px] bg-gold"
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-ink-border/30 py-6 text-center text-xs text-ink-muted">
        Powered by linear algebra, made by MCSH
      </footer>
    </div>
  );
}
