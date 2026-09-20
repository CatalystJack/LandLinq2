import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import {
  ChevronDown,
  Download,
  List,
  Map,
  Menu,
  Pause,
  Plus,
  Play,
  Search,
  Send,
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
  ["AE", "Alex Example", "alex@example.test", "(555) 010-0101", "Example Realty", "Demo Broker · Multifamily · Example Market", "Demo Owner", "12", "Aug 28, 26"],
  ["TS", "Taylor Sample", "taylor@sample.test", "(555) 010-0102", "Sample Capital", "Demo Seller · Land · Sample Market", "Demo Owner", "8", "Aug 25, 26"],
  ["CD", "Casey Demo", "casey@demo.test", "(555) 010-0103", "Demo Commercial", "Demo Broker · Coastal · BTR", "Demo Owner", "15", "Aug 21, 26"],
  ["JT", "Jordan Test", "jordan@test.test", "(555) 010-0104", "Test Properties", "Demo Broker · Affordable · Test Market", "Demo Owner", "6", "Aug 18, 26"],
  ["RP", "Riley Placeholder", "riley@placeholder.test", "(555) 010-0105", "Placeholder Land Co.", "Demo Owner · Inland · Warm Lead", "Demo Owner", "4", "Aug 14, 26"],
  ["DM", "Drew Mock", "drew@mock.test", "(555) 010-0106", "Mock Partners", "Demo Broker · Active Adult · Example Market", "Demo Owner", "10", "Aug 09, 26"],
  ["SD", "Sam Demo", "sam@demo.test", "(555) 010-0107", "Demo Communities", "Demo Developer · Multifamily · Sample Market", "Demo Owner", "7", "Aug 03, 26"],
  ["ES", "Evan Sample", "evan@sample.test", "(555) 010-0108", "Sample Real Estate", "Demo Broker · Student · Test Market", "Demo Owner", "9", "Jul 29, 26"],
  ["EX", "Ellis Example", "ellis@example.test", "(555) 010-0109", "Example Land Group", "Demo Broker · Priority · Demo Market", "Demo Owner", "11", "Jul 24, 26"],
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
      <div className="ll-detail-hero"><small>‹ Back to contacts</small><div className="ll-detail-person"><i>AE</i><b>Alex<br /><small>Demo Contact</small></b><b>Example<br /><small>• Example Realty</small></b><span>✉ Email　　✎ Edit　 <strong>SAVE CHANGES</strong></span></div><div className="ll-detail-meta"><span>PHONE<br /><b>(555) 010-0101</b></span><span>EMAIL<br /><b>alex@example.test</b></span><span>COMPANY<br /><b>Example Realty</b></span><span>LAST CONTACTED<br /><b>Aug 29, 2026</b></span></div></div>
      <div className="ll-detail-body"><aside><small>RECORD</small><b>Contact details</b>{[["NAME", "Alex Example"], ["EMAIL", "alex@example.test"], ["PHONE", "(555) 010-0101"], ["ACCOUNT / COMPANY", "Example Realty"], ["ASSIGNED TO", "Demo Owner"], ["CONTACT TYPE", "Demo broker"], ["LEAD SOURCE", "Demo referral"], ["LAST CONTACTED", "Aug 29, 2026"]].map(([a, b]) => <label key={a}>{a}<strong>{b}</strong></label>)}</aside><main><div className="ll-detail-tabs"><b>Overview</b><span>Activity</span><span>Deals</span><span>Notes</span></div><div className="ll-detail-cards"><div><small>CREATED</small><b>Feb 12, 2025</b></div><div><small>TYPE</small><b>Demo broker</b></div><div><small>DEALS</small><b>12</b></div><div><small>CAMPAIGNS</small><b>3 active</b></div></div><div className="ll-detail-activity"><div className="ll-detail-event"><i>✉</i><b>Email opened</b><small>Example Parcel A follow-up · Aug 29, 2026</small></div><div className="ll-detail-event"><i>＋</i><b>New deal received</b><small>Sample Parcel B · Aug 27, 2026</small></div><div className="ll-detail-event"><i>✓</i><b>Call completed</b><small>Discussed Example Market pipeline · Aug 22, 2026</small></div></div><div className="ll-detail-section"><small>ORGANIZATION</small><b>Tags</b><span className="ll-detail-tags"><i>Demo Broker</i><i>Multifamily</i><i>Example Market</i><i>Priority</i><i>Warm Relationship</i></span></div><div className="ll-detail-section"><small>OUTREACH</small><b>Campaigns</b><span>Example Broker Follow-up　 • Demo Deal Flow　 • Sample Relationship Nurture</span></div></main></div>
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

function AutoYocMockup() {
  const stages = ["inputs", "rent", "revenue", "expenses"];
  const deals = [
    {
      name: "3-story surface park",
       location: "Example Parcel A · Demo Market",
      yoc: "3.80%",
      units: "1027",
      totalCost: "$430,919,919",
      revenue: "$248,211,348",
      rent: "$1,563/mo",
      inputs: [["Units", "1027"], ["Hard Cost / Unit", "$167,200"], ["Soft Costs", "$15"], ["Fixed OpEx / Unit", "$9,500"], ["Insurance / Unit", "$1,572"], ["Other Income / Unit", "$207"]],
      rentRows: [["Blended Rent", "$1,980 per unit · 0.08 state"], ["Discounted Rent Assumption", "$1,563.33"]],
      revenueRows: [["GPR", "$19,258,381/yr"], ["Other Income", "+$2,990,074/yr"], ["Gross Income", "$21,888,670/yr"], ["Vacancy (5%)", "−$1,018,434"], ["Credit & Loss (4%)", "−$835,100"], ["EGI", "$20,035,137/yr"]],
      expenseRows: [["Mgmt (2.75%)", "$551,158/yr"], ["Fixed OpEx", "$9,720,798/yr"], ["Insurance", "$588,299/yr"], ["Total OpEx", "$10,860,255/yr"], ["NOI", "$9,434,912/yr"]],
    },
    {
      name: "BTR",
       location: "Sample Parcel B · Test Market",
      yoc: "5.37%",
      units: "274",
      totalCost: "$508,580,508",
      revenue: "$102,550,496",
      rent: "$2,313/mo",
      inputs: [["Units", "274"], ["Hard Cost / Unit", "$254,000"], ["Soft Costs", "$15"], ["Fixed OpEx / Unit", "$7,014"], ["Insurance / Unit", "$710"], ["Other Income / Unit", "$251"]],
      rentRows: [["Blended Rent", "$2,176 per unit · 1.40 state"], ["Discounted Rent Assumption", "$2,313"]],
      revenueRows: [["GPR", "$7,104,481/yr"], ["Other Income", "+$824,465/yr"], ["Gross Income", "$8,428,049/yr"], ["Vacancy (5%)", "−$422,152"], ["Credit & Loss (4%)", "−$351,428"], ["EGI", "$7,598,969/yr"]],
      expenseRows: [["Mgmt (2.75%)", "$213,873/yr"], ["Fixed OpEx", "$1,929,151/yr"], ["Insurance", "$85,328/yr"], ["Total OpEx", "$2,341,346/yr"], ["NOI", "$5,558,588/yr"]],
    },
  ];
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => setActiveStage((current) => (current + 1) % stages.length), 2200);
    return () => window.clearInterval(interval);
  }, [stages.length]);

  return (
    <div className="ll-app-frame ll-yoc-breakdown">
      <div className="ll-yoc-breakdown-head"><div><b>YOC Formula Breakdown</b><small>UNDERWRITING OUTPUT</small></div><span>Edit any field → YOC updates automatically</span></div>
      <div className="ll-yoc-alert">⚠ No rental comps — using project rents</div>
      <div className="ll-yoc-deals">
        {deals.map((deal) => (
          <article className="ll-yoc-deal" key={deal.name}>
            <div className="ll-yoc-deal-head"><div><b>{deal.name}</b><small>{deal.location}</small></div><strong>{deal.yoc}<small>YIELD ON COST</small></strong></div>
            <div className="ll-yoc-summary"><span><small>UNITS</small><b>{deal.units}</b></span><span><small>TOTAL COST</small><b>{deal.totalCost}</b></span><span><small>TOTAL REVENUE</small><b>{deal.revenue}</b></span><span><small>TOP RENT</small><b>{deal.rent}</b></span></div>
            <div className={`ll-yoc-breakdown-section ${activeStage === 0 ? "is-active" : ""}`}><div className="ll-yoc-section-label">INPUTS <span>model assumptions</span></div><div className="ll-yoc-input-grid">{deal.inputs.map(([label, value]) => <div className="ll-yoc-input-row" key={label}><span>{label}</span><b>{value}</b></div>)}</div></div>
            <div className={`ll-yoc-breakdown-section ${activeStage === 1 ? "is-active" : ""}`}><div className="ll-yoc-section-label">RENT <span>⚠ project rent</span></div>{deal.rentRows.map(([label, value]) => <div className="ll-yoc-value-row" key={label}><span>{label}</span><b>{value}</b></div>)}</div>
            <div className={`ll-yoc-breakdown-section ${activeStage === 2 ? "is-active" : ""}`}><div className="ll-yoc-section-label">REVENUE &amp; LOSSES</div>{deal.revenueRows.map(([label, value], index) => <div className={`ll-yoc-value-row ${index === 3 || index === 4 ? "is-loss" : index === 5 ? "is-total" : ""}`} key={label}><span>{label}</span><b>{value}</b></div>)}</div>
            <div className={`ll-yoc-breakdown-section ${activeStage === 3 ? "is-active" : ""}`}><div className="ll-yoc-section-label">OPERATING EXPENSES</div>{deal.expenseRows.map(([label, value], index) => <div className={`ll-yoc-value-row ${index === 3 ? "is-total" : index === 4 ? "is-noi" : ""}`} key={label}><span>{label}</span><b>{value}</b></div>)}</div>
          </article>
        ))}
      </div>
    </div>
  );
}

