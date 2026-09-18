import { useMemo, useState } from "react";
import { Copy, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type UnitMixRow = {
  pct: number;
  avgSF: number;
  monthlyRent: number;
};

export type YocAssumptionFieldKey =
  | "dua"
  | "hardCostPu"
  | "assumedLandCostPu"
  | "assumedLandCostPuCoastal"
  | "softCostPct"
  | "otherIncomePum"
  | "fixedOpExPu"
  | "insurancePuNc"
  | "insurancePuCoastal"
  | "vacancyPct"
  | "ltlPct"
  | "concessionPct"
  | "badDebtPct"
  | "mgmtFeePct";

export type YocAssumptionsValue = Record<YocAssumptionFieldKey, string | null> & {
  unitMix: UnitMixRow[] | null;
};

export type YocAssumptionsDefaults = Record<YocAssumptionFieldKey, number> & {
  unitMix: UnitMixRow[];
};

export type YocProductTypeOption = {
  id?: string;
  name: string;
  value: YocAssumptionsValue;
};

export const YOC_ASSUMPTION_KEYS: YocAssumptionFieldKey[] = [
  "dua",
  "hardCostPu",
  "assumedLandCostPu",
  "assumedLandCostPuCoastal",
  "softCostPct",
  "otherIncomePum",
  "fixedOpExPu",
  "insurancePuNc",
  "insurancePuCoastal",
  "vacancyPct",
  "ltlPct",
  "concessionPct",
  "badDebtPct",
  "mgmtFeePct",
];

const PERCENT_KEYS = new Set<YocAssumptionFieldKey>([
  "softCostPct",
  "vacancyPct",
  "ltlPct",
  "concessionPct",
  "badDebtPct",
  "mgmtFeePct",
]);

const FIELD_LABELS: Record<YocAssumptionFieldKey, string> = {
  dua: "Density (units / acre)",
  hardCostPu: "Hard cost / unit",
  assumedLandCostPu: "Land / unit (inland)",
  assumedLandCostPuCoastal: "Land / unit (coastal)",
  softCostPct: "Soft costs",
  otherIncomePum: "Other income / unit / month",
  fixedOpExPu: "Fixed OpEx / unit / year",
  insurancePuNc: "Insurance / unit (NC)",
  insurancePuCoastal: "Insurance / unit (coastal)",
  vacancyPct: "Vacancy",
  ltlPct: "Loss-to-lease",
  concessionPct: "Concessions",
  badDebtPct: "Bad debt",
  mgmtFeePct: "Management fee",
};

type AssumptionGroup = {
  title: string;
  keys: YocAssumptionFieldKey[];
};

const ASSUMPTION_GROUPS: AssumptionGroup[] = [
  {
    title: "Development Costs",
    keys: ["dua", "hardCostPu", "assumedLandCostPu", "assumedLandCostPuCoastal", "softCostPct"],
  },
  {
    title: "Operating Income & Expenses",
    keys: ["otherIncomePum", "fixedOpExPu", "insurancePuNc", "insurancePuCoastal", "mgmtFeePct"],
  },
  {
    title: "Rental Loss Assumptions",
    keys: ["vacancyPct", "ltlPct", "concessionPct", "badDebtPct"],
  },
];

const NATIONAL_DEFAULTS: Record<string, YocAssumptionsDefaults> = {
  "3-story-surface-park": {
    dua: 30, hardCostPu: 164000, assumedLandCostPu: 25000, assumedLandCostPuCoastal: 35000,
    softCostPct: 0.15, otherIncomePum: 198, fixedOpExPu: 6101, insurancePuNc: 550,
    insurancePuCoastal: 700, vacancyPct: 0.05, ltlPct: 0.01, concessionPct: 0.01, badDebtPct: 0,
    mgmtFeePct: 0.0275, unitMix: [{ pct: 0.6, avgSF: 800, monthlyRent: 1600 }, { pct: 0.4, avgSF: 1050, monthlyRent: 2200 }],
  },
  "3-story-attainable": {
    dua: 30, hardCostPu: 137000, assumedLandCostPu: 10000, assumedLandCostPuCoastal: 15000,
    softCostPct: 0.15, otherIncomePum: 198, fixedOpExPu: 6101, insurancePuNc: 550,
    insurancePuCoastal: 700, vacancyPct: 0.05, ltlPct: 0.01, concessionPct: 0.01, badDebtPct: 0,
    mgmtFeePct: 0.0275, unitMix: [{ pct: 0.6, avgSF: 800, monthlyRent: 1400 }, { pct: 0.4, avgSF: 1050, monthlyRent: 1900 }],
  },
  "4-story-surface-park": {
    dua: 35, hardCostPu: 158000, assumedLandCostPu: 30000, assumedLandCostPuCoastal: 45000,
    softCostPct: 0.15, otherIncomePum: 198, fixedOpExPu: 6101, insurancePuNc: 600,
    insurancePuCoastal: 800, vacancyPct: 0.05, ltlPct: 0.01, concessionPct: 0.01, badDebtPct: 0,
    mgmtFeePct: 0.0275, unitMix: [{ pct: 0.6, avgSF: 800, monthlyRent: 1650 }, { pct: 0.4, avgSF: 1050, monthlyRent: 2300 }],
  },
  "aa-3-story-flats": {
    dua: 30, hardCostPu: 167200, assumedLandCostPu: 30000, assumedLandCostPuCoastal: 40000,
    softCostPct: 0.15, otherIncomePum: 207, fixedOpExPu: 9500, insurancePuNc: 575,
    insurancePuCoastal: 750, vacancyPct: 0.05, ltlPct: 0.01, concessionPct: 0.01, badDebtPct: 0,
    mgmtFeePct: 0.0275, unitMix: [{ pct: 0.6, avgSF: 800, monthlyRent: 1750 }, { pct: 0.4, avgSF: 1100, monthlyRent: 2200 }],
  },
  "aa-4-story-flats": {
    dua: 35, hardCostPu: 185500, assumedLandCostPu: 30000, assumedLandCostPuCoastal: 45000,
    softCostPct: 0.15, otherIncomePum: 207, fixedOpExPu: 9500, insurancePuNc: 625,
    insurancePuCoastal: 825, vacancyPct: 0.05, ltlPct: 0.01, concessionPct: 0.01, badDebtPct: 0,
    mgmtFeePct: 0.0275, unitMix: [{ pct: 0.6, avgSF: 800, monthlyRent: 1750 }, { pct: 0.4, avgSF: 1100, monthlyRent: 2200 }],
  },
  "aa-cottages": {
    dua: 6, hardCostPu: 252500, assumedLandCostPu: 30000, assumedLandCostPuCoastal: 40000,
    softCostPct: 0.15, otherIncomePum: 235, fixedOpExPu: 9500, insurancePuNc: 750,
    insurancePuCoastal: 900, vacancyPct: 0.05, ltlPct: 0.01, concessionPct: 0.01, badDebtPct: 0,
    mgmtFeePct: 0.0275, unitMix: [{ pct: 0.25, avgSF: 1200, monthlyRent: 2100 }, { pct: 0.75, avgSF: 1400, monthlyRent: 2900 }],
  },
  "btr-3-story-th": {
    dua: 8, hardCostPu: 254000, assumedLandCostPu: 50000, assumedLandCostPuCoastal: 55000,
    softCostPct: 0.15, otherIncomePum: 251, fixedOpExPu: 7014, insurancePuNc: 750,
    insurancePuCoastal: 900, vacancyPct: 0.05, ltlPct: 0.01, concessionPct: 0.01, badDebtPct: 0,
    mgmtFeePct: 0.0275, unitMix: [{ pct: 0.65, avgSF: 1659, monthlyRent: 2500 }, { pct: 0.35, avgSF: 1996, monthlyRent: 2700 }],
  },
  "btr-sfr-detached": {
    dua: 8, hardCostPu: 258000, assumedLandCostPu: 50000, assumedLandCostPuCoastal: 55000,
    softCostPct: 0.15, otherIncomePum: 247, fixedOpExPu: 7014, insurancePuNc: 800,
    insurancePuCoastal: 950, vacancyPct: 0.05, ltlPct: 0.01, concessionPct: 0.01, badDebtPct: 0,
    mgmtFeePct: 0.0275, unitMix: [{ pct: 0.3, avgSF: 2020, monthlyRent: 2750 }, { pct: 0.7, avgSF: 2600, monthlyRent: 3000 }],
  },
  "btr-th-2-3br": {
    dua: 10, hardCostPu: 230000, assumedLandCostPu: 50000, assumedLandCostPuCoastal: 55000,
    softCostPct: 0.15, otherIncomePum: 251, fixedOpExPu: 7014, insurancePuNc: 750,
    insurancePuCoastal: 900, vacancyPct: 0.05, ltlPct: 0.01, concessionPct: 0.01, badDebtPct: 0,
    mgmtFeePct: 0.0275, unitMix: [{ pct: 0.6, avgSF: 1290, monthlyRent: 1850 }, { pct: 0.4, avgSF: 1495, monthlyRent: 2200 }],
  },
};

const PRODUCT_TYPE_ALIASES: Record<string, string> = {
  "conventional apartments": "3-story-surface-park",
  conventional: "3-story-surface-park",
  "active adult": "aa-3-story-flats",
  "active adult flats": "aa-3-story-flats",
  "active adult cottages": "aa-cottages",
  "student housing": "3-story-surface-park",
  "affordable housing": "3-story-attainable",
  attainable: "3-story-attainable",
  btr: "btr-3-story-th",
  "build-to-rent": "btr-3-story-th",
  "btr townhome": "btr-3-story-th",
  "btr th": "btr-3-story-th",
  "btr sfr": "btr-sfr-detached",
  "btr sfr detached": "btr-sfr-detached",
};

const cloneUnitMix = (rows: UnitMixRow[] | null | undefined) =>
  (rows || []).map((row) => ({ ...row }));

export function createEmptyYocAssumptions(): YocAssumptionsValue {
  return {
    dua: null,
    hardCostPu: null,
    assumedLandCostPu: null,
    assumedLandCostPuCoastal: null,
    softCostPct: null,
    otherIncomePum: null,
    fixedOpExPu: null,
    insurancePuNc: null,
    insurancePuCoastal: null,
    vacancyPct: null,
    ltlPct: null,
    concessionPct: null,
    badDebtPct: null,
    mgmtFeePct: null,
    unitMix: null,
  };
}

export function getNationalYocDefaults(productTypeName: string): YocAssumptionsDefaults {
  const normalizedName = productTypeName.trim().toLowerCase();
  const key = NATIONAL_DEFAULTS[normalizedName]
    ? normalizedName
    : PRODUCT_TYPE_ALIASES[normalizedName] || "3-story-surface-park";
  const defaults = NATIONAL_DEFAULTS[key];
  return {
    ...defaults,
    unitMix: cloneUnitMix(defaults.unitMix),
  };
}

const formatNumber = (value: number) => Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));

