import { Badge } from "@/components/ui/badge";
import { getStatusConfig, getStatusStyle } from "@/lib/status-colors";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
  showIcon?: boolean;
  "data-testid"?: string;
}

export function StatusBadge({ status, className, showIcon = true, "data-testid": testId }: StatusBadgeProps) {
  const config = getStatusConfig(status);
  const style = getStatusStyle(status);
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] whitespace-nowrap font-semibold gap-1 no-default-hover-elevate",
        style,
        className,
      )}
      data-testid={testId || `badge-status-${status}`}
    >
      {showIcon && <Icon className="h-3 w-3 shrink-0" />}
      {config.label}
    </Badge>
  );
}
