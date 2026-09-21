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
  { key: "singleLoadWidthFt", label: "Single-load footprint width", suffix: "feet" },
  { key: "singleLoadLengthFt", label: "Single-load footprint length", suffix: "feet" },
  { key: "crossDockWidthFt", label: "Cross-dock footprint width", suffix: "feet" },
  { key: "crossDockLengthFt", label: "Cross-dock footprint length", suffix: "feet" },
  { key: "maxSlopePct", label: "Maximum footprint slope", suffix: "%" },
  { key: "maxStreamCrossings", label: "Maximum stream crossings", suffix: "crossings", integer: true },
  { key: "maxInterstateMiles", label: "Maximum routed distance to interstate", suffix: "miles" },
  { key: "minPopulation30Min", label: "Minimum population within 30 minutes", suffix: "people", integer: true },
  { key: "minPopulation45Min", label: "Minimum population within 45 minutes", suffix: "people", integer: true },
  { key: "maxUnemploymentPct", label: "Maximum unemployment rate", suffix: "%" },
  { key: "minTechnicalColleges30Min", label: "Technical/community colleges within 30 minutes", suffix: "schools", integer: true },
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

      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ["allowIndustrialZoning", "Accept industrial zoning as green"],
          ["allowIndustrialComprehensivePlan", "Accept industrial comprehensive-plan designation as green"],
          ["allowAdjacentIndustrialYellow", "Flag adjacent industrial zoning/plan areas as yellow"],
          ["requireUtilityReview", "Require utility and power confirmation before approval"],
        ].map(([key, label]) => (
          <label key={key} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3">
            <Switch
              checked={Boolean(criteria[key as keyof IndustrialCriteria])}
              onCheckedChange={(checked) => update(key as keyof IndustrialCriteria, checked)}
            />
            <span className="text-sm leading-5 text-slate-700">{label}</span>
          </label>
        ))}
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