import Navigation from "@/components/navigation";
import Footer from "@/components/footer";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      
      <main className="pt-20 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h1 className="text-3xl font-bold text-catalyst-dark-blue mb-8" data-testid="text-privacy-title">
              Privacy Policy
            </h1>
            
            <div className="prose max-w-none text-catalyst-gray-700 space-y-6">
              <section>
                <h2 className="text-xl font-semibold text-catalyst-dark-blue mb-3">Information We Collect</h2>
                <p>
                  We collect information you provide directly to us, such as when you create an account, 
                  submit property information, or communicate with us. This includes your name, email address, 
                  phone number, and property details.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-catalyst-dark-blue mb-3">How We Use Your Information</h2>
                <p>
                  We use the information we collect to provide, maintain, and improve our services, 
                  process property submissions, communicate with you about deals, and ensure platform security.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-catalyst-dark-blue mb-3">Information Sharing</h2>
                <p>
                  We may share your information with LandLinq team members for deal evaluation purposes.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-catalyst-dark-blue mb-3">Data Security</h2>
                <p>
                  We implement appropriate security measures to protect your personal information against 
                  unauthorized access, alteration, disclosure, or destruction.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-catalyst-dark-blue mb-3">Contact Us</h2>
                <p>
                  If you have questions about this Privacy Policy, please contact us at{' '}
                  <a href="tel:7046101549" className="text-catalyst-gold hover:text-catalyst-gold/80 transition-colors">(704) 610-1549</a>
                  {' '}or{' '}
                  <a href="mailto:deals@catalyst.landlinq.ai" className="text-catalyst-gold hover:text-catalyst-gold/80 transition-colors">deals@catalyst.landlinq.ai</a>.
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