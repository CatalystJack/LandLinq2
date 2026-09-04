import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleCheck,
  Menu,
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
    <a href={href} className={`group inline-flex min-h-12 items-center justify-center gap-3 rounded-full border px-5 text-sm font-semibold transition-all duration-300 ${dark ? "border-primary bg-primary text-white hover:border-landlinq-sky hover:bg-white hover:text-landlinq-blue" : "border-landlinq-sky bg-landlinq-sky text-primary hover:border-landlinq-blue hover:bg-white hover:text-landlinq-blue"}`}>
      {children}<ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
    </a>
  );
}

const contactRows = [
  ["SU", "System Unassigned", "system@catalystcp.com", "—", "3"],
  ["AT", "Apex Tester", "apextest_1783361027143@example.com", "—", "0"],
  ["JS", "Jane Smith", "jane@get.com", "Test Co", "0"],
  ["DS", "Dean Smith", "dean.smith@mrk.com", "Newmark", "0"],
  ["JS", "Jay Snover", "jsnover@legacycre.com", "Legacy Real Estate Advisors", "0"],
];

function ContactDirectoryMockup() {
  return (
    <div className="ll-app-frame ll-contact-directory">
      <div className="ll-app-titlebar"><div><b>◈</b><span>Contacts</span><small>RELATIONSHIP DIRECTORY</small></div><strong>784 total</strong><button>+ NEW CONTACT</button></div>
      <div className="ll-contact-filters"><span className="ll-search-box">⌕&nbsp; Search name, email, phone...</span><span>All tags　›</span><span>+ Tag</span><span>All SMS　⌄</span><span>All States　⌄</span><span>All MSAs　⌄</span><span>All Counties　⌄</span><span>All Reps　⌄</span></div>
      <div className="ll-contact-table">
        <div className="ll-contact-head"><span>□</span><span>CONTACT</span><span>REACH</span><span>ORGANIZATION</span><span>SIGNALS</span><span>OWNER</span><span>DEALS</span><span>ADDED</span></div>
        {contactRows.map(([initials, name, email, company, deals], i) => <div className={`ll-contact-row ll-contact-row-${i}`} key={name}><span>□</span><span className="ll-person"><i>{initials}</i><b>{name}<em>ACTIVE</em></b></span><span className="ll-reach">▧ {email}{i > 2 && <small>⌕ (704) 373-1800</small>}</span><span>{company}</span><span className="ll-signal">{i > 2 ? "AJ · Known Sophisticated　CRE Broker" : "—"}</span><span>{i > 2 ? "♧ AJ Klenk" : "—"}</span><span>{deals}</span><span>Apr 15, 26　›</span></div>)}
      </div>
    </div>
  );
}

function ContactDetailMockup() {
  return (
    <div className="ll-app-frame ll-contact-detail">
      <div className="ll-detail-nav"><b>▰ LandLinq</b><span>Deal Dashboard　 <i>CRM</i>　 Outreach Analytics　 Outreach Setup　 Data Hub　 Analytics</span><button>SIGN OUT</button></div>
      <div className="ll-detail-hero"><small>‹ Back to contacts</small><div className="ll-detail-person"><i>SU</i><b>System<br /><small>Company / brokerage</small></b><b>Unassigned<br /><small>• Unassigned</small></b><span>✉ Email　　✎ Edit　 <strong> SAVE CHANGES </strong></span></div><div className="ll-detail-meta"><span>PHONE<br /><b>—</b></span><span>EMAIL<br /><b>system@catalystcp.com</b></span><span>COMPANY<br /><b>—</b></span><span>LAST CONTACTED<br /><b>—</b></span></div></div>
      <div className="ll-detail-body"><aside><small>RECORD</small><b>Contact details</b>{[["NAME", "System Unassigned"], ["EMAIL", "system@catalystcp.com"], ["PHONE", "Phone number"], ["ACCOUNT / COMPANY", "No company assigned"], ["ASSIGNED TO", "Assign to team member..."], ["CONTACT TYPE", "Broker contact"], ["LEAD SOURCE", "—"], ["LAST CONTACTED", "—"]].map(([a, b]) => <label key={a}>{a}<strong>{b}</strong></label>)}</aside><main><div className="ll-detail-tabs"><b>Overview</b><span>Activity</span></div><div className="ll-detail-cards"><div><small>CREATED</small><b>Sep 4, 2026</b></div><div><small>TYPE</small><b>Broker contact</b></div><div><small>DEALS</small><b>3</b></div><div><small>CAMPAIGNS</small><b>0</b></div></div><div className="ll-detail-event"><i>♧</i><b>Contact created</b><small>Added via manual entry · 9/4/2026</small></div><div className="ll-detail-section"><small>ORGANIZATION</small><b>Tags</b><span>Add tag...　＋</span></div><div className="ll-detail-section"><small>OUTREACH</small><b>Campaigns</b><span>AJ - Unknown Sophisticated　 • Brian - Known Sophisticated　 • TEST - Drip Flow Validation</span></div></main></div>
    </div>
  );
}

