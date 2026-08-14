import { useEffect, useState, useRef } from "react";
import { Building2, Home, Users, Landmark, HandshakeIcon, LayoutGrid } from "lucide-react";

const productTypes = [
  { icon: Users, label: "Active Adult" },
  { icon: Home, label: "Build-to-Rent" },
  { icon: LayoutGrid, label: "Lot Development" },
  { icon: Building2, label: "Conventional" },
  { icon: HandshakeIcon, label: "Affordable" }
];

export default function ProductEcosystemDiagram() {
  const [isVisible, setIsVisible] = useState(false);
  const [animatedItems, setAnimatedItems] = useState<number[]>([]);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true);
          
          // Trigger staggered animation
          productTypes.forEach((_, index) => {
            setTimeout(() => {
              setAnimatedItems(prev => [...prev, index]);
            }, index * 150);
          });
        }
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, [isVisible]);

  return (
    <div ref={sectionRef} className="space-y-4">
      {productTypes.map((product, index) => {
        const Icon = product.icon;
        const isAnimated = animatedItems.includes(index);
        
        return (
          <div
            key={index}
            className={`flex items-center gap-4 p-4 rounded-lg border bg-white transition-all duration-700 ease-out group hover:shadow-lg hover:border-[#4A90E2] cursor-pointer ${
              isAnimated 
                ? 'opacity-100 translate-x-0' 
                : 'opacity-0 -translate-x-12'
            }`}
            style={{
              borderColor: isAnimated ? '#e5e7eb' : 'transparent'
            }}
          >
            <div className="w-12 h-12 rounded-lg bg-[#4A90E2] flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
              <Icon className="text-white" size={24} />
            </div>
            <span className="text-[#081729] font-medium text-base group-hover:text-[#4A90E2] transition-colors duration-300">
              {product.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
