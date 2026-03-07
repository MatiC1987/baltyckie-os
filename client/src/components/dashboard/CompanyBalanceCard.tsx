import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowUp, ArrowDown, Wallet, Landmark, Bitcoin, HandCoins, Scale,
  Pencil, Check, X, Plus, ChevronDown as ChevronDownIcon, Trash2,
} from "lucide-react";
import type { Loan, LoanPayment } from "@shared/schema";
import type { CompanyBalance, CompanyBalanceAccount } from "./widget-utils";
import { format } from "date-fns";
import { Textarea } from "@/components/ui/textarea";

function getAccountIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("pekao") || lower.includes("santander")) return Landmark;
  if (lower.includes("saldo")) return Scale;
  if (lower.includes("krypto")) return Bitcoin;
  if (lower.includes("pożyczki")) return HandCoins;
  return Wallet;
}

function MiniSparkline({ data, color, accountId }: { data: { value: number }[]; color: string; accountId?: number }) {
  if (data.length < 2) return null;
  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 64;
  const height = 24;
  const padding = 2;
  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((v - min) / range) * (height - 2 * padding);
    return `${x},${y}`;
  });
  return (
    <svg width={width} height={height} className="shrink-0" data-testid={accountId ? `sparkline-account-${accountId}` : undefined}>
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  KONTA_BANKOWE: "Konta bankowe",
  GOTOWKA: "Gotówka",
  INNE: "Inne",
};

const CATEGORY_ORDER = ["KONTA_BANKOWE", "GOTOWKA", "INNE"];

type LoanWithPayments = Loan & { payments: LoanPayment[]; totalPaid: string; remaining: string };

function LoansDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const { data: loansData, isLoading } = useQuery<LoanWithPayments[]>({
    queryKey: ["/api/loans"],
    enabled: open,
  });

  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDebtor, setNewDebtor] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const [payingLoanId, setPayingLoanId] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [payNotes, setPayNotes] = useState("");

  const [expandedLoanId, setExpandedLoanId] = useState<number | null>(null);

  const createLoanMutation = useMutation({
    mutationFn: async (data: { title: string; debtor: string; amount: string; notes?: string }) => {
      return apiRequest("POST", "/api/loans", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/company-balance"] });
      setShowAddForm(false);
      setNewTitle(""); setNewDebtor(""); setNewAmount(""); setNewNotes("");
      toast({ title: "Pożyczka dodana" });
    },
  });

  const deleteLoanMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/loans/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/company-balance"] });
      toast({ title: "Pożyczka usunięta" });
    },
  });

  const createPaymentMutation = useMutation({
    mutationFn: async (data: { loanId: number; amount: string; date: string; notes?: string }) => {
      return apiRequest("POST", "/api/loan-payments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/company-balance"] });
      setPayingLoanId(null);
      setPayAmount(""); setPayDate(new Date().toISOString().split("T")[0]); setPayNotes("");
      toast({ title: "Spłata zarejestrowana" });
    },
  });

  const deletePaymentMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/loan-payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/company-balance"] });
      toast({ title: "Spłata usunięta" });
    },
  });

  const totalRemaining = loansData?.reduce((s, l) => s + Number(l.remaining), 0) || 0;
  const totalLoaned = loansData?.reduce((s, l) => s + Number(l.amount), 0) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="dialog-loans">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandCoins className="h-5 w-5" />
            Zarządzanie pożyczkami
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-lg bg-gradient-to-r from-orange-500/10 to-transparent border border-orange-500/20 p-3 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Łączna kwota pożyczek</div>
              <div className="text-xl font-bold">{totalLoaned.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Pozostało do spłaty</div>
              <div className="text-xl font-bold text-orange-600 dark:text-orange-400">{totalRemaining.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</div>
            </div>
          </div>
        </div>

        {!showAddForm ? (
          <Button onClick={() => setShowAddForm(true)} size="sm" className="mb-3" data-testid="button-add-loan">
            <Plus className="h-4 w-4 mr-1" /> Dodaj pożyczkę
          </Button>
        ) : (
          <div className="border rounded-lg p-3 mb-3 space-y-3 bg-muted/30">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tytuł *</Label>
                <Input value={newTitle} onChange={(e: any) => setNewTitle(e.target.value)} placeholder="np. Pożyczka na remont" className="h-8 text-sm" data-testid="input-loan-title" />
              </div>
              <div>
                <Label className="text-xs">Dłużnik *</Label>
                <Input value={newDebtor} onChange={(e: any) => setNewDebtor(e.target.value)} placeholder="np. Jan Kowalski" className="h-8 text-sm" data-testid="input-loan-debtor" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Kwota (PLN) *</Label>
                <Input type="number" step="0.01" value={newAmount} onChange={(e: any) => setNewAmount(e.target.value)} placeholder="0.00" className="h-8 text-sm" data-testid="input-loan-amount" />
              </div>
              <div>
                <Label className="text-xs">Notatki</Label>
                <Input value={newNotes} onChange={(e: any) => setNewNotes(e.target.value)} placeholder="Opcjonalne" className="h-8 text-sm" data-testid="input-loan-notes" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={!newTitle || !newDebtor || !newAmount || createLoanMutation.isPending}
                onClick={() => createLoanMutation.mutate({ title: newTitle, debtor: newDebtor, amount: newAmount, notes: newNotes || undefined })}
                data-testid="button-save-loan"
              >
                <Check className="h-3 w-3 mr-1" /> Zapisz
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowAddForm(false); setNewTitle(""); setNewDebtor(""); setNewAmount(""); setNewNotes(""); }}
                data-testid="button-cancel-loan"
              >
                Anuluj
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>
        ) : !loansData || loansData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Brak pożyczek. Dodaj pierwszą pożyczkę powyżej.</div>
        ) : (
          <div className="space-y-2">
            {loansData.map(loan => {
              const remaining = Number(loan.remaining);
              const total = Number(loan.amount);
              const paid = Number(loan.totalPaid);
              const paidPct = total > 0 ? (paid / total) * 100 : 0;
              const isExpanded = expandedLoanId === loan.id;
              const isPaying = payingLoanId === loan.id;

              return (
                <div key={loan.id} className="border rounded-lg overflow-hidden" data-testid={`card-loan-${loan.id}`}>
                  <div
                    className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setExpandedLoanId(isExpanded ? null : loan.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{loan.title}</span>
                          {remaining <= 0 && <Badge variant="outline" className="text-green-600 border-green-600 text-[10px]">SPŁACONA</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{loan.debtor}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold">{total.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</div>
                        {remaining > 0 && (
                          <div className="text-xs text-orange-600 dark:text-orange-400">
                            pozostało: {remaining.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 w-full bg-muted rounded-full h-1.5">
                      <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.min(paidPct, 100)}%` }} />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-muted-foreground">Spłacono {paidPct.toFixed(0)}%</span>
                      {loan.notes && <span className="text-[10px] text-muted-foreground italic truncate max-w-[150px]">{loan.notes}</span>}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t bg-muted/20 p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground uppercase">Historia spłat</span>
                        <div className="flex gap-1">
                          {remaining > 0 && (
                            <Button size="sm" variant="outline" className="h-7 text-xs"
                              onClick={(e) => { e.stopPropagation(); setPayingLoanId(isPaying ? null : loan.id); setPayAmount(""); }}
                              data-testid={`button-add-payment-${loan.id}`}
                            >
                              <Plus className="h-3 w-3 mr-1" /> Spłata
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive/80"
                            onClick={(e) => { e.stopPropagation(); if (confirm("Usunąć tę pożyczkę?")) deleteLoanMutation.mutate(loan.id); }}
                            data-testid={`button-delete-loan-${loan.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {isPaying && (
                        <div className="border rounded-md p-2 space-y-2 bg-background">
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <Label className="text-[10px]">Kwota *</Label>
                              <Input type="number" step="0.01" value={payAmount} onChange={(e: any) => setPayAmount(e.target.value)}
                                placeholder={remaining.toFixed(2)} className="h-7 text-xs" data-testid={`input-payment-amount-${loan.id}`} />
                            </div>
                            <div>
                              <Label className="text-[10px]">Data *</Label>
                              <Input type="date" value={payDate} onChange={(e: any) => setPayDate(e.target.value)}
                                className="h-7 text-xs" data-testid={`input-payment-date-${loan.id}`} />
                            </div>
                            <div>
                              <Label className="text-[10px]">Notatka</Label>
                              <Input value={payNotes} onChange={(e: any) => setPayNotes(e.target.value)}
                                placeholder="Opcjonalnie" className="h-7 text-xs" data-testid={`input-payment-notes-${loan.id}`} />
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" className="h-7 text-xs"
                              disabled={!payAmount || !payDate || createPaymentMutation.isPending}
                              onClick={() => createPaymentMutation.mutate({ loanId: loan.id, amount: payAmount, date: payDate, notes: payNotes || undefined })}
                              data-testid={`button-save-payment-${loan.id}`}
                            >
                              <Check className="h-3 w-3 mr-1" /> Zapisz spłatę
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs"
                              onClick={() => { setPayingLoanId(null); setPayAmount(""); setPayNotes(""); }}
                            >
                              Anuluj
                            </Button>
                          </div>
                        </div>
                      )}

                      {loan.payments.length === 0 ? (
                        <div className="text-xs text-muted-foreground text-center py-2">Brak spłat</div>
                      ) : (
                        <div className="space-y-1">
                          {loan.payments.map(p => (
                            <div key={p.id} className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-muted/50 group" data-testid={`row-payment-${p.id}`}>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">{format(new Date(p.date), "dd.MM.yyyy")}</span>
                                <span className="font-medium text-green-600 dark:text-green-400">
                                  +{Number(p.amount).toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
                                </span>
                                {p.notes && <span className="text-muted-foreground italic">{p.notes}</span>}
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); if (confirm("Usunąć tę spłatę?")) deletePaymentMutation.mutate(p.id); }}
                                className="invisible group-hover:visible text-destructive hover:text-destructive/80"
                                data-testid={`button-delete-payment-${p.id}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function CompanyBalanceCard({
  companyBalance, balanceLoading, editingAccountId, editingBalance,
  setEditingAccountId, setEditingBalance, updateBalanceMutation,
}: any) {
  const [loansDialogOpen, setLoansDialogOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };
  const saldoLinkMap: Record<string, string> = {
    "Saldo - M. Cieślak": "/saldo-mc",
    "Saldo - M. Latasiewicz": "/saldo-ml",
    "Saldo - J. Głodkowska": "/saldo-jg",
  };

  const { data: balanceHistory } = useQuery<Record<number, { date: string; balance: string }[]>>({
    queryKey: ["/api/account-balance-history"],
  });

  const totalBalance = Number(companyBalance?.totalBalance || 0);

  const totalChange = useMemo(() => {
    if (!balanceHistory || !companyBalance?.accounts) return null;
    let currentTotal = 0;
    let previousTotal = 0;
    let hasPrevious = false;
    for (const acc of companyBalance.accounts) {
      const current = Number(acc.latestBalance);
      currentTotal += current;
      const history = balanceHistory[acc.id];
      if (history && history.length >= 2) {
        previousTotal += Number(history[history.length - 2].balance);
        hasPrevious = true;
      } else {
        previousTotal += current;
      }
    }
    if (!hasPrevious) return null;
    const diff = currentTotal - previousTotal;
    const pct = previousTotal !== 0 ? ((diff / Math.abs(previousTotal)) * 100) : 0;
    return { diff, pct };
  }, [balanceHistory, companyBalance]);

  const groupedAccounts = useMemo(() => {
    if (!companyBalance?.accounts) return {};
    const groups: Record<string, CompanyBalanceAccount[]> = {};
    for (const acc of companyBalance.accounts) {
      const cat = acc.category || "INNE";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(acc);
    }
    return groups;
  }, [companyBalance]);

  const getAccountChange = (accId: number, currentBalance: number) => {
    if (!balanceHistory?.[accId] || balanceHistory[accId].length < 2) return null;
    const history = balanceHistory[accId];
    const prev = Number(history[history.length - 2].balance);
    const diff = currentBalance - prev;
    const pct = prev !== 0 ? ((diff / Math.abs(prev)) * 100) : 0;
    return { diff, pct };
  };

  const getSparklineData = (accId: number) => {
    if (!balanceHistory?.[accId]) return [];
    return balanceHistory[accId].map(s => ({ value: Number(s.balance) }));
  };

  const renderAccountCard = (acc: CompanyBalanceAccount) => {
    const Icon = getAccountIcon(acc.name);
    const balance = Number(acc.latestBalance);
    const isEditing = editingAccountId === acc.id;
    const isAuto = acc.balanceSource === "auto_saldo" || acc.balanceSource === "auto_loans";
    const saldoLink = saldoLinkMap[acc.name];
    const isLoan = acc.type === "LOAN";
    const change = getAccountChange(acc.id, balance);
    const sparkData = getSparklineData(acc.id);
    const sparkColor = change && change.diff >= 0 ? "#22c55e" : change && change.diff < 0 ? "#ef4444" : "#94a3b8";

    const content = (
      <>
        <div className="flex items-center gap-1.5 mb-1">
          <div className="h-6 w-6 rounded-md bg-muted flex items-center justify-center shrink-0">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <span className="text-[11px] text-muted-foreground truncate leading-tight">{acc.name}</span>
          {isAuto && <span className="text-[9px] text-muted-foreground/50 italic ml-auto">auto</span>}
        </div>
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            {isEditing ? (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  step="0.01"
                  value={editingBalance}
                  onChange={(e: any) => setEditingBalance(e.target.value)}
                  onKeyDown={(e: any) => {
                    if (e.key === "Enter" && editingBalance.trim()) {
                      updateBalanceMutation.mutate({ accountId: acc.id, balance: editingBalance.trim() });
                    }
                    if (e.key === "Escape") { setEditingAccountId(null); setEditingBalance(""); }
                  }}
                  className="h-6 text-xs w-20"
                  autoFocus
                  data-testid={`input-balance-${acc.id}`}
                />
                <Button size="sm" variant="ghost"
                  onClick={() => { if (editingBalance.trim()) updateBalanceMutation.mutate({ accountId: acc.id, balance: editingBalance.trim() }); }}
                  disabled={!editingBalance.trim() || updateBalanceMutation.isPending}
                  data-testid={`button-save-balance-${acc.id}`}
                >
                  <Check className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost"
                  onClick={() => { setEditingAccountId(null); setEditingBalance(""); }}
                  data-testid={`button-cancel-balance-${acc.id}`}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1 group/edit">
                <span className={`text-sm font-bold ${balance < 0 ? "text-red-600 dark:text-red-400" : ""}`} data-testid={`text-account-balance-${acc.id}`}>
                  {balance.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
                </span>
                {!isAuto && (
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingAccountId(acc.id); setEditingBalance(balance.toString()); }}
                    className="invisible group-hover/edit:visible text-muted-foreground hover:text-foreground"
                    data-testid={`button-edit-balance-${acc.id}`}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
            {change && (
              <div className={`flex items-center gap-0.5 mt-0.5 ${change.diff >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} data-testid={`text-account-change-${acc.id}`}>
                {change.diff >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                <span className="text-[10px] font-medium">
                  {change.diff >= 0 ? "+" : ""}{change.diff.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} zł
                </span>
                <span className="text-[9px] text-muted-foreground">
                  ({change.pct >= 0 ? "+" : ""}{change.pct.toFixed(1)}%)
                </span>
              </div>
            )}
          </div>
          <MiniSparkline data={sparkData} color={sparkColor} accountId={acc.id} />
        </div>
      </>
    );

    if (isLoan) {
      return (
        <button
          key={acc.id}
          onClick={() => setLoansDialogOpen(true)}
          className="rounded-lg border border-border p-2.5 hover-elevate block text-left w-full"
          data-testid={`card-account-balance-${acc.id}`}
        >
          {content}
        </button>
      );
    }

    if (isAuto && saldoLink) {
      return (
        <Link
          key={acc.id}
          href={saldoLink}
          className="rounded-lg border border-border p-2.5 hover-elevate block"
          data-testid={`card-account-balance-${acc.id}`}
        >
          {content}
        </Link>
      );
    }

    return (
      <div key={acc.id} className="rounded-lg border border-border p-2.5" data-testid={`card-account-balance-${acc.id}`}>
        {content}
      </div>
    );
  };

  return (
    <Card data-testid="card-company-balance">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4" />
          Saldo firmowe
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3">
        {balanceLoading ? (
          <div className="space-y-3">
            <div className="h-16 bg-muted animate-pulse rounded-lg" />
            <div className="h-24 bg-muted animate-pulse rounded-lg" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 p-4">
              <div className="text-xs text-muted-foreground mb-1">Łączne saldo</div>
              <div className="flex items-end gap-3 flex-wrap">
                <span className={`text-3xl font-bold tracking-tight ${totalBalance < 0 ? "text-red-600 dark:text-red-400" : ""}`} data-testid="text-total-balance">
                  {totalBalance.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-lg font-semibold text-muted-foreground">PLN</span>
                </span>
                {totalChange && (
                  <div className={`flex items-center gap-1 pb-1 ${totalChange.diff >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {totalChange.diff >= 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                    <span className="text-sm font-semibold">
                      {totalChange.diff >= 0 ? "+" : ""}{totalChange.diff.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} zł
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({totalChange.pct >= 0 ? "+" : ""}{totalChange.pct.toFixed(1)}%)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {CATEGORY_ORDER.map(cat => {
              const accs = groupedAccounts[cat];
              if (!accs || accs.length === 0) return null;
              const categoryTotal = accs.reduce((s, a) => s + Number(a.latestBalance), 0);
              const isExpanded = expandedCategories.has(cat);
              return (
                <div key={cat}>
                  <button
                    onClick={() => toggleCategory(cat)}
                    className="flex items-center justify-between gap-2 w-full py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors mb-1"
                    data-testid={`button-toggle-category-${cat}`}
                  >
                    <div className="flex items-center gap-2">
                      <ChevronDownIcon className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${isExpanded ? "" : "-rotate-90"}`} />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" data-testid={`text-category-label-${cat}`}>{CATEGORY_LABELS[cat] || cat}</span>
                      <span className="text-[10px] text-muted-foreground/60">({accs.length})</span>
                    </div>
                    <span className={`text-sm font-bold tabular-nums ${categoryTotal < 0 ? "text-red-600 dark:text-red-400" : "text-foreground"}`} data-testid={`text-category-total-${cat}`}>
                      {categoryTotal.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 pl-2">
                      {accs.map(renderAccountCard)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
      <LoansDialog open={loansDialogOpen} onOpenChange={setLoansDialogOpen} />
    </Card>
  );
}
