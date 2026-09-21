import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_INDUSTRIAL_CRITERIA,
  type IndustrialCriteria,
} from "@shared/industrial-criteria";

type Props = {
  value?: Partial<IndustrialCriteria> | null;
  onChange: (value: IndustrialCriteria) => void;
  compact?: boolean;
};

const numberFields: Array<{
  key: keyof IndustrialCriteria;
  label: string;
  suffix?: string;
  description?: string;
  integer?: boolean;
}> = [
  { key: "minSingleLoadAcres", label: "Single-load minimum parcel", suffix: "acres" },
  { key: "minCrossDockAcres", label: "Cross-dock minimum parcel", suffix: "acres" },
];

export default function IndustrialCriteriaFields({ value, onChange, compact = false }: Props) {
  const criteria: IndustrialCriteria = {
    ...DEFAULT_INDUSTRIAL_CRITERIA,
    ...(value || {}),
  };

  const update = (key: keyof IndustrialCriteria, nextValue: unknown) => {
    onChange({ ...criteria, [key]: nextValue });
  };

  return (
    <div className="space-y-6">
      <div className={`grid gap-4 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        {numberFields.map((field) => (
          <div key={field.key}>
            <Label htmlFor={`industrial-${String(field.key)}`}>{field.label}</Label>
            <div className="relative mt-2">
              <Input
                id={`industrial-${String(field.key)}`}
                type="number"
                min="0"
                step={field.integer ? "1" : "0.1"}
                value={String(criteria[field.key] ?? "")}
                onChange={(event) => {
                  const raw = event.target.value;
                  update(field.key, raw === "" ? 0 : field.integer ? Number.parseInt(raw, 10) : Number.parseFloat(raw));
                }}
                className={field.suffix ? "pr-16 bg-white" : "bg-white"}
              />
              {field.suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-400">{field.suffix}</span>}
            </div>
          </div>
        ))}
      </div>

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
          value={criteria.notes}
          onChange={(event) => update("notes", event.target.value)}
          placeholder="Add criteria the team will review manually, such as truck courts, rail, building height, or utility capacity."
          className="mt-2 min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        />
      </div>
    </div>
  );
}