function OutreachAnalyticsMockup() {
  return (
    <div className="ll-app-frame ll-outreach-analytics">
      <div className="ll-analytics-back">← Outreach Management <button>⟳ Refresh</button></div><h3>▱ Outreach Analytics</h3><p>Email send activity, sender health, and drip campaign status</p>
      <div className="ll-periods"><span>Today</span><span>7 Days</span><b>30 Days</b><span>YTD</span></div>
      <div className="ll-metric-grid"><div><i>➤</i><small>EMAILS SENT</small><b className="ll-metric-number">0</b><em>0 failed · 0 contacts reached</em></div><div><i>⌁</i><small>CONTACTS REACHED</small><b className="ll-metric-number">0</b><em>Unique contacts emailed</em></div><div><i>ϟ</i><small>AVG STEPS / CONTACT</small><b>—</b><em>Email steps per enrolled contact</em></div><div><i>♧</i><small>IN DRIP SEQUENCES</small><b>178</b><em>0 due today</em></div></div>
      <div className="ll-analytics-lower"><div className="ll-volume"><b>Daily Send Volume</b><span>ⓘ<br /><small>No send data for this period yet.</small></span><div className="ll-volume-bars"><i/><i/><i/><i/><i/><i/></div></div><div className="ll-drip"><b>◷ Drip Enrollment Status</b><span>◷ Pending <strong>178</strong></span><span>⌁ In Progress <strong>0</strong></span><span>✓ Completed <strong>0</strong></span><span>⊗ Failed <strong>0</strong></span><hr/><span>Due today <strong>0</strong></span><span>Due now <strong>178</strong></span></div></div>
    </div>
  );
}

function DashboardMockup({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`ll-window ll-showcase-dashboard relative overflow-hidden rounded-[1.1rem] border border-white/15 bg-[#f6f8fa] text-[#183047] shadow-2xl ${compact ? "min-h-[280px]" : "min-h-[430px]"}`}>
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
           <div className="flex items-start justify-between"><div><div className="text-[9px] uppercase tracking-[0.16em] text-[#83919b]">Analyst Dashboard</div><div className="mt-1 text-lg font-semibold tracking-tight">Review, analyze, and manage incoming land deals</div></div><button className="rounded border border-[#d5dfe5] bg-white px-2 py-1 text-[9px] text-[#526574]"><SlidersHorizontal className="mr-1 inline h-3 w-3" /> Filter</button></div>
          <div className="mt-5 grid grid-cols-3 gap-2"><div className="rounded border border-[#dce4e9] bg-white p-3"><div className="text-[8px] text-[#84929d]">Ready for review</div><div className="mt-1 text-xl font-semibold">18</div></div><div className="rounded border border-[#dce4e9] bg-white p-3"><div className="text-[8px] text-[#84929d]">Criteria matched</div><div className="mt-1 text-xl font-semibold">72%</div></div><div className="rounded border border-[#dce4e9] bg-white p-3"><div className="text-[8px] text-[#84929d]">Outreach queued</div><div className="mt-1 text-xl font-semibold">34</div></div></div>
          <div className="mt-5 overflow-hidden rounded border border-[#dce4e9] bg-white"><div className="grid grid-cols-[1.5fr_1fr_0.8fr] border-b border-[#e5ebef] px-3 py-2 text-[8px] uppercase tracking-wider text-[#8896a0]"><span>Opportunity</span><span>Fit</span><span>Status</span></div>{[["North County parcel", "Strong", "Review"], ["Riverside infill", "Strong", "Outreach"], ["Oak Street holdings", "Needs review", "New"], ["Westlake acreage", "Strong", "Review"]].map(([name, fit, status]) => <div key={name} className="grid grid-cols-[1.5fr_1fr_0.8fr] items-center border-b border-[#eef2f4] px-3 py-3 text-[9px] last:border-0"><span className="font-medium">{name}</span><span className={fit === "Strong" ? "text-landlinq-blue" : "text-primary"}><CircleCheck className="mr-1 inline h-3 w-3" />{fit}</span><span className="text-[#6e7e89]">{status}</span></div>)}</div>
        </div>
      </div>
    </div>
  );
}

