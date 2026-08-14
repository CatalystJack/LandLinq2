import Footer from "@/components/footer";
import { BrokerGamification } from '@/components/broker-gamification';
import { useScrollToTop } from '@/hooks/useScrollToTop';

export default function GamificationPage() {
  useScrollToTop();

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Rewards & Recognition
          </h1>
          <p className="mt-2 text-gray-600">
            Earn points, unlock achievements, and claim rewards for your platform activity
          </p>
        </div>

        <BrokerGamification />
      </div>
      <Footer />
    </div>
  );
}
