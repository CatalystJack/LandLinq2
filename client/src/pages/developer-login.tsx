import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2, LogIn, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

type DeveloperBranding = {
  companyName: string;
  logoUrl: string | null;
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
      const isApexPlatformUser = String(userData?.email || "").toLowerCase().endsWith("@apexresi.com");
      if (isApexPlatformUser) {
        queryClient.setQueryData(["/api/user"], userData);
        queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        window.location.href = "/dashboard";
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
          window.location.href = `/reset-password?token=${encodeURIComponent(token)}&developerSlug=${encodeURIComponent(slug)}`;
        } else {
          window.location.href = "/reset-password";
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
      window.location.href = profileType === "general_sales"
        ? "/developer/crm"
        : "/developer/dashboard";
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
  const secondaryColor = branding?.secondaryColor || "#4A90E2";

  if (loadingBranding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" style={{ color: primaryColor }}>
        <Loader2 className="h-8 w-8 animate-spin" aria-label="Loading login" />
      </div>
    );
  }

  if (!branding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
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
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}
    >
      <div className="w-full max-w-md">
        <div className="overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="h-2" style={{ backgroundColor: secondaryColor }} />
          <div className="p-8 sm:p-10">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-slate-50 ring-1 ring-slate-200">
                {branding.logoUrl ? (
                  <img src={branding.logoUrl} alt={`${branding.companyName} logo`} className="h-full w-full object-contain p-2" />
                ) : (
                  <img src="/assets/landlinq-white-icon.png" alt="LandLinq" className="h-full w-full object-contain p-3" />
                )}
              </div>
              <h1 className="text-2xl font-bold text-slate-900">{branding.companyName}</h1>
              <p className="mt-2 text-sm text-slate-500">Sign in to access your investment dashboard</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="developer-email">Email address</Label>
                <Input id="developer-email" name="email" type="email" autoComplete="email" required disabled={loginMutation.isPending} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="developer-password">Password</Label>
                <div className="relative">
                  <Input
                    id="developer-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    disabled={loginMutation.isPending}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" disabled={loginMutation.isPending} className="h-11 w-full text-white" style={{ backgroundColor: primaryColor }}>
                {loginMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                {loginMutation.isPending ? "Signing in..." : "Sign in"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <a href={`/reset-password?developerSlug=${encodeURIComponent(slug)}`} className="text-sm font-medium hover:underline" style={{ color: secondaryColor }}>
                Forgot your password?
              </a>
            </div>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-white/75">Secure access powered by LandLinq</p>
      </div>
    </div>
  );
}