function DealOpsMachine() {
  const intakeRows = [
    ["North County parcel", "82%", "Review"],
    ["Riverside infill", "91%", "Outreach"],
    ["Oak Street holdings", "64%", "New"],
    ["Westlake acreage", "88%", "Review"],
  ];
  return (
    <div className="ll-machine" aria-label="Animated LandLinq workflow: opportunities are screened, routed to outreach, and moved through the pipeline">
      <div className="ll-machine-chrome">
        <span className="ll-chrome-mark" aria-hidden="true" />
        <span className="ll-chrome-mark" aria-hidden="true" />
        <span className="ll-chrome-mark" aria-hidden="true" />
        <span className="ll-machine-url">app.landlinq.ai / command-center</span>
        <span className="ml-auto hidden items-center gap-2 text-[8px] text-[#718394] sm:flex"><span className="ll-status-bar" /> Live workflow</span>
      </div>
      <div className="ll-machine-body">
        <aside className="ll-machine-rail">
          <div className="mb-7 flex items-center gap-2 text-[9px] font-bold"><span className="ll-rail-logo">L</span> LandLinq</div>
          {["Overview", "Deals", "Contacts", "Outreach", "Pipeline"].map((item, index) => (
            <div key={item} className={`ll-rail-item ${index === 1 ? "is-active" : ""}`}><span className="ll-rail-icon" />{item}</div>
          ))}
          <div className="mt-auto border-t border-[#e1e8ed] pt-4 text-[8px] text-[#8c9ba6]">Criteria engine<br /><span className="font-semibold text-[#3286C8]">Running</span></div>
        </aside>
        <div className="ll-machine-canvas">
          <div className="flex items-start justify-between">
            <div><div className="text-[8px] uppercase tracking-[0.18em] text-[#82909a]">Analyst Dashboard</div><div className="mt-1 text-base font-semibold tracking-tight text-[#183047] sm:text-xl">Review, analyze, and manage incoming land deals</div></div>
            <div className="ll-machine-filter">Columns 29/40 <ChevronDown className="h-3 w-3" /></div>
          </div>
          <div className="ll-analyst-toolbar" aria-hidden="true"><span className="ll-analyst-search">Search deals, brokers, locations...</span><b>Table</b><span>Pipeline</span><span>Map</span><i>STATUS</i><i>PRIORITY</i><i>TYPE</i><i>APEX</i><i>NEXT</i><i>STEP</i></div>
          <div className="ll-machine-stats">
            <div><span>Ready for review</span><strong>18</strong><em className="ll-stat-up">+4 today</em></div>
            <div><span>Criteria matched</span><strong>72%</strong><em>screening live</em></div>
            <div><span>Outreach queued</span><strong>34</strong><em className="ll-stat-blue">12 sending</em></div>
          </div>
          <div className="ll-machine-stage">
            <div className="ll-stage-head"><span>Opportunity</span><span>Fit score</span><span>Status</span></div>
            {intakeRows.map(([name, fit, status], index) => (
              <div key={name} className={`ll-stage-row ll-stage-row-${index}`}>
                <span className="font-semibold text-[#183047]">{name}</span>
                <span className="flex items-center gap-1 text-[#3286C8]"><span className="ll-fit-meter"><i style={{ width: fit }} /></span>{fit}</span>
                <span className={`ll-stage-status ${status === "Outreach" ? "is-outreach" : ""}`}>{status}</span>
              </div>
            ))}
            <div className="ll-routing-line" aria-hidden="true"><span>criteria match</span><i /></div>
          </div>
          <div className="ll-machine-lower">
            <div className="ll-activity-feed">
              <div className="ll-lower-label"><span>Activity stream</span><span className="ll-live-label">LIVE</span></div>
              <div className="ll-feed-item"><span className="ll-feed-index">01</span><span><b>Riverside infill</b> moved to outreach</span><time>now</time></div>
              <div className="ll-feed-item"><span className="ll-feed-index">02</span><span>Screened against <b>7 criteria</b></span><time>12s</time></div>
              <div className="ll-feed-item"><span className="ll-feed-index">03</span><span>New lead received from <b>Inbound</b></span><time>28s</time></div>
            </div>
            <div className="ll-mini-pipeline">
              <div className="ll-lower-label">Pipeline <span>today</span></div>
              <div className="ll-pipeline-track"><i /><i /><i /><i /></div>
              <div className="flex justify-between text-[7px] text-[#82909a]"><span>New 24</span><span>Review 18</span><span>Outreach 12</span><span>Qualified 7</span></div>
              <div className="ll-pipeline-card"><span className="ll-pipeline-card-bar" /><span>County road parcel</span><b>Qualified</b></div>
            </div>
          </div>
        </div>
      </div>
      <div className="ll-machine-callout ll-callout-screen"><span className="ll-callout-line" /><b>01</b><span>Screened against your criteria</span></div>
      <div className="ll-machine-callout ll-callout-send"><span className="ll-callout-line" /><b>02</b><span>Outreach queued automatically</span></div>
      <div className="ll-machine-callout ll-callout-move"><span className="ll-callout-line" /><b>03</b><span>Pipeline stays in motion</span></div>
    </div>
  );
}

