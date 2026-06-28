import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp, TrendingDown, DollarSign, Percent, BedDouble,
  AlertCircle, User, FileText, Building2, ArrowRight,
  CalendarDays, Clock, ChevronRight, HandCoins, FilePlus,
  Wallet, CreditCard, ExternalLink, CheckCircle2, CircleDot,
  BarChart3, Loader2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import type { Apartment } from "@shared/schema";

const MONTHS_SHORT = ["Sty","Lut","Mar","Kwi","Maj","Cze","Lip","Sie","Wrz","Paź","Lis","Gru"];

const fmtPLN = (v: number) =>
  v.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " zł";

const fmtDate = (d: string | null | undefined) =>
  d ? d.split("-").reverse().join(".") : "—";

function pct(current: number, prev: number) {
  if (!prev) return null;
  return Math.round(((current - prev) / prev) * 100);
}

interface CenterData {
  currentYear: number;
  forecastRevenue: number;
  rentalRevenue: number;
  subleaseRevenue: number;
  totalRevenue: number;
  forecastRealization: number;
  costsCurrent: number;
  costsPrev: number;
  profit: number;
  profitPrev: number;
  profitMargin: number;
  occupancyRate: number;
  revenuePrevYear: number;
  monthlyBreakdown: { month: number; rentalRevenue: number; subleaseRevenue: number; costs: number }[];
  activeSubleases: { id: number; tenantName: string; monthlyAmount: number; additionalFees: number; status: string; startDate: string; endDate: string }[];
  activeContract: { monthlyRent: string; startDate: string; endDate: string | null; status: string; ownerId: number | null } | null;
  rentHistory: { date: string; rent: number; type: string; id: number }[];
  owner: { id: number; name: string; phone: string | null; email: string | null } | null;
  paymentSchedule: { id: number; title: string; category: string; amount: string; paymentDate: string; isPaid: boolean; daysOverdue: number }[];
  unpaidReservations: { id: number; reservationNumber: string; guestName: string; startDate: string; endDate: string; price: string; paidAmount: string }[];
}

interface Props {
  apartment: Apartment;
  onAddContract?: () => void;
  onAddAnnex?: () => void;
  onAddSublease?: () => void;
  onAddCost?: () => void;
  onOpenForecast?: () => void;
}

