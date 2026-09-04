import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  Database,
  Filter,
  Menu,
  MessageSquare,
  Network,
  X,
} from "lucide-react";

const valueProps = [
  "Every lead automatically screened against your own acquisition criteria — no more manually checking rent, acreage, and county fit",
  "Outreach that runs itself, from your own connected email",
  "All your deals and contacts in one place, not scattered across inboxes and spreadsheets",
  "Your team spends its time on the deals that actually clear your bar",
];

const features = [
  {
    eyebrow: "01 / Deal intelligence",
    title: "Deal Dashboard",
    body: "Every deal arrives pre-screened against your own criteria, so your team opens their dashboard already knowing what's worth a second look.",
    icon: Filter,
    signal: "Criteria matched",
    detail: "Review only what clears your bar",
  },
  {
    eyebrow: "02 / Connected action",
    title: "CRM & Outreach",
    body: "Campaigns run from your own connected email, reaching brokers without anyone on your team drafting or sending a single message by hand.",
    icon: MessageSquare,
    signal: "Outreach queue",
    detail: "Ready to run in the background",
  },
  {
    eyebrow: "03 / Operational clarity",
    title: "Pipeline",
    body: "Track any opportunity through stages you define — real estate or otherwise — without a dedicated ops hire to maintain it.",
    icon: Network,
    signal: "Pipeline health",
    detail: "One view from lead to close",
  },
  {
    eyebrow: "04 / Compounding focus",
    title: "Analytics",
    body: "See deal volume, classification, and outreach performance in one view, without pulling it together yourself.",
    icon: BarChart3,
    signal: "Signal, not noise",
    detail: "Make the next decision faster",
  },
];

const faqs = [
  ["What is LandLinq?", "LandLinq is the operating leverage for lean acquisitions teams. It handles sourcing, screening, outreach, and tracking in the background so your people can focus on the deals most likely to succeed."],
  ["Who is LandLinq for?", "LandLinq is built for real estate investment companies and sales teams in any industry that need to cover more ground without adding more operational overhead."],
  ["How does deal classification work?", "LandLinq evaluates incoming opportunities against the acquisition criteria your team defines, then organizes the results so the strongest fits are ready for human review."],
  ["Is my data private from other companies on the platform?", "Yes. Your data, criteria, contacts, and deal activity remain private to your organization."],
  ["Can I use LandLinq for outreach outside real estate?", "Yes. The pipeline and outreach workflow can support sales teams in any industry, wherever opportunity screening and follow-up matter."],
  ["How much of the work does LandLinq actually take off my team?", "LandLinq handles sourcing, screening, and outreach automatically, so your team spends its time only on the deals that clear your criteria — letting a small acquisitions team cover ground that used to take a much larger one."],
];

function PrimaryButton({ children, href = "mailto:help@landlinq.ai" }: { children: ReactNode; href?: string }) {
  return (
    <a href={href} className="group inline-flex min-h-12 items-center justify-center gap-3 rounded-full border border-primary-foreground bg-primary-foreground px-6 text-sm font-semibold text-primary transition-all duration-300 hover:border-primary hover:bg-background hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-primary">
      {children}
      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
    </a>
  );
}

