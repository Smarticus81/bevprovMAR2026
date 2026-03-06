import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Bot, Store, LogOut, Menu, X, Database } from "lucide-react";
import { useState } from "react";

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
      <aside className="hidden lg:flex w-64 bg-black border-r border-white/10 flex-col fixed h-full z-30">
        <div className="p-6 border-b border-white/10">
          <Link href="/dashboard" className="text-xl font-semibold text-white tracking-tight">
            BevPro
          </Link>
          {organization && (
            <p className="text-xs text-white/40 mt-1 truncate">{organization.name}</p>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
            const isDashboardExact = item.href === "/dashboard" && (location === "/dashboard" || location.startsWith("/dashboard/agents")) && !location.startsWith("/dashboard/venue") && !location.startsWith("/dashboard/store");
            const active = isActive || isDashboardExact;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                  active
                    ? "border border-white/30 text-white bg-white/[0.06]"
                    : "text-white/40 hover:bg-white/[0.04] hover:text-white/70"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center text-xs font-medium">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-white/40 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            data-testid="button-logout"
            onClick={() => logout.mutate()}
            className="flex items-center gap-2 px-3 py-2 text-sm text-white/40 hover:text-red-400 transition-colors w-full mt-1"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="lg:hidden fixed top-0 w-full bg-black/80 backdrop-blur-xl border-b border-white/10 z-40 px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="text-lg font-semibold text-white">BevPro</Link>
        <button data-testid="button-mobile-menu" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-white">
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 bg-black z-30 pt-16">
          <nav className="p-4 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-testid={`link-mobile-${item.label.toLowerCase().replace(/\s/g, "-")}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-base text-white/60 hover:bg-white/5 hover:text-white"
                >
                  <Icon size={20} />
                  {item.label}
                </Link>
              );
            })}
            <button
              data-testid="button-mobile-logout"
              onClick={() => { logout.mutate(); setMobileMenuOpen(false); }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-base text-red-400 hover:bg-red-500/10 w-full"
            >
              <LogOut size={20} />
              Sign Out
            </button>
          </nav>
        </div>
      )}

      <main className="flex-1 lg:ml-64 pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  );
}
