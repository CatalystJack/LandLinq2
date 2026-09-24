import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import { AuthModal } from "@/components/auth-modal";
import ErrorBoundary from "@/components/error-boundary";
import { Label } from "@/components/ui/label";

type TokenStatus = "idle" | "checking" | "valid" | "invalid" | "error";

type ResetIdentity = {
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
};

const inputStyles = "h-12 rounded-lg border-[#bac9dc] bg-[#eaf2ff] px-3 text-base shadow-none placeholder:text-slate-400 focus:border-[#4A90E2] focus:ring-2 focus:ring-[#4A90E2]/20";
const primaryButtonStyles = "h-12 w-full rounded-lg border border-transparent bg-[#4A90E2] text-sm font-bold uppercase tracking-wide text-white shadow-sm transition-colors hover:border-[#4A90E2] hover:bg-white hover:text-[#4A90E2]";

function PasswordResetErrorFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f9fc] px-4 py-8">
      <div className="w-full max-w-[460px] rounded-xl border border-[#dce3ec] bg-white p-8 text-center shadow-[0_8px_30px_rgba(15,23,42,0.08)]">
        <img src="/assets/landlinq-color-logo.png" alt="LandLinq" className="mx-auto mb-6 h-8 w-auto max-w-[170px] object-contain object-center" />
        <h1 className="text-xl font-semibold text-[#0A2B4A]">Something went wrong</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Please try again or contact support if the problem continues.</p>
        <a href="/login" className="mt-6 inline-flex min-h-11 items-center justify-center text-sm font-medium text-[#4A90E2] hover:underline">
          Back to Login
        </a>
      </div>
    </div>
  );
}