export function ApartmentCenter({ apartment, onAddContract, onAddAnnex, onAddSublease, onAddCost, onOpenForecast }: Props) {
  const { data, isLoading } = useQuery<CenterData>({
    queryKey: [`/api/apartments/${apartment.id}/center`],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  const revenueChange = pct(data.totalRevenue, data.revenuePrevYear);
  const profitChange = pct(data.profit, data.profitPrev);
  const overduePayments = data.paymentSchedule.filter(p => !p.isPaid && p.daysOverdue > 0);
  const upcomingPayments = data.paymentSchedule.filter(p => !p.isPaid && p.daysOverdue === 0).slice(0, 5);
  const paidPaymentsCount = data.paymentSchedule.filter(p => p.isPaid).length;

  const chartData = data.monthlyBreakdown.map(m => ({
    name: MONTHS_SHORT[m.month - 1],
    Najem: m.rentalRevenue,
    Podnajem: m.subleaseRevenue,
    Koszty: m.costs,
  }));

  const realizationColor = data.forecastRealization >= 85 ? "text-green-600 dark:text-green-400"
    : data.forecastRealization >= 60 ? "text-amber-600 dark:text-amber-400"
    : "text-red-600 dark:text-red-400";

  return (
    <div className="space-y-4 py-2" data-testid="apartment-center">

      {/* ── Nagłówek: właściciel + status ───────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          {data.owner ? (
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-medium">{data.owner.name}</span>
              {data.owner.phone && <span className="text-xs text-muted-foreground">· {data.owner.phone}</span>}
              <Link href="/wlasciciele" className="text-xs text-primary hover:underline flex items-center gap-0.5" data-testid="link-owner-page">
                Właściciel <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground italic">Brak przypisanego właściciela</span>
          )}
          {data.activeContract && (
            <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50 dark:bg-green-950/40 text-xs">
              Aktywna umowa · {fmtPLN(Number(data.activeContract.monthlyRent || 0))}/mies
            </Badge>
          )}
          {data.activeSubleases.filter(s => s.status === 'AKTYWNA').length > 0 && (
            <Badge variant="outline" className="text-cyan-700 border-cyan-300 bg-cyan-50 dark:bg-cyan-950/40 text-xs">
              Podnajem aktywny
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground font-medium">{data.currentYear}</span>
      </div>

      {/* ── KPI row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Prognoza vs realizacja */}
        <Card className="card-gradient col-span-2 lg:col-span-1" data-testid="kpi-forecast">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
              <BarChart3 className="h-3.5 w-3.5 text-blue-500" />
              Prognoza / Realizacja
            </div>
            <div className="flex items-end gap-2 mb-2">
              <span className={`text-xl font-bold tabular-nums ${realizationColor}`}>{data.forecastRealization}%</span>
              <span className="text-xs text-muted-foreground mb-0.5">z {fmtPLN(data.forecastRevenue)}</span>
            </div>
            <Progress value={Math.min(data.forecastRealization, 100)} className="h-1.5 mb-2"
              style={{ '--progress-color': data.forecastRealization >= 85 ? 'hsl(142 71% 45%)' : data.forecastRealization >= 60 ? 'hsl(38 92% 50%)' : 'hsl(0 84% 60%)' } as React.CSSProperties} />
            <div className="grid grid-cols-2 gap-1 text-[10px] text-muted-foreground">
              <div>
                <div className="font-medium text-foreground">{fmtPLN(data.rentalRevenue)}</div>
                <div>Najem</div>
              </div>
              {data.subleaseRevenue > 0 && (
                <div>
                  <div className="font-medium text-cyan-600 dark:text-cyan-400">{fmtPLN(data.subleaseRevenue)}</div>
                  <div>Podnajem</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Łączne przychody */}
        <Card data-testid="kpi-total-revenue">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
              <DollarSign className="h-3.5 w-3.5 text-green-500" />
              Przychody
            </div>
            <p className="text-xl font-bold tabular-nums">{fmtPLN(data.totalRevenue)}</p>
            {revenueChange !== null && (
              <div className={`flex items-center gap-1 text-xs mt-1 ${revenueChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                {revenueChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {revenueChange > 0 ? '+' : ''}{revenueChange}% r/r
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rentowność */}
        <Card data-testid="kpi-profit">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
              <TrendingUp className="h-3.5 w-3.5 text-purple-500" />
              Zysk netto
            </div>
            <p className={`text-xl font-bold tabular-nums ${data.profit < 0 ? 'text-red-600' : ''}`}>{fmtPLN(data.profit)}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
              <span>Marża: <span className="font-medium text-foreground">{data.profitMargin}%</span></span>
              {profitChange !== null && (
                <span className={profitChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}>
                  {profitChange > 0 ? '+' : ''}{profitChange}% r/r
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Obłożenie */}
        <Card data-testid="kpi-occupancy">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
              <BedDouble className="h-3.5 w-3.5 text-cyan-500" />
              Obłożenie
            </div>
            <p className="text-xl font-bold tabular-nums">{data.occupancyRate}%</p>
            <Progress value={data.occupancyRate} className="h-1.5 mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* ── Alerty ────────────────────────────────────────────────── */}
      {(overduePayments.length > 0 || data.unpaidReservations.length > 0) && (
        <div className="space-y-1.5">
          {overduePayments.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900/40 px-3 py-2 text-sm text-red-700 dark:text-red-400" data-testid="alert-overdue-payments">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span><strong>{overduePayments.length}</strong> zaległych płatności właścicielskich — łącznie {fmtPLN(overduePayments.reduce((s, p) => s + Number(p.amount), 0))}</span>
            </div>
          )}
          {data.unpaidReservations.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900/40 px-3 py-2 text-sm text-amber-700 dark:text-amber-400" data-testid="alert-unpaid-reservations">
              <Clock className="h-4 w-4 shrink-0" />
              <span><strong>{data.unpaidReservations.length}</strong> nieopłaconych rezerwacji</span>
            </div>
          )}
        </div>
      )}

      {/* ── Miesięczne przychody chart ─────────────────────────────── */}
      <Card data-testid="card-monthly-chart">
        <CardHeader className="pb-1">
          <CardTitle className="text-sm font-semibold">Miesięczne przychody — najem i podnajem {data.currentYear}</CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-3">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
              <Tooltip formatter={(v: number, name: string) => [fmtPLN(v), name]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Najem" fill="#3b82f6" radius={[2, 2, 0, 0]} stackId="rev" />
              <Bar dataKey="Podnajem" fill="#06b6d4" radius={[2, 2, 0, 0]} stackId="rev" />
              <Bar dataKey="Koszty" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── Właściciel + Podnajmy ─────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

        {/* Właściciel i umowa */}
        <Card data-testid="card-owner-contract">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              Właściciel i umowa
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {data.owner ? (
              <div className="space-y-1">
                <div className="font-semibold text-sm">{data.owner.name}</div>
                {data.owner.phone && <div className="text-xs text-muted-foreground">📞 {data.owner.phone}</div>}
                {data.owner.email && <div className="text-xs text-muted-foreground">✉ {data.owner.email}</div>}
                <Link href="/wlasciciele" data-testid="link-owner-detail">
                  <Button variant="outline" size="sm" className="mt-1 h-7 text-xs gap-1">
                    Karta właściciela <ExternalLink className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Brak właściciela</p>
            )}

            {data.activeContract && (
              <>
                <Separator />
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Aktywna umowa</div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold">{fmtPLN(Number(data.activeContract.monthlyRent || 0))}</span>
                    <span className="text-xs text-muted-foreground">/miesiąc</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {fmtDate(data.activeContract.startDate)} → {data.activeContract.endDate ? fmtDate(data.activeContract.endDate) : "bezterminowo"}
                  </div>
                </div>
              </>
            )}

            {data.rentHistory && data.rentHistory.length > 0 && (
              <>
                <Separator />
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Historia czynszu</div>
                  <div className="space-y-1">
                    {data.rentHistory.slice(0, 4).map((entry, idx) => {
                      const prev = idx > 0 ? data.rentHistory[idx - 1].rent : null;
                      const change = prev !== null ? entry.rent - prev : null;
                      return (
                        <div key={entry.id} className="flex items-center gap-2 text-xs" data-testid={`rent-history-${entry.id}`}>
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${entry.type === 'ANEKS' ? 'bg-amber-400' : 'bg-blue-500'}`} />
                          <span className="font-medium">{fmtPLN(entry.rent)}</span>
                          <span className="text-muted-foreground">od {fmtDate(entry.date)}</span>
                          {change !== null && change !== 0 && (
                            <span className={`ml-auto ${change > 0 ? 'text-red-500' : 'text-green-600'}`}>
                              {change > 0 ? '+' : ''}{fmtPLN(change)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Podnajmy */}
        <Card data-testid="card-subleases">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Podnajmy
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {data.activeSubleases.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">Brak podnajmów dla tego apartamentu</div>
            ) : (
              <div className="space-y-3">
                {data.activeSubleases.map(s => {
                  const isActive = s.status === 'AKTYWNA';
                  const totalMonthly = s.monthlyAmount + s.additionalFees;
                  return (
                    <div key={s.id} className="border rounded-lg p-3 space-y-1" data-testid={`sublease-card-${s.id}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold truncate">{s.tenantName}</span>
                        <Badge variant={isActive ? "default" : "secondary"} className={`text-[10px] shrink-0 ${isActive ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30' : ''}`}>
                          {s.status}
                        </Badge>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-base font-bold">{fmtPLN(totalMonthly)}</span>
                        <span className="text-xs text-muted-foreground">/mies</span>
                        {s.additionalFees > 0 && (
                          <span className="text-xs text-muted-foreground">(czynsz {fmtPLN(s.monthlyAmount)} + media {fmtPLN(s.additionalFees)})</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {fmtDate(s.startDate)} → {s.endDate ? fmtDate(s.endDate) : "bezterminowo"}
                      </div>
                      <Link href="/podnajem" data-testid={`link-sublease-${s.id}`}>
                        <Button variant="ghost" size="sm" className="h-6 text-xs px-1 gap-0.5 mt-1">
                          Otwórz podnajem <ChevronRight className="h-3 w-3" />
                        </Button>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Harmonogram płatności właścicielskich ─────────────────── */}
      {data.paymentSchedule.length > 0 && (
        <Card data-testid="card-payment-schedule">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                Harmonogram opłat właścicielskich
              </CardTitle>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {overduePayments.length > 0 && (
                  <Badge variant="destructive" className="text-[10px]">{overduePayments.length} zaległych</Badge>
                )}
                <span>{paidPaymentsCount} opłaconych</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left px-5 py-2 font-medium text-muted-foreground">Tytuł</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">Kategoria</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Kwota</th>
                    <th className="text-center px-3 py-2 font-medium text-muted-foreground">Termin</th>
                    <th className="text-center px-3 py-2 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.paymentSchedule.slice(0, 12).map(p => {
                    const isOverdue = !p.isPaid && p.daysOverdue > 0;
                    return (
                      <tr
                        key={p.id}
                        className={`border-b transition-colors ${isOverdue ? 'bg-red-50 dark:bg-red-950/20 hover:bg-red-100/80 dark:hover:bg-red-950/30' : 'hover:bg-muted/30'}`}
                        data-testid={`payment-row-${p.id}`}
                      >
                        <td className="px-5 py-2 font-medium">
                          <div className="flex items-center gap-1.5">
                            {isOverdue && <AlertCircle className="h-3 w-3 text-red-500 shrink-0" />}
                            <span className="truncate max-w-[120px] sm:max-w-none">{p.title}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">{p.category}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmtPLN(Number(p.amount))}</td>
                        <td className="px-3 py-2 text-center text-muted-foreground">{fmtDate(p.paymentDate)}</td>
                        <td className="px-3 py-2 text-center">
                          {p.isPaid ? (
                            <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                              <CheckCircle2 className="h-3 w-3" /> Opłacona
                            </span>
                          ) : isOverdue ? (
                            <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                              <AlertCircle className="h-3 w-3" /> {p.daysOverdue}d
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                              <CircleDot className="h-3 w-3" /> Oczekuje
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {data.paymentSchedule.length > 12 && (
                <div className="px-5 py-2 text-xs text-muted-foreground">
                  … i {data.paymentSchedule.length - 12} kolejnych płatności
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Nieopłacone rezerwacje ─────────────────────────────────── */}
      {data.unpaidReservations.length > 0 && (
        <Card data-testid="card-unpaid-reservations">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Nieopłacone rezerwacje ({data.currentYear})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {data.unpaidReservations.map(r => {
              const remaining = Number(r.price) - Number(r.paidAmount);
              return (
                <div key={r.id} className="flex items-center gap-3 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-2" data-testid={`unpaid-res-${r.id}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground">{r.reservationNumber}</span>
                      <span className="text-sm font-medium truncate">{r.guestName}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{fmtDate(r.startDate)} – {fmtDate(r.endDate)}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-amber-700 dark:text-amber-400">{fmtPLN(remaining)}</div>
                    <div className="text-[10px] text-muted-foreground">pozostało</div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ── Akcje ─────────────────────────────────────────────────── */}
      <Card className="bg-muted/30 border-dashed" data-testid="card-actions">
        <CardContent className="py-3 px-5">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground mr-2">Akcje:</span>
            {onAddContract && (
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={onAddContract} data-testid="btn-center-add-contract">
                <FilePlus className="h-3.5 w-3.5" /> Umowa
              </Button>
            )}
            {onAddAnnex && (
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={onAddAnnex} data-testid="btn-center-add-annex">
                <FileText className="h-3.5 w-3.5" /> Aneks
              </Button>
            )}
            {onAddSublease && (
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={onAddSublease} data-testid="btn-center-add-sublease">
                <Building2 className="h-3.5 w-3.5" /> Podnajem
              </Button>
            )}
            {onAddCost && (
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={onAddCost} data-testid="btn-center-add-cost">
                <Wallet className="h-3.5 w-3.5" /> Koszt
              </Button>
            )}
            {onOpenForecast && (
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={onOpenForecast} data-testid="btn-center-forecast">
                <TrendingUp className="h-3.5 w-3.5" /> Prognoza
              </Button>
            )}
            <Link href="/konta-firmowe" data-testid="link-transfers">
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                <CreditCard className="h-3.5 w-3.5" /> Konta bankowe
              </Button>
            </Link>
            <Link href="/v2-koszty" data-testid="link-costs">
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                <HandCoins className="h-3.5 w-3.5" /> Koszty
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
