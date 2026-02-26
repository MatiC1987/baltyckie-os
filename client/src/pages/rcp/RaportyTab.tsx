import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Employee } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileDown, Briefcase, Clock, Timer, Banknote } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const MONTH_NAMES = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
];

function formatMinutes(min: number): string {
  if (!min) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export default function RaportyTab() {
  const now = new Date();
  const [empId, setEmpId] = useState("");
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));

  const { data: employees = [] } = useQuery<Employee[]>({ queryKey: ["/api/employees"] });

  const qk = empId ? `/api/rcp/report?employeeId=${empId}&year=${year}&month=${month}` : null;
  const { data: report, isLoading } = useQuery<any>({
    queryKey: [qk!],
    enabled: !!empId,
  });

  const yearsRange = useMemo(() => {
    const cur = now.getFullYear();
    return Array.from({ length: 5 }, (_, i) => cur - 2 + i);
  }, []);

  const selectedEmployee = employees.find((e: Employee) => String(e.id) === empId);

  function exportPdf() {
    if (!report || !selectedEmployee) return;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const empName = `${selectedEmployee.firstName} ${selectedEmployee.lastName}`;
    const monthName = MONTH_NAMES[Number(month) - 1];

    doc.setFontSize(16);
    doc.text(`Zestawienie czasu pracy`, 14, 15);
    doc.setFontSize(12);
    doc.text(`${empName}`, 14, 22);
    doc.text(`${monthName} ${year}`, 14, 28);
    if (selectedEmployee.position) {
      doc.setFontSize(10);
      doc.text(`Stanowisko: ${selectedEmployee.position}`, 14, 34);
    }

    const rows = report.days.map((d: any) => {
      if (d.type === "work") {
        const overtime = d.workMinutes > 480 ? d.workMinutes - 480 : 0;
        return [
          d.date,
          d.dayName,
          d.clockIn || "—",
          d.clockOut || "—",
          d.breakMinutes ? formatMinutes(d.breakMinutes) : "—",
          formatMinutes(d.workMinutes),
          overtime > 0 ? formatMinutes(overtime) : "—",
          d.status || "",
        ];
      } else if (d.type === "leave") {
        return [d.date, d.dayName, "", "", "", "", "", d.leaveType];
      } else if (d.type === "weekend") {
        return [d.date, d.dayName, "", "", "", "", "", "Dzień wolny"];
      } else {
        return [d.date, d.dayName, "", "", "", "", "", "Nieobecność"];
      }
    });

    autoTable(doc, {
      startY: selectedEmployee.position ? 38 : 32,
      head: [["Data", "Dzień", "Wejście", "Wyjście", "Przerwa", "Czas pracy", "Nadgodziny", "Status"]],
      body: rows,
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [59, 130, 246] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      didParseCell(data: any) {
        const rowData = report.days[data.row.index];
        if (rowData && rowData.isWeekend && data.section === "body") {
          data.cell.styles.fillColor = [254, 242, 242];
        }
      },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 200;
    const s = report.summary;
    doc.setFontSize(10);
    doc.text(`Podsumowanie:`, 14, finalY + 8);
    doc.setFontSize(9);
    doc.text(`Dni pracy: ${s.workDays}`, 14, finalY + 14);
    doc.text(`Godziny ogółem: ${s.totalHours}h`, 14, finalY + 19);
    doc.text(`Przerwy ogółem: ${formatMinutes(s.totalBreakMinutes)}`, 14, finalY + 24);
    if (s.hourlyRate > 0) {
      doc.text(`Stawka godzinowa: ${s.hourlyRate.toFixed(2)} PLN`, 14, finalY + 29);
      doc.text(`Wynagrodzenie brutto: ${s.grossPay.toFixed(2)} PLN`, 14, finalY + 34);
    }

    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`Wygenerowano: ${new Date().toLocaleString("pl-PL")}`, 14, doc.internal.pageSize.getHeight() - 10);

    doc.save(`RCP_${empName.replace(/\s+/g, "_")}_${year}_${String(month).padStart(2, "0")}.pdf`);
  }

  const overtimeMinutes = useMemo(() => {
    if (!report?.days) return 0;
    return report.days.reduce((sum: number, d: any) => {
      if (d.type === "work" && d.workMinutes > 480) return sum + (d.workMinutes - 480);
      return sum;
    }, 0);
  }, [report]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <Label>Pracownik</Label>
          <Select value={empId} onValueChange={setEmpId}>
            <SelectTrigger data-testid="select-report-employee">
              <SelectValue placeholder="Wybierz pracownika" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((emp: Employee) => (
                <SelectItem key={emp.id} value={String(emp.id)}>
                  {emp.firstName} {emp.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Miesiąc</Label>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[160px]" data-testid="select-report-month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((name, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Rok</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[100px]" data-testid="select-report-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearsRange.map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {report && (
          <Button onClick={exportPdf} data-testid="button-export-pdf">
            <FileDown className="h-4 w-4 mr-1" /> Eksportuj PDF
          </Button>
        )}
      </div>

      {!empId && (
        <div className="text-center py-12 text-muted-foreground">
          Wybierz pracownika, aby wygenerować raport
        </div>
      )}

      {empId && isLoading && (
        <div className="flex items-center justify-center p-8"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
      )}

      {report && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex items-center justify-center h-10 w-10 rounded-md bg-blue-500/10">
                  <Briefcase className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Dni pracy</p>
                  <p className="text-2xl font-bold" data-testid="text-work-days">{report.summary.workDays}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex items-center justify-center h-10 w-10 rounded-md bg-emerald-500/10">
                  <Clock className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Godziny ogółem</p>
                  <p className="text-2xl font-bold" data-testid="text-total-hours">{report.summary.totalHours}h</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex items-center justify-center h-10 w-10 rounded-md bg-amber-500/10">
                  <Timer className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Nadgodziny</p>
                  <p className="text-2xl font-bold" data-testid="text-overtime">{formatMinutes(overtimeMinutes)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex items-center justify-center h-10 w-10 rounded-md bg-violet-500/10">
                  <Banknote className="h-5 w-5 text-violet-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Wynagrodzenie brutto</p>
                  <p className="text-2xl font-bold" data-testid="text-gross-pay">
                    {report.summary.grossPay > 0 ? `${report.summary.grossPay.toFixed(2)} PLN` : "—"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Dzień</TableHead>
                  <TableHead>Wejście</TableHead>
                  <TableHead>Wyjście</TableHead>
                  <TableHead>Przerwa</TableHead>
                  <TableHead>Czas pracy</TableHead>
                  <TableHead>Nadgodziny</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.days.map((d: any) => {
                  const overtime = d.type === "work" && d.workMinutes > 480 ? d.workMinutes - 480 : 0;
                  return (
                    <TableRow
                      key={d.date}
                      className={d.isWeekend ? "bg-red-50/50 dark:bg-red-950/10" : ""}
                      data-testid={`row-report-${d.date}`}
                    >
                      <TableCell className="font-medium">{d.date}</TableCell>
                      <TableCell>{d.dayName}</TableCell>
                      <TableCell>{d.type === "work" ? d.clockIn : ""}</TableCell>
                      <TableCell>{d.type === "work" ? d.clockOut : ""}</TableCell>
                      <TableCell>{d.type === "work" && d.breakMinutes ? formatMinutes(d.breakMinutes) : ""}</TableCell>
                      <TableCell>{d.type === "work" ? formatMinutes(d.workMinutes) : ""}</TableCell>
                      <TableCell>{overtime > 0 ? formatMinutes(overtime) : ""}</TableCell>
                      <TableCell>
                        {d.type === "leave" && <span className="text-amber-600 dark:text-amber-400">{d.leaveType}</span>}
                        {d.type === "weekend" && <span className="text-muted-foreground">Dzień wolny</span>}
                        {d.type === "absent" && <span className="text-red-600 dark:text-red-400">Nieobecność</span>}
                        {d.type === "work" && d.status && <span className="text-emerald-600 dark:text-emerald-400">{d.status}</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell colSpan={4}>Razem</TableCell>
                  <TableCell>{formatMinutes(report.summary.totalBreakMinutes)}</TableCell>
                  <TableCell>{report.summary.totalHours}h</TableCell>
                  <TableCell>{overtimeMinutes > 0 ? formatMinutes(overtimeMinutes) : "—"}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
