import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import {
  ChevronDown,
  Download,
  List,
  Map,
  Menu,
  Plus,
  Search,
  Table2,
  X,
} from "lucide-react";
import Footer from "@/components/footer";

const faqs = [
  ["What is LandLinq?", "LandLinq is operating leverage for lean acquisitions teams. It handles sourcing, screening, outreach, and tracking in the background so your people can focus on the deals most likely to succeed."],
  ["Who is LandLinq for?", "LandLinq is built for real estate investment companies and sales teams in any industry that need to cover more ground without adding operational overhead."],
  ["How does deal classification work?", "LandLinq evaluates incoming opportunities against the acquisition criteria your team defines, then organizes the results so the strongest fits are ready for human review."],
  ["Is my data private from other companies on the platform?", "Yes. Your data, criteria, contacts, and deal activity remain private to your organization."],
  ["Can I use LandLinq for outreach outside real estate?", "Yes. The pipeline and outreach workflow can support sales teams in any industry, wherever opportunity screening and follow-up matter."],
  ["How much of the work does LandLinq take off my team?", "LandLinq handles sourcing, screening, and outreach automatically, so your team spends its time only on the deals that clear your criteria."],
];

function Button({ children, href = "/contact", dark = false }: { children: ReactNode; href?: string; dark?: boolean }) {
  return (
    <a href={href} className={`inline-flex min-h-12 items-center justify-center rounded-full border px-5 text-sm font-semibold transition-all duration-300 ${dark ? "border-white bg-white text-landlinq-blue hover:bg-transparent hover:text-white" : "border-landlinq-sky bg-landlinq-sky text-white hover:border-landlinq-blue hover:bg-white hover:text-landlinq-blue"}`}>
      {children}
    </a>
  );
}

const contactRows = [
  ["MC", "Maya Collins", "maya.collins@northline.example", "(704) 555-0182", "Northline Realty", "Known Broker · Multifamily · Charlotte", "Morgan Hayes", "12", "Aug 28, 26"],
  ["JR", "Julian Reyes", "julian@oakandstone.example", "(919) 555-0147", "Oak & Stone Capital", "Principal · Land Seller · Triangle", "Brian Ford", "8", "Aug 25, 26"],
  ["SP", "Sophie Patel", "spatel@harborcre.example", "(843) 555-0119", "Harbor Commercial", "CRE Broker · Coastal · BTR", "Morgan Hayes", "15", "Aug 21, 26"],
  ["DM", "Derek Monroe", "dmonroe@piedmontadvisors.example", "(336) 555-0165", "Piedmont Advisors", "Known Broker · Affordable · Triad", "Brian Ford", "6", "Aug 18, 26"],
  ["EW", "Elena Walsh", "elena@bluepeakland.example", "(615) 555-0133", "BluePeak Land Co.", "Landowner · Tennessee · Warm Lead", "Morgan Hayes", "4", "Aug 14, 26"],
  ["TB", "Trevor Brooks", "tbrooks@crescentpartners.example", "(980) 555-0196", "Crescent Partners", "CRE Broker · Active Adult · Charlotte", "Brian Ford", "10", "Aug 09, 26"],
  ["NK", "Naomi Kim", "naomi@redwoodcommunities.example", "(984) 555-0128", "Redwood Communities", "Developer · Multifamily · Raleigh", "Morgan Hayes", "7", "Aug 03, 26"],
  ["CW", "Caleb Wright", "caleb@ironwoodre.example", "(864) 555-0174", "Ironwood Real Estate", "Known Broker · Greenville · Student", "Brian Ford", "9", "Jul 29, 26"],
  ["AH", "Amelia Hart", "amelia@carolinalandgroup.example", "(910) 555-0151", "Carolina Land Group", "Land Broker · Wilmington · Priority", "Morgan Hayes", "11", "Jul 24, 26"],
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
      <div className="ll-detail-body"><aside><small>RECORD</small><b>Contact details</b>{[["NAME", "Maya Collins"], ["EMAIL", "maya.collins@northline.example"], ["PHONE", "(704) 555-0182"], ["ACCOUNT / COMPANY", "Northline Realty"], ["ASSIGNED TO", "Morgan Hayes"], ["CONTACT TYPE", "CRE broker"], ["LEAD SOURCE", "Broker referral"], ["LAST CONTACTED", "Aug 29, 2026"]].map(([a, b]) => <label key={a}>{a}<strong>{b}</strong></label>)}</aside><main><div className="ll-detail-tabs"><b>Overview</b><span>Activity</span><span>Deals</span><span>Notes</span></div><div className="ll-detail-cards"><div><small>CREATED</small><b>Feb 12, 2025</b></div><div><small>TYPE</small><b>Known broker</b></div><div><small>DEALS</small><b>12</b></div><div><small>CAMPAIGNS</small><b>3 active</b></div></div><div className="ll-detail-activity"><div className="ll-detail-event"><i>✉</i><b>Email opened</b><small>Providence Grove follow-up · Aug 29, 2026</small></div><div className="ll-detail-event"><i>＋</i><b>New deal received</b><small>Glenwood Commons · Aug 27, 2026</small></div><div className="ll-detail-event"><i>✓</i><b>Call completed</b><small>Discussed Charlotte pipeline · Aug 22, 2026</small></div></div><div className="ll-detail-section"><small>ORGANIZATION</small><b>Tags</b><span className="ll-detail-tags"><i>Known Broker</i><i>Multifamily</i><i>Charlotte MSA</i><i>Priority</i><i>Warm Relationship</i></span></div><div className="ll-detail-section"><small>OUTREACH</small><b>Campaigns</b><span>Charlotte Broker Nurture　 • Multifamily Deal Flow　 • Q3 Relationship Follow-up</span></div></main></div>
    </div>
  );
}

