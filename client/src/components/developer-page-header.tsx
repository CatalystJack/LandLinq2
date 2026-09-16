import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DeveloperPageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
}

export const developerHeaderButtonClass =
  "h-9 rounded-full border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:border-[#4A90E2] hover:bg-[#eef6ff] hover:text-[#2f73bb]";

export default function DeveloperPageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: DeveloperPageHeaderProps) {
  return (
    <header className={cn("section-gap-md", className)}>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          {eyebrow && (
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#4A90E2]">
              {eyebrow}
            </p>
          )}
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#07172A] md:text-4xl">
            {title}
          </h1>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}