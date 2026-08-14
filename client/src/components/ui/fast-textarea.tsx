import { useRef, useState, useEffect, useCallback, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface FastTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> {
  value?: string;
  onChange?: (value: string) => void;
  onBlurSave?: (value: string) => void;
}

/**
 * A textarea that keeps its own local state while the user types,
 * so the parent component never re-renders on every keystroke.
 * The parent only hears about changes on blur (via onBlurSave)
 * or when explicitly needed (via onChange which is called on blur too).
 */
export function FastTextarea({
  value = "",
  onChange,
  onBlurSave,
  className,
  onBlur,
  ...props
}: FastTextareaProps) {
  const [localValue, setLocalValue] = useState(value);
  const lastSyncedValue = useRef(value);

  // Sync from parent only when the external value actually changes
  // (e.g. dialog opens with new content) — not on every parent re-render
  useEffect(() => {
    if (value !== lastSyncedValue.current) {
      setLocalValue(value);
      lastSyncedValue.current = value;
    }
  }, [value]);

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLTextAreaElement>) => {
      if (localValue !== lastSyncedValue.current) {
        lastSyncedValue.current = localValue;
        onChange?.(localValue);
        onBlurSave?.(localValue);
      }
      onBlur?.(e);
    },
    [localValue, onChange, onBlurSave, onBlur]
  );

  return (
    <textarea
      {...props}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    />
  );
}
