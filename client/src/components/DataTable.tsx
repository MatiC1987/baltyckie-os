import { useState, useMemo, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, Download, ChevronLeft, ChevronRight } from "lucide-react";

interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => React.ReactNode;
  className?: string;
  sortable?: boolean;
  sortFn?: (a: T, b: T) => number;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  isLoading?: boolean;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchKeys?: (keyof T)[];
  exportable?: boolean;
  exportFileName?: string;
  pageSize?: number;
  serverPagination?: {
    total: number;
    page: number;
    onPageChange: (page: number) => void;
  };
}

export function DataTable<T>({ 
  data, 
  columns, 
  isLoading, 
  onRowClick,
  emptyMessage = "Brak danych",
  searchable = false,
  searchPlaceholder = "Szukaj...",
  searchKeys,
  exportable = false,
  exportFileName = "export",
  pageSize = 0,
  serverPagination,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);

  const handleSort = useCallback((colIndex: number) => {
    if (sortCol === colIndex) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortCol(colIndex);
      setSortDir("asc");
    }
  }, [sortCol]);

  const filtered = useMemo(() => {
    if (!search || !searchable) return data;
    const q = search.toLowerCase();
    return data.filter(item => {
      const keys = searchKeys || columns.filter(c => c.accessorKey).map(c => c.accessorKey!);
      return keys.some(k => {
        const val = item[k as keyof T];
        return val != null && String(val).toLowerCase().includes(q);
      });
    });
  }, [data, search, searchable, searchKeys, columns]);

  const sorted = useMemo(() => {
    if (sortCol === null) return filtered;
    const col = columns[sortCol];
    if (!col) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      if (col.sortFn) {
        return sortDir === "asc" ? col.sortFn(a, b) : col.sortFn(b, a);
      }
      if (!col.accessorKey) return 0;
      const va = a[col.accessorKey];
      const vb = b[col.accessorKey];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      const sa = String(va);
      const sb = String(vb);
      const na = parseFloat(sa);
      const nb = parseFloat(sb);
      if (!isNaN(na) && !isNaN(nb)) {
        return sortDir === "asc" ? na - nb : nb - na;
      }
      return sortDir === "asc" ? sa.localeCompare(sb, "pl") : sb.localeCompare(sa, "pl");
    });
    return arr;
  }, [filtered, sortCol, sortDir, columns]);

  const paginated = useMemo(() => {
    if (serverPagination || !pageSize || pageSize <= 0) return sorted;
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, currentPage, pageSize, serverPagination]);

  const totalPages = serverPagination
    ? Math.ceil(serverPagination.total / (pageSize || 25))
    : pageSize > 0
      ? Math.ceil(sorted.length / pageSize)
      : 1;

  const activePage = serverPagination?.page ?? currentPage;

  const handleExport = useCallback(async () => {
    const { utils, writeFile } = await import("xlsx");
    const exportData = sorted.map(item => {
      const row: Record<string, any> = {};
      columns.forEach(col => {
        if (col.accessorKey) {
          row[col.header] = item[col.accessorKey];
        }
      });
      return row;
    });
    const ws = utils.json_to_sheet(exportData);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Dane");
    writeFile(wb, `${exportFileName}.xlsx`);
  }, [sorted, columns, exportFileName]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="p-8 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 w-full loading-shimmer rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-fade-in">
      {(searchable || exportable) && (
        <div className="flex items-center gap-2 flex-wrap">
          {searchable && (
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                className="pl-9"
                data-testid="input-table-search"
              />
            </div>
          )}
          {exportable && (
            <Button variant="outline" size="sm" onClick={handleExport} className="btn-press gap-1.5" data-testid="button-export-excel">
              <Download className="h-4 w-4" />
              Excel
            </Button>
          )}
        </div>
      )}

      {data.length === 0 && !isLoading ? (
        <div className="rounded-xl border border-border bg-card shadow-sm p-12 text-center">
          <p className="text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0 z-20">
              <TableRow>
                {columns.map((col, index) => (
                  <TableHead
                    key={index}
                    className={cn(
                      "font-semibold text-sm md:text-base",
                      col.sortable !== false && col.accessorKey && "cursor-pointer select-none hover:bg-muted/80 transition-colors",
                      col.className
                    )}
                    onClick={() => {
                      if (col.sortable !== false && (col.accessorKey || col.sortFn)) {
                        handleSort(index);
                      }
                    }}
                    data-testid={`th-${col.header.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <div className="flex items-center gap-1">
                      {col.header}
                      {col.sortable !== false && (col.accessorKey || col.sortFn) && (
                        sortCol === index ? (
                          sortDir === "asc" ? <ChevronUp className="h-3.5 w-3.5 text-primary" /> : <ChevronDown className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/40" />
                        )
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((item, rowIndex) => (
                <TableRow 
                  key={rowIndex} 
                  className={cn(
                    "transition-colors",
                    onRowClick && "cursor-pointer hover:bg-muted/30"
                  )}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((col, colIndex) => (
                    <TableCell key={colIndex} className={cn("text-sm md:text-base", col.className)}>
                      {col.cell 
                        ? col.cell(item) 
                        : (col.accessorKey ? String(item[col.accessorKey] ?? "") : null)
                      }
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-muted-foreground">
            {serverPagination
              ? `Strona ${activePage} z ${totalPages} (${serverPagination.total} rekordów)`
              : `Strona ${activePage} z ${totalPages} (${sorted.length} rekordów)`
            }
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={activePage <= 1}
              onClick={() => serverPagination ? serverPagination.onPageChange(activePage - 1) : setCurrentPage(p => Math.max(1, p - 1))}
              className="btn-press"
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let page: number;
              if (totalPages <= 5) {
                page = i + 1;
              } else if (activePage <= 3) {
                page = i + 1;
              } else if (activePage >= totalPages - 2) {
                page = totalPages - 4 + i;
              } else {
                page = activePage - 2 + i;
              }
              return (
                <Button
                  key={page}
                  variant={page === activePage ? "default" : "outline"}
                  size="sm"
                  onClick={() => serverPagination ? serverPagination.onPageChange(page) : setCurrentPage(page)}
                  className="btn-press min-w-[36px]"
                  data-testid={`button-page-${page}`}
                >
                  {page}
                </Button>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              disabled={activePage >= totalPages}
              onClick={() => serverPagination ? serverPagination.onPageChange(activePage + 1) : setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="btn-press"
              data-testid="button-next-page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
