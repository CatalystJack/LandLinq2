import { Suspense, lazy } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { DevLogin } from "./components/dev-login";
import { useAuth, UserRole } from "@/hooks/useAuth";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import ErrorBoundary from "@/components/error-boundary";
import { Loader2 } from "lucide-react";
import { ClassificationProgress } from "@/components/ClassificationProgress";

// ============================================
// CODE SPLITTING OPTIMIZATION - Jan 5, 2026
// Only load essential public pages immediately
// All admin/analyst pages are lazy loaded
// ============================================

// Core public pages - loaded immediately (small bundle)
import AuthPage from "@/pages/auth";
import NotFound from "@/pages/not-found";
import ErrorPage from "@/pages/error-page";
import PortalChooser from "@/pages/portal-chooser";
import Landing from "@/pages/landing";

// Lazy load ALL other pages to reduce initial bundle size
const Home = lazy(() => import("@/pages/home"));
const MySubmissions = lazy(() => import("@/pages/my-submissions"));
const Privacy = lazy(() => import("@/pages/privacy"));
const Terms = lazy(() => import("@/pages/terms"));
const DealDetails = lazy(() => import("@/pages/deal-details"));
const UnsubscribePage = lazy(() => import("@/pages/unsubscribe"));
const SMSOptIn = lazy(() => import("@/pages/sms-opt-in"));

// Heavy analyst/admin pages - always lazy loaded
const AnalystDashboard = lazy(() => import("@/pages/analyst-dashboard"));
const AnalystDashboardV2 = lazy(() => import("@/pages/analyst-dashboard-v2"));
const AdminDashboard = lazy(() => import("@/pages/admin-dashboard"));
const SendGridDebugger = lazy(() => import("@/pages/sendgrid-debugger"));
const UserManagement = lazy(() => import("@/pages/user-management"));
const OutreachManagement = lazy(() => import("@/pages/outreach-management"));
const OutreachOnboarding = lazy(() => import("@/pages/outreach-onboarding"));
const DataQualityDashboard = lazy(() => import("@/pages/data-quality-dashboard"));
const BrokerManagement = lazy(() => import("@/pages/broker-management"));
const CRMPage = lazy(() => import("@/pages/crm"));
const PartnerDevelopersAdmin = lazy(() => import("@/pages/partner-developers-admin"));
const PartnerBrokersAdmin = lazy(() => import("@/pages/partner-brokers-admin"));
const ApiMonitoring = lazy(() => import("@/pages/api-monitoring"));
const MessagingPage = lazy(() => import("@/pages/messaging"));
const ExecutiveDashboard = lazy(() => import("@/pages/executive-dashboard"));
const AffordableHousingScoring = lazy(() => import("@/pages/affordable-housing-scoring"));
const DataHub = lazy(() => import("@/pages/data-hub"));
const AnalystCommandCenter = lazy(() => import("@/pages/analyst-command-center"));
const EmailIntakePage = lazy(() => import("@/pages/email-intake"));
const AnalystLogin = lazy(() => import("@/pages/analyst-login"));
const AnalyticsPage = lazy(() => import("@/pages/analytics-page"));
const ManualEmail = lazy(() => import("@/pages/manual-email"));
const PasswordReset = lazy(() => import("@/pages/password-reset"));
const EmailPreview = lazy(() => import("@/pages/email-preview"));
const TemplateEditor = lazy(() => import("@/pages/template-editor"));
const GamificationPage = lazy(() => import("@/pages/gamification-page"));
const AcquisitionCriteriaPage = lazy(() => import("@/pages/acquisition-criteria"));
const DatabaseManagement = lazy(() => import("@/pages/database-management"));
const LandLinqDiscovery = lazy(() => import("@/pages/landlinq-discovery"));
const ListingReview = lazy(() => import("@/pages/listing-review"));
const AITraining = lazy(() => import("@/pages/ai-training"));
const ViewDeals = lazy(() => import("@/pages/view-deals"));
const Reports = lazy(() => import("@/pages/reports"));
const AnalystReviewQueue = lazy(() => import("@/pages/analyst-review-queue"));
const Underwriting = lazy(() => import("@/pages/underwriting"));
const Launchpad = lazy(() => import("@/pages/launchpad"));
const QuickAddDeal = lazy(() => import("@/pages/quick-add-deal"));
const TaxScraper = lazy(() => import("@/pages/tax-scraper"));
const RssFeeds = lazy(() => import("@/pages/rss-feeds"));
const OffMarketSourcing = lazy(() => import("@/pages/off-market-sourcing"));
const OutreachAnalytics = lazy(() => import("@/pages/outreach-analytics"));
const MarketIntelligence = lazy(() => import("@/pages/market-intelligence"));
const ApiKeysAdmin = lazy(() => import("@/pages/api-keys-admin"));
const AdminInvestmentCompanies = lazy(() => import("@/pages/admin-investment-companies"));
const MasterPipeline = lazy(() => import("@/pages/master-pipeline"));
const DeveloperDashboard = lazy(() => import("@/pages/developer-dashboard"));
const DeveloperCrm = lazy(() => import("@/pages/developer-crm"));
const DeveloperOutreach = lazy(() => import("@/pages/developer-outreach"));
const DeveloperPipeline = lazy(() => import("@/pages/developer-pipeline"));
const DeveloperAnalytics = lazy(() => import("@/pages/developer-analytics"));
const DeveloperUserManagement = lazy(() => import("@/pages/developer-user-management"));
const DeveloperCriteriaSettings = lazy(() => import("@/pages/developer-criteria-settings"));
const DeveloperLogin = lazy(() => import("@/pages/developer-login"));

