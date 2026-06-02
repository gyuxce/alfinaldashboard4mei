import React from "react";
import { CircleAlert, Search } from "lucide-react";

type EmptyStateVariant = "data" | "filter";

interface EmptyStateProps {
  title: string;
  description?: string;
  variant?: EmptyStateVariant;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  variant = "data",
  className = "",
}) => {
  const Icon = variant === "filter" ? Search : CircleAlert;

  return (
    <div className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/40 px-6 py-8 text-center ${className}`}>
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-card text-text-muted border border-border">
        <Icon size={18} />
      </div>
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      {description && (
        <p className="mt-1 max-w-md text-xs leading-relaxed text-text-muted">
          {description}
        </p>
      )}
    </div>
  );
};
