import { useEffect, useState } from "react";
import { Users, Eye, Cpu } from "lucide-react";

export default function MissionAnimation() {
  const [activeIcon, setActiveIcon] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIcon((prev) => (prev + 1) % 3);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const icons = [
    { Icon: Users, label: "Collaboration", color: "#4A90E2" },
    { Icon: Eye, label: "Transparency", color: "#5BA0F2" },
    { Icon: Cpu, label: "Technology", color: "#3D7BC7" }
  ];

  return (
    <div className="flex justify-center gap-8 sm:gap-12 my-8">
      {icons.map((item, index) => {
        const Icon = item.Icon;
        const isActive = activeIcon === index;
        
        return (
          <div
            key={index}
            className="flex flex-col items-center gap-2 transition-all duration-700"
          >
            <div
              className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center transition-all duration-700 ${
                isActive 
                  ? 'scale-110 shadow-2xl' 
                  : 'scale-100 shadow-lg opacity-60'
              }`}
              style={{ 
                backgroundColor: item.color,
                transform: isActive ? 'translateY(-8px) scale(1.1)' : 'translateY(0) scale(1)'
              }}
            >
              <Icon 
                className={`text-white transition-all duration-700 ${
                  isActive ? 'scale-110' : 'scale-100'
                }`} 
                size={isActive ? 32 : 28} 
              />
              
              {/* Pulsing ring effect */}
              {isActive && (
                <>
                  <div 
                    className="absolute inset-0 rounded-2xl animate-ping" 
                    style={{ 
                      backgroundColor: item.color,
                      opacity: 0.3,
                      animationDuration: '2s'
                    }}
                  />
                  <div 
                    className="absolute inset-0 rounded-2xl animate-ping" 
                    style={{ 
                      backgroundColor: item.color,
                      opacity: 0.2,
                      animationDuration: '2s',
                      animationDelay: '0.5s'
                    }}
                  />
                </>
              )}
            </div>
            
            <span 
              className={`text-xs sm:text-sm font-semibold transition-all duration-700 ${
                isActive 
                  ? 'text-[#4A90E2] scale-110' 
                  : 'text-gray-500 scale-100'
              }`}
            >
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
