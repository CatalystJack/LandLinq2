import { memo, useMemo, useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import Navigation from "@/components/navigation";
import Footer from "@/components/footer";
import ProductEcosystemAnimated from "@/components/product-ecosystem-animated";
import SEO from "@/components/SEO";
import { Building, TrendingUp, Users, CheckCircle, X, Mail, Smartphone, Brain, Database, Bell, Eye, Zap, Shield, Handshake } from "lucide-react";
import { getAssetUrl } from "@/lib/asset-manifest";

const mapBackground = getAssetUrl("image_1760625447005.png");
const whiteIconLogo = getAssetUrl("White Icon_1760628698254.png");
const landLinqLogo = getAssetUrl("LL Header Email_1761148707803.png");

// Company logos
const fannieMae = getAssetUrl("image_1761052822981.png");
const freddieMac = getAssetUrl("image_1761052704036.png");
const blueRock = getAssetUrl("image_1761052745124.png");
const jpMorgan = getAssetUrl("image_1761052729311.png");
const originInvestments = getAssetUrl("image_1761052758767.png");
const davidWeekley = getAssetUrl("image_1761052778479.png");
const wellsFargo = getAssetUrl("image_1761052803480.png");
const carlyleGroup = getAssetUrl("image_1761052842092.png");
const firstTennessee = getAssetUrl("image_1761052881155.png");
const pgim = getAssetUrl("image_1761052895999.png");
const firstNationalBank = getAssetUrl("image_1761052909620.png");
const stanleyMartin = getAssetUrl("image_1761052929840.png");
const ram = getAssetUrl("image_1761052971862.png");
const ursCapital = getAssetUrl("image_1761052990859.png");
const amerisBank = getAssetUrl("image_1761053007194.png");
const stilesConstruction = getAssetUrl("image_1761053022067.png");
const michaels = getAssetUrl("image_1761053044228.png");
const pinnacleFinancial = getAssetUrl("image_1761053057986.png");

// Portfolio project images
const camdenExchangeImage = getAssetUrl("image_1761050916067.png");
const exchangeRockHillImage = getAssetUrl("image_1761050933524.png");
const archerRiverBlueImage = getAssetUrl("image_1761050946547.png");
const hominyRiverBlueImage = getAssetUrl("image_1761050957386.png");
const wayfordPringleImage = getAssetUrl("image_1761051021533.png");
const biltmoreVillageImage = getAssetUrl("image_1761052558234.png");
const wayfordInnovationImage = getAssetUrl("image_1761052606952.png");
const masonImage = getAssetUrl("image_1761054294500.png");
const wombleFarmsImage = getAssetUrl("image_1761054394660.png");
const palmerImage = getAssetUrl("image_1761053734909.png");
const collectiveImage = getAssetUrl("image_1761054355099.png");
const centricGatewayImage = getAssetUrl("image_1761058466027.png");
const boweryWestImage = getAssetUrl("image_1761058419203.png");

const trackRecordData = [
  {
    icon: TrendingUp,
    value: "$8.4B+",
    title: "Sales Volume", 
    description: "Total sales volume closed"
  },
  {
    icon: Building,
    value: "25,000+",
    title: "Units Represented",
    description: "Units represented in transactions"
  },
  {
    icon: TrendingUp,
    value: "$1.5B+",
    title: "Active Development",
    description: "In active development and investment"
  },
  {
    icon: Building,
    value: "18,000+",
    title: "Units Developed",
    description: "Residential units developed or acquired"
  },
  {
    icon: Building,
    value: "15 Projects",
    title: "Under Development",
    description: "Projects under construction or in pre-development"
  }
];

const portfolioProjects = [
  { name: "Camden Exchange", location: "Charlotte, NC", cost: "$204M", image: camdenExchangeImage },
  { name: "Mason", location: "Charlotte, NC", cost: "$68M", image: masonImage },
  { name: "The Wayford at Innovation Park", location: "Charlotte, NC", cost: "$62M", image: wayfordInnovationImage },
  { name: "The Exchange at Rock Hill", location: "Rock Hill, SC", cost: "$60M", image: exchangeRockHillImage },
  { name: "Bowery West", location: "Charlotte, NC", cost: "$57M", image: boweryWestImage },
  { name: "Archer at RiverBlue", location: "Durham, NC", cost: "$69.6M", image: archerRiverBlueImage },
  { name: "Hominy at RiverBlue", location: "Asheville, NC", cost: "$71.7M", image: hominyRiverBlueImage },
  { name: "The Palmer", location: "Charlotte, NC", cost: "$49.4M", image: palmerImage },
  { name: "Womble Farms", location: "Chapel Hill, NC", cost: "$57M", image: wombleFarmsImage },
  { name: "Centric Gateway", location: "Charlotte, NC", cost: "$57.4M", image: centricGatewayImage },
  { name: "The Wayford at Pringle Towns", location: "Charlotte, NC", cost: "$39M", image: wayfordPringleImage },
  { name: "The Collective", location: "Charlotte, NC", cost: "$35M", image: collectiveImage }
];

const StatCard = memo(({ icon: Icon, value, title, description }: {
  icon: any;
  value: string;
  title: string;
  description: string;
}) => (
  <div className="text-center">
    <div className="flex justify-center mb-4">
      <div className="w-16 h-16 bg-catalyst-gold/20 rounded-xl flex items-center justify-center">
        <Icon className="text-catalyst-gold" size={28} />
      </div>
    </div>
    <div className="text-3xl sm:text-4xl font-bold text-[#081729] mb-2">{value}</div>
    <h4 className="font-semibold text-[#081729] mb-2">{title}</h4>
    <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
  </div>
));

StatCard.displayName = 'StatCard';

export default function About() {
  const memoizedTrackRecord = useMemo(() => trackRecordData, []);
  
  return (
    <div className="min-h-screen bg-white">
      <SEO 
        title="About LandLinq"
        description="Meet the LandLinq team. 15+ years of multifamily real estate experience in brokerage, investment sales, and development. $8.4B+ sales volume, 25,000+ units represented."
        keywords="land acquisition experts, multifamily development team, real estate brokerage, investment sales, property development professionals"
        url="https://landlinq.ai/about"
      />
      <Navigation />
      
      {/* Hero Section - Enhanced with CTA Design */}
      <section className="relative py-16 sm:py-20 lg:py-24 bg-gradient-to-br from-[#081729] to-[#0a2540] overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        
        {/* Content */}
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 tracking-tight" data-testid="text-about-title">
            About Us
          </h1>
          <p className="text-xl sm:text-2xl text-gray-200 leading-relaxed max-w-3xl mx-auto">
            Transforming land acquisition through collaboration, transparency, and innovative technology.
          </p>
        </div>


      </section>

      {/* Trusted by Industry Leaders - Single Scrolling Row */}
      <section className="py-6 bg-white border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-4">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#081729] mb-2">
              Trusted by Industry Leaders
            </h2>
            <p className="text-base text-gray-600">
              Deep relationships with the nation's real estate leaders
            </p>
          </div>
        </div>
        
        <style>{`
          @keyframes scroll-left {
            0% {
              transform: translateX(0);
            }
            100% {
              transform: translateX(-50%);
            }
          }
          @keyframes scroll-right {
            0% {
              transform: translateX(-50%);
            }
            100% {
              transform: translateX(0);
            }
          }
          .scrolling-left {
            animation: scroll-left 25s linear infinite;
            will-change: transform;
          }
          .scrolling-right {
            animation: scroll-right 25s linear infinite;
            will-change: transform;
          }
          @media (max-width: 640px) {
            .scrolling-left {
              animation: scroll-left 12s linear infinite;
            }
            .scrolling-right {
              animation: scroll-right 12s linear infinite;
            }
          }
        `}</style>
        
        {/* Company Logos - Scrolling Left */}
        <div className="overflow-hidden">
          <div className="flex scrolling-left py-4 items-center">
            {/* First set */}
            {[
              { type: 'image', src: fannieMae, alt: 'Fannie Mae' },
              { type: 'image', src: freddieMac, alt: 'Freddie Mac' },
              { type: 'image', src: blueRock, alt: 'BlueRock' },
              { type: 'image', src: jpMorgan, alt: 'J.P. Morgan' },
              { type: 'image', src: originInvestments, alt: 'Origin Investments' },
              { type: 'image', src: davidWeekley, alt: 'David Weekley Homes' },
              { type: 'image', src: wellsFargo, alt: 'Wells Fargo' },
              { type: 'image', src: carlyleGroup, alt: 'The Carlyle Group' },
              { type: 'image', src: firstTennessee, alt: 'First Tennessee' },
              { type: 'image', src: pgim, alt: 'PGIM' },
              { type: 'image', src: firstNationalBank, alt: 'First National Bank' },
              { type: 'image', src: stanleyMartin, alt: 'Stanley Martin Homes' },
              { type: 'image', src: ram, alt: 'RAM' },
              { type: 'image', src: ursCapital, alt: 'URS Capital Partners' },
              { type: 'image', src: amerisBank, alt: 'Ameris Bank' },
              { type: 'image', src: stilesConstruction, alt: 'Stiles Construction' },
              { type: 'image', src: michaels, alt: 'Michaels' },
              { type: 'image', src: pinnacleFinancial, alt: 'Pinnacle Financial Partners' }
            ].map((partner, index) => (
              <div key={`partner-1-${index}`} className="flex-shrink-0 px-8 sm:px-12 flex items-center">
                <img 
                  src={partner.src} 
                  alt={partner.alt} 
                  className="h-12 w-32 object-contain grayscale hover:grayscale-0 transition-all opacity-60 hover:opacity-100"
                />
              </div>
            ))}
            {/* Duplicate set for seamless loop */}
            {[
              { type: 'image', src: fannieMae, alt: 'Fannie Mae' },
              { type: 'image', src: freddieMac, alt: 'Freddie Mac' },
              { type: 'image', src: blueRock, alt: 'BlueRock' },
              { type: 'image', src: jpMorgan, alt: 'J.P. Morgan' },
              { type: 'image', src: originInvestments, alt: 'Origin Investments' },
              { type: 'image', src: davidWeekley, alt: 'David Weekley Homes' },
              { type: 'image', src: wellsFargo, alt: 'Wells Fargo' },
              { type: 'image', src: carlyleGroup, alt: 'The Carlyle Group' },
              { type: 'image', src: firstTennessee, alt: 'First Tennessee' },
              { type: 'image', src: pgim, alt: 'PGIM' },
              { type: 'image', src: firstNationalBank, alt: 'First National Bank' },
              { type: 'image', src: stanleyMartin, alt: 'Stanley Martin Homes' },
              { type: 'image', src: ram, alt: 'RAM' },
              { type: 'image', src: ursCapital, alt: 'URS Capital Partners' },
              { type: 'image', src: amerisBank, alt: 'Ameris Bank' },
              { type: 'image', src: stilesConstruction, alt: 'Stiles Construction' },
              { type: 'image', src: michaels, alt: 'Michaels' },
              { type: 'image', src: pinnacleFinancial, alt: 'Pinnacle Financial Partners' }
            ].map((partner, index) => (
              <div key={`partner-2-${index}`} className="flex-shrink-0 px-8 sm:px-12 flex items-center">
                <img 
                  src={partner.src} 
                  alt={partner.alt} 
                  className="h-12 w-32 object-contain grayscale hover:grayscale-0 transition-all opacity-60 hover:opacity-100"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who We Are Section with Animation Side-by-Side */}
      <section className="pt-16 sm:pt-20 pb-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Who We Are Text */}
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-[#081729] mb-6">
                Who We Are
              </h2>
              <div className="space-y-6 text-lg text-gray-600 leading-relaxed">
                <p>
                  LandLinq is redefining how land is acquired and developed. With an average of 15+ years of multifamily real estate experience, our team brings deep expertise in development, acquisitions, capital markets, and investment sales.
                </p>
                <p>
                  We're investors first, technologists second. We built LandLinq because we lived the frustrations of traditional deal flow—the endless emails, the weeks of waiting, the missed opportunities. Now we're solving it with AI-powered automation that respects the human relationships at the heart of every deal.
                </p>
              </div>
            </div>

            {/* Right: Product Animation */}
            <div className="relative">
              <ProductEcosystemAnimated />
            </div>
          </div>
        </div>
      </section>

      {/* Portfolio Section - Scrolling */}
      <section className="py-8 bg-white border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-4">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#081729] mb-2">
              Select Projects
            </h2>
            <p className="text-base text-gray-600">
              18,000+ units developed
            </p>
          </div>
        </div>
        
        <style>{`
          @keyframes portfolio-scroll {
            0% {
              transform: translateX(0);
            }
            100% {
              transform: translateX(-50%);
            }
          }
          .portfolio-scrolling {
            animation: portfolio-scroll 40s linear infinite;
            will-change: transform;
          }
        `}</style>
        
        {/* Portfolio Projects - Scrolling */}
        <div className="overflow-hidden">
          <div className="flex portfolio-scrolling py-2 gap-6">
            {/* First set */}
            {portfolioProjects.map((project, index) => (
              <div 
                key={`project-1-${index}`} 
                className="flex-shrink-0 w-72 rounded-xl overflow-hidden shadow-lg group"
              >
                <div className="relative h-44 overflow-hidden">
                  <img 
                    src={project.image} 
                    alt={project.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    <h3 className="font-bold text-lg mb-1">
                      {project.name === "The Wayford at Innovation Park" ? (
                        <>
                          The Wayford<br />at Innovation Park
                        </>
                      ) : project.name}
                    </h3>
                    <p className="text-sm text-white">{project.location}</p>
                  </div>
                </div>
              </div>
            ))}
            {/* Duplicate set for seamless loop */}
            {portfolioProjects.map((project, index) => (
              <div 
                key={`project-2-${index}`} 
                className="flex-shrink-0 w-72 rounded-xl overflow-hidden shadow-lg group"
              >
                <div className="relative h-44 overflow-hidden">
                  <img 
                    src={project.image} 
                    alt={project.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    <h3 className="font-bold text-lg mb-1">
                      {project.name === "The Wayford at Innovation Park" ? (
                        <>
                          The Wayford<br />at Innovation Park
                        </>
                      ) : project.name}
                    </h3>
                    <p className="text-sm text-white">{project.location}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-12 bg-gray-50 relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          {/* Header */}
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#081729] mb-6">
              Our Mission
            </h2>
            <p className="text-xl sm:text-2xl text-gray-700 leading-relaxed max-w-5xl mx-auto">
              We're creating a new standard for land acquisition through <strong className="text-[#4A90E2]">collaboration</strong>, <strong className="text-[#4A90E2]">transparency</strong>, and <strong className="text-[#4A90E2]">technology</strong>—where every broker is <strong className="text-[#4A90E2]">valued as a partner</strong>, every deal gets <strong className="text-[#4A90E2]">instant attention</strong>, and every opportunity is <strong className="text-[#4A90E2]">maximized</strong>.
            </p>
          </div>
        </div>
      </section>

      {/* Comparison Chart Section */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#081729] mb-4">
              Why Brokers Choose LandLinq
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Work with a developer who respects your time and rewards your expertise.
            </p>
          </div>

          {/* Comparison Table */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-4 px-6 text-sm font-semibold text-gray-600 w-1/3">What Matters Most</th>
                    <th className="text-center py-4 px-6 bg-[#4A90E2]/5">
                      <img 
                        src={landLinqLogo} 
                        alt="LandLinq" 
                        className="h-12 w-32 object-contain mx-auto"
                        data-testid="logo-comparison-table"
                      />
                    </th>
                    <th className="text-center py-4 px-6 text-sm font-semibold text-gray-600">Other Developers</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Response Time */}
                  <tr className="border-b border-gray-100">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#4A90E2]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Zap className="w-5 h-5 text-[#4A90E2]" />
                        </div>
                        <span className="text-sm font-medium text-gray-800">Response time</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center bg-[#4A90E2]/5">
                      <div className="font-semibold text-[#4A90E2]">Instant</div>
                      <div className="text-xs text-gray-500 mt-1">AI-powered analysis in seconds</div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="text-sm text-gray-500">2-4 weeks</div>
                      <div className="text-xs text-gray-400 mt-1">Manual review process</div>
                    </td>
                  </tr>

                  {/* Quick No's */}
                  <tr className="border-b border-gray-100">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#4A90E2]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Brain className="w-5 h-5 text-[#4A90E2]" />
                        </div>
                        <span className="text-sm font-medium text-gray-800">Rejection clarity</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center bg-[#4A90E2]/5">
                      <div className="font-semibold text-[#4A90E2]">Fast & Clear</div>
                      <div className="text-xs text-gray-500 mt-1">Quick no's with detailed reasoning</div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="text-sm text-gray-500">Slow or ghosted</div>
                      <div className="text-xs text-gray-400 mt-1">No response or vague feedback</div>
                    </td>
                  </tr>

                  {/* Broker Compensation */}
                  <tr className="border-t-2 border-b-2 border-[#4A90E2] transition-colors">
                    <td className="py-4 px-6 border-l-2 border-[#4A90E2]">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#4A90E2]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <TrendingUp className="w-5 h-5 text-[#4A90E2]" />
                        </div>
                        <span className="text-sm font-medium text-gray-800">Broker compensation</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center bg-[#4A90E2]/5">
                      <div className="font-semibold text-[#4A90E2]">Extra Commission</div>
                      <div className="text-xs text-gray-500 mt-1">1% rezoning + 1% closing + 2.0% GP promote</div>
                    </td>
                    <td className="py-4 px-6 text-center border-r-2 border-[#4A90E2]">
                      <div className="text-sm text-gray-500">0%</div>
                      <div className="text-xs text-gray-400 mt-1">No extra compensation</div>
                    </td>
                  </tr>

                  {/* Submission Methods */}
                  <tr className="border-b border-gray-100">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#4A90E2]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Mail className="w-5 h-5 text-[#4A90E2]" />
                        </div>
                        <span className="text-sm font-medium text-gray-800">How to submit</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center bg-[#4A90E2]/5">
                      <div className="font-semibold text-[#4A90E2]">Email, SMS, or Web</div>
                      <div className="text-xs text-gray-500 mt-1">Submit your way</div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="text-sm text-gray-500">Email only</div>
                      <div className="text-xs text-gray-400 mt-1">Limited channels</div>
                    </td>
                  </tr>

                  {/* Deal Tracking */}
                  <tr className="border-b border-gray-100">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#4A90E2]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Eye className="w-5 h-5 text-[#4A90E2]" />
                        </div>
                        <span className="text-sm font-medium text-gray-800">Deal visibility</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center bg-[#4A90E2]/5">
                      <div className="font-semibold text-[#4A90E2]">Real-time Dashboard</div>
                      <div className="text-xs text-gray-500 mt-1">Track every deal 24/7</div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="text-sm text-gray-500">Email updates</div>
                      <div className="text-xs text-gray-400 mt-1">Manual status requests</div>
                    </td>
                  </tr>

                  {/* Communication & Transparency */}
                  <tr className="">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#4A90E2]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Bell className="w-5 h-5 text-[#4A90E2]" />
                        </div>
                        <span className="text-sm font-medium text-gray-800">Updates & transparency</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center bg-[#4A90E2]/5">
                      <div className="font-semibold text-[#4A90E2]">Automated & Transparent</div>
                      <div className="text-xs text-gray-500 mt-1">Email + SMS alerts • See every step</div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="text-sm text-gray-500">Manual & Limited</div>
                      <div className="text-xs text-gray-400 mt-1">When they remember • Black box</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action - Enhanced with Mission Section Design */}
      <section className="relative py-12 sm:py-16 bg-gradient-to-br from-[#081729] to-[#0a2540] overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        
        {/* Content */}
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-lg sm:text-xl text-gray-200 mb-8 max-w-2xl mx-auto leading-relaxed">
            Join our network of successful brokers and start earning premium fees & partnership.
          </p>
          <Link href="/submit-deal">
            <Button 
              className="bg-[#4A90E2] text-white hover:bg-white hover:text-[#4A90E2] border-2 border-[#4A90E2] transition-all duration-300 text-base px-8 py-3 font-semibold" 
              data-testid="button-submit-first-deal"
            >
              Submit Your First Deal
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
