import { useState, useEffect } from "react";
import { Users, TrendingUp, Target, Award, Heart, Building } from "lucide-react";
import { getAssetUrl } from "@/lib/asset-manifest";

const whiteIconLogo = getAssetUrl("White Icon_1760628698254.png");

// Animated Counter Component
function AnimatedCounter({ targetValue, isPrefix = false }: { targetValue: number; isPrefix?: boolean }) {
  const [currentValue, setCurrentValue] = useState(0);

  useEffect(() => {
    const duration = 2000; // 2 seconds
    const increment = 0.1;
    const totalSteps = targetValue / increment;
    const stepDuration = duration / totalSteps;

    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= targetValue) {
        setCurrentValue(targetValue);
        clearInterval(timer);
      } else {
        setCurrentValue(current);
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [targetValue]);

  const formattedValue = currentValue.toFixed(1);
  return <span>{isPrefix ? '+' : ''}{formattedValue}%</span>;
}

export default function AboutSection() {
  const achievements = [
    {
      icon: Building,
      title: "National Growth",
      description: "Grew a national brokerage from a single office to 20 coast-to-coast locations",
      stat: "20 Locations"
    },
    {
      icon: TrendingUp,
      title: "Sales Volume",
      description: "Closed $8.4B+ in total sales volume, representing 25,000+ units",
      stat: "$8.4B+"
    },
    {
      icon: Award,
      title: "Industry Recognition",
      description: "Inc. 5000 Fastest Growing Company and Best Places to Work honoree",
      stat: "Inc. 5000"
    },
    {
      icon: Target,
      title: "Revenue Growth",
      description: "Guided firms from $0 to $52M in annual revenue with consistent growth",
      stat: "$52M"
    },
    {
      icon: Building,
      title: "Innovation Leader",
      description: "Delivered the first build-to-rent community in the Carolinas, ranked #1 in Charlotte MSA",
      stat: "#1 Ranked"
    },
    {
      icon: Heart,
      title: "Community Impact",
      description: "Supporting philanthropic efforts with more than $100K donated to community initiatives",
      stat: "$100K+"
    }
  ];

  return (
    <section className="py-12 sm:py-18 lg:py-24 bg-gradient-to-br from-catalyst-gray-50 to-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-12 sm:mb-20">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-[#081729] mb-6 sm:mb-8 tracking-tight break-words" data-testid="text-about-title">
            About LandLinq
          </h2>
          <div className="max-w-4xl mx-auto space-y-6 text-center">
            <p className="text-base sm:text-lg text-gray-600 leading-relaxed px-4 sm:px-0">
              LandLinq is a structured broker engagement platform designed to unlock off-market land opportunities in high-growth markets. By aligning incentives with top-performing local brokers, we enable efficient sourcing, controlling, and entitling of development sites with speed, precision, and capital efficiency.
            </p>
            <p className="text-base sm:text-lg text-gray-600 leading-relaxed px-4 sm:px-0">
              We built this platform to bridge the gap between brokers who know their markets intimately and developers who need quality land opportunities. Our AI-powered analysis ensures every submission is evaluated consistently, objectively, and with a developer's perspective in mind.
            </p>
          </div>
        </div>

        {/* Expertise Section */}
        <div className="mb-24">
          <div className="text-center mb-12">
            <p className="text-base sm:text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed px-4 sm:px-0">
              The team behind LandLinq has decades of combined experience in brokerage, investment sales, and development across the multifamily and residential sectors. Their track record includes:
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {achievements.map((achievement, index) => (
              <div 
                key={index}
                className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 group"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-[#4A90E2] rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <achievement.icon className="text-white" size={20} />
                  </div>
                  <div className="text-xl font-bold text-[#4A90E2]">{achievement.stat}</div>
                </div>
                <h4 className="font-semibold text-[#081729] mb-2">{achievement.title}</h4>
                <p className="text-sm text-gray-600 leading-relaxed">{achievement.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Decorative Divider */}
        <div className="flex items-center justify-center mb-16">
          <div className="h-px bg-gradient-to-r from-transparent via-[#4A90E2] to-transparent w-full max-w-md"></div>
          <div className="mx-4 w-2 h-2 bg-[#4A90E2] rounded-full"></div>
          <div className="h-px bg-gradient-to-r from-transparent via-[#4A90E2] to-transparent w-full max-w-md"></div>
        </div>

        {/* Our Mission Section */}
        <div className="relative overflow-hidden -mx-4 sm:-mx-6 lg:-mx-8">
          {/* Background decorative elements */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#081729] to-[#0a2540]"></div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#4A90E2] rounded-full blur-3xl opacity-20"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#4A90E2] rounded-full blur-3xl opacity-10"></div>
          
          <div className="relative z-10 px-8 py-16 sm:px-12 sm:py-20 lg:px-16 lg:py-24">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-[#07172A] rounded-2xl mb-6 shadow-2xl shadow-[#4A90E2]/40">
                <img src={whiteIconLogo} alt="LandLinq Icon" className="w-12 h-12" />
              </div>
              <h3 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
                Our Mission
              </h3>
              <div className="w-24 h-1 bg-gradient-to-r from-transparent via-[#4A90E2] to-transparent mx-auto mb-8"></div>
            </div>
            
            <div className="max-w-4xl mx-auto">
              <p className="text-lg sm:text-xl text-gray-100 leading-relaxed mb-6 text-center">
                At LandLinq, we believe the future of land acquisition lies in <span className="text-[#4A90E2] font-semibold">collaboration</span>, <span className="text-[#4A90E2] font-semibold">transparency</span>, and <span className="text-[#4A90E2] font-semibold">technology</span>. By pairing the local knowledge of brokers with the analytical power of AI, we're creating a more connected, efficient, and profitable path to development.
              </p>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-white/20 mt-8">
                <p className="text-lg text-gray-200 leading-relaxed italic text-center">
                  "Thank you for considering LandLinq for your land opportunities. We are privileged to partner with you."
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
