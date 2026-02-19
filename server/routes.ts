import type { Express } from "express";
import type { Server } from "http";
import * as fs from "fs";
import * as path from "path";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { insertBlockadeSchema, insertSaldoEntrySchema, insertSubleaseSchema, insertSubleasePaymentSchema, insertDocumentCategorySchema, insertDocumentTemplateSchema, insertSubleaseMeterReadingSchema, insertSubleaseMeterSettingSchema, insertSubleaseMeterPriceSchema, insertMediaSettlementReportSchema, insertCostScheduleSchema, insertCostSchedulePaymentSchema, insertInstallmentScheduleSchema, insertInstallmentPaymentSchema, insertServiceContractAttachmentSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import * as XLSX from "xlsx";
import { testConnection, fetchReservations } from "./hotres";

const upload = multer({ storage: multer.memoryStorage() });

function excelDateToISO(val: any): string | null {
  if (!val) return null;
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) {
      return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    }
  }
  if (typeof val === 'string') {
    const parts = val.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
    if (parts) return `${parts[1]}-${parts[2].padStart(2, '0')}-${parts[3].padStart(2, '0')}`;
    const partsPL = val.match(/(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/);
    if (partsPL) return `${partsPL[3]}-${partsPL[2].padStart(2, '0')}-${partsPL[1].padStart(2, '0')}`;
  }
  return null;
}

async function seedLocations() {
  const existingLocs = await storage.getLocations();
  if (existingLocs.length === 0) {
    console.log("Seeding default locations...");
    const defaultLocs = [
      { name: "GRAND BALTIC", sortOrder: 0 },
      { name: "BULWAR PORTOWY", sortOrder: 1 },
      { name: "WCZASOWA", sortOrder: 2 },
      { name: "NA WYDMIE", sortOrder: 3 },
      { name: "PRZEWŁOKA", sortOrder: 4 },
    ];
    for (const loc of defaultLocs) {
      await storage.createLocation(loc);
    }
    console.log("Default locations seeded!");
  }
}

async function seedServiceContractCategories() {
  const existingCats = await storage.getServiceContractCategories();
  if (existingCats.length === 0) {
    console.log("Seeding default service contract categories...");
    const defaultCats = [
      { name: "Vectra", sortOrder: 0 },
      { name: "Media", sortOrder: 1 },
      { name: "Energa", sortOrder: 2 },
      { name: "Marketing&Reklama", sortOrder: 3 },
      { name: "Canal+", sortOrder: 4 },
      { name: "Inne", sortOrder: 5 },
    ];
    for (const cat of defaultCats) {
      await storage.createServiceContractCategory(cat);
    }
    console.log("Default service contract categories seeded!");
  }
}

async function seedAccounts() {
  const existingAccounts = await storage.getAccounts();
  const requiredAccounts = [
    { name: "Pekao SA", type: "BANK", category: "KONTA_BANKOWE", balanceSource: "manual" },
    { name: "Santander", type: "BANK", category: "KONTA_BANKOWE", balanceSource: "manual" },
    { name: "Saldo - M. Cieślak", type: "CASH", category: "GOTOWKA", balanceSource: "auto_saldo" },
    { name: "Saldo - M. Latasiewicz", type: "BANK", category: "GOTOWKA", balanceSource: "auto_saldo" },
    { name: "Saldo - J. Głodkowska", type: "BANK", category: "GOTOWKA", balanceSource: "auto_saldo" },
    { name: "Kryptowaluty", type: "BANK", category: "INNE", balanceSource: "manual" },
    { name: "Pożyczki", type: "LOAN", category: "INNE", balanceSource: "manual" },
  ];
  const existingNames = existingAccounts.map(a => a.name.toLowerCase());
  for (const acc of requiredAccounts) {
    if (!existingNames.includes(acc.name.toLowerCase())) {
      await storage.createAccount(acc);
    }
  }
  if (requiredAccounts.some(a => !existingNames.includes(a.name.toLowerCase()))) {
    console.log("Company accounts seeded!");
  }
}

