import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DEFAULT_INDUSTRIAL_CRITERIA,
  type IndustrialCriteria,
} from "@shared/industrial-criteria";
import StateCriteriaOverrides from "@/components/state-criteria-overrides";

type Props = {
  value?: Partial<IndustrialCriteria> | null;
  onChange: (value: IndustrialCriteria) => void;
  targetStates?: string[];
  compact?: boolean;
};

const INDUSTRIAL_PRODUCT_TYPES = [
  { value: "single-load", label: "Single Load", minimumKey: "minSingleLoadAcres" },
  { value: "cross-dock", label: "Cross-dock", minimumKey: "minCrossDockAcres" },
] as const;

export default function IndustrialCriteriaFields({ value, onChange, targetStates = [], compact = false }: Props) {
  const [selectedProductType, setSelectedProductType] = useState<(typeof INDUSTRIAL_PRODUCT_TYPES)[number]["value"]>("single-load");
  const criteria: IndustrialCriteria = {
    ...DEFAULT_INDUSTRIAL_CRITERIA,
    ...(value || {}),
    default: {
      ...DEFAULT_INDUSTRIAL_CRITERIA.default,
      ...((value as IndustrialCriteria | null)?.default || {}),
    },
    stateOverrides: (value as IndustrialCriteria | null)?.stateOverrides || {},
  };
  const activeProductType = INDUSTRIAL_PRODUCT_TYPES.find((productType) => productType.value === selectedProductType)
    || INDUSTRIAL_PRODUCT_TYPES[0];

  const update = (key: keyof IndustrialCriteria["default"], nextValue: unknown) => {
    onChange({ ...criteria, default: { ...criteria.default, [key]: nextValue } });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-900">Product types</h3>
            <p className="mt-1 text-sm text-slate-500">Set the minimum parcel acreage for each industrial product type.</p>
          </div>
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">Normal (Default)</span>
        </div>
        <div className={`mt-4 grid gap-4 ${compact ? "sm:grid-cols-2" : "md:grid-cols-2"}`}>
          <div>
            <Label htmlFor="industrial-product-type">Product type <span className="text-red-500">*</span></Label>
            <Select
              value={selectedProductType}
              onValueChange={(nextValue) => setSelectedProductType(nextValue as typeof selectedProductType)}
            >
              <SelectTrigger id="industrial-product-type" className="mt-1 bg-white">
                <SelectValue placeholder="Choose product type" />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRIAL_PRODUCT_TYPES.map((productType) => (
                  <SelectItem key={productType.value} value={productType.value}>{productType.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="industrial-minimum-acres">Min acres <span className="text-red-500">*</span></Label>
            <div className="relative mt-1">
              <Input
                id="industrial-minimum-acres"
                type="number"
                min="0"
                step="0.1"
                value={String(criteria.default[activeProductType.minimumKey] ?? "")}
                onChange={(event) => {
                  const raw = event.target.value;
                  if (raw === "") return;
                  const parsed = Number.parseFloat(raw);
                  if (!Number.isFinite(parsed) || parsed < 0) return;
                  update(activeProductType.minimumKey, parsed);
                }}
                className="bg-white pr-16"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-400">acres</span>
            </div>
          </div>
        </div>
        <div className="mt-4 border-t border-slate-200 pt-4">
          <StateCriteriaOverrides
            targetStates={targetStates}
            value={criteria.stateOverrides}
            fields={[{ key: activeProductType.minimumKey, label: "Minimum acreage", suffix: "acres" }]}
            onChange={(stateOverrides) => onChange({ ...criteria, stateOverrides })}
          />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <h4 className="font-semibold text-red-950">Passed outcome (red)</h4>
          <p className="mt-1 text-xs leading-5 text-red-900">
            Industrial sites remain passed unless both review conditions below are met.
          </p>
          <ul className="mt-3 space-y-2 text-sm leading-5 text-red-950">
            <li>• Outside the configured target state or county</li>
            <li>• Acreage is missing or below the minimum industrial acreage</li>
          </ul>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h4 className="font-semibold text-amber-950">Review outcome (yellow)</h4>
          <p className="mt-1 text-xs leading-5 text-amber-900">
            Yellow/review is reserved for sites that meet both minimum industrial screening conditions.
          </p>
          <ul className="mt-3 space-y-2 text-sm leading-5 text-amber-950">
            <li>• Site is in a configured target state or county</li>
            <li>• Acreage meets the single-load minimum</li>
          </ul>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600">
        <p className="font-semibold text-slate-800">Not used for automatic industrial scoring yet</p>
        <p className="mt-1">
          Building-envelope fit, slope, streams, wetlands, interstate drive time, 30/45-minute population, unemployment,
          technical colleges, zoning/entitlement, and utility capacity remain manual-review items until reliable site-level
          evidence is connected.
        </p>
      </div>

      <div>
        <Label htmlFor="industrial-criteria-notes">Additional industrial screening notes</Label>
        <textarea
          id="industrial-criteria-notes"
           value={criteria.default.notes}
           onChange={(event) => update("notes", event.target.value)}
          placeholder="Add criteria the team will review manually, such as truck courts, rail, building height, or utility capacity."
          className="mt-2 min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        />
      </div>
    </div>
  );
}