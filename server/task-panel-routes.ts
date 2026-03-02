import type { Express } from "express";
import type { Request, Response, NextFunction } from "express";
import { db } from "./db";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { eq, or, sql } from "drizzle-orm";
import {
  taskPanelUsers, tasks as tasksTable, taskProjects, taskSections,
  taskChecklistItems, employees,
} from "@shared/schema";

function getJwtSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('[TASK-PANEL] SESSION_SECRET is required for JWT authentication');
  return secret;
}

const JWT_EXPIRES_IN = '24h';

function createTaskPanelToken(userId: number): string {
  return jwt.sign({ userId, type: 'task-panel' }, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

function getTaskPanelUserId(req: any): number | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(auth.slice(7), getJwtSecret()) as { userId: number; type: string };
    if (decoded.type !== 'task-panel') return null;
    return decoded.userId;
  } catch {
    return null;
  }
}

async function isTaskPanelAuth(req: Request, res: Response, next: NextFunction) {
  const userId = getTaskPanelUserId(req);
  if (!userId) return res.status(401).json({ message: 'Brak autoryzacji' });
  const [user] = await db.select().from(taskPanelUsers).where(eq(taskPanelUsers.id, userId));
  if (!user || !user.active) return res.status(401).json({ message: 'Konto nieaktywne' });
  if (user.employeeId === null) return res.status(403).json({ message: 'Konto nie jest powiązane z pracownikiem' });
  (req as any).taskPanelUser = user;
  next();
}

function getEmployeeVirtualId(employeeId: number): string {
  return `employee-${employeeId}`;
}

