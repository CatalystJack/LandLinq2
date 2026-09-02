import { useState } from "react";
import { ArrowRight, Building2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function PortalChooser() {
  const [showInvestmentCompanyNote, setShowInvestmentCompanyNote] = useState(false);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-catalyst-gold/10 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-4xl items-center justify-center">
        <Card className="w-full overflow-hidden border-slate-200/80 shadow-xl">
          <CardHeader className="space-y-4 border-b bg-white/80 px-6 py-8 text-center sm:px-10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-catalyst-gold/15 text-catalyst-gold">
              <Building2 className="h-7 w-7" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl text-catalyst-gray-900 sm:text-3xl">
                Welcome to LandLinq
              </CardTitle>
              <CardDescription className="mx-auto max-w-xl text-base leading-relaxed">
                Choose the portal that matches your LandLinq relationship.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="grid gap-4 p-6 sm:grid-cols-2 sm:p-10">
            <Button
              asChild
              size="lg"
              className="h-auto min-h-28 justify-between whitespace-normal px-5 py-5 text-left normal-case tracking-normal"
            >
              <a href="/auth">
                <span className="flex items-center gap-4">
                  <Users className="h-6 w-6 shrink-0" aria-hidden="true" />
                  <span>
                    <span className="block text-base font-bold">
                      LandLinq / Apex Team Login
                    </span>
                    <span className="mt-1 block text-sm font-normal opacity-85">
                      Access the internal team portal
                    </span>
                  </span>
                </span>
                <ArrowRight className="h-5 w-5 shrink-0" aria-hidden="true" />
              </a>
            </Button>

            <div className="space-y-3">
              <Button
                asChild
                size="lg"
                className="h-auto min-h-28 w-full justify-between whitespace-normal px-5 py-5 text-left normal-case tracking-normal"
              >
                <a href="/auth?mode=login&redirect=%2Fdeveloper%2Fdashboard">
                  <span className="flex items-center gap-4">
                    <Building2 className="h-6 w-6 shrink-0" aria-hidden="true" />
                    <span>
                      <span className="block text-base font-bold">
                        Investment Company Login
                      </span>
                      <span className="mt-1 block text-sm font-normal opacity-85">
                        Sign in to your developer portal
                      </span>
                    </span>
                  </span>
                  <ArrowRight className="h-5 w-5 shrink-0" aria-hidden="true" />
                </a>
              </Button>

              <button
                type="button"
                className="w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-left text-sm leading-relaxed text-catalyst-gray-700 transition-colors hover:bg-slate-50"
                onClick={() => setShowInvestmentCompanyNote((current) => !current)}
                aria-expanded={showInvestmentCompanyNote}
              >
                <span className="font-medium">First time accessing your company portal?</span>{" "}
                Use the branded link provided by your LandLinq contact.
              </button>

              {showInvestmentCompanyNote && (
                <p className="rounded-md border border-catalyst-gold/30 bg-catalyst-gold/10 px-4 py-3 text-sm leading-relaxed text-catalyst-gray-700">
                  Your Investment Company credentials work here after your account has been created through the company link. Returning users can use this Investment Company Login button.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}