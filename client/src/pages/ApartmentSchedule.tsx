import { useState, useMemo, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CostSchedule, CostSchedulePayment } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, ArrowUpDown, Home, Building2, ChevronDown, ChevronRight, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type CostScheduleWithPayments = CostSchedule & { payments: CostSchedulePayment[] };

type SortField = "apartment" | "category" | "amount" | "paid" | "unpaid" | "start" | "status";
type SortDir = "asc" | "desc";

interface AptGroup {
  aptName: string;
  schedules: CostScheduleWithPayments[];
  totalPaid: number;
  totalUnpaid: number;
  totalAll: number;
  categoryCount: number;
}

function formatNum(v: number | string | null | undefined): string {
  const n = typeof v === "string" ? parseFloat(v) : (v ?? 0);
  if (isNaN(n) || n === 0) return "0,00";
  return n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function extractAptName(scheduleName: string): string {
  const idx = scheduleName.indexOf(" - ");
  if (idx > 0) return scheduleName.substring(0, idx);
  return scheduleName;
}

function extractCostCategory(scheduleName: string): string {
  const idx = scheduleName.indexOf(" - ");
  if (idx > 0) return scheduleName.substring(idx + 3);
  return scheduleName;
}

export default function ApartmentSchedule() {
  const { data: schedules = [], isLoading } = useQuery<CostScheduleWithPayments[]>({
    queryKey: ["/api/cost-schedules"],
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [yearFilter, setYearFilter] = useState("ALL");
  const [sortField, setSortField] = useState<SortField>("apartment");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expandedApts, setExpandedApts] = useState<Set<string>>(new Set());

  const aptSchedules = useMemo(() => {
    return schedules.filter(s => s.category === "APARTAMENTY");
  }, [schedules]);

  const years = useMemo(() => {
    const yrs = new Set<string>();
    for (const s of aptSchedules) {
      for (const p of s.payments || []) {
        if (p.dueDate) yrs.add(p.dueDate.substring(0, 4));
      }
    }
    return Array.from(yrs).sort();
  }, [aptSchedules]);

  const groups: AptGroup[] = useMemo(() => {
    const map = new Map<string, CostScheduleWithPayments[]>();
    for (const s of aptSchedules) {
      const aptName = extractAptName(s.name);
      if (!map.has(aptName)) map.set(aptName, []);
      map.get(aptName)!.push(s);
    }

    return Array.from(map.entries()).map(([aptName, scheds]) => {
      let totalPaid = 0;
      let totalUnpaid = 0;
      for (const s of scheds) {
        for (const p of s.payments || []) {
          if (yearFilter !== "ALL" && !p.dueDate.startsWith(yearFilter)) continue;
          const amt = parseFloat(p.amount || "0");
          if (p.status === "OPLACONE") totalPaid += amt;
          else totalUnpaid += amt;
        }
      }
      return {
        aptName,
        schedules: scheds,
        totalPaid,
        totalUnpaid,
        totalAll: totalPaid + totalUnpaid,
        categoryCount: scheds.length,
      };
    });
  }, [aptSchedules, yearFilter]);

  const filteredGroups = useMemo(() => {
    let result = groups;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(g =>
        g.aptName.toLowerCase().includes(q) ||
        g.schedules.some(s => s.name.toLowerCase().includes(q) || (s.notes || "").toLowerCase().includes(q))
      );
    }
    return result;
  }, [groups, searchQuery]);

  const sortedGroups = useMemo(() => {
    const copy = [...filteredGroups];
    const dir = sortDir === "asc" ? 1 : -1;
    copy.sort((a, b) => {
      switch (sortField) {
        case "apartment": return dir * a.aptName.localeCompare(b.aptName, "pl");
        case "amount": return dir * (a.totalAll - b.totalAll);
        case "paid": return dir * (a.totalPaid - b.totalPaid);
        case "unpaid": return dir * (a.totalUnpaid - b.totalUnpaid);
        case "category": return dir * (a.categoryCount - b.categoryCount);
        default: return 0;
      }
    });
    return copy;
  }, [filteredGroups, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const toggleExpand = (aptName: string) => {
    setExpandedApts(prev => {
      const next = new Set(prev);
      if (next.has(aptName)) next.delete(aptName);
      else next.add(aptName);
      return next;
    });
  };

  const totals = useMemo(() => {
    return {
      count: filteredGroups.length,
      schedCount: filteredGroups.reduce((s, g) => s + g.categoryCount, 0),
      totalPaid: filteredGroups.reduce((s, g) => s + g.totalPaid, 0),
      totalUnpaid: filteredGroups.reduce((s, g) => s + g.totalUnpaid, 0),
      totalAll: filteredGroups.reduce((s, g) => s + g.totalAll, 0),
    };
  }, [filteredGroups]);

  const SortableHead = ({ field, children, className }: { field: SortField; children: string; className?: string }) => (
    <TableHead
      className={`text-xs font-semibold cursor-pointer select-none hover:bg-muted/80 transition-colors whitespace-nowrap ${className || ""}`}
      onClick={() => handleSort(field)}
      data-testid={`sort-${field}`}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <ArrowUpDown className={`h-3 w-3 ${sortField === field ? "text-[#5ADBFA]" : "text-muted-foreground/50"}`} />
      </span>
    </TableHead>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold tracking-tight">Apartamenty - Harmonogram</h2>
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 w-full bg-muted animate-pulse rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight" data-testid="text-apartment-schedule-title">Apartamenty - Harmonogram</h2>
        <p className="text-muted-foreground">Zestawienie opłat eksploatacyjnych apartamentów (RATA, GAZ, ENERGIA, WODOCIĄGI itp.)</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold" data-testid="text-stat-total">{totals.count}</div>
            <div className="text-xs text-muted-foreground">Apartamentów</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold" data-testid="text-stat-schedules">{totals.schedCount}</div>
            <div className="text-xs text-muted-foreground">Harmonogramów</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-stat-paid">{formatNum(totals.totalPaid)}</div>
            <div className="text-xs text-muted-foreground">Opłacone (PLN)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-stat-unpaid">{formatNum(totals.totalUnpaid)}</div>
            <div className="text-xs text-muted-foreground">Nieopłacone (PLN)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold text-[#5ADBFA]" data-testid="text-stat-all">{formatNum(totals.totalAll)}</div>
            <div className="text-xs text-muted-foreground">Razem (PLN)</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Szukaj po nazwie apartamentu lub kategorii kosztu..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            data-testid="input-search-schedule"
          />
        </div>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-[140px]" data-testid="select-filter-year">
            <SelectValue placeholder="Rok" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Wszystkie lata</SelectItem>
            {years.map(yr => (
              <SelectItem key={yr} value={yr}>{yr}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {sortedGroups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <Building2 className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">Brak harmonogramów apartamentów.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-8"></TableHead>
                <SortableHead field="apartment">Apartament</SortableHead>
                <SortableHead field="category">Kategorie kosztów</SortableHead>
                <SortableHead field="paid" className="text-right">Opłacone (PLN)</SortableHead>
                <SortableHead field="unpaid" className="text-right">Nieopłacone (PLN)</SortableHead>
                <SortableHead field="amount" className="text-right">Razem (PLN)</SortableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedGroups.map(group => {
                const isExpanded = expandedApts.has(group.aptName);
                return (
                  <Fragment key={group.aptName}>
                    <TableRow
                      className="cursor-pointer hover-elevate"
                      onClick={() => toggleExpand(group.aptName)}
                      data-testid={`row-apt-${group.aptName.replace(/\s+/g, '-')}`}
                    >
                      <TableCell className="w-8 px-2">
                        <Button size="icon" variant="ghost" className="h-6 w-6" tabIndex={-1}>
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
                            <Home className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-medium text-sm">{group.aptName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{group.categoryCount} kategorii</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-right tabular-nums whitespace-nowrap font-medium text-green-600 dark:text-green-400">
                        {formatNum(group.totalPaid)}
                      </TableCell>
                      <TableCell className="text-sm text-right tabular-nums whitespace-nowrap font-medium text-red-600 dark:text-red-400">
                        {group.totalUnpaid > 0 ? formatNum(group.totalUnpaid) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-sm text-right tabular-nums whitespace-nowrap font-semibold">
                        {formatNum(group.totalAll)}
                      </TableCell>
                    </TableRow>
                    {isExpanded && group.schedules.map(sched => {
                      const catName = extractCostCategory(sched.name);
                      const payments = (sched.payments || []).filter(p =>
                        yearFilter === "ALL" || p.dueDate.startsWith(yearFilter)
                      );
                      const paid = payments.filter(p => p.status === "OPLACONE").reduce((s, p) => s + parseFloat(p.amount || "0"), 0);
                      const unpaid = payments.filter(p => p.status !== "OPLACONE").reduce((s, p) => s + parseFloat(p.amount || "0"), 0);
                      return (
                        <TableRow key={sched.id} className="bg-muted/20">
                          <TableCell></TableCell>
                          <TableCell className="pl-14">
                            <span className="text-sm text-muted-foreground">{catName}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 flex-wrap">
                              {payments.filter(p => p.status === "OPLACONE").length > 0 && (
                                <Badge variant="outline" className="text-xs gap-1">
                                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                                  {payments.filter(p => p.status === "OPLACONE").length}
                                </Badge>
                              )}
                              {payments.filter(p => p.status !== "OPLACONE").length > 0 && (
                                <Badge variant="outline" className="text-xs gap-1">
                                  <XCircle className="h-3 w-3 text-red-500" />
                                  {payments.filter(p => p.status !== "OPLACONE").length}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-right tabular-nums whitespace-nowrap text-green-600 dark:text-green-400">
                            {paid > 0 ? formatNum(paid) : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-right tabular-nums whitespace-nowrap text-red-600 dark:text-red-400">
                            {unpaid > 0 ? formatNum(unpaid) : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-right tabular-nums whitespace-nowrap">
                            {formatNum(paid + unpaid)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="text-sm text-muted-foreground" data-testid="text-schedule-count">
        Wyświetlono {sortedGroups.length} apartamentów z {groups.length} łącznie
      </div>
    </div>
  );
}
