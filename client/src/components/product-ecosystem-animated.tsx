import { useEffect, useState } from "react";
import { Building2, Home, Users, HandshakeIcon, LayoutGrid } from "lucide-react";
import { getAssetUrl } from "@/lib/asset-manifest";

const logoIcon = getAssetUrl("White Icon_1760628698254.png");

const productTypes = [
  { icon: Users, label: "Active Adult", angle: 0 },
  { icon: Home, label: "Build-to-Rent", angle: 72 },
  { icon: LayoutGrid, label: "Lot Development", angle: 144 },
  { icon: Building2, label: "Conventional", angle: 216 },
  { icon: HandshakeIcon, label: "Affordable", angle: 288 }
];

export default function ProductEcosystemAnimated() {
  const [rotation, setRotation] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Continuous rotation animation
    const interval = setInterval(() => {
      setRotation(prev => (prev + 0.3) % 360);
    }, 50);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full h-[400px] flex items-center justify-center">
      {/* Dotted Orbital Circle - Light Blue Path with Custom Spacing */}
      <svg 
        className={`absolute transition-opacity duration-1000 ${
          mounted ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          width: '300px',
          height: '300px',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)'
        }}
      >
        <circle
          cx="150"
          cy="150"
          r="148"
          fill="none"
          stroke="rgba(74, 144, 226, 0.3)"
          strokeWidth="2"
          strokeDasharray="4 12"
        />
      </svg>

      {/* Center Logo - Dark Blue Background with White Icon + Pulse Animation */}
      <div className={`absolute z-10 transition-all duration-1000 ${
        mounted ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
      }`}>
        <div className="w-24 h-24 rounded-2xl shadow-xl flex items-center justify-center animate-pulse-subtle" style={{ backgroundColor: '#07172A' }}>
          <img 
            src={logoIcon} 
            alt="LandLinq" 
            className="w-14 h-14 object-contain"
          />
        </div>
      </div>

      {/* Orbiting Product Types */}
      {productTypes.map((product, index) => {
        const Icon = product.icon;
        const currentAngle = ((product.angle + rotation) * Math.PI) / 180;
        const radius = 150;
        const x = Math.cos(currentAngle) * radius;
        const y = Math.sin(currentAngle) * radius;
        
        return (
          <div
            key={index}
            className={`absolute z-20 transition-opacity duration-1000 ${
              mounted ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              left: '50%',
              top: '50%',
              transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
              transitionDelay: `${index * 100}ms`
            }}
          >
            <div className="flex flex-col items-center gap-2 group cursor-pointer">
              <div 
                className="w-16 h-16 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-2xl shadow-lg"
                style={{ backgroundColor: '#4A90E2' }}
              >
                <Icon className="text-white transition-transform duration-300 group-hover:scale-110" size={28} />
              </div>
              <span className="text-xs font-semibold text-[#081729] bg-white px-3 py-1 rounded-full shadow-sm whitespace-nowrap group-hover:bg-[#4A90E2] group-hover:text-white group-hover:shadow-lg transition-all duration-300">
                {product.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
