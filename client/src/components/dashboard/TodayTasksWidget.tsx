import { useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Target } from "lucide-react";
import { format } from "date-fns";

const PRIORITY_COLORS: Record<string, string> = {
  PILNY: "text-red-500",
  WYSOKI: "text-orange-500",
  ŚREDNI: "text-yellow-500",
  NISKI: "text-blue-400",
};

export function TodayTasksWidget() {
  const today = format(new Date(), "yyyy-MM-dd");
  const { data: allTasks } = useQuery<any[]>({ queryKey: ["/api/tasks"] });
  const [, setLocation] = useLocation();

  const todayTasks = useMemo(() => {
    if (!allTasks) return [];
    return allTasks.filter((t: any) => t.dueDate === today && !t.completed);
  }, [allTasks, today]);

  const overdueTasks = useMemo(() => {
    if (!allTasks) return [];
    return allTasks.filter((t: any) => t.dueDate && t.dueDate < today && !t.completed);
  }, [allTasks, today]);

  const toggleTask = useMutation({
    mutationFn: async (task: any) => {
      await apiRequest("PATCH", `/api/tasks/${task.id}`, { completed: !task.completed });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }),
  });

  return (
    <Card data-testid="today-tasks-widget">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Zadania na dziś
            {todayTasks.length > 0 && (
              <Badge variant="secondary" className="ml-1">{todayTasks.length}</Badge>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setLocation("/tasks")} data-testid="link-all-tasks">
            Wszystkie
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {overdueTasks.length > 0 && (
          <div className="mb-3 p-2 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">
              Zaległe ({overdueTasks.length})
            </p>
            {overdueTasks.slice(0, 3).map((task: any) => (
              <div key={task.id} className="flex items-center gap-2 py-1">
                <button
                  className="h-4 w-4 rounded border border-red-300 flex-shrink-0"
                  onClick={() => toggleTask.mutate(task)}
                  data-testid={`toggle-overdue-task-${task.id}`}
                />
                <span className="text-sm text-red-700 dark:text-red-300 truncate">{task.title}</span>
                <span className="text-xs text-red-400 ml-auto whitespace-nowrap">{task.dueDate}</span>
              </div>
            ))}
          </div>
        )}
        {todayTasks.length === 0 && overdueTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-tasks-today">Brak zadań na dziś</p>
        ) : (
          <div className="space-y-1">
            {todayTasks.map((task: any) => (
              <div key={task.id} className="flex items-center gap-2 py-1.5 px-1 rounded hover:bg-muted/50" data-testid={`today-task-${task.id}`}>
                <button
                  className="h-4 w-4 rounded border border-border flex-shrink-0"
                  onClick={() => toggleTask.mutate(task)}
                  data-testid={`toggle-today-task-${task.id}`}
                />
                <span className="text-sm truncate flex-1">{task.title}</span>
                {task.priority && (
                  <span className={`text-[10px] font-medium ${PRIORITY_COLORS[task.priority] || "text-muted-foreground"}`}>
                    {task.priority}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
