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
                <h2 className="text-xl font-semibold text-catalyst-dark-blue mb-3">Overview</h2>
                <p>
                  This Privacy Policy describes how LandLinq ("LandLinq," "we," "us") collects,
                  uses, and shares information in connection with our platform, which provides deal
                  sourcing, screening, CRM, outreach, and pipeline management tools for real estate
                  investment companies and other business teams.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-catalyst-dark-blue mb-3">Information We Collect</h2>
                <p>
                  <strong>Information you provide directly:</strong> When you create an account,
                  we collect your name, email address, phone number, and role. Investment Companies
                  and other organizations using the platform provide additional information,
                  including acquisition criteria, target markets, branding assets, and contact lists
                  they upload for use in the platform's CRM and outreach tools.
                </p>
                <p>
                  <strong>Information about third parties you provide to us:</strong> If you
                  upload contacts (such as brokers, architects, contractors, or property owners)
                  into the platform's CRM, that information may include names, email addresses,
                  phone numbers, and business affiliations of individuals who are not LandLinq users
                  themselves. If you are one of these individuals and have questions about your
                  information, see "Your Rights and Choices" below.
                </p>
                <p>
                  <strong>Deal and property information:</strong> We collect property details,
                  pricing, and related documents submitted through the platform, forwarded by email,
                  or obtained through automated processing of emails sent to our deal-intake
                  addresses (such as deals@landlinq.ai).
                </p>
                <p>
                  <strong>Connected account information:</strong> If you connect a third-party
                  email account (such as Microsoft Outlook) to use our outreach features, we access
                  only the permissions you explicitly grant during that connection, used solely to
                  send outreach messages on your behalf and, where applicable, read associated
                  delivery status.
                </p>
                <p>
                  <strong>Usage and technical information:</strong> We automatically collect
                  certain technical information, including IP address, browser type, device
                  information, and how you interact with the platform.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-catalyst-dark-blue mb-3">How We Use Your Information</h2>
                <p>We use collected information to provide and improve our services, including to:</p>
                <ul>
                  <li>Create and manage accounts and Investment Company profiles</li>
                  <li>
                    Automatically extract and classify property and deal information from submitted
                    or forwarded emails, including through the use of artificial intelligence and
                    automated parsing tools. Automated classification results are provided as a
                    screening aid and do not constitute a final determination — see our Terms of
                    Service for more on the limitations of automated processing.
                  </li>
                  <li>Match rent and market comparable data to properties</li>
                  <li>Enable outreach messaging sent by you or on your behalf through connected accounts</li>
                  <li>Communicate with you about your account, deals, or platform updates</li>
                  <li>Maintain platform security and prevent misuse</li>
                  <li>Analyze and improve platform performance</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-catalyst-dark-blue mb-3">Information Sharing</h2>
                <p>We do not sell your personal information.</p>
                <p>We may share information with:</p>
                <ul>
                  <li>
                    <strong>Service providers</strong> who help us operate the platform, including
                    providers of AI-based email and document processing, property and market data
                    providers, email delivery and hosting infrastructure, and geocoding services.
                    These providers are authorized to use information only as necessary to provide
                    services to us.
                  </li>
                  <li>
                    <strong>Other LandLinq team members</strong>, for deal evaluation, platform
                    administration, and support purposes.
                  </li>
                  <li>
                    <strong>Legal and safety purposes</strong>, where required by law, subpoena, or
                    other legal process, or to protect the rights, property, or safety of LandLinq,
                    our users, or others.
                  </li>
                </ul>
                <p>
                  <strong>Investment Company data isolation:</strong> Information associated with
                  one Investment Company's account — including their acquisition criteria, contacts,
                  and outreach activity — is kept isolated from other Investment Companies using
                  the platform and is not shared between them.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-catalyst-dark-blue mb-3">Cookies and Tracking Technologies</h2>
                <p>
                  We use cookies and similar technologies to maintain login sessions, remember
                  preferences, and understand platform usage. Outreach emails sent through the
                  platform may include technologies that indicate whether a message was opened or a
                  link was clicked, used to provide delivery and engagement analytics to the sending
                  Investment Company.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-catalyst-dark-blue mb-3">Data Retention</h2>
                <p>
                  We retain information for as long as necessary to provide our services, comply
                  with legal obligations, resolve disputes, and enforce our agreements. Retention
                  periods may vary depending on the type of information and the nature of the
                  relationship with LandLinq.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-catalyst-dark-blue mb-3">Your Rights and Choices</h2>
                <p>
                  Depending on your location and relationship to LandLinq, you may have the right
                  to request access to, correction of, or deletion of your personal information. If
                  your information was uploaded to the platform by an Investment Company or other
                  organization as part of their contact list, please contact us at{" "}
                  <a href="mailto:help@landlinq.ai" className="text-catalyst-gold hover:text-catalyst-gold/80 transition-colors">
                    help@landlinq.ai
                  </a>
                  , and we will work with the relevant organization to address your request.
                </p>
                <p>
                  You may opt out of non-essential email communications using the unsubscribe link
                  included in such communications, where applicable.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-catalyst-dark-blue mb-3">Data Security</h2>
                <p>
                  We implement reasonable administrative, technical, and physical safeguards
                  designed to protect personal information against unauthorized access, alteration,
                  disclosure, or destruction. No method of transmission or storage is completely
                  secure, and we cannot guarantee absolute security.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-catalyst-dark-blue mb-3">Children's Privacy</h2>
                <p>
                  LandLinq is not directed to individuals under the age of 18, and we do not
                  knowingly collect personal information from children.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-catalyst-dark-blue mb-3">Changes to This Policy</h2>
                <p>
                  We may update this Privacy Policy from time to time. We will indicate the date
                  of the most recent revision, and material changes will be communicated as
                  appropriate.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-catalyst-dark-blue mb-3">Contact Us</h2>
                <p>
                  If you have questions about this Privacy Policy, please contact us at{" "}
                  <a href="mailto:help@landlinq.ai" className="text-catalyst-gold hover:text-catalyst-gold/80 transition-colors">
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