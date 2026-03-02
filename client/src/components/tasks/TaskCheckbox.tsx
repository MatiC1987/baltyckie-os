import { memo, useState, useCallback } from "react";
import { PRIORITY_BORDER_COLORS } from "./taskUtils";

interface TaskCheckboxProps {
  checked: boolean;
  priority?: string;
  onToggle: () => void;
  size?: number;
  className?: string;
  "data-testid"?: string;
}

export const TaskCheckbox = memo(function TaskCheckbox({
  checked,
  priority = "BRAK",
  onToggle,
  size = 20,
  className = "",
  "data-testid": testId,
}: TaskCheckboxProps) {
  const [animating, setAnimating] = useState(false);
  const color = PRIORITY_BORDER_COLORS[priority] || PRIORITY_BORDER_COLORS.BRAK;

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!checked) {
      setAnimating(true);
      setTimeout(() => setAnimating(false), 400);
    }
    onToggle();
  }, [checked, onToggle]);

  return (
    <button
      onClick={handleClick}
      className={`shrink-0 flex items-center justify-center task-checkbox-btn ${className}`}
      style={{ width: size, height: size }}
      data-testid={testId}
      type="button"
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="task-checkbox-svg">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 1.5}
          fill={checked || animating ? color : "transparent"}
          stroke={color}
          strokeWidth={1.5}
          className={`transition-all duration-150 ${!checked && !animating ? "task-checkbox-circle-hover" : ""}`}
          style={{
            opacity: checked || animating ? 1 : 0.6,
          }}
        />
        {(checked || animating) && (
          <path
            d={`M${size * 0.28} ${size * 0.5} L${size * 0.44} ${size * 0.66} L${size * 0.72} ${size * 0.34}`}
            fill="none"
            stroke="white"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="task-checkmark-path"
          />
        )}
      </svg>
    </button>
  );
});