function OutreachMockup() {
  return <ContactDirectoryMockup />;
}

function PipelineMockup() {
  return <ContactDetailMockup />;
}

function FlowDiagram() {
  const nodes = [["01", "Lead sources", "Inbound opportunities"], ["02", "Your criteria", "Rent, acreage, county fit"], ["03", "LandLinq", "Screen · organize · activate"], ["04", "Your team", "Review the right deals"]];
  return <div className="ll-flow mt-12 grid gap-2 md:grid-cols-4" aria-label="LandLinq operating workflow">
    {nodes.map(([num, title, body], i) => <div key={num} className={`ll-flow-node ll-flow-node-${i} relative`} style={{ "--flow-delay": `${i * 1.15}s` } as CSSProperties}>
      <div className={`ll-flow-card h-full rounded-xl border p-5 ${i === 2 ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"}`}>
        <div className="mb-8 flex items-center justify-between text-[10px] font-semibold tracking-[0.18em] opacity-55"><span>{num}</span>{i < 3 && <ArrowRight className="ll-flow-arrow hidden h-4 w-4 md:block" />}</div>
        <div className="text-sm font-semibold">{title}</div>
        <div className={`mt-2 text-xs leading-5 ${i === 2 ? "text-white/65" : "text-muted-foreground"}`}>{body}</div>
        {i === 2 && <div className="ll-screening-console" aria-hidden="true"><div><span>SCREEN</span><b>7 criteria</b></div><i /><div><span>ORGANIZE</span><b>18 ready</b></div><i /><div><span>ACTIVATE</span><b>12 queued</b></div></div>}
        {i === 0 && <div className="ll-flow-signal" aria-hidden="true"><span /><span /><span /></div>}
        {i === 3 && <div className="ll-team-inbox" aria-hidden="true"><span>QUEUE</span><b>Ready for review</b></div>}
      </div>
      {i < 3 && <div className="ll-flow-transfer" aria-hidden="true"><span /></div>}
    </div>)}
  </div>;
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
        <section className="relative bg-primary px-5 pb-16 pt-28 text-primary-foreground sm:px-8 sm:pb-24 sm:pt-32 lg:px-10">
          <div className="ll-grid absolute inset-0 opacity-20" /><div className="relative mx-auto max-w-7xl">
            <div className="flex flex-col items-center gap-10 lg:gap-12">
              <div className="max-w-5xl text-center">
                <h1 className="ll-reveal text-balance text-5xl font-semibold leading-[0.96] tracking-[-0.06em] sm:text-7xl lg:text-[4.5rem]">Your supercharged<br /><span className="text-[#55C3E9]">acquisitions operating system.</span></h1>
                <p className="ll-reveal ll-delay-2 mx-auto mt-6 max-w-lg text-lg leading-7 text-white/68">LandLinq opens the lead funnel wide, screens opportunities against your criteria, and keeps outreach moving, so lean teams can do more with less.</p>
                <div className="ll-reveal ll-delay-3 mt-7 flex flex-wrap justify-center gap-3"><Button>Get in touch</Button><Link href="/login" className="inline-flex min-h-12 items-center rounded-full border border-white/30 px-5 text-sm font-semibold hover:border-white">Log In</Link></div>
              </div>
              <div className="ll-reveal ll-delay-2 relative w-full max-w-[1120px]">
                <div className="absolute -inset-5 rounded-[1.5rem] bg-white/5 blur-2xl" />
                <DealOpsMachine />
              </div>
            </div>
          </div>
        </section>

         <section id="workflow" data-reveal className="ll-scroll-reveal bg-muted/40 px-5 py-24 sm:px-8 sm:py-32 lg:px-10 lg:py-40"><div className="mx-auto max-w-7xl"><div className="max-w-3xl"><h2 className="text-4xl font-semibold leading-[1.02] tracking-[-0.05em] sm:text-6xl">Your funnel is wide.<br />Your attention should not be.</h2><p className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground">Manual screening, one-off follow-up, and disconnected deal notes make good opportunities easy to miss. LandLinq gives every lead a path forward.</p></div><FlowDiagram /></div></section>

        <section id="platform" data-reveal className="ll-scroll-reveal ll-journey bg-background px-5 py-24 sm:px-8 sm:py-32 lg:px-10 lg:py-40">
          <div className="mx-auto max-w-7xl">
            <div className="ll-journey-intro">
              <div><div className="ll-eyebrow">THE OPERATING SYSTEM IN MOTION</div><h2 className="max-w-2xl text-4xl font-semibold leading-[1.02] tracking-[-0.05em] sm:text-6xl">The work moves.<br />Your team moves up.</h2></div>
              <p className="max-w-sm text-base leading-7 text-muted-foreground">One connected workflow for sourcing, screening, outreach, and the decisions that follow.</p>
            </div>
            <div className="ll-journey-route" aria-label="The LandLinq product workflow">
              <div className="ll-route-line" aria-hidden="true"><i /></div>
              <article className="ll-journey-step ll-step-dashboard">
                <div className="ll-step-marker"><span>01</span></div>
                <div className="ll-step-copy"><div className="ll-eyebrow">DEAL INTELLIGENCE</div><h3>Deal Dashboard</h3><p>Every deal arrives pre-screened against your own criteria, so your team knows what is worth a second look.</p><div className="ll-step-meta"><span>7 criteria</span><span>18 ready for review</span></div></div>
                <div className="ll-step-surface ll-surface-dark"><DashboardMockup compact /></div>
              </article>
              <article className="ll-journey-step ll-step-outreach">
                <div className="ll-step-marker"><span>02</span></div>
                <div className="ll-step-copy"><div className="ll-eyebrow">CONNECTED ACTION</div><h3>CRM & Outreach</h3><p>Campaigns run from your own connected email, reaching brokers without anyone drafting or sending each message by hand.</p><div className="ll-step-meta"><span>784 contacts</span><span>Outreach queued</span></div></div>
                <div className="ll-step-surface ll-surface-paper"><OutreachMockup /></div>
              </article>
              <article className="ll-journey-step ll-step-pipeline">
                <div className="ll-step-marker"><span>03</span></div>
                <div className="ll-step-copy"><div className="ll-eyebrow">OPERATIONAL CLARITY</div><h3>Pipeline</h3><p>Track opportunities through stages you define without a dedicated ops hire to maintain it.</p><div className="ll-step-meta"><span>New → Qualified</span><span>Shared context</span></div></div>
                <div className="ll-step-surface ll-surface-navy"><PipelineMockup /></div>
              </article>
              <article className="ll-journey-step ll-step-analytics">
                <div className="ll-step-marker"><span>04</span></div>
                <div className="ll-step-copy"><div className="ll-eyebrow">COMPOUNDING FOCUS</div><h3>Outreach Analytics</h3><p>See send activity, contacts reached, and drip enrollment status without pulling it together yourself.</p><div className="ll-step-meta"><span>178 in sequences</span><span>30 day view</span></div></div>
                <div className="ll-step-surface ll-surface-paper"><OutreachAnalyticsMockup /></div>
              </article>
            </div>
            <div className="ll-journey-result"><div><Search className="h-5 w-5 text-landlinq-blue" /><span className="ll-eyebrow">THE RESULT</span></div><h3>More time for the deals that clear your bar.</h3><p><Check className="mr-2 inline h-4 w-4 text-landlinq-blue" />Sourcing, screening, and outreach in the background</p></div>
          </div>
        </section>

         <section id="who-its-for" data-reveal className="ll-scroll-reveal ll-coverage-section bg-primary px-5 py-24 text-primary-foreground sm:px-8 sm:py-32 lg:px-10 lg:py-40">
           <div className="mx-auto max-w-7xl">
             <div className="ll-coverage-intro">
               <div>
                 <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">Built for the people doing the work</p>
                 <h2 className="text-4xl font-semibold leading-[1.02] tracking-[-0.05em] sm:text-6xl">Small team.<br />Serious coverage.</h2>
               </div>
               <p className="ll-coverage-thesis">The advantage is not more people.<br /><strong>It is more surface area.</strong></p>
             </div>
             <div className="ll-coverage-map" aria-label="LandLinq supports real estate investment companies and sales teams">
               <div className="ll-coverage-axis" aria-hidden="true"><span>MORE<br />REACH</span><i /><b>LANDLINQ<br />OPERATING LAYER</b><i /><span>MORE<br />MOMENTUM</span></div>
               <article className="ll-audience-row ll-audience-row-investment">
                 <div className="ll-audience-index">01 <span>ACQUISITIONS</span></div>
                 <div className="ll-audience-copy"><p>Real estate investment companies</p><h3>Open the funnel wide.</h3><span>Screen more land and property opportunities against your criteria, then give your team a clean queue of deals worth pursuing.</span></div>
                 <div className="ll-audience-proof"><span>INPUT</span><b>More opportunities</b><i>→</i><span>OUTPUT</span><b>Cleaner decisions</b></div>
               </article>
               <article className="ll-audience-row ll-audience-row-sales">
                 <div className="ll-audience-index">02 <span>REVENUE</span></div>
                 <div className="ll-audience-copy"><p>Sales teams</p><h3>Keep opportunity moving.</h3><span>Keep every prospect moving with connected outreach, a shared pipeline, and the context for better conversations.</span></div>
                 <div className="ll-audience-proof"><span>INPUT</span><b>Every prospect</b><i>→</i><span>OUTPUT</span><b>Better conversations</b></div>
               </article>
             </div>
             <div className="ll-coverage-foot"><span>ONE SYSTEM</span><i /><span>DIFFERENT STARTING POINTS</span><strong>Same result: less operational drag.</strong></div>
           </div>
         </section>

        <section id="company" data-reveal className="ll-scroll-reveal bg-background px-5 py-24 sm:px-8 sm:py-32 lg:px-10 lg:py-40"><div className="mx-auto max-w-3xl"><div className="mb-14"><h2 className="text-4xl font-semibold tracking-[-0.05em] sm:text-6xl">Know what you're getting.</h2></div><div className="divide-y divide-border border-y border-border">{faqs.map(([question, answer], i) => <div key={question}><button type="button" onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i} className="flex w-full items-center justify-between gap-5 py-6 text-left text-base font-semibold sm:text-lg"><span>{question}</span><ChevronDown className={`h-5 w-5 shrink-0 text-primary transition-transform duration-300 ${openFaq === i ? "rotate-180" : ""}`} /></button><div className={`grid transition-[grid-template-rows,opacity] duration-300 ${openFaq === i ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}><div className="overflow-hidden"><p className="max-w-2xl pb-6 leading-7 text-muted-foreground">{answer}</p></div></div></div>)}</div></div></section>

        <section data-reveal className="ll-scroll-reveal bg-muted/40 px-5 py-24 sm:px-8 sm:py-32 lg:px-10"><div className="mx-auto max-w-7xl rounded-3xl bg-primary p-8 text-primary-foreground sm:p-14 lg:p-20"><div className="grid gap-12 lg:grid-cols-[1fr_0.65fr] lg:items-end"><div><p className="mb-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">Make the next decision faster</p><h2 className="max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.06em] sm:text-7xl">See what a supercharged acquisitions team looks like.</h2><div className="mt-9"><Button>Get in touch</Button></div></div><form onSubmit={(e) => { e.preventDefault(); if (email) { setSubmitted(true); window.location.href = `mailto:help@landlinq.ai?subject=LandLinq%20updates&body=${encodeURIComponent(`Please add ${email} to the LandLinq updates list.`)}`; } }} className="rounded-2xl border border-white/20 p-6"><label htmlFor="updates-email" className="text-sm font-medium">Get the occasional LandLinq update.</label>{submitted ? <p className="mt-5 text-sm text-white/65">Your email client is ready to complete the handoff.</p> : <><div className="mt-5 flex flex-col gap-3 sm:flex-row"><input id="updates-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="h-12 min-w-0 flex-1 rounded-full border border-white/25 bg-transparent px-5 text-base text-white outline-none placeholder:text-white/40" /><button type="submit" className="h-12 rounded-full bg-white px-5 text-sm font-semibold text-primary">Join list</button></div><p className="mt-4 text-xs leading-5 text-white/45">Your email client will open to complete the handoff.</p></>}</form></div></div></section>
      </main>
      <footer className="bg-primary px-5 py-14 text-white sm:px-8 sm:py-20 lg:px-10"><div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-[1.5fr_1fr_1fr_1fr]"><div><img src="/assets/landlinq-white-logo.png" alt="LandLinq" className="h-7 w-auto" /><p className="mt-5 max-w-xs text-sm leading-6 text-white/50">Your supercharged<br />acquisitions operating system.</p></div><div><h3 className="mb-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">Platform</h3><div className="flex flex-col gap-3 text-sm text-white/70"><a href="#platform">Deal Dashboard</a><a href="#platform">CRM & Outreach</a><a href="#platform">Analytics</a></div></div><div><h3 className="mb-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">Company</h3><div className="flex flex-col gap-3 text-sm text-white/70"><a href="#who-its-for">Who It's For</a><a href="mailto:help@landlinq.ai">Contact</a></div></div><div><h3 className="mb-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">Legal</h3><div className="flex flex-col gap-3 text-sm text-white/70"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div></div></div><div className="mx-auto mt-14 max-w-7xl border-t border-white/15 pt-6 text-xs text-white/35">© {new Date().getFullYear()} LandLinq. All rights reserved.</div></footer>
    </div>
  );
}