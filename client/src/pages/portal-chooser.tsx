import { ArrowRight, Building2, Users } from "lucide-react";

export default function PortalChooser() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center justify-center">
        <div className="w-full">
          <div className="mb-8 text-center">
            <img
              src="/assets/landlinq-color-icon.png"
              alt="LandLinq"
              className="mx-auto mb-5 h-12 w-16 object-contain"
            />
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              Welcome to LandLinq
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Choose your sign-in portal.
            </p>
          </div>

          <div className="space-y-3">
            <a
              href="/auth"
              className="group flex min-h-20 items-center justify-between rounded-lg bg-[#0A2B4A] px-5 py-4 text-white shadow-sm transition-colors hover:bg-[#123d61] focus:outline-none focus:ring-2 focus:ring-[#4A90E2] focus:ring-offset-2"
            >
              <span className="flex items-center gap-4">
                <Users className="h-5 w-5 shrink-0 text-[#9CCBFF]" aria-hidden="true" />
                <span>
                  <span className="block text-sm font-semibold">LandLinq / Apex Team</span>
                  <span className="mt-1 block text-xs text-slate-300">Internal team portal</span>
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </a>

            <a
              href="/auth?mode=login&redirect=%2Fdeveloper%2Fdashboard"
              className="group flex min-h-20 items-center justify-between rounded-lg border border-slate-200 bg-white px-5 py-4 text-slate-900 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#4A90E2] focus:ring-offset-2"
            >
              <span className="flex items-center gap-4">
                <Building2 className="h-5 w-5 shrink-0 text-[#4A90E2]" aria-hidden="true" />
                <span>
                  <span className="block text-sm font-semibold">Investment Company</span>
                  <span className="mt-1 block text-xs text-slate-500">Your company portal</span>
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </a>
          </div>

          <p className="mt-6 text-center text-xs leading-relaxed text-slate-500">
            First time here? Use the branded link provided by your LandLinq contact.
          </p>
        </div>
      </div>
    </main>
  );
}