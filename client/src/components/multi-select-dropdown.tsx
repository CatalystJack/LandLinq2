import React, { useState, useRef, useEffect } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MultiSelectDropdownProps {
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelectDropdown({
  options,
  selectedValues,
  onChange,
  placeholder = "Select options...",
  className
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOptionClick = (option: string) => {
    const isSelected = selectedValues.includes(option);
    
    if (isSelected) {
      // If already selected, close the dropdown (save the current selection)
      setIsOpen(false);
    } else {
      // If not selected, add it (keep dropdown open for multiple selections)
      onChange([...selectedValues, option]);
    }
  };

  const displayText = selectedValues.length > 0 
    ? selectedValues.length === 1 
      ? selectedValues[0] 
      : `${selectedValues.length} selected`
    : placeholder;

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        data-testid="multi-select-trigger"
      >
        <span className="truncate">{displayText}</span>
        <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute top-full z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {options.map((option) => {
            const isSelected = selectedValues.includes(option);
            return (
              <div
                key={option}
                onClick={() => handleOptionClick(option)}
                className={cn(
                  "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                  isSelected && "bg-accent"
                )}
                data-testid={`option-${option}`}
              >
                <div className="flex items-center space-x-2 w-full">
                  <div className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                    isSelected ? "bg-primary text-primary-foreground" : "bg-transparent"
                  )}>
                    {isSelected && <Check className="h-3 w-3" />}
                  </div>
                  <span className="flex-1">{option}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}