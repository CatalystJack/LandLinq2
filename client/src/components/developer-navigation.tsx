import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { preloadRoute } from "@/lib/route-preload";

const tabs = [
  { label: "Deal Dashboard", href: "/developer/dashboard" },
  { label: "CRM", href: "/developer/crm" },
  { label: "Outreach", href: "/developer/outreach" },
  { label: "Analytics", href: "/developer/analytics" },
  { label: "User Management", href: "/developer/user-management" },
  { label: "Settings", href: "/developer/settings" },
];

export default function DeveloperNavigation() {
  const { user } = useAuth();
  const [location] = useLocation();
  const profile = (user as any)?.developerProfile;
  const primaryColor = profile?.primaryColor || "#0A2B4A";
  const secondaryColor = profile?.secondaryColor || "#4A90E2";
  const companyName = profile?.companyName || "LandLinq";

  return (
    <header
      className="sticky top-0 z-50 border-b bg-white shadow-sm"
      style={{ borderBottomColor: `${primaryColor}20` }}
    >
      <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 shrink-0 items-center gap-3" aria-label={companyName}>
          {profile?.logoUrl ? (
            <img
              src={profile.logoUrl}
              alt={companyName}
              className="max-h-9 w-auto max-w-40 object-contain"
            />
          ) : (
            <span className="truncate text-lg font-bold" style={{ color: primaryColor }}>
              {companyName}
            </span>
          )}
        </div>

        <nav className="flex min-w-0 flex-1 items-center justify-end gap-1 overflow-x-auto" aria-label="Developer navigation">
          {tabs.map((tab) => {
            const isActive = location === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="shrink-0 rounded-md px-3 py-2 text-sm font-medium transition-colors sm:px-4"
                style={{
                  color: isActive ? primaryColor : "#64748b",
                  borderBottom: isActive ? `2px solid ${secondaryColor}` : "2px solid transparent",
                }}
                onMouseEnter={() => preloadRoute(tab.href)}
                onFocus={() => preloadRoute(tab.href)}
                onTouchStart={() => preloadRoute(tab.href)}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}