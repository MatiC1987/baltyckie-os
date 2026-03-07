import { TableHead } from "@/components/ui/table";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import type { SortField, SortDir } from "./widget-utils";

export function SortableHeader({ field, label, sortField, sortDir, onSort }: {
  field: SortField;
  label: string;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
}) {
  const isActive = sortField === field;
  return (
    <TableHead>
      <button
        onClick={() => onSort(field)}
        className="flex items-center text-xs font-semibold whitespace-nowrap hover-elevate px-1 py-1 rounded"
        data-testid={`sort-${field}`}
      >
        {label}
        {isActive
          ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />)
          : <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />
        }
      </button>
    </TableHead>
  );
}
