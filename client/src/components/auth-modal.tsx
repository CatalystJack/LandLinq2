import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Rocket } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Eye, EyeOff } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'register';
}

function getRedirectPath(user: { email?: string; role?: string }): string {
  const email = (user.email ?? '').toLowerCase();
  const role = (user.role ?? '').toUpperCase();

  if (role === 'CATALYST' || email.endsWith('@catalystcp.com') || email.endsWith('@landlinq.ai')) {
    return '/analyst-dashboard';
  }
  if (role === 'BROKER') {
    return '/broker-portal';
  }
  if (role === 'DEVELOPER') {
    return '/developer-network';
  }
  return '/dashboard';
}

export function AuthModal({ isOpen, onClose, defaultMode = 'login' }: AuthModalProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<'login' | 'register'>(defaultMode);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
      setTimeout(() => { setMode('login'); }, 200);
    }
  };

  const demoLoginMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/demo-login', {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Demo login failed');
      return response.json();
    },
    onSuccess: (userData) => {
      queryClient.setQueryData(["/api/user"], userData);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      onClose();
      setTimeout(() => { window.location.href = '/dashboard'; }, 100);
    },
    onError: () => {
      toast({ title: "Demo unavailable", description: "Could not start the demo. Please try again.", variant: "destructive" });
    },
  });

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
    onSuccess: (userData) => {
      queryClient.setQueryData(["/api/user"], userData);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Signed in", description: "Welcome back!" });
      onClose();
      const dest = getRedirectPath(userData);
      setTimeout(() => { window.location.href = dest; }, 100);
    },
    onError: (error: Error) => {
      toast({ title: "Sign in failed", description: error.message, variant: "destructive" });
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
      toast({ title: "Account created", description: "Welcome to LandLinq!" });
      onClose();
      const dest = getRedirectPath(userData);
      setTimeout(() => { window.location.href = dest; }, 100);
    },
    onError: (error: Error) => {
      toast({ title: "Registration failed", description: error.message, variant: "destructive" });
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
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;
    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    registerMutation.mutate({
      email: formData.get('email') as string,
      password,
      firstName: formData.get('firstName') as string,
      lastName: formData.get('lastName') as string,
      phone: formData.get('phone') as string,
      marketsCovered: formData.get('marketsCovered') as string,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[440px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#081729]">
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'login'
              ? 'Welcome back! Sign in to access your account.'
              : 'Register to join the LandLinq network.'}
          </DialogDescription>
        </DialogHeader>

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                autoComplete="email"
                data-testid="input-login-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  data-testid="input-login-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="text-center">
              <button
                type="button"
                onClick={() => { onClose(); window.location.href = '/reset-password'; }}
                className="text-sm text-[#4A90E2] hover:underline"
                data-testid="link-forgot-password"
              >
                Forgot password?
              </button>
            </div>
            <Button
              type="submit"
              className="w-full bg-[#4A90E2] text-white border-2 border-[#4A90E2] hover:bg-white hover:text-[#4A90E2] hover:border-[#4A90E2] transition-colors"
              disabled={loginMutation.isPending}
              data-testid="button-login-submit"
            >
              {loginMutation.isPending ? "Signing in…" : "Sign In"}
            </Button>
            <div className="text-center text-sm text-gray-600">
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => setMode('register')}
                className="text-[#4A90E2] hover:underline font-medium"
              >
                Create one
              </button>
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-400">or</span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full border-[#4A90E2] text-[#4A90E2] hover:bg-[#4A90E2] hover:text-white transition-colors gap-2"
              onClick={() => demoLoginMutation.mutate()}
              disabled={demoLoginMutation.isPending}
            >
              <Rocket size={15} />
              {demoLoginMutation.isPending ? "Loading demo…" : "Try Live Demo — no account needed"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" name="firstName" required data-testid="input-register-firstname" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" name="lastName" required data-testid="input-register-lastname" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                autoComplete="email"
                data-testid="input-register-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" type="tel" placeholder="(555) 123-4567" required data-testid="input-register-phone" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="marketsCovered">Markets Covered</Label>
              <Input id="marketsCovered" name="marketsCovered" placeholder="e.g., Charlotte, Atlanta, Nashville" required data-testid="input-register-markets" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  data-testid="input-register-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  data-testid="input-register-confirm-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full bg-[#4A90E2] text-white border-2 border-[#4A90E2] hover:bg-white hover:text-[#4A90E2] hover:border-[#4A90E2] transition-colors"
              disabled={registerMutation.isPending}
              data-testid="button-register-submit"
            >
              {registerMutation.isPending ? "Creating account…" : "Create Account"}
            </Button>
            <div className="text-center text-sm text-gray-600">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-[#4A90E2] hover:underline font-medium"
              >
                Sign in
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
