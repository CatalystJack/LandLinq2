import { Link } from "wouter";

export default function Footer() {
  return (
    <footer className="bg-primary px-5 py-14 text-white sm:px-8 sm:py-20 lg:px-10">
      <div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <Link href="/" className="inline-flex">
            <img
              src="/assets/landlinq-white-logo.png"
              alt="LandLinq"
              className="h-7 w-auto"
              data-testid="footer-logo-landlinq"
            />
          </Link>
          <p className="mt-5 max-w-xs text-sm leading-6 text-white/50">
            Your supercharged
            <br />
            acquisitions operating system.
          </p>
        </div>

        <div>
          <h3 className="mb-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
            Platform
          </h3>
          <div className="flex flex-col gap-3 text-sm text-white/70">
            <a href="/#platform" className="transition-colors hover:text-white">
              Deal Dashboard
            </a>
            <a href="/#platform" className="transition-colors hover:text-white">
              CRM &amp; Outreach
            </a>
            <a href="/#platform" className="transition-colors hover:text-white">
              Analytics
            </a>
          </div>
        </div>

        <div>
          <h3 className="mb-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
            Company &amp; Support
          </h3>
          <div className="flex flex-col gap-3 text-sm text-white/70">
            <Link href="/contact" className="transition-colors hover:text-white">
              Contact us
            </Link>
            <a
              href="mailto:help@landlinq.ai"
              className="transition-colors hover:text-white"
              data-testid="text-email"
            >
              help@landlinq.ai
            </a>
          </div>
        </div>

        <div>
          <h3 className="mb-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
            Legal
          </h3>
          <div className="flex flex-col gap-3 text-sm text-white/70">
            <Link href="/privacy" className="transition-colors hover:text-white" data-testid="footer-link-privacy">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-white" data-testid="footer-link-terms">
              Terms
            </Link>
          </div>
        </div>
      </div>

      <div
        className="mx-auto mt-14 max-w-7xl border-t border-white/15 pt-6 text-xs text-white/35"
        data-testid="text-copyright"
      >
        © {new Date().getFullYear()} LandLinq. All rights reserved.
      </div>
    </footer>
  );
}