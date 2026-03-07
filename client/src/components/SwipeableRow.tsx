import { useSwipeAction } from "@/hooks/use-swipe-action";
import { useIsMobile } from "@/hooks/use-mobile";
import { Trash2, Check, Archive } from "lucide-react";

interface SwipeableRowProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftLabel?: string;
  rightLabel?: string;
  leftIcon?: "delete" | "archive";
  rightIcon?: "done" | "archive";
  className?: string;
  disabled?: boolean;
}

const ICONS = {
  delete: Trash2,
  archive: Archive,
  done: Check,
};

export function SwipeableRow({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftLabel = "Usuń",
  rightLabel = "Wykonane",
  leftIcon = "delete",
  rightIcon = "done",
  className = "",
  disabled = false,
}: SwipeableRowProps) {
  const isMobile = useIsMobile();
  const { offsetX, isSettling, handlers } = useSwipeAction({
    onSwipeLeft: disabled ? undefined : onSwipeLeft,
    onSwipeRight: disabled ? undefined : onSwipeRight,
    threshold: 80,
    maxSwipe: 120,
  });

  if (!isMobile || (!onSwipeLeft && !onSwipeRight)) {
    return <div className={className}>{children}</div>;
  }

  const LeftIcon = ICONS[leftIcon];
  const RightIcon = ICONS[rightIcon];
  const leftProgress = Math.min(1, Math.abs(Math.min(offsetX, 0)) / 80);
  const rightProgress = Math.min(1, Math.max(offsetX, 0) / 80);

  return (
    <div
      className={`relative overflow-hidden rounded-md ${className}`}
      data-testid="swipeable-row"
    >
      {onSwipeLeft && (
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-end pr-4 gap-2"
          style={{
            width: Math.abs(Math.min(offsetX, 0)),
            backgroundColor: leftProgress >= 1
              ? "hsl(var(--destructive))"
              : "hsl(var(--destructive) / 0.6)",
            transition: isSettling ? "all 300ms ease" : "none",
          }}
          data-testid="swipe-action-left"
        >
          <LeftIcon
            className="h-4 w-4 text-white"
            style={{
              opacity: leftProgress,
              transform: `scale(${0.6 + leftProgress * 0.4})`,
            }}
          />
          {leftProgress >= 0.8 && (
            <span className="text-xs text-white font-medium whitespace-nowrap">
              {leftLabel}
            </span>
          )}
        </div>
      )}

      {onSwipeRight && (
        <div
          className="absolute inset-y-0 left-0 flex items-center justify-start pl-4 gap-2"
          style={{
            width: Math.max(offsetX, 0),
            backgroundColor: rightProgress >= 1
              ? "hsl(142 71% 45%)"
              : "hsl(142 71% 45% / 0.6)",
            transition: isSettling ? "all 300ms ease" : "none",
          }}
          data-testid="swipe-action-right"
        >
          {rightProgress >= 0.8 && (
            <span className="text-xs text-white font-medium whitespace-nowrap">
              {rightLabel}
            </span>
          )}
          <RightIcon
            className="h-4 w-4 text-white"
            style={{
              opacity: rightProgress,
              transform: `scale(${0.6 + rightProgress * 0.4})`,
            }}
          />
        </div>
      )}

      <div
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isSettling ? "transform 300ms ease" : "none",
        }}
        onTouchStart={handlers.onTouchStart}
        onTouchMove={handlers.onTouchMove}
        onTouchEnd={handlers.onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
