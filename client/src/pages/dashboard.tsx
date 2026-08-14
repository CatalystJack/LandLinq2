import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
// import { useToast } from "@/hooks/use-toast";
import Navigation from "@/components/navigation";
import AnalystDashboard from "@/components/analyst-dashboard";
import Footer from "@/components/footer";

export default function Dashboard() {
  // const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      console.log("Unauthorized - redirecting to login");
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 100);
      return;
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-catalyst-navy mx-auto"></div>
          <p className="mt-4 text-catalyst-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="pt-20">
        <AnalystDashboard />
        <Footer />
    </div>
    </div>
  );
}
