import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { recepcjaFetch } from "./RecepcjaApp";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Loader2, ChevronLeft, ChevronRight,
  ClipboardList, CheckCircle2, CircleDot, Clock, AlertTriangle,
  Trash2, Edit, MessageSquare, Send, User, Filter, Building2,
} from "lucide-react";
import type { Employee } from "@shared/schema";

type TaskItem = {
  id: number; title: string; description: string | null; date: string;
  startTime: string | null; endTime: string | null; status: string; priority: string;
  employeeId: number; apartmentId: number | null;
  actualStartTime: string | null; actualEndTime: string | null;
  mileageKm: string | null; notes: string | null; assignedById: number | null;
  source?: string;
};

type CommentItem = { id: number; taskId: number; authorId: number; authorName: string; content: string; createdAt: string };

type ApartmentItem = { id: number; name: string; location: string | null; active: boolean };

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  ZAPLANOWANE: { label: "Zaplanowane", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  W_TRAKCIE: { label: "W trakcie", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  ZAKONCZONE: { label: "Zakończone", color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  ANULOWANE: { label: "Anulowane", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
};

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  NISKI: { label: "Niski", color: "text-slate-500" },
  NORMALNY: { label: "Normalny", color: "text-blue-500" },
  WYSOKI: { label: "Wysoki", color: "text-orange-500" },
  PILNY: { label: "Pilny", color: "text-red-500" },
};

function formatDateShort(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}

export default function RecepcjaZadania() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [detailTask, setDetailTask] = useState<TaskItem | null>(null);
  const [newComment, setNewComment] = useState("");
  const { toast } = useToast();

  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formEmployee, setFormEmployee] = useState("");
  const [formDate, setFormDate] = useState(date);
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formPriority, setFormPriority] = useState("NORMALNY");
  const [formApartment, setFormApartment] = useState("");

  const employeesQuery = useQuery<Employee[]>({
    queryKey: ["/api/recepcja/rcp/employees"],
    queryFn: async () => {
      const res = await recepcjaFetch("GET", "/api/recepcja/rcp/employees");
      return res.json();
    },
  });

  const apartmentsQuery = useQuery<ApartmentItem[]>({
    queryKey: ["/api/recepcja/apartments"],
    queryFn: async () => {
      const res = await recepcjaFetch("GET", "/api/recepcja/apartments");
      return res.json();
    },
  });

  const activeEmployees = useMemo(() =>
    (employeesQuery.data || []).filter(e => e.status === "AKTYWNY"),
    [employeesQuery.data]
  );

  const activeApartments = useMemo(() =>
    (apartmentsQuery.data || []).filter(a => a.active).sort((a, b) => a.name.localeCompare(b.name)),
    [apartmentsQuery.data]
  );

  const tasksQuery = useQuery<TaskItem[]>({
    queryKey: ["/api/recepcja/tasks", date],
    queryFn: async () => {
      const res = await recepcjaFetch("GET", `/api/recepcja/tasks?date=${date}`);
      return res.json();
    },
  });

  const commentsQuery = useQuery<CommentItem[]>({
    queryKey: ["/api/recepcja/tasks", detailTask?.id, "comments"],
    enabled: !!detailTask,
    queryFn: async () => {
      const res = await recepcjaFetch("GET", `/api/recepcja/tasks/${detailTask!.id}/comments`);
      return res.json();
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await recepcjaFetch("POST", "/api/recepcja/tasks", data);
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/tasks"] });
      closeForm();
      toast({ title: "Zadanie utworzone" });
    },
    onError: (err: Error) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await recepcjaFetch("PUT", `/api/recepcja/tasks/${id}`, data);
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/tasks"] });
      closeForm();
      toast({ title: "Zadanie zaktualizowane" });
    },
    onError: (err: Error) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await recepcjaFetch("DELETE", `/api/recepcja/tasks/${id}`);
      if (!res.ok) throw new Error("Błąd usuwania");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/tasks"] });
      setDetailTask(null);
      toast({ title: "Zadanie usunięte" });
    },
    onError: (err: Error) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ taskId, content }: { taskId: number; content: string }) => {
      const res = await recepcjaFetch("POST", `/api/recepcja/tasks/${taskId}/comments`, { content });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/tasks", detailTask?.id, "comments"] });
      setNewComment("");
    },
    onError: (err: Error) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const closeForm = () => {
    setShowForm(false); setEditingTask(null);
    setFormTitle(""); setFormDesc(""); setFormEmployee(""); setFormStart(""); setFormEnd(""); setFormPriority("NORMALNY"); setFormApartment("");
  };

  const openCreateForm = () => {
    setEditingTask(null); setFormDate(date);
    setFormTitle(""); setFormDesc(""); setFormEmployee(""); setFormStart(""); setFormEnd(""); setFormPriority("NORMALNY"); setFormApartment("");
    setShowForm(true);
  };

  const openEditForm = (task: TaskItem) => {
    setEditingTask(task);
    setFormTitle(task.title); setFormDesc(task.description || ""); setFormEmployee(String(task.employeeId));
    setFormDate(task.date); setFormStart(task.startTime || ""); setFormEnd(task.endTime || ""); setFormPriority(task.priority);
    setFormApartment(task.apartmentId ? String(task.apartmentId) : "");
    setShowForm(true);
  };

  const applyPreset = (apt: ApartmentItem) => {
    setFormTitle(`Sprzątanie ${apt.name}`);
    setFormApartment(String(apt.id));
    setFormPriority("NORMALNY");
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle || !formEmployee || !formDate) return;
    const payload = {
      title: formTitle,
      description: formDesc || null,
      employeeId: Number(formEmployee),
      date: formDate,
      startTime: formStart || null,
      endTime: formEnd || null,
      priority: formPriority,
      status: editingTask?.status || "ZAPLANOWANE",
      apartmentId: formApartment && formApartment !== "none" ? Number(formApartment) : null,
      source: "RECEPCJA",
    };
    if (editingTask) {
      updateTaskMutation.mutate({ id: editingTask.id, ...payload });
    } else {
      createTaskMutation.mutate(payload);
    }
  };

  const changeDate = (delta: number) => {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().slice(0, 10));
  };

  const today = new Date().toISOString().slice(0, 10);
  const dateObj = new Date(date + "T12:00:00");
  const dayLabel = date === today ? "Dziś" : ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"][dateObj.getDay()];

  const filteredTasks = useMemo(() => {
    let tasks = tasksQuery.data || [];
    if (filterEmployee !== "all") tasks = tasks.filter(t => t.employeeId === Number(filterEmployee));
    if (filterStatus !== "all") tasks = tasks.filter(t => t.status === filterStatus);
    return tasks;
  }, [tasksQuery.data, filterEmployee, filterStatus]);

  const getEmployeeName = (empId: number) => {
    const emp = activeEmployees.find(e => e.id === empId);
    return emp ? `${emp.firstName} ${emp.lastName}` : `#${empId}`;
  };

  const getApartmentName = (aptId: number | null) => {
    if (!aptId) return null;
    const apt = activeApartments.find(a => a.id === aptId);
    return apt?.name || null;
  };

  const statusCounts = useMemo(() => {
    const tasks = tasksQuery.data || [];
    return {
      total: tasks.length,
      planned: tasks.filter(t => t.status === "ZAPLANOWANE").length,
      inProgress: tasks.filter(t => t.status === "W_TRAKCIE").length,
      done: tasks.filter(t => t.status === "ZAKONCZONE").length,
    };
  }, [tasksQuery.data]);

  const groupedByEmployee = useMemo(() => {
    const groups: Record<number, TaskItem[]> = {};
    filteredTasks.forEach(t => {
      (groups[t.employeeId] = groups[t.employeeId] || []).push(t);
    });
    return groups;
  }, [filteredTasks]);

  const etatEmployees = activeEmployees.filter(e => e.cooperationType === "ETAT");
  const hourlyEmployees = activeEmployees.filter(e => e.cooperationType === "PRACA_NA_H");

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold" data-testid="text-zadania-title">Zadania pracowników</h1>
          <p className="text-sm text-muted-foreground">Planowanie i śledzenie zadań</p>
        </div>
        <Button className="rounded-xl" onClick={openCreateForm} data-testid="button-create-task">
          <Plus className="h-4 w-4 mr-1" /> Nowe zadanie
        </Button>
      </div>

      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={() => changeDate(-1)} data-testid="button-prev-day"><ChevronLeft /></Button>
        <div className="text-center">
          <p className="font-semibold" data-testid="text-task-date">{dayLabel}</p>
          <p className="text-xs text-muted-foreground">{formatDateShort(date)}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => changeDate(1)} data-testid="button-next-day"><ChevronRight /></Button>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-4">
        <Card className="p-3 text-center rounded-xl" data-testid="card-stat-total">
          <p className="text-2xl font-bold">{statusCounts.total}</p>
          <p className="text-[10px] text-muted-foreground">Łącznie</p>
        </Card>
        <Card className="p-3 text-center rounded-xl" data-testid="card-stat-planned">
          <p className="text-2xl font-bold text-slate-500">{statusCounts.planned}</p>
          <p className="text-[10px] text-muted-foreground">Zaplanowane</p>
        </Card>
        <Card className="p-3 text-center rounded-xl" data-testid="card-stat-progress">
          <p className="text-2xl font-bold text-blue-500">{statusCounts.inProgress}</p>
          <p className="text-[10px] text-muted-foreground">W trakcie</p>
        </Card>
        <Card className="p-3 text-center rounded-xl" data-testid="card-stat-done">
          <p className="text-2xl font-bold text-green-500">{statusCounts.done}</p>
          <p className="text-[10px] text-muted-foreground">Zakończone</p>
        </Card>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <Select value={filterEmployee} onValueChange={setFilterEmployee}>
          <SelectTrigger className="w-40 rounded-xl text-xs" data-testid="select-filter-employee">
            <User className="h-3.5 w-3.5 mr-1" />
            <SelectValue placeholder="Pracownik" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszyscy</SelectItem>
            {etatEmployees.length > 0 && etatEmployees.map(e => (
              <SelectItem key={e.id} value={String(e.id)}>{e.firstName} {e.lastName}</SelectItem>
            ))}
            {hourlyEmployees.length > 0 && hourlyEmployees.map(e => (
              <SelectItem key={e.id} value={String(e.id)}>{e.firstName} {e.lastName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 rounded-xl text-xs" data-testid="select-filter-status">
            <Filter className="h-3.5 w-3.5 mr-1" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie</SelectItem>
            <SelectItem value="ZAPLANOWANE">Zaplanowane</SelectItem>
            <SelectItem value="W_TRAKCIE">W trakcie</SelectItem>
            <SelectItem value="ZAKONCZONE">Zakończone</SelectItem>
            <SelectItem value="ANULOWANE">Anulowane</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {tasksQuery.isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filteredTasks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12">
          <ClipboardList className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm" data-testid="text-no-tasks">Brak zadań na ten dzień</p>
          <Button variant="outline" className="rounded-xl" onClick={openCreateForm}>
            <Plus className="h-4 w-4 mr-1" /> Dodaj zadanie
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {Object.entries(groupedByEmployee).map(([empId, tasks]) => {
            const emp = activeEmployees.find(e => e.id === Number(empId));
            const isEtat = emp?.cooperationType === "ETAT";
            return (
              <div key={empId}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${isEtat ? "bg-blue-500" : "bg-orange-500"}`}>
                    {emp?.firstName?.charAt(0) || "?"}
                  </div>
                  <span className="font-medium text-sm">{getEmployeeName(Number(empId))}</span>
                  <Badge variant="outline" className={`text-[10px] rounded-full ${isEtat ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" : "bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"}`}>
                    {isEtat ? "Etat" : "Godziny"}
                  </Badge>
                  <span className="text-xs text-muted-foreground ml-auto">{tasks.length} zadań</span>
                </div>
                <div className="flex flex-col gap-2 pl-9">
                  {tasks.map(task => {
                    const st = STATUS_MAP[task.status] || STATUS_MAP.ZAPLANOWANE;
                    const pr = PRIORITY_MAP[task.priority] || PRIORITY_MAP.NORMALNY;
                    const aptName = getApartmentName(task.apartmentId);
                    const isWorkerEntry = task.source === "PRACOWNIK";
                    return (
                      <Card
                        key={task.id}
                        className="p-3 rounded-xl cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => setDetailTask(task)}
                        data-testid={`card-task-${task.id}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0">
                            {task.status === "ZAKONCZONE" ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                            ) : task.status === "W_TRAKCIE" ? (
                              <CircleDot className="h-4 w-4 text-blue-500 mt-0.5 shrink-0 animate-pulse" />
                            ) : (
                              <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{task.title}</p>
                              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                {aptName && (
                                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                    <Building2 className="h-3 w-3" />{aptName}
                                  </span>
                                )}
                                {task.startTime && (
                                  <span className="text-[10px] text-muted-foreground">{task.startTime}{task.endTime ? ` - ${task.endTime}` : ""}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {isWorkerEntry && (
                              <Badge variant="outline" className="text-[10px] rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" data-testid={`badge-source-worker-${task.id}`}>Zgłoszone</Badge>
                            )}
                            {task.priority === "PILNY" && <AlertTriangle className={`h-3.5 w-3.5 ${pr.color}`} />}
                            <Badge variant="outline" className={`text-[10px] rounded-full ${st.color}`}>{st.label}</Badge>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(v) => { if (!v) closeForm(); }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTask ? "Edytuj zadanie" : "Nowe zadanie"}</DialogTitle>
          </DialogHeader>

          {!editingTask && activeApartments.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Szybkie presety sprzątania:</p>
              <div className="flex flex-wrap gap-1.5">
                {activeApartments.slice(0, 12).map(apt => (
                  <button
                    key={apt.id}
                    type="button"
                    className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${
                      formApartment === String(apt.id) && formTitle.startsWith("Sprzątanie")
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/50 hover:bg-muted border-border"
                    }`}
                    onClick={() => applyPreset(apt)}
                    data-testid={`button-preset-${apt.id}`}
                  >
                    {apt.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmitForm} className="flex flex-col gap-3">
            <div><Label>Tytuł</Label><Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="np. Sprzątanie 204" data-testid="input-task-title" /></div>
            <div><Label>Opis (opcjonalnie)</Label><Textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="resize-none" rows={2} data-testid="input-task-desc" /></div>
            <div>
              <Label>Apartament (opcjonalnie)</Label>
              <Select value={formApartment} onValueChange={setFormApartment}>
                <SelectTrigger data-testid="select-task-apartment"><SelectValue placeholder="Wybierz apartament..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Brak —</SelectItem>
                  {activeApartments.map(a => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Pracownik</Label>
              <Select value={formEmployee} onValueChange={setFormEmployee}>
                <SelectTrigger data-testid="select-task-employee"><SelectValue placeholder="Wybierz..." /></SelectTrigger>
                <SelectContent>
                  {etatEmployees.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[10px] font-bold text-blue-500 uppercase">Etat</div>
                      {etatEmployees.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.firstName} {e.lastName}</SelectItem>)}
                    </>
                  )}
                  {hourlyEmployees.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[10px] font-bold text-orange-500 uppercase">Godziny</div>
                      {hourlyEmployees.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.firstName} {e.lastName}</SelectItem>)}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Data</Label><Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} data-testid="input-task-date" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Od</Label><Input type="time" value={formStart} onChange={(e) => setFormStart(e.target.value)} data-testid="input-task-start" /></div>
              <div><Label>Do</Label><Input type="time" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} data-testid="input-task-end" /></div>
            </div>
            <div>
              <Label>Priorytet</Label>
              <Select value={formPriority} onValueChange={setFormPriority}>
                <SelectTrigger data-testid="select-task-priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NISKI">Niski</SelectItem>
                  <SelectItem value="NORMALNY">Normalny</SelectItem>
                  <SelectItem value="WYSOKI">Wysoki</SelectItem>
                  <SelectItem value="PILNY">Pilny</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeForm}>Anuluj</Button>
              <Button type="submit" disabled={!formTitle || !formEmployee || createTaskMutation.isPending || updateTaskMutation.isPending} data-testid="button-submit-task">
                {(createTaskMutation.isPending || updateTaskMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : editingTask ? "Zapisz" : "Utwórz"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailTask} onOpenChange={(v) => { if (!v) setDetailTask(null); }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          {detailTask && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {detailTask.status === "ZAKONCZONE" ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : detailTask.status === "W_TRAKCIE" ? <CircleDot className="h-5 w-5 text-blue-500" /> : <Clock className="h-5 w-5 text-muted-foreground" />}
                  {detailTask.title}
                </DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={`rounded-full ${STATUS_MAP[detailTask.status]?.color || ""}`}>{STATUS_MAP[detailTask.status]?.label || detailTask.status}</Badge>
                  <Badge variant="outline" className={`rounded-full ${PRIORITY_MAP[detailTask.priority]?.color || ""}`}>{PRIORITY_MAP[detailTask.priority]?.label || detailTask.priority}</Badge>
                  <span className="text-xs text-muted-foreground">{getEmployeeName(detailTask.employeeId)}</span>
                  {detailTask.source === "PRACOWNIK" && (
                    <Badge variant="outline" className="text-[10px] rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">Zgłoszone przez pracownika</Badge>
                  )}
                </div>
                {getApartmentName(detailTask.apartmentId) && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                    {getApartmentName(detailTask.apartmentId)}
                  </div>
                )}
                {detailTask.description && <p className="text-sm text-muted-foreground">{detailTask.description}</p>}
                {detailTask.startTime && <p className="text-xs text-muted-foreground">Planowany: {detailTask.startTime}{detailTask.endTime ? ` - ${detailTask.endTime}` : ""}</p>}
                {detailTask.actualStartTime && <p className="text-xs text-muted-foreground">Rozpoczęto: {detailTask.actualStartTime}{detailTask.actualEndTime ? ` / Zakończono: ${detailTask.actualEndTime}` : ""}</p>}

                <div className="flex items-center gap-2">
                  <Select value={detailTask.status} onValueChange={(s) => {
                    updateTaskMutation.mutate({ id: detailTask.id, status: s });
                    setDetailTask({ ...detailTask, status: s });
                  }}>
                    <SelectTrigger className="w-40 rounded-xl text-xs" data-testid="select-detail-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ZAPLANOWANE">Zaplanowane</SelectItem>
                      <SelectItem value="W_TRAKCIE">W trakcie</SelectItem>
                      <SelectItem value="ZAKONCZONE">Zakończone</SelectItem>
                      <SelectItem value="ANULOWANE">Anulowane</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" className="rounded-xl" onClick={() => { openEditForm(detailTask); setDetailTask(null); }} data-testid="button-edit-task"><Edit className="h-3.5 w-3.5 mr-1" /> Edytuj</Button>
                  <Button variant="destructive" size="sm" className="rounded-xl" onClick={() => { if (window.confirm("Usunąć zadanie?")) deleteTaskMutation.mutate(detailTask.id); }} data-testid="button-delete-task"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>

                <div className="border-t pt-3">
                  <h4 className="text-sm font-semibold flex items-center gap-1 mb-2"><MessageSquare className="h-4 w-4" /> Komentarze</h4>
                  {commentsQuery.isLoading ? (
                    <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin" /></div>
                  ) : !commentsQuery.data?.length ? (
                    <p className="text-xs text-muted-foreground">Brak komentarzy</p>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
                      {commentsQuery.data.map(c => (
                        <div key={c.id} className="bg-muted/50 rounded-lg p-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium">{c.authorName}</span>
                            <span className="text-[10px] text-muted-foreground">{new Date(c.createdAt).toLocaleString("pl-PL")}</span>
                          </div>
                          <p className="text-xs mt-0.5">{c.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Dodaj komentarz..."
                      className="text-xs rounded-xl"
                      onKeyDown={(e) => { if (e.key === "Enter" && newComment.trim()) addCommentMutation.mutate({ taskId: detailTask.id, content: newComment.trim() }); }}
                      data-testid="input-comment"
                    />
                    <Button size="icon" className="rounded-xl shrink-0" onClick={() => { if (newComment.trim()) addCommentMutation.mutate({ taskId: detailTask.id, content: newComment.trim() }); }} disabled={!newComment.trim() || addCommentMutation.isPending} data-testid="button-send-comment">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
