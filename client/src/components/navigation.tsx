import { useAuth, UserRole } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { Menu, X, ChevronDown } from "lucide-react";
import { useState, useMemo, memo } from "react";
import { AuthModal } from "@/components/auth-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const landlinqWhiteLogo = "/assets/landlinq-white-logo.png";

interface NavigationProps {
  onOpenSlideForm?: () => void;
}

function Navigation({ onOpenSlideForm }: NavigationProps) {
  const { user, isAuthenticated, logout, userRole, hasPermission, isRole } = useAuth();
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const handleLogout = () => {
    if (logout) {
      logout();
    }
  };

  // Memoized user email to prevent object reference changes
  // FIX (Dec 15, 2025): Support both OIDC auth (user.claims.email) and traditional auth (user.email)
  const userEmail = useMemo(() => (user as any)?.claims?.email || (user as any)?.email || '', [user]);
  
  // Check if user is an analyst (only @catalystcp.com emails AND authenticated)
  let isAnalyst = isAuthenticated && userEmail.includes('@catalystcp.com');

  // Categorized navigation for dropdown menus
  const { catalystNav, landlinqNav, publicNav } = useMemo(() => {
    const catalyst: any[] = [];
    const landlinq: any[] = [];
    const publicItems: any[] = [];
    
    // Public navigation (unauthenticated users)
    if (!isAuthenticated) {
      publicItems.push(
        { name: "Home", href: "/", description: "Welcome to LandLinq" },
        { name: "About", href: "/about", description: "Learn about our platform" },
        { name: "Process", href: "/process", description: "Our deal evaluation process" },
        { name: "Criteria", href: "/criteria", description: "What we look for in deals" },
        { name: "Blogs", href: "https://www.catalystcp.com/blogs/", description: "Read our blog posts", external: true },
        { name: "Developers", href: "/developer-network", description: "Register your buy box criteria" },
        { name: "Brokers", href: "/broker-network", description: "Join our partner broker program" },
        { name: "Submit a Deal", href: "/submit-deal", description: "Submit a land deal" }
      );
      return { catalystNav: catalyst, landlinqNav: landlinq, publicNav: publicItems };
    }
    
    // Catalyst = External tools (third-party links from Launchpad)
    // LandLinq = Internal platform features
    switch (userRole) {
      case UserRole.SUPER_ADMIN:
      case UserRole.ADMIN:
        // Catalyst = External Tools (links to third-party sites)
        catalyst.push(
          { name: "Catalyst Website", href: "https://www.catalystcp.com", description: "Company website", external: true },
          { name: "SharePoint", href: "https://catalystcp.sharepoint.com", description: "Team files & documents", external: true },
          { name: "ClickUp", href: "https://app.clickup.com", description: "Project management", external: true },
          { name: "HubSpot", href: "https://app.hubspot.com", description: "CRM & contacts", external: true },
          { name: "Northspyre", href: "https://app.northspyre.com", description: "Development project management", external: true },
          { name: "Outlook Calendar", href: "https://outlook.office.com/calendar", description: "Schedule & meetings", external: true },
          { name: "Outlook Mail", href: "https://outlook.office.com/mail", description: "Email inbox", external: true },
          { name: "CoStar", href: "https://www.costar.com", description: "Commercial real estate data", external: true },
          { name: "ESRI / ArcGIS", href: "https://www.arcgis.com", description: "Mapping & GIS analytics", external: true },
          { name: "Google News", href: "https://news.google.com", description: "Latest headlines", external: true },
          { name: "Bloomberg Markets", href: "https://www.bloomberg.com/markets", description: "Financial news & data", external: true }
        );
        // LandLinq = Internal Platform Features
        landlinq.push(
          { name: userEmail.toLowerCase().endsWith('@apexresi.com') ? "Platform Overview" : "Deal Dashboard", href: "/dashboard", description: userEmail.toLowerCase().endsWith('@apexresi.com') ? "Parent view across all Investment Companies and developers" : "Review and manage incoming deals" },
          { name: "Email Intake", href: "/email-intake", description: "Review AI-parsed deal emails before approval" },
          { name: "AI Training", href: "/ai-training", description: "Train AI on pipeline review sessions" },
          { name: "CRM", href: "/crm", description: "Contact management & campaign outreach" },
          { name: "Developers", href: "/partner-developers", description: "Registered developer buy boxes & deal routing" },
          { name: "Partner Brokers", href: "/partner-brokers-admin", description: "Broker portal accounts & market access" },
          { name: "Messaging", href: "/messaging", description: "Two-way SMS conversations" },
          { name: "People", href: "/user-management", description: "Manage users and brokers" },
          { name: "Outreach", href: "/outreach-management", description: "Email & SMS campaign templates" },
          { name: "Outreach Analytics", href: "/outreach-analytics", description: "Emails sent, open rates & sender health" },
          { name: "Outreach Setup", href: "/outreach-onboarding", description: "Configure senders & campaigns" },
          { name: "LIHTC Scoring", href: "/affordable-housing", description: "NC affordable housing pre-scorer" },
          { name: userEmail.toLowerCase().endsWith('@apexresi.com') ? "Data Warehouse" : "Data Hub", href: "/data-hub", description: "Market intelligence, deal data, and broker analytics" },
          { name: "LoopNet Review", href: "/listing-review", description: "Review for-sale listings in your markets" },
          { name: "Analytics", href: "/analytics", description: "Performance metrics & charts" },
          { name: "API Monitoring", href: "/api-monitoring", description: "Track API health & costs" }
        );
        if (userEmail.toLowerCase().endsWith('@apexresi.com')) {
          landlinq.push({
            name: "Investment Companies",
            href: "/admin/investment-companies",
            description: "Create company portals, criteria, and initial logins",
          });
          landlinq.push({
            name: "Master Pipeline",
            href: "/admin/master-pipeline",
            description: "View deal activity across every Investment Company",
          });
        }
        break;
        
      case UserRole.ANALYST:
      case UserRole.DEVELOPER:
      case UserRole.PARTNER:
        // Catalyst = External Tools
        catalyst.push(
          { name: "Catalyst Website", href: "https://www.catalystcp.com", description: "Company website", external: true },
          { name: "SharePoint", href: "https://catalystcp.sharepoint.com", description: "Team files & documents", external: true },
          { name: "ClickUp", href: "https://app.clickup.com", description: "Project management", external: true },
          { name: "HubSpot", href: "https://app.hubspot.com", description: "CRM & contacts", external: true },
          { name: "CoStar", href: "https://www.costar.com", description: "Commercial real estate data", external: true }
        );
        // LandLinq = Internal Platform Features
        landlinq.push(
          { name: "Deal Dashboard", href: "/dashboard", description: "Deal queue and pending reviews" },
          { name: "Messaging", href: "/messaging", description: "Two-way SMS conversations" },
          { name: "Data Hub", href: "/data-hub", description: "Market intelligence & insights" },
          { name: "LoopNet Review", href: "/listing-review", description: "Review for-sale listings in your markets" },
          { name: "Analytics", href: "/analytics", description: "Performance metrics" },
          { name: "LIHTC Scoring", href: "/affordable-housing", description: "NC affordable housing pre-scorer" }
        );
        // Show outreach features for specific users
        if (userEmail === 'jack@catalystcp.com') {
          landlinq.push(
            { name: "Outreach", href: "/outreach-management", description: "Email & SMS campaign templates" },
            { name: "Outreach Analytics", href: "/outreach-analytics", description: "Emails sent, open rates & sender health" }
          );
        }
        // Show Outreach Setup for email senders (so they can connect their Outlook)
        if (['aj@catalystcp.com', 'ford@catalystcp.com', 'ted@catalystcp.com'].includes(userEmail.toLowerCase())) {
          landlinq.push(
            { name: "Outreach Setup", href: "/outreach-onboarding", description: "Connect your Outlook account" }
          );
        }
        break;
        
      case UserRole.BROKER:
        // Brokers see simplified navigation
        landlinq.push(
          { name: "My Deals", href: "/dashboard", description: "Overview of submitted deals" },
          { name: "Submit Deal", href: "/submit-deal", description: "Submit new properties" },
          { name: "Process", href: "/process", description: "Our deal evaluation process" }
        );
        // Show Outreach Setup for email senders (so they can connect their Outlook)
        if (['aj@catalystcp.com', 'ford@catalystcp.com', 'ted@catalystcp.com'].includes(userEmail.toLowerCase())) {
          landlinq.push(
            { name: "Outreach Setup", href: "/outreach-onboarding", description: "Connect your Outlook account" }
          );
        }
        break;
        
      case UserRole.DEMO:
        // Demo users: no nav items — only the deal dashboard via the banner CTA
        break;

      case UserRole.VIEWER:
        landlinq.push(
          { name: "Deals", href: "/view-deals", description: "View deals" },
          { name: "Reports", href: "/reports", description: "View reports" }
        );
        break;
        
      default:
        landlinq.push(
          { name: "Deals", href: "/dashboard", description: "Dashboard" }
        );
    }
    
    // Investment Company users stay inside their branded LandLinq view and
    // should not see Catalyst's external-tools tab.
    return {
      catalystNav: userRole === UserRole.DEVELOPER ? [] : catalyst,
      landlinqNav: landlinq,
      publicNav: publicItems,
    };
  }, [userRole, isAuthenticated, userEmail]);
  
  // Combined navigation for mobile menu
  const navigation = useMemo(() => {
    if (!isAuthenticated) return publicNav;
    return [...catalystNav, ...landlinqNav];
  }, [catalystNav, landlinqNav, publicNav, isAuthenticated]);

  return (
    <nav className="relative border-b border-slate-800 sticky top-0 z-50 shadow-lg" style={{ backgroundColor: '#081729' }}>
      <div className="relative max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Left side - Logo */}
          <div className="flex items-center flex-shrink-0">
            <Link href="/" className="flex items-center gap-1.5">
              {isAuthenticated ? (
                <img
                  src={landlinqWhiteLogo}
                  alt="LandLinq"
                  className="h-9 sm:h-10 lg:h-12 w-auto max-w-[190px] object-contain"
                  data-testid="logo-landlinq"
                />
              ) : (
                <img
                  src={landlinqWhiteLogo}
                  alt="LandLinq"
                  className="h-9 sm:h-10 lg:h-12 w-auto max-w-[190px] object-contain"
                  data-testid="logo-landlinq"
                />
              )}
            </Link>
          </div>
          
          {/* Right side navigation */}
          <div className="flex items-center">

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-2 lg:space-x-4 relative">
            {/* Public navigation - flat links */}
            {!isAuthenticated && publicNav.map((item: any) => {
              const isActive = location === item.href;
              const isSubmitButton = item.name.toLowerCase().includes('submit');
              const isExternal = item.external === true;
              
              if (isSubmitButton && onOpenSlideForm) {
                return (
                  <Button
                    key={item.name}
                    onClick={onOpenSlideForm}
                    className="bg-white hover:bg-[#081729] text-[#081729] hover:text-cyan-300 border-2 border-white hover:border-white font-semibold transition-all duration-300"
                    size="sm"
                    data-testid={`nav-button-${item.name.toLowerCase().replace(/ /g, "-")}`}
                    title={item.description}
                  >
                    {item.name}
                  </Button>
                );
              } else if (isSubmitButton) {
                return (
                  <Link key={item.name} href={item.href}>
                    <Button
                      className="bg-white hover:bg-[#081729] text-[#081729] hover:text-cyan-300 border-2 border-white hover:border-white font-semibold transition-all duration-300"
                      size="sm"
                      data-testid={`nav-button-${item.name.toLowerCase().replace(/ /g, "-")}`}
                      title={item.description}
                    >
                      {item.name}
                    </Button>
                  </Link>
                );
              }
              
              if (isExternal) {
                return (
                  <a
                    key={item.name}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2 px-2 lg:px-3 text-sm font-medium transition-colors relative rounded-md text-white hover:text-[#4A90E2]"
                    data-testid={`nav-link-${item.name.toLowerCase().replace(/ /g, "-")}`}
                    title={item.description}
                  >
                    {item.name}
                  </a>
                );
              }
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  data-nav-item={item.href}
                  className={`py-2 px-2 lg:px-3 text-sm font-medium transition-colors relative rounded-md ${
                    isActive
                      ? "text-catalyst-gold"
                      : "text-white hover:text-[#4A90E2]"
                  }`}
                  data-testid={`nav-link-${item.name.toLowerCase().replace(/ /g, "-")}`}
                  title={item.description}
                >
                  {item.name}
                </Link>
              );
            })}
            
            {/* Authenticated navigation - dropdown menus */}
            {isAuthenticated && catalystNav.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1 py-2 px-3 text-sm font-medium text-white hover:text-[#4A90E2] transition-colors rounded-md focus:outline-none">
                    Catalyst
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 bg-white border-slate-200 shadow-lg max-h-80 overflow-y-auto">
                  {catalystNav.map((item: any) => (
                    <DropdownMenuItem key={item.name} asChild className="focus:bg-blue-100 hover:bg-blue-100 cursor-pointer">
                      {item.external ? (
                        <a 
                          href={item.href} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="w-full text-slate-800 hover:text-blue-600 flex items-center justify-between"
                        >
                          {item.name}
                          <span className="text-xs text-slate-400 ml-2">↗</span>
                        </a>
                      ) : (
                        <Link href={item.href} className="w-full text-slate-800 hover:text-blue-600">
                          {item.name}
                        </Link>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            {isAuthenticated && landlinqNav.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1 py-2 px-3 text-sm font-medium text-white hover:text-[#4A90E2] transition-colors rounded-md focus:outline-none">
                    LandLinq
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 bg-white border-slate-200 shadow-lg max-h-80 overflow-y-auto">
                  {landlinqNav.map((item: any) => (
                    <DropdownMenuItem key={item.name} asChild className="focus:bg-blue-100 hover:bg-blue-100 cursor-pointer">
                      <Link href={item.href} className="w-full text-slate-800 hover:text-blue-600">
                        {item.name}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            {isAuthenticated ? (
              <div className="flex items-center space-x-2 lg:space-x-4">
                <Button
                  onClick={handleLogout}
                  data-testid="button-logout"
                  size="sm"
                >
                  <span className="hidden lg:inline">Sign Out</span>
                  <span className="lg:hidden">Out</span>
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={() => setIsAuthModalOpen(true)}
                data-testid="button-auth"
              >
                <span className="hidden sm:inline">Sign In/Up</span>
                <span className="sm:hidden">Auth</span>
              </Button>
            )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
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

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-slate-700 py-4">
            <div className="flex flex-col space-y-2 px-4">
              {navigation.map((item: any) => {
                const isActive = location === item.href;
                const isSubmitButton = item.name.toLowerCase().includes('submit');
                const isExternal = item.external === true;
                
                if (isSubmitButton && onOpenSlideForm) {
                  return (
                    <Button
                      key={item.name}
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onOpenSlideForm();
                      }}
                      className="w-full bg-white hover:bg-[#4A90E2] text-[#4A90E2] hover:text-cyan-300 border-2 border-white hover:border-white font-semibold transition-all duration-300"
                      data-testid={`mobile-nav-button-${item.name.toLowerCase().replace(/ /g, "-")}`}
                    >
                      {item.name}
                    </Button>
                  );
                } else if (isSubmitButton) {
                  return (
                    <Link key={item.name} href={item.href} className="w-full">
                      <Button
                        className="w-full bg-white hover:bg-[#4A90E2] text-[#4A90E2] hover:text-cyan-300 border-2 border-white hover:border-white font-semibold transition-all duration-300"
                        data-testid={`mobile-nav-button-${item.name.toLowerCase().replace(/ /g, "-")}`}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {item.name}
                      </Button>
                    </Link>
                  );
                }
                
                // Handle external links with regular anchor tag
                if (isExternal) {
                  return (
                    <a
                      key={item.name}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full text-center px-4 py-3 rounded-lg text-sm font-medium transition-colors text-slate-300 hover:text-cyan-300"
                      onClick={() => setIsMobileMenuOpen(false)}
                      data-testid={`mobile-nav-link-${item.name.toLowerCase().replace(/ /g, "-")}`}
                    >
                      {item.name}
                    </a>
                  );
                }
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`w-full text-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "text-white"
                        : "text-slate-300 hover:text-white"
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    data-testid={`mobile-nav-link-${item.name.toLowerCase().replace(/ /g, "-")}`}
                  >
                    {item.name}
                  </Link>
                );
              })}
              <div className="w-full pt-4 border-t border-slate-700">
                {isAuthenticated ? (
                  <div className="space-y-3">
                    <Button
                      onClick={handleLogout}
                      className="w-full"
                      data-testid="mobile-button-logout"
                    >
                      Sign Out
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="w-full"
                    data-testid="mobile-button-auth"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setIsAuthModalOpen(true);
                    }}
                  >
                    Sign In/Up
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />
    </nav>
  );
}

export default memo(Navigation);
