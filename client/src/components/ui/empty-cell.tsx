import type { HTMLAttributes, ReactNode } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyCellProps extends HTMLAttributes<HTMLSpanElement> {
  children?: ReactNode;
}

export function EmptyCell({ children, className, ...props }: EmptyCellProps) {
  const isDefault = children === undefined;

  return (
    <span
      className={cn(
        "inline-flex items-center text-gray-300",
        className,
      )}
      {...props}
    >
      {isDefault ? (
        <>
          <span>–</span>
          <Plus className="ml-0.5 h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
        </>
      ) : children}
    </span>
  );
}