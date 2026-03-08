import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyStateVariant = "page" | "inline" | "card";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: EmptyStateVariant;
  className?: string;
  colSpan?: number;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  variant = "page",
  className,
  colSpan,
}: EmptyStateProps) {
  const content = (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        variant === "page" && "py-16 px-4",
        variant === "card" && "py-12 px-4",
        variant === "inline" && "py-8 px-4",
        className
      )}
      data-testid="empty-state"
    >
      <div
        className={cn(
          "rounded-full bg-muted flex items-center justify-center mb-4",
          variant === "page" && "h-16 w-16",
          variant === "card" && "h-14 w-14",
          variant === "inline" && "h-10 w-10"
        )}
      >
        <Icon
          className={cn(
            "text-muted-foreground",
            variant === "page" && "h-8 w-8",
            variant === "card" && "h-7 w-7",
            variant === "inline" && "h-5 w-5"
          )}
        />
      </div>
      <h3
        className={cn(
          "font-semibold mb-1",
          variant === "page" && "text-lg",
          variant === "card" && "text-base",
          variant === "inline" && "text-sm"
        )}
        data-testid="text-empty-title"
      >
        {title}
      </h3>
      {description && (
        <p
          className={cn(
            "text-muted-foreground max-w-sm",
            variant === "page" && "text-sm mb-4",
            variant === "card" && "text-sm mb-4",
            variant === "inline" && "text-xs mb-3"
          )}
          data-testid="text-empty-description"
        >
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          size={variant === "inline" ? "sm" : "default"}
          data-testid="button-empty-action"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );

  if (variant === "card") {
    return (
      <Card className={className}>
        <CardContent className="p-0">{content}</CardContent>
      </Card>
    );
  }

  if (variant === "inline" && colSpan) {
    return (
      <tr>
        <td colSpan={colSpan}>
          {content}
        </td>
      </tr>
    );
  }

  return content;
}
