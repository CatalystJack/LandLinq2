const AUTH_REQUIRED_WORKSPACE_PATHS = new Set([
  "/dashboard",
  "/analytics",
  "/outreach-analytics",
  "/outreach-onboarding",
]);

export function isProtectedWorkspacePath(pathname: string): boolean {
  const normalizedPathname = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (/^\/developer\/[^/]+\/login$/.test(normalizedPathname)) return false;
  return AUTH_REQUIRED_WORKSPACE_PATHS.has(normalizedPathname) ||
    normalizedPathname.startsWith("/developer/");
}