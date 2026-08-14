import Footer from "@/components/footer";
import Navigation from "@/components/navigation";
import LandValuationTool from "@/components/land-valuation-tool";

export default function LandValuationPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-catalyst-navy mb-2">
            Land Valuation Tool
          </h1>
          <p className="text-catalyst-gray-600 max-w-2xl mx-auto">
            Get instant property value estimates based on recent comparable sales data.
            Perfect for quick market analysis and deal evaluation.
          </p>
        </div>
        <LandValuationTool />
      </div>
      <Footer />
    </div>
  );
}
