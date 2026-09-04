import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Menu,
  Search,
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
  ["MC", "Maya Collins", "maya.collins@northline.example", "(704) 555-0182", "Northline Realty", "Known Broker · Multifamily · Charlotte", "AJ Klenk", "12", "Aug 28, 26"],
  ["JR", "Julian Reyes", "julian@oakandstone.example", "(919) 555-0147", "Oak & Stone Capital", "Principal · Land Seller · Triangle", "Brian Ford", "8", "Aug 25, 26"],
  ["SP", "Sophie Patel", "spatel@harborcre.example", "(843) 555-0119", "Harbor Commercial", "CRE Broker · Coastal · BTR", "AJ Klenk", "15", "Aug 21, 26"],
  ["DM", "Derek Monroe", "dmonroe@piedmontadvisors.example", "(336) 555-0165", "Piedmont Advisors", "Known Broker · Affordable · Triad", "Brian Ford", "6", "Aug 18, 26"],
  ["EW", "Elena Walsh", "elena@bluepeakland.example", "(615) 555-0133", "BluePeak Land Co.", "Landowner · Tennessee · Warm Lead", "AJ Klenk", "4", "Aug 14, 26"],
  ["TB", "Trevor Brooks", "tbrooks@crescentpartners.example", "(980) 555-0196", "Crescent Partners", "CRE Broker · Active Adult · Charlotte", "Brian Ford", "10", "Aug 09, 26"],
  ["NK", "Naomi Kim", "naomi@redwoodcommunities.example", "(984) 555-0128", "Redwood Communities", "Developer · Multifamily · Raleigh", "AJ Klenk", "7", "Aug 03, 26"],
  ["CW", "Caleb Wright", "caleb@ironwoodre.example", "(864) 555-0174", "Ironwood Real Estate", "Known Broker · Greenville · Student", "Brian Ford", "9", "Jul 29, 26"],
  ["AH", "Amelia Hart", "amelia@carolinalandgroup.example", "(910) 555-0151", "Carolina Land Group", "Land Broker · Wilmington · Priority", "AJ Klenk", "11", "Jul 24, 26"],
];

function ContactDirectoryMockup() {
  return (
    <div className="ll-app-frame ll-contact-directory">
      <div className="ll-app-titlebar"><div><b>◈</b><span>Contacts</span><small>RELATIONSHIP DIRECTORY</small></div><strong>784 total</strong><button>+ NEW CONTACT</button></div>
      <div className="ll-contact-filters"><span className="ll-search-box">⌕&nbsp; Search name, email, phone...</span><span>All tags　›</span><span>+ Tag</span><span>All SMS　⌄</span><span>All States　⌄</span><span>All MSAs　⌄</span><span>All Counties　⌄</span><span>All Reps　⌄</span></div>
      <div className="ll-contact-table">
        <div className="ll-contact-head"><span>□</span><span>CONTACT</span><span>REACH</span><span>ORGANIZATION</span><span>SIGNALS</span><span>OWNER</span><span>DEALS</span><span>ADDED</span></div>
        {contactRows.map(([initials, name, email, phone, company, tags, owner, deals, added], i) => <div className={`ll-contact-row ll-contact-row-${i}`} key={name}><span>□</span><span className="ll-person"><i>{initials}</i><b>{name}<em>ACTIVE</em></b></span><span className="ll-reach">▧ {email}<small>⌕ {phone}</small></span><span>{company}</span><span className="ll-signal">{tags}</span><span>♧ {owner}</span><span>{deals}</span><span>{added}　›</span></div>)}
      </div>
    </div>
  );
}

function ContactDetailMockup() {
  return (
    <div className="ll-app-frame ll-contact-detail">
      <div className="ll-detail-nav"><b><img src="/assets/landlinq-white-logo.png" alt="LandLinq" /></b><span>Deal Dashboard　 <i>CRM</i>　 Outreach Analytics　 Outreach Setup　 Data Hub　 Analytics</span><button>SIGN OUT</button></div>
      <div className="ll-detail-hero"><small>‹ Back to contacts</small><div className="ll-detail-person"><i>MC</i><b>Maya<br /><small>Senior Vice President</small></b><b>Collins<br /><small>• Northline Realty</small></b><span>✉ Email　　✎ Edit　 <strong>SAVE CHANGES</strong></span></div><div className="ll-detail-meta"><span>PHONE<br /><b>(704) 555-0182</b></span><span>EMAIL<br /><b>maya.collins@northline.example</b></span><span>COMPANY<br /><b>Northline Realty</b></span><span>LAST CONTACTED<br /><b>Aug 29, 2026</b></span></div></div>
      <div className="ll-detail-body"><aside><small>RECORD</small><b>Contact details</b>{[["NAME", "Maya Collins"], ["EMAIL", "maya.collins@northline.example"], ["PHONE", "(704) 555-0182"], ["ACCOUNT / COMPANY", "Northline Realty"], ["ASSIGNED TO", "AJ Klenk"], ["CONTACT TYPE", "CRE broker"], ["LEAD SOURCE", "Broker referral"], ["LAST CONTACTED", "Aug 29, 2026"]].map(([a, b]) => <label key={a}>{a}<strong>{b}</strong></label>)}</aside><main><div className="ll-detail-tabs"><b>Overview</b><span>Activity</span><span>Deals</span><span>Notes</span></div><div className="ll-detail-cards"><div><small>CREATED</small><b>Feb 12, 2025</b></div><div><small>TYPE</small><b>Known broker</b></div><div><small>DEALS</small><b>12</b></div><div><small>CAMPAIGNS</small><b>3 active</b></div></div><div className="ll-detail-activity"><div className="ll-detail-event"><i>✉</i><b>Email opened</b><small>Providence Grove follow-up · Aug 29, 2026</small></div><div className="ll-detail-event"><i>＋</i><b>New deal received</b><small>Glenwood Commons · Aug 27, 2026</small></div><div className="ll-detail-event"><i>✓</i><b>Call completed</b><small>Discussed Charlotte pipeline · Aug 22, 2026</small></div></div><div className="ll-detail-section"><small>ORGANIZATION</small><b>Tags</b><span className="ll-detail-tags"><i>Known Broker</i><i>Multifamily</i><i>Charlotte MSA</i><i>Priority</i><i>Warm Relationship</i></span></div><div className="ll-detail-section"><small>OUTREACH</small><b>Campaigns</b><span>Charlotte Broker Nurture　 • Multifamily Deal Flow　 • Q3 Relationship Follow-up</span></div></main></div>
    </div>
  );
}

