import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, X, MessageSquarePlus, Swords } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const AUTH_NAV = [
  { to: "/message", label: "Message" },
  { to: "/bet", label: "Place Bet" },
  { to: "/pending", label: "Pending" },
  { to: "/explorer", label: "Ledger" },
] as const;

const PUBLIC_NAV = [{ to: "/explorer", label: "Ledger" }] as const;

export default function Shell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const nav = user ? AUTH_NAV : PUBLIC_NAV;
  const [mobileOpen, setMobileOpen] = useState(false);

  const showFabs =
    user && !["/message", "/bet"].includes(location.pathname);

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Header */}
      <header className="border-b border-ink-border/50 bg-ink-light/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 no-underline">
            <span className="font-display text-2xl tracking-wider text-accent leading-none pt-1">
              WINNIBETS
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-1">
            {nav.map((n) => {
              const active = location.pathname === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`relative px-3 py-1.5 text-sm font-medium no-underline transition-colors ${
                    active ? "text-accent" : "text-chalk-dim hover:text-chalk"
                  }`}
                >
                  {n.label}
                  {active && (
                    <motion.span
                      layoutId="nav-underline"
                      className="absolute inset-x-1 -bottom-[1px] h-[2px] bg-accent rounded-full"
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={logout}
                  className="text-chalk-dim hover:text-lose"
                >
                  <LogOut className="size-3.5" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </>
            ) : (
              <Link
                to="/login"
                className="text-sm font-medium text-accent hover:text-accent-bright no-underline transition-colors"
              >
                Login
              </Link>
            )}

            {/* Mobile menu toggle */}
            <button
              className="sm:hidden text-chalk-dim hover:text-chalk transition-colors cursor-pointer"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {/* Mobile nav dropdown */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.nav
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="sm:hidden overflow-hidden border-t border-ink-border/30"
            >
              <div className="px-4 py-3 space-y-1">
                {nav.map((n) => {
                  const active = location.pathname === n.to;
                  return (
                    <Link
                      key={n.to}
                      to={n.to}
                      onClick={() => setMobileOpen(false)}
                      className={`block px-3 py-2 rounded-lg text-sm font-medium no-underline transition-colors ${
                        active
                          ? "text-accent bg-accent/10"
                          : "text-chalk-dim hover:text-chalk hover:bg-ink-lighter"
                      }`}
                    >
                      {n.label}
                    </Link>
                  );
                })}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
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
        {" · "}
        <a
          href="https://github.com/mcsh/winnibets"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-chalk-dim transition-colors"
        >
          GitHub
        </a>
      </footer>

      {/* Floating action buttons */}
      <AnimatePresence>
        {showFabs && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 flex flex-col gap-3 z-50"
          >
            <button
              onClick={() => navigate("/message")}
              className="group flex items-center gap-2 cursor-pointer"
            >
              <span className="hidden group-hover:block text-xs font-medium text-chalk bg-ink-lighter border border-ink-border/50 rounded-md px-2 py-1 shadow-lg whitespace-nowrap">
                New Message
              </span>
              <span className="size-12 rounded-full bg-ink-lighter border border-ink-border/50 shadow-lg flex items-center justify-center text-chalk-dim hover:text-accent hover:border-accent/50 transition-colors">
                <MessageSquarePlus className="size-5" />
              </span>
            </button>
            <button
              onClick={() => navigate("/bet")}
              className="group flex items-center gap-2 cursor-pointer"
            >
              <span className="hidden group-hover:block text-xs font-medium text-chalk bg-ink-lighter border border-ink-border/50 rounded-md px-2 py-1 shadow-lg whitespace-nowrap">
                New Bet
              </span>
              <span className="size-14 rounded-full bg-accent shadow-lg shadow-accent/25 flex items-center justify-center text-ink hover:bg-accent-bright transition-colors">
                <Swords className="size-6" />
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
