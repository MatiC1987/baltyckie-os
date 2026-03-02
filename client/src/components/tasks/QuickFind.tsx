import { memo, useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { Task, TaskProject } from "@shared/schema";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, FileText, FolderOpen, Tag, Check } from "lucide-react";
import type { ViewType } from "./taskUtils";

interface QuickFindProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  projects: TaskProject[];
  onSelectTask: (task: Task) => void;
  onSelectProject: (projectId: number) => void;
}

interface SearchResult {
  type: "task" | "project" | "tag";
  id: string;
  title: string;
  subtitle?: string;
  score: number;
  task?: Task;
  projectId?: number;
  tag?: string;
}

export const QuickFind = memo(function QuickFind({
  open,
  onOpenChange,
  tasks,
  projects,
  onSelectTask,
  onSelectProject,
}: QuickFindProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const items: SearchResult[] = [];

    tasks.forEach(t => {
      let score = 0;
      if (t.title.toLowerCase().includes(q)) score += 10;
      if (t.notes?.toLowerCase().includes(q)) score += 3;
      if (t.tags?.some(tag => tag.toLowerCase().includes(q))) score += 5;
      if (score > 0) {
        items.push({
          type: "task",
          id: `task-${t.id}`,
          title: t.title,
          subtitle: t.completed ? "Ukończone" : t.dueDate || undefined,
          score,
          task: t,
        });
      }
    });

    projects.forEach(p => {
      if (p.name.toLowerCase().includes(q)) {
        items.push({
          type: "project",
          id: `project-${p.id}`,
          title: p.name,
          subtitle: `${tasks.filter(t => t.projectId === p.id && !t.completed).length} zadań`,
          score: 8,
          projectId: p.id,
        });
      }
    });

    const allTags = new Set<string>();
    tasks.forEach(t => t.tags?.forEach(tag => allTags.add(tag)));
    allTags.forEach(tag => {
      if (tag.toLowerCase().includes(q)) {
        items.push({
          type: "tag",
          id: `tag-${tag}`,
          title: tag,
          subtitle: `${tasks.filter(t => t.tags?.includes(tag)).length} zadań`,
          score: 6,
          tag,
        });
      }
    });

    return items.sort((a, b) => b.score - a.score).slice(0, 20);
  }, [query, tasks, projects]);

  const handleSelect = useCallback((result: SearchResult) => {
    if (result.type === "task" && result.task) {
      onSelectTask(result.task);
    } else if (result.type === "project" && result.projectId) {
      onSelectProject(result.projectId);
    }
    onOpenChange(false);
  }, [onSelectTask, onSelectProject, onOpenChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    }
    if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    }
  }, [results, selectedIndex, handleSelect]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const iconForType = (type: string) => {
    if (type === "task") return FileText;
    if (type === "project") return FolderOpen;
    return Tag;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden" data-testid="dialog-quick-find">
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Szukaj zadań, projektów, tagów..."
            className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 text-sm h-auto py-0"
            data-testid="input-quick-find"
          />
        </div>
        {results.length > 0 && (
          <div className="max-h-[400px] overflow-y-auto py-1">
            {results.map((result, i) => {
              const Icon = iconForType(result.type);
              return (
                <button
                  key={result.id}
                  className={`flex items-center gap-3 w-full px-4 py-2.5 text-left text-sm transition-colors ${
                    i === selectedIndex ? "bg-primary/5" : "hover:bg-muted/30"
                  }`}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  data-testid={`quick-find-result-${result.id}`}
                >
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{result.title}</div>
                    {result.subtitle && (
                      <div className="text-[11px] text-muted-foreground truncate">{result.subtitle}</div>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground/50 uppercase">
                    {result.type === "task" ? "Zadanie" : result.type === "project" ? "Projekt" : "Tag"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {query && results.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground/50">
            Brak wyników dla "{query}"
          </div>
        )}
        {!query && (
          <div className="py-8 text-center text-sm text-muted-foreground/40">
            Zacznij pisać aby wyszukać...
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
});
