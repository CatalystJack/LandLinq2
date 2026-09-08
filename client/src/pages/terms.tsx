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
                  By accessing or using LandLinq (the "Platform"), you agree to be bound by these
                  Terms of Service. If you are using the Platform on behalf of an organization, you
                  represent that you have the authority to bind that organization to these terms.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-catalyst-dark-blue mb-3">Description of Service</h2>
                <p>
                  LandLinq provides a platform for real estate deal sourcing and screening, customer
                  relationship management (CRM), outreach messaging, and sales pipeline tracking.
                  The Platform is used both by real estate investment companies for acquisition-related
                  workflows and by other business teams for general CRM, outreach, and pipeline
                  management. Deals and property information may be submitted directly, forwarded by
                  email, or identified through automated processing of inbound communications.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-catalyst-dark-blue mb-3">Accounts and Access</h2>
                <p>
                  You are responsible for maintaining the confidentiality of your account credentials
                  and for all activity that occurs under your account. Investment Company and
                  organization accounts may include multiple individual users, each of whom is bound
                  by these terms.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-catalyst-dark-blue mb-3">Connected Third-Party Accounts and Outreach</h2>
                <p>
                  The Platform allows you to connect your own third-party email account (such as
                  Microsoft Outlook) to send outreach messages on your behalf. By connecting an
                  account, you authorize LandLinq to send messages and access related information
                  solely as necessary to provide this functionality. You remain solely responsible
                  for the content of messages sent through your connected account and for compliance
                  with applicable law, including the CAN-SPAM Act and similar regulations governing
                  commercial email. You may disconnect a connected account at any time through your
                  account settings.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-catalyst-dark-blue mb-3">Property and Deal Submissions</h2>
                <p>
                  By submitting property or deal information — whether directly, by forwarding an
                  email, or through any other means made available on the Platform — you represent
                  that you have the right to submit such information and that it is accurate to the
                  best of your knowledge.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-catalyst-dark-blue mb-3">Automated Processing and AI-Generated Information</h2>
                <p>
                  The Platform uses automated tools, including artificial intelligence, to extract,
                  classify, and screen property and deal information from submitted or forwarded
                  content. Automated results are provided as a screening aid only and may contain
                  errors or omissions. LandLinq does not guarantee the accuracy, completeness, or
                  reliability of any automatically extracted or classified information, and you are
                  solely responsible for independently verifying any information before relying on
                  it for a business, financial, or transactional decision.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-catalyst-dark-blue mb-3">Commission Structure and Brokerage Services</h2>
                <p>
                  Where applicable, real estate brokerage services in connection with deals
                  identified through the Platform are provided by Apex Residential, LLC, a licensed
                  real estate brokerage, under separate commission and brokerage agreements.
                  Commission rates and terms are governed by those agreements and are not altered by
                  these Terms of Service.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-catalyst-dark-blue mb-3">Data and Content Ownership</h2>
                <p>
                  As between you and LandLinq, you retain ownership of the acquisition criteria,
                  contact lists, and other content you upload to the Platform. You grant LandLinq a
                  license to use this content solely as necessary to provide the Platform's services
                  to you. LandLinq owns all rights to the Platform itself, including its underlying
                  technology, classification systems, and branding.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-catalyst-dark-blue mb-3">Acceptable Use</h2>
                <p>
                  You agree to use the Platform only for lawful purposes and in accordance with
                  these terms. You may not use the Platform to send unsolicited or unlawful
                  communications, to access another user's or organization's data without
                  authorization, or to interfere with the Platform's operation or security.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-catalyst-dark-blue mb-3">Termination</h2>
                <p>
                  LandLinq may suspend or terminate your access to the Platform for violation of
                  these terms or for other reasonable business purposes. You may stop using the
                  Platform at any time; certain obligations under these terms will survive
                  termination.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-catalyst-dark-blue mb-3">Disclaimer of Warranties</h2>
                <p>
                  THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTIES OF ANY
                  KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS
                  FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. LANDLINQ DOES NOT WARRANT THAT THE
                  PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR THAT ANY DEAL OR MARKET DATA
                  PROVIDED THROUGH THE PLATFORM IS ACCURATE OR COMPLETE.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-catalyst-dark-blue mb-3">Limitation of Liability</h2>
                <p>
                  To the maximum extent permitted by law, LandLinq shall not be liable for any
                  indirect, incidental, special, consequential, or punitive damages, or any loss of
                  profits or revenue, arising from your use of the Platform, including reliance on
                  any automatically classified or AI-generated information.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-catalyst-dark-blue mb-3">Indemnification</h2>
                <p>
                  You agree to indemnify and hold LandLinq harmless from any claims, damages, or
                  expenses arising from your use of the Platform, your violation of these terms, or
                  content you submit or send through the Platform, including outreach messages sent
                  through your connected email account.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-catalyst-dark-blue mb-3">Governing Law</h2>
                <p>
                  These terms are governed by the laws of the State of North Carolina, without
                  regard to conflict of law principles.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-catalyst-dark-blue mb-3">Changes to These Terms</h2>
                <p>
                  We may update these Terms of Service from time to time. Continued use of the
                  Platform after changes take effect constitutes acceptance of the revised terms.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-catalyst-dark-blue mb-3">Contact Information</h2>
                <p>
                  For questions about these Terms of Service, please contact us at{" "}
                  <a href="mailto:help@landlinq.ai" className="text-landlinq-blue hover:underline">
                    help@landlinq.ai
                  </a>
                  .
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