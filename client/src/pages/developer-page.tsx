import DeveloperNavigation from "@/components/developer-navigation";

interface DeveloperPageProps {
  title: string;
  description: string;
}

export default function DeveloperPage({ title, description }: DeveloperPageProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <DeveloperNavigation />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Investment Company Portal
          </p>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mt-2 text-slate-500">{description}</p>
        </div>
      </main>
    </div>
  );
}