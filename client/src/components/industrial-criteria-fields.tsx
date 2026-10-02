import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_INDUSTRIAL_CRITERIA,
  normalizeIndustrialCriteria,
  updateIndustrialProductTypeCriteria,
  type IndustrialCriteria,
} from "@shared/industrial-criteria";
import StateCriteriaOverrides, { type CriteriaOverrideValue } from "@/components/state-criteria-overrides";

type Props = {
  value?: Partial<IndustrialCriteria> | null;
  onChange: (value: IndustrialCriteria) => void;
  targetStates?: string[];
  compact?: boolean;
};

function numberOrNull(value: string): number | null {
  if (value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function toNumericStateOverrides(value: CriteriaOverrideValue): IndustrialCriteria["productTypes"][number]["stateOverrides"] {
  const result: IndustrialCriteria["productTypes"][number]["stateOverrides"] = {};
  for (const [state, fields] of Object.entries(value)) {
    const normalized: { minAcres?: number; maxAcres?: number } = {};
    for (const field of ["minAcres", "maxAcres"] as const) {
      const raw = fields[field];
      if (raw === null || raw === undefined || raw === "") continue;
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed >= 0) normalized[field] = parsed;
    }
    if (Object.keys(normalized).length > 0) result[state] = normalized;
  }
  return result;
}

export default function IndustrialCriteriaFields({ value, onChange, targetStates = [], compact = false }: Props) {
  const criteria = normalizeIndustrialCriteria(value || DEFAULT_INDUSTRIAL_CRITERIA);
  const updateProductType = (
    key: string,
    updates: Partial<IndustrialCriteria["productTypes"][number]>,
  ) => onChange(updateIndustrialProductTypeCriteria(criteria, key, updates));

  const addProductType = () => {
    const existingKeys = new Set(criteria.productTypes.map((productType) => productType.key));
    let suffix = criteria.productTypes.length + 1;
    while (existingKeys.has(`industrial-product-${suffix}`)) suffix += 1;
    onChange({
      ...criteria,
      productTypes: [
        ...criteria.productTypes,
        {
          key: `industrial-product-${suffix}`,
          name: "",
          minAcres: 0,
          maxAcres: null,
          stateOverrides: {},
        },
      ],
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">Industrial product types</h3>
          <p className="mt-1 text-sm text-slate-500">
            A site meets the acreage screen when it matches at least one product type.
          </p>
        </div>
        <Button type="button" variant="outline" className="min-h-10 w-full gap-2 sm:w-auto" onClick={addProductType}>
          <Plus className="h-4 w-4" />
          Add product type
        </Button>
      </div>

      {criteria.productTypes.map((productType, index) => {
        const isBuiltIn = productType.key === "single-load" || productType.key === "cross-dock";
        return (
          <section key={productType.key} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor={`industrial-product-name-${productType.key}`}>
                    Product type name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id={`industrial-product-name-${productType.key}`}
                    value={productType.name}
                    onChange={(event) => updateProductType(productType.key, { name: event.target.value })}
                    placeholder="e.g. Single Load"
                    className="mt-1 bg-white"
                  />
                </div>
                <div className={`grid gap-3 ${compact ? "grid-cols-1" : "grid-cols-2"}`}>
                  <div>
                    <Label htmlFor={`industrial-minimum-${productType.key}`}>
                      Min acres <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id={`industrial-minimum-${productType.key}`}
                      type="number"
                      min="0"
                      step="0.1"
                      value={productType.minAcres === null ? "" : String(productType.minAcres)}
                      onChange={(event) => updateProductType(productType.key, { minAcres: numberOrNull(event.target.value) })}
                      className="mt-1 bg-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`industrial-maximum-${productType.key}`}>Max acres</Label>
                    <Input
                      id={`industrial-maximum-${productType.key}`}
                      type="number"
                      min="0"
                      step="0.1"
                      value={productType.maxAcres === null ? "" : String(productType.maxAcres)}
                      onChange={(event) => updateProductType(productType.key, { maxAcres: numberOrNull(event.target.value) })}
                      placeholder="No maximum"
                      className="mt-1 bg-white"
                    />
                  </div>
                </div>
              </div>
              {!isBuiltIn && (
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-10 w-full gap-2 text-red-700 sm:w-auto"
                  onClick={() => onChange({
                    ...criteria,
                    productTypes: criteria.productTypes.filter((candidate) => candidate.key !== productType.key),
                  })}
                  aria-label={`Remove ${productType.name || `product type ${index + 1}`}`}
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
              )}
            </div>
            <div className="mt-4 border-t border-slate-200 pt-4">
              <StateCriteriaOverrides
                targetStates={targetStates}
                value={productType.stateOverrides}
                fields={[
                  { key: "minAcres", label: "Minimum acreage", suffix: "acres" },
                  { key: "maxAcres", label: "Maximum acreage", suffix: "acres" },
                ]}
                onChange={(stateOverrides) => updateProductType(
                  productType.key,
                  { stateOverrides: toNumericStateOverrides(stateOverrides) },
                )}
              />
            </div>
          </section>
        );
      })}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <h4 className="font-semibold text-red-950">Passed outcome (red)</h4>
          <p className="mt-1 text-xs leading-5 text-red-900">
            The site is outside the configured market, has no verified acreage, or misses every product-type range.
          </p>
          <ul className="mt-3 space-y-2 text-sm leading-5 text-red-950">
            <li>• Outside the company's target states and counties</li>
            <li>• Missing acreage or acreage outside all configured ranges</li>
          </ul>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h4 className="font-semibold text-amber-950">Review outcome (yellow)</h4>
          <p className="mt-1 text-xs leading-5 text-amber-900">
            In-market sites that meet at least one product-type range receive review, not automatic approval.
          </p>
          <ul className="mt-3 space-y-2 text-sm leading-5 text-amber-950">
            <li>• Site is in a configured target state or county</li>
            <li>• Acreage fits at least one configured product type</li>
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
          onChange={(event) => onChange({
            ...criteria,
            default: { ...criteria.default, notes: event.target.value },
          })}
          placeholder="Add criteria the team will review manually, such as truck courts, rail, building height, or utility capacity."
          className="mt-2 min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        />
      </div>
    </div>
  );
}