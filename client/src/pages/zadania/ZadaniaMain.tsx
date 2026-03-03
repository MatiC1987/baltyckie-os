import { useZadaniaAuth } from "./ZadaniaApp";
import { ZadaniaTasksApiProvider } from "@/lib/tasksApiContext";
import { TasksCore } from "@/pages/Tasks";

export default function ZadaniaMain() {
  const { user, logout } = useZadaniaAuth();

  if (!user) return null;

  const virtualUserId = user.employeeId ? `employee-${user.employeeId}` : String(user.id);

  return (
    <ZadaniaTasksApiProvider userId={virtualUserId} onLogout={logout}>
      <TasksCore />
    </ZadaniaTasksApiProvider>
  );
}
