import { useEffect, useState } from 'react';
import { Brain, Database, Network, Zap, Globe } from 'lucide-react';

export default function PlatformLayersAnimation() {
  const [activeLayer, setActiveLayer] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveLayer((prev) => (prev + 1) % 5);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const layers = [
    {
      label: 'AI Processing Engine',
      icon: Brain,
      color: 'from-purple-400 to-purple-600',
      position: 'top',
      description: 'GPT-5 powered analysis'
    },
    {
      label: 'Data Aggregation',
      icon: Database,
      color: 'from-blue-400 to-blue-600',
      position: 'middle-top',
      description: 'Multi-source integration'
    },
    {
      label: 'Geospatial Intelligence',
      icon: Network,
      color: 'from-cyan-400 to-cyan-600',
      position: 'middle',
      description: 'GIS & QCT analysis'
    },
    {
      label: 'Analytics Engine',
      icon: Zap,
      color: 'from-indigo-400 to-indigo-600',
      position: 'middle-bottom',
      description: 'Real-time comparables'
    },
    {
      label: 'Communication Layer',
      icon: Globe,
      color: 'from-violet-400 to-violet-600',
      position: 'bottom',
      description: 'Email, SMS, webhooks'
    }
  ];

  return (
    <div className="relative w-full max-w-4xl mx-auto py-16">
      <div className="flex items-center justify-center gap-8 lg:gap-16">
        {/* Left Labels */}
        <div className="hidden md:flex flex-col justify-around h-96 space-y-8">
          {layers.slice(0, 2).map((layer, idx) => {
            const Icon = layer.icon;
            const isActive = activeLayer === idx;
            return (
              <div
                key={idx}
                className={`flex items-center gap-4 transition-all duration-500 ${
                  isActive ? 'opacity-100 scale-105' : 'opacity-60 scale-100'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${layer.color} flex items-center justify-center shadow-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-800">{layer.label}</div>
                  <div className="text-xs text-gray-600">{layer.description}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Center 3D Layers */}
        <div className="relative w-64 h-96 flex items-center justify-center">
          <style>{`
            @keyframes float {
              0%, 100% { transform: translateY(0px) rotateX(60deg); }
              50% { transform: translateY(-10px) rotateX(60deg); }
            }
            .layer-stack {
              transform-style: preserve-3d;
              perspective: 1000px;
            }
            .layer {
              transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
              transform: rotateX(60deg);
            }
            .layer.active {
              transform: rotateX(60deg) scale(1.1);
              filter: brightness(1.2);
            }
          `}</style>

          <div className="layer-stack relative w-full h-full flex flex-col items-center justify-center gap-6">
            {layers.map((layer, idx) => {
              const isActive = activeLayer === idx;
              return (
                <div
                  key={idx}
                  className={`layer absolute w-56 h-16 rounded-full bg-gradient-to-r ${layer.color} shadow-2xl ${
                    isActive ? 'active' : ''
                  }`}
                  style={{
                    top: `${20 + idx * 18}%`,
                    opacity: isActive ? 1 : 0.7,
                    zIndex: 5 - idx,
                    boxShadow: isActive 
                      ? '0 20px 60px rgba(99, 102, 241, 0.4), 0 0 40px rgba(99, 102, 241, 0.3)'
                      : '0 10px 30px rgba(0, 0, 0, 0.2)',
                    animation: isActive ? 'float 3s ease-in-out infinite' : 'none'
                  }}
                >
                  <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 h-1/2 rounded-full bg-gradient-to-t from-black/10 to-transparent" />
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Labels */}
        <div className="hidden md:flex flex-col justify-around h-96 space-y-8">
          {layers.slice(2, 5).map((layer, idx) => {
            const Icon = layer.icon;
            const actualIdx = idx + 2;
            const isActive = activeLayer === actualIdx;
            return (
              <div
                key={actualIdx}
                className={`flex items-center gap-4 transition-all duration-500 ${
                  isActive ? 'opacity-100 scale-105' : 'opacity-60 scale-100'
                }`}
              >
                <div>
                  <div className="text-sm font-bold text-gray-800">{layer.label}</div>
                  <div className="text-xs text-gray-600">{layer.description}</div>
                </div>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${layer.color} flex items-center justify-center shadow-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile Labels - Below Animation */}
      <div className="md:hidden mt-12 grid grid-cols-1 gap-4 px-4">
        {layers.map((layer, idx) => {
          const Icon = layer.icon;
          const isActive = activeLayer === idx;
          return (
            <div
              key={idx}
              className={`flex items-center gap-4 p-4 rounded-xl transition-all duration-500 ${
                isActive 
                  ? 'bg-gradient-to-r ' + layer.color + ' text-white shadow-lg scale-105' 
                  : 'bg-white text-gray-800 shadow-md'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl ${
                isActive ? 'bg-white/20' : 'bg-gradient-to-br ' + layer.color
              } flex items-center justify-center shadow-lg`}>
                <Icon className={`w-6 h-6 ${isActive ? 'text-white' : 'text-white'}`} />
              </div>
              <div>
                <div className="text-sm font-bold">{layer.label}</div>
                <div className={`text-xs ${isActive ? 'text-white/90' : 'text-gray-600'}`}>
                  {layer.description}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
