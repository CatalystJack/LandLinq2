import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4 border-b border-catalyst-gray-200 pb-6">
      <div>
        {eyebrow && (
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-catalyst-blue">
            {eyebrow}
          </div>
        )}
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-catalyst-navy">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-catalyst-gray-500">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}