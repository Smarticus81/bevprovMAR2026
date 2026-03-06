import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Bot, Store, LogOut, Menu, X, Database, ChevronRight, BookOpen, CreditCard, Sun, Moon } from "lucide-react";
import { useState } from "react";
import { BevProLogo, BevProWordmark } from "@/components/BevProLogo";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Agents", icon: Bot, description: "Manage your AI agents" },
  { href: "/dashboard/venue", label: "Venue Data", icon: Database, description: "Menus, hours & venue info" },
  { href: "/dashboard/store", label: "App Store", icon: Store, description: "Browse & install apps" },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard, description: "Plans & payment" },
  { href: "/docs", label: "Documentation", icon: BookOpen, description: "Guides & references" },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, organization, logout } = useAuth();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, toggleTheme, isDark } = useTheme();

  return (
    <div className="min-h-screen bg-page text-ink flex">
      <aside className="hidden lg:flex w-60 flex-col fixed h-full z-30 border-r border-line-subtle bg-surface-1">
        <div className="p-6 pb-5">
          <Link href="/dashboard" className="inline-flex items-center gap-2.5" data-testid="link-home">
            <BevProLogo size={22} />
            <BevProWordmark className="text-ink" size="text-base" />
          </Link>
          {organization && (
            <p className="text-xs text-ink-faint mt-2 truncate tracking-wide">{organization.name}</p>
          )}
        </div>

        <nav className="flex-1 px-3 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
            const isDashboardExact = item.href === "/dashboard" && (location === "/dashboard" || location.startsWith("/dashboard/agents")) && !location.startsWith("/dashboard/venue") && !location.startsWith("/dashboard/store") && !location.startsWith("/dashboard/billing");
            const active = isActive || isDashboardExact;
            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={`link-nav-${item.label.toLowerCase().replace(/\s/g, "-")}`}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  active
                    ? "text-ink bg-accent-bg border border-accent-border"
                    : "text-ink-faint hover:text-ink-secondary hover:bg-surface-2"
                }`}
              >
                <Icon size={16} className={active ? "text-accent" : ""} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-line-subtle">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-accent-bg text-accent flex items-center justify-center text-xs font-semibold">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink truncate">{user?.name}</p>
              <p className="text-xs text-ink-faint truncate">{user?.email}</p>
            </div>
          </div>
          <button
            data-testid="button-theme-toggle"
            onClick={toggleTheme}
            className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-ink-muted hover:text-ink-secondary hover:bg-surface-2 rounded-lg transition-colors w-full mt-2"
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
            {isDark ? "Light Mode" : "Dark Mode"}
          </button>
          <button
            data-testid="button-logout"
            onClick={() => logout.mutate()}
            className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-ink-muted hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors w-full mt-2"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="lg:hidden fixed top-0 w-full bg-page/90 backdrop-blur-xl border-b border-line-subtle z-40 px-5 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <BevProLogo size={22} />
          <BevProWordmark className="text-ink" size="text-base" />
        </Link>
        <button data-testid="button-mobile-menu" aria-label={mobileMenuOpen ? "Close menu" : "Open menu"} onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-ink-secondary p-2 -mr-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 bg-page/95 backdrop-blur-xl z-30 pt-[72px] animate-in fade-in duration-200">
          <nav className="p-4 space-y-1">
            {organization && (
              <div className="px-4 py-3 mb-3 border-b border-line-subtle">
                <p className="text-xs uppercase tracking-[0.15em] text-ink-faint font-medium mb-1">Venue</p>
                <p className="text-base text-ink-secondary truncate">{organization.name}</p>
              </div>
            )}
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
              const isDashboardExact = item.href === "/dashboard" && (location === "/dashboard" || location.startsWith("/dashboard/agents")) && !location.startsWith("/dashboard/venue") && !location.startsWith("/dashboard/store") && !location.startsWith("/dashboard/billing");
              const active = isActive || isDashboardExact;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-testid={`link-mobile-${item.label.toLowerCase().replace(/\s/g, "-")}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-4 px-4 py-4 rounded-lg text-base transition-colors min-h-[56px] ${
                    active
                      ? "text-ink bg-accent-bg border border-accent-border"
                      : "text-ink-secondary hover:text-ink hover:bg-surface-2"
                  }`}
                >
                  <Icon size={22} className={active ? "text-accent" : "text-ink-faint"} />
                  <div className="flex flex-col">
                    <span className="text-[16px] font-medium leading-tight">{item.label}</span>
                    <span className={`text-[13px] leading-tight mt-0.5 ${active ? "text-ink-muted" : "text-ink-faint"}`}>{item.description}</span>
                  </div>
                </Link>
              );
            })}
            <div className="h-px bg-surface-3 my-4" />
            {user && (
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-10 h-10 rounded-full bg-accent-bg text-accent flex items-center justify-center text-sm font-semibold">
                  {user.name?.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-base text-ink truncate">{user.name}</p>
                  <p className="text-sm text-ink-faint truncate">{user.email}</p>
                </div>
              </div>
            )}
            <button
              data-testid="button-theme-toggle"
              onClick={toggleTheme}
              className="flex items-center gap-3 px-4 py-4 text-base text-ink-muted hover:text-ink-secondary hover:bg-surface-2 rounded-lg transition-colors w-full min-h-[48px]"
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
              {isDark ? "Light Mode" : "Dark Mode"}
            </button>
            <button
              data-testid="button-mobile-logout"
              onClick={() => { logout.mutate(); setMobileMenuOpen(false); }}
              className="flex items-center gap-3 px-4 py-4 text-base text-ink-muted hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors w-full min-h-[48px]"
            >
              <LogOut size={20} />
              Sign Out
            </button>
          </nav>
        </div>
      )}

      <main className="flex-1 lg:ml-60 pt-[72px] lg:pt-0">
        {children}
      </main>
    </div>
  );
}
