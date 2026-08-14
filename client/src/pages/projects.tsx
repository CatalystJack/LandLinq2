import { useState, useMemo } from "react";
import { Link } from "wouter";
import Navigation from "@/components/navigation";
import Footer from "@/components/footer";
import SEO from "@/components/SEO";
import { Building, MapPin, DollarSign, CheckCircle, Clock, Hammer, TrendingUp, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAssetUrl } from "@/lib/asset-manifest";

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

export default function Projects() {
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [cityFilter, setCityFilter] = useState<string>("All");
  const projects = [
    {
      name: "Camden Exchange",
      location: "Charlotte, NC",
      cost: "$204M",
      units: 314,
      type: "Multifamily",
      status: "Pre-Development",
      badge: "FLAGSHIP",
      badgeColor: "bg-catalyst-gold",
      gradient: "from-amber-500 to-orange-600",
      initials: "CE",
      image: camdenExchangeImage
    },
    {
      name: "Catalyst QOZ Biltmore Village",
      location: "Asheville, NC",
      cost: "$78M",
      units: 281,
      type: "Multifamily",
      status: "Under Construction",
      badge: "QOZ",
      badgeColor: "bg-blue-500",
      gradient: "from-blue-500 to-indigo-600",
      initials: "BV",
      image: biltmoreVillageImage
    },
    {
      name: "Hominy at RiverBlue",
      location: "Asheville, NC",
      cost: "$71.7M",
      units: 262,
      type: "Multifamily",
      status: "Under Construction",
      badge: null,
      gradient: "from-green-500 to-emerald-600",
      initials: "HR",
      image: hominyRiverBlueImage
    },
    {
      name: "Archer at RiverBlue",
      location: "Durham, NC",
      cost: "$69.6M",
      units: 245,
      type: "Multifamily",
      status: "Pre-Development",
      badge: null,
      gradient: "from-purple-500 to-violet-600",
      initials: "AR",
      image: archerRiverBlueImage
    },
    {
      name: "Mason",
      location: "Charlotte, NC",
      cost: "$68M",
      units: 302,
      type: "Multifamily",
      status: "Lease-Up",
      badge: null,
      gradient: "from-amber-600 to-yellow-600",
      initials: "MA",
      image: masonImage
    },
    {
      name: "The Wayford at Innovation Park",
      location: "Charlotte, NC",
      cost: "$62M",
      units: 210,
      type: "Multifamily",
      status: "Lease-Up",
      badge: null,
      gradient: "from-pink-500 to-rose-600",
      initials: "WI",
      image: wayfordInnovationImage
    },
    {
      name: "The Exchange at Rock Hill",
      location: "Rock Hill, SC",
      cost: "$60M",
      units: 229,
      type: "Multifamily",
      status: "Fully Stabilized",
      badge: null,
      gradient: "from-indigo-500 to-blue-600",
      initials: "ER",
      image: exchangeRockHillImage
    },
    {
      name: "Bowery West",
      location: "Charlotte, NC",
      cost: "$57M",
      units: 213,
      type: "Multifamily",
      status: "Lease-Up",
      badge: "QOZ",
      badgeColor: "bg-blue-500",
      gradient: "from-teal-500 to-cyan-600",
      initials: "BW",
      image: boweryWestImage
    },
    {
      name: "Womble Farms",
      location: "Chapel Hill, NC",
      cost: "$57M",
      units: 250,
      type: "Multifamily",
      status: "Pre-Development",
      badge: null,
      gradient: "from-cyan-500 to-blue-500",
      initials: "WF",
      image: wombleFarmsImage
    },
    {
      name: "Centric Gateway",
      location: "Charlotte, NC",
      cost: "$57.4M",
      units: 297,
      type: "Multifamily",
      status: "Fully Stabilized",
      badge: null,
      gradient: "from-red-400 to-orange-500",
      initials: "CG",
      image: centricGatewayImage
    },
    {
      name: "The Palmer",
      location: "Charlotte, NC",
      cost: "$49.4M",
      units: 318,
      type: "Multifamily",
      status: "Fully Stabilized",
      badge: "LUXURY",
      badgeColor: "bg-violet-500",
      gradient: "from-violet-500 to-purple-600",
      initials: "TP",
      image: palmerImage
    },
    {
      name: "The Wayford at Pringle Towns",
      location: "Charlotte, NC",
      cost: "$39M",
      units: 102,
      type: "Multifamily",
      status: "Fully Stabilized",
      badge: null,
      gradient: "from-orange-500 to-red-500",
      initials: "WP",
      image: wayfordPringleImage
    },
    {
      name: "The Collective",
      location: "Charlotte, NC",
      cost: "$35M",
      units: 250,
      type: "Multifamily",
      status: "Completed and Sold",
      badge: null,
      gradient: "from-sky-500 to-blue-600",
      initials: "TC",
      image: collectiveImage
    }
  ];

  // Filter projects based on selected filters
  const filteredProjects = useMemo(() => {
    return projects.filter(project => {
      const matchesStatus = statusFilter === "All" || project.status === statusFilter;
      const matchesType = typeFilter === "All" || project.type === typeFilter;
      const projectCity = project.location.split(',')[0].trim();
      const matchesCity = cityFilter === "All" || projectCity === cityFilter;
      
      return matchesStatus && matchesType && matchesCity;
    });
  }, [projects, statusFilter, typeFilter, cityFilter]);

  // Get unique values for filters
  const statuses = ["All", ...Array.from(new Set(projects.map(p => p.status)))];
  const types = ["All", ...Array.from(new Set(projects.map(p => p.type)))];
  const cities = ["All", ...Array.from(new Set(projects.map(p => p.location.split(',')[0].trim())))];

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Projects - LandLinq"
        description="Explore Catalyst Capital Partners' real estate portfolio. $1.3B+ in active development across the Carolinas. Featured projects include Camden Exchange, Mason, and Catalyst QOZ Biltmore Village."
        keywords="catalyst projects, multifamily development, carolina real estate projects, lot development, active adult communities"
        url="https://landlinq.ai/projects"
      />
      <Navigation />
      
      {/* Hero Section */}
      <section className="relative py-16 sm:py-20 lg:py-24 bg-gradient-to-br from-[#081729] to-[#0a2540] overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 tracking-tight">
            Our Portfolio
          </h1>
          <p className="text-xl sm:text-2xl text-gray-200 leading-relaxed max-w-3xl mx-auto">
            From pre-development to stabilized assets, delivering quality multifamily communities.
          </p>
        </div>
      </section>

      {/* Filter Section - Dropdowns */}
      <section className="py-6 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-500" />
              <span className="text-sm font-semibold text-gray-700">Filter by:</span>
            </div>
            
            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 font-medium">Status:</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger 
                  className="w-[180px] h-9 text-sm"
                  data-testid="select-status"
                >
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map(status => (
                    <SelectItem 
                      key={status} 
                      value={status}
                      data-testid={`filter-status-${status.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 font-medium">Type:</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger 
                  className="w-[180px] h-9 text-sm"
                  data-testid="select-type"
                >
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  {types.map(type => (
                    <SelectItem 
                      key={type} 
                      value={type}
                      data-testid={`filter-type-${type.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* City Filter */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 font-medium">City:</label>
              <Select value={cityFilter} onValueChange={setCityFilter}>
                <SelectTrigger 
                  className="w-[180px] h-9 text-sm"
                  data-testid="select-city"
                >
                  <SelectValue placeholder="All Cities" />
                </SelectTrigger>
                <SelectContent>
                  {cities.map(city => (
                    <SelectItem 
                      key={city} 
                      value={city}
                      data-testid={`filter-city-${city.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="ml-auto text-sm text-gray-500 font-medium">
              {filteredProjects.length} of {projects.length} projects
            </div>
          </div>
        </div>
      </section>

      {/* Projects Grid - White background */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {filteredProjects.length === 0 ? (
            <div className="text-center py-16">
              <Building className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No projects found</h3>
              <p className="text-gray-500">Try adjusting your filters to see more projects</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((project, idx) => (
              <div 
                key={idx}
                className="group relative overflow-hidden rounded-2xl bg-white border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                {/* Header - Image or Gradient */}
                {project.image ? (
                  <div className="relative h-48 overflow-hidden">
                    <img 
                      src={project.image} 
                      alt={project.name}
                      className="w-full h-full object-cover"
                    />
                    {/* Badge */}
                    {project.badge && (
                      <div className="absolute top-4 right-4">
                        <span className={`text-xs font-semibold text-white ${project.badgeColor} px-3 py-1.5 rounded-full backdrop-blur-sm bg-opacity-90`}>
                          {project.badge}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`relative h-48 bg-gradient-to-br ${project.gradient} flex items-center justify-center`}>
                    <div className="text-8xl font-bold text-white/20">
                      {project.initials}
                    </div>
                    
                    {/* Badge */}
                    {project.badge && (
                      <div className="absolute top-4 right-4">
                        <span className={`text-xs font-semibold text-white ${project.badgeColor} px-3 py-1.5 rounded-full backdrop-blur-sm`}>
                          {project.badge}
                        </span>
                      </div>
                    )}
                    
                    {/* Building Icon */}
                    <div className="absolute bottom-4 left-4">
                      <Building className="w-8 h-8 text-white/60" />
                    </div>
                  </div>
                )}
                
                {/* Content */}
                <div className="p-6 bg-white">
                  {/* Project Name */}
                  <h3 className="text-xl font-bold text-[#081729] mb-2 leading-tight">
                    {project.name}
                  </h3>
                  
                  {/* Location */}
                  <div className="flex items-center gap-2 text-gray-600 mb-6">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm">{project.location}</span>
                  </div>
                  
                  {/* Metrics Grid */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Project Cost</span>
                      <span className="text-2xl font-bold text-[#081729]">{project.cost}</span>
                    </div>
                    
                    <div className="h-px bg-gray-200" />
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Units</span>
                      <span className="text-lg font-semibold text-[#081729]">{project.units}</span>
                    </div>
                    
                    <div className="h-px bg-gray-200" />
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Type</span>
                      <span className="text-sm font-medium text-gray-700">{project.type}</span>
                    </div>
                    
                    <div className="h-px bg-gray-200" />
                    
                    {/* Status with colored indicator */}
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-sm text-gray-600">Status</span>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          project.status === "Fully Stabilized" ? "bg-green-500" :
                          project.status === "Lease-Up" ? "bg-blue-500" :
                          project.status === "Under Construction" ? "bg-orange-500" :
                          "bg-gray-500"
                        }`} />
                        <span className="text-xs font-medium text-gray-700">{project.status}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Call to Action */}
      <section className="relative py-12 sm:py-16 bg-gradient-to-br from-[#081729] to-[#0a2540] overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        
        {/* Content */}
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Have a Property for Us?
          </h2>
          <p className="text-lg sm:text-xl text-gray-200 mb-8 max-w-2xl mx-auto leading-relaxed">
            Submit your land deal today and join our network of successful brokers earning competitive commissions.
          </p>
          <Link href="/submit-deal">
            <Button 
              className="bg-[#4A90E2] text-white hover:bg-white hover:text-[#4A90E2] border-2 border-[#4A90E2] transition-all duration-300 text-base px-8 py-3 font-semibold" 
              data-testid="button-submit-deal-projects"
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
