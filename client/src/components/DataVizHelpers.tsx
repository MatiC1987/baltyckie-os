import { useMemo } from "react";

export function getHeatMapBg(value: number, maxValue: number, type: "revenue" | "expense" | "saldo" = "revenue"): string {
  if (value === 0 || maxValue === 0) return "";
  const intensity = Math.min(Math.abs(value) / maxValue, 1);
  const level = Math.round(intensity * 4);
  if (level === 0) return "";

  if (type === "saldo") {
    if (value > 0) {
      const shades = [
        "",
        "bg-emerald-50/40 dark:bg-emerald-950/15",
        "bg-emerald-50/70 dark:bg-emerald-950/25",
        "bg-emerald-100/60 dark:bg-emerald-950/35",
        "bg-emerald-100/80 dark:bg-emerald-900/40",
      ];
      return shades[level];
    } else {
      const shades = [
        "",
        "bg-red-50/40 dark:bg-red-950/15",
        "bg-red-50/70 dark:bg-red-950/25",
        "bg-red-100/60 dark:bg-red-950/35",
        "bg-red-100/80 dark:bg-red-900/40",
      ];
      return shades[level];
    }
  }

  if (type === "revenue") {
    const shades = [
      "",
      "bg-blue-50/40 dark:bg-blue-950/15",
      "bg-blue-50/70 dark:bg-blue-950/25",
      "bg-blue-100/60 dark:bg-blue-950/35",
      "bg-blue-100/80 dark:bg-blue-900/40",
    ];
    return shades[level];
  }

  const shades = [
    "",
    "bg-amber-50/40 dark:bg-amber-950/15",
    "bg-amber-50/70 dark:bg-amber-950/25",
    "bg-amber-100/60 dark:bg-amber-950/35",
    "bg-amber-100/80 dark:bg-amber-900/40",
  ];
  return shades[level];
}

export function useHeatMapMax(values: number[]): number {
  return useMemo(() => {
    if (values.length === 0) return 0;
    return Math.max(...values.map(Math.abs));
  }, [values]);
}

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showDots?: boolean;
  className?: string;
}

export function Sparkline({ data, width = 80, height = 20, color, showDots = false, className = "" }: SparklineProps) {
  if (data.length < 2 || data.every(v => v === 0)) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const padding = 2;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * usableWidth;
    const y = padding + usableHeight - ((v - min) / range) * usableHeight;
    return { x, y };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

  const trend = data[data.length - 1] - data[0];
  const strokeColor = color || (trend >= 0 ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`inline-block ${className}`}
      data-testid="sparkline"
    >
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDots && points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="1.5"
          fill={strokeColor}
          opacity={i === data.length - 1 ? 1 : 0.4}
        />
      ))}
    </svg>
  );
}

export function SparklineWithLabel({ data, label, width = 80, height = 20 }: { data: number[]; label?: string; width?: number; height?: number }) {
  return (
    <div className="flex items-center gap-1">
      <Sparkline data={data} width={width} height={height} showDots />
      {label && <span className="text-[9px] text-muted-foreground whitespace-nowrap">{label}</span>}
    </div>
  );
}