function OutreachAnalyticsMockup() {
  return (
    <div className="ll-app-frame ll-outreach-analytics">
      <div className="ll-analytics-back">← Outreach Management <button>⟳ Refresh</button></div><h3>▱ Outreach Analytics</h3><p>Email send activity, sender health, and drip campaign status</p>
      <div className="ll-periods"><span>Today</span><span>7 Days</span><b>30 Days</b><span>YTD</span></div>
      <div className="ll-metric-grid"><div><i>➤</i><small>EMAILS SENT</small><b className="ll-metric-number">1,284</b><em>7 failed · 98.9% delivered</em></div><div><i>⌁</i><small>CONTACTS REACHED</small><b className="ll-metric-number">642</b><em>418 unique opens · 65.1%</em></div><div><i>ϟ</i><small>AVG STEPS / CONTACT</small><b>2.4</b><em>Across 11 active campaigns</em></div><div><i>♧</i><small>IN DRIP SEQUENCES</small><b>178</b><em>26 due today · 11 due now</em></div></div>
      <div className="ll-analytics-lower"><div className="ll-volume"><b>Daily Send Volume <small>Last 7 days · 324 sent</small></b><span className="ll-volume-summary">Peak volume: Tuesday <strong>67 sends</strong></span><div className="ll-volume-bars"><i style={{height:"48%"}}/><i style={{height:"72%"}}/><i style={{height:"91%"}}/><i style={{height:"63%"}}/><i style={{height:"84%"}}/><i style={{height:"56%"}}/><i style={{height:"38%"}}/></div><div className="ll-volume-days"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div></div><div className="ll-drip"><b>◷ Drip Enrollment Status</b><span>◷ Pending <strong>42</strong></span><span>⌁ In Progress <strong className="is-blue">96</strong></span><span>✓ Completed <strong className="is-green">824</strong></span><span>⊗ Failed <strong className="is-red">7</strong></span><hr/><span>Due today <strong>26</strong></span><span>Due now <strong>11</strong></span></div></div>
    </div>
  );
}