function OutreachAnalyticsMockup() {
  return (
    <div className="ll-app-frame ll-outreach-analytics">
      <div className="ll-analytics-back">← Outreach Management <button>⟳ Refresh</button></div><h3>Outreach Analytics</h3><p>Email send activity, sender health, and drip campaign status</p>
      <div className="ll-periods"><span>Today</span><span>7 Days</span><b>30 Days</b><span>YTD</span></div>
      <div className="ll-metric-grid"><div><i>➤</i><small>EMAILS SENT</small><b className="ll-metric-number">1,284</b><em>7 failed · 98.9% delivered</em></div><div><i>⌁</i><small>CONTACTS REACHED</small><b className="ll-metric-number">642</b><em>418 unique opens · 65.1%</em></div><div><i>ϟ</i><small>AVG STEPS / CONTACT</small><b>2.4</b><em>Across 11 active campaigns</em></div><div><i>♧</i><small>IN DRIP SEQUENCES</small><b>178</b><em>26 due today · 11 due now</em></div></div>
      <div className="ll-analytics-lower"><div className="ll-volume"><b>Daily Send Volume <small>Last 7 days · 324 sent</small></b><span className="ll-volume-summary">Peak volume: Tuesday <strong>67 sends</strong></span><div className="ll-volume-bars"><i style={{height:"48%"}}/><i style={{height:"72%"}}/><i style={{height:"91%"}}/><i style={{height:"63%"}}/><i style={{height:"84%"}}/><i style={{height:"56%"}}/><i style={{height:"38%"}}/></div><div className="ll-volume-days"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div></div><div className="ll-drip"><b>◷ Drip Enrollment Status</b><span>◷ Pending <strong>42</strong></span><span>⌁ In Progress <strong className="is-blue">96</strong></span><span>✓ Completed <strong className="is-green">824</strong></span><span>⊗ Failed <strong className="is-red">7</strong></span><hr/><span>Due today <strong>26</strong></span><span>Due now <strong>11</strong></span></div></div>
    </div>
  );
}