async function seedData() {
  const existingApts = await storage.getApartments();
  if (existingApts.length === 0) {
    console.log("Seeding database...");
    const apt1 = await storage.createApartment({ name: "Apartament Plazowy", location: "Gdansk", address: "ul. Morska 1", ownerName: "Jan Kowalski", active: true });
    const apt2 = await storage.createApartment({ name: "Apartament Centrum", location: "Sopot", address: "ul. Bohaterow Monte Cassino 15", ownerName: "Anna Nowak", active: true });
    await storage.createReservation({ reservationNumber: "RES-2025-001", apartmentId: apt1.id, addDate: "2025-05-15", startDate: "2025-06-01", endDate: "2025-06-07", guestName: "Michal Wisniewski", price: "2500.00", prepayment: "500.00", paidAmount: "0", surcharge: "0.00", status: "PRZYJETA" });
    await storage.createReservation({ reservationNumber: "RES-2025-002", apartmentId: apt2.id, addDate: "2025-06-20", startDate: "2025-07-10", endDate: "2025-07-15", guestName: "Ewa Bem", price: "3200.00", prepayment: "1000.00", paidAmount: "0", surcharge: "0.00", status: "DO_OPLACENIA" });
    await storage.createExpense({ date: "2025-06-05", category: "Sprzatanie", amount: "200.00", apartmentId: apt1.id, description: "Sprzatanie po gosciach", type: "VARIABLE", vatAmount: "0.00" });
    console.log("Seeding complete!");
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);
  registerObjectStorageRoutes(app);
  seedData().catch(console.error);
  seedLocations().catch(console.error);
  seedServiceContractCategories().catch(console.error);
  seedAccounts().catch(console.error);

  // Owners
  app.get(api.owners.list.path, isAuthenticated, async (req, res) => {
    const ownersList = await storage.getOwners();
    res.json(ownersList);
  });

  app.get(api.owners.get.path, isAuthenticated, async (req, res) => {
    const owner = await storage.getOwner(Number(req.params.id));
    if (!owner) return res.status(404).json({ message: "Not found" });
    res.json(owner);
  });

  app.post(api.owners.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.owners.create.input.parse(req.body);
      const owner = await storage.createOwner(input);
      res.status(201).json(owner);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.put(api.owners.update.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.owners.update.input.parse(req.body);
      const owner = await storage.updateOwner(Number(req.params.id), input);
      res.json(owner);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.delete(api.owners.delete.path, isAuthenticated, async (req, res) => {
    await storage.deleteOwner(Number(req.params.id));
    res.status(204).send();
  });

  // Apartments
  app.get(api.apartments.list.path, isAuthenticated, async (req, res) => {
    const apartments = await storage.getApartments();
    res.json(apartments);
  });

  app.get(api.apartments.get.path, isAuthenticated, async (req, res) => {
    const apartment = await storage.getApartment(Number(req.params.id));
    if (!apartment) return res.status(404).json({ message: "Not found" });
    res.json(apartment);
  });

  app.post(api.apartments.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.apartments.create.input.parse(req.body);
      const apartment = await storage.createApartment(input);
      res.status(201).json(apartment);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.put(api.apartments.update.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.apartments.update.input.parse(req.body);
      const apartment = await storage.updateApartment(Number(req.params.id), input);
      res.json(apartment);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.delete(api.apartments.delete.path, isAuthenticated, async (req, res) => {
    try {
      await storage.deleteApartment(Number(req.params.id));
      res.status(204).send();
    } catch (err: any) {
      console.error("Error deleting apartment:", err);
      res.status(500).json({ message: "Nie udało się usunąć apartamentu." });
    }
  });

  // Reservations
  app.get(api.reservations.list.path, isAuthenticated, async (req, res) => {
    const filters = {
      apartmentId: req.query.apartmentId ? Number(req.query.apartmentId) : undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    };
    const reservations = await storage.getReservations(filters);
    res.json(reservations);
  });

  app.post(api.reservations.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.reservations.create.input.parse(req.body);
      const reservation = await storage.createReservation(input);
      res.status(201).json(reservation);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.put(api.reservations.update.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.reservations.update.input.parse(req.body);
      const reservation = await storage.updateReservation(Number(req.params.id), input);
      res.json(reservation);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.delete(api.reservations.delete.path, isAuthenticated, async (req, res) => {
    await storage.deleteReservation(Number(req.params.id));
    res.status(204).send();
  });

  // Leases
  app.get(api.leases.list.path, isAuthenticated, async (req, res) => {
    const leases = await storage.getLeases(req.query.apartmentId ? Number(req.query.apartmentId) : undefined);
    res.json(leases);
  });

  app.post(api.leases.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.leases.create.input.parse(req.body);
      const lease = await storage.createLease(input);
      res.status(201).json(lease);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.put(api.leases.update.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.leases.update.input.parse(req.body);
      const lease = await storage.updateLease(Number(req.params.id), input);
      res.json(lease);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  // Expenses
  app.get(api.expenses.list.path, isAuthenticated, async (req, res) => {
    const filters: { startDate?: string; endDate?: string } = {};
    if (req.query.startDate) filters.startDate = req.query.startDate as string;
    if (req.query.endDate) filters.endDate = req.query.endDate as string;
    const expenses = await storage.getExpenses(Object.keys(filters).length ? filters : undefined);
    res.json(expenses);
  });

  app.post(api.expenses.create.path, isAuthenticated, async (req, res) => {
    try {
      const bodySchema = api.expenses.create.input.extend({
        amount: z.coerce.string(),
      });
      const input = bodySchema.parse(req.body);
      const expense = await storage.createExpense(input);
      res.status(201).json(expense);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.put("/api/expenses/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const bodySchema = api.expenses.update.input.extend({
        amount: z.coerce.string().optional(),
        vatAmount: z.coerce.string().optional(),
      });
      const input = bodySchema.parse(req.body);
      const expense = await storage.updateExpense(id, input);
      if (!expense) return res.status(404).json({ message: "Koszt nie znaleziony" });
      res.json(expense);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.delete("/api/expenses/:id", isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteExpense(id);
    res.status(204).send();
  });

  // Company Balance
  app.get("/api/company-balance", isAuthenticated, async (req, res) => {
    const balance = await storage.getCompanyBalance();

    const saldoPersonMap: Record<string, string> = {
      "Saldo - M. Latasiewicz": "Małgorzata Latasiewicz",
      "Saldo - J. Głodkowska": "Jolanta Głodkowska",
      "Saldo - M. Cieślak": "Mateusz Cieślak",
    };

    for (const acc of balance.accounts) {
      if (acc.balanceSource === "auto_saldo") {
        const personName = saldoPersonMap[acc.name];
        if (personName) {
          const initialBal = parseFloat(await storage.getSaldoInitialBalance(personName));
          const entries = await storage.getSaldoEntries({ personName });
          let running = initialBal;
          for (const e of entries) {
            if (e.cashAmount) running += parseFloat(e.cashAmount);
          }
          acc.latestBalance = running.toFixed(2);
        }
      }
    }

    const total = balance.accounts.reduce((sum, a) => sum + Number(a.latestBalance), 0);
    balance.totalBalance = total.toFixed(2);

    res.json(balance);
  });

  app.get("/api/saldo-balances", isAuthenticated, async (_req, res) => {
    const persons = ["Małgorzata Latasiewicz", "Jolanta Głodkowska", "Mateusz Cieślak"];
    const result: Record<string, number> = {};
    for (const person of persons) {
      const initialBal = parseFloat(await storage.getSaldoInitialBalance(person));
      const entries = await storage.getSaldoEntries({ personName: person });
      let running = initialBal;
      for (const e of entries) {
        if (e.cashAmount) running += parseFloat(e.cashAmount);
      }
      result[person] = running;
    }
    res.json(result);
  });

  app.get("/api/revenue", isAuthenticated, async (req, res) => {
    const year = Number(req.query.year) || new Date().getFullYear();
    const reservations = await storage.getReservations();
    const subleases = await storage.getSubleases();
    const subleasePaymentsAll: Record<number, any[]> = {};

    for (const s of subleases) {
      const payments = await storage.getSubleasePayments(s.id);
      subleasePaymentsAll[s.id] = payments;
    }

    const revenueData: Record<number, Record<number, {
      najem: number;
      podnajem: number;
      doplaty_najem: number;
      doplaty_podnajem: number;
    }>> = {};

    const initMonth = (aptId: number, month: number) => {
      if (!revenueData[aptId]) revenueData[aptId] = {};
      if (!revenueData[aptId][month]) revenueData[aptId][month] = { najem: 0, podnajem: 0, doplaty_najem: 0, doplaty_podnajem: 0 };
    };

    for (const r of reservations) {
      if (!r.startDate) continue;
      if (r.status === "ANULOWANA") continue;
      const d = new Date(r.startDate);
      if (d.getFullYear() !== year) continue;
      const month = d.getMonth();
      const price = Number(r.price) || 0;
      const paid = Number(r.paidAmount) || 0;
      const unpaid = Math.max(0, price - paid);

      const aptIds = r.apartmentIds && r.apartmentIds.length > 0
        ? r.apartmentIds
        : (r.apartmentId ? [r.apartmentId] : []);

      for (const aptId of aptIds) {
        if (!aptId) continue;
        initMonth(aptId, month);
        const share = aptIds.length > 0 ? price / aptIds.length : price;
        const shareUnpaid = aptIds.length > 0 ? unpaid / aptIds.length : unpaid;
        revenueData[aptId][month].najem += share;
        revenueData[aptId][month].doplaty_najem += shareUnpaid;
      }
    }

    for (const s of subleases) {
      const aptIds = s.apartmentIds && s.apartmentIds.length > 0
        ? s.apartmentIds
        : (s.apartmentId ? [s.apartmentId] : []);

      if (aptIds.length === 0) continue;

      const payments = subleasePaymentsAll[s.id] || [];
      for (const p of payments) {
        if (!p.dueDate) continue;
        const pd = new Date(p.dueDate);
        if (pd.getFullYear() !== year) continue;
        const month = pd.getMonth();
        const amount = Number(p.amount) || 0;
        const payAptIds = p.apartmentId ? [p.apartmentId] : aptIds;

        for (const aptId of payAptIds) {
          if (!aptId) continue;
          initMonth(aptId, month);
          revenueData[aptId][month].podnajem += amount / payAptIds.length;
          if (p.status === "do_oplacenia") {
            revenueData[aptId][month].doplaty_podnajem += amount / payAptIds.length;
          }
        }
      }
    }

    res.json(revenueData);
  });

  // Accounts
  app.get(api.accounts.list.path, isAuthenticated, async (req, res) => {
    const accounts = await storage.getAccounts();
    res.json(accounts);
  });

  app.post(api.accounts.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.accounts.create.input.parse(req.body);
      const account = await storage.createAccount(input);
      res.status(201).json(account);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  // Snapshots
  app.get(api.snapshots.list.path, isAuthenticated, async (req, res) => {
    const snapshots = await storage.getSnapshots();
    res.json(snapshots);
  });

  app.post(api.snapshots.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.snapshots.create.input.parse(req.body);
      const snapshot = await storage.createSnapshot(input);
      res.status(201).json(snapshot);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  // Owner Payments
  app.get('/api/apartments/:apartmentId/payments', isAuthenticated, async (req, res) => {
    const payments = await storage.getOwnerPayments(Number(req.params.apartmentId));
    res.json(payments);
  });

  app.post('/api/apartments/:apartmentId/payments', isAuthenticated, async (req, res) => {
    try {
      const input = api.ownerPayments.create.input.parse({
        ...req.body,
        apartmentId: Number(req.params.apartmentId),
      });
      const payment = await storage.createOwnerPayment(input);
      res.status(201).json(payment);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.delete('/api/owner-payments/:id', isAuthenticated, async (req, res) => {
    await storage.deleteOwnerPayment(Number(req.params.id));
    res.status(204).send();
  });

  // Blockades
  app.get('/api/blockades', isAuthenticated, async (req, res) => {
    const allBlockades = await storage.getBlockades();
    res.json(allBlockades);
  });

  app.post('/api/blockades', isAuthenticated, async (req, res) => {
    try {
      const parsed = insertBlockadeSchema.parse(req.body);
      if (parsed.startDate > parsed.endDate) {
        return res.status(400).json({ message: "Data rozpoczęcia musi być przed datą zakończenia" });
      }
      const blockade = await storage.createBlockade(parsed);
      res.status(201).json(blockade);
    } catch (err: any) {
      if (err?.name === "ZodError") {
        return res.status(400).json({ message: "Nieprawidłowe dane", errors: err.errors });
      }
      console.error(err);
      res.status(500).json({ message: "Błąd serwera" });
    }
  });

  app.delete('/api/blockades/:id', isAuthenticated, async (req, res) => {
    await storage.deleteBlockade(Number(req.params.id));
    res.status(204).send();
  });

  // Attachments
  app.get('/api/attachments/all', isAuthenticated, async (_req, res) => {
    const atts = await storage.getAllAttachments();
    res.json(atts);
  });

  app.get('/api/apartments/:id/attachments', isAuthenticated, async (req, res) => {
    const atts = await storage.getAttachments(Number(req.params.id));
    res.json(atts);
  });

  app.post('/api/apartments/:id/attachments', isAuthenticated, async (req, res) => {
    try {
      const { fileName, objectPath, fileType, category } = req.body;
      if (!fileName || !objectPath) return res.status(400).json({ message: "Brak wymaganych pól" });
      const attachment = await storage.createAttachment({
        apartmentId: Number(req.params.id),
        fileName,
        objectPath,
        fileType: fileType || null,
        category: category || 'UMOWA',
      });
      res.status(201).json(attachment);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Błąd zapisu załącznika" });
    }
  });

  app.delete('/api/attachments/:id', isAuthenticated, async (req, res) => {
    await storage.deleteAttachment(Number(req.params.id));
    res.status(204).send();
  });

  // Costs Apartments import data
  app.get('/api/costs-apartments/import-data', isAuthenticated, (_req, res) => {
    try {
      const filePath = path.join(process.cwd(), 'server', 'data', 'costs-apartments-import.json');
      const raw = fs.readFileSync(filePath, 'utf-8');
      res.json(JSON.parse(raw));
    } catch (err) {
      res.status(404).json({ message: "Brak danych importu" });
    }
  });

  // Employees
  app.get(api.employees.list.path, isAuthenticated, async (req, res) => {
    const emps = await storage.getEmployees();
    res.json(emps);
  });

  app.get('/api/employees/:id', isAuthenticated, async (req, res) => {
    const emp = await storage.getEmployee(Number(req.params.id));
    if (!emp) return res.status(404).json({ message: "Nie znaleziono pracownika" });
    res.json(emp);
  });

  app.post(api.employees.create.path, isAuthenticated, async (req, res) => {
    try {
      const data = api.employees.create.input.parse(req.body);
      const emp = await storage.createEmployee(data);
      res.status(201).json(emp);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Błąd walidacji" });
    }
  });

  app.put('/api/employees/:id', isAuthenticated, async (req, res) => {
    try {
      const data = api.employees.update.input.parse(req.body);
      const emp = await storage.updateEmployee(Number(req.params.id), data);
      if (!emp) return res.status(404).json({ message: "Nie znaleziono pracownika" });
      res.json(emp);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Błąd walidacji" });
    }
  });

  app.delete('/api/employees/:id', isAuthenticated, async (req, res) => {
    await storage.deleteEmployee(Number(req.params.id));
    res.status(204).send();
  });

  // Medical Exams
  app.get('/api/medical-exams/all', isAuthenticated, async (req, res) => {
    const allEmployees = await storage.getEmployees();
    const allExams: any[] = [];
    for (const emp of allEmployees) {
      const exams = await storage.getMedicalExams(emp.id);
      for (const exam of exams) {
        allExams.push({ ...exam, employeeName: `${emp.firstName} ${emp.lastName}` });
      }
    }
    res.json(allExams);
  });

  app.get('/api/employees/:employeeId/medical-exams', isAuthenticated, async (req, res) => {
    const exams = await storage.getMedicalExams(Number(req.params.employeeId));
    res.json(exams);
  });

  app.post('/api/employees/:employeeId/medical-exams', isAuthenticated, async (req, res) => {
    try {
      const input = api.medicalExams.create.input.parse({
        ...req.body,
        employeeId: Number(req.params.employeeId),
      });
      const exam = await storage.createMedicalExam(input);
      res.status(201).json(exam);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Błąd walidacji" });
    }
  });

  app.delete('/api/medical-exams/:id', isAuthenticated, async (req, res) => {
    await storage.deleteMedicalExam(Number(req.params.id));
    res.status(204).send();
  });

  // Locations
  app.get('/api/locations', isAuthenticated, async (req, res) => {
    const locs = await storage.getLocations();
    res.json(locs);
  });

  app.post('/api/locations', isAuthenticated, async (req, res) => {
    try {
      const loc = await storage.createLocation(req.body);
      res.status(201).json(loc);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Błąd walidacji" });
    }
  });

  app.put('/api/locations/:id', isAuthenticated, async (req, res) => {
    try {
      const loc = await storage.updateLocation(Number(req.params.id), req.body);
      res.json(loc);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Błąd walidacji" });
    }
  });

  app.delete('/api/locations/:id', isAuthenticated, async (req, res) => {
    await storage.deleteLocation(Number(req.params.id));
    res.status(204).send();
  });

  // Service Contract Categories
  app.get('/api/service-contract-categories', isAuthenticated, async (req, res) => {
    const cats = await storage.getServiceContractCategories();
    res.json(cats);
  });

  app.post('/api/service-contract-categories', isAuthenticated, async (req, res) => {
    try {
      const cat = await storage.createServiceContractCategory(req.body);
      res.status(201).json(cat);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Błąd walidacji" });
    }
  });

  app.put('/api/service-contract-categories/:id', isAuthenticated, async (req, res) => {
    try {
      const updated = await storage.updateServiceContractCategory(Number(req.params.id), req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Błąd aktualizacji" });
    }
  });

  app.delete('/api/service-contract-categories/:id', isAuthenticated, async (req, res) => {
    await storage.deleteServiceContractCategory(Number(req.params.id));
    res.status(204).send();
  });

  // Service Contracts
  app.get('/api/service-contracts', isAuthenticated, async (req, res) => {
    const contracts = await storage.getServiceContracts();
    res.json(contracts);
  });

  app.post('/api/service-contracts', isAuthenticated, async (req, res) => {
    try {
      const contract = await storage.createServiceContract(req.body);
      res.status(201).json(contract);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Błąd walidacji" });
    }
  });

  app.put('/api/service-contracts/:id', isAuthenticated, async (req, res) => {
    try {
      const contract = await storage.updateServiceContract(Number(req.params.id), req.body);
      res.json(contract);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Błąd walidacji" });
    }
  });

  app.delete('/api/service-contracts/:id', isAuthenticated, async (req, res) => {
    await storage.deleteServiceContract(Number(req.params.id));
    res.status(204).send();
  });

  app.get('/api/service-contract-attachments/all', isAuthenticated, async (_req, res) => {
    const atts = await storage.getAllServiceContractAttachments();
    res.json(atts);
  });

  app.get('/api/service-contracts/:id/attachments', isAuthenticated, async (req, res) => {
    const atts = await storage.getServiceContractAttachments(Number(req.params.id));
    res.json(atts);
  });

  app.post('/api/service-contracts/:id/attachments', isAuthenticated, async (req, res) => {
    try {
      const parsed = insertServiceContractAttachmentSchema.parse({
        ...req.body,
        contractId: Number(req.params.id),
        category: req.body.category || 'UMOWA',
      });
      const att = await storage.createServiceContractAttachment(parsed);
      res.status(201).json(att);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Nieprawidłowe dane" });
    }
  });

  app.delete('/api/service-contract-attachments/:id', isAuthenticated, async (req, res) => {
    await storage.deleteServiceContractAttachment(Number(req.params.id));
    res.status(204).send();
  });

  // Subleases
  app.get('/api/subleases', isAuthenticated, async (_req, res) => {
    const list = await storage.getSubleases();
    res.json(list);
  });

  app.get('/api/subleases/:id', isAuthenticated, async (req, res) => {
    const s = await storage.getSublease(Number(req.params.id));
    if (!s) return res.status(404).json({ message: "Nie znaleziono umowy" });
    res.json(s);
  });

  app.post('/api/subleases', isAuthenticated, async (req, res) => {
    try {
      const parsed = insertSubleaseSchema.parse(req.body);
      const created = await storage.createSublease(parsed);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Błąd zapisu" });
    }
  });

  app.put('/api/subleases/:id', isAuthenticated, async (req, res) => {
    try {
      const data = { ...req.body };
      if (data.rentAmount === "" || data.rentAmount === undefined) data.rentAmount = null;
      if (data.additionalFees === "" || data.additionalFees === undefined) data.additionalFees = null;
      const updated = await storage.updateSublease(Number(req.params.id), data);
      res.status(200).json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Błąd aktualizacji" });
    }
  });

  app.delete('/api/subleases/:id', isAuthenticated, async (req, res) => {
    await storage.deleteSublease(Number(req.params.id));
    res.status(204).send();
  });

  // Sublease Payments
  app.get('/api/subleases/:id/payments', isAuthenticated, async (req, res) => {
    const payments = await storage.getSubleasePayments(Number(req.params.id));
    res.json(payments);
  });

  app.post('/api/subleases/:id/payments', isAuthenticated, async (req, res) => {
    try {
      const created = await storage.createSubleasePayment({ ...req.body, subleaseId: Number(req.params.id) });
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Błąd zapisu" });
    }
  });

  app.put('/api/sublease-payments/:id', isAuthenticated, async (req, res) => {
    try {
      const updated = await storage.updateSubleasePayment(Number(req.params.id), req.body);
      res.status(200).json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Błąd aktualizacji" });
    }
  });

  app.delete('/api/sublease-payments/:id', isAuthenticated, async (req, res) => {
    await storage.deleteSubleasePayment(Number(req.params.id));
    res.status(204).send();
  });

  // Sublease Attachments
  app.get('/api/sublease-attachments/all', isAuthenticated, async (_req, res) => {
    const atts = await storage.getAllSubleaseAttachments();
    res.json(atts);
  });

  app.get('/api/subleases/:id/attachments', isAuthenticated, async (req, res) => {
    const atts = await storage.getSubleaseAttachments(Number(req.params.id));
    res.json(atts);
  });

  app.post('/api/subleases/:id/attachments', isAuthenticated, async (req, res) => {
    try {
      const { fileName, objectPath, fileType, category } = req.body;
      if (!fileName || !objectPath) return res.status(400).json({ message: "Brak wymaganych pól" });
      const att = await storage.createSubleaseAttachment({
        subleaseId: Number(req.params.id),
        fileName,
        objectPath,
        fileType: fileType || null,
        category: category || 'UMOWA',
      });
      res.status(201).json(att);
    } catch (err: any) {
      res.status(500).json({ message: "Błąd zapisu załącznika" });
    }
  });

  app.delete('/api/sublease-attachments/:id', isAuthenticated, async (req, res) => {
    await storage.deleteSubleaseAttachment(Number(req.params.id));
    res.status(204).send();
  });

  // Meter Readings & Settings
  app.get('/api/subleases/:id/meter-readings', isAuthenticated, async (req, res) => {
    const readings = await storage.getMeterReadings(Number(req.params.id));
    res.json(readings);
  });

  app.post('/api/subleases/:id/meter-readings', isAuthenticated, async (req, res) => {
    try {
      const parsed = insertSubleaseMeterReadingSchema.parse({ ...req.body, subleaseId: Number(req.params.id) });
      const created = await storage.upsertMeterReading(parsed);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Nieprawidłowe dane" });
    }
  });

  app.delete('/api/meter-readings/:id', isAuthenticated, async (req, res) => {
    await storage.deleteMeterReading(Number(req.params.id));
    res.status(204).send();
  });

  app.get('/api/subleases/:id/meter-settings', isAuthenticated, async (req, res) => {
    const settings = await storage.getMeterSettings(Number(req.params.id));
    res.json(settings);
  });

  app.post('/api/subleases/:id/meter-settings', isAuthenticated, async (req, res) => {
    try {
      const parsed = insertSubleaseMeterSettingSchema.parse({ ...req.body, subleaseId: Number(req.params.id) });
      const saved = await storage.upsertMeterSetting(parsed);
      res.status(201).json(saved);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Nieprawidłowe dane" });
    }
  });

  // Meter Price History
  app.get('/api/subleases/:id/meter-prices', isAuthenticated, async (req, res) => {
    const prices = await storage.getMeterPrices(Number(req.params.id));
    res.json(prices);
  });

  app.post('/api/subleases/:id/meter-prices', isAuthenticated, async (req, res) => {
    try {
      const parsed = insertSubleaseMeterPriceSchema.parse({ ...req.body, subleaseId: Number(req.params.id) });
      const created = await storage.createMeterPrice(parsed);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Nieprawidłowe dane" });
    }
  });

  app.delete('/api/meter-prices/:id', isAuthenticated, async (req, res) => {
    await storage.deleteMeterPrice(Number(req.params.id));
    res.status(204).send();
  });

  app.get('/api/subleases/:id/settlement-reports', isAuthenticated, async (req, res) => {
    const reports = await storage.getMediaSettlementReports(Number(req.params.id));
    res.json(reports);
  });

  app.post('/api/subleases/:id/settlement-reports', isAuthenticated, async (req, res) => {
    try {
      const parsed = insertMediaSettlementReportSchema.parse({ ...req.body, subleaseId: Number(req.params.id) });
      const created = await storage.createMediaSettlementReport(parsed);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Nieprawidłowe dane" });
    }
  });

  app.patch('/api/settlement-reports/:id', isAuthenticated, async (req, res) => {
    try {
      const updated = await storage.updateMediaSettlementReport(Number(req.params.id), req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Błąd aktualizacji" });
    }
  });

  app.patch('/api/settlement-reports/:id/status', isAuthenticated, async (req, res) => {
    try {
      const { paymentStatus } = req.body;
      if (!paymentStatus || !["NIEOPLACONE", "OPLACONE"].includes(paymentStatus)) {
        return res.status(400).json({ message: "Nieprawidłowy status płatności" });
      }
      const updated = await storage.updateMediaSettlementReportStatus(Number(req.params.id), paymentStatus);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Błąd aktualizacji" });
    }
  });

  app.delete('/api/settlement-reports/:id', isAuthenticated, async (req, res) => {
    await storage.deleteMediaSettlementReport(Number(req.params.id));
    res.status(204).send();
  });

  // Saldo
  app.get('/api/saldo/initial-balance', isAuthenticated, async (req, res) => {
    const personName = req.query.personName as string;
    if (!personName) return res.status(400).json({ message: "personName required" });
    const balance = await storage.getSaldoInitialBalance(personName);
    res.json({ personName, initialBalance: balance });
  });

  app.put('/api/saldo/initial-balance', isAuthenticated, async (req, res) => {
    const { personName, initialBalance } = req.body;
    if (!personName) return res.status(400).json({ message: "personName required" });
    await storage.setSaldoInitialBalance(personName, parseFloat(initialBalance || "0").toFixed(2));
    res.json({ success: true });
  });

  app.get('/api/saldo', isAuthenticated, async (req, res) => {
    const { startDate, endDate, personName } = req.query;
    const entries = await storage.getSaldoEntries({
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      personName: personName as string | undefined,
    });
    res.json(entries);
  });

  app.post('/api/saldo', isAuthenticated, async (req, res) => {
    try {
      const parsed = insertSaldoEntrySchema.parse(req.body);
      const entry = await storage.createSaldoEntry(parsed);
      res.status(201).json(entry);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Nieprawidłowe dane" });
    }
  });

  app.put('/api/saldo/:id', isAuthenticated, async (req, res) => {
    try {
      const parsed = insertSaldoEntrySchema.partial().parse(req.body);
      const updated = await storage.updateSaldoEntry(Number(req.params.id), parsed);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Nieprawidłowe dane" });
    }
  });

  app.get('/api/saldo/categories', isAuthenticated, async (req, res) => {
    const personName = req.query.personName as string | undefined;
    const categories = await storage.getSaldoCategories(personName);
    res.json(categories);
  });

  app.post('/api/saldo/categories', isAuthenticated, async (req, res) => {
    const { name, personName } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: "Podaj nazwę kategorii" });
    }
    await storage.createSaldoCategory(name.trim(), personName);
    res.json({ success: true });
  });

  app.put('/api/saldo/categories/:name', isAuthenticated, async (req, res) => {
    const { newName, personName } = req.body;
    if (!newName || typeof newName !== 'string') {
      return res.status(400).json({ message: "Podaj nową nazwę kategorii" });
    }
    await storage.updateSaldoCategory(req.params.name, newName.trim(), personName);
    res.json({ success: true });
  });

  app.post('/api/saldo/categories/bulk-delete', isAuthenticated, async (req, res) => {
    const { names, personName } = req.body;
    if (!Array.isArray(names) || names.length === 0) {
      return res.status(400).json({ message: "Podaj listę kategorii do usunięcia" });
    }
    for (const name of names) {
      await storage.deleteSaldoCategory(name, personName);
    }
    res.json({ success: true, deleted: names.length });
  });

  app.delete('/api/saldo/categories/:name', isAuthenticated, async (req, res) => {
    const personName = req.query.personName as string | undefined;
    await storage.deleteSaldoCategory(req.params.name, personName);
    res.status(204).send();
  });

  app.delete('/api/saldo/:id', isAuthenticated, async (req, res) => {
    await storage.deleteSaldoEntry(Number(req.params.id));
    res.status(204).send();
  });

  app.post('/api/saldo/import-xlsx', isAuthenticated, upload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "Nie wybrano pliku" });
    }
    try {
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: false });
      const sheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('saldo')) || workbook.SheetNames[0];
      const ws = workbook.Sheets[sheetName];
      const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      const headerRowIdx = data.findIndex(row =>
        row.some((c: any) => typeof c === 'string' && c.toUpperCase().includes('DATA')) &&
        row.some((c: any) => typeof c === 'string' && c.toUpperCase().includes('OPERACJI'))
      );
      const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 3;

      const entries: any[] = [];
      for (let i = startRow; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length < 9) continue;
        const rawDate = row[0];
        if (!rawDate && rawDate !== 0) continue;
        const opName = row[1]?.toString().trim();
        if (!opName) continue;

        let dateStr: string;
        if (typeof rawDate === 'number') {
          const d = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
          dateStr = d.toISOString().split('T')[0];
        } else {
          dateStr = rawDate.toString();
        }

        const cashAmt = row[8] !== '' && row[8] !== null && row[8] !== undefined ? Number(row[8]) || 0 : null;
        const saldoVal = row[9] !== '' && row[9] !== null && row[9] !== undefined ? Number(row[9]) || 0 : null;
        const cardAmt = row[11] !== '' && row[11] !== null && row[11] !== undefined ? Number(row[11]) || 0 : null;

        entries.push({
          date: dateStr,
          operationName: opName,
          reservationNumber: row[2]?.toString().trim() || null,
          guestName: row[3]?.toString().trim() || null,
          type: row[4]?.toString().trim() || null,
          paymentMethod: row[5]?.toString().trim() || null,
          kasaFiskalna: row[6]?.toString().trim() || null,
          faktura: row[7]?.toString().trim() || null,
          cashAmount: cashAmt !== null ? cashAmt.toFixed(2) : null,
          saldo: saldoVal !== null ? saldoVal.toFixed(2) : null,
          authCode: row[10]?.toString().trim() || null,
          cardAmount: cardAmt !== null ? cardAmt.toFixed(2) : null,
          notes: row[12]?.toString().trim() || null,
          personName: req.query?.personName as string || null,
        });
      }

      if (req.body?.replace === 'true' || req.query?.replace === 'true') {
        await storage.deleteAllSaldoEntries();
      }

      const created = await storage.createSaldoEntriesBulk(entries);
      res.json({ imported: created.length, sheetName });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Błąd importu" });
    }
  });

  app.delete('/api/saldo/all', isAuthenticated, async (req, res) => {
    await storage.deleteAllSaldoEntries();
    res.status(204).send();
  });

  // App Users
  app.get('/api/app-users', isAuthenticated, async (req, res) => {
    const users = await storage.getAppUsers();
    const safe = users.map(u => ({ ...u, passwordHash: undefined }));
    res.json(safe);
  });

  app.post('/api/app-users', isAuthenticated, async (req, res) => {
    try {
      const { email, firstName, lastName, password, permissions } = req.body;
      if (!email || !firstName || !lastName || !password) {
        return res.status(400).json({ message: "Wszystkie pola są wymagane" });
      }
      const existing = await storage.getAppUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "Użytkownik z tym adresem email już istnieje" });
      }
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await storage.createAppUser({ email, firstName, lastName, passwordHash, permissions: permissions || [], active: true });
      res.json({ ...user, passwordHash: undefined });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put('/api/app-users/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { email, firstName, lastName, password, permissions } = req.body;
      const data: any = {};
      if (email !== undefined) data.email = email;
      if (firstName !== undefined) data.firstName = firstName;
      if (lastName !== undefined) data.lastName = lastName;
      if (permissions !== undefined) data.permissions = permissions;
      if (password) {
        const bcrypt = await import('bcryptjs');
        data.passwordHash = await bcrypt.hash(password, 10);
      }
      const user = await storage.updateAppUser(id, data);
      res.json({ ...user, passwordHash: undefined });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete('/api/app-users/:id', isAuthenticated, async (req, res) => {
    await storage.deleteAppUser(parseInt(req.params.id));
    res.status(204).send();
  });

  // Document Categories
  app.get('/api/document-categories', isAuthenticated, async (_req, res) => {
    const categories = await storage.getDocumentCategories();
    res.json(categories);
  });

  app.post('/api/document-categories', isAuthenticated, async (req, res) => {
    try {
      const parsed = insertDocumentCategorySchema.parse(req.body);
      const category = await storage.createDocumentCategory(parsed);
      res.status(201).json(category);
    } catch (error: any) {
      if (error.name === 'ZodError') return res.status(400).json({ message: error.errors });
      res.status(500).json({ message: error.message });
    }
  });

  app.put('/api/document-categories/:id', isAuthenticated, async (req, res) => {
    try {
      const parsed = insertDocumentCategorySchema.partial().parse(req.body);
      const category = await storage.updateDocumentCategory(parseInt(req.params.id), parsed);
      res.json(category);
    } catch (error: any) {
      if (error.name === 'ZodError') return res.status(400).json({ message: error.errors });
      res.status(500).json({ message: error.message });
    }
  });

  app.delete('/api/document-categories/:id', isAuthenticated, async (req, res) => {
    await storage.deleteDocumentCategory(parseInt(req.params.id));
    res.status(204).send();
  });

  // Document Templates
  app.get('/api/document-templates', isAuthenticated, async (_req, res) => {
    const templates = await storage.getDocumentTemplates();
    res.json(templates);
  });

  app.post('/api/document-templates', isAuthenticated, async (req, res) => {
    try {
      const parsed = insertDocumentTemplateSchema.parse(req.body);
      const template = await storage.createDocumentTemplate(parsed);
      res.status(201).json(template);
    } catch (error: any) {
      if (error.name === 'ZodError') return res.status(400).json({ message: error.errors });
      res.status(500).json({ message: error.message });
    }
  });

  app.put('/api/document-templates/:id', isAuthenticated, async (req, res) => {
    try {
      const parsed = insertDocumentTemplateSchema.partial().parse(req.body);
      const template = await storage.updateDocumentTemplate(parseInt(req.params.id), parsed);
      res.json(template);
    } catch (error: any) {
      if (error.name === 'ZodError') return res.status(400).json({ message: error.errors });
      res.status(500).json({ message: error.message });
    }
  });

  app.delete('/api/document-templates/:id', isAuthenticated, async (req, res) => {
    await storage.deleteDocumentTemplate(parseInt(req.params.id));
    res.status(204).send();
  });

  // Stats
  app.get(api.stats.dashboard.path, isAuthenticated, async (req, res) => {
    const stats = await storage.getDashboardStats();
    res.json(stats);
  });

  app.get("/api/dashboard/all-sublease-payments", isAuthenticated, async (req, res) => {
    const subleases = await storage.getSubleases();
    const allPayments: any[] = [];
    for (const s of subleases) {
      const payments = await storage.getSubleasePayments(s.id);
      for (const p of payments) {
        allPayments.push({ ...p, subleaseTenantName: s.tenantName, subleaseApartmentIds: s.apartmentIds || (s.apartmentId ? [s.apartmentId] : []) });
      }
    }
    res.json(allPayments);
  });

  app.get("/api/dashboard/revenue-forecast", isAuthenticated, async (req, res) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const reservations = await storage.getReservations();

    const months: { year: number; month: number; label: string }[] = [];
    for (let i = 0; i < 12; i++) {
      months.push({ year: currentYear, month: i, label: "" });
    }

    const result = months.map(m => {
      const daysInMonth = new Date(m.year, m.month + 1, 0).getDate();
      const isCurrentMonth = m.year === now.getFullYear() && m.month === now.getMonth();
      const dayOfMonth = isCurrentMonth ? now.getDate() : (m.month < now.getMonth() && m.year === now.getFullYear() ? daysInMonth : 0);
      const daysRemaining = Math.max(0, daysInMonth - dayOfMonth);

      let actual = 0;
      for (const r of reservations) {
        if (!r.startDate || r.status === "ANULOWANA") continue;
        const sd = new Date(r.startDate);
        if (sd.getFullYear() === m.year && sd.getMonth() === m.month) {
          actual += Number(r.price) || 0;
        }
      }

      return {
        year: m.year,
        month: m.month,
        actual,
        daysInMonth,
        dayOfMonth,
        daysRemaining,
      };
    });

    res.json(result);
  });

  // Import forecast data from Excel
  app.post("/api/import-forecast", isAuthenticated, async (req, res) => {
    try {
      const filePath = path.resolve("attached_assets/BAŁTYCKIE_1771418562534.xlsx");
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Plik Excel nie został znaleziony" });
      }

      const fileBuffer = fs.readFileSync(filePath);
      const wb = XLSX.read(fileBuffer);
      const apartments = await storage.getApartments();
      const activeApts = apartments.filter(a => a.active !== false);

      const excelEpoch = new Date(1899, 11, 30).getTime();

      const SHEET_CONFIG: Record<string, { col: number; name: string; divideBy?: number; matchApts?: string[] }[]> = {};

      const sheetNames = ["Grand Baltic", "Bulwar Portowy", "Wczasowa", "Na Wydmie", "Przewłoka"];

      for (const sheetName of sheetNames) {
        const ws = wb.Sheets[sheetName];
        if (!ws) continue;
        const range = XLSX.utils.decode_range(ws["!ref"]!);
        const types: { col: number; name: string }[] = [];
        for (let c = 0; c <= range.e.c; c++) {
          const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
          if (cell && cell.v && String(cell.v) !== "PODSUMOWANIE") {
            types.push({ col: c, name: String(cell.v) });
          }
        }
        SHEET_CONFIG[sheetName] = types.slice(1).map(t => ({ col: t.col, name: t.name }));
      }

      const aptNameMap = new Map<string, number[]>();
      for (const apt of activeApts) {
        const key = apt.name.toUpperCase().trim();
        if (!aptNameMap.has(key)) aptNameMap.set(key, []);
        aptNameMap.get(key)!.push(apt.id);
      }

      const GB_SUPERIOR = activeApts.filter(a => a.location === "GRAND BALTIC" && a.name.toLowerCase().includes("superior")).map(a => a.id);
      const GB_STUDIO = activeApts.filter(a => a.location === "GRAND BALTIC" && /^\d+\s*-\s*studio$/i.test(a.name)).map(a => a.id);
      const GB_STUDIO_MINI = activeApts.filter(a => a.location === "GRAND BALTIC" && a.name.toLowerCase().includes("studio mini")).map(a => a.id);
      const GB_2OS = activeApts.filter(a => a.location === "GRAND BALTIC" && a.name.toLowerCase().includes("2os")).map(a => a.id);

      function findAptIds(excelName: string, sheetName: string): { ids: number[]; divideBy: number } {
        const upper = excelName.toUpperCase().trim();

        if (sheetName === "Grand Baltic") {
          if (upper.includes("SUPERIOR")) return { ids: GB_SUPERIOR, divideBy: 4 };
          if (upper === "STUDIO") return { ids: GB_STUDIO, divideBy: 9 };
          if (upper === "STUDIO MINI") return { ids: GB_STUDIO_MINI, divideBy: 3 };
          if (upper.includes("2-OSOBOWY") || upper.includes("2-OS")) return { ids: GB_2OS, divideBy: 2 };
        }

        const locationMap: Record<string, string> = {
          "Bulwar Portowy": "BULWAR PORTOWY",
          "Na Wydmie": "NA WYDMIE",
          "Przewłoka": "PRZEWŁOKA",
          "Wczasowa": "WCZASOWA",
        };
        const dbLocation = locationMap[sheetName] || "";

        const nameVariants: Record<string, string> = {
          "BULWAR GRAND": "BULWAR GRAND",
          "BULWAR RODZINNY": "BULWAR RODZINNY",
          "BULWAR PRESTIGE": "BULWAR PRESTIGE",
          "BULWAR VIP": "BULWAR VIP",
          "BULWAR ZACISZE": "BULWAR ZACISZE",
          "BULWAR SUN": "BULWAR SUN",
          "BULWAR AMBER": "BULWAR AMBER",
          "BULWAR MODERN": "BULWAR MODERN",
          "BULWAR MARINA": "BULWAR MARINA",
          "BULWAR GLAMOUR": "BULWAR GLAMOUR",
          "BULWAR ELEGANCE": "BULWAR ELEGANCE",
          "BULWAR PANORAMA": "BULWAR PANORAMA",
          "BULWAR PANORAMA 2": "BULWAR PANORAMA 2",
          "BULWAR 7 MÓRZ": "BULWAR 7 MÓRZ",
          "BULWAR COMFORT": "BULWAR COMFORT",
          "BULWAR DELUXE": "BULWAR DELUXE",
          "BULWAR ZACISZE 2": "BULWAR ZACISZE 2",
          "BULWAR EXCLUSIVE": "BULWAR EXCLUSIVE",
          "BULWAR SCANIA": "BULWAR SCANIA",
          "LUXURO 49-1": "49-1",
          "LUXURO 49-2": "49-2",
          "LUXURO 51-1": "51-1",
          "LUXURO 51-2": "51-2",
          "GARDEN 2": "GARDEN2",
        };

        let dbName = nameVariants[upper] || upper;

        const matched = activeApts.filter(a => {
          if (dbLocation && a.location !== dbLocation) return false;
          return a.name.toUpperCase().trim() === dbName;
        });

        if (matched.length > 0) return { ids: matched.map(a => a.id), divideBy: 1 };

        const fuzzyMatched = activeApts.filter(a => {
          if (dbLocation && a.location !== dbLocation) return false;
          const n = a.name.toUpperCase().trim();
          return n.includes(dbName) || dbName.includes(n);
        });

        if (fuzzyMatched.length === 1) return { ids: [fuzzyMatched[0].id], divideBy: 1 };

        return { ids: [], divideBy: 1 };
      }

      const result: Record<number, Record<number, Record<number, { p: number; r: number }>>> = {};

      for (const sheetName of sheetNames) {
        const ws = wb.Sheets[sheetName];
        if (!ws) continue;
        const config = SHEET_CONFIG[sheetName];
        if (!config) continue;

        for (const aptType of config) {
          const { ids, divideBy } = findAptIds(aptType.name, sheetName);
          if (ids.length === 0) continue;

          const progCol = aptType.col;
          const przychCol = aptType.col + 1;

          let currentYear = 0;
          for (let r = 2; r <= 120; r++) {
            const yearCell = ws[XLSX.utils.encode_cell({ r, c: 4 })];
            if (yearCell && typeof yearCell.v === "number" && yearCell.v >= 2020 && yearCell.v <= 2030) {
              currentYear = yearCell.v;
            }

            if (currentYear < 2022) continue;

            const dateCell = ws[XLSX.utils.encode_cell({ r, c: 5 })];
            if (!dateCell) continue;

            if (typeof dateCell.v === "string" && dateCell.v.includes("RAZEM")) continue;

            if (typeof dateCell.v !== "number") continue;

            const d = new Date(excelEpoch + dateCell.v * 86400000);
            const year = d.getFullYear();
            const month = d.getMonth();

            if (year < 2022) continue;

            const progCell = ws[XLSX.utils.encode_cell({ r, c: progCol })];
            const przychCell = ws[XLSX.utils.encode_cell({ r, c: przychCol })];

            const prognoza = (Number(progCell?.v) || 0) / divideBy;
            const przychody = (Number(przychCell?.v) || 0) / divideBy;

            if (prognoza === 0 && przychody === 0) continue;

            const roundedP = Math.round(prognoza * 100) / 100;
            const roundedR = Math.round(przychody * 100) / 100;

            for (const aptId of ids) {
              if (!result[year]) result[year] = {};
              if (!result[year][aptId]) result[year][aptId] = {};
              result[year][aptId][month] = { p: roundedP, r: roundedR };
            }
          }
        }
      }

      const summary: Record<number, number> = {};
      for (const [year, apts] of Object.entries(result)) {
        summary[Number(year)] = Object.keys(apts).length;
      }

      res.json({ data: result, summary, message: "Import prognozy zakończony pomyślnie" });
    } catch (err: any) {
      console.error("Forecast import error:", err);
      res.status(500).json({ message: "Błąd importu: " + (err.message || "Nieznany błąd") });
    }
  });

  // Import Excel
  app.post(api.imports.upload.path, isAuthenticated, upload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "Nie wybrano pliku" });
    }

    const log: string[] = [];
    let importedReservations = 0;
    let importedApartments = 0;
    let importedLeases = 0;
    let importedAccounts = 0;
    let skipped = 0;

    try {
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: false });
      log.push(`Znaleziono arkusze: ${workbook.SheetNames.join(', ')}`);

      const allApartments = await storage.getApartments();
      const apartmentMap = new Map(allApartments.map(a => [a.name.trim().toLowerCase(), a.id]));

      // Parse "Umowy najmu" sheet for apartments + leases
      const leaseSheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('umowy'));
      if (leaseSheetName) {
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[leaseSheetName]);
        log.push(`Arkusz "${leaseSheetName}": ${data.length} wierszy`);

        for (const row of data as any[]) {
          const name = row['NAZWA APARTAMENTU'] || row['Nazwa Apartamentu'] || row['nazwa apartamentu'];
          if (!name) continue;

          const nameKey = String(name).trim().toLowerCase();
          if (!apartmentMap.has(nameKey)) {
            const apt = await storage.createApartment({
              name: String(name).trim(),
              location: String(row['LOKALIZACJA'] || row['Lokalizacja'] || '').trim(),
              address: String(row['ADRES'] || row['Adres'] || '').trim(),
              ownerName: String(row['WLASCICIEL'] || row['Wlasciciel'] || row['WŁAŚCICIEL'] || '').trim(),
              active: true
            });
            apartmentMap.set(nameKey, apt.id);
            importedApartments++;
          }

          const startDate = excelDateToISO(row['POCZATEK UMOWY'] || row['POCZĄTEK UMOWY'] || row['Poczatek umowy']);
          const rentAmount = row['KWOTA NAJMU'] || row['Kwota najmu'];

          if (startDate && rentAmount) {
            const endDate = excelDateToISO(row['KONIEC UMOWY'] || row['Koniec umowy']);
            await storage.createLease({
              apartmentId: apartmentMap.get(nameKey)!,
              startDate,
              endDate: endDate || null,
              rentAmount: String(rentAmount),
              communityFee: String(row['CZYNSZ DO WSPOLNOTY'] || row['CZYNSZ DO WSPÓLNOTY'] || 0),
              tenantName: String(row['NAJEMCA'] || row['Najemca'] || '').trim(),
              description: null,
            });
            importedLeases++;
          }
        }
      }

      // Parse reservation sheets
      const reservationSheets = workbook.SheetNames.filter(n => n.toLowerCase().includes('rezerwacj'));
      for (const sheetName of reservationSheets) {
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        log.push(`Arkusz "${sheetName}": ${data.length} wierszy`);

        const batch: any[] = [];
        for (const row of data as any[]) {
          const aptName = row['Apartament'] || row['APARTAMENT'];
          if (!aptName) { skipped++; continue; }

          const nameKey = String(aptName).trim().toLowerCase();
          let aptId = apartmentMap.get(nameKey);
          if (!aptId) {
            const apt = await storage.createApartment({
              name: String(aptName).trim(),
              location: '',
              address: '',
              ownerName: '',
              active: true
            });
            apartmentMap.set(nameKey, apt.id);
            aptId = apt.id;
            importedApartments++;
          }

          const status = String(row['Status'] || row['STATUS'] || '').toUpperCase();
          const startDate = excelDateToISO(row['Data Przyjazdu'] || row['DATA PRZYJAZDU']);
          const endDate = excelDateToISO(row['Data Wyjazdu'] || row['DATA WYJAZDU']);

          if (!startDate || !endDate) { skipped++; continue; }

          const mappedStatus = status.includes('ANUL') ? 'ANULOWANA' : status.includes('PRZYJ') ? 'PRZYJETA' : status.includes('OPLAC') || status.includes('OPŁAC') ? 'DO_OPLACENIA' : status || 'DO_OPLACENIA';

          batch.push({
            reservationNumber: String(row['Numer Rezerwacji'] || row['NUMER REZERWACJI'] || `IMP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
            apartmentId: aptId,
            startDate,
            endDate,
            guestName: String(row['Gość'] || row['GOSC'] || row['GOŚĆ'] || 'Nieznany').trim(),
            price: String(row['Cena'] || row['CENA'] || 0),
            prepayment: String(row['Przedplata'] || row['PRZEDPŁATA'] || row['Przedpłata'] || 0),
            surcharge: String(row['Doplata'] || row['DOPŁATA'] || row['Dopłata'] || 0),
            status: mappedStatus,
          });
        }

        if (batch.length > 0) {
          await storage.createReservationsBulk(batch);
          importedReservations += batch.length;
        }
      }

      // Parse "Saldo" sheet for accounts
      const saldoSheet = workbook.SheetNames.find(n => n.toLowerCase().includes('saldo'));
      if (saldoSheet) {
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[saldoSheet], { header: 1 }) as any[][];
        log.push(`Arkusz "${saldoSheet}": ${data.length} wierszy`);

        const knownAccountNames = ['PEKAO SA', 'SANTANDER', 'SANTANDER VAT', 'POZYCZKI', 'POŻYCZKI'];
        for (const rowArr of data) {
          if (!rowArr || rowArr.length < 2) continue;
          for (let i = 0; i < rowArr.length; i++) {
            const cellVal = String(rowArr[i] || '').trim().toUpperCase();
            const matched = knownAccountNames.find(n => cellVal.includes(n));
            if (matched) {
              for (let j = i + 1; j < rowArr.length; j++) {
                const numVal = Number(rowArr[j]);
                if (!isNaN(numVal) && numVal !== 0) {
                  let existingAccounts = await storage.getAccounts();
                  let acc = existingAccounts.find(a => a.name.toUpperCase() === matched);
                  if (!acc) {
                    acc = await storage.createAccount({ name: matched, type: 'BANK' });
                    importedAccounts++;
                  }
                  await storage.createSnapshot({
                    accountId: acc.id,
                    date: new Date().toISOString().split('T')[0],
                    balance: String(numVal),
                    notes: 'Zaimportowano z Excela',
                  });
                  break;
                }
              }
              break;
            }
          }
        }
      }

      log.push(`Podsumowanie: apartamenty=${importedApartments}, rezerwacje=${importedReservations}, umowy=${importedLeases}, konta=${importedAccounts}, pominieto=${skipped}`);

      res.json({
        message: "Import zakończony pomyślnie",
        imported: {
          reservations: importedReservations,
          apartments: importedApartments,
          leases: importedLeases,
          accounts: importedAccounts,
          skipped,
        },
        log,
      });

    } catch (e: any) {
      console.error(e);
      res.status(500).json({ message: `Błąd importu: ${e.message}` });
    }
  });

  // Last import metadata
  app.get('/api/import-metadata/last/:type', isAuthenticated, async (req, res) => {
    try {
      const result = await storage.getLastImport(req.params.type);
      res.json(result || null);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // HotRes CSV Import
  app.post("/api/hotres/import-csv", isAuthenticated, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: "Nie przesłano pliku CSV" });
      }

      const csvContent = req.file.buffer.toString("utf-8");
      const { parseHotResCsv } = await import("./hotres");
      const parsed = parseHotResCsv(csvContent);

      if (parsed.length === 0) {
        return res.json({
          success: false,
          message: "Nie znaleziono rezerwacji w pliku CSV. Sprawdź format pliku (nagłówki kolumn).",
          imported: 0,
          skipped: 0,
        });
      }

      const apartments = await storage.getApartments();
      const apartmentMap = new Map(apartments.map(a => [a.name.trim().toLowerCase(), a.id]));
      const hotresNameMap = new Map(apartments.filter(a => a.hotresName).map(a => [a.hotresName!.trim().toLowerCase(), a.id]));

      let imported = 0;
      let updated = 0;
      let skipped = 0;
      let newApartments = 0;
      const log: string[] = [];

      log.push(`Znaleziono ${parsed.length} rezerwacji w pliku CSV`);

      for (const hr of parsed) {
        if (!hr.startDate || !hr.endDate) {
          skipped++;
          log.push(`Pominięto rezerwację ${hr.reservationNumber}: brak dat`);
          continue;
        }

        const resolvedAptIds: number[] = [];
        if (hr.apartmentName) {
          const aptNames = hr.apartmentName.split(/[,+\/]/).map(s => s.trim()).filter(Boolean);
          for (const aptName of aptNames) {
            const key = aptName.toLowerCase();
            let foundId = hotresNameMap.get(key) || apartmentMap.get(key);
            if (!foundId) {
              const apt = await storage.createApartment({
                name: aptName,
                location: "",
                address: "",
                ownerName: "",
                active: true,
              });
              apartmentMap.set(key, apt.id);
              foundId = apt.id;
              newApartments++;
              log.push(`Utworzono apartament: ${aptName}`);
            }
            if (!resolvedAptIds.includes(foundId)) {
              resolvedAptIds.push(foundId);
            }
          }
        }

        const primaryAptId = resolvedAptIds.length > 0 ? resolvedAptIds[0] : null;
        const isGroupReservation = resolvedAptIds.length > 1;

        const existing = await storage.getReservationByNumber(hr.reservationNumber);
        if (existing) {
          await storage.updateReservation(existing.id, {
            apartmentId: primaryAptId,
            apartmentIds: isGroupReservation ? resolvedAptIds : null,
            startDate: hr.startDate,
            endDate: hr.endDate,
            guestName: hr.guestName,
            price: hr.price,
            prepayment: hr.prepayment || "0",
            paidAmount: hr.paidAmount || "0",
            status: hr.status,
          });
          updated++;
          continue;
        }

        await storage.createReservation({
          reservationNumber: hr.reservationNumber,
          apartmentId: primaryAptId,
          apartmentIds: isGroupReservation ? resolvedAptIds : null,
          addDate: hr.addDate || null,
          startDate: hr.startDate,
          endDate: hr.endDate,
          guestName: hr.guestName,
          price: hr.price,
          prepayment: hr.prepayment || "0",
          paidAmount: hr.paidAmount || "0",
          surcharge: "0",
          status: hr.status,
        });
        imported++;
        if (isGroupReservation) {
          const aptNamesList = resolvedAptIds.map(id => {
            const apt = apartments.find(a => a.id === id);
            return apt?.name || `ID:${id}`;
          }).join(", ");
          log.push(`Rezerwacja grupowa ${hr.reservationNumber}: ${aptNamesList}`);
        }
      }

      if (updated > 0) {
        log.push(`Zaktualizowano ${updated} istniejących rezerwacji`);
      }
      log.push(`Podsumowanie: nowe=${imported}, zaktualizowane=${updated}, pominięte=${skipped}, nowe apartamenty=${newApartments}`);

      await storage.saveImportMetadata({
        importType: 'hotres_csv',
        recordsImported: imported,
        recordsUpdated: updated,
        recordsSkipped: skipped,
        details: `Plik CSV: nowe=${imported}, zaktualizowane=${updated}, pominięte=${skipped}`,
      });

      res.json({
        success: true,
        message: `Import CSV HotRes: ${imported} nowych, ${updated} zaktualizowanych${skipped > 0 ? `, ${skipped} pominiętych` : ""}`,
        imported,
        updated,
        skipped,
        newApartments,
        log,
      });
    } catch (e: any) {
      console.error("HotRes CSV import error:", e);
      res.status(500).json({ success: false, message: `Błąd importu CSV: ${e.message}` });
    }
  });

  // HotRes API Integration
  app.get("/api/hotres/test", isAuthenticated, async (req, res) => {
    try {
      const result = await testConnection();
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post("/api/hotres/sync", isAuthenticated, async (req, res) => {
    try {
      const { dateFrom, dateTo } = req.body || {};
      const result = await fetchReservations(dateFrom, dateTo);

      if (!result.success || result.reservations.length === 0) {
        return res.json({
          success: result.success,
          message: result.message,
          imported: 0,
          skipped: 0,
          rawResponse: result.rawResponse,
        });
      }

      const apartments = await storage.getApartments();
      const apartmentMap = new Map(apartments.map(a => [a.name.trim().toLowerCase(), a.id]));
      const hotresNameMap = new Map(apartments.filter(a => a.hotresName).map(a => [a.hotresName!.trim().toLowerCase(), a.id]));

      let imported = 0;
      let updated = 0;
      let skipped = 0;
      let newApartments = 0;
      const log: string[] = [];

      for (const hr of result.reservations) {
        if (!hr.startDate || !hr.endDate) {
          skipped++;
          log.push(`Pominięto rezerwację ${hr.reservationNumber}: brak dat`);
          continue;
        }

        const resolvedAptIds: number[] = [];
        if (hr.apartmentName) {
          const aptNames = hr.apartmentName.split(/[,+\/]/).map(s => s.trim()).filter(Boolean);
          for (const aptName of aptNames) {
            const key = aptName.toLowerCase();
            let foundId = hotresNameMap.get(key) || apartmentMap.get(key);
            if (!foundId) {
              const apt = await storage.createApartment({
                name: aptName,
                location: "",
                address: "",
                ownerName: "",
                active: true,
              });
              apartmentMap.set(key, apt.id);
              foundId = apt.id;
              newApartments++;
              log.push(`Utworzono apartament: ${aptName}`);
            }
            if (!resolvedAptIds.includes(foundId)) {
              resolvedAptIds.push(foundId);
            }
          }
        }

        const primaryAptId = resolvedAptIds.length > 0 ? resolvedAptIds[0] : null;
        const isGroupReservation = resolvedAptIds.length > 1;

        const existing = await storage.getReservationByNumber(hr.reservationNumber);
        if (existing) {
          await storage.updateReservation(existing.id, {
            apartmentId: primaryAptId,
            apartmentIds: isGroupReservation ? resolvedAptIds : null,
            startDate: hr.startDate,
            endDate: hr.endDate,
            guestName: hr.guestName,
            price: hr.price,
            prepayment: hr.prepayment || "0",
            paidAmount: hr.paidAmount || "0",
            status: hr.status,
          });
          updated++;
          continue;
        }

        await storage.createReservation({
          reservationNumber: hr.reservationNumber,
          apartmentId: primaryAptId,
          apartmentIds: isGroupReservation ? resolvedAptIds : null,
          addDate: hr.addDate || null,
          startDate: hr.startDate,
          endDate: hr.endDate,
          guestName: hr.guestName,
          price: hr.price,
          prepayment: hr.prepayment || "0",
          paidAmount: hr.paidAmount || "0",
          surcharge: "0",
          status: hr.status,
        });
        imported++;
      }

      if (updated > 0) {
        log.push(`Zaktualizowano ${updated} istniejących rezerwacji`);
      }
      log.push(`Podsumowanie: nowe=${imported}, zaktualizowane=${updated}, pominięte=${skipped}, nowe apartamenty=${newApartments}`);

      await storage.saveImportMetadata({
        importType: 'hotres_api',
        recordsImported: imported,
        recordsUpdated: updated,
        recordsSkipped: skipped,
        details: `API sync: nowe=${imported}, zaktualizowane=${updated}, pominięte=${skipped}`,
      });

      res.json({
        success: true,
        message: `Synchronizacja HotRes: ${imported} nowych, ${updated} zaktualizowanych${skipped > 0 ? `, ${skipped} pominiętych` : ""}`,
        imported,
        updated,
        skipped,
        newApartments,
        log,
      });
    } catch (e: any) {
      console.error("HotRes sync error:", e);
      res.status(500).json({ success: false, message: `Błąd synchronizacji: ${e.message}` });
    }
  });

  // Cost Schedules
  app.get('/api/cost-schedules', isAuthenticated, async (_req, res) => {
    const schedules = await storage.getCostSchedules();
    res.json(schedules);
  });

  app.post('/api/cost-schedules', isAuthenticated, async (req, res) => {
    const parsed = insertCostScheduleSchema.parse(req.body);
    const schedule = await storage.createCostSchedule(parsed);
    res.json(schedule);
  });

  app.patch('/api/cost-schedules/:id', isAuthenticated, async (req, res) => {
    const schedule = await storage.updateCostSchedule(Number(req.params.id), req.body);
    res.json(schedule);
  });

  app.delete('/api/cost-schedules/:id', isAuthenticated, async (req, res) => {
    await storage.deleteCostSchedule(Number(req.params.id));
    res.json({ success: true });
  });

  app.get('/api/cost-schedule-payments', isAuthenticated, async (_req, res) => {
    const payments = await storage.getAllCostSchedulePayments();
    res.json(payments);
  });

  app.get('/api/cost-schedules/:id/payments', isAuthenticated, async (req, res) => {
    const payments = await storage.getCostSchedulePayments(Number(req.params.id));
    res.json(payments);
  });

  app.post('/api/cost-schedule-payments', isAuthenticated, async (req, res) => {
    const parsed = insertCostSchedulePaymentSchema.parse(req.body);
    const payment = await storage.createCostSchedulePayment(parsed);
    res.json(payment);
  });

  app.patch('/api/cost-schedule-payments/:id', isAuthenticated, async (req, res) => {
    const payment = await storage.updateCostSchedulePayment(Number(req.params.id), req.body);
    res.json(payment);
  });

  app.delete('/api/cost-schedule-payments/:id', isAuthenticated, async (req, res) => {
    await storage.deleteCostSchedulePayment(Number(req.params.id));
    res.json({ success: true });
  });

  // Installment Schedules
  app.get('/api/installment-schedules', isAuthenticated, async (_req, res) => {
    const schedules = await storage.getInstallmentSchedules();
    res.json(schedules);
  });

  app.post('/api/installment-schedules', isAuthenticated, async (req, res) => {
    const parsed = insertInstallmentScheduleSchema.parse(req.body);
    const schedule = await storage.createInstallmentSchedule(parsed);
    res.json(schedule);
  });

  app.patch('/api/installment-schedules/:id', isAuthenticated, async (req, res) => {
    const schedule = await storage.updateInstallmentSchedule(Number(req.params.id), req.body);
    res.json(schedule);
  });

  app.delete('/api/installment-schedules/:id', isAuthenticated, async (req, res) => {
    await storage.deleteInstallmentSchedule(Number(req.params.id));
    res.json({ success: true });
  });

  app.get('/api/installment-payments', isAuthenticated, async (_req, res) => {
    const payments = await storage.getAllInstallmentPayments();
    res.json(payments);
  });

  app.get('/api/installment-schedules/:id/payments', isAuthenticated, async (req, res) => {
    const payments = await storage.getInstallmentPayments(Number(req.params.id));
    res.json(payments);
  });

  app.post('/api/installment-payments', isAuthenticated, async (req, res) => {
    const parsed = insertInstallmentPaymentSchema.parse(req.body);
    const payment = await storage.createInstallmentPayment(parsed);
    res.json(payment);
  });

  app.patch('/api/installment-payments/:id', isAuthenticated, async (req, res) => {
    const payment = await storage.updateInstallmentPayment(Number(req.params.id), req.body);
    res.json(payment);
  });

  app.delete('/api/installment-payments/:id', isAuthenticated, async (req, res) => {
    await storage.deleteInstallmentPayment(Number(req.params.id));
    res.json({ success: true });
  });

  return httpServer;
}
