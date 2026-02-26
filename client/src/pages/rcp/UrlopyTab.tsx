import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Employee, LeaveRequest } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Check, X, Trash2, CalendarDays, Clock, AlertCircle } from "lucide-react";

const LEAVE_TYPES = [
  { value: "URLOP_WYPOCZYNKOWY", label: "Urlop wypoczynkowy" },
  { value: "URLOP_NA_ZADANIE", label: "Urlop na żądanie" },
  { value: "ZWOLNIENIE_LEKARSKIE", label: "Zwolnienie lekarskie" },
  { value: "INNY", label: "Inny" },
];

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  OCZEKUJACY: { label: "Oczekujący", variant: "secondary" },
  ZAAKCEPTOWANY: { label: "Zaakceptowany", variant: "default" },
  ODRZUCONY: { label: "Odrzucony", variant: "destructive" },
};

function countWorkDays(start: string, end: string): number {
  const s = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export default function UrlopyTab() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [empFilter, setEmpFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewingRequest, setReviewingRequest] = useState<LeaveRequest | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [formEmpId, setFormEmpId] = useState("");
  const [formType, setFormType] = useState("URLOP_WYPOCZYNKOWY");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formComment, setFormComment] = useState("");
  const { toast } = useToast();

  const statusParam = statusFilter !== "all" ? `&status=${statusFilter}` : "";
  const empParam = empFilter !== "all" ? `&employeeId=${empFilter}` : "";
  const qk = `/api/leave-requests?_=1${statusParam}${empParam}`;

  const { data: requests = [], isLoading } = useQuery<LeaveRequest[]>({ queryKey: [qk] });
  const { data: employees = [] } = useQuery<Employee[]>({ queryKey: ["/api/employees"] });

  const empMap = useMemo(() => {
    const m: Record<number, Employee> = {};
    for (const e of employees) m[e.id] = e;
    return m;
  }, [employees]);

  const createMut = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/leave-requests", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [qk] });
      toast({ title: "Wniosek utworzony" });
      setAddOpen(false);
      resetForm();
    },
  });

  const approveMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PUT", `/api/leave-requests/${id}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [qk] });
      toast({ title: "Wniosek zaakceptowany" });
      setReviewOpen(false);
    },
  });

  const rejectMut = useMutation({
    mutationFn: async ({ id, comment }: { id: number; comment: string }) => {
      await apiRequest("PUT", `/api/leave-requests/${id}/reject`, { comment });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [qk] });
      toast({ title: "Wniosek odrzucony" });
      setReviewOpen(false);
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/leave-requests/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [qk] });
      toast({ title: "Wniosek usunięty" });
    },
  });

  function resetForm() {
    setFormEmpId("");
    setFormType("URLOP_WYPOCZYNKOWY");
    setFormStart("");
    setFormEnd("");
    setFormComment("");
  }

  function handleCreate() {
    if (!formEmpId || !formStart || !formEnd) return;
    const days = countWorkDays(formStart, formEnd);
    createMut.mutate({
      employeeId: Number(formEmpId),
      type: formType,
      startDate: formStart,
      endDate: formEnd,
      days,
      comment: formComment || null,
      status: "OCZEKUJACY",
    });
  }

  function openReview(req: LeaveRequest) {
    setReviewingRequest(req);
    setReviewComment(req.comment || "");
    setReviewOpen(true);
  }

  const pendingCount = requests.filter(r => r.status === "OCZEKUJACY").length;
  const approvedCount = requests.filter(r => r.status === "ZAAKCEPTOWANY").length;
  const totalDays = requests.filter(r => r.status === "ZAAKCEPTOWANY").reduce((s, r) => s + r.days, 0);

  const computedDays = formStart && formEnd && formEnd >= formStart ? countWorkDays(formStart, formEnd) : 0;

  if (isLoading) {
    return <div className="flex items-center justify-center p-8"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-md bg-amber-500/10">
              <AlertCircle className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Oczekujące</p>
              <p className="text-2xl font-bold" data-testid="text-pending-leaves">{pendingCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-md bg-emerald-500/10">
              <Check className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Zaakceptowane</p>
              <p className="text-2xl font-bold" data-testid="text-approved-leaves">{approvedCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-md bg-blue-500/10">
              <CalendarDays className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Dni urlopowych (zaakceptowane)</p>
              <p className="text-2xl font-bold" data-testid="text-total-leave-days">{totalDays}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie statusy</SelectItem>
              <SelectItem value="OCZEKUJACY">Oczekujące</SelectItem>
              <SelectItem value="ZAAKCEPTOWANY">Zaakceptowane</SelectItem>
              <SelectItem value="ODRZUCONY">Odrzucone</SelectItem>
            </SelectContent>
          </Select>
          <Select value={empFilter} onValueChange={setEmpFilter}>
            <SelectTrigger className="w-[200px]" data-testid="select-employee-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszyscy pracownicy</SelectItem>
              {employees.map((emp: Employee) => (
                <SelectItem key={emp.id} value={String(emp.id)}>
                  {emp.firstName} {emp.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { resetForm(); setAddOpen(true); }} data-testid="button-add-leave">
          <Plus className="h-4 w-4 mr-1" /> Dodaj wniosek
        </Button>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pracownik</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Od</TableHead>
              <TableHead>Do</TableHead>
              <TableHead className="text-center">Dni</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Komentarz</TableHead>
              <TableHead className="text-right">Akcje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Brak wniosków urlopowych
                </TableCell>
              </TableRow>
            )}
            {requests.map((req: LeaveRequest) => {
              const emp = empMap[req.employeeId];
              const typeLabel = LEAVE_TYPES.find(t => t.value === req.type)?.label || req.type;
              const statusInfo = STATUS_MAP[req.status] || { label: req.status, variant: "outline" as const };
              return (
                <TableRow key={req.id} data-testid={`row-leave-${req.id}`}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {emp ? `${emp.firstName} ${emp.lastName}` : `#${req.employeeId}`}
                  </TableCell>
                  <TableCell>{typeLabel}</TableCell>
                  <TableCell>{req.startDate}</TableCell>
                  <TableCell>{req.endDate}</TableCell>
                  <TableCell className="text-center">{req.days}</TableCell>
                  <TableCell>
                    <Badge variant={statusInfo.variant} data-testid={`badge-leave-status-${req.id}`}>
                      {statusInfo.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">{req.comment || "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {req.status === "OCZEKUJACY" && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openReview(req)}
                            data-testid={`button-review-leave-${req.id}`}
                          >
                            <Check className="h-4 w-4 text-emerald-600" />
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMut.mutate(req.id)}
                        disabled={deleteMut.isPending}
                        data-testid={`button-delete-leave-${req.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle data-testid="dialog-title-add-leave">Nowy wniosek urlopowy</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Pracownik</Label>
              <Select value={formEmpId} onValueChange={setFormEmpId}>
                <SelectTrigger data-testid="select-leave-employee">
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
              <Label>Typ</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger data-testid="select-leave-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Od</Label>
                <Input
                  type="date"
                  value={formStart}
                  onChange={e => setFormStart(e.target.value)}
                  data-testid="input-leave-start"
                />
              </div>
              <div>
                <Label>Do</Label>
                <Input
                  type="date"
                  value={formEnd}
                  onChange={e => setFormEnd(e.target.value)}
                  min={formStart}
                  data-testid="input-leave-end"
                />
              </div>
            </div>
            {computedDays > 0 && (
              <p className="text-sm text-muted-foreground">
                Dni roboczych: <strong>{computedDays}</strong>
              </p>
            )}
            <div>
              <Label>Komentarz</Label>
              <Textarea
                value={formComment}
                onChange={e => setFormComment(e.target.value)}
                placeholder="Opcjonalny komentarz..."
                data-testid="input-leave-comment"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} data-testid="button-cancel-leave">
              Anuluj
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMut.isPending || !formEmpId || !formStart || !formEnd || computedDays === 0}
              data-testid="button-save-leave"
            >
              Utwórz wniosek
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle data-testid="dialog-title-review-leave">Rozpatrz wniosek</DialogTitle>
          </DialogHeader>
          {reviewingRequest && (
            <div className="space-y-4">
              <div className="text-sm space-y-1">
                <p><strong>Pracownik:</strong> {empMap[reviewingRequest.employeeId]?.firstName} {empMap[reviewingRequest.employeeId]?.lastName}</p>
                <p><strong>Typ:</strong> {LEAVE_TYPES.find(t => t.value === reviewingRequest.type)?.label}</p>
                <p><strong>Okres:</strong> {reviewingRequest.startDate} — {reviewingRequest.endDate}</p>
                <p><strong>Dni roboczych:</strong> {reviewingRequest.days}</p>
                {reviewingRequest.comment && <p><strong>Komentarz:</strong> {reviewingRequest.comment}</p>}
              </div>
              <div>
                <Label>Komentarz admina</Label>
                <Textarea
                  value={reviewComment}
                  onChange={e => setReviewComment(e.target.value)}
                  placeholder="Opcjonalny komentarz..."
                  data-testid="input-review-comment"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReviewOpen(false)} data-testid="button-cancel-review">
              Anuluj
            </Button>
            <Button
              variant="destructive"
              onClick={() => reviewingRequest && rejectMut.mutate({ id: reviewingRequest.id, comment: reviewComment })}
              disabled={rejectMut.isPending}
              data-testid="button-reject-leave"
            >
              <X className="h-4 w-4 mr-1" /> Odrzuć
            </Button>
            <Button
              onClick={() => reviewingRequest && approveMut.mutate(reviewingRequest.id)}
              disabled={approveMut.isPending}
              data-testid="button-approve-leave"
            >
              <Check className="h-4 w-4 mr-1" /> Zaakceptuj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