function DashboardMockup({ compact = false }: { compact?: boolean }) {
  const [activeFilter, setActiveFilter] = useState("STATUS");
  const columns = ["ID", "Status", "Priority", "Property Address", "Name", "YOC", "IBR", "Deal", "Type", "Analyst Notes", "Summary", "Dev Notes", "Broker Notes", "Top Rent/Unit", "Top Rent PSF", "OCC T."];
  const rows = [
    ["#84", "Review", "High", "1824 Glenwood Avenue|Raleigh, NC 27608", "Glenwood Commons", "7.8%", "8.4%", "Land", "Affordable", "Site plan received", "Strong infill opportunity", "Review density", "Seller expects Q4 close", "$1,845", "$2.18", "YES"],
    ["#83", "Qualified", "High", "6400 Providence Road|Charlotte, NC 28226", "Providence Grove", "8.6%", "9.1%", "Land", "BTR", "Utilities confirmed", "High-growth submarket", "Advance to UW", "Best offers due Friday", "$2,120", "$2.34", "YES"],
    ["#82", "Review", "Medium", "915 South Main Street|Greenville, SC 29601", "Reedy River Flats", "7.4%", "8.0%", "Land", "Conventional", "Traffic study pending", "Walkable downtown site", "Confirm access", "Broker shared survey", "$1,765", "$2.06", "YES"],
    ["#81", "Qualified", "High", "3120 Hillsborough Road|Durham, NC 27705", "Bull City Landing", "9.0%", "9.5%", "Land", "Student", "Zoning verified", "Near university demand", "Model 280 units", "Clean title reported", "$1,980", "$2.41", "YES"],
    ["#80", "Review", "Medium", "4475 New Bern Avenue|Raleigh, NC 27610", "Eastgate Residences", "7.1%", "7.9%", "Land", "Affordable", "QCT status confirmed", "Transit-oriented parcel", "Check tax credits", "Seller flexible on timing", "$1,690", "$1.98", "YES"],
    ["#79", "Qualified", "Medium", "2280 Wendover Avenue|Greensboro, NC 27407", "Wendover Park", "8.3%", "8.8%", "Land", "Active Adult", "Demographics complete", "Strong 55+ population", "Begin concept plan", "Full package received", "$1,725", "$2.09", "YES"],
    ["#78", "Review", "Low", "7600 Market Street|Wilmington, NC 28411", "Porters Neck Village", "7.0%", "7.6%", "Land", "BTR", "Wetlands report added", "Coastal growth corridor", "Review wetland area", "Pricing guidance received", "$1,860", "$2.22", "YES"],
    ["#77", "Qualified", "High", "1350 Veterans Parkway|Murfreesboro, TN 37128", "Veterans Crossing", "8.8%", "9.3%", "Land", "Conventional", "Comp set refreshed", "Rapid household growth", "Schedule IC review", "Seller financing available", "$1,925", "$2.27", "YES"],
    ["#76", "Review", "Medium", "2900 Western Boulevard|Raleigh, NC 27606", "Western Row", "7.6%", "8.2%", "Land", "Student", "Enrollment data added", "NC State demand driver", "Verify unit mix", "Broker uploaded OM", "$1,995", "$2.38", "YES"],
    ["#75", "Qualified", "High", "5210 South Boulevard|Charlotte, NC 28217", "South End Exchange", "9.1%", "9.7%", "Land", "Conventional", "Transit access verified", "Prime infill location", "Prepare LOI terms", "Seller prefers certainty", "$2,180", "$2.46", "YES"],
    ["#74", "Review", "Medium", "3801 Battleground Avenue|Greensboro, NC 27410", "Battleground Oaks", "7.9%", "8.3%", "Land", "Affordable", "AMI rents modeled", "Established retail node", "Confirm bond volume", "Phase I available", "$1,640", "$1.94", "YES"],
    ["#73", "Qualified", "Low", "2045 Highway 70 East|New Bern, NC 28560", "Neuse River Landing", "8.1%", "8.6%", "Land", "Active Adult", "Flood maps reviewed", "Low basis opportunity", "Order market study", "Flexible closing window", "$1,575", "$1.87", "YES"],
  ];
  return (
    <div className={`ll-window ll-analyst-real relative overflow-hidden rounded-[1.1rem] border border-white/15 bg-[#f7f9fa] text-[#182b3e] shadow-2xl ${compact ? "min-h-[280px]" : "min-h-[430px]"}`}>
      <div className="ll-analyst-head">
        <div><h3>Your Dashboard</h3><p>Review, analyze, and manage incoming land deals with AI-powered insights</p></div>
        <div className="ll-analyst-actions"><button type="button">＋ &nbsp; ADD NEW DEAL</button><button type="button">⇩ &nbsp; EXPORT CSV</button></div>
      </div>
      <div className="ll-analyst-workspace">
        <div className="ll-analyst-toolbar">
          <label className="ll-analyst-search"><Search /><input aria-label="Search deals" placeholder="Search deals, brokers, locations..." /></label>
          <div className="ll-analyst-views"><button type="button" className="is-selected">▣ Table</button><button type="button">▤ Pipeline</button><button type="button">⌖ Map</button></div>
          <button type="button" className="ll-analyst-columns">☷ &nbsp; COLUMNS <b>29/40</b></button>
          {["STATUS", "PRIORITY", "TYPE", "NEXT", "STEP"].map((filter) => <button type="button" key={filter} onClick={() => setActiveFilter(filter)} className={`ll-analyst-filter ${activeFilter === filter ? "is-active" : ""}`}>{filter}⌄</button>)}
        </div>
        <div className="ll-analyst-table-scroll">
          <table className="ll-analyst-table"><thead><tr>{columns.map((column) => <th key={column}>{column}{column !== "ID" && <small>↕</small>}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={`${row[0]}-${index}`} className={`ll-cell-${index}`}>{index === 1 ? <b className={`ll-status ll-status-dot ${cell === "Qualified" ? "is-green" : "is-yellow"}`} aria-label={cell} title={cell}><span className="sr-only">{cell}</span></b> : index === 8 ? <b className="ll-type">{cell}</b> : index === 9 ? <b className="ll-notes">{cell}</b> : cell.includes("|") ? cell.split("|").map((line, i) => <span key={line} className={i === 0 ? "ll-address" : "ll-subaddress"}>{line}</span>) : cell}</td>)}</tr>)}</tbody></table>
        </div>
      </div>
    </div>
  );
}

function DealOpsMachine() {
  return (
    <div className="ll-machine ll-machine-dashboard" aria-label="Animated recreation of the LandLinq Analyst Dashboard">
      <DashboardMockup />
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