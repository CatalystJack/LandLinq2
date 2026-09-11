import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { preloadRoute } from "@/lib/route-preload";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const realEstateTabs = [
  { label: "Deal Dashboard", href: "/developer/dashboard" },
  { label: "CRM", href: "/developer/crm" },
  { label: "Outreach", href: "/developer/outreach" },
  { label: "Analytics", href: "/developer/analytics" },
  { label: "Settings", href: "/developer/settings" },
];

export default function DeveloperNavigation() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const profile = (user as any)?.developerProfile;
  const tabs = profile?.profileType === "general_sales"
    ? realEstateTabs.filter((tab) => tab.href !== "/developer/dashboard")
    : realEstateTabs;
  const companyName = profile?.companyName || "LandLinq";
  const logoUrl = profile?.logoUrl || "/assets/landlinq-white-logo.png";

  const navigateTo = (href: string) => {
    preloadRoute(href);
    setIsMobileMenuOpen(false);
  };

  return (
    <nav
      className="relative sticky top-0 z-50 border-b border-slate-800 bg-[#081729] shadow-lg"
      aria-label="Developer navigation"
    >
      <div className="relative mx-auto max-w-7xl px-3 sm:px-4 lg:px-6">
        <div className="flex h-16 items-center justify-between lg:h-20">
          <div className="flex min-w-0 shrink-0 items-center" aria-label={companyName}>
            <Link href="/" className="flex items-center gap-1.5" aria-label={`${companyName} home`}>
              <img
                src={logoUrl}
                alt={profile?.logoUrl ? `${companyName} logo` : "LandLinq"}
                className="h-9 w-auto max-w-[190px] object-contain sm:h-10 lg:h-12"
                data-testid="developer-header-logo"
              />
            </Link>
          </div>

          <div className="hidden items-center md:flex">
            <div className="flex items-center space-x-2 lg:space-x-4">
              <div className="flex max-w-[calc(100vw-300px)] items-center gap-0.5 overflow-x-auto lg:gap-1">
                {tabs.map((tab) => {
                  const isActive = location === tab.href;
                  return (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      className={`whitespace-nowrap rounded-md px-1.5 py-2 text-xs font-medium transition-colors lg:px-2 lg:text-sm ${
                        isActive ? "text-cyan-300" : "text-white hover:text-cyan-300"
                      }`}
                      onMouseEnter={() => preloadRoute(tab.href)}
                      onFocus={() => preloadRoute(tab.href)}
                      onTouchStart={() => preloadRoute(tab.href)}
                      data-testid={`nav-link-${tab.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                    >
                      {tab.label}
                    </Link>
                  );
                })}
              </div>
              <Button
                onClick={() => logout?.()}
                data-testid="button-logout"
                size="sm"
              >
                <span className="hidden lg:inline">Sign Out</span>
                <span className="lg:hidden">Out</span>
              </Button>
            </div>
          </div>

          <div className="flex items-center md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const nextOpen = !isMobileMenuOpen;
                if (nextOpen) tabs.forEach((tab) => preloadRoute(tab.href));
                setIsMobileMenuOpen(nextOpen);
              }}
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMobileMenuOpen}
              data-testid="button-mobile-menu"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6 text-slate-400" />
              ) : (
                <Menu className="h-6 w-6 text-slate-400" />
              )}
            </Button>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="border-t border-slate-700 py-4 md:hidden">
            <div className="flex flex-col space-y-2 px-4">
              {tabs.map((tab) => {
                const isActive = location === tab.href;
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`w-full rounded-lg px-4 py-3 text-center text-sm font-medium transition-colors ${
                      isActive ? "text-white" : "text-slate-300 hover:text-white"
                    }`}
                    onMouseEnter={() => preloadRoute(tab.href)}
                    onFocus={() => preloadRoute(tab.href)}
                    onTouchStart={() => preloadRoute(tab.href)}
                    onClick={() => navigateTo(tab.href)}
                    data-testid={`mobile-nav-link-${tab.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                  >
                    {tab.label}
                  </Link>
                );
              })}
              <div className="w-full border-t border-slate-700 pt-4">
                <Button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    logout?.();
                  }}
                  className="w-full"
                  data-testid="mobile-button-logout"
                >
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}