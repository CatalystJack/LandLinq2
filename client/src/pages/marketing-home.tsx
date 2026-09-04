import { useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  CircleCheck,
  FileSearch,
  Mail,
  Menu,
  Network,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

const faqs = [
  ["What is LandLinq?", "LandLinq is operating leverage for lean acquisitions teams. It handles sourcing, screening, outreach, and tracking in the background so your people can focus on the deals most likely to succeed."],
  ["Who is LandLinq for?", "LandLinq is built for real estate investment companies and sales teams in any industry that need to cover more ground without adding operational overhead."],
  ["How does deal classification work?", "LandLinq evaluates incoming opportunities against the acquisition criteria your team defines, then organizes the results so the strongest fits are ready for human review."],
  ["Is my data private from other companies on the platform?", "Yes. Your data, criteria, contacts, and deal activity remain private to your organization."],
  ["Can I use LandLinq for outreach outside real estate?", "Yes. The pipeline and outreach workflow can support sales teams in any industry, wherever opportunity screening and follow-up matter."],
  ["How much of the work does LandLinq take off my team?", "LandLinq handles sourcing, screening, and outreach automatically, so your team spends its time only on the deals that clear your criteria."],
];

function Button({ children, href = "mailto:help@landlinq.ai", dark = false }: { children: ReactNode; href?: string; dark?: boolean }) {
  return (
    <a href={href} className={`group inline-flex min-h-12 items-center justify-center gap-3 rounded-full border px-5 text-sm font-semibold transition-all duration-300 ${dark ? "border-primary bg-primary text-white hover:border-catalyst-blue hover:bg-white hover:text-catalyst-blue" : "border-catalyst-blue bg-catalyst-blue text-white hover:bg-white hover:text-catalyst-blue"}`}>
      {children}<ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
    </a>
  );
}

function DashboardMockup({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`ll-window relative overflow-hidden rounded-[1.1rem] border border-white/15 bg-[#f6f8fa] text-[#183047] shadow-2xl ${compact ? "min-h-[280px]" : "min-h-[430px]"}`}>
      <div className="flex h-10 items-center gap-2 border-b border-[#dbe3e9] bg-[#fff] px-4">
        <span className="h-2.5 w-2.5 rounded-full bg-[#c5ced5]" /><span className="h-2.5 w-2.5 rounded-full bg-[#c5ced5]" /><span className="h-2.5 w-2.5 rounded-full bg-[#c5ced5]" />
        <div className="ml-4 flex h-5 w-44 items-center rounded bg-[#f0f3f5] px-2 text-[8px] text-[#81909d]">app.landlinq.ai / deals</div>
      </div>
      <div className="flex">
        <aside className="hidden w-36 shrink-0 border-r border-[#dbe3e9] bg-[#fff] p-4 sm:block">
          <div className="mb-8 flex items-center gap-2 text-[10px] font-bold text-[#183047]"><span className="h-4 w-4 rounded bg-primary" /> LandLinq</div>
          {["Overview", "Deals", "Contacts", "Outreach", "Analytics"].map((item, i) => <div key={item} className={`mb-2 flex items-center gap-2 rounded px-2 py-2 text-[9px] ${i === 1 ? "bg-[#eaf0f4] font-semibold text-primary" : "text-[#7b8a96]"}`}><span className="h-2 w-2 rounded-sm border border-current" />{item}</div>)}
        </aside>
        <div className="min-w-0 flex-1 p-4 sm:p-6">
          <div className="flex items-start justify-between"><div><div className="text-[9px] uppercase tracking-[0.16em] text-[#83919b]">Deal dashboard</div><div className="mt-1 text-lg font-semibold tracking-tight">Opportunities</div></div><button className="rounded border border-[#d5dfe5] bg-white px-2 py-1 text-[9px] text-[#526574]"><SlidersHorizontal className="mr-1 inline h-3 w-3" /> Filter</button></div>
          <div className="mt-5 grid grid-cols-3 gap-2"><div className="rounded border border-[#dce4e9] bg-white p-3"><div className="text-[8px] text-[#84929d]">Ready for review</div><div className="mt-1 text-xl font-semibold">18</div></div><div className="rounded border border-[#dce4e9] bg-white p-3"><div className="text-[8px] text-[#84929d]">Criteria matched</div><div className="mt-1 text-xl font-semibold">72%</div></div><div className="rounded border border-[#dce4e9] bg-white p-3"><div className="text-[8px] text-[#84929d]">Outreach queued</div><div className="mt-1 text-xl font-semibold">34</div></div></div>
          <div className="mt-5 overflow-hidden rounded border border-[#dce4e9] bg-white"><div className="grid grid-cols-[1.5fr_1fr_0.8fr] border-b border-[#e5ebef] px-3 py-2 text-[8px] uppercase tracking-wider text-[#8896a0]"><span>Opportunity</span><span>Fit</span><span>Status</span></div>{[["North County parcel", "Strong", "Review"], ["Riverside infill", "Strong", "Outreach"], ["Oak Street holdings", "Needs review", "New"], ["Westlake acreage", "Strong", "Review"]].map(([name, fit, status]) => <div key={name} className="grid grid-cols-[1.5fr_1fr_0.8fr] items-center border-b border-[#eef2f4] px-3 py-3 text-[9px] last:border-0"><span className="font-medium">{name}</span><span className={fit === "Strong" ? "text-catalyst-blue" : "text-primary"}><CircleCheck className="mr-1 inline h-3 w-3" />{fit}</span><span className="text-[#6e7e89]">{status}</span></div>)}</div>
        </div>
      </div>
    </div>
  );
}

