import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Bot, Store, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Agents", icon: Bot },
  { href: "/dashboard/store", label: "App Store", icon: Store },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, organization, logout } = useAuth();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex">
      <aside className="hidden lg:flex w-64 bg-white border-r border-gray-200 flex-col fixed h-full z-30">
        <div className="p-6 border-b border-gray-100">
          <Link href="/dashboard" className="text-xl font-semibold text-gray-900 tracking-tight">
            BevPro
          </Link>
          {organization && (
            <p className="text-xs text-gray-500 mt-1 truncate">{organization.name}</p>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
            const isDashboardExact = item.href === "/dashboard" && (location === "/dashboard" || location.startsWith("/dashboard/agents"));
            const active = isActive || isDashboardExact;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-medium">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            data-testid="button-logout"
            onClick={() => logout.mutate()}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-red-600 transition-colors w-full mt-1"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="lg:hidden fixed top-0 w-full bg-white border-b border-gray-200 z-40 px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="text-lg font-semibold text-gray-900">BevPro</Link>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 bg-white z-30 pt-16">
          <nav className="p-4 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-base text-gray-700 hover:bg-gray-100"
                >
                  <Icon size={20} />
                  {item.label}
                </Link>
              );
            })}
            <button
              onClick={() => { logout.mutate(); setMobileMenuOpen(false); }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-base text-red-600 hover:bg-red-50 w-full"
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
