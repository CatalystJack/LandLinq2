import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Eye, EyeOff } from "lucide-react";
import { isPlatformAdminEmail } from "@shared/admin-auth";

export default function AuthPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  
  // Get the auth mode from URL params
  const searchParams = new URLSearchParams(window.location.search);
  const authMode = searchParams.get('mode') || 'login'; // default to login
  const authenticatedEmail = String((user as any)?.claims?.email || (user as any)?.email || "").toLowerCase();
  const authenticatedRole = String((user as any)?.role || "").toUpperCase();
  const authenticatedDeveloperHome = (user as any)?.developerProfile?.profileType === "general_sales"
    ? "/developer/crm"
    : "/developer/dashboard";
  const redirectUrl = isPlatformAdminEmail(authenticatedEmail)
    ? "/dashboard"
    : authenticatedRole === "DEVELOPER"
      ? authenticatedDeveloperHome
      : (searchParams.get('redirect') || '/dashboard');

  // Redirect if already logged in
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      setLocation(redirectUrl);
    }
  }, [isLoading, isAuthenticated, setLocation, redirectUrl]);

  if (!isLoading && isAuthenticated) {
    return null; // Don't render the form while redirecting
  }

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(credentials),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Login failed' }));
        throw new Error(error.message || 'Login failed');
      }
      return response.json();
    },
    onSuccess: async (userData) => {
      let authenticatedUser = userData;
      const isDeveloper = String(userData?.role || "").toUpperCase() === "DEVELOPER";
      if (isDeveloper) {
        const currentUserResponse = await fetch("/api/user", { credentials: "include" }).catch(() => null);
        if (currentUserResponse?.ok) {
          authenticatedUser = await currentUserResponse.json();
        }
      }

      queryClient.setQueryData(["/api/user"], authenticatedUser);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Login successful",
        description: "You've successfully logged in.",
      });
      // Platform administrators always enter the parent platform. This takes
      // priority over a stale or user-supplied redirect destination.
      const isPlatformAdmin = isPlatformAdminEmail(authenticatedUser?.email);
      const developerHome = authenticatedUser?.developerProfile?.profileType === "general_sales"
        ? "/developer/crm"
        : "/developer/dashboard";
      const redirectPath = isPlatformAdmin
        ? "/dashboard"
        : String(authenticatedUser?.role || "").toUpperCase() === "DEVELOPER"
        ? developerHome
        : (searchParams.get('redirect') || '/dashboard');
      setTimeout(() => {
        window.location.href = redirectPath;
      }, 100);
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (userData: { 
      password: string; 
      email: string; 
      firstName: string; 
      lastName: string; 
      phone: string;
      marketsCovered: string;
      smsConsent: boolean;
    }) => {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(userData),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Registration failed' }));
        throw new Error(error.message || 'Registration failed');
      }
      return response.json();
    },
    onSuccess: (userData) => {
      queryClient.setQueryData(["/api/user"], userData);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Registration successful",
        description: "Your account has been created successfully.",
      });
      // Redirect to the intended destination or default to dashboard
      const redirectPath = searchParams.get('redirect') || '/dashboard';
      setTimeout(() => {
        window.location.href = redirectPath;
      }, 100);
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    loginMutation.mutate({
      email: formData.get('email') as string,
      password: formData.get('password') as string,
    });
  };

  const handleRegister = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    registerMutation.mutate({
      password: formData.get('password') as string,
      email: formData.get('email') as string,
      firstName: formData.get('firstName') as string,
      lastName: formData.get('lastName') as string,
      phone: formData.get('phone') as string,
      marketsCovered: formData.get('marketsCovered') as string,
      smsConsent: formData.get('smsConsent') === 'on',
    });
  };

  const devLogin = async (role: 'admin' | 'analyst' | 'broker') => {
    const devCredentials: Record<string, { email: string; password: string }> = {
      admin: { email: 'jack@catalystcp.com', password: 'dev' },
      analyst: { email: 'Austin.Blondell@catalystcp.com', password: 'dev' },
      broker: { email: 'test@example.com', password: 'dev' }
    };
    
    const creds = devCredentials[role];
    
    try {
      const response = await fetch('/api/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(creds),
      });
      
      if (response.ok) {
        const userData = await response.json();
        queryClient.setQueryData(["/api/user"], userData);
        queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        const redirectPath = searchParams.get('redirect') || '/dashboard';
        window.location.href = redirectPath;
        return;
      }
    } catch (error) {
    }
    
    loginMutation.mutate(creds);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f9fc] px-4 py-8">
      <div className="flex w-full items-center justify-center">
        <div className="w-full max-w-[460px]">
        
          {/* Left side - Form */}
          <div className="w-full">
            <div className="w-full">
              {/* Show toggle buttons only when no specific mode is set */}
              {false && !searchParams.get('mode') && (
                <div className="grid w-full grid-cols-2 h-14 sm:h-12 bg-gray-100 p-1 rounded-lg mb-6">
                  <button 
                    onClick={() => window.location.href = '/auth?mode=login'}
                    className="text-base sm:text-sm font-medium rounded-md px-4 py-3 transition-all whitespace-nowrap overflow-hidden bg-white shadow-sm"
                  >
                    Sign In
                  </button>
                  <button 
                    onClick={() => window.location.href = '/auth?mode=register'}
                    className="text-base sm:text-sm font-medium rounded-md px-4 py-3 transition-all whitespace-nowrap overflow-hidden"
                  >
                    Sign Up
                  </button>
                </div>
              )}
              
              {/* Show switch links when in a specific mode */}
              {(searchParams.get('mode') || authMode === 'login') && (
                <div className="hidden text-center mb-6">
                  {authMode === 'login' ? (
                    <p className="text-sm text-catalyst-gray-600">
                      Don't have an account?{' '}
                      <button 
                        onClick={() => window.location.href = '/auth?mode=register'}
                        className="text-catalyst-gold hover:underline font-medium"
                        data-testid="link-switch-to-register"
                      >
                        Sign up here
                      </button>
                    </p>
                  ) : (
                    <p className="text-sm text-catalyst-gray-600">
                      Already have an account?{' '}
                      <button 
                        onClick={() => window.location.href = '/auth?mode=login'}
                        className="text-catalyst-gold hover:underline font-medium"
                        data-testid="link-switch-to-login"
                      >
                        Sign in here
                      </button>
                    </p>
                  )}
                </div>
              )}
              
              {/* Login Form */}
              {(authMode === 'login' || !searchParams.get('mode')) && (
                <>
                <Card className="max-w-full overflow-hidden rounded-xl border border-[#dce3ec] bg-white shadow-[0_8px_30px_rgba(15,23,42,0.08)]">
                  <CardHeader className="px-6 pb-2 pt-6 sm:px-8 sm:pt-7">
                    <img
                      src="/assets/landlinq-color-logo.png"
                      alt="LandLinq"
                      className="mx-auto mb-5 h-8 w-auto max-w-[170px] object-contain object-center"
                    />
                    <CardTitle className="text-xl font-bold text-slate-900">Sign In</CardTitle>
                    <CardDescription className="mt-1 text-[15px] leading-6 text-slate-500">
                      Sign in to access your account.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="max-w-full overflow-hidden px-6 pb-7 pt-4 sm:px-8">
                    <form onSubmit={handleLogin} className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="login-email" className="text-sm font-semibold text-slate-800">Email</Label>
                        <Input
                          id="login-email"
                          name="email"
                          type="email"
                          required
                          autoFocus
                          autoComplete="email"
                          data-testid="input-login-email"
                          placeholder="you@example.com"
                           className="h-12 rounded-lg border-[#bac9dc] bg-[#eaf2ff] px-3 text-base shadow-none placeholder:text-slate-400 focus:border-[#4A90E2] focus:ring-2 focus:ring-[#4A90E2]/20"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="login-password" className="text-sm font-semibold text-slate-800">Password</Label>
                        <div className="relative">
                          <Input
                            id="login-password"
                            name="password"
                            type={showLoginPassword ? "text" : "password"}
                            required
                            autoComplete="current-password"
                            data-testid="input-login-password"
                             className="h-12 rounded-lg border-[#bac9dc] bg-[#eaf2ff] px-3 pr-11 text-base shadow-none placeholder:text-slate-400 focus:border-[#4A90E2] focus:ring-2 focus:ring-[#4A90E2]/20"
                          />
                          <button
                            type="button"
                            onClick={() => setShowLoginPassword(!showLoginPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
                            data-testid="button-toggle-login-password"
                          >
                            {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>
                      <div className="text-center">
                        <button 
                          type="button"
                          onClick={() => window.location.href = '/reset-password'}
                           className="text-sm font-medium text-[#4A90E2] hover:underline"
                          data-testid="link-forgot-password"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <Button 
                        type="submit" 
                        className="h-12 w-full rounded-lg border border-transparent bg-[#4A90E2] text-sm font-bold uppercase tracking-wide text-white shadow-sm transition-colors hover:border-[#4A90E2] hover:bg-white hover:text-[#4A90E2]"
                        disabled={loginMutation.isPending}
                        data-testid="button-login"
                      >
                        {loginMutation.isPending ? "Signing in..." : "Sign In"}
                      </Button>

                      {/* Try Demo Button */}
                      <button
                        type="button"
                        data-testid="button-demo-login"
                        onClick={async () => {
                          try {
                            const res = await fetch('/api/demo-login', {
                              method: 'POST',
                              credentials: 'include',
                            });
                            if (!res.ok) throw new Error('Demo login failed');
                            await queryClient.invalidateQueries({ queryKey: ['/api/user'] });
                            await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
                            setLocation('/dashboard');
                          } catch {
                            toast({ title: 'Demo unavailable', description: 'Could not start the demo. Please try again.', variant: 'destructive' });
                          }
                        }}
                        className="hidden w-full h-12 flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded text-sm font-medium text-gray-600 hover:border-[#4A90E2] hover:text-[#4A90E2] hover:bg-blue-50 transition-all duration-200"
                      >
                        <span className="text-base">🚀</span> Try Live Demo — no account needed
                      </button>

                      {/* OAuth Divider */}
                      <div className="relative my-6 hidden">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-gray-300"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                          <span className="px-4 bg-white text-gray-500">OR</span>
                        </div>
                      </div>

                      {/* Google Login Button */}
                      <button
                        type="button"
                        onClick={() => window.location.href = '/auth/google'}
                        className="hidden w-full h-12 flex items-center justify-center gap-3 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                        data-testid="button-google-login"
                      >
                        <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                          <g fill="none" fillRule="evenodd">
                            <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                          </g>
                        </svg>
                        <span className="text-sm font-medium text-gray-700">Continue with Google</span>
                      </button>

                      {/* Microsoft Login Button */}
                      <button
                        type="button"
                        onClick={() => window.location.href = '/auth/microsoft'}
                        className="hidden w-full h-12 flex items-center justify-center gap-3 border border-gray-300 rounded hover:bg-gray-50 transition-colors mt-3"
                        data-testid="button-microsoft-login"
                      >
                        <svg width="21" height="21" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
                          <path fill="#f25022" d="M0 0h10v10H0z"/>
                          <path fill="#00a4ef" d="M11 0h10v10H11z"/>
                          <path fill="#7fba00" d="M0 11h10v10H0z"/>
                          <path fill="#ffb900" d="M11 11h10v10H11z"/>
                        </svg>
                        <span className="text-sm font-medium text-gray-700">Continue with Microsoft Account</span>
                      </button>
                    </form>
                  </CardContent>
                </Card>
                </>
              )}
              
              {/* Register Form */}
              {authMode === 'register' && (
                <Card className="max-w-full overflow-hidden">
                  <CardHeader>
                    <CardTitle>Create Account</CardTitle>
                    <CardDescription className="text-sm sm:text-base break-words">
                      Join LandLinq to start submitting deals
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="max-w-full overflow-hidden">
                    <form onSubmit={handleRegister} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="register-firstName">First Name *</Label>
                          <Input
                            id="register-firstName"
                            name="firstName"
                            type="text"
                            required
                            data-testid="input-register-firstName"
                            placeholder="First name"
                            className="h-12 text-base sm:text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="register-lastName">Last Name *</Label>
                          <Input
                            id="register-lastName"
                            name="lastName"
                            type="text"
                            required
                            data-testid="input-register-lastName"
                            placeholder="Last name"
                            className="h-12 text-base sm:text-sm"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="register-email">Email *</Label>
                        <Input
                          id="register-email"
                          name="email"
                          type="email"
                          required
                          data-testid="input-register-email"
                          placeholder="your.email@example.com"
                          className="h-12 text-base sm:text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="register-phone">Phone Number *</Label>
                        <Input
                          id="register-phone"
                          name="phone"
                          type="tel"
                          required
                          data-testid="input-register-phone"
                          placeholder="(888) 486-6346"
                          className="h-12 text-base sm:text-sm"
                        />
                        <div className="mt-2">
                          <div className="flex items-start space-x-2">
                            <Checkbox 
                              id="register-sms-consent"
                              name="smsConsent"
                              defaultChecked={true}
                              required
                              data-testid="checkbox-sms-consent"
                              className="mt-1"
                            />
                            <Label htmlFor="register-sms-consent" className="text-xs text-gray-600 leading-4">
                              I want to receive text message updates about my deals from LandLinq. Message and data rates may apply. Reply STOP to opt out anytime. *
                            </Label>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="register-markets">Markets Covered *</Label>
                        <Input
                          id="register-markets"
                          name="marketsCovered"
                          type="text"
                          required
                          data-testid="input-register-markets"
                          placeholder="e.g., Dallas-Fort Worth, Austin, Houston"
                          className="h-12 text-base sm:text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="register-password">Password *</Label>
                        <div className="relative">
                          <Input
                            id="register-password"
                            name="password"
                            type={showRegisterPassword ? "text" : "password"}
                            required
                            data-testid="input-register-password"
                            placeholder="Create a password"
                            className="h-12 text-base sm:text-sm pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                            data-testid="button-toggle-register-password"
                          >
                            {showRegisterPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-start space-x-2">
                        <Checkbox 
                          id="register-terms"
                          name="terms"
                          required
                          data-testid="checkbox-register-terms"
                          className="mt-1"
                        />
                        <Label htmlFor="register-terms" className="text-sm leading-5">
                          I agree to the <a href="/terms" className="text-catalyst-gold hover:underline" target="_blank">terms and conditions</a> and <a href="/privacy" className="text-catalyst-gold hover:underline" target="_blank">privacy policy</a> *
                        </Label>
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full py-2 px-4 text-xs lg:text-sm font-bold uppercase tracking-wider bg-catalyst-gold text-white hover:bg-[#4A90E2] border border-catalyst-gold hover:border-[#4A90E2] rounded transition-colors"
                        disabled={registerMutation.isPending}
                        data-testid="button-register"
                      >
                        {registerMutation.isPending ? "Creating account..." : "Create Account"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Right side - Hero */}
          <div className="hidden text-center lg:text-left order-1 lg:order-2 mb-8 lg:mb-0">
            <div className="space-y-4 lg:space-y-6">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-catalyst-gray-900">
                Join <span className="text-catalyst-gold">LandLinq</span>
              </h1>
              <p className="text-lg lg:text-xl text-catalyst-gray-600 leading-relaxed">
                The premier platform for land acquisition and development opportunities. 
                Connect with our expert team to unlock your next successful project.
              </p>
              <div className="hidden lg:grid gap-4 text-left">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-catalyst-gold rounded-full"></div>
                  <span className="text-catalyst-gray-700">Submit deals instantly</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-catalyst-gold rounded-full"></div>
                  <span className="text-catalyst-gray-700">Track submission progress</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-catalyst-gold rounded-full"></div>
                  <span className="text-catalyst-gray-700">Get expert analysis</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-catalyst-gold rounded-full"></div>
                  <span className="text-catalyst-gray-700">Connect with our team</span>
                </div>
              </div>
            </div>
          </div>
        </div>
    </div>
    </div>
  );
}