function DripCampaignBuilderMockup() {
  const [activeStep, setActiveStep] = useState(1);
  const steps = [
    ["1", "Audience", "184 eligible contacts"],
    ["2", "Sequence", "3 email steps"],
    ["3", "Review & launch", "Ready to send"],
  ];

  useEffect(() => {
    const interval = window.setInterval(() => setActiveStep((current) => (current + 1) % steps.length), 2800);
    return () => window.clearInterval(interval);
  }, [steps.length]);

  return (
    <div className="ll-app-frame ll-drip-builder">
      <div className="ll-drip-canvas">
        <div className="ll-drip-window">
          <div className="ll-drip-head">
            <div><small>CAMPAIGNS / NEW CAMPAIGN</small><b>Build a drip campaign</b></div>
            <span>Draft <i>●</i></span>
          </div>
          <div className="ll-drip-tabs" role="tablist" aria-label="Campaign setup steps">
            {steps.map(([number, title, detail], index) => (
              <button
                type="button"
                role="tab"
                aria-selected={activeStep === index}
                key={title}
                className={activeStep === index ? "is-active" : ""}
                onClick={() => setActiveStep(index)}
              >
                <b>{number}</b>
                <span>{title}<small>{detail}</small></span>
              </button>
            ))}
          </div>
          <div className="ll-drip-content">
            {activeStep === 0 && <div className="ll-drip-state">
              <small className="ll-drip-kicker">TARGET AUDIENCE</small>
              <h3>Choose who should receive this sequence.</h3>
              <div className="ll-drip-audience-grid">
                <div className="ll-drip-audience"><b>Interested Broker</b><span>CRM tag</span><strong>184 contacts eligible</strong></div>
                 <div className="ll-drip-audience"><b>Example Market</b><span>Saved geography</span><strong>96 contacts eligible</strong></div>
              </div>
            </div>}
            {activeStep === 1 && <div className="ll-drip-state">
              <small className="ll-drip-kicker">SEQUENCE EDITOR</small>
               <h3>Example Broker Follow-up</h3>
               <label>Subject line<input value="A quick introduction to your demo pipeline" readOnly /></label>
              <div className="ll-drip-email-steps">
                <div><b>STEP 1</b><span>Send immediately</span><strong>Introduction and deal criteria</strong></div>
                <div><b>STEP 2</b><span>Wait 3 days</span><strong>Share current acquisition focus</strong></div>
                <div><b>STEP 3</b><span>Wait 7 days</span><strong>Ask about upcoming opportunities</strong></div>
              </div>
            </div>}
            {activeStep === 2 && <div className="ll-drip-state">
              <small className="ll-drip-kicker">REVIEW &amp; LAUNCH</small>
              <h3>Everything is ready to send.</h3>
              <div className="ll-drip-review"><span>Sender</span><b>Demo Owner · connected mailbox</b><span>Audience</span><b>184 contacts with “Interested Broker”</b><span>Sequence</span><b>3 steps · 10 days · automatic follow-up</b></div>
              <button type="button" className="ll-drip-launch">Launch campaign</button>
            </div>}
          </div>
          <div className="ll-drip-window-foot"><span><i /> Connected Outlook account</span><b>Autosaved just now</b></div>
        </div>
      </div>
    </div>
  );
}

