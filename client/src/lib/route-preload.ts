type RouteLoader = () => Promise<unknown>;

// Start loading the page chunk before a user clicks. Dynamic imports are
// deduplicated by the browser and Vite, so this does not load a page twice.
const routeLoaders: Record<string, RouteLoader> = {
  // /dashboard resolves to Executive Dashboard for Apex users and Analyst
  // Dashboard for other internal users.
  "/dashboard": () => Promise.all([
    import("@/pages/analyst-dashboard"),
    import("@/pages/executive-dashboard"),
  ]),
  "/crm": () => import("@/pages/crm"),
  "/user-management": () => import("@/pages/user-management"),
  "/outreach-analytics": () => import("@/pages/outreach-analytics"),
  "/outreach-onboarding": () => import("@/pages/outreach-onboarding"),
  "/data-hub": () => import("@/pages/data-hub"),
  "/analytics": () => import("@/pages/analytics-page"),
  "/executive": () => import("@/pages/executive-dashboard"),
  "/admin/master-pipeline": () => import("@/pages/master-pipeline"),
  "/admin/investment-companies": () => import("@/pages/admin-investment-companies"),
  "/developer/dashboard": () => import("@/pages/developer-dashboard"),
  "/developer/crm": () => import("@/pages/developer-crm"),
  "/developer/outreach": () => import("@/pages/developer-outreach"),
  "/developer/pipeline": () => import("@/pages/developer-pipeline"),
  "/developer/analytics": () => import("@/pages/developer-analytics"),
  "/developer/user-management": () => import("@/pages/developer-user-management"),
  "/developer/settings": () => import("@/pages/developer-criteria-settings"),
};

const startedLoads = new Set<string>();

export function preloadRoute(path: string) {
  const loader = routeLoaders[path];
  if (!loader || startedLoads.has(path)) return;
  startedLoads.add(path);
  void loader().catch(() => {
    // The route's normal lazy import will surface any real load failure.
    startedLoads.delete(path);
  });
}