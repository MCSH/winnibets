import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, X } from "lucide-react";
import { useState } from "react";

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
  const [mobileOpen, setMobileOpen] = useState(false);

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
    </div>
  );
}
