import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Bot, Store, LogOut, Menu, X, Database, ChevronRight } from "lucide-react";
import { useState } from "react";
import { BevProLogo, BevProWordmark } from "@/components/BevProLogo";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Agents", icon: Bot },
  { href: "/dashboard/venue", label: "Venue Data", icon: Database },
  { href: "/dashboard/store", label: "App Store", icon: Store },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, organization, logout } = useAuth();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-black text-white flex">
      <aside className="hidden lg:flex w-60 flex-col fixed h-full z-30 border-r border-white/[0.06] bg-white/[0.01]">
        <div className="p-6 pb-5">
          <Link href="/dashboard" className="inline-flex items-center gap-2.5" data-testid="link-home">
            <BevProLogo size={22} />
            <BevProWordmark className="text-white" size="text-base" />
          </Link>
          {organization && (
            <p className="text-[11px] text-white/25 mt-2 truncate tracking-wide">{organization.name}</p>
          )}
        </div>

        <nav className="flex-1 px-3 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
            const isDashboardExact = item.href === "/dashboard" && (location === "/dashboard" || location.startsWith("/dashboard/agents")) && !location.startsWith("/dashboard/venue") && !location.startsWith("/dashboard/store");
            const active = isActive || isDashboardExact;
            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={`link-nav-${item.label.toLowerCase().replace(/\s/g, "-")}`}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all duration-200 relative ${
                  active
                    ? "text-white bg-white/[0.04]"
                    : "text-white/30 hover:text-white/50 hover:bg-white/[0.02]"
                }`}
              >
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#C9A96E]" />
                )}
                <Icon size={16} className={active ? "text-[#C9A96E]" : ""} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-7 h-7 rounded-full bg-[#C9A96E]/15 text-[#C9A96E] flex items-center justify-center text-[11px] font-semibold">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white/70 truncate">{user?.name}</p>
              <p className="text-[11px] text-white/20 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            data-testid="button-logout"
            onClick={() => logout.mutate()}
            className="flex items-center gap-2 px-2 py-2 text-xs text-white/25 hover:text-red-400/80 transition-colors w-full mt-1 uppercase tracking-[0.1em]"
          >
            <LogOut size={13} />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="lg:hidden fixed top-0 w-full bg-black/90 backdrop-blur-xl border-b border-white/[0.06] z-40 px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2">
          <BevProLogo size={20} />
          <BevProWordmark className="text-white" size="text-sm" />
        </Link>
        <button data-testid="button-mobile-menu" aria-label={mobileMenuOpen ? "Close menu" : "Open menu"} onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-white/50">
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 bg-black z-30 pt-16">
          <nav className="p-4 space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-testid={`link-mobile-${item.label.toLowerCase().replace(/\s/g, "-")}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3.5 text-base text-white/50 hover:text-white transition-colors"
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
            <div className="h-px bg-white/[0.06] my-3" />
            <button
              data-testid="button-mobile-logout"
              onClick={() => { logout.mutate(); setMobileMenuOpen(false); }}
              className="flex items-center gap-3 px-4 py-3 text-sm text-white/25 hover:text-red-400/80 w-full uppercase tracking-[0.1em]"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </nav>
        </div>
      )}

      <main className="flex-1 lg:ml-60 pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  );
}
