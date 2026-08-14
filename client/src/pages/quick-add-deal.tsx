import Navigation from "@/components/navigation";
import Footer from "@/components/footer";
import QuickDealAddition from "@/components/quick-property-evaluation";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";

export default function QuickAddDeal() {
  const { user } = useAuth();
  const userEmail = (user as any)?.claims?.email || (user as any)?.email || '';
  const firstName = userEmail.split('@')[0].split('.')[0];
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navigation />
      
      <main className="flex-1 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome, {displayName}!
            </h1>
            <p className="text-gray-600 mt-1">Add a new deal below</p>
          </div>
          
          <QuickDealAddition defaultOpen={true} />
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
