import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const STANDARD_MULTIFAMILY_PRODUCT_TYPES = [
  "3-Story Garden",
  "4-Story Garden",
  "Podium/Wrap",
  "Active Adult",
  "BTR",
  "SFD",
] as const;

const CUSTOM_PRODUCT_TYPE = "__custom__";

type Props = {
  value: string;
  onChange: (value: string) => void;
  id: string;
  className?: string;
};

function isStandardProductType(value: string) {
  return STANDARD_MULTIFAMILY_PRODUCT_TYPES.includes(value as (typeof STANDARD_MULTIFAMILY_PRODUCT_TYPES)[number]);
}

export default function ProductTypeNameField({ value, onChange, id, className }: Props) {
  const [customMode, setCustomMode] = useState(() => Boolean(value) && !isStandardProductType(value));
  const [customDraft, setCustomDraft] = useState(() => (value && !isStandardProductType(value) ? value : ""));

  useEffect(() => {
    if (isStandardProductType(value)) {
      setCustomMode(false);
    } else if (value) {
      setCustomMode(true);
      setCustomDraft(value);
    }
  }, [value]);

  const selectedValue = customMode
    ? CUSTOM_PRODUCT_TYPE
    : isStandardProductType(value)
      ? value
      : "";
  const customValue = isStandardProductType(value) ? customDraft : value || customDraft;

  return (
    <div className="space-y-2">
      <Select
        value={selectedValue}
        onValueChange={(nextValue) => {
          if (nextValue === CUSTOM_PRODUCT_TYPE) {
            setCustomMode(true);
            const nextCustomValue = isStandardProductType(value) ? customDraft : value || customDraft;
            setCustomDraft(nextCustomValue);
            onChange(nextCustomValue);
            return;
          }
          setCustomMode(false);
          onChange(nextValue);
        }}
      >
        <SelectTrigger id={id} className={className}>
          <SelectValue placeholder="Choose product type" />
        </SelectTrigger>
        <SelectContent>
          {STANDARD_MULTIFAMILY_PRODUCT_TYPES.map((productType) => (
            <SelectItem key={productType} value={productType}>{productType}</SelectItem>
          ))}
          <SelectItem value={CUSTOM_PRODUCT_TYPE}>Other (custom)</SelectItem>
        </SelectContent>
      </Select>
      {customMode && (
        <Input
          id={`${id}-custom`}
          value={customValue}
          onChange={(event) => {
            const nextValue = event.target.value;
            setCustomDraft(nextValue);
            onChange(nextValue);
          }}
          placeholder="Enter custom product type"
          className="bg-white"
        />
      )}
    </div>
  );
}