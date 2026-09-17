import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyCellProps extends HTMLAttributes<HTMLSpanElement> {
  children?: ReactNode;
}

export function EmptyCell({ children = "Click to add...", className, ...props }: EmptyCellProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-400",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}