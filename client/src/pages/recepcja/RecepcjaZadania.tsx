import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { recepcjaFetch } from "./RecepcjaApp";
import { queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CheckSquare, Plus, Loader2, Calendar, Trash2 } from "lucide-react";

const PRIORITY_LABELS: Record<string, string> = {
  PILNY: "Pilny", WYSOKI: "Wysoki", SREDNI: "Średni", NISKI: "Niski", BRAK: "Brak",
};
const PRIORITY_COLORS: Record<string, string> = {
  PILNY: "text-red-600", WYSOKI: "text-orange-600", SREDNI: "text-yellow-600", NISKI: "text-blue-600", BRAK: "text-muted-foreground",
};

export default function RecepcjaZadania() {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<"all" | "today" | "done">("all");

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["/api/recepcja/tasks"],
    queryFn: async () => { const r = await recepcjaFetch("GET", "/api/recepcja/tasks"); return r.json(); },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await recepcjaFetch("POST", "/api/recepcja/tasks", data);
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/tasks"] });
      setShowAdd(false);
      toast({ title: "Dodano zadanie" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: number; completed: boolean }) => {
      const r = await recepcjaFetch("PATCH", `/api/recepcja/tasks/${id}`, { completed });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/recepcja/tasks"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await recepcjaFetch("DELETE", `/api/recepcja/tasks/${id}`);
      if (!r.ok) throw new Error((await r.json()).message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/tasks"] });
      toast({ title: "Usunięto zadanie" });
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  let filtered = tasks;
  if (filter === "today") filtered = tasks.filter((t: any) => t.dueDate === today && !t.completed);
  if (filter === "done") filtered = tasks.filter((t: any) => t.completed);
  if (filter === "all") filtered = tasks.filter((t: any) => !t.completed);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-zadania-title">Zadania</h1>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-task">
          <Plus className="h-4 w-4 mr-1" /> Nowe zadanie
        </Button>
      </div>

      <div className="flex gap-2">
        <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>Do zrobienia</Button>
        <Button variant={filter === "today" ? "default" : "outline"} size="sm" onClick={() => setFilter("today")}>Na dziś</Button>
        <Button variant={filter === "done" ? "default" : "outline"} size="sm" onClick={() => setFilter("done")}>Wykonane</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t: any) => (
            <Card key={t.id} className="p-3 flex items-start gap-3">
              <Checkbox
                checked={t.completed}
                onCheckedChange={(checked) => toggleMutation.mutate({ id: t.id, completed: !!checked })}
                className="mt-0.5"
                data-testid={`checkbox-task-${t.id}`}
              />
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${t.completed ? 'line-through text-muted-foreground' : ''}`}>{t.title}</div>
                {t.notes && <div className="text-xs text-muted-foreground mt-0.5">{t.notes}</div>}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {t.priority && t.priority !== 'BRAK' && (
                    <span className={`text-[10px] font-medium ${PRIORITY_COLORS[t.priority]}`}>
                      {PRIORITY_LABELS[t.priority]}
                    </span>
                  )}
                  {t.dueDate && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <Calendar className="h-2.5 w-2.5" /> {t.dueDate}
                    </span>
                  )}
                  {t.userId !== 'recepcja-user' && <Badge variant="outline" className="text-[10px] h-4">Przydzielone</Badge>}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive flex-shrink-0" onClick={() => deleteMutation.mutate(t.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </Card>
          ))}
          {filtered.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground">Brak zadań</Card>
          )}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nowe zadanie</DialogTitle></DialogHeader>
          <TaskForm onSubmit={(data) => createMutation.mutate(data)} isPending={createMutation.isPending} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TaskForm({ onSubmit, isPending }: any) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState("BRAK");
  const [dueDate, setDueDate] = useState("");

  return (
    <div className="space-y-3">
      <div className="space-y-1"><Label>Tytuł *</Label><Input value={title} onChange={e => setTitle(e.target.value)} data-testid="input-task-title" /></div>
      <div className="space-y-1"><Label>Opis</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} data-testid="input-task-notes" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Priorytet</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger data-testid="select-task-priority"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(PRIORITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label>Termin</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} data-testid="input-task-due" /></div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSubmit({ title, notes, priority, dueDate: dueDate || null })} disabled={isPending || !title} data-testid="button-save-task">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
          Dodaj
        </Button>
      </DialogFooter>
    </div>
  );
}