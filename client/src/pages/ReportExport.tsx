import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Download, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import "jspdf-autotable";

function removeDiacritics(text: string): string {
  const map: Record<string, string> = {
    "ą": "a", "ć": "c", "ę": "e", "ł": "l", "ń": "n", "ó": "o", "ś": "s", "ź": "z", "ż": "z",
    "Ą": "A", "Ć": "C", "Ę": "E", "Ł": "L", "Ń": "N", "Ó": "O", "Ś": "S", "Ź": "Z", "Ż": "Z",
  };
  return text.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (ch) => map[ch] || ch);
}

function formatPLN(amount: number | string | null | undefined): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (num === null || num === undefined || isNaN(num as number)) return "0,00 PLN";
  return (num as number).toFixed(2).replace(".", ",") + " PLN";
}

const MONTHS = [
  "Styczen", "Luty", "Marzec", "Kwiecien", "Maj", "Czerwiec",
  "Lipiec", "Sierpien", "Wrzesien", "Pazdziernik", "Listopad", "Grudzien",
];

const MONTHS_PL = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
];

type ReportType = "monthly" | "reservations" | "occupancy";

export default function ReportExport() {
  const { toast } = useToast();
  const [reportType, setReportType] = useState<ReportType>("monthly");
  const [selectedMonth, setSelectedMonth] = useState<string>(String(new Date().getMonth()));
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: reservations = [] } = useQuery<any[]>({ queryKey: ["/api/reservations"] });
  const { data: expenses = [] } = useQuery<any[]>({ queryKey: ["/api/expenses"] });
  const { data: apartments = [] } = useQuery<any[]>({ queryKey: ["/api/apartments"] });

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  }, []);

  const apartmentMap = useMemo(() => {
    const map: Record<number, string> = {};
    apartments.forEach((a: any) => {
      map[a.id] = a.name || a.internalName || `Apt ${a.id}`;
    });
    return map;
  }, [apartments]);

  function addHeader(doc: jsPDF, title: string) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(removeDiacritics("Baltyckie Finanse"), 14, 20);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(removeDiacritics(`Wygenerowano: ${new Date().toLocaleDateString("pl-PL")}`), 14, 28);
    doc.setDrawColor(90, 219, 250);
    doc.setLineWidth(0.5);
    doc.line(14, 32, 196, 32);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(removeDiacritics(title), 14, 42);
    doc.setFont("helvetica", "normal");
  }

  function addFooter(doc: jsPDF) {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(128, 128, 128);
      doc.text(
        removeDiacritics(`Strona ${i} z ${pageCount} | Baltyckie Finanse`),
        14,
        doc.internal.pageSize.height - 10
      );
      doc.setTextColor(0, 0, 0);
    }
  }

  function filterByMonth(items: any[], dateField: string): any[] {
    const month = parseInt(selectedMonth);
    const year = parseInt(selectedYear);
    return items.filter((item) => {
      const d = item[dateField] ? new Date(item[dateField]) : null;
      if (!d) return false;
      return d.getMonth() === month && d.getFullYear() === year;
    });
  }

  function generateMonthlyReport() {
    const doc = new jsPDF();
    const monthName = MONTHS[parseInt(selectedMonth)];
    const title = `Raport miesieczny - ${monthName} ${selectedYear}`;
    addHeader(doc, title);

    const filteredReservations = filterByMonth(reservations, "startDate");
    const filteredExpenses = filterByMonth(expenses, "date");

    const totalRevenue = filteredReservations.reduce((sum: number, r: any) => {
      const amount = parseFloat(r.price || "0");
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);

    const totalExpenses = filteredExpenses.reduce((sum: number, e: any) => {
      const amount = parseFloat(e.amount || "0");
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);

    const netProfit = totalRevenue - totalExpenses;

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(removeDiacritics("Podsumowanie"), 14, 52);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(removeDiacritics(`Przychody: ${formatPLN(totalRevenue)}`), 14, 60);
    doc.text(removeDiacritics(`Koszty: ${formatPLN(totalExpenses)}`), 14, 67);
    doc.text(removeDiacritics(`Zysk netto: ${formatPLN(netProfit)}`), 14, 74);

    let startY = 84;

    if (filteredReservations.length > 0) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(removeDiacritics("Rezerwacje"), 14, startY);
      startY += 4;

      (doc as any).autoTable({
        startY,
        head: [["Nr", "Apartament", removeDiacritics("Gosc"), "Od", "Do", "Kwota"].map(removeDiacritics)],
        body: filteredReservations.map((r: any, i: number) => [
          i + 1,
          removeDiacritics(apartmentMap[r.apartmentId] || `#${r.apartmentId}`),
          removeDiacritics(r.guestName || r.guest || "-"),
          r.startDate ? new Date(r.startDate).toLocaleDateString("pl-PL") : "-",
          r.endDate ? new Date(r.endDate).toLocaleDateString("pl-PL") : "-",
          formatPLN(r.price),
        ]),
        styles: { font: "helvetica", fontSize: 8 },
        headStyles: { fillColor: [90, 219, 250], textColor: [255, 255, 255] },
        margin: { left: 14, right: 14 },
      });

      startY = (doc as any).lastAutoTable.finalY + 10;
    }

    if (filteredExpenses.length > 0) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(removeDiacritics("Koszty"), 14, startY);
      startY += 4;

      (doc as any).autoTable({
        startY,
        head: [["Nr", "Opis", "Kategoria", "Data", "Kwota"].map(removeDiacritics)],
        body: filteredExpenses.map((e: any, i: number) => [
          i + 1,
          removeDiacritics(e.description || e.name || "-"),
          removeDiacritics(e.category || "-"),
          e.date ? new Date(e.date).toLocaleDateString("pl-PL") : "-",
          formatPLN(e.amount),
        ]),
        styles: { font: "helvetica", fontSize: 8 },
        headStyles: { fillColor: [90, 219, 250], textColor: [255, 255, 255] },
        margin: { left: 14, right: 14 },
      });
    }

    addFooter(doc);
    doc.save(removeDiacritics(`raport-miesieczny-${monthName}-${selectedYear}.pdf`));
  }

  function generateReservationList() {
    const doc = new jsPDF();
    const monthName = MONTHS[parseInt(selectedMonth)];
    const title = `Lista rezerwacji - ${monthName} ${selectedYear}`;
    addHeader(doc, title);

    const filteredReservations = filterByMonth(reservations, "startDate");

    (doc as any).autoTable({
      startY: 50,
      head: [["Nr", "Apartament", removeDiacritics("Gosc"), "Od", "Do", "Kwota", "Status"].map(removeDiacritics)],
      body: filteredReservations.map((r: any, i: number) => [
        i + 1,
        removeDiacritics(apartmentMap[r.apartmentId] || `#${r.apartmentId}`),
        removeDiacritics(r.guestName || r.guest || "-"),
        r.startDate ? new Date(r.startDate).toLocaleDateString("pl-PL") : "-",
        r.endDate ? new Date(r.endDate).toLocaleDateString("pl-PL") : "-",
        formatPLN(r.price),
        removeDiacritics(r.status || "-"),
      ]),
      styles: { font: "helvetica", fontSize: 8 },
      headStyles: { fillColor: [90, 219, 250], textColor: [255, 255, 255] },
      margin: { left: 14, right: 14 },
    });

    addFooter(doc);
    doc.save(removeDiacritics(`lista-rezerwacji-${monthName}-${selectedYear}.pdf`));
  }

  function generateOccupancyReport() {
    const doc = new jsPDF();
    const monthName = MONTHS[parseInt(selectedMonth)];
    const title = `Raport oblozenia - ${monthName} ${selectedYear}`;
    addHeader(doc, title);

    const month = parseInt(selectedMonth);
    const year = parseInt(selectedYear);
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const filteredReservations = filterByMonth(reservations, "startDate");

    const aptOccupancy: { name: string; days: number; rate: string; revenue: string }[] = [];

    apartments.forEach((apt: any) => {
      const aptReservations = filteredReservations.filter((r: any) => r.apartmentId === apt.id);
      let occupiedDays = 0;
      let totalRev = 0;

      aptReservations.forEach((r: any) => {
        const checkIn = new Date(r.startDate);
        const checkOut = r.endDate ? new Date(r.endDate) : checkIn;
        const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
        occupiedDays += nights;
        totalRev += parseFloat(r.price || "0") || 0;
      });

      const rate = daysInMonth > 0 ? ((occupiedDays / daysInMonth) * 100).toFixed(1) : "0.0";

      aptOccupancy.push({
        name: apt.name || apt.internalName || `Apt ${apt.id}`,
        days: occupiedDays,
        rate: rate + "%",
        revenue: formatPLN(totalRev),
      });
    });

    (doc as any).autoTable({
      startY: 50,
      head: [["Apartament", removeDiacritics("Dni zajete"), removeDiacritics(`Dni w miesiacu`), removeDiacritics("Oblozenie"), "Przychod"].map(removeDiacritics)],
      body: aptOccupancy.map((a) => [
        removeDiacritics(a.name),
        a.days,
        daysInMonth,
        a.rate,
        a.revenue,
      ]),
      styles: { font: "helvetica", fontSize: 8 },
      headStyles: { fillColor: [90, 219, 250], textColor: [255, 255, 255] },
      margin: { left: 14, right: 14 },
    });

    addFooter(doc);
    doc.save(removeDiacritics(`raport-oblozenia-${monthName}-${selectedYear}.pdf`));
  }

  const handleGenerate = () => {
    setIsGenerating(true);
    try {
      switch (reportType) {
        case "monthly":
          generateMonthlyReport();
          break;
        case "reservations":
          generateReservationList();
          break;
        case "occupancy":
          generateOccupancyReport();
          break;
      }
      toast({ title: "Sukces", description: "Raport PDF został wygenerowany" });
    } catch (error) {
      toast({ title: "Błąd", description: "Nie udało się wygenerować raportu", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Raporty PDF" description="Generowanie raportów w formacie PDF." icon={FileText} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Konfiguracja raportu
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" data-testid="label-report-type">
                Typ raportu
              </label>
              <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)} data-testid="select-report-type">
                <SelectTrigger data-testid="trigger-report-type">
                  <SelectValue placeholder="Wybierz typ raportu" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly" data-testid="option-monthly">Raport miesięczny</SelectItem>
                  <SelectItem value="reservations" data-testid="option-reservations">Lista rezerwacji</SelectItem>
                  <SelectItem value="occupancy" data-testid="option-occupancy">Raport obłożenia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" data-testid="label-month">
                Miesiąc
              </label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth} data-testid="select-month">
                <SelectTrigger data-testid="trigger-month">
                  <SelectValue placeholder="Wybierz miesiąc" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS_PL.map((m, i) => (
                    <SelectItem key={i} value={String(i)} data-testid={`option-month-${i}`}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" data-testid="label-year">
                Rok
              </label>
              <Select value={selectedYear} onValueChange={setSelectedYear} data-testid="select-year">
                <SelectTrigger data-testid="trigger-year">
                  <SelectValue placeholder="Wybierz rok" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)} data-testid={`option-year-${y}`}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="pt-4 border-t">
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              data-testid="button-generate-pdf"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Generuj PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Dostępne raporty
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border space-y-1" data-testid="info-monthly">
              <h4 className="font-semibold text-sm">Raport miesięczny</h4>
              <p className="text-xs text-muted-foreground">
                Podsumowanie przychodów, kosztów i zysku netto za wybrany miesiąc. Zawiera tabele rezerwacji i kosztów.
              </p>
            </div>
            <div className="p-4 rounded-lg border space-y-1" data-testid="info-reservations">
              <h4 className="font-semibold text-sm">Lista rezerwacji</h4>
              <p className="text-xs text-muted-foreground">
                Pełna lista rezerwacji za wybrany okres z danymi gości, datami i kwotami.
              </p>
            </div>
            <div className="p-4 rounded-lg border space-y-1" data-testid="info-occupancy">
              <h4 className="font-semibold text-sm">Raport obłożenia</h4>
              <p className="text-xs text-muted-foreground">
                Analiza obłożenia apartamentów - liczba zajętych dni, procent obłożenia i przychody.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