function DashboardMockup({ compact = false }: { compact?: boolean }) {
  const [activeFilter, setActiveFilter] = useState("STATUS");
  useEffect(() => {
    const filters = ["STATUS", "PRIORITY", "TYPE", "NEXT"];
    const interval = window.setInterval(() => {
      setActiveFilter((current) => filters[(filters.indexOf(current) + 1) % filters.length]);
    }, 3200);
    return () => window.clearInterval(interval);
  }, []);
  const columns = ["ID", "Status", "Priority", "Property Address", "Name", "YOC", "Deal", "Type", "Analyst Notes", "Summary", "Dev Notes", "Broker Notes", "Top Rent/Unit", "Top Rent PSF", "OCC T."];
  const rows = [
    ["#84", "Review", "High", "1824 Glenwood Avenue|Raleigh, NC 27608", "Glenwood Commons", "7.8%", "Land", "Affordable", "Site plan received", "Strong infill opportunity", "Review density", "Seller expects Q4 close", "$1,845", "$2.18", "YES"],
    ["#83", "Qualified", "High", "6400 Providence Road|Charlotte, NC 28226", "Providence Grove", "8.6%", "Land", "BTR", "Utilities confirmed", "High-growth submarket", "Advance to UW", "Best offers due Friday", "$2,120", "$2.34", "YES"],
    ["#82", "Review", "Medium", "915 South Main Street|Greenville, SC 29601", "Reedy River Flats", "7.4%", "Land", "Conventional", "Traffic study pending", "Walkable downtown site", "Confirm access", "Broker shared survey", "$1,765", "$2.06", "YES"],
    ["#81", "Qualified", "High", "3120 Hillsborough Road|Durham, NC 27705", "Bull City Landing", "9.0%", "Land", "Student", "Zoning verified", "Near university demand", "Model 280 units", "Clean title reported", "$1,980", "$2.41", "YES"],
    ["#80", "Review", "Medium", "4475 New Bern Avenue|Raleigh, NC 27610", "Eastgate Residences", "7.1%", "Land", "Affordable", "QCT status confirmed", "Transit-oriented parcel", "Check tax credits", "Seller flexible on timing", "$1,690", "$1.98", "YES"],
    ["#79", "Qualified", "Medium", "2280 Wendover Avenue|Greensboro, NC 27407", "Wendover Park", "8.3%", "Land", "Active Adult", "Demographics complete", "Strong 55+ population", "Begin concept plan", "Full package received", "$1,725", "$2.09", "YES"],
    ["#78", "Review", "Low", "7600 Market Street|Wilmington, NC 28411", "Porters Neck Village", "7.0%", "Land", "BTR", "Wetlands report added", "Coastal growth corridor", "Review wetland area", "Pricing guidance received", "$1,860", "$2.22", "YES"],
    ["#77", "Qualified", "High", "1350 Veterans Parkway|Murfreesboro, TN 37128", "Veterans Crossing", "8.8%", "Land", "Conventional", "Comp set refreshed", "Rapid household growth", "Schedule IC review", "Seller financing available", "$1,925", "$2.27", "YES"],
    ["#76", "Review", "Medium", "2900 Western Boulevard|Raleigh, NC 27606", "Western Row", "7.6%", "Land", "Student", "Enrollment data added", "NC State demand driver", "Verify unit mix", "Broker uploaded OM", "$1,995", "$2.38", "YES"],
    ["#75", "Qualified", "High", "5210 South Boulevard|Charlotte, NC 28217", "South End Exchange", "9.1%", "Land", "Conventional", "Transit access verified", "Prime infill location", "Prepare LOI terms", "Seller prefers certainty", "$2,180", "$2.46", "YES"],
    ["#74", "Review", "Medium", "3801 Battleground Avenue|Greensboro, NC 27410", "Battleground Oaks", "7.9%", "Land", "Affordable", "AMI rents modeled", "Established retail node", "Confirm bond volume", "Phase I available", "$1,640", "$1.94", "YES"],
    ["#73", "Qualified", "Low", "2045 Highway 70 East|New Bern, NC 28560", "Neuse River Landing", "8.1%", "Land", "Active Adult", "Flood maps reviewed", "Low basis opportunity", "Order market study", "Flexible closing window", "$1,575", "$1.87", "YES"],
  ];
  return (
    <div className={`ll-window ll-analyst-real relative overflow-hidden rounded-[1.1rem] border border-white/15 bg-[#f7f9fa] text-[#182b3e] shadow-2xl ${compact ? "min-h-[280px]" : "min-h-[430px]"}`}>
      <div className="ll-analyst-head">
        <div><h3>Analyst Dashboard</h3><p>Review, analyze, and manage incoming land deals with AI-powered insights</p></div>
        <div className="ll-analyst-actions"><button type="button"><Plus /> Add New Deal</button><button type="button"><Download /> Export CSV</button></div>
      </div>
      <div className="ll-analyst-workspace">
        <div className="ll-analyst-toolbar">
          <label className="ll-analyst-search"><Search /><input aria-label="Search deals" placeholder="Search deals, brokers, locations..." /></label>
          <div className="ll-analyst-views"><button type="button" className="is-selected"><Table2 /> Table</button><button type="button"><List /> Pipeline</button><button type="button"><Map /> Map</button></div>
          <button type="button" className="ll-analyst-columns">Columns <b>29/40</b></button>
          {["STATUS", "PRIORITY", "TYPE", "NEXT"].map((filter) => <button type="button" key={filter} onClick={() => setActiveFilter(filter)} className={`ll-analyst-filter ${activeFilter === filter ? "is-active" : ""}`}>{filter}⌄</button>)}
        </div>
        <div className="ll-analyst-table-scroll">
           <table className="ll-analyst-table"><thead><tr>{columns.map((column) => <th key={column}>{column}{column !== "ID" && <small>↕</small>}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={`${row[0]}-${index}`} className={`ll-cell-${index}`}>{index === 1 ? <b className={`ll-status ll-status-dot ${cell === "Qualified" ? "is-green" : "is-yellow"}`} aria-label={cell} title={cell}><span className="sr-only">{cell}</span></b> : index === 7 ? <b className="ll-type">{cell}</b> : index === 8 ? <b className="ll-notes">{cell}</b> : cell.includes("|") ? cell.split("|").map((line, i) => <span key={line} className={i === 0 ? "ll-address" : "ll-subaddress"}>{line}</span>) : cell}</td>)}</tr>)}</tbody></table>
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

