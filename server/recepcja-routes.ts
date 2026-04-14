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
  mediaSettlementReports,
  apartments, reservations, handoverProtocols, handoverProtocolRooms,
  handoverProtocolItems, handoverProtocolMeters, technicalInspections,
  costInvoices, accountingNotes, employees, timeEntries, workSchedules, leaveRequests, locations,
  issues, locationLogs, appConfig, insertIssueSchema,
  insertSaldoEntrySchema, insertHandoverProtocolSchema, insertHandoverProtocolRoomSchema,
  insertHandoverProtocolItemSchema, insertHandoverProtocolMeterSchema,
  insertTenantDataSubmissionSchema,
  insertWorkScheduleSchema, insertLeaveRequestSchema,
  employeeTasks, insertEmployeeTaskSchema, taskComments, insertTaskCommentSchema,
  taskCategories, insertTaskCategorySchema,
  mileageEntries, insertMileageEntrySchema, scheduleTemplates, insertScheduleTemplateSchema,
  insertEmployeeSchema,
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
      const parsed = insertSaldoEntrySchema.parse(req.body);
      const data = { ...parsed, personName: RECEPCJA_PERSON, createdBy: req.recepcjaUser.name };
      const entry = await storage.createSaldoEntry(data);
      await logRecepcjaAction(req.recepcjaUser.id, 'CREATE', 'saldo_entry', entry.id.toString(), data);
      res.json(entry);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.put('/api/recepcja/saldo/:id', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const [existing] = await db.select().from(saldoEntries).where(eq(saldoEntries.id, id));
      if (!existing || existing.personName !== RECEPCJA_PERSON) return res.status(403).json({ message: 'Brak dostępu' });
      const parsed = insertSaldoEntrySchema.partial().parse(req.body);
      const entry = await storage.updateSaldoEntry(id, parsed);
      await logRecepcjaAction(req.recepcjaUser.id, 'UPDATE', 'saldo_entry', id.toString(), parsed);
      res.json(entry);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
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
      res.json(cats.map(c => ({ ...c, type: c.type || 'KOSZT' })));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post('/api/recepcja/saldo/categories', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const { name: rawName, type } = req.body;
      if (!rawName || typeof rawName !== 'string' || !rawName.trim()) return res.status(400).json({ message: "Podaj nazwę kategorii" });
      const name = rawName.trim();
      const validType = type === 'PRZYCHOD' ? 'PRZYCHOD' : 'KOSZT';
      const existing = await db.select().from(saldoCategories).where(and(eq(saldoCategories.personName, RECEPCJA_PERSON), eq(saldoCategories.name, name)));
      if (existing.length > 0) return res.status(400).json({ message: `Kategoria "${name}" już istnieje` });
      const [cat] = await db.insert(saldoCategories).values({ personName: RECEPCJA_PERSON, name, type: validType }).returning();
      await logRecepcjaAction(req.recepcjaUser.id, 'CREATE', 'saldo_category', cat.id.toString(), { name, type });
      res.json(cat);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.put('/api/recepcja/saldo/categories/:name', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const { newName, type } = req.body;
      if (!newName || typeof newName !== 'string') return res.status(400).json({ message: "Podaj nową nazwę kategorii" });
      const validType = type === 'PRZYCHOD' ? 'PRZYCHOD' : type === 'KOSZT' ? 'KOSZT' : undefined;
      await storage.updateSaldoCategory(req.params.name, newName.trim(), RECEPCJA_PERSON, validType);
      await logRecepcjaAction(req.recepcjaUser.id, 'UPDATE', 'saldo_category', req.params.name, { newName: newName.trim(), type: validType });
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete('/api/recepcja/saldo/categories/:name', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      await storage.deleteSaldoCategory(req.params.name, RECEPCJA_PERSON);
      await logRecepcjaAction(req.recepcjaUser.id, 'DELETE', 'saldo_category', req.params.name);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post('/api/recepcja/saldo/categories/bulk-delete', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const { names } = req.body;
      if (!Array.isArray(names) || names.length === 0) return res.status(400).json({ message: "Podaj listę kategorii do usunięcia" });
      for (const name of names) {
        await storage.deleteSaldoCategory(name, RECEPCJA_PERSON);
      }
      await logRecepcjaAction(req.recepcjaUser.id, 'DELETE', 'saldo_categories_bulk', names.join(','), { names });
      res.json({ success: true, deleted: names.length });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get('/api/recepcja/reservations/by-number/:number', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const reservation = await storage.getReservationByNumber(req.params.number);
      if (!reservation) return res.status(404).json({ message: "Nie znaleziono rezerwacji" });
      let apartmentNames: string[] = [];
      if (reservation.apartmentId) {
        const apt = await storage.getApartment(reservation.apartmentId);
        if (apt) apartmentNames.push(apt.name);
      }
      if (reservation.apartmentIds && reservation.apartmentIds.length > 0) {
        for (const aid of reservation.apartmentIds) {
          if (aid && aid !== reservation.apartmentId) {
            const apt = await storage.getApartment(aid);
            if (apt) apartmentNames.push(apt.name);
          }
        }
      }
      res.json({
        guestName: reservation.guestName,
        apartmentNames,
        reservationNumber: reservation.reservationNumber,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
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
      const invoices = await db.select().from(costInvoices).orderBy(desc(costInvoices.uploadedAt));
      res.json(invoices);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post('/api/recepcja/cost-invoices/upload', isRecepcjaAuth as any, upload.single('file') as any, async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'Brak pliku' });
      const allowedMimes = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
      if (!allowedMimes.includes(req.file.mimetype)) {
        return res.status(400).json({ message: "Dozwolone formaty: PDF, PNG, JPG, WEBP" });
      }

      const { ObjectStorageService, objectStorageClient: osStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
      const osService = new ObjectStorageService();
      const privateDir = osService.getPrivateObjectDir();

      const uniqueId = Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      const ext = req.file.originalname.split('.').pop() || 'pdf';
      const storedName = `cost_invoice_${uniqueId}.${ext}`;
      const storagePath = `${privateDir}/cost-invoices/${storedName}`;
      const parsedPath = (() => {
        const p = storagePath.startsWith("/") ? storagePath.slice(1) : storagePath;
        const parts = p.split("/");
        return { bucketName: parts[0], objectName: parts.slice(1).join("/") };
      })();

      const storageFile = osStorageClient.bucket(parsedPath.bucketName).file(parsedPath.objectName);
      await storageFile.save(req.file.buffer, { contentType: req.file.mimetype });

      let invoiceDate = req.body.invoiceDate;
      if (!invoiceDate) {
        const dateMatch = req.file.originalname.match(/(\d{4})[_\-.](\d{2})[_\-.](\d{2})/);
        if (dateMatch) {
          invoiceDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
        } else {
          const dateMatch2 = req.file.originalname.match(/(\d{2})[_\-.](\d{2})[_\-.](\d{4})/);
          if (dateMatch2) {
            invoiceDate = `${dateMatch2[3]}-${dateMatch2[2]}-${dateMatch2[1]}`;
          } else {
            invoiceDate = new Date().toISOString().slice(0, 10);
          }
        }
      }

      const d = new Date(invoiceDate);
      const invoiceMonth = d.getMonth() + 1;
      const invoiceYear = d.getFullYear();

      const [invoice] = await db.insert(costInvoices).values({
        fileName: storedName,
        originalFileName: req.file.originalname,
        mimeType: req.file.mimetype || 'application/pdf',
        objectStoragePath: storagePath,
        invoiceDate,
        invoiceMonth,
        invoiceYear,
        comment: req.body.comment || null,
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
      const { objectStorageClient: osStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
      const parsedPath = (() => {
        const p = note.objectPath.startsWith("/") ? note.objectPath.slice(1) : note.objectPath;
        const parts = p.split("/");
        return { bucketName: parts[0], objectName: parts.slice(1).join("/") };
      })();
      const storageFile = osStorageClient.bucket(parsedPath.bucketName).file(parsedPath.objectName);
      const [fileBuffer] = await storageFile.download();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${note.fileName}"`);
      res.send(fileBuffer);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ==================== NOTIFICATIONS (recepcja) ====================
  app.get('/api/recepcja/notifications', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const notifs = await storage.getNotifications("recepcja");
      res.json(notifs);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get('/api/recepcja/notifications/unread-count', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const unread = await storage.getUnreadNotifications("recepcja");
      res.json({ count: unread.length });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch('/api/recepcja/notifications/:id/read', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      await storage.markNotificationRead(Number(req.params.id));
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post('/api/recepcja/notifications/read-all', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const unread = await storage.getUnreadNotifications("recepcja");
      for (const n of unread) {
        await storage.markNotificationRead(n.id);
      }
      res.json({ success: true });
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
        subleaseId, meterType, readingDate, reading: readingValue, status: "pending",
      }).returning();
      await db.insert(meterReadingsLog).values({
        subleaseId, meterType, readingDate, readingValue,
        submittedBy: req.recepcjaUser.id,
      });
      await logRecepcjaAction(req.recepcjaUser.id, 'CREATE', 'meter_reading', reading.id.toString(), { subleaseId, meterType, readingValue });

      const sublease = await storage.getSublease(subleaseId);
      const apts = await storage.getApartments();
      const apt = apts.find(a => a.id === sublease?.apartmentId);
      const aptName = apt?.name || "Nieznany";
      const meterLabel = meterType === "electricity" ? "prąd" : meterType === "cold_water" ? "zimna woda" : "ciepła woda";
      await storage.createNotification({
        type: "meter_reading_pending",
        title: "Nowy odczyt licznika do weryfikacji",
        message: `${aptName}: ${meterLabel} — odczyt ${readingValue} (${readingDate})`,
        entityType: "meter_reading",
        entityId: reading.id,
        isRead: false,
        targetPanel: null,
      });

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


  // ==================== RCP ADMIN ====================
  app.get('/api/recepcja/rcp/employees', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const all = await storage.getEmployees();
      res.json(all.filter((e: any) => !e.hideFromRcp));
    }
    catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get('/api/recepcja/rcp/time-entries', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const { date, employeeId } = req.query;
      const entries = await storage.getTimeEntries(date as string, employeeId ? Number(employeeId) : undefined);
      const allEmps = await storage.getEmployees();
      const hiddenIds = new Set(allEmps.filter((e: any) => e.hideFromRcp).map((e: any) => e.id));
      res.json(entries.filter((e: any) => !hiddenIds.has(e.employeeId)));
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
      const { month, year, from, to, employeeId, locationId } = req.query;
      if (from && to) {
        const schedules = await storage.getWorkSchedules({
          from: from as string,
          to: to as string,
          employeeId: employeeId ? Number(employeeId) : undefined,
          locationId: locationId ? Number(locationId) : undefined,
        });
        res.json(schedules);
      } else if (month && year) {
        const m = Number(month);
        const y = Number(year);
        const daysInMonth = new Date(y, m, 0).getDate();
        const fromDate = `${y}-${String(m).padStart(2, "0")}-01`;
        const toDate = `${y}-${String(m).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
        const schedules = await storage.getWorkSchedules({ from: fromDate, to: toDate });
        res.json(schedules);
      } else {
        const schedules = await storage.getWorkSchedules();
        res.json(schedules);
      }
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
      const { schedules, deleteFrom, deleteTo, deleteEmployeeId } = req.body;
      if (deleteFrom && deleteTo) {
        const existing = await storage.getWorkSchedules({
          from: deleteFrom,
          to: deleteTo,
          employeeId: deleteEmployeeId || undefined,
        });
        for (const s of existing) {
          await storage.deleteWorkSchedule(s.id);
        }
      }
      const created = await storage.createWorkSchedulesBulk(schedules || []);
      await logRecepcjaAction(req.recepcjaUser.id, 'BULK_CREATE', 'work_schedules', '', { count: (schedules || []).length, deleteFrom, deleteTo });
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
      const allEmps = await storage.getEmployees();
      const emps = allEmps.filter((e: any) => !e.hideFromRcp);
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

  app.put('/api/recepcja/rcp/locations/:id/gps', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const { latitude, longitude, gpsRadius } = req.body;
      if (latitude === undefined || latitude === null || latitude === '' ||
          longitude === undefined || longitude === null || longitude === '') {
        return res.status(400).json({ message: "Szerokość i długość geograficzna są wymagane" });
      }
      const lat = Number(latitude);
      const lng = Number(longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({ message: "Nieprawidłowe współrzędne GPS" });
      }
      const radius = Number(gpsRadius);
      const validRadius = Number.isFinite(radius) ? radius : 200;
      if (validRadius < 10 || validRadius > 5000) {
        return res.status(400).json({ message: "Promień musi być między 10 a 5000 metrów" });
      }
      const loc = await storage.updateLocationGps(Number(req.params.id), lat.toString(), lng.toString(), validRadius);
      if (!loc) {
        return res.status(404).json({ message: "Lokalizacja nie została znaleziona" });
      }
      await logRecepcjaAction(req.recepcjaUser.id, 'UPDATE_GPS', 'location', req.params.id, { latitude, longitude, gpsRadius: validRadius });
      res.json(loc);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get('/api/recepcja/rcp/location-logs', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const { employeeId, date } = req.query;
      if (!employeeId || !date) return res.status(400).json({ message: 'Wymagane employeeId i date' });
      const empId = Number(employeeId);
      if (!Number.isInteger(empId) || empId <= 0) return res.status(400).json({ message: 'Nieprawidłowe employeeId' });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return res.status(400).json({ message: 'Nieprawidłowy format daty (YYYY-MM-DD)' });

      const dayStart = new Date(`${date}T00:00:00`);
      const dayEnd = new Date(`${date}T23:59:59`);
      if (isNaN(dayStart.getTime())) return res.status(400).json({ message: 'Nieprawidłowa data' });

      const logs = await db.select({
        log: locationLogs,
        locationName: locations.name,
      }).from(locationLogs)
        .leftJoin(locations, eq(locationLogs.locationId, locations.id))
        .where(and(
          eq(locationLogs.employeeId, empId),
          gte(locationLogs.timestamp, dayStart),
          lte(locationLogs.timestamp, dayEnd),
        ))
        .orderBy(locationLogs.timestamp);

      res.json(logs.map(r => ({ ...r.log, locationName: r.locationName })));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get('/api/recepcja/rcp/location-logs/summary', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const { date } = req.query;
      if (!date) return res.status(400).json({ message: 'Wymagane date' });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return res.status(400).json({ message: 'Nieprawidłowy format daty (YYYY-MM-DD)' });

      const dayStart = new Date(`${date}T00:00:00`);
      const dayEnd = new Date(`${date}T23:59:59`);
      if (isNaN(dayStart.getTime())) return res.status(400).json({ message: 'Nieprawidłowa data' });

      const allLogs = await db.select({
        log: locationLogs,
        hideFromRcp: employees.hideFromRcp,
      })
        .from(locationLogs)
        .leftJoin(employees, eq(locationLogs.employeeId, employees.id))
        .where(and(
          gte(locationLogs.timestamp, dayStart),
          lte(locationLogs.timestamp, dayEnd),
        ));

      const visibleLogs = allLogs.filter(r => !r.hideFromRcp);
      const uniqueEmployees = new Set(visibleLogs.map(r => r.log.employeeId));
      const outsideZone = visibleLogs.filter(r => r.log.distanceFromZone && parseFloat(r.log.distanceFromZone) > 0).length;

      res.json({
        totalEmployees: uniqueEmployees.size,
        totalLogs: visibleLogs.length,
        outsideZone,
      });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get('/api/recepcja/rcp/location-logs/per-employee', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const { date } = req.query;
      if (!date) return res.status(400).json({ message: 'Wymagane date' });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return res.status(400).json({ message: 'Nieprawidłowy format daty (YYYY-MM-DD)' });

      const dayStart = new Date(`${date}T00:00:00`);
      const dayEnd = new Date(`${date}T23:59:59`);
      if (isNaN(dayStart.getTime())) return res.status(400).json({ message: 'Nieprawidłowa data' });

      const allLogs = await db.select({
        log: locationLogs,
        firstName: employees.firstName,
        lastName: employees.lastName,
        hideFromRcp: employees.hideFromRcp,
      }).from(locationLogs)
        .leftJoin(employees, eq(locationLogs.employeeId, employees.id))
        .where(and(
          gte(locationLogs.timestamp, dayStart),
          lte(locationLogs.timestamp, dayEnd),
        ))
        .orderBy(locationLogs.timestamp);

      const byEmployee = new Map<number, any>();
      for (const row of allLogs) {
        if (row.hideFromRcp) continue;
        const empId = row.log.employeeId;
        if (!byEmployee.has(empId)) {
          byEmployee.set(empId, {
            employeeId: empId,
            firstName: row.firstName || '',
            lastName: row.lastName || '',
            logCount: 0,
            lastLat: null,
            lastLng: null,
            lastTimestamp: null,
            isOutsideZone: false,
          });
        }
        const entry = byEmployee.get(empId);
        entry.logCount++;
        entry.lastLat = row.log.latitude;
        entry.lastLng = row.log.longitude;
        entry.lastTimestamp = row.log.timestamp;
        const dist = row.log.distanceFromZone ? parseFloat(row.log.distanceFromZone) : null;
        entry.isOutsideZone = dist !== null && dist > 0;
      }

      res.json(Array.from(byEmployee.values()));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get('/api/recepcja/rcp/employees-pins', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const emps = await storage.getEmployees();
      res.json(emps.filter((e: any) => !e.hideFromRcp).map(e => ({ id: e.id, firstName: e.firstName, lastName: e.lastName, pin: e.pin ? '••••••' : null })));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get('/api/recepcja/rcp/employees/:id/pin', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const emp = await storage.getEmployee(Number(req.params.id));
      if (!emp) return res.status(404).json({ message: "Nie znaleziono pracownika" });
      res.json({ pin: emp.pin || null });
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

  app.post('/api/recepcja/rcp/employees', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const data = insertEmployeeSchema.parse({
        ...req.body,
        cooperationType: "PRACA_NA_H",
        status: "AKTYWNY",
      });
      const emp = await storage.createEmployee(data);
      await logRecepcjaAction(req.recepcjaUser.id, 'CREATE_EMPLOYEE', 'employee', String(emp.id));
      res.status(201).json(emp);
    } catch (err: any) { res.status(400).json({ message: err.message || "Błąd walidacji" }); }
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

  // ==================== MEDIA SETTLEMENTS ====================
  app.get('/api/recepcja/media-settlements', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const reports = await db.select().from(mediaSettlementReports).orderBy(desc(mediaSettlementReports.generatedAt));
      const allSubleases = await db.select().from(subleases);
      const allApartments = await db.select().from(apartments);
      const notes = await db.select().from(accountingNotes);
      const aptMap = new Map(allApartments.map(a => [a.id, a.name || `#${a.id}`]));
      const subleaseMap = new Map(allSubleases.map(s => [s.id, s]));
      const noteByReport = new Map(notes.map(n => [n.reportId, n]));

      const result = reports.map(r => {
        const sub = subleaseMap.get(r.subleaseId);
        const tenantName = sub ? (sub.companyName || `${sub.firstName || ''} ${sub.lastName || ''}`.trim()) : '—';
        const aptName = sub?.apartmentId ? (aptMap.get(sub.apartmentId) || `#${sub.apartmentId}`) : '—';
        const note = noteByReport.get(r.id);
        return {
          ...r,
          tenantName,
          apartmentName: aptName,
          noteNumber: note?.noteNumber || null,
          noteId: note?.id || null,
        };
      });
      res.json(result);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.put('/api/recepcja/media-settlements/:id/payment', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const { paymentStatus, paidDate, paymentMethod } = req.body;
      if (!paymentStatus || !['NIEOPLACONE', 'OPLACONE'].includes(paymentStatus)) {
        return res.status(400).json({ message: 'Nieprawidłowy status' });
      }
      const updated = await storage.updateMediaSettlementReportStatus(id, paymentStatus, paidDate, paymentMethod);
      await logRecepcjaAction(req.recepcjaUser.id, 'UPDATE', 'media_settlement_report', id.toString(), { paymentStatus, paidDate, paymentMethod });
      res.json(updated);
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

      const submissions = await db.select().from(tenantDataSubmissions);
      const pendingSubmissions = submissions.filter(s => ['NOWE', 'DO_PODPISANIA'].includes(s.status));

      const openIssues = await db.select({ count: sql<number>`count(*)::int` }).from(issues)
        .where(sql`${issues.status} IN ('OTWARTE', 'W_REALIZACJI')`);
      const openIssuesCount = openIssues[0]?.count || 0;

      const allSettlementReports = await db.select().from(mediaSettlementReports);
      const unpaidReports = allSettlementReports.filter(r => r.paymentStatus === 'NIEOPLACONE');
      const allSubleases = await db.select().from(subleases);
      const allApartments = await db.select().from(apartments);
      const aptMap = new Map(allApartments.map(a => [a.id, a.name || `#${a.id}`]));
      const subleaseMap = new Map(allSubleases.map(s => [s.id, s]));

      const allNotes = await db.select().from(accountingNotes);
      const noteByReport = new Map(allNotes.map(n => [n.reportId, n]));

      const unpaidMediaList = unpaidReports.map(r => {
        const sub = subleaseMap.get(r.subleaseId);
        const tenantName = sub ? (sub.companyName || `${sub.firstName || ''} ${sub.lastName || ''}`.trim()) : '—';
        const aptName = sub?.apartmentId ? (aptMap.get(sub.apartmentId) || `#${sub.apartmentId}`) : '—';
        const note = noteByReport.get(r.id);
        return { id: r.id, tenantName, apartmentName: aptName, totalCost: r.totalCost, generatedAt: r.generatedAt, noteNumber: note?.noteNumber || null };
      }).slice(0, 10);

      const in30days = new Date();
      in30days.setDate(in30days.getDate() + 30);
      const in30str = in30days.toISOString().slice(0, 10);
      const endingSoon = allSubleases.filter(s =>
        s.status === 'AKTYWNA' && s.endDate >= today && s.endDate <= in30str
      );
      const endingSoonList = endingSoon.map(s => {
        const aptName = s.apartmentId ? (aptMap.get(s.apartmentId) || `#${s.apartmentId}`) : '—';
        const tenantName = s.companyName || `${s.firstName || ''} ${s.lastName || ''}`.trim();
        const daysLeft = Math.ceil((new Date(s.endDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
        return { id: s.id, tenantName, apartmentName: aptName, endDate: s.endDate, daysLeft };
      }).sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 10);

      const in7days = new Date();
      in7days.setDate(in7days.getDate() + 7);
      const in7str = in7days.toISOString().slice(0, 10);
      const upcomingPay = allPayments.filter(p =>
        p.status === 'do_oplacenia' && p.dueDate && p.dueDate >= today && p.dueDate <= in7str
      );
      const upcomingPayList = upcomingPay.map(p => {
        const sub = subleaseMap.get(p.subleaseId);
        const tenantName = sub ? (sub.companyName || `${sub.firstName || ''} ${sub.lastName || ''}`.trim()) : '—';
        return { id: p.id, tenantName, title: p.title, amount: p.amount, dueDate: p.dueDate };
      }).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')).slice(0, 10);

      res.json({
        todayArrivals: todayArrivals.length,
        todayDepartures: todayDepartures.length,
        overduePayments: overduePayments.length,
        todayTasks: 0,
        pendingSubmissions: pendingSubmissions.length,
        openIssues: openIssuesCount,
        arrivals: todayArrivals.slice(0, 10),
        departures: todayDepartures.slice(0, 10),
        unpaidMediaCount: unpaidReports.length,
        unpaidMediaList,
        subleasesEndingSoonCount: endingSoon.length,
        subleasesEndingSoonList: endingSoonList,
        upcomingPaymentsCount: upcomingPay.length,
        upcomingPaymentsList: upcomingPayList,
      });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ==================== PAYMENT TREND (sparkline) ====================
  app.get('/api/recepcja/payment-trend', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const allPayments = await db.select().from(subleasePayments);
      const today = new Date();
      const points: { date: string; amount: number }[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const ds = d.toISOString().slice(0, 10);
        const dayTotal = allPayments
          .filter(p => p.paidDate === ds)
          .reduce((sum, p) => sum + parseFloat(String(p.amount || 0)), 0);
        points.push({ date: ds, amount: dayTotal });
      }
      res.json(points);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ==================== RCP DASHBOARD ====================
  app.get('/api/recepcja/rcp/dashboard', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const allEmployees = await storage.getEmployees();
      const activeEmployees = allEmployees.filter(e => e.status === 'AKTYWNY' && !e.hideFromRcp);
      const hiddenFromRcpIds = new Set(allEmployees.filter(e => e.hideFromRcp).map(e => e.id));
      const allTodayEntries = await storage.getTimeEntriesByDay(today);
      const todayEntries = allTodayEntries.filter((e: any) => !hiddenFromRcpIds.has(e.employeeId));

      const rawPendingEntries = await storage.getTimeEntries({ status: 'WARUNKOWA' });
      const pendingEntries = rawPendingEntries
        .filter((e: any) => !hiddenFromRcpIds.has(e.employeeId))
        .map((e: any) => {
          const emp = allEmployees.find(a => a.id === e.employeeId);
          return {
            ...e,
            employee: emp ? { id: emp.id, firstName: emp.firstName, lastName: emp.lastName } : null,
          };
        });

      let working = 0, onBreak = 0;

      for (const entry of todayEntries) {
        if (entry.status === 'AKTYWNA' || entry.status === 'WARUNKOWA') {
          working++;
        } else if (entry.status === 'PRZERWA') {
          onBreak++;
        }
      }

      const allPendingLeaves = await storage.getLeaveRequests({ status: 'OCZEKUJACY' });
      const pendingLeaves = allPendingLeaves.filter((l: any) => !hiddenFromRcpIds.has(l.employeeId));

      const todaySchedules = await storage.getWorkSchedules({ from: today, to: today });
      const employeesWithPin = activeEmployees.filter(e => e.pin);
      const scheduledEmpIds = new Set(todaySchedules.map((s: any) => s.employeeId));
      const missingSchedules = employeesWithPin
        .filter(e => !scheduledEmpIds.has(e.id))
        .map(e => ({ id: e.id, firstName: e.firstName, lastName: e.lastName }));

      const lateToday: any[] = [];
      const LATE_THRESHOLD_MIN = 15;
      for (const sched of todaySchedules) {
        const emp = activeEmployees.find(e => e.id === (sched as any).employeeId);
        if (!emp) continue;
        const entry = todayEntries.find(te => te.employeeId === (sched as any).employeeId);
        const startTime = (sched as any).startTime || (sched as any).shiftStart;
        if (!startTime) continue;
        const [sh, sm] = startTime.split(':').map(Number);
        const scheduledStart = new Date(`${today}T${String(sh).padStart(2,'0')}:${String(sm).padStart(2,'0')}:00`);
        if (entry && entry.clockIn) {
          const actualStart = new Date(entry.clockIn);
          const diffMin = Math.round((actualStart.getTime() - scheduledStart.getTime()) / 60000);
          if (diffMin > LATE_THRESHOLD_MIN) {
            lateToday.push({
              employee: { id: emp.id, firstName: emp.firstName, lastName: emp.lastName },
              scheduledStart: startTime,
              actualStart: actualStart.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
              lateMinutes: diffMin,
            });
          }
        } else if (!entry) {
          const now = new Date();
          const diffMin = Math.round((now.getTime() - scheduledStart.getTime()) / 60000);
          if (diffMin > LATE_THRESHOLD_MIN) {
            lateToday.push({
              employee: { id: emp.id, firstName: emp.firstName, lastName: emp.lastName },
              scheduledStart: startTime,
              actualStart: null,
              lateMinutes: diffMin,
            });
          }
        }
      }

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const yesterdayEntries = await storage.getTimeEntries({ from: yesterdayStr, to: yesterdayStr });
      const overtimeYesterday: any[] = [];
      for (const entry of yesterdayEntries) {
        if (entry.clockIn && entry.clockOut) {
          const totalMs = new Date(entry.clockOut).getTime() - new Date(entry.clockIn).getTime();
          const workMin = Math.round(totalMs / 60000) - ((entry as any).breakMinutes || 0);
          if (workMin > 480) {
            const emp = activeEmployees.find(e => e.id === entry.employeeId);
            if (emp) {
              overtimeYesterday.push({
                employee: { id: emp.id, firstName: emp.firstName, lastName: emp.lastName },
                workMinutes: workMin,
                overtimeMinutes: workMin - 480,
              });
            }
          }
        }
      }

      res.json({
        working,
        onBreak,
        pendingCount: pendingEntries.length,
        pendingEntries,
        pendingLeavesCount: pendingLeaves.length,
        missingSchedules,
        lateToday,
        overtimeYesterday,
      });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.put('/api/recepcja/rcp/time-entries/:id/approve', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const { adminNote } = req.body;
      const existing = await storage.getTimeEntry(id);
      if (!existing) return res.status(404).json({ message: 'Wpis nie istnieje' });
      if (existing.status !== 'WARUNKOWA') {
        return res.status(409).json({ message: `Wpis ma status "${existing.status}" i nie może zostać zaakceptowany` });
      }
      const entry = await storage.updateTimeEntry(id, {
        status: 'ZAAKCEPTOWANA',
        adminNote: adminNote || null,
        editedBy: req.recepcjaUser.name,
        editedAt: new Date(),
      });
      await logRecepcjaAction(req.recepcjaUser.id, 'APPROVE', 'time_entry', id.toString(), { adminNote });
      res.json(entry);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.put('/api/recepcja/rcp/time-entries/:id/reject', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const { adminNote } = req.body;
      const existing = await storage.getTimeEntry(id);
      if (!existing) return res.status(404).json({ message: 'Wpis nie istnieje' });
      if (existing.status !== 'WARUNKOWA') {
        return res.status(409).json({ message: `Wpis ma status "${existing.status}" i nie może zostać odrzucony` });
      }
      const entry = await storage.updateTimeEntry(id, {
        status: 'ODRZUCONA',
        adminNote: adminNote || null,
        editedBy: req.recepcjaUser.name,
        editedAt: new Date(),
      });
      await logRecepcjaAction(req.recepcjaUser.id, 'REJECT', 'time_entry', id.toString(), { adminNote });
      res.json(entry);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ==================== RCP EMPLOYEE STATS ====================
  app.get('/api/recepcja/rcp/employee-stats', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const { from, to, employeeId } = req.query;
      const filters: any = {};
      if (from) filters.from = from as string;
      if (to) filters.to = to as string;
      if (employeeId) filters.employeeId = parseInt(employeeId as string);

      const allEntries = await storage.getTimeEntries(filters);
      const allEmployees = await storage.getEmployees();
      const activeEmps = employeeId
        ? allEmployees.filter(e => e.id === parseInt(employeeId as string))
        : allEmployees.filter(e => e.status === 'AKTYWNY' && !e.hideFromRcp);

      const stats = activeEmps.map(emp => {
        const empEntries = allEntries.filter(e => e.employeeId === emp.id);
        const completedEntries = empEntries.filter(e => e.clockOut);

        let totalMinutes = 0;
        let lateCount = 0;
        let earlyLeaveCount = 0;

        for (const entry of completedEntries) {
          const clockIn = new Date(entry.clockIn);
          const clockOut = new Date(entry.clockOut!);
          const mins = (clockOut.getTime() - clockIn.getTime()) / 60000 - ((entry as any).breakMinutes || 0);
          totalMinutes += mins;

          const hour = clockIn.getHours();
          const minute = clockIn.getMinutes();
          if (hour > 8 || (hour === 8 && minute > 5)) lateCount++;
          const outHour = clockOut.getHours();
          if (outHour < 16) earlyLeaveCount++;
        }

        const totalHours = Math.round(totalMinutes / 60 * 100) / 100;
        const avgHoursPerDay = completedEntries.length > 0
          ? Math.round(totalHours / completedEntries.length * 100) / 100 : 0;
        const overtimeHours = Math.max(0, totalHours - (completedEntries.length * 8));
        const punctualityRate = completedEntries.length > 0
          ? Math.round(((completedEntries.length - lateCount) / completedEntries.length) * 100) : 100;

        return {
          employeeId: emp.id,
          employeeName: `${emp.firstName} ${emp.lastName}`,
          position: emp.position,
          totalDays: completedEntries.length,
          totalHours,
          avgHoursPerDay,
          overtimeHours: Math.round(overtimeHours * 100) / 100,
          lateCount,
          earlyLeaveCount,
          punctualityRate,
          outsideZoneCount: empEntries.filter((e: any) => e.isOutsideZone).length,
        };
      });

      res.json(stats);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ==================== RCP MONTHLY REPORT ====================
  app.get('/api/recepcja/rcp/monthly-report', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const { month, year } = req.query;
      const m = Number(month);
      const y = Number(year);
      if (!m || !y) return res.status(400).json({ message: 'month and year required' });

      const allEmps = await storage.getEmployees();
      const emps = allEmps.filter(e => !e.hideFromRcp);
      const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const endDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const allEntries = await db.select().from(timeEntries)
        .where(and(gte(timeEntries.date, startDate), lte(timeEntries.date, endDate)));

      const schedules = await db.select().from(workSchedules)
        .where(and(gte(workSchedules.date, startDate), lte(workSchedules.date, endDate)));

      const report = emps.map(emp => {
        const empEntries = allEntries.filter(e => e.employeeId === emp.id);
        const empSchedules = schedules.filter(s => s.employeeId === emp.id);

        let totalMinutes = 0;
        let lateCount = 0;
        let overtimeMinutes = 0;
        let daysWorked = 0;

        empEntries.forEach(entry => {
          if (entry.clockIn && entry.clockOut) {
            const inTime = new Date(entry.clockIn).getTime();
            const outTime = new Date(entry.clockOut).getTime();
            const breakMin = entry.totalBreakMinutes || 0;
            const workedMin = Math.max(0, (outTime - inTime) / 60000 - breakMin);
            totalMinutes += workedMin;
            daysWorked++;

            const schedule = empSchedules.find(s => s.date === entry.date);
            if (schedule && schedule.shiftStart) {
              const scheduledStart = new Date(`${entry.date}T${schedule.shiftStart}`).getTime();
              if (inTime > scheduledStart + 5 * 60000) {
                lateCount++;
              }
            }

            const scheduledMin = schedule && schedule.shiftStart && schedule.shiftEnd
              ? (new Date(`${entry.date}T${schedule.shiftEnd}`).getTime() - new Date(`${entry.date}T${schedule.shiftStart}`).getTime()) / 60000
              : 480;
            if (workedMin > scheduledMin + 15) {
              overtimeMinutes += workedMin - scheduledMin;
            }
          }
        });

        const totalHours = Math.round(totalMinutes / 60 * 100) / 100;
        const overtimeHours = Math.round(overtimeMinutes / 60 * 100) / 100;

        return {
          employeeId: emp.id,
          employeeName: `${emp.firstName} ${emp.lastName}`,
          daysWorked,
          totalHours,
          lateCount,
          overtimeHours,
          scheduledDays: empSchedules.length,
        };
      });

      res.json(report);
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

      const timeEntriesDay = await storage.getTimeEntries(date);

      res.json({
        date,
        arrivals,
        departures,
        paidToday,
        meterReadings: readings,
        completedTasks: [],
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

  // ==================== RCP DELETE TIME ENTRY (T001 bug fix) ====================
  app.delete('/api/recepcja/rcp/time-entries/:id', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      await storage.deleteTimeEntry(Number(req.params.id));
      await logRecepcjaAction(req.recepcjaUser.id, 'DELETE', 'time_entry', req.params.id, {});
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ==================== ZGŁOSZENIA USTEREK ====================
  app.get('/api/recepcja/issues', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const { status, priority } = req.query;
      let query = db.select({
        issue: issues,
        apartmentName: apartments.name,
      }).from(issues).leftJoin(apartments, eq(issues.apartmentId, apartments.id)).orderBy(desc(issues.createdAt));

      const results = await query;
      let filtered = results.map(r => ({ ...r.issue, apartmentName: r.apartmentName }));
      if (status) filtered = filtered.filter(i => i.status === status);
      if (priority) filtered = filtered.filter(i => i.priority === priority);
      res.json(filtered);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post('/api/recepcja/issues', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const data = insertIssueSchema.parse({
        ...req.body,
        reportedBy: req.recepcjaUser.name,
      });
      const [issue] = await db.insert(issues).values(data).returning();
      await logRecepcjaAction(req.recepcjaUser.id, 'CREATE', 'issue', issue.id.toString(), { title: issue.title, apartmentId: issue.apartmentId });
      res.json(issue);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.put('/api/recepcja/issues/:id', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const [existing] = await db.select().from(issues).where(eq(issues.id, id));
      if (!existing) return res.status(404).json({ message: 'Nie znaleziono' });
      const { title, description, priority, category, status, assignedTo, cost, notes } = req.body;
      const update: any = { updatedAt: new Date() };
      if (title) update.title = title;
      if (description !== undefined) update.description = description;
      if (priority) update.priority = priority;
      if (category) update.category = category;
      if (status) {
        update.status = status;
        if (status === 'ROZWIĄZANE' && !existing.resolvedAt) update.resolvedAt = new Date();
      }
      if (assignedTo !== undefined) update.assignedTo = assignedTo || null;
      if (cost !== undefined) update.cost = cost || null;
      if (notes !== undefined) update.notes = notes || null;
      const [updated] = await db.update(issues).set(update).where(eq(issues.id, id)).returning();
      await logRecepcjaAction(req.recepcjaUser.id, 'UPDATE', 'issue', req.params.id, update);
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post('/api/recepcja/issues/:id/create-task', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const [issueRow] = await db.select({ issue: issues, apartmentName: apartments.name })
        .from(issues)
        .leftJoin(apartments, eq(issues.apartmentId, apartments.id))
        .where(eq(issues.id, id));
      if (!issueRow) return res.status(404).json({ message: 'Nie znaleziono usterki' });
      const iss = issueRow.issue;

      const { employeeId, date, startTime, endTime } = req.body;
      if (!employeeId || !date) return res.status(400).json({ message: 'Pracownik i data są wymagane' });

      let categoryId: number | null = null;
      const naprawaCats = await db.select().from(taskCategories).where(eq(taskCategories.name, 'Naprawa')).limit(1);
      if (naprawaCats.length > 0) {
        categoryId = naprawaCats[0].id;
      } else {
        const [newCat] = await db.insert(taskCategories).values({ name: 'Naprawa', color: '#f97316' }).returning();
        categoryId = newCat.id;
      }

      const [task] = await db.insert(employeeTasks).values({
        title: `Naprawa: ${iss.title}`,
        description: iss.description || null,
        employeeId: Number(employeeId),
        date,
        startTime: startTime || null,
        endTime: endTime || null,
        priority: iss.priority,
        status: 'ZAPLANOWANE',
        apartmentId: iss.apartmentId,
        categoryId,
        source: 'RECEPCJA',
      }).returning();

      if (iss.status === 'OTWARTE') {
        await db.update(issues).set({ status: 'W_REALIZACJI', updatedAt: new Date() }).where(eq(issues.id, id));
      }

      await logRecepcjaAction(req.recepcjaUser.id, 'CREATE_TASK_FROM_ISSUE', 'issue', id.toString(), { taskId: task.id });
      res.json(task);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post('/api/recepcja/issues/:id/photos', isRecepcjaAuth as any, upload.array('photos', 5) as any, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const [existing] = await db.select().from(issues).where(eq(issues.id, id));
      if (!existing) return res.status(404).json({ message: 'Nie znaleziono' });

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) return res.status(400).json({ message: 'Brak plików' });

      const { objectStorage } = await import('./replit_integrations/object_storage');
      const newUrls: string[] = [];
      for (const file of files) {
        const ext = file.originalname.split('.').pop() || 'jpg';
        const uniqueId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const path = `private/issues/issue_${id}_${uniqueId}.${ext}`;
        await objectStorage.writeFile(path, file.buffer);
        newUrls.push(path);
      }

      const currentUrls = existing.photoUrls || [];
      const allUrls = [...currentUrls, ...newUrls];
      const [updated] = await db.update(issues).set({ photoUrls: allUrls, updatedAt: new Date() }).where(eq(issues.id, id)).returning();
      await logRecepcjaAction(req.recepcjaUser.id, 'UPLOAD_PHOTOS', 'issue', req.params.id, { count: files.length });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ==================== SIDEBAR VISIBILITY CONFIG (read-only for Gosia) ====================
  app.get('/api/recepcja/sidebar-config', isRecepcjaAuth as any, async (_req: any, res) => {
    try {
      const raw = await storage.getAppConfig('recepcja-sidebar-visibility');
      const config = raw ? JSON.parse(raw) : {};
      res.json({
        hiddenItems: config.hiddenItems || [],
        sectionOrder: config.sectionOrder || [],
        itemOrder: config.itemOrder || {},
      });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ==================== RECEPCJA AUDIT LOG (admin only, not visible to recepcja) ====================
  app.get('/api/recepcja-audit-log', async (req, res) => {
    try {
      const logs = await db.select().from(recepcjaAuditLog).orderBy(desc(recepcjaAuditLog.createdAt)).limit(500);
      res.json(logs);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ==================== TASK CATEGORIES ====================
  app.get('/api/recepcja/task-categories', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const result = await db.select().from(taskCategories).orderBy(sql`name ASC`);
      res.json(result);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post('/api/recepcja/task-categories', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const { name, color } = req.body;
      if (!name || !name.trim()) return res.status(400).json({ message: "Podaj nazwę kategorii" });
      const existing = await db.select().from(taskCategories).where(eq(taskCategories.name, name.trim()));
      if (existing.length > 0) return res.status(400).json({ message: `Kategoria "${name.trim()}" już istnieje` });
      const [cat] = await db.insert(taskCategories).values({ name: name.trim(), color: color || '#6366f1' }).returning();
      res.status(201).json(cat);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.put('/api/recepcja/task-categories/:id', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const { name, color } = req.body;
      const [cat] = await db.update(taskCategories)
        .set({ ...(name ? { name: name.trim() } : {}), ...(color ? { color } : {}) })
        .where(eq(taskCategories.id, Number(req.params.id)))
        .returning();
      if (!cat) return res.status(404).json({ message: "Nie znaleziono kategorii" });
      res.json(cat);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.delete('/api/recepcja/task-categories/:id', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      await db.delete(taskCategories).where(eq(taskCategories.id, Number(req.params.id)));
      res.status(204).send();
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get('/api/recepcja/tasks', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const { employeeId, date, from, to, status } = req.query;
      const conditions: any[] = [];
      if (employeeId) conditions.push(eq(employeeTasks.employeeId, Number(employeeId)));
      if (date) conditions.push(eq(employeeTasks.date, String(date)));
      if (from && to) conditions.push(and(gte(employeeTasks.date, String(from)), lte(employeeTasks.date, String(to))));
      if (status) conditions.push(eq(employeeTasks.status, String(status)));
      const result = conditions.length > 0
        ? await db.select().from(employeeTasks).where(and(...conditions)).orderBy(sql`date ASC, start_time ASC`)
        : await db.select().from(employeeTasks).orderBy(sql`date ASC, start_time ASC`);
      res.json(result);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post('/api/recepcja/tasks', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const data = insertEmployeeTaskSchema.parse({ ...req.body, assignedById: req.recepcjaUser?.id });
      const [task] = await db.insert(employeeTasks).values(data).returning();
      res.status(201).json(task);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.put('/api/recepcja/tasks/:id', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const [task] = await db.update(employeeTasks)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(employeeTasks.id, Number(req.params.id)))
        .returning();
      if (!task) return res.status(404).json({ message: "Nie znaleziono zadania" });
      res.json(task);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.delete('/api/recepcja/tasks/:id', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      await db.delete(employeeTasks).where(eq(employeeTasks.id, Number(req.params.id)));
      res.status(204).send();
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get('/api/recepcja/tasks/:taskId/comments', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const result = await db.select().from(taskComments)
        .where(eq(taskComments.taskId, Number(req.params.taskId)))
        .orderBy(sql`created_at ASC`);
      res.json(result);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post('/api/recepcja/tasks/:taskId/comments', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const data = insertTaskCommentSchema.parse({
        taskId: Number(req.params.taskId),
        authorId: req.recepcjaUser?.id,
        authorName: req.recepcjaUser?.name || 'Recepcja',
        content: req.body.content,
      });
      const [comment] = await db.insert(taskComments).values(data).returning();
      res.status(201).json(comment);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  // ==================== RECEPCJA MILEAGE ====================
  app.get('/api/recepcja/mileage', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const { employeeId, from, to } = req.query;
      const conditions: any[] = [];
      if (employeeId) conditions.push(eq(mileageEntries.employeeId, Number(employeeId)));
      if (from && to) conditions.push(and(gte(mileageEntries.date, String(from)), lte(mileageEntries.date, String(to))));
      const result = conditions.length > 0
        ? await db.select().from(mileageEntries).where(and(...conditions)).orderBy(desc(mileageEntries.date))
        : await db.select().from(mileageEntries).orderBy(desc(mileageEntries.date));
      res.json(result);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ==================== RECEPCJA SCHEDULE TEMPLATES ====================
  app.get('/api/recepcja/schedule-templates', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const result = await db.select().from(scheduleTemplates).orderBy(sql`name ASC`);
      res.json(result);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post('/api/recepcja/schedule-templates', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const data = insertScheduleTemplateSchema.parse({ ...req.body, createdById: req.recepcjaUser?.id });
      const [template] = await db.insert(scheduleTemplates).values(data).returning();
      res.status(201).json(template);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.put('/api/recepcja/schedule-templates/:id', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const [template] = await db.update(scheduleTemplates)
        .set(req.body)
        .where(eq(scheduleTemplates.id, Number(req.params.id)))
        .returning();
      if (!template) return res.status(404).json({ message: "Nie znaleziono szablonu" });
      res.json(template);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  app.delete('/api/recepcja/schedule-templates/:id', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      await db.delete(scheduleTemplates).where(eq(scheduleTemplates.id, Number(req.params.id)));
      res.status(204).send();
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ==================== RECEPCJA DAY VIEW (Tasks + Schedules + Workload) ====================
  app.get('/api/recepcja/tasks/day', isRecepcjaAuth as any, async (req: any, res) => {
    try {
      const { date } = req.query;
      if (!date) return res.status(400).json({ message: 'date wymagany' });
      const dateStr = String(date);

      // Get all tasks for the day
      const tasks = await db.select().from(employeeTasks)
        .where(eq(employeeTasks.date, dateStr))
        .orderBy(sql`start_time ASC`);

      // Get work schedules for the day (etat employees)
      const schedules = await db.select().from(workSchedules)
        .where(eq(workSchedules.date, dateStr));

      // Get all active employees
      const allEmployees = await db.select().from(employees)
        .where(sql`status = 'AKTYWNY'`);

      // Compute hourly workload per employee (tasks today)
      const workloadByEmployee: Record<number, { taskCount: number; totalMinutes: number }> = {};
      for (const task of tasks) {
        if (!workloadByEmployee[task.employeeId]) {
          workloadByEmployee[task.employeeId] = { taskCount: 0, totalMinutes: 0 };
        }
        workloadByEmployee[task.employeeId].taskCount++;
        if (task.startTime && task.endTime) {
          const [sh, sm] = task.startTime.split(':').map(Number);
          const [eh, em] = task.endTime.split(':').map(Number);
          const mins = (eh * 60 + em) - (sh * 60 + sm);
          if (mins > 0) workloadByEmployee[task.employeeId].totalMinutes += mins;
        }
      }

      res.json({
        date: dateStr,
        tasks,
        schedules,
        employees: allEmployees,
        workload: workloadByEmployee,
      });
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