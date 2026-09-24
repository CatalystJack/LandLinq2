import { useEffect, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2, LogIn, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { isPlatformAdminEmail } from "@shared/admin-auth";

type DeveloperBranding = {
  companyName: string;
  primaryColor: string | null;
  secondaryColor: string | null;
};

export default function DeveloperLogin() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/developer/:slug/login");
  const { toast } = useToast();
  const slug = params?.slug || "";
  const [branding, setBranding] = useState<DeveloperBranding | null>(null);
  const [loadingBranding, setLoadingBranding] = useState(true);
  const [brandingError, setBrandingError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Opening a company login is an explicit request to authenticate again.
  // Clear any prior session so this page always requires fresh credentials.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/logout", {
      method: "POST",
      credentials: "include",
    })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          queryClient.removeQueries({ queryKey: ["/api/user"] });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadBranding() {
      setLoadingBranding(true);
      setBrandingError("");
      try {
        const response = await fetch(`/api/developer-profile/by-slug/${encodeURIComponent(slug)}`);
        if (!response.ok) {
          throw new Error(response.status === 404 ? "This company login is unavailable." : "Unable to load company branding.");
        }
        const data = await response.json();
        if (!cancelled) setBranding(data);
      } catch (error) {
        if (!cancelled) {
          setBranding(null);
          setBrandingError(error instanceof Error ? error.message : "Unable to load company branding.");
        }
      } finally {
        if (!cancelled) setLoadingBranding(false);
      }
    }

    if (slug) loadBranding();
    else {
      setBrandingError("This company login is unavailable.");
      setLoadingBranding(false);
    }

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(credentials),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Login failed" }));
        throw new Error(error.message || "Login failed");
      }
      return response.json();
    },
    onSuccess: async (userData) => {
      const isPlatformAdmin = isPlatformAdminEmail(userData?.email);
      if (isPlatformAdmin) {
        queryClient.setQueryData(["/api/user"], userData);
        queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        window.location.replace("/dashboard");
        return;
      }

      if (String(userData?.role || "").toUpperCase() !== "DEVELOPER") {
        await fetch("/api/logout", {
          method: "POST",
          credentials: "include",
        }).catch(() => undefined);
        queryClient.removeQueries({ queryKey: ["/api/user"] });
        toast({
          title: "Investment Company login required",
          description: "This login is for Investment Company users.",
          variant: "destructive",
        });
        return;
      }

      queryClient.setQueryData(["/api/user"], userData);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });

      if (userData.mustResetPassword === true) {
        const token = userData.passwordResetToken;
        if (token) {
          window.location.replace(`/reset-password?token=${encodeURIComponent(token)}&developerSlug=${encodeURIComponent(slug)}`);
        } else {
          window.location.replace("/reset-password");
        }
        return;
      }

      // /api/login intentionally returns only the authenticated user record.
      // Read the tenant profile before choosing the first page so General
      // Sales accounts never land on the real-estate dashboard.
      let profileType = "real_estate";
      try {
        const currentUserResponse = await fetch("/api/user", { credentials: "include" });
        if (currentUserResponse.ok) {
          const currentUser = await currentUserResponse.json();
          profileType = currentUser?.developerProfile?.profileType || "real_estate";
        }
      } catch {
        // The developer route will apply the same safe default if this read
        // is temporarily unavailable.
      }
      window.location.replace(profileType === "general_sales"
        ? "/developer/crm"
        : "/developer/dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    loginMutation.mutate({
      email: String(formData.get("email") || ""),
      password: String(formData.get("password") || ""),
    });
  };

  const primaryColor = branding?.primaryColor || "#0A2B4A";

  if (loadingBranding) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f9fc]" style={{ color: primaryColor }}>
        <Loader2 className="h-8 w-8 animate-spin" aria-label="Loading login" />
      </div>
    );
  }

  if (!branding) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f9fc] px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
          <Building2 className="mx-auto mb-4 h-10 w-10 text-slate-400" />
          <h1 className="text-xl font-semibold text-slate-900">Login unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">{brandingError}</p>
          <Button className="mt-6" variant="outline" onClick={() => setLocation("/")}>Return to portal selection</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f9fc] px-4 py-8">
      <div className="flex w-full items-center justify-center">
        <div className="w-full max-w-[460px]">
          <Card className="max-w-full overflow-hidden rounded-xl border border-[#dce3ec] bg-white shadow-[0_8px_30px_rgba(15,23,42,0.08)]">
            <CardHeader className="px-6 pb-2 pt-6 sm:px-8 sm:pt-7">
              <Link
                href="/"
                className="mx-auto mb-5 flex min-h-8 max-w-full items-center justify-center text-center"
                aria-label={`${branding.companyName} home`}
              >
                <span className="max-w-full break-words text-xl font-bold leading-tight text-[#0A2B4A] sm:text-2xl">
                  {branding.companyName}
                </span>
              </Link>
              <CardTitle className="text-xl font-bold text-slate-900">Sign In</CardTitle>
              <CardDescription className="mt-1 text-[15px] leading-6 text-slate-500">
                Use your company credentials to sign in.
              </CardDescription>
            </CardHeader>
            <CardContent className="max-w-full overflow-hidden px-6 pb-7 pt-4 sm:px-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="developer-email" className="text-sm font-semibold text-slate-800">Email address</Label>
                  <Input
                    id="developer-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    disabled={loginMutation.isPending}
                    className="h-12 rounded-lg border-[#bac9dc] bg-[#eaf2ff] px-3 text-base shadow-none placeholder:text-slate-400 focus:border-[#4A90E2] focus:ring-2 focus:ring-[#4A90E2]/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="developer-password" className="text-sm font-semibold text-slate-800">Password</Label>
                  <div className="relative">
                    <Input
                      id="developer-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      disabled={loginMutation.isPending}
                      className="h-12 rounded-lg border-[#bac9dc] bg-[#eaf2ff] px-3 pr-11 text-base shadow-none placeholder:text-slate-400 focus:border-[#4A90E2] focus:ring-2 focus:ring-[#4A90E2]/20"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((visible) => !visible)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div className="text-center">
                  <a
                    href={`/reset-password?developerSlug=${encodeURIComponent(slug)}`}
                    className="text-sm font-medium text-[#4A90E2] hover:underline"
                  >
                    Forgot your password?
                  </a>
                </div>
                <Button
                  type="submit"
                  disabled={loginMutation.isPending}
                  className="h-12 w-full rounded-lg border border-transparent bg-[var(--company-primary-color)] text-sm font-bold uppercase tracking-wide text-white shadow-sm transition-colors hover:border-[#4A90E2] hover:bg-white hover:text-[#4A90E2]"
                  style={{ "--company-primary-color": primaryColor } as React.CSSProperties}
                >
                  {loginMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                  {loginMutation.isPending ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}