function OutreachMockup() {
  return <div className="ll-product-frame mt-8 overflow-hidden rounded-xl border border-border bg-background"><div className="flex items-center justify-between border-b border-border px-4 py-3"><div className="text-[10px] font-semibold">Outreach workspace</div><div className="rounded border border-border px-2 py-1 text-[9px] text-muted-foreground">All campaigns</div></div><div className="grid md:grid-cols-[0.9fr_1.1fr]"><div className="border-b border-border p-4 md:border-b-0 md:border-r"><div className="mb-3 flex items-center justify-between text-[9px] uppercase tracking-wider text-muted-foreground"><span>Campaigns</span><span className="text-primary">New</span></div>{[["Land owner follow-up", "Active", "12 queued"], ["Broker introduction", "Draft", "8 contacts"], ["New opportunity reply", "Active", "5 queued"]].map(([name, status, count], i) => <div key={name} className={`mb-2 rounded-lg p-3 ${i === 0 ? "bg-muted/70" : "border border-border"}`}><div className="text-[10px] font-semibold">{name}</div><div className="mt-2 flex justify-between text-[9px] text-muted-foreground"><span>{status}</span><span>{count}</span></div></div>)}</div><div className="p-4"><div className="flex items-start justify-between"><div><div className="text-[9px] uppercase tracking-wider text-muted-foreground">Selected campaign</div><div className="mt-1 text-sm font-semibold">Land owner follow-up</div></div><span className="rounded-full bg-primary/10 px-2 py-1 text-[9px] text-primary">Active</span></div><div className="mt-5 rounded-lg border border-border p-3"><div className="mb-2 flex items-center gap-2 text-[9px] font-semibold"><Mail className="h-3 w-3 text-primary" /> Connected email</div><p className="text-[10px] leading-5 text-muted-foreground">Follow-up is queued from your connected email after criteria review.</p></div><div className="mt-4 grid grid-cols-3 gap-2 text-[9px]"><div className="rounded border border-border p-2"><div className="text-muted-foreground">Queued</div><div className="mt-1 text-sm font-semibold">12</div></div><div className="rounded border border-border p-2"><div className="text-muted-foreground">Needs review</div><div className="mt-1 text-sm font-semibold">3</div></div><div className="rounded border border-border p-2"><div className="text-muted-foreground">Last run</div><div className="mt-1 text-sm font-semibold">Today</div></div></div></div></div></div>;
}

