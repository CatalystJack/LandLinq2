import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCountyTarget, parseCountyTarget } from "@shared/county-targets";
import {
  getUsStateLabel,
  isUsStateCode,
  normalizeUsStateCode,
  US_STATE_OPTIONS,
} from "@shared/us-states";

export function StateMultiSelect({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const selectedCodes = Array.from(new Set(
    values.map(normalizeUsStateCode).filter(isUsStateCode),
  ));

  return (
    <div>
      <Label>{label}</Label>
      <select
        multiple
        size={6}
        value={selectedCodes}
        onChange={(event) => onChange(Array.from(event.target.selectedOptions, (option) => option.value))}
        className="mt-2 min-h-36 w-full rounded-md border border-slate-200 bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
        aria-label={label}
      >
        {US_STATE_OPTIONS.map((state) => (
          <option key={state.code} value={state.code}>{state.name}</option>
        ))}
      </select>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {selectedCodes.length > 0 ? selectedCodes.map((code) => (
          <Badge key={code} variant="outline" className="gap-1 border-catalyst-blue/20 bg-catalyst-blue/10 pr-1 text-catalyst-navy">
            {getUsStateLabel(code)} ({code})
            <button
              type="button"
              onClick={() => onChange(selectedCodes.filter((selectedCode) => selectedCode !== code))}
              aria-label={`Remove ${getUsStateLabel(code)} from ${label}`}
              className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-catalyst-navy/70 hover:bg-catalyst-blue/15 hover:text-catalyst-navy focus:outline-none focus:ring-2 focus:ring-catalyst-blue/50"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </Badge>
        )) : <span className="text-xs text-slate-500">Select one or more states.</span>}
      </div>
      <p className="mt-1 text-xs text-slate-500">Use Ctrl/Cmd-click or Shift-click to select multiple states.</p>
    </div>
  );
}

type CountyTargetEntry = {
  target: string;
  county: string;
  state: string | null;
};

function countyLabelValue(entry: CountyTargetEntry, labels: Record<string, string>): string {
  return labels[entry.target]?.trim()
    ? labels[entry.target]
    : labels[entry.county] || "";
}

function CountyTargetRows({
  entries,
  labels,
  onLabelsChange,
  onRemove,
  stateLabel,
}: {
  entries: CountyTargetEntry[];
  labels: Record<string, string>;
  onLabelsChange: (labels: Record<string, string>) => void;
  onRemove: (entry: CountyTargetEntry) => void;
  stateLabel: string;
}) {
  if (!entries.length) {
    return <p className="text-sm text-slate-500">No target counties assigned yet.</p>;
  }

  const groups = entries.reduce<Record<string, CountyTargetEntry[]>>((result, entry) => {
    const market = labels[entry.target]?.trim() || labels[entry.county]?.trim() || "Other markets";
    (result[market] ||= []).push(entry);
    return result;
  }, {});

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">County groups</p>
      <div className="space-y-4">
        {Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([market, counties]) => (
          <div key={market}>
            <p className="mb-2 text-xs font-semibold text-slate-700">{market}</p>
            <div className="space-y-2">
              {counties.map((entry) => (
                <div key={entry.target} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
                  <span className="text-sm font-medium text-slate-800">{entry.county}</span>
                  <Input
                    value={countyLabelValue(entry, labels)}
                    onChange={(event) => onLabelsChange({ ...labels, [entry.target]: event.target.value })}
                    placeholder="Market label, e.g. CLT"
                    aria-label={`${entry.county} market label for ${stateLabel}`}
                    className="h-8 bg-white"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(entry)}
                    aria-label={`Remove ${entry.county} from ${stateLabel}`}
                  >
                    <Trash2 className="h-4 w-4 text-slate-400" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CountyMarketEditor({
  states,
  values,
  labels,
  onCountiesChange,
  onLabelsChange,
}: {
  states: string[];
  values: string[];
  labels: Record<string, string>;
  onCountiesChange: (values: string[]) => void;
  onLabelsChange: (labels: Record<string, string>) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const selectedStates = Array.from(new Set(
    states.map(normalizeUsStateCode).filter(isUsStateCode),
  ));
  const entries: CountyTargetEntry[] = values.map((target) => {
    const parsed = parseCountyTarget(target);
    return {
      target,
      county: parsed.county,
      state: parsed.state ? normalizeUsStateCode(parsed.state) : null,
    };
  });
  const countyStates = Array.from(new Set(
    entries.map((entry) => entry.state).filter((state): state is string => Boolean(state)),
  ));
  const unselectedStates = countyStates
    .filter((state) => !selectedStates.includes(state))
    .sort((a, b) => a.localeCompare(b));
  const statesToRender = [...selectedStates, ...unselectedStates];

  const removeCounty = (entry: CountyTargetEntry) => {
    const nextValues = values.filter((value) => value !== entry.target);
    onCountiesChange(nextValues);

    const nextLabels = { ...labels };
    delete nextLabels[entry.target];
    if (!nextValues.some((value) =>
      parseCountyTarget(value).county.toLowerCase() === entry.county.toLowerCase(),
    )) {
      delete nextLabels[entry.county];
    }
    onLabelsChange(nextLabels);
  };

  const addCounty = (state: string) => {
    const rawEntry = (drafts[state] || "").trim();
    if (!rawEntry) return;

    const parsed = parseCountyTarget(rawEntry);
    const county = parsed.county.trim();
    if (!county) return;
    if (parsed.state && normalizeUsStateCode(parsed.state) !== state) {
      setErrors((current) => ({
        ...current,
        [state]: `This county is marked ${parsed.state}; add it under that state instead.`,
      }));
      return;
    }

    const duplicate = entries.some((entry) =>
      entry.state === state && entry.county.toLowerCase() === county.toLowerCase(),
    );
    if (duplicate) {
      setErrors((current) => ({ ...current, [state]: `${county} is already listed for ${state}.` }));
      return;
    }

    onCountiesChange([...values, formatCountyTarget(county, state)]);
    setDrafts((current) => ({ ...current, [state]: "" }));
    setErrors((current) => ({ ...current, [state]: "" }));
  };

  const renderStateSection = (state: string, selected: boolean) => {
    const stateEntries = entries.filter((entry) => entry.state === state);
    const stateLabel = `${getUsStateLabel(state)} (${state})`;
    const inputId = `target-county-${state.toLowerCase()}`;

    return (
      <section key={state} className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-slate-900">{stateLabel}</h4>
          {!selected && (
            <Badge variant="outline" className="text-xs text-slate-500">Not in Target states</Badge>
          )}
        </div>
        {selected ? (
          <div>
            <Label htmlFor={inputId} className="text-xs font-medium text-slate-600">Add county</Label>
            <div className="mt-1 flex gap-2">
              <Input
                id={inputId}
                value={drafts[state] || ""}
                onChange={(event) => {
                  setDrafts((current) => ({ ...current, [state]: event.target.value }));
                  setErrors((current) => ({ ...current, [state]: "" }));
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCounty(state);
                  }
                }}
                placeholder={`County in ${state}`}
                aria-label={`Add county in ${stateLabel}`}
                className="h-9 bg-white"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => addCounty(state)}>
                <Plus className="mr-1.5 h-4 w-4" />
                Add county
              </Button>
            </div>
            {errors[state] && <p role="alert" className="mt-1 text-xs text-red-600">{errors[state]}</p>}
          </div>
        ) : (
          <p className="text-xs text-slate-500">Add this state to Target states above to add counties here.</p>
        )}
        <CountyTargetRows
          entries={stateEntries}
          labels={labels}
          onLabelsChange={onLabelsChange}
          onRemove={removeCounty}
          stateLabel={stateLabel}
        />
      </section>
    );
  };

  const unassignedEntries = entries.filter((entry) => !entry.state);

  return (
    <div className="space-y-3">
      <div>
        <Label>Target counties</Label>
        {selectedStates.length === 0 && (
          <p className="mt-1 text-xs text-slate-500">
            Add a target state above before adding its counties.
          </p>
        )}
      </div>
      <div className="space-y-3">
        {statesToRender.map((state) => renderStateSection(state, selectedStates.includes(state)))}
        {unassignedEntries.length > 0 && (
          <section className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Unassigned state</h4>
              <p className="mt-1 text-xs text-slate-600">
                These legacy counties match by name only. Add each county under the correct state above, then remove it here.
              </p>
            </div>
            <CountyTargetRows
              entries={unassignedEntries}
              labels={labels}
              onLabelsChange={onLabelsChange}
              onRemove={removeCounty}
              stateLabel="Unassigned state"
            />
          </section>
        )}
      </div>
    </div>
  );
}