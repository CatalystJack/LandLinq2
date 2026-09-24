import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DealEntryOptions = {
  profile: { profileType: string; assetClass: string; rentMetric: "psf" | "per_unit" };
  productTypes: { id: string; name: string; isActive: boolean }[];
};

type ManualDealDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

const initialForm = {
  address: "", city: "", state: "", county: "", acreage: "", productTypeId: "",
  rent: "", askingPrice: "", qct: false, dda: false, oz: false,
};

async function jsonRequest(url: string, options?: RequestInit) {
  const response = await fetch(url, { credentials: "include", ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.message || "Request failed");
  return data;
}

export default function DeveloperManualDealDialog({ open, onOpenChange, onSuccess }: ManualDealDialogProps) {
  const [form, setForm] = useState(initialForm);
  const [result, setResult] = useState<any>(null);
  const optionsQuery = useQuery<DealEntryOptions>({
    queryKey: ["/api/developer-profile/me/deal-entry-options"],
    queryFn: () => jsonRequest("/api/developer-profile/me/deal-entry-options"),
    enabled: open,
  });
  const options = optionsQuery.data;
  const industrial = options?.profile.assetClass === "industrial";
  const activeProductTypes = (options?.productTypes || []).filter((productType) => productType.isActive);

  useEffect(() => {
    if (open) {
      setForm(initialForm);
      setResult(null);
    }
  }, [open]);

  useEffect(() => {
    if (activeProductTypes.length && !activeProductTypes.some((productType) => productType.id === form.productTypeId)) {
      setForm((current) => ({ ...current, productTypeId: activeProductTypes[0].id }));
    }
  }, [activeProductTypes, form.productTypeId]);

  const createMutation = useMutation({
    mutationFn: () => jsonRequest("/api/developer-profile/me/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        county: form.county.trim(),
        acreage: Number(form.acreage),
        ...(industrial ? {} : {
          productTypeId: form.productTypeId,
          rent: Number(form.rent),
        }),
        askingPrice: form.askingPrice === "" ? undefined : Number(form.askingPrice),
        qct: form.qct,
        dda: form.dda,
        oz: form.oz,
      }),
    }),
    onSuccess: (data) => {
      setResult(data);
      onSuccess();
    },
  });

  const update = (key: keyof typeof initialForm, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));
  const canSubmit = Boolean(
    form.address.trim() && form.city.trim() && form.state.trim() && form.county.trim() &&
    form.acreage && Number(form.acreage) >= 0 &&
    (industrial || (form.productTypeId && form.rent && Number(form.rent) >= 0)),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Deal</DialogTitle>
          <DialogDescription>Enter a deal for your company’s acquisition criteria.</DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 text-lg font-semibold text-emerald-700">
              <CheckCircle2 className="h-5 w-5" /> Deal submitted
            </div>
            <p className="text-sm text-slate-600">
              Classification: <span className="font-semibold capitalize">{result.classification || "Pending"}</span>
            </p>
            {!!result.matchedProductTypes?.length && (
              <p className="text-sm text-slate-600">
                Matched product types: <span className="font-semibold">{result.matchedProductTypes.join(", ")}</span>
              </p>
            )}
            {result.canonicalDealUpdated === false && (
              <p className="text-sm text-amber-800">
                An existing shared deal was linked to your company. Its shared details were left unchanged.
              </p>
            )}
            <DialogFooter><Button onClick={() => onOpenChange(false)}>Done</Button></DialogFooter>
          </div>
        ) : optionsQuery.isLoading ? (
          <div className="flex items-center justify-center py-12 text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading entry options…</div>
        ) : optionsQuery.isError ? (
          <p className="py-6 text-sm text-red-600">{(optionsQuery.error as Error).message}</p>
        ) : (
          <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); if (canSubmit) createMutation.mutate(); }}>
            <div className="grid gap-4 sm:grid-cols-2">
              {(["address", "city", "state", "county"] as const).map((field) => (
                <div key={field} className={field === "address" ? "sm:col-span-2" : ""}>
                  <Label htmlFor={`manual-deal-${field}`}>{field[0].toUpperCase() + field.slice(1)} <span className="text-red-500">*</span></Label>
                  <Input id={`manual-deal-${field}`} required value={form[field]} onChange={(event) => update(field, event.target.value)} className="mt-1 bg-white" />
                </div>
              ))}
              <div>
                <Label htmlFor="manual-deal-acreage">Acreage <span className="text-red-500">*</span></Label>
                <Input id="manual-deal-acreage" required type="number" min="0" step="0.01" value={form.acreage} onChange={(event) => update("acreage", event.target.value)} className="mt-1 bg-white" />
              </div>
              {!industrial && (
                <>
                  <div>
                    <Label htmlFor="manual-deal-product">Product type <span className="text-red-500">*</span></Label>
                    <select id="manual-deal-product" required value={form.productTypeId} onChange={(event) => update("productTypeId", event.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                      <option value="">Select product type</option>
                      {activeProductTypes.map((productType) => <option key={productType.id} value={productType.id}>{productType.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="manual-deal-rent">Rent / {options?.profile.rentMetric === "per_unit" ? "Unit" : "SF"} <span className="text-red-500">*</span></Label>
                    <Input id="manual-deal-rent" required type="number" min="0" step="0.01" value={form.rent} onChange={(event) => update("rent", event.target.value)} className="mt-1 bg-white" />
                  </div>
                </>
              )}
              <div>
                <Label htmlFor="manual-deal-asking-price">Asking price</Label>
                <Input id="manual-deal-asking-price" type="number" min="0" step="1" value={form.askingPrice} onChange={(event) => update("askingPrice", event.target.value)} className="mt-1 bg-white" />
              </div>
            </div>
            <div className="flex flex-wrap gap-5">
              {(["qct", "dda", "oz"] as const).map((flag) => (
                <label key={flag} className="flex items-center gap-2 text-sm capitalize">
                  <Checkbox checked={form[flag]} onCheckedChange={(checked) => update(flag, checked === true)} />{flag}
                </label>
              ))}
            </div>
            {createMutation.isError && <p className="text-sm text-red-600">{(createMutation.error as Error).message}</p>}
            <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={!canSubmit || createMutation.isPending} className="border border-catalyst-blue bg-catalyst-navy text-white transition-colors hover:bg-white hover:text-catalyst-blue">{createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add Deal</Button></DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}