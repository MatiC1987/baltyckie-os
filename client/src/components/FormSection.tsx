import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface FormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  first?: boolean;
}

export function FormSection({ title, description, children, className, first = false }: FormSectionProps) {
  return (
    <div className={cn("space-y-3", className)} data-testid={`form-section-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      {!first && (
        <div className="border-t border-border/50 mt-1" />
      )}
      <div className="pt-1">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h4>
        {description && (
          <p className="text-xs text-muted-foreground/70 mt-0.5">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}
