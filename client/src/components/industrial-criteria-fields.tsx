import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
          <h4 className="font-semibold text-red-950">Automatic red screens available now</h4>
          <p className="mt-1 text-xs leading-5 text-red-900">
            These are the only hard failures the current data model can support without making an engineering or entitlement assumption.
          </p>
          <div className="mt-3 space-y-2">
            {[
              ["redOutsideTargetMarket", "Outside the configured target state or county"],
              ["redBelowMinimumAcreage", "Below the minimum acreage for any configured industrial format"],
            ].map(([key, label]) => (
              <label key={key} className="flex items-start gap-3 rounded-lg border border-red-200 bg-white p-3">
                <Switch
                  checked={Boolean(criteria[key as keyof IndustrialCriteria])}
                  onCheckedChange={(checked) => update(key as keyof IndustrialCriteria, checked)}
                />
                <span className="text-sm leading-5 text-red-950">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h4 className="font-semibold text-amber-950">Automatic yellow screens available now</h4>
          <p className="mt-1 text-xs leading-5 text-amber-900">
            Yellow means the opportunity may fit, but the current record is incomplete or requires manual site review.
          </p>
          <div className="mt-3 space-y-2">
            {[
              ["yellowMissingLocation", "Address, state, or county is missing or unresolved"],
              ["yellowMissingAcreage", "Acreage is missing or cannot be verified"],
              ["yellowSiteEvidenceUnavailable", "Parcel, building-fit, environmental, access, labor, entitlement, or utility evidence is not automated yet"],
            ].map(([key, label]) => (
              <label key={key} className="flex items-start gap-3 rounded-lg border border-amber-200 bg-white p-3">
                <Switch
                  checked={Boolean(criteria[key as keyof IndustrialCriteria])}
                  onCheckedChange={(checked) => update(key as keyof IndustrialCriteria, checked)}
                />
                <span className="text-sm leading-5 text-amber-950">{label}</span>
              </label>
            ))}
          </div>
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