// Loading component for lazy-loaded routes
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
    <div className="flex flex-col items-center space-y-4">
      <Loader2 className="h-8 w-8 animate-spin text-catalyst-navy" />
      <p className="text-sm text-gray-600">Loading...</p>
    </div>
  </div>
);

function Router() {
  const { isAuthenticated, isLoading, user, userRole } = useAuth();
  // Automatically scroll to top on route changes
  useScrollToTop();

  // ── DEMO MODE — locked to deal dashboard only, no internal tools ──────────
  if (isAuthenticated && user && userRole === UserRole.DEMO) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <Switch>
          {/* Auth pages so the demo user can log out */}
          <Route path="/auth" component={AuthPage} />
          <Route path="/login" component={AuthPage} />
          <Route path="/" component={PortalChooser} />
          {/* Everything else → analyst dashboard (scoped to demo deals) */}
          <Route>
            {() => (
              <div className="relative">
                {/* Demo banner */}
                <div className="w-full bg-amber-500 text-white text-center text-sm font-semibold py-2 px-4 z-50 sticky top-0">
                  🚀 Demo Mode — you're viewing sample NC deals. <a href="/auth" className="underline ml-2">Sign in for full access →</a>
                </div>
                <AnalystDashboard />
              </div>
            )}
          </Route>
        </Switch>
      </Suspense>
    );
  }

  const authenticatedEmail = String((user as any)?.claims?.email || (user as any)?.email || "").toLowerCase();
  if (
    isAuthenticated &&
    user &&
    authenticatedEmail.endsWith("@apexresi.com") &&
    ["/admin/investment-companies", "/admin/master-pipeline"].includes(window.location.pathname)
  ) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <Switch>
          <Route path="/admin/investment-companies" component={AdminInvestmentCompanies} />
          <Route path="/admin/master-pipeline" component={MasterPipeline} />
        </Switch>
      </Suspense>
    );
  }

  // DEVELOPER users have a separate tenant-scoped navigation and route surface.
  // Keep this branch before all internal role branches so they cannot fall
  // through to the shared Catalyst navigation.
  if (isAuthenticated && user && userRole === UserRole.DEVELOPER) {
    if ((user as any).mustResetPassword === true) {
      return (
        <Suspense fallback={<LoadingFallback />}>
          <Switch>
            <Route path="/reset-password" component={PasswordReset} />
            <Route>
              {() => {
                window.location.replace("/reset-password");
                return <LoadingFallback />;
              }}
            </Route>
          </Switch>
        </Suspense>
      );
    }
    return (
      <Suspense fallback={<LoadingFallback />}>
        <Switch>
          <Route path="/developer/dashboard" component={() => {
            if ((user as any)?.developerProfile?.profileType === "general_sales") {
              window.location.replace("/developer/crm");
              return <LoadingFallback />;
            }
            return <DeveloperDashboard />;
          }} />
          <Route path="/developer/crm" component={DeveloperCrm} />
          <Route path="/developer/outreach" component={DeveloperOutreach} />
          <Route path="/developer/pipeline" component={DeveloperPipeline} />
          <Route path="/developer/analytics" component={DeveloperAnalytics} />
          <Route path="/developer/user-management" component={DeveloperUserManagement} />
          <Route path="/developer/settings" component={DeveloperCriteriaSettings} />
          <Route>
            {() => {
              const home = (user as any)?.developerProfile?.profileType === "general_sales"
                ? "/developer/crm"
                : "/developer/dashboard";
              window.location.replace(home);
              return <LoadingFallback />;
            }}
          </Route>
        </Switch>
      </Suspense>
    );
  }

  // UNIFIED DASHBOARD: SUPER_ADMIN, ADMIN, and ANALYST all see the same dashboard
  if (isAuthenticated && user && (userRole === UserRole.SUPER_ADMIN || userRole === UserRole.ADMIN || userRole === UserRole.ANALYST)) {
    const userEmail = (user as any)?.claims?.email || (user as any)?.email || '';
    return (
      <Suspense fallback={<LoadingFallback />}>
        <Switch>
          {/* Admin/Analyst shared routes - all lazy loaded */}
          <Route path="/executive" component={ExecutiveDashboard} />
          <Route path="/affordable-housing" component={AffordableHousingScoring} />
          <Route path="/data-hub" component={DataHub} />
          <Route path="/listing-review" component={ListingReview} />
          <Route path="/analytics" component={AnalyticsPage} />
          <Route path="/api-monitoring" component={ApiMonitoring} />
          <Route path="/messaging" component={MessagingPage} />
          <Route path="/ai-training" component={AITraining} />
          <Route path="/email-preview" component={EmailPreview} />
          <Route path="/email-builder" component={TemplateEditor} />
          <Route path="/sendgrid-debugger" component={SendGridDebugger} />
          <Route path="/auth" component={AuthPage} />
          <Route path="/login" component={AuthPage} />
          <Route path="/signup" component={AuthPage} />
          <Route path="/user-management" component={UserManagement} />
          <Route path="/outreach-management" component={OutreachManagement} />
          <Route path="/outreach-analytics" component={OutreachAnalytics} />
          <Route path="/outreach-onboarding" component={OutreachOnboarding} />
          <Route path="/broker-management" component={BrokerManagement} />
          <Route path="/crm" component={CRMPage} />
          <Route path="/partner-developers" component={() => (
            <Suspense fallback={<LoadingFallback />}>
              <PartnerDevelopersAdmin />
            </Suspense>
          )} />
          <Route path="/partner-brokers-admin" component={() => (
            <Suspense fallback={<LoadingFallback />}>
              <PartnerBrokersAdmin />
            </Suspense>
          )} />
          <Route path="/tools/valuation" component={() => {
            const LandValuationPage = lazy(() => import("@/pages/land-valuation-page"));
            return (
              <Suspense fallback={<LoadingFallback />}>
                <LandValuationPage />
              </Suspense>
            );
          }} />
          <Route path="/launchpad" component={Launchpad} />
          <Route path="/tax-scraper" component={TaxScraper} />
          <Route path="/rss-feeds" component={RssFeeds} />
          <Route path="/off-market-sourcing" component={OffMarketSourcing} />
          <Route path="/market-intelligence" component={MarketIntelligence} />
          <Route path="/api-keys" component={ApiKeysAdmin} />
          <Route path="/underwriting" component={Underwriting} />
          <Route path="/email-intake" component={EmailIntakePage} />
          <Route path="/dashboard" component={() => {
            const userEmail = String((user as any)?.claims?.email || (user as any)?.email || '').toLowerCase();
            return userEmail.endsWith('@apexresi.com') ? <ExecutiveDashboard /> : <AnalystDashboard />;
          }} />
          <Route path="/dashboard-v2" component={AnalystDashboardV2} />
          <Route path="/" component={PortalChooser} />
          {/* Catch all other routes - redirect to main dashboard */}
          <Route>
            {() => <AnalystDashboard />}
          </Route>
        </Switch>
      </Suspense>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-catalyst-gold mx-auto"></div>
          <p className="mt-2 text-catalyst-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Switch>
        {/* Auth pages always accessible */}
        <Route path="/auth" component={AuthPage} />
        <Route path="/login" component={AuthPage} />
        <Route path="/signup" component={AuthPage} />
        <Route path="/developer/:slug/login" component={DeveloperLogin} />
        <Route path="/analyst-login" component={AnalystLogin} />
        <Route path="/reset-password" component={PasswordReset} />
        <Route path="/test" component={() => <div className="p-8 text-center"><h1 className="text-2xl">Test Route Works!</h1></div>} />
        
        {/* Public routes that must remain reachable without authentication */}
        <Route path="/privacy" component={Privacy} />
        <Route path="/terms" component={Terms} />
        <Route path="/deals/:id" component={DealDetails} />
        <Route path="/unsubscribe" component={UnsubscribePage} />
        <Route path="/sms-opt-in" component={SMSOptIn} />
        <Route path="/tools/valuation" component={() => {
          const LandValuationPage = lazy(() => import("@/pages/land-valuation-page"));
          return (
            <Suspense fallback={<LoadingFallback />}>
              <LandValuationPage />
            </Suspense>
          );
        }} />
      
      {/* Broker-only routes */}
      <Route path="/landlinq-discovery" component={() => {
        if (!isAuthenticated) {
          return <Landing />;
        }
        // Block @catalystcp.com emails from broker tools
        if (user) {
          const userEmail = (user as any)?.claims?.email || (user as any)?.email || '';
          if (userEmail.endsWith('@catalystcp.com')) {
            window.location.href = '/analytics';
            return <div className="p-8 text-center">Redirecting to analytics...</div>;
          }
        }
        return <LandLinqDiscovery />;
      }} />
      
      {/* Dashboard - analyst dashboard for @catalystcp.com, broker dashboard for others */}
      <Route path="/dashboard" component={() => {
        if (!isAuthenticated) {
          return <Landing />;
        }
        // Redirect analysts to their single dashboard
        if (user) {
          const userEmail = (user as any)?.claims?.email || (user as any)?.email || '';
          if (userEmail.endsWith('@catalystcp.com')) {
            return <AnalystDashboard />;
          }
        }
        
        // Show broker dashboard for non-analyst users
        return <MySubmissions />;
      }} />
      
      
      
      {/* Legacy routes - redirect to unified dashboard */}
      <Route path="/my-submissions" component={() => {
        if (!isAuthenticated) {
          return <Landing />;
        }
        // Redirect to unified dashboard
        window.location.href = '/dashboard';
        return <div className="p-8 text-center">Redirecting to dashboard...</div>;
      }} />
      <Route path="/broker-dashboard" component={() => {
        if (!isAuthenticated) {
          return <Landing />;
        }
        // Redirect to unified dashboard
        window.location.href = '/dashboard';
        return <div className="p-8 text-center">Redirecting to dashboard...</div>;
      }} />
      
      {/* All analyst routes redirect to main dashboard */}
      <Route path="/analyst-dashboard" component={() => {
        if (isAuthenticated && user) {
          const userEmail = (user as any)?.claims?.email || (user as any)?.email || '';
          
          // Allow @catalystcp.com emails to access main analyst dashboard
          if (userEmail.endsWith('@catalystcp.com')) {
            return <AnalystDashboard />;
          } else {
            // Brokers trying to access analyst dashboard get redirected to broker dashboard
            window.location.href = '/dashboard';
            return <div className="p-8 text-center">Redirecting to your dashboard...</div>;
          }
        }
        return <Landing />;
      }} />
      
      {/* Add /analyst route for convenience */}
      <Route path="/analyst" component={() => {
        if (isAuthenticated && user) {
          const userEmail = (user as any)?.claims?.email || (user as any)?.email || '';
          
          // Allow @catalystcp.com emails to access main analyst dashboard
          if (userEmail.endsWith('@catalystcp.com')) {
            return <AnalystDashboard />;
          } else {
            // Brokers trying to access analyst dashboard get redirected to broker dashboard
            window.location.href = '/dashboard';
            return <div className="p-8 text-center">Redirecting to your dashboard...</div>;
          }
        }
        return <Landing />;
      }} />
      
      {/* Block access to all other analyst tools and admin pages for non-analysts */}
      <Route path="/command-center" component={() => {
        if (isAuthenticated && user) {
          const userEmail = (user as any)?.claims?.email || (user as any)?.email || '';
          if (userEmail.endsWith('@catalystcp.com')) {
            return <AnalystDashboard />;
          } else {
            window.location.href = '/dashboard';
            return <div className="p-8 text-center">Redirecting to your dashboard...</div>;
          }
        }
        return <Landing />;
      }} />
      
      <Route path="/analytics" component={() => {
        if (isAuthenticated && user) {
          const userEmail = (user as any)?.claims?.email || (user as any)?.email || '';
          if (userEmail.endsWith('@catalystcp.com')) {
            return <AnalyticsPage />;
          } else {
            window.location.href = '/dashboard';
            return <div className="p-8 text-center">Redirecting to your dashboard...</div>;
          }
        }
        return <Landing />;
      }} />
      
      <Route path="/outreach-onboarding" component={() => {
        if (isAuthenticated && user) {
          const userEmail = (user as any)?.claims?.email || (user as any)?.email || '';
          if (userEmail.endsWith('@catalystcp.com')) {
            return <OutreachOnboarding />;
          } else {
            window.location.href = '/dashboard';
            return <div className="p-8 text-center">Redirecting to your dashboard...</div>;
          }
        }
        return <Landing />;
      }} />

      <Route path="/analyst/review-queue" component={() => {
        if (isAuthenticated && user) {
          const userEmail = (user as any)?.claims?.email || (user as any)?.email || '';
          if (userEmail.endsWith('@catalystcp.com')) {
            return (
              <Suspense fallback={<LoadingFallback />}>
                <AnalystReviewQueue />
              </Suspense>
            );
          } else {
            window.location.href = '/dashboard';
            return <div className="p-8 text-center">Redirecting to your dashboard...</div>;
          }
        }
        return <Landing />;
      }} />


      <Route path="/admin-dashboard" component={() => {
        if (isAuthenticated && user) {
          const userEmail = (user as any)?.claims?.email || (user as any)?.email || '';
          if (userEmail.endsWith('@catalystcp.com')) {
            return <AdminDashboard />;
          } else {
            window.location.href = '/dashboard';
            return <div className="p-8 text-center">Redirecting to your dashboard...</div>;
          }
        }
        return <Landing />;
      }} />

      <Route path="/admin/data-quality" component={() => {
        if (isAuthenticated && user) {
          const userEmail = (user as any)?.claims?.email || (user as any)?.email || '';
          if (userEmail.endsWith('@catalystcp.com') || userEmail.endsWith('@landlinq.ai')) {
            return <DataQualityDashboard />;
          } else {
            window.location.href = '/dashboard';
            return <div className="p-8 text-center">Redirecting to your dashboard...</div>;
          }
        }
        return <Landing />;
      }} />

      <Route path="/api-monitoring" component={() => {
        if (isAuthenticated && user) {
          // Check role first, then fallback to email for legacy compatibility
          const isAdmin = userRole === UserRole.SUPER_ADMIN || userRole === UserRole.ADMIN;
          const userEmail = (user as any)?.claims?.email || (user as any)?.email || '';
          const isLegacyAdmin = userEmail.endsWith('@catalystcp.com') || userEmail.endsWith('@landlinq.ai');
          
          if (isAdmin || isLegacyAdmin) {
            return <ApiMonitoring />;
          } else {
            window.location.href = '/dashboard';
            return <div className="p-8 text-center">Redirecting to your dashboard...</div>;
          }
        }
        return <Landing />;
      }} />

      <Route path="/user-management" component={() => {
        if (isAuthenticated && user) {
          const userEmail = (user as any)?.claims?.email || (user as any)?.email || '';
          if (userEmail.endsWith('@catalystcp.com')) {
            return <UserManagement />;
          } else {
            window.location.href = '/dashboard';
            return <div className="p-8 text-center">Redirecting to your dashboard...</div>;
          }
        }
        return <Landing />;
      }} />

      <Route path="/outreach-management" component={() => {
        if (isAuthenticated && user) {
          // Allow SUPER_ADMIN, ADMIN, and specific users (Jack Berg) to access
          const userEmail = (user as any)?.claims?.email || (user as any)?.email || '';
          if (userRole === UserRole.SUPER_ADMIN || userRole === UserRole.ADMIN || userEmail === 'jack@catalystcp.com') {
            return <OutreachManagement />;
          } else {
            return (
              <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
                <div className="max-w-4xl mx-auto">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <h2 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h2>
                    <p className="text-red-600 mb-4">You need admin privileges to access outreach management and templates.</p>
                    <button 
                      onClick={() => window.location.href = '/'}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Back to Dashboard
                    </button>
                  </div>
                </div>
              </div>
            );
          }
        }
        return <Landing />;
      }} />

      <Route path="/outreach-analytics" component={() => {
        if (isAuthenticated && user) {
          const userEmail = (user as any)?.claims?.email || (user as any)?.email || '';
          if (userRole === UserRole.SUPER_ADMIN || userRole === UserRole.ADMIN || userEmail.endsWith('@catalystcp.com')) {
            return (
              <Suspense fallback={<LoadingFallback />}>
                <OutreachAnalytics />
              </Suspense>
            );
          }
        }
        return <Landing />;
      }} />

      <Route path="/broker-management" component={() => {
        if (isAuthenticated && user) {
          const userEmail = (user as any)?.claims?.email || (user as any)?.email || '';
          if (userRole === UserRole.SUPER_ADMIN || userRole === UserRole.ADMIN || userEmail.endsWith('@catalystcp.com')) {
            return <BrokerManagement />;
          } else {
            return (
              <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
                <div className="max-w-4xl mx-auto">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <h2 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h2>
                    <p className="text-red-600 mb-4">You need admin privileges to access broker management.</p>
                    <button 
                      onClick={() => window.location.href = '/'}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Back to Dashboard
                    </button>
                  </div>
                </div>
              </div>
            );
          }
        }
        return <Landing />;
      }} />

      <Route path="/crm" component={() => {
        if (isAuthenticated && user) {
          const userEmail = (user as any)?.claims?.email || (user as any)?.email || '';
          if (userRole === UserRole.SUPER_ADMIN || userRole === UserRole.ADMIN || userEmail.endsWith('@catalystcp.com')) {
            return <CRMPage />;
          }
        }
        return <Landing />;
      }} />

      <Route path="/partner-developers" component={() => {
        if (isAuthenticated && user) {
          const internalRoles = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ANALYST, UserRole.DEVELOPER, UserRole.PARTNER];
          if (internalRoles.includes(userRole as UserRole)) {
            return (
              <Suspense fallback={<LoadingFallback />}>
                <PartnerDevelopersAdmin />
              </Suspense>
            );
          }
        }
        return <Landing />;
      }} />

      <Route path="/partner-brokers-admin" component={() => {
        if (isAuthenticated && user) {
          const internalRoles = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ANALYST];
          if (internalRoles.includes(userRole as UserRole)) {
            return (
              <Suspense fallback={<LoadingFallback />}>
                <PartnerBrokersAdmin />
              </Suspense>
            );
          }
        }
        return <Landing />;
      }} />

      <Route path="/messaging" component={() => {
        if (isAuthenticated && user) {
          const userEmail = (user as any)?.claims?.email || (user as any)?.email || '';
          if (userRole === UserRole.SUPER_ADMIN || userRole === UserRole.ADMIN || userEmail.endsWith('@catalystcp.com')) {
            return <MessagingPage />;
          } else {
            return (
              <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
                <div className="max-w-4xl mx-auto">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <h2 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h2>
                    <p className="text-red-600 mb-4">You need admin privileges to access the messaging dashboard.</p>
                    <button 
                      onClick={() => window.location.href = '/'}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Back to Dashboard
                    </button>
                  </div>
                </div>
              </div>
            );
          }
        }
        return <Landing />;
      }} />




      {/* Broker-specific routes */}

      {/* Viewer-specific routes */}
      <Route path="/view-deals" component={() => {
        if (!isAuthenticated) {
          return <Landing />;
        }
        return (
          <Suspense fallback={<LoadingFallback />}>
            <ViewDeals />
          </Suspense>
        );
      }} />

      <Route path="/reports" component={() => {
        if (!isAuthenticated) {
          return <Landing />;
        }
        return (
          <Suspense fallback={<LoadingFallback />}>
            <Reports />
          </Suspense>
        );
      }} />
      
      <Route path="/underwriting" component={() => {
        if (!isAuthenticated) {
          return <Landing />;
        }
        return (
          <Suspense fallback={<LoadingFallback />}>
            <Underwriting />
          </Suspense>
        );
      }} />

      {/* Quick Add Deal route - dedicated page for adding deals */}
      <Route path="/add-deal" component={() => {
        if (!isAuthenticated) {
          return <Landing />;
        }
        if (user) {
          const userEmail = (user as any)?.claims?.email || (user as any)?.email || '';
          if (userEmail.endsWith('@catalystcp.com')) {
            return (
              <Suspense fallback={<LoadingFallback />}>
                <QuickAddDeal />
              </Suspense>
            );
          }
        }
        window.location.href = '/dashboard';
        return <div className="p-8 text-center">Redirecting...</div>;
      }} />
      
      {/* Root entry point for both unauthenticated and authenticated visitors */}
      <Route path="/" component={PortalChooser} />
      
        {/* 404 catch-all */}
        {/* Error page */}
        <Route path="/error" component={ErrorPage} />
        
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ErrorBoundary>
          <Router />
        </ErrorBoundary>
        <DevLogin />
        {/* Ultimate Power View removed */}
        <Toaster />
        <ClassificationProgress />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