function PipelineMockup() {
  const columns: Array<[string, string[]]> = [["New", ["North County parcel", "Riverside infill"]], ["Review", ["Oak Street holdings", "Westlake acreage"]], ["Outreach", ["Industrial edge lot"]], ["Qualified", ["County road parcel"]]];
  return <div className="ll-product-frame mt-8 overflow-hidden rounded-xl border border-white/15 bg-white/[0.06]"><div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><div className="text-[10px] font-semibold text-white">Pipeline view</div><div className="flex gap-2 text-[9px] text-white/55"><span>All criteria</span><span>•</span><span>Updated today</span></div></div><div className="grid min-w-[560px] grid-cols-4 gap-2 p-3">{columns.map(([label, cards]) => <div key={label} className="rounded-lg bg-white/[0.05] p-2"><div className="mb-3 flex items-center justify-between text-[9px] text-white/55"><span>{label}</span><span>{(cards as string[]).length}</span></div>{(cards as string[]).map((card, i) => <div key={card} className="mb-2 rounded border border-white/10 bg-primary px-2 py-3 text-[9px] text-white/80"><div className="font-semibold text-white">{card}</div><div className="mt-2 flex items-center justify-between text-white/40"><span>{i % 2 === 0 ? "Criteria match" : "Needs review"}</span><span>→</span></div></div>)}</div>)}</div></div>;
}

function FlowDiagram() {
  const nodes = [["01", "Lead sources", "Inbound opportunities"], ["02", "Your criteria", "Rent, acreage, county fit"], ["03", "LandLinq", "Screen · organize · activate"], ["04", "Your team", "Review the right deals"]];
  return <div className="mt-12 grid gap-2 md:grid-cols-4">{nodes.map(([num, title, body], i) => <div key={num} className="relative"><div className={`h-full rounded-xl border p-5 ${i === 2 ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"}`}><div className="mb-8 flex items-center justify-between text-[10px] font-semibold tracking-[0.18em] opacity-55"><span>{num}</span>{i < 3 && <ArrowRight className="hidden h-4 w-4 md:block" />}</div><div className="text-sm font-semibold">{title}</div><div className={`mt-2 text-xs leading-5 ${i === 2 ? "text-white/65" : "text-muted-foreground"}`}>{body}</div></div></div>)}</div>;
}

