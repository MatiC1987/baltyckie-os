import type { Express } from "express";
import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { db } from "./db";
import jwt from "jsonwebtoken";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import {
  recepcjaUsers, recepcjaAuditLog, tenantDataSubmissions,
  meterReadingsLog, subleaseChangeHistory, pushSubscriptions,
  saldoEntries, saldoInitialBalances, saldoCategories,
  subleases, subleasePayments, subleaseMeterReadings, subleaseMeterSettings,
  apartments, reservations, handoverProtocols, handoverProtocolRooms,
  handoverProtocolItems, handoverProtocolMeters, technicalInspections,
  costInvoices, accountingNotes, tasks as tasksTable, taskProjects, taskSections,
  taskChecklistItems, employees, timeEntries, workSchedules, leaveRequests, locations,
  insertSaldoEntrySchema, insertHandoverProtocolSchema, insertHandoverProtocolRoomSchema,
  insertHandoverProtocolItemSchema, insertHandoverProtocolMeterSchema,
  insertTenantDataSubmissionSchema, insertTaskProjectSchema, insertTaskSectionSchema,
  insertTaskSchema, insertTaskChecklistItemSchema, insertWorkScheduleSchema, insertLeaveRequestSchema,
} from "@shared/schema";
import bcrypt from "bcryptjs";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const JWT_SECRET = process.env.SESSION_SECRET || 'recepcja-jwt-secret-fallback';
const JWT_EXPIRES_IN = '24h';

function createRecepcjaToken(userId: number): string {
  return jwt.sign({ userId, type: 'recepcja' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function getRecepcjaUserId(req: any): number | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET) as { userId: number; type: string };
    if (decoded.type !== 'recepcja') return null;
    return decoded.userId;
  } catch {
    return null;
  }
}

async function isRecepcjaAuth(req: Request, res: Response, next: NextFunction) {
  const userId = getRecepcjaUserId(req);
  if (!userId) return res.status(401).json({ message: 'Brak autoryzacji' });
  const [user] = await db.select().from(recepcjaUsers).where(eq(recepcjaUsers.id, userId));
  if (!user || !user.active) return res.status(401).json({ message: 'Konto nieaktywne' });
  (req as any).recepcjaUser = user;
  next();
}

async function logRecepcjaAction(userId: number, action: string, entityType?: string, entityId?: string, details?: any) {
  try {
    await db.insert(recepcjaAuditLog).values({
      userId, action, entityType, entityId: entityId?.toString(),
      details: details ? details : null,
    });
  } catch (e) {
    console.error('[RECEPCJA AUDIT] Log error:', e);
  }
}

