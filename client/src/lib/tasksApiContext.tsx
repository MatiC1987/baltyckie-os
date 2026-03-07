import { createContext, useContext, useMemo } from "react";
import { QueryClient, QueryClientProvider, QueryFunction } from "@tanstack/react-query";
import { apiRequest as defaultApiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

interface TasksApiContextValue {
  apiRequest: (method: string, url: string, data?: unknown) => Promise<Response>;
  currentUser: { id: string } | null;
  isZadaniaPanel?: boolean;
  onLogout?: () => void;
}

const TasksApiContext = createContext<TasksApiContextValue>({
  apiRequest: defaultApiRequest,
  currentUser: null,
});

export function useTasksApi() {
  return useContext(TasksApiContext);
}

export function DefaultTasksApiProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const value = useMemo<TasksApiContextValue>(() => ({
    apiRequest: defaultApiRequest,
    currentUser: user ? { id: user.id } : null,
  }), [user]);

  return (
    <TasksApiContext.Provider value={value}>
      {children}
    </TasksApiContext.Provider>
  );
}

const ZADANIA_URL_MAP: Record<string, string> = {
  "/api/tasks": "/api/task-panel/tasks",
  "/api/task-projects": "/api/task-panel/projects",
  "/api/task-sections": "/api/task-panel/sections",
  "/api/all-users": "/api/task-panel/users",
};

function mapZadaniaUrl(url: string): string {
  for (const [from, to] of Object.entries(ZADANIA_URL_MAP)) {
    if (url === from) return to;
    if (url.startsWith(from + "/")) return to + url.slice(from.length);
  }
  if (url.startsWith("/api/task-checklist")) {
    return url.replace("/api/task-checklist", "/api/task-panel/checklist");
  }
  if (url.startsWith("/api/task-comments")) {
    return url.replace("/api/task-comments", "/api/task-panel/comments");
  }
  if (url.startsWith("/api/task-templates")) {
    return url.replace("/api/task-templates", "/api/task-panel/templates");
  }
  if (url.startsWith("/api/task-template-items")) {
    return url.replace("/api/task-template-items", "/api/task-panel/template-items");
  }
  if (url === "/api/employees" || url.startsWith("/api/employees/")) {
    return url.replace("/api/employees", "/api/task-panel/employees");
  }
  return url;
}

function zadaniaApiFetch(method: string, url: string, data?: unknown): Promise<Response> {
  const mappedUrl = mapZadaniaUrl(url);
  const token = localStorage.getItem("zadania_token");
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (data) headers["Content-Type"] = "application/json";

  return fetch(mappedUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  }).then(async (res) => {
    if (!res.ok) {
      const text = (await res.text()) || res.statusText;
      throw new Error(`${res.status}: ${text}`);
    }
    return res;
  });
}

const zadaniaQueryFn: QueryFunction = async ({ queryKey }) => {
  const url = queryKey[0] as string;
  const mappedUrl = mapZadaniaUrl(url);
  const fullUrl = queryKey.length > 1 ? `${mappedUrl}/${queryKey.slice(1).join("/")}` : mappedUrl;
  const token = localStorage.getItem("zadania_token");
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(fullUrl, { headers });
  if (res.status === 401) {
    localStorage.removeItem("zadania_token");
    window.location.reload();
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
};

export function ZadaniaTasksApiProvider({
  children,
  userId,
  onLogout,
}: {
  children: React.ReactNode;
  userId: string;
  onLogout: () => void;
}) {
  const zadaniaQueryClient = useMemo(() => new QueryClient({
    defaultOptions: {
      queries: {
        queryFn: zadaniaQueryFn,
        refetchInterval: false,
        refetchOnWindowFocus: false,
        staleTime: 60 * 1000,
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  }), []);

  const value = useMemo<TasksApiContextValue>(() => ({
    apiRequest: zadaniaApiFetch,
    currentUser: { id: userId },
    isZadaniaPanel: true,
    onLogout,
  }), [userId, onLogout]);

  return (
    <QueryClientProvider client={zadaniaQueryClient}>
      <TasksApiContext.Provider value={value}>
        {children}
      </TasksApiContext.Provider>
    </QueryClientProvider>
  );
}
