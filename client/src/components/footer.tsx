import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";

const landLinqLogo = "/assets/landlinq-white-logo.png";

export default function Footer() {
  return (
    <footer className="bg-catalyst-gray-900 text-white py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
          <div className="text-center md:text-left">
            <h3 className="text-lg font-semibold mb-6">Quick Links</h3>
            <div className="space-y-3 text-catalyst-gray-400">
              <div>
                <Link href="/" className="hover:text-cyan-300 transition-colors" data-testid="footer-link-home">
                  Home
                </Link>
              </div>
              <div>
                <Link href="/about" className="hover:text-cyan-300 transition-colors" data-testid="footer-link-about">
                  About
                </Link>
              </div>
              <div>
                <Link href="/process" className="hover:text-cyan-300 transition-colors" data-testid="footer-link-process">
                  Process
                </Link>
              </div>
              <div>
                <Link href="/criteria" className="hover:text-cyan-300 transition-colors" data-testid="footer-link-criteria">
                  Criteria
                </Link>
              </div>
              <div>
                <Link href="/submit-deal" className="hover:text-cyan-300 transition-colors" data-testid="footer-link-submit-deal">
                  Submit a Deal
                </Link>
              </div>
            </div>
          </div>

          <div className="text-center md:text-left">
            <h3 className="text-lg font-semibold mb-6">Contact Info</h3>
            <div className="space-y-4 text-catalyst-gray-400">
              <div className="flex items-center justify-center md:justify-start">
                <a href="sms:7046101549" className="text-catalyst-gold hover:text-cyan-300 transition-colors" data-testid="text-phone">
                  (704) 610-1549
                </a>
              </div>
              <div className="flex items-center justify-center md:justify-start">
                <a href="mailto:help@landlinq.ai" className="text-catalyst-gold hover:text-cyan-300 transition-colors" data-testid="text-email">
                  help@landlinq.ai
                </a>
              </div>
              <div className="flex items-start justify-center md:justify-start">
                <div>
                  <div data-testid="text-address-line1">1600 Camden Road Suite 200</div>
                  <div data-testid="text-address-line2">Charlotte NC 28203</div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center md:text-left">
            <div className="mb-8 flex justify-center md:justify-start">
              <Link href="/" className="inline-flex items-center">
                <img
                  src={landLinqLogo}
                  alt="LandLinq"
                  className="h-10 w-auto max-w-[190px] object-contain"
                  data-testid="footer-logo-landlinq"
                />
              </Link>
            </div>
            <p className="text-catalyst-gray-400 mb-6 leading-relaxed font-light">
              Accelerating multifamily land acquisition through AI-powered site intelligence and automation.
            </p>
          </div>
        </div>

        <div className="border-t border-catalyst-gray-800 pt-8 mt-12">
          <div className="flex flex-col md:flex-row justify-between items-center text-center md:text-left">
            <p className="text-catalyst-gray-400 text-sm" data-testid="text-copyright">
              © 2026 LandLinq. All rights reserved.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0 text-sm text-catalyst-gray-400 justify-center md:justify-start">
              <a href="/privacy" className="hover:text-white transition-colors" data-testid="footer-link-privacy">
                Privacy Policy
              </a>
              <a href="/terms" className="hover:text-white transition-colors" data-testid="footer-link-terms">
                Terms of Service
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