export function registerRecepcjaRoutes(app: Express) {

  // ==================== AUTH ====================
  app.post('/api/recepcja/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ message: 'Email i hasło są wymagane' });

      const [user] = await db.select().from(recepcjaUsers).where(eq(recepcjaUsers.email, email.toLowerCase().trim()));
      if (!user) return res.status(401).json({ message: 'Nieprawidłowy email lub hasło' });
      if (!user.active) return res.status(401).json({ message: 'Konto jest nieaktywne' });

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return res.status(401).json({ message: 'Nieprawidłowy email lub hasło' });

      const token = createRecepcjaToken(user.id);
      await logRecepcjaAction(user.id, 'LOGIN', 'auth', user.id.toString());

      res.json({
        user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl, role: user.role },
        token,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/recepcja/auth/user', isRecepcjaAuth as any, async (req: any, res) => {
    const u = req.recepcjaUser;
    res.json({ id: u.id, name: u.name, email: u.email, avatarUrl: u.avatarUrl, role: u.role });
  });

  app.post('/api/recepcja/logout', isRecepcjaAuth as any, async (req: any, res) => {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) recepcjaSessions.delete(auth.slice(7));
    res.json({ ok: true });
  });

  // ==================== SALDO (locked to Małgorzata Latasiewicz) ====================
  const RECEPCJA_PERSON = "Małgorzata Latasiewicz";

  app.get('/api/recepcja/saldo', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const entries = await db.select().from(saldoEntries)
        .where(eq(saldoEntries.personName, RECEPCJA_PERSON))
        .orderBy(desc(saldoEntries.date));
      res.json(entries);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post('/api/recepcja/saldo', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const data = { ...req.body, personName: RECEPCJA_PERSON };
      const entry = await storage.createSaldoEntry(data);
      await logRecepcjaAction(req.recepcjaUser.id, 'CREATE', 'saldo_entry', entry.id.toString(), data);
      res.json(entry);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.put('/api/recepcja/saldo/:id', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const [existing] = await db.select().from(saldoEntries).where(eq(saldoEntries.id, id));
      if (!existing || existing.personName !== RECEPCJA_PERSON) return res.status(403).json({ message: 'Brak dostępu' });
      const entry = await storage.updateSaldoEntry(id, req.body);
      await logRecepcjaAction(req.recepcjaUser.id, 'UPDATE', 'saldo_entry', id.toString(), req.body);
      res.json(entry);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete('/api/recepcja/saldo/:id', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const [existing] = await db.select().from(saldoEntries).where(eq(saldoEntries.id, id));
      if (!existing || existing.personName !== RECEPCJA_PERSON) return res.status(403).json({ message: 'Brak dostępu' });
      await storage.deleteSaldoEntry(id);
      await logRecepcjaAction(req.recepcjaUser.id, 'DELETE', 'saldo_entry', id.toString());
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get('/api/recepcja/saldo/initial-balance', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const [bal] = await db.select().from(saldoInitialBalances).where(eq(saldoInitialBalances.personName, RECEPCJA_PERSON));
      res.json(bal || { personName: RECEPCJA_PERSON, initialBalance: "0" });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.put('/api/recepcja/saldo/initial-balance', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const { initialBalance } = req.body;
      const result = await storage.upsertSaldoInitialBalance(RECEPCJA_PERSON, initialBalance);
      await logRecepcjaAction(req.recepcjaUser.id, 'UPDATE', 'saldo_initial_balance', RECEPCJA_PERSON, { initialBalance });
      res.json(result);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get('/api/recepcja/saldo/categories', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const cats = await db.select().from(saldoCategories).where(eq(saldoCategories.personName, RECEPCJA_PERSON));
      res.json(cats);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post('/api/recepcja/saldo/categories', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const { name } = req.body;
      const [cat] = await db.insert(saldoCategories).values({ personName: RECEPCJA_PERSON, name }).returning();
      await logRecepcjaAction(req.recepcjaUser.id, 'CREATE', 'saldo_category', cat.id.toString(), { name });
      res.json(cat);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ==================== PODNAJEM UMOWY (read-only) ====================
  app.get('/api/recepcja/subleases', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const all = await storage.getSubleases();
      res.json(all);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get('/api/recepcja/subleases/:id/payments', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const payments = await storage.getSubleasePayments(Number(req.params.id));
      res.json(payments);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ==================== PODNAJEM ROZLICZENIA (toggle paid/unpaid) ====================
  app.put('/api/recepcja/sublease-payments/:id/status', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const { status } = req.body;
      const updated = await storage.updateSubleasePayment(id, { status });
      await logRecepcjaAction(req.recepcjaUser.id, 'UPDATE', 'sublease_payment', id.toString(), { status });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ==================== TERMINARZ + REZERWACJE (read-only) ====================
  app.get('/api/recepcja/apartments', isRecepcjaAuth as any, async (req: any, res) => {
    try { res.json(await storage.getApartments()); }
    catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get('/api/recepcja/reservations', isRecepcjaAuth as any, async (req: any, res) => {
    try { res.json(await storage.getReservations()); }
    catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get('/api/recepcja/blockades', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const all = await db.select().from((await import("@shared/schema")).blockades);
      res.json(all);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ==================== PRZEGLĄDY (read-only) ====================
  app.get('/api/recepcja/technical-inspections', isRecepcjaAuth as any, async (req: any, res) => {
    try { res.json(await storage.getTechnicalInspections()); }
    catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ==================== DOKUMENTY KSIĘGOWE (upload) + NOTY (download) ====================
  app.get('/api/recepcja/cost-invoices', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const invoices = await db.select().from(costInvoices).orderBy(desc(costInvoices.createdAt));
      res.json(invoices);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post('/api/recepcja/cost-invoices/upload', isRecepcjaAuth as any, upload.single('file') as any, async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'Brak pliku' });
      const { objectStorage } = await import("./replit_integrations/object_storage");
      const uniqueId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      const ext = req.file.originalname.split('.').pop() || 'pdf';
      const objectPath = `private/cost-invoices/cost_invoice_${uniqueId}.${ext}`;
      await objectStorage.writeFile(objectPath, req.file.buffer);

      const dateMatch = req.file.originalname.match(/(\d{4})-(\d{2})-(\d{2})/);
      const invoiceDate = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : new Date().toISOString().slice(0, 10);
      const parts = invoiceDate.split('-');

      const [invoice] = await db.insert(costInvoices).values({
        originalFilename: req.file.originalname,
        objectPath,
        invoiceDate,
        invoiceMonth: Number(parts[1]),
        invoiceYear: Number(parts[0]),
        status: 'NOWA',
        uploadedBy: req.recepcjaUser.name,
      }).returning();

      await logRecepcjaAction(req.recepcjaUser.id, 'UPLOAD', 'cost_invoice', invoice.id.toString(), { filename: req.file.originalname });
      res.json(invoice);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get('/api/recepcja/accounting-notes', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const notes = await db.select().from(accountingNotes).orderBy(desc(accountingNotes.generatedAt));
      res.json(notes);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get('/api/recepcja/accounting-notes/:id/download', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const [note] = await db.select().from(accountingNotes).where(eq(accountingNotes.id, Number(req.params.id)));
      if (!note) return res.status(404).json({ message: 'Nie znaleziono' });
      const { objectStorage } = await import("./replit_integrations/object_storage");
      const buffer = await objectStorage.readFile(note.objectPath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${note.fileName}"`);
      res.send(buffer);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ==================== LICZNIKI (meter readings) ====================
  app.get('/api/recepcja/meter-subleases', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const all = await db.select().from(subleases).where(eq(subleases.mediaByMeters, true));
      const aptIds = [...new Set(all.map(s => s.apartmentId).filter(Boolean))];
      const apts = aptIds.length ? await db.select().from(apartments).where(sql`${apartments.id} IN (${sql.join(aptIds.map(id => sql`${id}`), sql`, `)})`) : [];
      const result = all.map(s => {
        const apt = apts.find(a => a.id === s.apartmentId);
        return { ...s, apartmentName: apt?.name || 'Nieznany' };
      });
      res.json(result);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get('/api/recepcja/meter-readings/:subleaseId', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const readings = await db.select().from(subleaseMeterReadings)
        .where(eq(subleaseMeterReadings.subleaseId, Number(req.params.subleaseId)))
        .orderBy(desc(subleaseMeterReadings.readingDate));
      const settings = await db.select().from(subleaseMeterSettings)
        .where(eq(subleaseMeterSettings.subleaseId, Number(req.params.subleaseId)));
      res.json({ readings, settings });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post('/api/recepcja/meter-readings', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const { subleaseId, meterType, readingDate, readingValue } = req.body;
      const [reading] = await db.insert(subleaseMeterReadings).values({
        subleaseId, meterType, readingDate, reading: readingValue,
      }).returning();
      await db.insert(meterReadingsLog).values({
        subleaseId, meterType, readingDate, readingValue,
        submittedBy: req.recepcjaUser.id,
      });
      await logRecepcjaAction(req.recepcjaUser.id, 'CREATE', 'meter_reading', reading.id.toString(), { subleaseId, meterType, readingValue });
      res.json(reading);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ==================== HANDOVER PROTOCOLS ====================
  app.get('/api/recepcja/handover-protocols', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const protocols = await storage.getHandoverProtocols(req.query.subleaseId ? Number(req.query.subleaseId) : undefined);
      res.json(protocols);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get('/api/recepcja/handover-protocols/:id', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const protocol = await storage.getHandoverProtocol(Number(req.params.id));
      if (!protocol) return res.status(404).json({ message: 'Nie znaleziono' });
      res.json(protocol);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post('/api/recepcja/handover-protocols', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const { rooms, items, meters, ...protocolData } = req.body;
      const protocol = await storage.createHandoverProtocol(protocolData);
      if (rooms?.length) {
        for (const room of rooms) {
          await storage.createHandoverProtocolRoom({ ...room, protocolId: protocol.id });
        }
      }
      if (items?.length) {
        for (const item of items) {
          await storage.createHandoverProtocolItem({ ...item, protocolId: protocol.id });
        }
      }
      if (meters?.length) {
        for (const meter of meters) {
          await storage.createHandoverProtocolMeter({ ...meter, protocolId: protocol.id });
        }
      }
      await logRecepcjaAction(req.recepcjaUser.id, 'CREATE', 'handover_protocol', protocol.id.toString());
      res.json(protocol);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ==================== TENANT DATA SUBMISSIONS ====================
  app.get('/api/recepcja/tenant-submissions', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const subs = await db.select().from(tenantDataSubmissions).orderBy(desc(tenantDataSubmissions.createdAt));
      res.json(subs);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post('/api/recepcja/tenant-submissions', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const [sub] = await db.insert(tenantDataSubmissions).values({
        ...req.body,
        submittedBy: req.recepcjaUser.id,
        status: 'NOWE',
      }).returning();
      await logRecepcjaAction(req.recepcjaUser.id, 'CREATE', 'tenant_submission', sub.id.toString(), req.body);
      res.json(sub);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get('/api/recepcja/tenant-submissions/:id/contract-pdf', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const [sub] = await db.select().from(tenantDataSubmissions).where(eq(tenantDataSubmissions.id, Number(req.params.id)));
      if (!sub || !sub.contractPdfPath) return res.status(404).json({ message: 'Umowa nie została jeszcze wygenerowana' });
      if (!['DO_PODPISANIA', 'UMOWA_WYGENEROWANA', 'PODPISANA_SKAN', 'ZATWIERDZONA'].includes(sub.status))
        return res.status(403).json({ message: 'Umowa nie jest dostępna do pobrania' });
      const { objectStorage } = await import("./replit_integrations/object_storage");
      const buffer = await objectStorage.readFile(sub.contractPdfPath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Umowa_${sub.tenantName.replace(/\s+/g, '_')}.pdf"`);
      res.send(buffer);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post('/api/recepcja/tenant-submissions/:id/upload-signed', isRecepcjaAuth as any, upload.single('file') as any, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      if (!req.file) return res.status(400).json({ message: 'Brak pliku' });
      const [sub] = await db.select().from(tenantDataSubmissions).where(eq(tenantDataSubmissions.id, id));
      if (!sub) return res.status(404).json({ message: 'Nie znaleziono' });

      const { objectStorage } = await import("./replit_integrations/object_storage");
      const uniqueId = Date.now().toString(36);
      const objectPath = `private/signed-contracts/signed_${uniqueId}.pdf`;
      await objectStorage.writeFile(objectPath, req.file.buffer);

      const [updated] = await db.update(tenantDataSubmissions)
        .set({ signedPdfPath: objectPath, status: 'PODPISANA_SKAN', updatedAt: new Date() })
        .where(eq(tenantDataSubmissions.id, id))
        .returning();

      await logRecepcjaAction(req.recepcjaUser.id, 'UPLOAD_SIGNED', 'tenant_submission', id.toString());
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ==================== TASKS ====================
  const RECEPCJA_VIRTUAL_USER_ID = 'recepcja-user';

  app.get('/api/recepcja/task-projects', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const projects = await db.select().from(taskProjects)
        .where(eq(taskProjects.userId, RECEPCJA_VIRTUAL_USER_ID));
      res.json(projects);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post('/api/recepcja/task-projects', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const [proj] = await db.insert(taskProjects).values({ ...req.body, userId: RECEPCJA_VIRTUAL_USER_ID }).returning();
      res.json(proj);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch('/api/recepcja/task-projects/:id', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const [proj] = await db.update(taskProjects).set(req.body).where(eq(taskProjects.id, Number(req.params.id))).returning();
      res.json(proj);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete('/api/recepcja/task-projects/:id', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      await db.delete(taskProjects).where(eq(taskProjects.id, Number(req.params.id)));
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get('/api/recepcja/task-sections', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const sections = await db.select().from(taskSections);
      res.json(sections);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post('/api/recepcja/task-sections', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const [sec] = await db.insert(taskSections).values(req.body).returning();
      res.json(sec);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get('/api/recepcja/tasks', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const ownTasks = await db.select().from(tasksTable).where(eq(tasksTable.userId, RECEPCJA_VIRTUAL_USER_ID));
      const allTasks = await db.select().from(tasksTable);
      const sharedWithMe = allTasks.filter(t =>
        t.sharedWith && Array.isArray(t.sharedWith) && t.sharedWith.includes(RECEPCJA_VIRTUAL_USER_ID)
      );
      const combined = [...ownTasks];
      for (const t of sharedWithMe) {
        if (!combined.find(c => c.id === t.id)) combined.push(t);
      }
      res.json(combined);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post('/api/recepcja/tasks', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const [task] = await db.insert(tasksTable).values({ ...req.body, userId: RECEPCJA_VIRTUAL_USER_ID }).returning();
      res.json(task);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch('/api/recepcja/tasks/:id', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const [task] = await db.update(tasksTable).set(req.body).where(eq(tasksTable.id, Number(req.params.id))).returning();
      res.json(task);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete('/api/recepcja/tasks/:id', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      await db.delete(tasksTable).where(eq(tasksTable.id, Number(req.params.id)));
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get('/api/recepcja/task-checklist/:taskId', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const items = await db.select().from(taskChecklistItems).where(eq(taskChecklistItems.taskId, Number(req.params.taskId)));
      res.json(items);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post('/api/recepcja/task-checklist', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const [item] = await db.insert(taskChecklistItems).values(req.body).returning();
      res.json(item);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ==================== RCP ADMIN ====================
  app.get('/api/recepcja/rcp/employees', isRecepcjaAuth as any, async (req: any, res) => {
    try { res.json(await storage.getEmployees()); }
    catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get('/api/recepcja/rcp/time-entries', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const { date, employeeId } = req.query;
      const entries = await storage.getTimeEntries(date as string, employeeId ? Number(employeeId) : undefined);
      res.json(entries);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.put('/api/recepcja/rcp/time-entries/:id', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const entry = await storage.updateTimeEntry(Number(req.params.id), req.body);
      await logRecepcjaAction(req.recepcjaUser.id, 'UPDATE', 'time_entry', req.params.id, req.body);
      res.json(entry);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get('/api/recepcja/rcp/work-schedules', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const { month, year } = req.query;
      const schedules = await storage.getWorkSchedules(Number(month), Number(year));
      res.json(schedules);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post('/api/recepcja/rcp/work-schedules', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const schedule = await storage.createWorkSchedule(req.body);
      await logRecepcjaAction(req.recepcjaUser.id, 'CREATE', 'work_schedule', schedule.id.toString(), req.body);
      res.json(schedule);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post('/api/recepcja/rcp/work-schedules/bulk', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const { schedules } = req.body;
      const created = [];
      for (const s of schedules) {
        const existing = await db.select().from(workSchedules)
          .where(and(eq(workSchedules.employeeId, s.employeeId), eq(workSchedules.date, s.date)));
        if (existing.length) {
          const [u] = await db.update(workSchedules).set(s).where(eq(workSchedules.id, existing[0].id)).returning();
          created.push(u);
        } else {
          const r = await storage.createWorkSchedule(s);
          created.push(r);
        }
      }
      await logRecepcjaAction(req.recepcjaUser.id, 'BULK_CREATE', 'work_schedules', '', { count: schedules.length });
      res.json(created);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.put('/api/recepcja/rcp/work-schedules/:id', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const schedule = await storage.updateWorkSchedule(Number(req.params.id), req.body);
      await logRecepcjaAction(req.recepcjaUser.id, 'UPDATE', 'work_schedule', req.params.id, req.body);
      res.json(schedule);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete('/api/recepcja/rcp/work-schedules/:id', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      await storage.deleteWorkSchedule(Number(req.params.id));
      await logRecepcjaAction(req.recepcjaUser.id, 'DELETE', 'work_schedule', req.params.id);
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get('/api/recepcja/rcp/leave-requests', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const requests = await storage.getLeaveRequests(req.query);
      res.json(requests);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post('/api/recepcja/rcp/leave-requests', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const request = await storage.createLeaveRequest(req.body);
      await logRecepcjaAction(req.recepcjaUser.id, 'CREATE', 'leave_request', request.id.toString(), req.body);
      res.json(request);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.put('/api/recepcja/rcp/leave-requests/:id/approve', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const [updated] = await db.update(leaveRequests)
        .set({ status: 'ZAAKCEPTOWANY', reviewedBy: req.recepcjaUser.name, reviewedAt: new Date() })
        .where(eq(leaveRequests.id, Number(req.params.id))).returning();
      await logRecepcjaAction(req.recepcjaUser.id, 'APPROVE', 'leave_request', req.params.id);
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.put('/api/recepcja/rcp/leave-requests/:id/reject', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const [updated] = await db.update(leaveRequests)
        .set({ status: 'ODRZUCONY', reviewedBy: req.recepcjaUser.name, reviewedAt: new Date() })
        .where(eq(leaveRequests.id, Number(req.params.id))).returning();
      await logRecepcjaAction(req.recepcjaUser.id, 'REJECT', 'leave_request', req.params.id);
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get('/api/recepcja/rcp/report', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const { employeeId, month, year } = req.query;
      const entries = await storage.getTimeEntriesForMonth(Number(employeeId), Number(month), Number(year));
      res.json(entries);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get('/api/recepcja/rcp/leave-balance', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const { year } = req.query;
      const emps = await storage.getEmployees();
      const reqs = await storage.getLeaveRequests({});
      const balance = emps.map(e => {
        const empReqs = reqs.filter((r: any) => r.employeeId === e.id && r.startDate?.startsWith(String(year)));
        const used = empReqs.filter((r: any) => r.status === 'ZAAKCEPTOWANY').reduce((s: number, r: any) => s + (r.days || 0), 0);
        const pending = empReqs.filter((r: any) => r.status === 'OCZEKUJACY').reduce((s: number, r: any) => s + (r.days || 0), 0);
        return { employeeId: e.id, employeeName: `${e.firstName} ${e.lastName}`, allocated: 26, used, pending, remaining: 26 - used };
      });
      res.json(balance);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get('/api/recepcja/rcp/locations', isRecepcjaAuth as any, async (req: any, res) => {
    try { res.json(await storage.getLocations()); }
    catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.put('/api/recepcja/rcp/locations/:id', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const loc = await storage.updateLocation(Number(req.params.id), req.body);
      await logRecepcjaAction(req.recepcjaUser.id, 'UPDATE', 'location', req.params.id, req.body);
      res.json(loc);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get('/api/recepcja/rcp/employees-pins', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const emps = await storage.getEmployees();
      res.json(emps.map(e => ({ id: e.id, firstName: e.firstName, lastName: e.lastName, pin: e.pin ? '••••••' : null })));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.put('/api/recepcja/rcp/employees/:id/pin', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const { pin } = req.body;
      const emp = await storage.updateEmployee(Number(req.params.id), { pin });
      await logRecepcjaAction(req.recepcjaUser.id, 'SET_PIN', 'employee', req.params.id);
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ==================== KONTAKTY NAJEMCÓW ====================
  app.get('/api/recepcja/tenant-contacts', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const activeSubleases = await db.select().from(subleases)
        .where(and(lte(subleases.startDate, today), gte(subleases.endDate, today)));
      const apts = await storage.getApartments();
      const contacts = activeSubleases.map(s => ({
        id: s.id,
        tenantName: s.tenantType === 'company' ? s.companyName : `${s.firstName || ''} ${s.lastName || ''}`.trim(),
        phone: s.phone,
        email: s.email,
        apartmentName: apts.find(a => a.id === s.apartmentId)?.name || 'Nieznany',
        startDate: s.startDate,
        endDate: s.endDate,
      }));
      res.json(contacts);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ==================== SUBLEASE CHANGE HISTORY ====================
  app.get('/api/recepcja/sublease-history', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const history = await db.select().from(subleaseChangeHistory)
        .orderBy(desc(subleaseChangeHistory.createdAt));
      res.json(history);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ==================== DASHBOARD ====================
  app.get('/api/recepcja/dashboard', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const today = new Date().toISOString().slice(0, 10);

      const allReservations = await storage.getReservations();
      const todayArrivals = allReservations.filter(r => r.startDate === today && r.status !== 'ANULOWANA');
      const todayDepartures = allReservations.filter(r => r.endDate === today && r.status !== 'ANULOWANA');

      const allPayments = await db.select().from(subleasePayments);
      const overduePayments = allPayments.filter(p =>
        p.status === 'do_oplacenia' && p.dueDate && p.dueDate < today
      );

      const myTasks = await db.select().from(tasksTable)
        .where(eq(tasksTable.userId, RECEPCJA_VIRTUAL_USER_ID));
      const todayTasks = myTasks.filter(t => t.dueDate === today && !t.completed);

      const submissions = await db.select().from(tenantDataSubmissions);
      const pendingSubmissions = submissions.filter(s => ['NOWE', 'DO_PODPISANIA'].includes(s.status));

      res.json({
        todayArrivals: todayArrivals.length,
        todayDepartures: todayDepartures.length,
        overduePayments: overduePayments.length,
        todayTasks: todayTasks.length,
        pendingSubmissions: pendingSubmissions.length,
        arrivals: todayArrivals.slice(0, 10),
        departures: todayDepartures.slice(0, 10),
      });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ==================== DAILY REPORT ====================
  app.get('/api/recepcja/daily-report', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);

      const allReservations = await storage.getReservations();
      const arrivals = allReservations.filter(r => r.startDate === date && r.status !== 'ANULOWANA');
      const departures = allReservations.filter(r => r.endDate === date && r.status !== 'ANULOWANA');

      const payments = await db.select().from(subleasePayments);
      const paidToday = payments.filter(p => p.paidDate === date);

      const readings = await db.select().from(meterReadingsLog).where(eq(meterReadingsLog.readingDate, date));

      const myTasks = await db.select().from(tasksTable).where(eq(tasksTable.userId, RECEPCJA_VIRTUAL_USER_ID));
      const completedToday = myTasks.filter(t => t.completed && t.dueDate === date);

      const timeEntriesDay = await storage.getTimeEntries(date);

      res.json({
        date,
        arrivals,
        departures,
        paidToday,
        meterReadings: readings,
        completedTasks: completedToday,
        timeEntries: timeEntriesDay,
      });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ==================== ADMIN ENDPOINTS (for main app) ====================
  app.get('/api/tenant-submissions', async (req, res) => {
    try {
      const subs = await db.select().from(tenantDataSubmissions).orderBy(desc(tenantDataSubmissions.createdAt));
      res.json(subs);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.put('/api/tenant-submissions/:id/approve', async (req, res) => {
    try {
      const [updated] = await db.update(tenantDataSubmissions)
        .set({ status: 'ZATWIERDZONA', updatedAt: new Date() })
        .where(eq(tenantDataSubmissions.id, Number(req.params.id)))
        .returning();
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.put('/api/tenant-submissions/:id/status', async (req, res) => {
    try {
      const { status, contractPdfPath } = req.body;
      const update: any = { status, updatedAt: new Date() };
      if (contractPdfPath) update.contractPdfPath = contractPdfPath;
      const [updated] = await db.update(tenantDataSubmissions)
        .set(update)
        .where(eq(tenantDataSubmissions.id, Number(req.params.id)))
        .returning();
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ==================== RECEPCJA AUDIT LOG (admin only, not visible to recepcja) ====================
  app.get('/api/recepcja-audit-log', async (req, res) => {
    try {
      const logs = await db.select().from(recepcjaAuditLog).orderBy(desc(recepcjaAuditLog.createdAt)).limit(500);
      res.json(logs);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
}

// Seed Małgorzata's account on startup
export async function seedRecepcjaUser() {
  try {
    const [existing] = await db.select().from(recepcjaUsers).where(eq(recepcjaUsers.email, 'gosia@baltyckie.pl'));
    if (!existing) {
      const hash = await bcrypt.hash('Recepcja2025!', 10);
      await db.insert(recepcjaUsers).values({
        name: 'Małgorzata Latasiewicz',
        email: 'gosia@baltyckie.pl',
        passwordHash: hash,
        role: 'kierownik_recepcji',
      });
      console.log('[RECEPCJA] Seeded default user: gosia@baltyckie.pl');
    }
  } catch (e) {
    console.error('[RECEPCJA] Seed error:', e);
  }
}