export function registerTaskPanelRoutes(app: Express) {

  app.post('/api/task-panel/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ message: 'Email i hasło są wymagane' });

      const [user] = await db.select().from(taskPanelUsers).where(eq(taskPanelUsers.email, email.toLowerCase().trim()));
      if (!user) return res.status(401).json({ message: 'Nieprawidłowy email lub hasło' });
      if (!user.active) return res.status(401).json({ message: 'Konto jest nieaktywne' });

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return res.status(401).json({ message: 'Nieprawidłowy email lub hasło' });
      if (user.employeeId === null) return res.status(403).json({ message: 'Konto nie jest powiązane z pracownikiem. Skontaktuj się z administratorem.' });

      const token = createTaskPanelToken(user.id);

      res.json({
        user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, employeeId: user.employeeId, isAdmin: user.isAdmin },
        token,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/task-panel/auth/user', isTaskPanelAuth as any, async (req: any, res) => {
    const u = req.taskPanelUser;
    res.json({ id: u.id, name: u.name, email: u.email, avatarUrl: u.avatarUrl, employeeId: u.employeeId, isAdmin: u.isAdmin });
  });

  app.post('/api/task-panel/logout', isTaskPanelAuth as any, async (_req: any, res) => {
    res.json({ ok: true });
  });

  app.get('/api/task-panel/tasks', isTaskPanelAuth as any, async (req: any, res) => {
    try {
      const user = req.taskPanelUser;
      if (user.isAdmin) {
        const allTasks = await db.select().from(tasksTable);
        return res.json(allTasks);
      }
      const virtualId = getEmployeeVirtualId(user.employeeId);
      const allTasks = await db.select().from(tasksTable).where(
        or(
          eq(tasksTable.userId, virtualId),
          sql`${virtualId} = ANY(${tasksTable.sharedWith})`
        )
      );
      res.json(allTasks);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/task-panel/projects', isTaskPanelAuth as any, async (_req: any, res) => {
    try {
      const allProjects = await db.select().from(taskProjects);
      res.json(allProjects);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/task-panel/sections', isTaskPanelAuth as any, async (_req: any, res) => {
    try {
      const allSections = await db.select().from(taskSections);
      res.json(allSections);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/task-panel/tasks', isTaskPanelAuth as any, async (req: any, res) => {
    try {
      const user = req.taskPanelUser;
      const virtualId = getEmployeeVirtualId(user.employeeId);
      const data = { ...req.body, userId: virtualId };
      const [task] = await db.insert(tasksTable).values(data).returning();
      res.json(task);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch('/api/task-panel/tasks/:id', isTaskPanelAuth as any, async (req: any, res) => {
    try {
      const user = req.taskPanelUser;
      const virtualId = getEmployeeVirtualId(user.employeeId);
      const taskId = Number(req.params.id);
      const [existing] = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId));
      if (!existing) return res.status(404).json({ message: 'Zadanie nie znalezione' });
      if (!user.isAdmin && existing.userId !== virtualId && !(existing.sharedWith || []).includes(virtualId)) {
        return res.status(403).json({ message: 'Brak dostępu' });
      }
      const updates: Record<string, any> = {};
      const allowedFields = ['title', 'notes', 'completed', 'completedAt', 'priority', 'dueDate', 'dueTime', 'tags', 'evening', 'someday', 'deadlineDate', 'recurring', 'sortOrder', 'projectId', 'sectionId', 'sharedWith'];
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      }
      if (updates.completed === true && !updates.completedAt) updates.completedAt = new Date();
      if (updates.completed === false) updates.completedAt = null;
      const [updated] = await db.update(tasksTable).set(updates).where(eq(tasksTable.id, taskId)).returning();
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete('/api/task-panel/tasks/:id', isTaskPanelAuth as any, async (req: any, res) => {
    try {
      const user = req.taskPanelUser;
      const virtualId = getEmployeeVirtualId(user.employeeId);
      const taskId = Number(req.params.id);
      const [existing] = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId));
      if (!existing) return res.status(404).json({ message: 'Zadanie nie znalezione' });
      if (!user.isAdmin && existing.userId !== virtualId) {
        return res.status(403).json({ message: 'Brak dostępu do usunięcia' });
      }
      await db.delete(taskChecklistItems).where(eq(taskChecklistItems.taskId, taskId));
      await db.delete(tasksTable).where(eq(tasksTable.id, taskId));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  async function verifyTaskAccess(user: any, taskId: number): Promise<boolean> {
    if (user.isAdmin) return true;
    const virtualId = getEmployeeVirtualId(user.employeeId);
    const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId));
    if (!task) return false;
    return task.userId === virtualId || (task.sharedWith || []).includes(virtualId);
  }

  app.get('/api/task-panel/checklist/:taskId', isTaskPanelAuth as any, async (req: any, res) => {
    try {
      const taskId = Number(req.params.taskId);
      if (!(await verifyTaskAccess(req.taskPanelUser, taskId))) {
        return res.status(403).json({ message: 'Brak dostępu' });
      }
      const items = await db.select().from(taskChecklistItems).where(eq(taskChecklistItems.taskId, taskId));
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/task-panel/checklist', isTaskPanelAuth as any, async (req: any, res) => {
    try {
      const taskId = req.body.taskId;
      if (!taskId || !(await verifyTaskAccess(req.taskPanelUser, taskId))) {
        return res.status(403).json({ message: 'Brak dostępu' });
      }
      const [item] = await db.insert(taskChecklistItems).values({
        taskId: req.body.taskId,
        title: req.body.title,
        completed: req.body.completed ?? false,
        sortOrder: req.body.sortOrder ?? 0,
      }).returning();
      res.json(item);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch('/api/task-panel/checklist/:id', isTaskPanelAuth as any, async (req: any, res) => {
    try {
      const [existing] = await db.select().from(taskChecklistItems).where(eq(taskChecklistItems.id, Number(req.params.id)));
      if (!existing || !(await verifyTaskAccess(req.taskPanelUser, existing.taskId))) {
        return res.status(403).json({ message: 'Brak dostępu' });
      }
      const updates: Record<string, any> = {};
      if (req.body.title !== undefined) updates.title = req.body.title;
      if (req.body.completed !== undefined) updates.completed = req.body.completed;
      if (req.body.sortOrder !== undefined) updates.sortOrder = req.body.sortOrder;
      const [updated] = await db.update(taskChecklistItems).set(updates).where(eq(taskChecklistItems.id, Number(req.params.id))).returning();
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });
}

export async function seedTaskPanelUser() {
  try {
    await db.execute(sql`ALTER TABLE task_panel_users ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false`);

    const [existing] = await db.select().from(taskPanelUsers).where(eq(taskPanelUsers.email, 'jan@baltyckie.pl'));
    if (!existing) {
      const hash = await bcrypt.hash('Zadania2025!', 10);
      let employeeId: number | null = null;
      const [emp] = await db.select().from(employees).limit(1);
      if (emp) employeeId = emp.id;
      await db.insert(taskPanelUsers).values({
        name: 'Jan Kowalski',
        email: 'jan@baltyckie.pl',
        passwordHash: hash,
        employeeId,
        active: true,
      });
      console.log('[TASK-PANEL] Seeded default user: jan@baltyckie.pl / Zadania2025!');
    }

    const [existingAdmin] = await db.select().from(taskPanelUsers).where(eq(taskPanelUsers.email, 'mateusz.cieslak@baltyckie.pl'));
    if (!existingAdmin) {
      let mcEmployeeId: number | null = null;
      const allEmps = await db.select().from(employees);
      const mcEmp = allEmps.find((e: any) => e.firstName === 'Mateusz' && e.lastName === 'Cieślak');
      if (mcEmp) {
        mcEmployeeId = mcEmp.id;
      } else {
        const [newEmp] = await db.insert(employees).values({
          firstName: 'Mateusz',
          lastName: 'Cieślak',
          cooperationType: 'ETAT',
          contractType: 'CZAS_NIEOKRESLONY',
          position: 'ZARZADCA',
          status: 'AKTYWNY',
        }).returning();
        mcEmployeeId = newEmp.id;
      }
      const hash = await bcrypt.hash('BaltFin2025!MC', 10);
      await db.insert(taskPanelUsers).values({
        name: 'Mateusz Cieślak',
        email: 'mateusz.cieslak@baltyckie.pl',
        passwordHash: hash,
        employeeId: mcEmployeeId,
        active: true,
        isAdmin: true,
      });
      console.log('[TASK-PANEL] Seeded admin user: mateusz.cieslak@baltyckie.pl / BaltFin2025!MC');
    }
  } catch (e) {
    console.error('[TASK-PANEL] Seed error:', e);
  }
}