function AIAssistantMockup() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const [isThinking, setIsThinking] = useState(false);

  const featuredQuestion = "Which demo-market opportunities have projected YOC above 8% and the strongest rent comps, and what should I review next?";
  const featuredAnswer = "Example Parcel A in Demo Market leads at 9.0% projected YOC and a $2.41 top rent PSF. Sample Parcel B follows at 8.6% and $2.34. Example Parcel A is review-ready, so I’d prioritize it for committee review and model the 280-unit plan next.";

  useEffect(() => {
    let answerTimer: number | undefined;
    const playFeaturedAnswer = () => {
      setMessages([{ role: "user", text: featuredQuestion }]);
      setIsThinking(true);
      answerTimer = window.setTimeout(() => {
        setMessages([
          { role: "user", text: featuredQuestion },
          { role: "assistant", text: featuredAnswer },
        ]);
        setIsThinking(false);
      }, 1700);
    };

    const startTimer = window.setTimeout(playFeaturedAnswer, 700);
    const cycleTimer = window.setInterval(playFeaturedAnswer, 8200);
    return () => {
      window.clearTimeout(startTimer);
      if (answerTimer) window.clearTimeout(answerTimer);
      window.clearInterval(cycleTimer);
    };
  }, []);

  const submitQuestion = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) return;
    setMessages((current) => [
      ...current,
      { role: "user", text: trimmedQuestion },
      { role: "assistant", text: "I can help you find that across your deal pipeline." },
    ]);
    setQuestion("");
  };

  return (
    <div className="ll-ai-assistant" aria-label="Truss AI assistant preview">
      <div className="ll-ai-assistant-head">
        <div className="ll-ai-assistant-title">
          <span><b>Truss</b><small>Your multifamily development copilot</small></span>
        </div>
        <span className="ll-ai-assistant-close" aria-hidden="true"><X /></span>
      </div>
      <div className="ll-ai-assistant-messages" aria-live="polite">
        {messages.map((message, index) => (
          <div className={`ll-ai-message ${message.role === "user" ? "is-user" : "is-assistant"}`} key={`${message.role}-${index}`}>
            {message.text}
          </div>
        ))}
        {isThinking && (
          <div className="ll-ai-thinking" aria-label="Truss is reviewing the deal pipeline">
            <span /><span /><span />
          </div>
        )}
      </div>
      <form className="ll-ai-assistant-input" onSubmit={submitQuestion}>
        <input
          aria-label="Ask Truss a question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask a question..."
        />
        <button type="submit" aria-label="Send question"><Send /></button>
      </form>
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
    ["#84", "Review", "High", "Example Parcel A|Demo Market", "Example Parcel A", "7.8%", "Land", "Affordable", "Demo site plan received", "Strong sample opportunity", "Review density", "Demo timing noted", "$1,845", "$2.18", "YES"],
    ["#83", "Qualified", "High", "Sample Parcel B|Test Market", "Sample Parcel B", "8.6%", "Land", "BTR", "Demo utilities confirmed", "Strong sample market", "Advance to review", "Demo offer due Friday", "$2,120", "$2.34", "YES"],
    ["#82", "Review", "Medium", "Demo Parcel C|Example Market", "Demo Parcel C", "7.4%", "Land", "Conventional", "Sample study pending", "Walkable demo setting", "Confirm access", "Demo survey shared", "$1,765", "$2.06", "YES"],
    ["#81", "Qualified", "High", "Test Parcel D|Placeholder Market", "Test Parcel D", "9.0%", "Land", "Student", "Demo zoning verified", "Strong sample demand", "Model 280 units", "Demo title reported", "$1,980", "$2.41", "YES"],
    ["#80", "Review", "Medium", "Placeholder Parcel E|Mock Market", "Placeholder Parcel E", "7.1%", "Land", "Affordable", "Sample status confirmed", "Transit-ready demo parcel", "Check assumptions", "Demo timing flexible", "$1,690", "$1.98", "YES"],
    ["#79", "Qualified", "Medium", "Example Parcel F|Demo Market", "Example Parcel F", "8.3%", "Land", "Active Adult", "Demo demographics complete", "Strong sample audience", "Begin concept plan", "Sample package received", "$1,725", "$2.09", "YES"],
    ["#78", "Review", "Low", "Sample Parcel G|Test Market", "Sample Parcel G", "7.0%", "Land", "BTR", "Demo report added", "Coastal demo corridor", "Review sample area", "Demo pricing received", "$1,860", "$2.22", "YES"],
    ["#77", "Qualified", "High", "Demo Parcel H|Example Market", "Demo Parcel H", "8.8%", "Land", "Conventional", "Sample comp set refreshed", "Rapid demo growth", "Schedule review", "Demo financing available", "$1,925", "$2.27", "YES"],
    ["#76", "Review", "Medium", "Test Parcel I|Placeholder Market", "Test Parcel I", "7.6%", "Land", "Student", "Demo enrollment data added", "Sample demand driver", "Verify unit mix", "Demo package uploaded", "$1,995", "$2.38", "YES"],
    ["#75", "Qualified", "High", "Placeholder Parcel J|Mock Market", "Placeholder Parcel J", "9.1%", "Land", "Conventional", "Demo access verified", "Prime sample location", "Prepare demo terms", "Sample seller prefers certainty", "$2,180", "$2.46", "YES"],
    ["#74", "Review", "Medium", "Example Parcel K|Demo Market", "Example Parcel K", "7.9%", "Land", "Affordable", "Sample rents modeled", "Established demo node", "Confirm assumptions", "Demo report available", "$1,640", "$1.94", "YES"],
    ["#73", "Qualified", "Low", "Sample Parcel L|Test Market", "Sample Parcel L", "8.1%", "Land", "Active Adult", "Demo maps reviewed", "Low sample basis", "Order demo study", "Flexible demo window", "$1,575", "$1.87", "YES"],
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
          {["STATUS", "PRIORITY", "TYPE", "NEXT"].map((filter) => <button type="button" key={filter} onClick={() => setActiveFilter(filter)} className={`ll-analyst-filter ${activeFilter === filter ? "is-active" : ""}`}>{filter}</button>)}
        </div>
        <div className="ll-analyst-table-scroll">
           <table className="ll-analyst-table"><thead><tr>{columns.map((column) => <th key={column}>{column}{column !== "ID" && <small>↕</small>}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={`${row[0]}-${index}`} className={`ll-cell-${index}`}>{index === 1 ? <b className={`ll-status ll-status-dot ${cell === "Qualified" ? "is-green" : "is-yellow"}`} aria-label={cell} title={cell}><span className="sr-only">{cell}</span></b> : index === 7 ? <b className="ll-type">{cell}</b> : index === 8 ? <b className="ll-notes">{cell}</b> : cell.includes("|") ? cell.split("|").map((line, i) => <span key={line} className={i === 0 ? "ll-address" : "ll-subaddress"}>{line}</span>) : cell}</td>)}</tr>)}</tbody></table>
        </div>
      </div>
    </div>
  );
}