function PasswordResetContent() {
  const initialToken = new URLSearchParams(window.location.search).get("token");
  const [step, setStep] = useState<"request" | "reset">(initialToken ? "reset" : "request");
  const [tokenStatus, setTokenStatus] = useState<TokenStatus>(initialToken ? "checking" : "idle");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [resetIdentity, setResetIdentity] = useState<ResetIdentity | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    newPassword: "",
    confirmPassword: ""
  });
  const { toast } = useToast();

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setStep("request");
      setTokenStatus("idle");
      return;
    }

    let cancelled = false;
    setStep("reset");
    setTokenStatus("checking");
    setError("");

    fetch("/api/password-reset/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (response.ok) {
          setResetIdentity({
            firstName: typeof data.firstName === "string" ? data.firstName : null,
            lastName: typeof data.lastName === "string" ? data.lastName : null,
            companyName: typeof data.companyName === "string" ? data.companyName : null,
          });
          setTokenStatus("valid");
        } else {
          setResetIdentity(null);
          setTokenStatus("invalid");
          setError(data.message || "This link has expired or is invalid.");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setResetIdentity(null);
        setTokenStatus("error");
        setError("We couldn't verify this link. Please request a new one and try again.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const returnToRequestStep = () => {
    window.history.replaceState({}, "", "/reset-password");
    setStep("request");
    setTokenStatus("idle");
    setResetIdentity(null);
    setError("");
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage("If an account with that email exists, you'll receive a password reset link shortly.");
        setFormData({ ...formData, email: "" });
      } else {
        setError(data.message || "Failed to send reset email");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.newPassword !== formData.confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    if (formData.newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const token = new URLSearchParams(window.location.search).get("token");
      
      const response = await fetch("/api/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          token,
          newPassword: formData.newPassword 
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Success!",
          description: "Your password has been reset successfully.",
        });
        const developerSlug = new URLSearchParams(window.location.search).get("developerSlug");
        // A reset can be completed while an old authenticated session is still
        // open. Clear that session and perform a full navigation so App.tsx
        // cannot make a decision from stale mustResetPassword state.
        try {
          await fetch("/api/logout", {
            method: "POST",
            credentials: "include",
          });
        } catch {
          // The password was already changed; continue to the login page even
          // if the best-effort session cleanup is unavailable.
        }
        window.location.replace(
          developerSlug
            ? `/developer/${encodeURIComponent(developerSlug)}/login`
            : "/login",
        );
      } else {
        setError(data.message || "Failed to reset password");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const isCheckingToken = tokenStatus === "checking";
  const tokenIsInvalid = tokenStatus === "invalid" || tokenStatus === "error";
  const resetName = [resetIdentity?.firstName, resetIdentity?.lastName]
    .filter((name): name is string => Boolean(name?.trim()))
    .join(" ");
  const companyName = resetIdentity?.companyName?.trim();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f9fc] px-4 py-8">
      <div className="w-full max-w-[460px]">
        <Card className="max-w-full overflow-hidden rounded-xl border border-[#dce3ec] bg-white shadow-[0_8px_30px_rgba(15,23,42,0.08)]">
          <CardHeader className="px-6 pb-2 pt-6 sm:px-8 sm:pt-7">
            {companyName ? (
              <div className="mx-auto mb-6 flex min-h-8 max-w-full items-center justify-center break-words text-center text-xl font-bold leading-tight text-[#0A2B4A] sm:text-2xl">
                {companyName}
              </div>
            ) : (
              <img
                src="/assets/landlinq-color-logo.png"
                alt="LandLinq"
                className="mx-auto mb-6 h-8 w-auto max-w-[170px] object-contain object-center"
              />
            )}
            <CardTitle className="text-2xl font-semibold text-[#0A2B4A]">
              {isCheckingToken
                ? "Checking Reset Link"
                : tokenIsInvalid
                  ? "Reset Link Unavailable"
                  : step === "request"
                    ? "Reset Password"
                    : resetName
                      ? `Welcome, ${resetName}`
                      : "Set New Password"}
            </CardTitle>
            <CardDescription className="mt-1 text-sm text-slate-600">
              {isCheckingToken
                ? "Please wait while we verify this link"
                : tokenIsInvalid
                  ? "Request a new password reset link to continue"
                  : step === "request"
                    ? "Enter your email to receive a password reset link"
                    : companyName
                      ? `Set your password for ${companyName}`
                      : "Enter your new password below"}
            </CardDescription>
          </CardHeader>
          <CardContent className="max-w-full overflow-hidden px-6 pb-7 pt-4 sm:px-8">
            {error && !tokenIsInvalid && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {message && (
              <Alert className="mb-4">
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}

            {isCheckingToken ? (
              <div className="py-8 text-center text-sm text-slate-600" role="status">
                Checking your reset link...
              </div>
            ) : tokenIsInvalid ? (
              <div className="space-y-4">
                <Alert variant="destructive">
                  <AlertDescription>This link has expired or is invalid — request a new one.</AlertDescription>
                </Alert>
                <Button type="button" className={primaryButtonStyles} onClick={returnToRequestStep}>
                  Request a New Reset Link
                </Button>
              </div>
            ) : step === "request" ? (
              <form onSubmit={handleRequestReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email" className="text-sm font-semibold text-slate-800">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={inputStyles}
                    required
                    disabled={loading}
                    data-testid="input-email"
                  />
                </div>
                <Button
                  type="submit"
                  className={primaryButtonStyles}
                  disabled={loading}
                  data-testid="button-send-reset-link"
                >
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-new-password" className="text-sm font-semibold text-slate-800">New password</Label>
                  <div className="relative">
                    <Input
                      id="reset-new-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Enter new password"
                      value={formData.newPassword}
                      onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                      className={`${inputStyles} pr-11`}
                      required
                      disabled={loading}
                      data-testid="input-new-password"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm p-1 text-slate-500 hover:text-[#0A2B4A]"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      data-testid="button-toggle-password"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-sm text-slate-500">Password must be at least 6 characters</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reset-confirm-password" className="text-sm font-semibold text-slate-800">Confirm new password</Label>
                  <Input
                    id="reset-confirm-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Confirm new password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className={inputStyles}
                    required
                    disabled={loading}
                    data-testid="input-confirm-password"
                  />
                </div>
                <Button
                  type="submit"
                  className={primaryButtonStyles}
                  disabled={loading}
                  data-testid="button-reset-password"
                >
                  {loading ? "Resetting..." : "Reset Password"}
                </Button>
              </form>
            )}

            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(true)}
                className="text-sm font-medium text-[#4A90E2] hover:underline"
                data-testid="link-back-to-login"
              >
                Back to Login
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        defaultMode="login"
      />
    </div>
  );
}

export default function PasswordReset() {
  return (
    <ErrorBoundary fallback={PasswordResetErrorFallback}>
      <PasswordResetContent />
    </ErrorBoundary>
  );
}