export default function MarketingHome() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [email, setEmail] = useState("");

  return (
    <div className="min-h-[100dvh] overflow-hidden bg-background text-foreground">
      <header className="absolute inset-x-0 top-0 z-30 border-b border-border/70 bg-background">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8 lg:px-10" aria-label="Main navigation">
          <a href="/" aria-label="LandLinq home" className="relative z-10">
            <img src="/assets/landlinq-color-logo.png" alt="LandLinq" className="h-8 w-auto sm:h-9" />
          </a>
          <div className="hidden items-center gap-9 md:flex">
            <a href="#platform" className="text-sm font-medium text-foreground/70 transition-colors hover:text-foreground">Platform</a>
            <a href="#who-its-for" className="text-sm font-medium text-foreground/70 transition-colors hover:text-foreground">Who It's For</a>
            <a href="#company" className="text-sm font-medium text-foreground/70 transition-colors hover:text-foreground">Company</a>
            <Link href="/login" className="rounded-full border border-primary px-5 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground">Log In</Link>
          </div>
          <button type="button" aria-label={menuOpen ? "Close menu" : "Open menu"} onClick={() => setMenuOpen(!menuOpen)} className="relative z-10 rounded-full p-2 text-primary md:hidden">
            {menuOpen ? <X /> : <Menu />}
          </button>
          {menuOpen && (
            <div className="absolute inset-x-4 top-20 rounded-2xl border border-primary-foreground/20 bg-primary p-5 shadow-xl md:hidden">
              <div className="flex flex-col gap-1">
                {["Platform", "Who It's For", "Company"].map((item) => <a key={item} href={item === "Platform" ? "#platform" : item === "Who It's For" ? "#who-its-for" : "#company"} onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-3 text-sm font-medium text-primary-foreground/80 hover:bg-primary-foreground/10">{item}</a>)}
                <Link href="/login" className="mt-2 rounded-xl bg-primary-foreground px-3 py-3 text-center text-sm font-semibold text-primary">Log In</Link>
              </div>
            </div>
          )}
        </nav>
      </header>

      <main>
        <section className="relative flex min-h-[720px] items-end bg-primary pb-20 pt-40 text-primary-foreground sm:min-h-[780px] sm:pb-28 lg:min-h-[860px] lg:pb-32">
          <div className="pointer-events-none absolute -right-40 top-20 h-[520px] w-[520px] rounded-full border border-primary-foreground/10 motion-safe:animate-[spin_35s_linear_infinite]" />
          <div className="pointer-events-none absolute right-24 top-48 h-72 w-72 rounded-full border border-primary-foreground/10 motion-safe:animate-[spin_22s_linear_infinite_reverse]" />
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-primary to-transparent opacity-80" />
          <div className="relative mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10">
            <div className="max-w-5xl">
              <p className="mb-7 text-xs font-semibold uppercase tracking-[0.24em] text-primary-foreground/60 motion-safe:animate-[fadeIn_700ms_ease-out]">Operating leverage for lean acquisitions teams</p>
              <h1 className="max-w-4xl text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.055em] motion-safe:animate-[fadeInUp_800ms_ease-out] sm:text-7xl lg:text-[7.25rem]">We supercharge your acquisitions team.</h1>
              <div className="mt-9 flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
                <p className="max-w-xl text-lg leading-8 text-primary-foreground/72 motion-safe:animate-[fadeInUp_900ms_ease-out] sm:text-xl">So your team only focuses on the deals with the highest probability of success — while LandLinq handles the sourcing, screening, and outreach in the background.</p>
                <div className="flex shrink-0 flex-wrap gap-3 motion-safe:animate-[fadeInUp_1000ms_ease-out]">
                  <PrimaryButton>Get in touch</PrimaryButton>
                  <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-full border border-primary-foreground/30 px-6 text-sm font-semibold text-primary-foreground transition-colors hover:border-primary-foreground hover:bg-primary-foreground hover:text-primary">Log In</Link>
                </div>
              </div>
            </div>
            <div className="mt-24 flex items-center gap-4 text-xs uppercase tracking-[0.2em] text-primary-foreground/45"><span className="h-px w-12 bg-primary-foreground/30" /> Built for teams that would rather make the deal than manage the process</div>
          </div>
        </section>

        <section className="bg-muted/40 py-24 sm:py-32 lg:py-40">
          <div className="mx-auto grid max-w-7xl gap-16 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-24 lg:px-10">
            <div>
              <p className="mb-5 text-xs font-semibold uppercase tracking-[0.22em] text-primary">The old operating model</p>
              <h2 className="max-w-lg text-4xl font-semibold leading-[1.06] tracking-[-0.04em] sm:text-6xl">Acquisitions teams spend most of their time on deals that were never going to work.</h2>
              <p className="mt-8 text-xl font-medium text-primary">LandLinq changes where your time goes.</p>
            </div>
            <div className="divide-y divide-border border-y border-border">
              {valueProps.map((prop, i) => <div key={prop} className="flex gap-5 py-6 text-lg leading-7 text-muted-foreground sm:py-7"><span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span><span>{prop}</span><span className="ml-auto hidden text-xs font-semibold text-primary/45 sm:block">0{i + 1}</span></div>)}
            </div>
          </div>
        </section>

        <section id="platform" className="bg-background py-24 sm:py-32 lg:py-40">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
            <div className="mb-20 max-w-2xl"><p className="mb-5 text-xs font-semibold uppercase tracking-[0.22em] text-primary">The LandLinq platform</p><h2 className="text-4xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-6xl">More signal. Less operational drag.</h2></div>
            <div className="space-y-20 sm:space-y-28">
              {features.map(({ eyebrow, title, body, icon: Icon, signal, detail }, i) => (
                <article key={title} className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-24 ${i % 2 ? "lg:[&>*:first-child]:order-2" : ""}`}>
                  <div className="relative min-h-[280px] overflow-hidden rounded-3xl bg-primary p-7 text-primary-foreground sm:min-h-[360px] sm:p-10">
                    <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full border border-primary-foreground/10" /><div className="absolute -bottom-28 -left-20 h-72 w-72 rounded-full border border-primary-foreground/10" />
                    <Icon className="relative h-8 w-8 text-primary-foreground/70" strokeWidth={1.5} />
                    <div className="relative mt-24 sm:mt-32"><div className="mb-3 text-xs uppercase tracking-[0.2em] text-primary-foreground/50">{signal}</div><div className="flex items-center gap-3 text-xl font-medium"><span className="h-2 w-2 rounded-full bg-primary-foreground/80" />{detail}</div></div>
                  </div>
                  <div className="max-w-xl"><p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p><h3 className="text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{title}</h3><p className="mt-6 text-lg leading-8 text-muted-foreground">{body}</p><div className="mt-8 flex items-center gap-3 text-sm font-semibold text-primary"><span className="h-px w-8 bg-primary" /> Time back for the work that matters</div></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="who-its-for" className="bg-muted/40 py-24 sm:py-32 lg:py-40">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10"><div className="mb-16 max-w-2xl"><p className="mb-5 text-xs font-semibold uppercase tracking-[0.22em] text-primary">Who it's for</p><h2 className="text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">Small teams. Serious coverage.</h2></div><div className="grid gap-5 md:grid-cols-2"><div className="group rounded-3xl bg-primary p-8 text-primary-foreground transition-transform duration-300 hover:-translate-y-1 sm:p-12"><Database className="mb-24 h-8 w-8 text-primary-foreground/65" /><h3 className="text-3xl font-semibold tracking-[-0.03em]">Real Estate Investment Companies</h3><p className="mt-5 max-w-md text-lg leading-8 text-primary-foreground/70">Screen more land and property opportunities against your criteria, then give your team a clean queue of deals worth pursuing.</p></div><div className="group rounded-3xl border border-border bg-background p-8 transition-transform duration-300 hover:-translate-y-1 sm:p-12"><MessageSquare className="mb-24 h-8 w-8 text-primary/65" /><h3 className="text-3xl font-semibold tracking-[-0.03em]">Sales Teams</h3><p className="mt-5 max-w-md text-lg leading-8 text-muted-foreground">Keep every prospect moving with connected outreach, a shared pipeline, and the context your team needs to have better conversations.</p></div></div></div>
        </section>

        <section id="company" className="bg-background py-24 sm:py-32 lg:py-40">
          <div className="mx-auto max-w-3xl px-5 sm:px-8"><div className="mb-14 text-center"><p className="mb-5 text-xs font-semibold uppercase tracking-[0.22em] text-primary">Questions, answered</p><h2 className="text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">Know what you're getting.</h2></div><div className="divide-y divide-border border-y border-border">{faqs.map(([question, answer], i) => <div key={question}><button type="button" onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i} className="flex w-full items-center justify-between gap-5 py-6 text-left text-lg font-semibold transition-colors hover:text-primary"><span>{question}</span><ChevronDown className={`h-5 w-5 shrink-0 text-primary transition-transform duration-300 ${openFaq === i ? "rotate-180" : ""}`} /></button><div className={`grid transition-[grid-template-rows,opacity] duration-300 ${openFaq === i ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}><div className="overflow-hidden"><p className="max-w-2xl pb-6 leading-7 text-muted-foreground">{answer}</p></div></div></div>)}</div></div>
        </section>

        <section className="bg-primary py-24 text-primary-foreground sm:py-32">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_0.75fr] lg:items-end lg:px-10"><div><p className="mb-6 text-xs font-semibold uppercase tracking-[0.22em] text-primary-foreground/55">A better use of your team's time</p><h2 className="max-w-3xl text-5xl font-semibold leading-[1] tracking-[-0.05em] sm:text-7xl">See what a supercharged acquisitions team looks like.</h2><div className="mt-9"><PrimaryButton>Get in touch</PrimaryButton></div></div><form onSubmit={(e) => { e.preventDefault(); if (email) window.location.href = `mailto:help@landlinq.ai?subject=LandLinq%20updates&body=${encodeURIComponent(`Please add ${email} to the LandLinq updates list.`)}`; }} className="rounded-2xl border border-primary-foreground/20 p-6 sm:p-8"><label htmlFor="updates-email" className="text-sm font-medium">Get the occasional LandLinq update.</label><div className="mt-5 flex flex-col gap-3 sm:flex-row"><input id="updates-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="h-12 min-w-0 flex-1 rounded-full border border-primary-foreground/25 bg-transparent px-5 text-base text-primary-foreground outline-none placeholder:text-primary-foreground/45 focus:border-primary-foreground" /><button type="submit" className="h-12 rounded-full bg-primary-foreground px-5 text-sm font-semibold text-primary transition-colors hover:bg-background">Join list</button></div><p className="mt-4 text-xs leading-5 text-primary-foreground/50">Your email client will open to complete the handoff.</p></form></div>
        </section>
      </main>

      <footer className="bg-secondary py-14 text-secondary-foreground sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 md:grid-cols-[1.5fr_1fr_1fr_1fr] lg:px-10"><div><img src="/assets/landlinq-white-logo.png" alt="LandLinq" className="h-8 w-auto" /><p className="mt-6 max-w-xs text-sm leading-6 text-secondary-foreground/55">Operating leverage for lean acquisitions teams.</p></div><div><h3 className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-secondary-foreground/45">Platform</h3><div className="flex flex-col gap-3 text-sm text-secondary-foreground/75"><a href="#platform" className="transition-colors hover:text-secondary-foreground">Deal Dashboard</a><a href="#platform" className="transition-colors hover:text-secondary-foreground">CRM & Outreach</a><a href="#platform" className="transition-colors hover:text-secondary-foreground">Analytics</a></div></div><div><h3 className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-secondary-foreground/45">Company</h3><div className="flex flex-col gap-3 text-sm text-secondary-foreground/75"><a href="#who-its-for" className="transition-colors hover:text-secondary-foreground">Who It's For</a><a href="mailto:help@landlinq.ai" className="transition-colors hover:text-secondary-foreground">Contact</a></div></div><div><h3 className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-secondary-foreground/45">Legal</h3><div className="flex flex-col gap-3 text-sm text-secondary-foreground/75"><Link href="/privacy" className="transition-colors hover:text-secondary-foreground">Privacy</Link><Link href="/terms" className="transition-colors hover:text-secondary-foreground">Terms</Link></div></div></div>
        <div className="mx-auto mt-16 max-w-7xl border-t border-secondary-foreground/15 px-5 pt-6 text-xs text-secondary-foreground/40 sm:px-8 lg:px-10">© {new Date().getFullYear()} LandLinq. All rights reserved.</div>
      </footer>
    </div>
  );
}