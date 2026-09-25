import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { preloadRoute } from "@/lib/route-preload";
import {
  BarChart3,
  BriefcaseBusiness,
  CircleDot,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Send,
  Settings,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import DeveloperAssistantChat from "@/components/developer-assistant-chat";

const realEstateTabs = [
  { label: "Home", href: "/developer/home" },
  { label: "Deal Dashboard", href: "/developer/dashboard" },
  { label: "Pipeline", href: "/developer/pipeline" },
  { label: "CRM", href: "/developer/crm" },
  { label: "Outreach", href: "/developer/outreach" },
  { label: "Analytics", href: "/developer/analytics" },
  { label: "Settings", href: "/developer/settings" },
];

const iconForTab = (label: string) => {
  if (label === "Home") return Home;
  if (label === "Deal Dashboard") return LayoutDashboard;
  if (label === "Pipeline") return BriefcaseBusiness;
  if (label === "CRM") return Users;
  if (label === "Outreach") return Send;
  if (label === "Analytics") return BarChart3;
  if (label === "Settings") return Settings;
  return CircleDot;
};

export default function DeveloperNavigation() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const [isSidebarHovering, setIsSidebarHovering] = useState(false);
  const isSidebarExpanded = isSidebarPinned || isSidebarHovering;
  const profile = (user as any)?.developerProfile;
  const tabs = profile?.profileType === "general_sales"
    ? realEstateTabs.filter((tab) => tab.href !== "/developer/dashboard")
    : realEstateTabs.filter((tab) => tab.href !== "/developer/pipeline");
  const companyName = profile?.companyName || "LandLinq";
  const logoUrl = profile?.logoUrl || "/assets/landlinq-white-logo.png";

  useEffect(() => {
    document.body.dataset.appSidebar = "true";
    return () => {
      delete document.body.dataset.appSidebar;
    };
  }, []);

  const navigateTo = (href: string) => {
    preloadRoute(href);
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <nav
        className="relative sticky top-0 z-50 border-b border-slate-800 bg-[#081729] shadow-lg md:fixed md:inset-y-0 md:left-0 md:border-0 md:bg-transparent md:shadow-none"
        aria-label="Developer navigation"
      >
      <aside
        className={`pointer-events-auto fixed inset-y-0 left-0 z-50 hidden flex-col border-r border-slate-700/80 bg-[#081729] shadow-xl transition-[width] duration-300 md:flex ${
          isSidebarExpanded ? "w-64" : "w-[4.5rem]"
        }`}
        onMouseEnter={() => setIsSidebarHovering(true)}
        onMouseLeave={() => setIsSidebarHovering(false)}
        onFocusCapture={() => setIsSidebarHovering(true)}
        aria-label="Developer sidebar"
      >
        <div className={`relative flex h-20 items-center border-b border-white/10 ${isSidebarExpanded ? "justify-between px-4" : "justify-center px-2"}`}>
          <Link href="/" className="flex min-w-0 items-center gap-2" aria-label={`${companyName} home`} title={`${companyName} home`}>
            <img
              src={logoUrl}
              alt={profile?.logoUrl ? `${companyName} logo` : "LandLinq"}
              className={`h-10 w-auto object-contain transition-all ${isSidebarExpanded ? "max-w-[170px]" : "max-w-9"}`}
              data-testid="developer-header-logo"
            />
          </Link>
          {isSidebarExpanded ? (
            <button
              type="button"
              className="rounded-md p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              onClick={() => setIsSidebarPinned((pinned) => !pinned)}
              aria-label={isSidebarPinned ? "Collapse navigation sidebar" : "Keep navigation sidebar expanded"}
              aria-expanded={isSidebarPinned}
              data-testid="button-sidebar-toggle"
            >
              {isSidebarPinned ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </button>
          ) : (
            <button
              type="button"
              className="absolute bottom-1.5 right-1.5 rounded-md p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              onClick={() => setIsSidebarPinned(true)}
              aria-label="Expand navigation sidebar"
              title="Expand navigation sidebar"
              data-testid="button-sidebar-toggle"
            >
              <PanelLeftOpen className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-4">
          <div className="space-y-1">
            {tabs.map((tab) => {
              const Icon = iconForTab(tab.label);
              const isActive = location === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`group flex items-center rounded-md py-2.5 text-sm font-medium transition-colors ${
                    isSidebarExpanded ? "gap-3 px-3" : "justify-center px-2"
                  } ${isActive ? "bg-white/10 text-cyan-300" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}
                  onMouseEnter={() => preloadRoute(tab.href)}
                  onFocus={() => preloadRoute(tab.href)}
                  onTouchStart={() => preloadRoute(tab.href)}
                  data-testid={`nav-link-${tab.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                  title={tab.label}
                  aria-label={tab.label}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className={isSidebarExpanded ? "truncate" : "sr-only"}>{tab.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="border-t border-white/10 p-2">
          <Button
            onClick={() => logout?.()}
            data-testid="button-logout"
            size="sm"
            className={isSidebarExpanded ? "w-full justify-start gap-3 px-3" : "mx-auto flex w-10 justify-center px-0"}
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className={isSidebarExpanded ? "" : "sr-only"}>Sign Out</span>
          </Button>
        </div>
      </aside>

      <div className="relative mx-auto max-w-7xl px-3 sm:px-4 lg:px-6 md:hidden">
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
      <DeveloperAssistantChat />
    </>
  );
}