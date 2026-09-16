import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, MapPin, ShieldCheck } from "lucide-react";

type SharedDeal = {
  address: string;
  propertyName?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  acreage?: string | number | null;
  askingPrice?: string | number | null;
  pricePerAcre?: string | number | null;
  unitCount?: number | null;
  productTypes?: unknown;
  zoning?: string | null;
  sewerAvailable?: boolean | null;
  rent?: {
    topRentPSF?: string | number | null;
    avgRentPSF?: string | number | null;
    topRentPerUnit?: string | number | null;
    avgRentPerUnit?: string | number | null;
  };
  comparableCount?: number;
  comparableNotes?: string | null;
  comparables?: Array<{
    propertyName?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    yearBuilt?: number | string | null;
    unitCount?: number | string | null;
    rentPSF?: number | string | null;
    rentPerUnit?: number | string | null;
    distance?: number | string | null;
  }>;
  environmental?: {
    floodZone?: string | null;
    wetlands?: boolean | null;
    wetlandNotes?: string | null;
    soilType?: string | null;
    environmentalConstraints?: unknown;
  };
  expiresAt: string;
};

function display(value: unknown, fallback = "Not provided") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function money(value: unknown, decimals = 0) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Not provided";
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

function booleanValue(value: boolean | null | undefined) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "Not provided";
}

function productTypeText(value: unknown) {
  if (Array.isArray(value)) return value.join(", ") || "Not provided";
  return display(value);
}

function environmentalConstraintsText(value: unknown) {
  if (!value) return "Not provided";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return "Available";
  }
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-[#081729]">{value}</dd>
    </div>
  );
}

function InvalidShareLink() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <AlertCircle className="mx-auto h-12 w-12 text-amber-500" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold text-[#081729]">
          This link has expired or is invalid
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Ask the person who shared this deal to create a new link. Shared links
          are available for seven days.
        </p>
      </section>
    </main>
  );
}

export default function SharedDealPage() {
  const { token = "" } = useParams<{ token: string }>();
  const { data, isLoading, isError } = useQuery<SharedDeal>({
    queryKey: ["/api/shared-deals", token],
    enabled: /^[0-9a-f]{64}$/i.test(token),
    retry: false,
    queryFn: async () => {
      const response = await fetch(`/api/shared-deals/${encodeURIComponent(token)}`);
      if (!response.ok) {
        throw new Error("This link has expired or is invalid");
      }
      return response.json();
    },
  });

  if (isError || (!isLoading && !data)) return <InvalidShareLink />;

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="text-center text-slate-600">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-[#4A90E2]" />
          <p className="mt-3 text-sm">Loading shared deal…</p>
        </div>
      </main>
    );
  }

  const location = [data.city, data.state, data.zip].filter(Boolean).join(", ");
  const comps = data.comparables || [];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0A2B4A] text-lg font-bold text-white">
              L
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight text-[#081729]">LandLinq</p>
              <p className="text-xs text-slate-500">Shared deal summary</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-xs font-medium text-slate-500 sm:flex">
            <ShieldCheck className="h-4 w-4 text-[#4A90E2]" aria-hidden="true" />
            Read-only view
          </div>
        </header>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-[#081729] px-6 py-7 text-white sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">
              Investment opportunity
            </p>
            <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">
              {display(data.propertyName || data.address, "Shared property")}
            </h1>
            <p className="mt-3 flex items-center gap-2 text-sm text-slate-300">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
              {display(data.address)}{location ? `, ${location}` : ""}
            </p>
          </div>

          <div className="space-y-8 p-6 sm:p-8">
            <section aria-labelledby="property-details-heading">
              <h2 id="property-details-heading" className="text-lg font-semibold text-[#081729]">
                Property details
              </h2>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Detail label="Asking price" value={money(data.askingPrice)} />
                <Detail label="Acreage" value={`${display(data.acreage)} acres`} />
                <Detail label="Price per acre" value={money(data.pricePerAcre)} />
                <Detail label="Zoning" value={display(data.zoning)} />
                <Detail label="Proposed units" value={display(data.unitCount)} />
                <Detail label="Product type" value={productTypeText(data.productTypes)} />
                <Detail label="Sewer available" value={booleanValue(data.sewerAvailable)} />
              </dl>
            </section>

            <section aria-labelledby="rent-heading">
              <h2 id="rent-heading" className="text-lg font-semibold text-[#081729]">
                Rent and comparable data
              </h2>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Detail label="Top rent / SF" value={money(data.rent?.topRentPSF, 2)} />
                <Detail label="Average rent / SF" value={money(data.rent?.avgRentPSF, 2)} />
                <Detail label="Top rent / unit" value={money(data.rent?.topRentPerUnit)} />
                <Detail label="Average rent / unit" value={money(data.rent?.avgRentPerUnit)} />
              </dl>

              {comps.length > 0 ? (
                <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Comparable</th>
                        <th className="px-4 py-3 font-semibold">Year built</th>
                        <th className="px-4 py-3 font-semibold">Units</th>
                        <th className="px-4 py-3 font-semibold">Rent / SF</th>
                        <th className="px-4 py-3 font-semibold">Rent / unit</th>
                        <th className="px-4 py-3 font-semibold">Distance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {comps.map((comp, index) => (
                        <tr key={`${comp.propertyName || comp.address || "comp"}-${index}`}>
                          <td className="px-4 py-3 font-medium text-[#081729]">
                            {display(comp.propertyName || comp.address, "Comparable property")}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{display(comp.yearBuilt)}</td>
                          <td className="px-4 py-3 text-slate-600">{display(comp.unitCount)}</td>
                          <td className="px-4 py-3 text-slate-600">{money(comp.rentPSF, 2)}</td>
                          <td className="px-4 py-3 text-slate-600">{money(comp.rentPerUnit)}</td>
                          <td className="px-4 py-3 text-slate-600">
                            {comp.distance == null ? "Not provided" : `${comp.distance} mi`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                  {display(data.comparableNotes, "No comparable properties are available.")}
                </p>
              )}
              <p className="mt-3 text-xs text-slate-500">
                {data.comparableCount || comps.length} comparable propert{(data.comparableCount || comps.length) === 1 ? "y" : "ies"} included
              </p>
            </section>

            <section aria-labelledby="environment-heading">
              <h2 id="environment-heading" className="text-lg font-semibold text-[#081729]">
                Environmental screening
              </h2>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Detail label="FEMA flood zone" value={display(data.environmental?.floodZone)} />
                <Detail label="Wetlands" value={booleanValue(data.environmental?.wetlands)} />
                <Detail label="Soil type" value={display(data.environmental?.soilType)} />
                <Detail
                  label="Environmental constraints"
                  value={environmentalConstraintsText(data.environmental?.environmentalConstraints)}
                />
                <Detail label="Wetland notes" value={display(data.environmental?.wetlandNotes)} />
              </dl>
            </section>
          </div>
        </section>

        <footer className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-slate-500">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          This read-only link expires {new Date(data.expiresAt).toLocaleDateString()}
        </footer>
      </div>
    </main>
  );
}