import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type FilterKey = "sectors" | "counties" | "sourceTags";

type SharedContactAccessEditorProps = {
  sectors: string[];
  counties: string[];
  sourceTags: string[];
  sourceTagOptions: string[];
  onSectorsChange: (values: string[]) => void;
  onCountiesChange: (values: string[]) => void;
  onSourceTagsChange: (values: string[]) => void;
};

const FILTER_LABELS: Record<FilterKey, string> = {
  sectors: "Contact sectors",
  counties: "North Carolina counties",
  sourceTags: "Source tags",
};

const formatTag = (value: string) => value
  .split(/[-_]/g)
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(" ");

export default function SharedContactAccessEditor({
  sectors,
  counties,
  sourceTags,
  sourceTagOptions,
  onSectorsChange,
  onCountiesChange,
  onSourceTagsChange,
}: SharedContactAccessEditorProps) {
  const [openFilters, setOpenFilters] = useState<FilterKey[]>(() => [
    ...(sectors.length ? ["sectors" as FilterKey] : []),
    ...(counties.length ? ["counties" as FilterKey] : []),
    ...(sourceTags.length ? ["sourceTags" as FilterKey] : []),
  ]);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    setOpenFilters((current) => Array.from(new Set([
      ...current,
      ...(sectors.length ? ["sectors" as FilterKey] : []),
      ...(counties.length ? ["counties" as FilterKey] : []),
      ...(sourceTags.length ? ["sourceTags" as FilterKey] : []),
    ])));
  }, [sectors.length, counties.length, sourceTags.length]);

  const availableFilters = useMemo(
    () => (Object.keys(FILTER_LABELS) as FilterKey[]).filter((key) => !openFilters.includes(key)),
    [openFilters],
  );

  const addFilter = (key: FilterKey) => {
    setOpenFilters((current) => current.includes(key) ? current : [...current, key]);
  };

  const removeFilter = (key: FilterKey) => {
    setOpenFilters((current) => current.filter((filter) => filter !== key));
    if (key === "sectors") onSectorsChange([]);
    if (key === "counties") onCountiesChange([]);
    if (key === "sourceTags") onSourceTagsChange([]);
  };

  const summaryFor = (key: FilterKey) => {
    if (key === "sectors") return sectors.length ? sectors.map(formatTag).join(", ") : "No sectors selected";
    if (key === "counties") return counties.length ? counties.map(formatTag).join(", ") : "No counties selected";
    return sourceTags.length ? `${sourceTags.length} selected` : "No source tags selected";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Label>Visibility filters</Label>
          <p className="mt-1 text-xs text-slate-500">
            Add only the criteria this company should use when viewing shared broker contacts.
          </p>
        </div>
        <Select value="" onValueChange={(value) => addFilter(value as FilterKey)} disabled={!availableFilters.length}>
          <SelectTrigger className="w-full sm:w-36">
            <Plus className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Add filter" />
          </SelectTrigger>
          <SelectContent>
            {availableFilters.map((key) => <SelectItem key={key} value={key}>{FILTER_LABELS[key]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {openFilters.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center">
          <p className="text-sm font-medium text-slate-700">All shared contacts are visible</p>
          <p className="mt-1 text-xs text-slate-500">Use Add filter to narrow this company&apos;s shared directory.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {openFilters.map((key) => (
            <div key={key} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{FILTER_LABELS[key]}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{summaryFor(key)}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-slate-400 hover:text-red-600"
                  onClick={() => removeFilter(key)}
                  aria-label={`Remove ${FILTER_LABELS[key]} filter`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {key === "sectors" && (
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                  {["commercial", "residential"].map((sector) => (
                    <label key={sector} className="flex items-center gap-2 text-sm text-slate-700">
                      <Checkbox
                        checked={sectors.includes(sector)}
                        onCheckedChange={(checked) => onSectorsChange(
                          checked
                            ? Array.from(new Set([...sectors, sector]))
                            : sectors.filter((value) => value !== sector),
                        )}
                      />
                      {formatTag(sector)}
                    </label>
                  ))}
                </div>
              )}

              {key === "counties" && (
                <Input
                  className="mt-3"
                  value={counties.join(", ")}
                  onChange={(event) => onCountiesChange(
                    event.target.value.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean),
                  )}
                  placeholder="Mecklenburg, Wake, Buncombe"
                />
              )}

              {key === "sourceTags" && (
                <div className="mt-3 max-h-44 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-3">
                  {sourceTagOptions.length ? (
                    <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                      {sourceTagOptions.map((tag) => {
                        const normalizedTag = tag.toLowerCase();
                        return (
                          <label key={tag} className="flex items-center gap-2 text-sm text-slate-700">
                            <Checkbox
                              checked={sourceTags.includes(normalizedTag)}
                              onCheckedChange={(checked) => onSourceTagsChange(
                                checked
                                  ? Array.from(new Set([...sourceTags, normalizedTag]))
                                  : sourceTags.filter((value) => value !== normalizedTag),
                              )}
                            />
                            {formatTag(tag)}
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No imported source tags are available yet.</p>
                  )}
                </div>
              )}

              <p className="mt-2 text-xs text-slate-500">
                {key === "sectors" && "Leave all sectors unchecked to include every sector."}
                {key === "counties" && "Separate counties with commas. Leave blank to include every county."}
                {key === "sourceTags" && "Select any source tags this company should see. Leave all unchecked to include every source tag."}
              </p>
            </div>
          ))}
        </div>
      )}

      <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
        <CollapsibleTrigger asChild>
          <button type="button" className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
            How visibility filters work
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${detailsOpen ? "rotate-180" : ""}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
          Contacts match any selected value within a filter and must pass every filter group you add. Company-owned contacts always remain visible, and CRM tags, notes, assignments, and outreach history stay private.
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}