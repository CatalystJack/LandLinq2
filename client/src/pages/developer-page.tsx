import DeveloperNavigation from "@/components/developer-navigation";
import DeveloperPageHeader from "@/components/developer-page-header";
import Footer from "@/components/footer";

interface DeveloperPageProps {
  title: string;
  description: string;
}

export default function DeveloperPage({ title, description }: DeveloperPageProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <DeveloperNavigation />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <DeveloperPageHeader title={title} description={description} eyebrow="Investment Company Portal" />
      </main>
      <Footer />
    </div>
  );
}