const heroStats = [
  { value: 18000, format: (value: number) => `${Math.round(value).toLocaleString()}+`, label: "Units developed" },
  { value: 12, format: (value: number) => Math.round(value).toLocaleString(), label: "Projects under development" },
  { value: 1.5, format: (value: number) => `$${value.toFixed(1)}B`, label: "In development" },
  { value: 5.5, format: (value: number) => `$${value.toFixed(1)}B`, label: "In real estate transactions" },
];

function HeroStats() {
  const sectionRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setProgress(1);
      return;
    }

    let animationFrame = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      const startedAt = performance.now();
      const duration = 1800;

      const animate = (now: number) => {
        const elapsed = Math.min((now - startedAt) / duration, 1);
        const eased = 1 - Math.pow(1 - elapsed, 3);
        setProgress(eased);
        if (elapsed < 1) animationFrame = requestAnimationFrame(animate);
      };

      animationFrame = requestAnimationFrame(animate);
    }, { threshold: 0.25 });

    observer.observe(section);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <section ref={sectionRef} className="ll-hero-stats" aria-label="LandLinq development statistics">
      <div className="mx-auto grid max-w-7xl sm:grid-cols-2 lg:grid-cols-4">
        {heroStats.map((stat) => (
          <div className="ll-hero-stat" key={stat.label}>
            <strong style={{ transform: `scale(${0.78 + progress * 0.22})` }}>
              {stat.format(stat.value * progress)}
            </strong>
            <p>{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function MarketingHome() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [contactForm, setContactForm] = useState({ name: "", email: "", message: "" });
  const [contactStatus, setContactStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [contactError, setContactError] = useState("");
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
          <div className="hidden items-center gap-8 md:flex"><Link href="/login" className="inline-flex items-center rounded-full border border-white bg-white px-4 py-2 text-sm font-semibold text-landlinq-blue transition-all duration-300 hover:bg-transparent hover:text-white">Log In</Link></div>
           <button type="button" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)} className="inline-flex h-11 w-11 items-center justify-center rounded-full text-primary-foreground md:hidden">{menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
            {menuOpen && <div className="absolute inset-x-4 top-20 rounded-2xl border border-white/15 bg-primary p-4 shadow-xl md:hidden"><div className="flex flex-col gap-1"><Link href="/login" onClick={() => setMenuOpen(false)} className="inline-flex items-center justify-center rounded-lg border border-white bg-white px-3 py-3 text-center text-sm font-semibold text-landlinq-blue transition-all duration-300 hover:bg-transparent hover:text-white">Log In</Link></div></div>}
        </nav>
      </header>

      <main>
         <section className="relative bg-primary px-4 pb-12 pt-24 text-primary-foreground sm:px-8 sm:pb-24 sm:pt-32 lg:px-10">
          <div className="relative mx-auto max-w-7xl">
             <div className="flex flex-col items-center gap-8 sm:gap-10 lg:gap-12">
              <div className="max-w-5xl text-center">
                 <h1 className="ll-reveal text-balance text-[clamp(2.65rem,12vw,3.75rem)] font-semibold leading-[0.96] tracking-[-0.06em] sm:text-7xl lg:text-[4.5rem]">Your supercharged<br /><span className="text-[#498EDE]">acquisitions operating system.</span></h1>
                 <p className="ll-reveal ll-delay-2 mx-auto mt-5 max-w-lg text-base leading-6 text-white/68 sm:mt-6 sm:text-lg sm:leading-7">LandLinq opens the lead funnel wide, screens opportunities against your criteria, and keeps outreach moving, so lean teams can do more with less.</p>
                 <div className="ll-reveal ll-delay-3 mt-6 flex w-full max-w-xs flex-col justify-center gap-3 sm:mt-7 sm:max-w-none sm:flex-row"><Button dark>Get in touch</Button><Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/30 px-5 text-sm font-semibold text-white transition-all duration-300 hover:border-white hover:bg-white hover:text-landlinq-blue">Log In</Link></div>
              </div>
               <div className="ll-reveal ll-delay-2 ll-hero-dashboard relative w-full max-w-[1120px]">
                <div className="absolute -inset-5 rounded-[1.5rem] bg-white/5 blur-2xl" />
                <DealOpsMachine />
              </div>
            </div>
          </div>
        </section>

        <HeroStats />

         <section className="ll-journey px-4 py-20 sm:px-8 sm:py-28 lg:px-10 lg:py-36" aria-labelledby="platform-journey-title">
           <div className="mx-auto max-w-7xl">
             <div className="ll-journey-intro">
               <div>
                 <span className="ll-eyebrow">THE INVESTMENT COMPANY WORKSPACE</span>
                 <h2 id="platform-journey-title" className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.05em] sm:text-6xl">One system from first look to next move.</h2>
               </div>
               <p className="max-w-sm text-sm leading-7 text-[#647887] sm:text-base">The same workspace keeps deal review, relationships, outreach, and performance connected for your team.</p>
             </div>
             <div className="ll-journey-route">
               <div className="ll-route-line" aria-hidden="true"><i /></div>
               <article className="ll-journey-step">
                 <div className="ll-step-copy">
                   <div className="ll-step-marker">01</div>
                   <span className="ll-eyebrow">DEAL DASHBOARD</span>
                   <h3>See every opportunity clearly.</h3>
                   <p>Screen incoming land deals, compare the signals that matter, and move the strongest opportunities forward.</p>
                   <div className="ll-step-meta"><span>AI screening</span><span>Table · Pipeline · Map</span></div>
                 </div>
                 <div className="ll-step-surface ll-surface-paper"><DashboardMockup compact /></div>
               </article>
               <article className="ll-journey-step ll-step-outreach">
                 <div className="ll-step-copy">
                   <div className="ll-step-marker">02</div>
                   <span className="ll-eyebrow">CRM</span>
                   <h3>Keep the relationship in view.</h3>
                   <p>Give every broker, owner, and partner a clear record with the context your team needs before the next conversation.</p>
                   <div className="ll-step-meta"><span>Shared contacts</span><span>Ownership</span></div>
                 </div>
                 <div className="ll-step-surface ll-surface-paper"><OutreachMockup /></div>
               </article>
               <article className="ll-journey-step">
                 <div className="ll-step-copy">
                   <div className="ll-step-marker">03</div>
                   <span className="ll-eyebrow">CONTACT DETAIL</span>
                   <h3>Make the next conversation useful.</h3>
                   <p>See history, active campaigns, notes, and related deals together before your team reaches out.</p>
                   <div className="ll-step-meta"><span>Activity history</span><span>Campaign context</span></div>
                 </div>
                 <div className="ll-step-surface ll-surface-navy"><PipelineMockup /></div>
               </article>
               <article className="ll-journey-step ll-step-analytics">
                 <div className="ll-step-copy">
                   <div className="ll-step-marker">04</div>
                   <span className="ll-eyebrow">OUTREACH ANALYTICS</span>
                   <h3>Know what is moving.</h3>
                   <p>Track send activity, sender health, drip sequences, and the follow-up work that keeps the pipeline active.</p>
                   <div className="ll-step-meta"><span>Send health</span><span>Drip status</span></div>
                 </div>
                 <div className="ll-step-surface ll-surface-paper"><OutreachAnalyticsMockup /></div>
               </article>
             </div>
           </div>
         </section>

         <section id="company" data-reveal className="ll-scroll-reveal bg-background px-4 py-16 sm:px-8 sm:py-32 lg:px-10 lg:py-40"><div className="mx-auto max-w-3xl"><div className="mb-10 sm:mb-14"><h2 className="text-4xl font-semibold tracking-[-0.05em] sm:text-6xl">Know what you're getting.</h2></div><div className="divide-y divide-border border-y border-border">{faqs.map(([question, answer], i) => <div key={question}><button type="button" onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i} className="flex w-full items-center justify-between gap-4 py-5 text-left text-base font-semibold sm:gap-5 sm:py-6 sm:text-lg"><span>{question}</span><ChevronDown className={`h-5 w-5 shrink-0 text-primary transition-transform duration-300 ${openFaq === i ? "rotate-180" : ""}`} /></button><div className={`grid transition-[grid-template-rows,opacity] duration-300 ${openFaq === i ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}><div className="overflow-hidden"><p className="max-w-2xl pb-6 leading-7 text-muted-foreground">{answer}</p></div></div></div>)}</div></div></section>

          <section id="contact" data-reveal className="ll-scroll-reveal bg-muted/40 px-4 py-12 sm:px-8 sm:py-20 lg:px-10">
            <div className="mx-auto max-w-7xl rounded-3xl bg-primary p-5 text-primary-foreground sm:p-10 lg:p-12">
             <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-12">
              <div>
                  <h2 className="max-w-2xl text-[clamp(2.25rem,8vw,3.25rem)] font-semibold leading-[1.02] tracking-[-0.05em]">See what a supercharged acquisitions team looks like.</h2>
                  <p className="mt-5 max-w-xl text-base leading-7 text-white/65">Tell us a little about what your team is trying to solve. We’ll be in touch.</p>
              </div>
               <form onSubmit={async (event) => {
                event.preventDefault();
                setContactStatus("sending");
                setContactError("");
                try {
                  const response = await fetch("/api/contact-inquiry", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(contactForm),
                  });
                  const result = await response.json().catch(() => ({}));
                  if (!response.ok) throw new Error(result.error || "We could not send your message.");
                  setContactStatus("success");
                } catch (error) {
                  setContactStatus("error");
                  setContactError(error instanceof Error ? error.message : "We could not send your message.");
                }
                }} className="w-full max-w-[680px] justify-self-end rounded-3xl border border-white/20 p-5 sm:p-6">
                {contactStatus === "success" ? <p className="text-lg font-semibold text-white">Thanks — we’ll be in touch.</p> : <>
                   <div className="grid gap-4 sm:grid-cols-2">
                     <input aria-label="Your name" required value={contactForm.name} onChange={(event) => setContactForm({ ...contactForm, name: event.target.value })} placeholder="Your name" className="h-14 rounded-full border border-white/25 bg-transparent px-6 text-base text-white outline-none transition-colors placeholder:text-white/40 focus:border-white/60" />
                     <input aria-label="Your email" type="email" required value={contactForm.email} onChange={(event) => setContactForm({ ...contactForm, email: event.target.value })} placeholder="you@company.com" className="h-14 rounded-full border border-white/25 bg-transparent px-6 text-base text-white outline-none transition-colors placeholder:text-white/40 focus:border-white/60" />
                  </div>
                    <textarea aria-label="Your message" required rows={5} value={contactForm.message} onChange={(event) => setContactForm({ ...contactForm, message: event.target.value })} placeholder="How can we help?" className="mt-4 min-h-[150px] w-full resize-none rounded-3xl border border-white/25 bg-transparent p-5 text-base leading-7 text-white outline-none transition-colors placeholder:text-white/40 focus:border-white/60" />
                    <button type="submit" disabled={contactStatus === "sending"} className="mt-4 h-12 rounded-full bg-white px-7 text-sm font-semibold text-primary transition-colors hover:bg-white/90 disabled:opacity-60">{contactStatus === "sending" ? "Sending…" : "Send message"}</button>
                  {contactStatus === "error" && <p role="alert" className="mt-3 text-sm text-red-200">{contactError}</p>}
                </>}
              </form>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}