export default function MarketingHome() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);
  return (
    <div className="min-h-[100dvh] overflow-hidden bg-background text-foreground">
      <header className="absolute inset-x-0 top-0 z-30">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10" aria-label="Main navigation">
          <a href="/" aria-label="LandLinq home"><img src="/assets/landlinq-white-logo.png" alt="LandLinq" className="h-7 w-auto" /></a>
          <div className="hidden items-center gap-8 md:flex"><a href="#platform" className="text-sm text-white/65 hover:text-white">Platform</a><a href="#who-its-for" className="text-sm text-white/65 hover:text-white">Who It's For</a><a href="#company" className="text-sm text-white/65 hover:text-white">Company</a><Link href="/login" className="rounded-full border border-white/35 px-4 py-2 text-sm font-semibold text-white hover:bg-white hover:text-primary">Log In</Link></div>
          <button type="button" aria-label={menuOpen ? "Close menu" : "Open menu"} onClick={() => setMenuOpen(!menuOpen)} className="rounded-full p-2 text-primary-foreground md:hidden">{menuOpen ? <X /> : <Menu />}</button>
          {menuOpen && <div className="absolute inset-x-4 top-16 rounded-2xl border border-white/15 bg-primary p-4 shadow-xl md:hidden"><div className="flex flex-col gap-1">{[["Platform", "#platform"], ["Who It's For", "#who-its-for"], ["Company", "#company"]].map(([label, href]) => <a key={label} href={href} onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-3 text-sm text-white/80">{label}</a>)}<Link href="/login" className="mt-2 rounded-lg bg-white px-3 py-3 text-center text-sm font-semibold text-primary">Log In</Link></div></div>}
        </nav>
      </header>

      <main>
        <section className="relative bg-primary px-5 pb-16 pt-32 text-primary-foreground sm:px-8 sm:pb-24 sm:pt-40 lg:px-10">
          <div className="ll-grid absolute inset-0 opacity-20" /><div className="relative mx-auto max-w-7xl">
            <div className="grid items-end gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:gap-10"><div className="max-w-2xl"><p className="ll-reveal mb-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">The acquisitions operating system</p><h1 className="ll-reveal ll-delay-1 text-balance text-5xl font-semibold leading-[0.96] tracking-[-0.06em] sm:text-7xl lg:text-[6.5rem]">Find the deal.<br /><span className="text-white/45">Skip the drag.</span></h1><p className="ll-reveal ll-delay-2 mt-8 max-w-lg text-lg leading-8 text-white/68">LandLinq opens the lead funnel wide, screens opportunities against your criteria, and keeps outreach moving — so lean teams can do more with less.</p><div className="ll-reveal ll-delay-3 mt-9 flex flex-wrap gap-3"><Button>Get in touch</Button><Link href="/login" className="inline-flex min-h-12 items-center rounded-full border border-white/30 px-5 text-sm font-semibold hover:border-white">Log In</Link></div></div><div className="ll-reveal ll-delay-2 ll-product-float relative lg:translate-y-10"><div className="absolute -inset-5 rounded-[1.5rem] bg-white/5 blur-2xl" /><DashboardMockup /></div></div>
            <div className="mt-20 flex items-center gap-4 text-[10px] uppercase tracking-[0.2em] text-white/45"><span className="h-px w-10 bg-white/30" /> More coverage without more operational overhead</div>
          </div>
        </section>

        <section data-reveal className="ll-scroll-reveal bg-muted/40 px-5 py-24 sm:px-8 sm:py-32 lg:px-10 lg:py-40"><div className="mx-auto max-w-7xl"><div className="max-w-3xl"><p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">From scattered work to clear action</p><h2 className="text-4xl font-semibold leading-[1.02] tracking-[-0.05em] sm:text-6xl">Your funnel is wide.<br />Your attention should not be.</h2><p className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground">Manual screening, one-off follow-up, and disconnected deal notes make good opportunities easy to miss. LandLinq gives every lead a path forward.</p></div><FlowDiagram /></div></section>

        <section id="platform" data-reveal className="ll-scroll-reveal bg-background px-5 py-24 sm:px-8 sm:py-32 lg:px-10 lg:py-40"><div className="mx-auto max-w-7xl"><div className="mb-20 flex flex-col justify-between gap-6 lg:flex-row lg:items-end"><div><p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">Inside the platform</p><h2 className="max-w-2xl text-4xl font-semibold leading-[1.02] tracking-[-0.05em] sm:text-6xl">The work moves.<br />Your team moves up.</h2></div><p className="max-w-sm text-base leading-7 text-muted-foreground">One connected workflow for sourcing, screening, outreach, and the decisions that follow.</p></div>
          <div className="grid gap-8 lg:grid-cols-12"><div className="ll-panel-dark lg:col-span-7"><div className="mb-10 flex items-start justify-between"><div><div className="text-[10px] uppercase tracking-[0.2em] text-white/45">01 / Deal intelligence</div><h3 className="mt-3 text-3xl font-semibold tracking-tight">Deal Dashboard</h3></div><FileSearch className="h-7 w-7 text-white/55" /></div><p className="max-w-md text-base leading-7 text-white/65">Every deal arrives pre-screened against your own criteria, so your team knows what is worth a second look.</p><div className="mt-10"><DashboardMockup compact /></div></div><div className="flex flex-col gap-8 lg:col-span-5"><div className="ll-panel-paper flex-1"><Mail className="mb-8 h-7 w-7 text-primary" /><div className="text-[10px] uppercase tracking-[0.2em] text-primary">02 / Connected action</div><h3 className="mt-3 text-3xl font-semibold tracking-tight">CRM & Outreach</h3><p className="mt-5 text-base leading-7 text-muted-foreground">Campaigns run from your own connected email, reaching brokers without anyone drafting or sending each message by hand.</p><OutreachMockup /></div><div className="ll-panel-navy"><div className="flex items-start justify-between"><div><div className="text-[10px] uppercase tracking-[0.2em] text-white/45">03 / Operational clarity</div><h3 className="mt-3 text-3xl font-semibold tracking-tight">Pipeline</h3></div><Network className="h-7 w-7 text-white/55" /></div><p className="mt-6 text-base leading-7 text-white/65">Track opportunities through stages you define without a dedicated ops hire to maintain it.</p><PipelineMockup /></div></div></div>
          <div className="mt-8 grid gap-8 lg:grid-cols-2"><div className="ll-panel-paper"><div className="flex items-start justify-between"><div><div className="text-[10px] uppercase tracking-[0.2em] text-primary">04 / Compounding focus</div><h3 className="mt-3 text-3xl font-semibold tracking-tight">Analytics</h3></div><BarChart3 className="h-7 w-7 text-primary" /></div><p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">See deal volume, classification, and outreach performance in one view, without pulling it together yourself.</p><div className="mt-8 flex h-28 items-end gap-2 border-b border-border px-4">{[35, 58, 42, 73, 61, 88, 76, 95, 82].map((h, i) => <div key={i} className="flex-1 rounded-t bg-primary/80" style={{ height: `${h}%` }} />)}</div></div><div className="ll-panel-outline flex flex-col justify-between"><div><Search className="mb-10 h-7 w-7 text-primary" /><div className="text-[10px] uppercase tracking-[0.2em] text-primary">The result</div><h3 className="mt-3 max-w-sm text-3xl font-semibold tracking-tight">More time for the deals that clear your bar.</h3></div><div className="mt-10 flex items-center gap-2 text-sm font-semibold text-primary"><Check className="h-4 w-4" /> Sourcing, screening, and outreach in the background</div></div></div>
        </div></section>

        <section id="who-its-for" data-reveal className="ll-scroll-reveal bg-primary px-5 py-24 text-primary-foreground sm:px-8 sm:py-32 lg:px-10 lg:py-40"><div className="mx-auto max-w-7xl"><div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]"><div><p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">Built for the people doing the work</p><h2 className="text-4xl font-semibold leading-[1.02] tracking-[-0.05em] sm:text-6xl">Small team.<br />Serious coverage.</h2></div><div className="grid gap-5 sm:grid-cols-2"><div className="rounded-2xl border border-white/15 bg-white/[0.06] p-7"><div className="mb-16 text-xs uppercase tracking-[0.2em] text-white/45">Real estate investment companies</div><h3 className="text-2xl font-semibold">Open the funnel wide.</h3><p className="mt-4 text-base leading-7 text-white/65">Screen more land and property opportunities against your criteria, then give your team a clean queue of deals worth pursuing.</p></div><div className="rounded-2xl border border-white/15 p-7"><div className="mb-16 text-xs uppercase tracking-[0.2em] text-white/45">Sales teams</div><h3 className="text-2xl font-semibold">Keep opportunity moving.</h3><p className="mt-4 text-base leading-7 text-white/65">Keep every prospect moving with connected outreach, a shared pipeline, and the context for better conversations.</p></div></div></div></div></section>

        <section id="company" data-reveal className="ll-scroll-reveal bg-background px-5 py-24 sm:px-8 sm:py-32 lg:px-10 lg:py-40"><div className="mx-auto max-w-3xl"><div className="mb-14"><p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">Questions, answered</p><h2 className="text-4xl font-semibold tracking-[-0.05em] sm:text-6xl">Know what you're getting.</h2></div><div className="divide-y divide-border border-y border-border">{faqs.map(([question, answer], i) => <div key={question}><button type="button" onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i} className="flex w-full items-center justify-between gap-5 py-6 text-left text-base font-semibold sm:text-lg"><span>{question}</span><ChevronDown className={`h-5 w-5 shrink-0 text-primary transition-transform duration-300 ${openFaq === i ? "rotate-180" : ""}`} /></button><div className={`grid transition-[grid-template-rows,opacity] duration-300 ${openFaq === i ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}><div className="overflow-hidden"><p className="max-w-2xl pb-6 leading-7 text-muted-foreground">{answer}</p></div></div></div>)}</div></div></section>

        <section data-reveal className="ll-scroll-reveal bg-muted/40 px-5 py-24 sm:px-8 sm:py-32 lg:px-10"><div className="mx-auto max-w-7xl rounded-3xl bg-primary p-8 text-primary-foreground sm:p-14 lg:p-20"><div className="grid gap-12 lg:grid-cols-[1fr_0.65fr] lg:items-end"><div><p className="mb-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">Make the next decision faster</p><h2 className="max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.06em] sm:text-7xl">See what a supercharged acquisitions team looks like.</h2><div className="mt-9"><Button>Get in touch</Button></div></div><form onSubmit={(e) => { e.preventDefault(); if (email) { setSubmitted(true); window.location.href = `mailto:help@landlinq.ai?subject=LandLinq%20updates&body=${encodeURIComponent(`Please add ${email} to the LandLinq updates list.`)}`; } }} className="rounded-2xl border border-white/20 p-6"><label htmlFor="updates-email" className="text-sm font-medium">Get the occasional LandLinq update.</label>{submitted ? <p className="mt-5 text-sm text-white/65">Your email client is ready to complete the handoff.</p> : <><div className="mt-5 flex flex-col gap-3 sm:flex-row"><input id="updates-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="h-12 min-w-0 flex-1 rounded-full border border-white/25 bg-transparent px-5 text-base text-white outline-none placeholder:text-white/40" /><button type="submit" className="h-12 rounded-full bg-white px-5 text-sm font-semibold text-primary">Join list</button></div><p className="mt-4 text-xs leading-5 text-white/45">Your email client will open to complete the handoff.</p></>}</form></div></div></section>
      </main>
      <footer className="bg-primary px-5 py-14 text-white sm:px-8 sm:py-20 lg:px-10"><div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-[1.5fr_1fr_1fr_1fr]"><div><img src="/assets/landlinq-white-logo.png" alt="LandLinq" className="h-7 w-auto" /><p className="mt-5 max-w-xs text-sm leading-6 text-white/50">Operating leverage for lean acquisitions teams.</p></div><div><h3 className="mb-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">Platform</h3><div className="flex flex-col gap-3 text-sm text-white/70"><a href="#platform">Deal Dashboard</a><a href="#platform">CRM & Outreach</a><a href="#platform">Analytics</a></div></div><div><h3 className="mb-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">Company</h3><div className="flex flex-col gap-3 text-sm text-white/70"><a href="#who-its-for">Who It's For</a><a href="mailto:help@landlinq.ai">Contact</a></div></div><div><h3 className="mb-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">Legal</h3><div className="flex flex-col gap-3 text-sm text-white/70"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div></div></div><div className="mx-auto mt-14 max-w-7xl border-t border-white/15 pt-6 text-xs text-white/35">© {new Date().getFullYear()} LandLinq. All rights reserved.</div></footer>
    </div>
  );
}