function UnitMixEditor({
  value,
  nationalDefaults,
  onChange,
}: {
  value: UnitMixRow[] | null;
  nationalDefaults: UnitMixRow[];
  onChange: (unitMix: UnitMixRow[] | null) => void;
}) {
  const rows = value || [];
  const errors = rows.map((row) => ({
    pct: row.pct < 0 || row.pct > 1 ? "Use 0–100%." : "",
    avgSF: row.avgSF <= 0 ? "Must be greater than 0." : "",
    monthlyRent: row.monthlyRent < 0 ? "Cannot be negative." : "",
  }));

  const updateRow = (index: number, field: keyof UnitMixRow, raw: string) => {
    const numericValue = raw === "" ? 0 : Number(raw);
    const storedValue = field === "pct" ? numericValue / 100 : numericValue;
    onChange(rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: storedValue } : row));
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">% of units</th>
              <th className="px-3 py-2">Avg SF</th>
              <th className="px-3 py-2">Monthly rent</th>
              <th className="w-12 px-3 py-2"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-t border-slate-100 align-top">
                {(["pct", "avgSF", "monthlyRent"] as const).map((field) => (
                  <td key={field} className="px-3 py-2">
                    <Input
                      type="number"
                      min={field === "pct" ? 0 : field === "avgSF" ? 0 : 0}
                      max={field === "pct" ? 100 : undefined}
                      step="0.01"
                      value={field === "pct" ? row.pct * 100 : row[field]}
                      onChange={(event) => updateRow(index, field, event.target.value)}
                      className="bg-white"
                      aria-label={`${field} row ${index + 1}`}
                    />
                    {errors[index][field] && <p className="mt-1 text-xs text-red-600">{errors[index][field]}</p>}
                  </td>
                ))}
                <td className="px-3 py-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
                    aria-label={`Remove unit mix row ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4 text-slate-400" />
                  </Button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={4} className="px-3 py-5 text-center text-sm text-slate-500">
                  No unit mix rows. Add a row or reset this section to the national defaults.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...rows, { pct: 0, avgSF: 0, monthlyRent: 0 }])}
      >
        <Plus className="mr-1 h-4 w-4" />Add row
      </Button>
      <p className="text-xs text-slate-500">
        Percentages are stored as decimals; for example, 60% is saved as 0.6.
      </p>
    </div>
  );
}

export default function YocAssumptionsPanel({
  productType,
  nationalDefaults,
  value,
  onChange,
  otherProductTypes = [],
}: {
  productType: { id?: string; name: string };
  nationalDefaults: YocAssumptionsDefaults;
  value: YocAssumptionsValue;
  onChange: (value: YocAssumptionsValue) => void;
  otherProductTypes?: YocProductTypeOption[];
}) {
  const [copyFrom, setCopyFrom] = useState("");
  const copyOptions = useMemo(
    () => otherProductTypes.filter((option) => option.id !== productType.id || !productType.id),
    [otherProductTypes, productType.id],
  );

  const updateField = (key: YocAssumptionFieldKey, raw: string) => {
    onChange({
      ...value,
      [key]: raw === "" ? null : PERCENT_KEYS.has(key) ? String(Number(raw) / 100) : raw,
    });
  };

  const resetFields = (keys: YocAssumptionFieldKey[]) => {
    const next = { ...value };
    keys.forEach((key) => { next[key] = null; });
    onChange(next);
  };

  const copySelected = () => {
    const source = copyOptions.find((option) => (option.id || option.name) === copyFrom);
    if (!source) return;
    onChange({
      ...source.value,
      unitMix: cloneUnitMix(source.value.unitMix),
    });
    setCopyFrom("");
  };

  const renderField = (key: YocAssumptionFieldKey) => {
    const storedValue = value[key];
    const defaultValue = nationalDefaults[key];
    const isPercent = PERCENT_KEYS.has(key);
    const inputValue = storedValue === null || storedValue === "" || storedValue === undefined
      ? ""
      : isPercent ? String(Number(storedValue) * 100) : String(storedValue);

    return (
      <div key={key}>
        <Label htmlFor={`yoc-${key}`}>{FIELD_LABELS[key]}</Label>
        <div className="relative mt-2">
          <Input
            id={`yoc-${key}`}
            type="number"
            min="0"
            max={isPercent ? 100 : undefined}
            step={isPercent ? "0.01" : "0.01"}
            value={inputValue}
            onChange={(event) => updateField(key, event.target.value)}
            placeholder={isPercent ? `${formatNumber(defaultValue * 100)}` : formatNumber(defaultValue)}
            className={isPercent ? "bg-white pr-8 placeholder:text-slate-400" : "bg-white placeholder:text-slate-400"}
          />
          {isPercent && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-400">%</span>}
        </div>
        <p className="mt-1 text-xs text-slate-400">Blank uses national default: {isPercent ? `${formatNumber(defaultValue * 100)}%` : formatNumber(defaultValue)}</p>
      </div>
    );
  };

  return (
    <Card className="mt-4 border-slate-200 bg-slate-50 shadow-none">
      <CardHeader className="space-y-3 pb-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle className="text-base">Underwriting assumptions</CardTitle>
            <p className="mt-1 text-xs text-slate-500">
              Leave a field blank to use the national underwriting default for {productType.name || "this product type"}.
            </p>
          </div>
          {copyOptions.length > 0 && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-56">
                <Label htmlFor="copy-yoc-from" className="text-xs text-slate-600">Copy from another product type</Label>
                <Select value={copyFrom} onValueChange={setCopyFrom}>
                  <SelectTrigger id="copy-yoc-from" className="mt-1 h-9 bg-white">
                    <SelectValue placeholder="Choose a source" />
                  </SelectTrigger>
                  <SelectContent>
                    {copyOptions.map((option, index) => (
                      <SelectItem key={option.id || `${option.name}-${index}`} value={option.id || option.name}>
                        {option.name || "Unnamed product type"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={copySelected} disabled={!copyFrom}>
                <Copy className="mr-1 h-4 w-4" />Copy
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5 border-t border-slate-200 pt-5">
        {ASSUMPTION_GROUPS.map((group) => (
          <section key={group.title} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h3 className="font-semibold text-slate-900">{group.title}</h3>
              <Button type="button" variant="ghost" size="sm" onClick={() => resetFields(group.keys)}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" />Reset to national defaults
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {group.keys.map(renderField)}
            </div>
          </section>
        ))}

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <h3 className="font-semibold text-slate-900">Unit Mix</h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange({ ...value, unitMix: cloneUnitMix(nationalDefaults.unitMix) })}
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" />Reset to national defaults
            </Button>
          </div>
          <UnitMixEditor
            value={value.unitMix}
            nationalDefaults={nationalDefaults.unitMix}
            onChange={(unitMix) => onChange({ ...value, unitMix })}
          />
        </section>
      </CardContent>
    </Card>
  );
}