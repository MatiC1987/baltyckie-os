import type { Express } from "express";
import type { Server } from "http";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { insertBlockadeSchema, insertSaldoEntrySchema, insertSubleaseSchema, insertSubleasePaymentSchema } from "@shared/schema";
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
    { name: "Pekao SA", type: "BANK" },
    { name: "Santander", type: "BANK" },
    { name: "Gotówka", type: "CASH" },
    { name: "Saldo - M. Latasiewicz", type: "BANK" },
    { name: "Saldo - J. Głodkowska", type: "BANK" },
    { name: "Kryptowaluty", type: "BANK" },
    { name: "Pożyczki", type: "LOAN" },
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
    res.json(balance);
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
      const updated = await storage.updateSublease(Number(req.params.id), req.body);
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

  // Saldo
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

  app.get('/api/saldo/categories', isAuthenticated, async (_req, res) => {
    const categories = await storage.getSaldoCategories();
    res.json(categories);
  });

  app.post('/api/saldo/categories', isAuthenticated, async (req, res) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: "Podaj nazwę kategorii" });
    }
    await storage.createSaldoCategory(name.trim());
    res.json({ success: true });
  });

  app.put('/api/saldo/categories/:name', isAuthenticated, async (req, res) => {
    const { newName } = req.body;
    if (!newName || typeof newName !== 'string') {
      return res.status(400).json({ message: "Podaj nową nazwę kategorii" });
    }
    await storage.updateSaldoCategory(req.params.name, newName.trim());
    res.json({ success: true });
  });

  app.post('/api/saldo/categories/bulk-delete', isAuthenticated, async (req, res) => {
    const { names } = req.body;
    if (!Array.isArray(names) || names.length === 0) {
      return res.status(400).json({ message: "Podaj listę kategorii do usunięcia" });
    }
    for (const name of names) {
      await storage.deleteSaldoCategory(name);
    }
    res.json({ success: true, deleted: names.length });
  });

  app.delete('/api/saldo/categories/:name', isAuthenticated, async (req, res) => {
    await storage.deleteSaldoCategory(req.params.name);
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

  // Stats
  app.get(api.stats.dashboard.path, isAuthenticated, async (req, res) => {
    const stats = await storage.getDashboardStats();
    res.json(stats);
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

      const existingReservations = await storage.getReservations();
      const existingNumbers = new Set(existingReservations.map(r => r.reservationNumber));

      let imported = 0;
      let skipped = 0;
      let duplicates = 0;
      let newApartments = 0;
      const log: string[] = [];

      log.push(`Znaleziono ${parsed.length} rezerwacji w pliku CSV`);

      for (const hr of parsed) {
        if (!hr.startDate || !hr.endDate) {
          skipped++;
          log.push(`Pominięto rezerwację ${hr.reservationNumber}: brak dat`);
          continue;
        }

        if (existingNumbers.has(hr.reservationNumber)) {
          duplicates++;
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
        existingNumbers.add(hr.reservationNumber);
      }

      if (duplicates > 0) {
        log.push(`Pominięto ${duplicates} duplikatów (już istnieją w bazie)`);
      }
      log.push(`Podsumowanie: zaimportowano=${imported}, pominięto=${skipped}, duplikaty=${duplicates}, nowe apartamenty=${newApartments}`);

      res.json({
        success: true,
        message: `Zaimportowano ${imported} rezerwacji z pliku CSV HotRes${duplicates > 0 ? ` (${duplicates} duplikatów pominięto)` : ""}`,
        imported,
        skipped,
        duplicates,
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

      const existingReservations = await storage.getReservations();
      const existingNumbers = new Set(existingReservations.map(r => r.reservationNumber));

      let imported = 0;
      let skipped = 0;
      let duplicates = 0;
      let newApartments = 0;
      const log: string[] = [];

      for (const hr of result.reservations) {
        if (!hr.startDate || !hr.endDate) {
          skipped++;
          log.push(`Pominięto rezerwację ${hr.reservationNumber}: brak dat`);
          continue;
        }

        if (existingNumbers.has(hr.reservationNumber)) {
          duplicates++;
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

      if (duplicates > 0) {
        log.push(`Pominięto ${duplicates} duplikatów (już istnieją w bazie)`);
      }
      log.push(`Podsumowanie: zaimportowano=${imported}, pominięto=${skipped}, duplikaty=${duplicates}, nowe apartamenty=${newApartments}`);

      res.json({
        success: true,
        message: `Zaimportowano ${imported} rezerwacji z HotRes${duplicates > 0 ? ` (${duplicates} duplikatów pominięto)` : ""}`,
        imported,
        skipped,
        duplicates,
        newApartments,
        log,
      });
    } catch (e: any) {
      console.error("HotRes sync error:", e);
      res.status(500).json({ success: false, message: `Błąd synchronizacji: ${e.message}` });
    }
  });

  return httpServer;
}
