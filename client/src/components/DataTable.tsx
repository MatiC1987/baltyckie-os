import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  isLoading?: boolean;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
}

export function DataTable<T>({ 
  data, 
  columns, 
  isLoading, 
  onRowClick,
  emptyMessage = "Brak danych"
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="p-8 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 w-full bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-sm p-12 text-center">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
      <Table>
        <TableHeader className="bg-muted/50 sticky top-0 z-20">
          <TableRow>
            {columns.map((col, index) => (
              <TableHead key={index} className={cn("font-semibold text-sm md:text-base", col.className)}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item, rowIndex) => (
            <TableRow 
              key={rowIndex} 
              className={cn(onRowClick && "cursor-pointer hover:bg-muted/30 transition-colors")}
              onClick={() => onRowClick?.(item)}
            >
              {columns.map((col, colIndex) => (
                <TableCell key={colIndex} className={cn("text-sm md:text-base", col.className)}>
                  {col.cell 
                    ? col.cell(item) 
                    : (col.accessorKey ? String(item[col.accessorKey]) : null)
                  }
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
