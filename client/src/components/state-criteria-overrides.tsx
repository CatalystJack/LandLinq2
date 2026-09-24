import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getUsStateLabel, normalizeUsStateCode, US_STATE_OPTIONS } from "@shared/us-states";

export type CriteriaOverrideValue = Record<string, Partial<Record<string, string | number | null>>>;

type Field = {
  key: string;
  label: string;
  suffix?: string;
};

type Props = {
  targetStates: string[];
  value?: CriteriaOverrideValue | null;
  fields: Field[];
  onChange: (value: CriteriaOverrideValue) => void;
};

export default function StateCriteriaOverrides({ targetStates, value, fields, onChange }: Props) {
  const overrides = Object.entries(value || {}).reduce<CriteriaOverrideValue>((result, [rawState, stateOverride]) => {
    const state = normalizeUsStateCode(rawState);
    if (state) result[state] = stateOverride;
    return result;
  }, {});
  const normalizedTargets = Array.from(new Set(targetStates.map(normalizeUsStateCode).filter(Boolean)));
  const availableStates = US_STATE_OPTIONS.filter((state) =>
    normalizedTargets.includes(state.code) && !Object.prototype.hasOwnProperty.call(overrides, state.code),
  );

  const addState = (state: string) => {
    const key = normalizeUsStateCode(state);
    if (!key || overrides[key]) return;
    onChange({ ...overrides, [key]: {} });
  };

  const updateField = (state: string, field: string, nextValue: string) => {
    const current = overrides[state] || {};
    onChange({
      ...overrides,
      [state]: {
        ...current,
        [field]: nextValue === "" ? null : nextValue,
      },
    });
  };

  const removeState = (state: string) => {
    const next = { ...overrides };
    delete next[state];
    onChange(next);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-slate-900">State overrides</h4>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            States listed below use these numbers instead of the Normal criteria above — leave a field blank to keep the Normal value for that state.
          </p>
        </div>
        {availableStates.length > 0 && (
          <label className="flex items-center gap-2">
            <span className="sr-only">Add state override</span>
            <select
              value=""
              onChange={(event) => {
                if (event.target.value) addState(event.target.value);
              }}
              className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
              aria-label="Add state override"
            >
              <option value="">Add state…</option>
              {availableStates.map((state) => <option key={state.code} value={state.code}>{state.name}</option>)}
            </select>
            <Plus className="h-4 w-4 text-slate-400" />
          </label>
        )}
      </div>

      {normalizedTargets.length === 0 && (
        <p className="mt-3 text-sm text-amber-700">Add target states above before creating state overrides.</p>
      )}
      {normalizedTargets.length > 0 && Object.keys(overrides).length === 0 && (
        <p className="mt-3 text-sm text-slate-500">No state-specific overrides yet.</p>
      )}
      {Object.entries(overrides).length > 0 && (
        <div className="mt-4 space-y-3">
          {Object.entries(overrides).map(([state, stateOverride]) => (
            <div key={state} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-800">
                  {getUsStateLabel(state)} ({state})
                </span>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeState(state)} aria-label={`Remove ${getUsStateLabel(state)} override`}>
                  <Trash2 className="h-4 w-4 text-slate-400" />
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {fields.map((field) => (
                  <div key={field.key}>
                    <Label htmlFor={`state-override-${state}-${field.key}`} className="text-xs">{field.label}</Label>
                    <div className="relative mt-1">
                      <Input
                        id={`state-override-${state}-${field.key}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={String(stateOverride?.[field.key] ?? "")}
                        onChange={(event) => updateField(state, field.key, event.target.value)}
                        placeholder="Use default"
                        className={field.suffix ? "bg-white pr-16" : "bg-white"}
                      />
                      {field.suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-400">{field.suffix}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}