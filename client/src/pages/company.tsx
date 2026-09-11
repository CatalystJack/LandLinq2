import Navigation from "@/components/navigation";
import Footer from "@/components/footer";
import SEO from "@/components/SEO";

const trackRecord = [
  ["18,000+", "Units developed"],
  ["12", "Projects under development"],
  ["$1.5B", "In development"],
  ["$5.5B", "In real estate transactions"],
];

export default function CompanyPage() {
  return (
    <div className="min-h-[100dvh] bg-white font-sans text-[#081729]">
      <SEO
        title="Company"
        description="LandLinq is built by investors with an average of 15+ years of multifamily real estate experience."
        url="https://landlinq.ai/company"
      />
      <Navigation hideSubmitDeal />

      <main>
        <section className="relative overflow-hidden border-b border-slate-200 bg-white px-5 py-16 sm:px-8 sm:py-24 lg:px-10 lg:py-32">
          <div className="absolute -right-32 -top-40 h-[30rem] w-[30rem] rounded-full bg-[#498EDE]/10 blur-3xl" />
          <div className="absolute -bottom-48 -left-32 h-[26rem] w-[26rem] rounded-full bg-[#081729]/5 blur-3xl" />
          <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_0.72fr] lg:items-end lg:gap-20">
            <div>
              <h1 className="max-w-4xl text-5xl font-semibold leading-[0.98] tracking-[-0.05em] text-[#081729] sm:text-7xl lg:text-[6.25rem]">
                Built by investors, not developers watching from the outside.
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
                With an average of 15+ years of multifamily real estate experience, our team brings deep expertise in development, acquisitions, capital markets, and investment sales.
              </p>
            </div>

            <div className="border-l-2 border-[#498EDE] pl-7 sm:pl-10">
              <p className="text-[7rem] font-semibold leading-none tracking-[-0.08em] text-[#498EDE] sm:text-[9rem]">15+</p>
              <p className="mt-3 max-w-xs text-lg leading-7 text-slate-700">
                years of average multifamily real estate experience
              </p>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-slate-50 px-5 py-12 sm:px-8 lg:px-10 lg:py-16" aria-label="LandLinq track record">
          <div className="mx-auto grid max-w-7xl gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
            {trackRecord.map(([value, label], index) => (
              <div
                key={label}
                 className={`px-0 sm:px-6 lg:px-8 ${index > 0 ? "lg:border-l lg:border-slate-200" : ""}`}
              >
                <p className="text-4xl font-semibold leading-none tracking-[-0.04em] text-[#081729] sm:text-5xl">{value}</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="px-5 py-20 sm:px-8 sm:py-28 lg:px-10 lg:py-36">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24">
            <div>
               <p className="text-sm font-semibold text-[#498EDE]">The founding story</p>
               <h2 className="mt-5 max-w-md text-4xl font-semibold leading-[1.02] tracking-[-0.04em] text-[#081729] sm:text-6xl">
                We&apos;re investors first, technologists second.
              </h2>
            </div>
             <div className="max-w-3xl border-t border-slate-300 pt-7 sm:pt-9">
               <p className="text-2xl leading-[1.35] tracking-[-0.02em] text-slate-700 sm:text-4xl">
                We built LandLinq because we lived the frustrations of traditional deal flow — the endless emails, the weeks of waiting, the missed opportunities. Now we&apos;re solving it with AI-powered automation that respects the human relationships at the heart of every deal.
              </p>
            </div>
          </div>
        </section>

        <section id="founders" className="border-y border-slate-200 bg-slate-50 px-5 py-16 sm:px-8 sm:py-24 lg:px-10">
          <div className="mx-auto max-w-7xl">
             <h2 className="text-4xl font-semibold leading-[1.02] tracking-[-0.04em] text-[#081729] sm:text-5xl">
              Founders
            </h2>
            <div className="mt-10 grid gap-8 sm:grid-cols-2 sm:gap-12 lg:mt-14 lg:gap-20">
               <div className="border-t border-slate-300 pt-5">
                 <p className="text-3xl font-semibold tracking-[-0.03em] text-[#081729] sm:text-4xl">Jack Berg</p>
                 <p className="mt-2 text-base text-slate-600">Co-Founder</p>
              </div>
               <div className="border-t border-slate-300 pt-5">
                 <p className="text-3xl font-semibold tracking-[-0.03em] text-[#081729] sm:text-4xl">AJ Klenk</p>
                 <p className="mt-2 text-base text-slate-600">Co-Founder</p>
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 pb-16 sm:px-8 sm:pb-24 lg:px-10">
             <div className="mx-auto max-w-7xl rounded-[2rem] bg-[#081729] px-6 py-14 text-white sm:px-12 sm:py-20 lg:px-20">
            <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-16">
              <div>
                 <h2 className="max-w-3xl text-4xl font-semibold leading-[1.02] tracking-[-0.04em] sm:text-6xl">
                  See what a supercharged acquisitions team looks like.
                </h2>
                <p className="mt-6 max-w-xl text-base leading-7 text-white/65 sm:text-lg">
                  Tell us a little about what your team is trying to solve. We&apos;ll be in touch.
                </p>
              </div>
              <a
                href="/contact"
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-white bg-white px-6 text-sm font-semibold text-[#498EDE] transition-all hover:border-white hover:bg-white hover:text-[#498EDE]"
              >
                Get in touch
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}