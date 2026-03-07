import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

export interface ResponsiveColumn<T> {
  header: string;
  render: (item: T) => React.ReactNode;
  className?: string;
  primary?: boolean;
  mobileLabel?: string;
  hideOnMobile?: boolean;
  headerRender?: () => React.ReactNode;
}

interface ResponsiveTableProps<T> {
  data: T[];
  columns: ResponsiveColumn<T>[];
  keyExtractor: (item: T) => string | number;
  onRowClick?: (item: T) => void;
  rowClassName?: (item: T) => string;
  emptyMessage?: string;
  isLoading?: boolean;
  mobileTitle?: (item: T) => React.ReactNode;
  mobileSubtitle?: (item: T) => React.ReactNode;
  mobileBadge?: (item: T) => React.ReactNode;
  mobileActions?: (item: T) => React.ReactNode;
}

function MobileCard<T>({
  item,
  columns,
  onRowClick,
  rowClassName,
  mobileTitle,
  mobileSubtitle,
  mobileBadge,
  mobileActions,
}: {
  item: T;
  columns: ResponsiveColumn<T>[];
  onRowClick?: (item: T) => void;
  rowClassName?: (item: T) => string;
  mobileTitle?: (item: T) => React.ReactNode;
  mobileSubtitle?: (item: T) => React.ReactNode;
  mobileBadge?: (item: T) => React.ReactNode;
  mobileActions?: (item: T) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  const primaryCols = columns.filter(c => c.primary && !c.hideOnMobile);
  const secondaryCols = columns.filter(c => !c.primary && !c.hideOnMobile);

  const handleClick = () => {
    if (onRowClick) {
      onRowClick(item);
    } else {
      setExpanded(prev => !prev);
    }
  };

  const handleExpandToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(prev => !prev);
  };

  return (
    <Card
      className={cn(
        "transition-colors",
        onRowClick && "cursor-pointer",
        rowClassName?.(item)
      )}
      onClick={handleClick}
      data-testid="responsive-card"
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {mobileTitle && (
              <div className="font-medium text-sm truncate" data-testid="card-title">
                {mobileTitle(item)}
              </div>
            )}
            {mobileSubtitle && (
              <div className="text-xs text-muted-foreground mt-0.5" data-testid="card-subtitle">
                {mobileSubtitle(item)}
              </div>
            )}
            {!mobileTitle && primaryCols.length > 0 && (
              <div className="space-y-1">
                {primaryCols.map((col, i) => (
                  <div key={i} className="text-sm">
                    {col.render(item)}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {mobileBadge && (
              <div data-testid="card-badge">{mobileBadge(item)}</div>
            )}
            {secondaryCols.length > 0 && (
              <button
                type="button"
                onClick={handleExpandToggle}
                className="p-1 rounded-md text-muted-foreground"
                data-testid="button-expand-card"
              >
                <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
              </button>
            )}
          </div>
        </div>

        {mobileTitle && primaryCols.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
            {primaryCols.map((col, i) => (
              <div key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                {col.mobileLabel && <span className="font-medium">{col.mobileLabel}:</span>}
                {col.render(item)}
              </div>
            ))}
          </div>
        )}

        {expanded && secondaryCols.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border space-y-2" data-testid="card-details">
            {secondaryCols.map((col, i) => (
              <div key={i} className="flex items-start justify-between gap-2 text-sm">
                <span className="text-xs text-muted-foreground shrink-0">{col.mobileLabel || col.header}</span>
                <div className="text-right">{col.render(item)}</div>
              </div>
            ))}
          </div>
        )}

        {mobileActions && (
          <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t border-border" onClick={e => e.stopPropagation()} data-testid="card-actions">
            {mobileActions(item)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ResponsiveTable<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  rowClassName,
  emptyMessage = "Brak danych",
  isLoading,
  mobileTitle,
  mobileSubtitle,
  mobileBadge,
  mobileActions,
}: ResponsiveTableProps<T>) {
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 w-full rounded-lg loading-shimmer" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-sm p-12 text-center">
        <p className="text-muted-foreground" data-testid="text-empty">{emptyMessage}</p>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="space-y-2" data-testid="responsive-table-mobile">
        {data.map(item => (
          <MobileCard
            key={keyExtractor(item)}
            item={item}
            columns={columns}
            onRowClick={onRowClick}
            rowClassName={rowClassName}
            mobileTitle={mobileTitle}
            mobileSubtitle={mobileSubtitle}
            mobileBadge={mobileBadge}
            mobileActions={mobileActions}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-auto" data-testid="responsive-table-desktop">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            {columns.map((col, i) => (
              <TableHead key={i} className={cn("text-xs font-semibold", col.className)}>
                {col.headerRender ? col.headerRender() : col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map(item => (
            <TableRow
              key={keyExtractor(item)}
              className={cn(
                "transition-colors",
                onRowClick && "cursor-pointer hover:bg-muted/30",
                rowClassName?.(item)
              )}
              onClick={() => onRowClick?.(item)}
              data-testid={`row-${keyExtractor(item)}`}
            >
              {columns.map((col, i) => (
                <TableCell key={i} className={col.className}>
                  {col.render(item)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
