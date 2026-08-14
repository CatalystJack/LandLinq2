import Navigation from "@/components/navigation";
import Footer from "@/components/footer";

export default function Terms() {
  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      
      <main className="pt-20 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h1 className="text-3xl font-bold text-catalyst-dark-blue mb-8" data-testid="text-terms-title">
              Terms of Service
            </h1>
            
            <div className="prose max-w-none text-catalyst-gray-700 space-y-6">
              <section>
                <h2 className="text-xl font-semibold text-catalyst-dark-blue mb-3">Acceptance of Terms</h2>
                <p>
                  By accessing and using LandLinq, you accept and agree to be bound by the terms 
                  and provision of this agreement.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-catalyst-dark-blue mb-3">Use of Service</h2>
                <p>
                  LandLinq is a platform for property deal submissions and evaluations. You agree to use 
                  the service only for lawful purposes and in accordance with these terms.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-catalyst-dark-blue mb-3">Property Submissions</h2>
                <p>
                  By submitting property information, you represent that you have the right to submit 
                  such information and that all details provided are accurate to the best of your knowledge.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-catalyst-dark-blue mb-3">Commission Structure</h2>
                <p>
                  Commission rates and terms are subject to change. Current rates and terms are displayed 
                  on the platform and in commission agreements.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-catalyst-dark-blue mb-3">Limitation of Liability</h2>
                <p>
                  LandLinq shall not be liable for any indirect, incidental, 
                  special, consequential, or punitive damages resulting from your use of the service.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-catalyst-dark-blue mb-3">Contact Information</h2>
                <p>
                  For questions about these Terms of Service, please contact us at (888) 486-6346.
                </p>
              </section>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}