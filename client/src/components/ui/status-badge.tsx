import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatusBadgeStatus = "yes" | "no" | "na" | "flag";

interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status: StatusBadgeStatus;
  children?: ReactNode;
}

const statusStyles: Record<StatusBadgeStatus, string> = {
  yes: "bg-green-50 text-green-700 border-green-200",
  no: "bg-gray-50 text-gray-500 border-gray-200",
  na: "bg-gray-50 text-gray-400 border-gray-200",
  flag: "bg-amber-50 text-amber-700 border-amber-300",
};

const statusLabels: Record<StatusBadgeStatus, string> = {
  yes: "Yes",
  no: "No",
  na: "N/A",
  flag: "Flag",
};

export function StatusBadge({ status, children, className, ...props }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full border px-2 text-xs font-medium",
        statusStyles[status],
        className,
      )}
      {...props}
    >
      {children ?? statusLabels[status]}
    </span>
  );
}