function PipelineWorkspaceMockup() {
  const stages = [
    { name: "New", count: "14", cards: [["Example Parcel A", "Demo Market", "9.0%", "High"], ["Sample Parcel B", "Test Market", "7.1%", "Medium"]] },
    { name: "Qualified", count: "8", cards: [["Demo Parcel C", "Example Market", "9.0%", "Review"], ["Test Parcel D", "Placeholder Market", "8.6%", "Strong fit"]] },
    { name: "Due Diligence", count: "5", cards: [["Placeholder Parcel E", "Mock Market", "9.1%", "Survey due"]] },
    { name: "Closing", count: "2", cards: [["Example Parcel F", "Demo Market", "8.8%", "Terms sent"]] },
  ];

  return (
    <div className="ll-demo-page ll-pipeline-page">
      <div className="ll-demo-page-head">
        <div><small>SALES WORKSPACE</small><h3>Pipeline</h3><p>Track opportunities from first contact through close.</p></div>
        <button type="button">+ NEW OPPORTUNITY</button>
      </div>
      <div className="ll-pipeline-summary"><span><b>29</b> active opportunities</span><span><b>$43.8M</b> weighted pipeline</span><span><b>68%</b> in motion this month</span></div>
      <div className="ll-pipeline-board">
        {stages.map((stage) => (
          <div className="ll-pipeline-column" key={stage.name}>
            <div className="ll-pipeline-column-head"><b>{stage.name}</b><span>{stage.count}</span></div>
            {stage.cards.map(([title, location, yoc, note]) => (
              <div className="ll-pipeline-opportunity" key={title}>
                <strong>{title}</strong><small>{location}</small><div><b>{yoc} YOC</b><em>{note}</em></div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function OutreachWorkspaceMockup() {
  const campaigns = [
    ["Example Broker Follow-up", "184 contacts", "72%", "Due today"],
    ["Q3 Relationship Follow-up", "96 contacts", "48%", "12 queued"],
    ["Multifamily Deal Flow", "63 contacts", "31%", "Healthy"],
  ];

  return (
    <div className="ll-demo-page ll-outreach-page">
      <div className="ll-demo-page-head">
        <div><small>RELATIONSHIP WORKSPACE</small><h3>Outreach</h3><p>Keep follow-up moving without losing the deal context.</p></div>
        <button type="button">+ NEW CAMPAIGN</button>
      </div>
      <div className="ll-demo-tabs"><b>Campaigns</b><span>Sequences</span><span>Senders</span><span>Templates</span></div>
      <div className="ll-outreach-list">
        <div className="ll-outreach-list-head"><span>CAMPAIGN</span><span>AUDIENCE</span><span>PROGRESS</span><span>NEXT ACTION</span><span>STATUS</span></div>
        {campaigns.map(([name, audience, progress, next], index) => (
          <div className="ll-outreach-row" key={name}>
            <strong>{name}<small>{index === 0 ? "Broker relationships" : index === 1 ? "Warm pipeline contacts" : "New deal alerts"}</small></strong>
            <span>{audience}</span>
            <span className="ll-outreach-progress"><i style={{ width: progress }} /><b>{progress}</b></span>
            <span>{next}</span>
            <em>ACTIVE</em>
          </div>
        ))}
      </div>
    </div>
  );
}

function DataHubMockup() {
  const sources = [
    ["HelloData", "Market comparables", "1,284 comps", "Synced 8 min ago", "LIVE"],
    ["HUD", "Affordable housing data", "12,406 records", "Synced today", "LIVE"],
    ["Census + FRED", "Market and economic signals", "48 indicators", "Synced today", "LIVE"],
  ];

  return (
    <div className="ll-demo-page ll-datahub-page">
      <div className="ll-demo-page-head">
        <div><small>PROPRIETARY INTELLIGENCE</small><h3>Data Hub</h3><p>Bring market, property, and deal signals into one decision layer.</p></div>
        <button type="button">REFRESH SOURCES</button>
      </div>
      <div className="ll-datahub-metrics"><div><small>ACTIVE SOURCES</small><b>8</b></div><div><small>LAST SYNC</small><b>8 min</b></div><div><small>RECORDS INDEXED</small><b>1.8M</b></div><div><small>HEALTH</small><b className="is-good">99.8%</b></div></div>
      <div className="ll-datahub-sources">
        {sources.map(([name, description, records, sync, status]) => (
          <div className="ll-datahub-source" key={name}><span className="ll-datahub-source-icon">◈</span><div><strong>{name}</strong><small>{description}</small></div><span><b>{records}</b><small>{sync}</small></span><em>{status}</em></div>
        ))}
      </div>
    </div>
  );
}

function ICMemoMockup() {
  return (
    <div className="ll-demo-page ll-memo-page">
      <div className="ll-memo-toolbar"><span><b>IC MEMO</b> / Example Parcel A</span><span><em>READY FOR REVIEW</em><button type="button">EXPORT PDF</button><button type="button">SHARE WITH IC</button></span></div>
      <div className="ll-memo-document">
        <div className="ll-memo-cover">
          <div className="ll-memo-brand"><span>EG</span><b>Example Capital Group</b><i /> <small>INVESTMENT SUMMARY</small></div>
          <div className="ll-memo-cover-line"><div><small>MULTIFAMILY ACQUISITION OPPORTUNITY</small><h3>Example Parcel A</h3><p>Demo Parcel · Example Market <i>◆</i> Sample County <i>◆</i> Example MSA</p></div><span>Prepared for <b>Investment Committee</b><small>September 16, 2026</small></span></div>
        </div>
        <div className="ll-memo-metrics"><div><small>PRODUCT TYPE</small><b>3-Story<br />Garden</b><span>Surface-Parked</span></div><div><small>UNITS / NET<br />DENSITY</small><b>240</b><span>30.0 DU/A</span></div><div><small>TOTAL DEV. COST</small><b>$55.9M</b><span>$232,870 / unit</span></div><div><small>AUTO YIELD-ON-<br />COST</small><b className="is-gold">6.71%</b><span>Year-1 stabilized</span></div><div><small>AUTO IRR (5-YR<br />HOLD)</small><b className="is-gold">14.4%</b><span>5.25% exit cap</span></div><div><small>FEASIBILITY READ</small><b className="is-green">● PURSUING</b></div></div>
        <div className="ll-memo-grid">
          <div>
            <section className="ll-memo-block"><h4><i>01</i> PROPERTY &amp; PROGRAM</h4><dl><div><dt>Gross / Net Acres</dt><dd>10.5 / 8.0</dd></div><div><dt>Zoning</dt><dd>CR (Conditional Rezoning)</dd></div><div><dt>Proposed Units</dt><dd>240</dd></div><div><dt>Buildings / Stories</dt><dd>10 / 3-story</dd></div><div><dt>Parking (surface)</dt><dd>~408 spaces (1.7 / unit)</dd></div><div><dt>Land Basis (assumed)</dt><dd>$25,000 / unit (inland)</dd></div></dl></section>
            <section className="ll-memo-block"><h4><i>02</i> UNIT MIX</h4><table><thead><tr><th>TYPE</th><th>% MIX</th><th>AVG SF</th><th>ASKING RENT</th></tr></thead><tbody><tr><td>1 Bed / 1 Bath</td><td>60%</td><td>800</td><td>$1,600</td></tr><tr><td>2 Bed / 2 Bath</td><td>40%</td><td>1,050</td><td>$2,200</td></tr><tr className="is-total"><td>Blended</td><td>100%</td><td>905</td><td>$1,853</td></tr></tbody></table></section>
            <section className="ll-memo-block"><h4><i>03</i> DEVELOPMENT COST SUMMARY</h4><table><thead><tr><th>CATEGORY</th><th>TOTAL</th><th>/ UNIT</th></tr></thead><tbody><tr><td>Land Basis</td><td>$6,000,000</td><td>$25,000</td></tr><tr><td>Hard Cost</td><td>$39,360,000</td><td>$164,000</td></tr><tr><td>Soft Costs (15%)</td><td>$5,904,000</td><td>$24,600</td></tr><tr><td>Financing &amp; Carry</td><td>$2,361,600</td><td>$9,840</td></tr><tr><td>Fees &amp; Contingency</td><td>$2,263,200</td><td>$9,430</td></tr><tr className="is-total"><td>Total Development Cost</td><td>$55,888,800</td><td>$232,870</td></tr></tbody></table></section>
            <section className="ll-memo-block"><h4><i>04</i> CAPITAL STACK (ILLUSTRATIVE)</h4><table><thead><tr><th>SOURCE</th><th>%</th><th>AMOUNT</th></tr></thead><tbody><tr><td>Senior Construction Loan</td><td>65%</td><td>$36,327,720</td></tr><tr><td>LP / Sponsor Equity</td><td>35%</td><td>$19,561,080</td></tr><tr className="is-total"><td>Total Capitalization</td><td>100%</td><td>$55,888,800</td></tr></tbody></table></section>
          </div>
          <div>
            <section className="ll-memo-block"><h4><i>05</i> YEAR-1 PRO FORMA</h4><dl><div><dt>Gross Potential Rent</dt><dd>$5,299,200</dd></div><div><dt>Other Income</dt><dd>$570,240</dd></div><div><dt>Vacancy (5.0%) / LTL (1.0%) / Concessions (1.0%)</dt><dd className="is-loss">−$370,944</dd></div><div><dt>Effective Gross Income</dt><dd>$5,498,496</dd></div><div><dt>Fixed Operating Expenses</dt><dd>$1,464,240</dd></div><div><dt>Insurance (inland)</dt><dd>$132,000</dd></div><div><dt>Management Fee (2.75%)</dt><dd>$151,208</dd></div><div className="is-total"><dt>Year-1 Net Operating Income</dt><dd>$3,751,047</dd></div></dl></section>
            <section className="ll-memo-block"><h4><i>06</i> RETURN ASSUMPTIONS &amp; AUTO IRR</h4><div className="ll-memo-assumptions"><span>Rent growth <b>3.00%</b>/yr</span><span>Other income growth <b>3.00%</b>/yr</span><span>Expense growth <b>2.75%</b>/yr</span><span>Hold period <b>5 yrs</b></span><span>Exit cap rate <b>5.25%</b></span></div><div className="ll-memo-irr"><small>5-YEAR AUTO IRR</small><strong>14.4%</strong><span>NOI growth + reversion at exit</span><em>Year-5 NOI: <b>$4.24M</b> · Reversion: <b>$83.3M</b></em></div></section>
            <section className="ll-memo-block"><h4><i>07</i> MARKET SNAPSHOT</h4><dl><div><dt>Submarket</dt><dd>Example Market / Demo Corridor</dd></div><div><dt>3-mi population growth (’19–’24)</dt><dd>+14.2%</dd></div><div><dt>Median HH income (submarket)</dt><dd>$84,300</dd></div><div><dt>Comp set avg. asking rent / SF</dt><dd>$2.04</dd></div><div><dt>Competing pipeline (3 mi)</dt><dd>1 project, 180 units</dd></div></dl></section>
          </div>
        </div>
        <section className="ll-memo-thesis"><h4><i>08</i> INVESTMENT THESIS</h4><p>Example Parcel A pairs an illustrative rezoning scenario with strong demo-market demand, underwriting to a Year-1 Auto-YOC of 6.71% and a 5-year Auto-IRR of 14.4% at a 5.25% exit cap.</p></section>
        <div className="ll-memo-powered">Powered by <b>LandLinq</b></div>
      </div>
    </div>
  );
}

function SecureWorkspaceMockup() {
  const controls = [
    ["Deal criteria", "Private to Investment Company", "LOCKED"],
    ["Contacts & relationships", "Visible to your team only", "LOCKED"],
    ["Outreach activity", "Scoped to your workspace", "PROTECTED"],
  ];

  return (
    <div className="ll-security-visual" aria-label="Private Investment Company workspace preview">
      <div className="ll-security-visual-head">
        <div><span className="ll-security-lock">⌑</span><b>LANDLINQ / WORKSPACE CONTROL</b></div>
        <span className="ll-security-live"><i /> PRIVATE BY DEFAULT</span>
      </div>
      <div className="ll-security-visual-body">
        <div className="ll-security-workspace-card">
          <small>YOUR ORGANIZATION</small>
          <div><span className="ll-security-org-mark">◈</span><div><b>Investment Company</b><span>Acquisitions workspace</span></div><strong>ACTIVE</strong></div>
        </div>
        <div className="ll-security-control-list">
          {controls.map(([title, detail, status]) => <div key={title}><span className="ll-security-check">✓</span><div><b>{title}</b><small>{detail}</small></div><em>{status}</em></div>)}
        </div>
        <div className="ll-security-visual-foot"><span>Workspace boundary</span><b>Only your team can view and act on this data</b><i>↗</i></div>
      </div>
    </div>
  );
}

function SharedWorkspaceMockup() {
  return (
    <div className="ll-shared-workspace-visual" aria-label="Shared LandLinq workspace product preview">
      <div className="ll-shared-workspace-topbar">
        <div><span className="ll-shared-workspace-mark">◈</span><b>INVESTMENT COMPANY</b><small>LANDLINQ WORKSPACE</small></div>
        <span className="ll-shared-workspace-user">MH <i /></span>
      </div>
      <div className="ll-shared-workspace-content">
        <aside>
          <small>WORKSPACE</small>
          <b className="is-active">◫ Deal Dashboard</b>
          <span>▦ Pipeline</span>
          <span>♧ Contacts</span>
          <span>⌁ Outreach</span>
          <span>◈ Data Hub</span>
          <div className="ll-shared-workspace-aside-note"><small>TEAM ACTIVITY</small><b>18 deals reviewed</b><span>this week</span></div>
        </aside>
        <main>
          <div className="ll-shared-workspace-heading"><div><small>DEAL DASHBOARD</small><h3>Good decisions, in one view.</h3></div><button type="button">+ ADD DEAL</button></div>
          <div className="ll-shared-workspace-metrics"><div><small>ACTIVE DEALS</small><b>29</b><span>+6 this month</span></div><div><small>QUALIFIED</small><b>8</b><span>Ready for review</span></div><div><small>PROJECTED YOC</small><b>8.6%</b><span>Portfolio average</span></div></div>
          <div className="ll-shared-workspace-table"><div><span>OPPORTUNITY</span><span>OWNER</span><span>STATUS</span><span>YOC</span></div><div><b>Example Parcel A<small>Demo Market · 280 units</small></b><span>DO</span><em>Qualified</em><strong>9.0%</strong></div><div><b>Sample Parcel B<small>Test Market · 216 units</small></b><span>DO</span><em>Review</em><strong>8.6%</strong></div><div><b>Demo Parcel C<small>Example Market · 184 units</small></b><span>DO</span><em>New</em><strong>7.8%</strong></div></div>
        </main>
      </div>
    </div>
  );
}

function InvestmentCompanyDemo() {
  const [activeScreen, setActiveScreen] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const screens = [
    { label: "Deal Dashboard", detail: "Screen every opportunity", render: <DashboardMockup compact /> },
    { label: "Pipeline", detail: "Move the right deals forward", render: <PipelineWorkspaceMockup /> },
    { label: "CRM", detail: "Keep relationships in view", render: <ContactDirectoryMockup /> },
    { label: "Outreach", detail: "Keep follow-up moving", render: <OutreachWorkspaceMockup /> },
    { label: "Analytics", detail: "See performance clearly", render: <OutreachAnalyticsMockup /> },
    { label: "Data Hub", detail: "Connect market signals", render: <DataHubMockup /> },
    { label: "Truss", detail: "Ask the workspace anything", render: <AIAssistantMockup /> },
  ];

  useEffect(() => {
    if (!isPlaying) return;
    const interval = window.setInterval(() => {
      setActiveScreen((current) => (current + 1) % screens.length);
    }, 4600);
    return () => window.clearInterval(interval);
  }, [isPlaying, screens.length]);

  const current = screens[activeScreen];
  return (
    <div className="ll-company-demo" aria-label="Interactive Investment Company software demo">
      <div className="ll-company-demo-chrome">
        <div className="ll-company-demo-brand"><span>◈</span><b>INVESTMENT COMPANY</b><small>LANDLINQ WORKSPACE</small></div>
        <div className="ll-company-demo-status"><i /> LIVE PRODUCT TOUR <button type="button" onClick={() => setIsPlaying((playing) => !playing)} aria-label={isPlaying ? "Pause product tour" : "Play product tour"}>{isPlaying ? <Pause /> : <Play />}</button></div>
      </div>
      <div className="ll-company-demo-nav" role="tablist" aria-label="Investment Company product pages">
        {screens.map((screen, index) => <button type="button" role="tab" aria-selected={activeScreen === index} className={activeScreen === index ? "is-active" : ""} key={screen.label} onClick={() => { setActiveScreen(index); setIsPlaying(false); }}>{screen.label}</button>)}
      </div>
      <div className="ll-company-demo-stage" aria-live="polite">
        <div className="ll-company-demo-screen" key={current.label}>{current.render}</div>
      </div>
      <div className="ll-company-demo-footer"><span><b>{current.label}</b> · {current.detail}</span><span>{isPlaying ? "Auto tour" : "Tour paused"} · {activeScreen + 1} / {screens.length}</span></div>
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
               <article className="ll-journey-step">
                 <div className="ll-step-copy">
                   <span className="ll-eyebrow">DEAL DASHBOARD</span>
                   <h3>See every opportunity clearly.</h3>
                   <p>Screen incoming land deals, compare the signals that matter, and move the strongest opportunities forward.</p>
                 </div>
                 <div className="ll-step-surface ll-surface-paper"><DashboardMockup compact /></div>
               </article>
                <article className="ll-journey-step">
                  <div className="ll-step-copy">
                    <span className="ll-eyebrow">AUTO YOC</span>
                    <h3>Underwrite a deal with your assumptions.</h3>
                    <p>Set product-specific costs, operating assumptions, unit mix, and exit inputs so every opportunity is measured against the way your team invests.</p>
                  </div>
                  <div className="ll-step-surface ll-surface-paper ll-yoc-step-surface"><AutoYocMockup /></div>
                </article>
               <article className="ll-journey-step ll-step-outreach">
                 <div className="ll-step-copy">
                   <span className="ll-eyebrow">CRM</span>
                   <h3>Keep the relationship in view.</h3>
                   <p>Give every broker, owner, and partner a clear record with the context your team needs before the next conversation.</p>
                 </div>
                 <div className="ll-step-surface ll-surface-paper"><OutreachMockup /></div>
               </article>
               <article className="ll-journey-step">
                 <div className="ll-step-copy">
                   <span className="ll-eyebrow">CONTACT DETAIL</span>
                   <h3>Make the next conversation useful.</h3>
                   <p>See history, active campaigns, notes, and related deals together before your team reaches out.</p>
                 </div>
                  <div className="ll-step-surface ll-surface-paper"><PipelineMockup /></div>
               </article>
                <article className="ll-journey-step">
                  <div className="ll-step-copy">
                    <span className="ll-eyebrow">DRIP CAMPAIGNS</span>
                    <h3>Build follow-up once. Keep it moving.</h3>
                    <p>Choose an audience, write a multi-step sequence, and launch automatic follow-up from your connected Outlook account.</p>
                  </div>
                  <div className="ll-step-surface ll-surface-paper"><DripCampaignBuilderMockup /></div>
                </article>
               <article className="ll-journey-step ll-step-analytics">
                 <div className="ll-step-copy">
                   <span className="ll-eyebrow">OUTREACH ANALYTICS</span>
                   <h3>Know what is moving.</h3>
                   <p>Track send activity, sender health, drip sequences, and the follow-up work that keeps the pipeline active.</p>
                 </div>
                 <div className="ll-step-surface ll-surface-paper"><OutreachAnalyticsMockup /></div>
               </article>
                <article className="ll-journey-step ll-step-chat">
                  <div className="ll-step-copy">
                    <span className="ll-eyebrow">AI ASSISTANT</span>
                    <h3>Ask the workspace what matters next.</h3>
                    <p>Use Truss to ask questions about your deals and get a direct answer without leaving the Investment Company workspace.</p>
                  </div>
                  <div className="ll-step-surface ll-surface-paper"><AIAssistantMockup /></div>
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