import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Navigation from "@/components/navigation";
import Footer from "@/components/footer";
import { LogIn } from "lucide-react";

export default function SimpleLogin() {
  const handleLogin = () => {
    // Redirect to custom auth page instead of Replit OAuth
    window.location.href = '/auth?mode=login';
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader className="text-center">
              <CardTitle>Access LandLinq</CardTitle>
              <CardDescription>
                Sign in to access your deal dashboard
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={handleLogin}
                className="w-full h-12 text-lg"
                size="lg"
              >
                <LogIn className="w-5 h-5 mr-2" />
                Login
              </Button>
              <div className="text-center text-sm text-muted-foreground">
                <p>For Catalyst Capital Partners team members</p>
                <p className="mt-2">Use your @catalystcp.com email to access analyst features</p>
              </div>
            </CardContent>
          </Card>
        </div>
        <Footer />
    </div>
    </div>
  );
}