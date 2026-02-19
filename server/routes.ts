import type { Express } from "express";
import type { Server } from "http";
import * as fs from "fs";
import * as path from "path";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { insertBlockadeSchema, insertSaldoEntrySchema, insertSubleaseSchema, insertSubleasePaymentSchema, insertSubleaseApartmentChangeSchema, insertDocumentCategorySchema, insertDocumentTemplateSchema, insertSubleaseMeterReadingSchema, insertSubleaseMeterSettingSchema, insertSubleaseMeterPriceSchema, insertMediaSettlementReportSchema, insertCostScheduleSchema, insertCostSchedulePaymentSchema, insertInstallmentScheduleSchema, insertInstallmentPaymentSchema, insertServiceContractAttachmentSchema, insertInvoiceSchema, insertRevenueForecastSchema, userPreferences, costSchedulePayments, subleasePayments, medicalExams, employees, leases, subleases, reservations, apartments, expenses, accounts, accountSnapshots, activityLogs, owners, blockades, locations, serviceContracts, serviceContractCategories, saldoEntries, saldoInitialBalances, saldoCategories, installmentPayments, installmentSchedules, costSchedules, documentCategories, documentTemplates, appUsers, attachments, subleaseAttachments, subleaseApartmentChanges, subleaseMeterReadings, subleaseMeterSettings, subleaseMeterPrices, mediaSettlementReports, ownerPayments, serviceContractAttachments, importMetadata, invoices, notifications } from "@shared/schema";
import { eq, and, lt, lte, gte, ne, sql, count, desc } from "drizzle-orm";
import { db } from "./db";
import { z } from "zod";
import multer from "multer";
import * as XLSX from "xlsx";
import { testConnection, fetchReservations } from "./hotres";
import { execSync } from "child_process";
import os from "os";
import OpenAI from "openai";

const upload = multer({ storage: multer.memoryStorage() });

async function logActivity(req: any, action: string, entityType: string, entityId?: number, entityName?: string, details?: string) {
  try {
    const user = req.user;
    await storage.createActivityLog({
      userId: user?.id || null,
      userName: user?.username || user?.firstName || null,
      action,
      entityType,
      entityId: entityId || null,
      entityName: entityName || null,
      details: details || null,
    });
  } catch (e) {}
}

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

  app.get("/api/user-preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [pref] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
      res.json(pref || null);
    } catch (err) {
      res.status(500).json({ message: "Failed to load preferences" });
    }
  });

  app.put("/api/user-preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { sidebarLayout, sidebarCollapsed, sidebarLabels } = req.body;
      const [existing] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
      if (existing) {
        const updates: any = { updatedAt: new Date() };
        if (sidebarLayout !== undefined) updates.sidebarLayout = sidebarLayout;
        if (sidebarCollapsed !== undefined) updates.sidebarCollapsed = sidebarCollapsed;
        if (sidebarLabels !== undefined) updates.sidebarLabels = sidebarLabels;
        await db.update(userPreferences).set(updates).where(eq(userPreferences.userId, userId));
      } else {
        await db.insert(userPreferences).values({
          userId,
          sidebarLayout: sidebarLayout || null,
          sidebarCollapsed: sidebarCollapsed || null,
          sidebarLabels: sidebarLabels || null,
        });
      }
      const [updated] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to save preferences" });
    }
  });

  app.get("/api/overdue-counts", isAuthenticated, async (_req, res) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const [costResult] = await db.select({ count: sql<number>`count(*)` })
        .from(costSchedulePayments)
        .where(and(ne(costSchedulePayments.status, "OPLACONE"), lt(costSchedulePayments.dueDate, today)));
      const [subleaseResult] = await db.select({ count: sql<number>`count(*)` })
        .from(subleasePayments)
        .where(and(ne(subleasePayments.status, "oplacone"), lt(subleasePayments.dueDate, today)));
      res.json({
        costs: Number(costResult?.count || 0),
        subleases: Number(subleaseResult?.count || 0),
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to get overdue counts" });
    }
  });

  app.get("/api/dashboard-reminders", isAuthenticated, async (_req, res) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const in30days = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

      let expiringExamsResult: any[] = [];
      let overdueCostsCount = 0;
      let overdueSubleaseCount = 0;
      let upcomingArrivalsResult: any[] = [];
      let expiringLeasesResult: any[] = [];
      let expiringSubleaseResult: any[] = [];

      try {
        const rows = await db.select({
          id: medicalExams.id,
          examName: medicalExams.examName,
          validUntil: medicalExams.validUntil,
          employeeFirstName: employees.firstName,
          employeeLastName: employees.lastName,
        })
          .from(medicalExams)
          .innerJoin(employees, eq(medicalExams.employeeId, employees.id))
          .where(lte(medicalExams.validUntil, in30days));
        expiringExamsResult = rows;
      } catch (e) { /* table may not exist yet */ }

      try {
        const rows = await db.select({ count: sql<number>`count(*)` })
          .from(costSchedulePayments)
          .where(and(ne(costSchedulePayments.status, "OPLACONE"), lt(costSchedulePayments.dueDate, today)));
        overdueCostsCount = Number(rows[0]?.count || 0);
      } catch (e) { /* ignore */ }

      try {
        const rows = await db.select({ count: sql<number>`count(*)` })
          .from(subleasePayments)
          .where(and(ne(subleasePayments.status, "oplacone"), lt(subleasePayments.dueDate, today)));
        overdueSubleaseCount = Number(rows[0]?.count || 0);
      } catch (e) { /* ignore */ }

      try {
        upcomingArrivalsResult = await db.select({
          id: reservations.id,
          guestName: reservations.guestName,
          startDate: reservations.startDate,
          apartmentId: reservations.apartmentId,
        })
          .from(reservations)
          .where(and(
            gte(reservations.startDate, today),
            lte(reservations.startDate, in30days),
            ne(reservations.status, "ANULOWANA"),
          ));
      } catch (e) { /* ignore */ }

      try {
        expiringLeasesResult = await db.select({
          id: leases.id,
          tenantName: leases.tenantName,
          endDate: leases.endDate,
          apartmentId: leases.apartmentId,
        })
          .from(leases)
          .where(and(lte(leases.endDate, in30days), gte(leases.endDate, today)));
      } catch (e) { /* ignore */ }

      try {
        expiringSubleaseResult = await db.select({
          id: subleases.id,
          tenantName: subleases.tenantName,
          endDate: subleases.endDate,
          apartmentId: subleases.apartmentId,
        })
          .from(subleases)
          .where(and(lte(subleases.endDate, in30days), gte(subleases.endDate, today)));
      } catch (e) { /* ignore */ }

      res.json({
        expiringExams: expiringExamsResult.map(e => ({
          id: e.id,
          examName: e.examName,
          validUntil: e.validUntil,
          employeeName: `${e.employeeFirstName} ${e.employeeLastName}`,
        })),
        overdueCosts: overdueCostsCount,
        overdueSubleasePayments: overdueSubleaseCount,
        upcomingArrivals: upcomingArrivalsResult.length,
        expiringLeases: expiringLeasesResult,
        expiringSubleases: expiringSubleaseResult,
      });
    } catch (err) {
      console.error("Dashboard reminders error:", err);
      res.status(500).json({ message: "Failed to get reminders" });
    }
  });

  app.get("/api/occupancy-rates", isAuthenticated, async (req, res) => {
    try {
      const year = Number(req.query.year) || new Date().getFullYear();
      const month = req.query.month ? Number(req.query.month) : undefined;

      const allApartments = await db.select({ id: apartments.id, name: apartments.name }).from(apartments);

      let startDate: string, endDate: string;
      if (month) {
        startDate = `${year}-${String(month).padStart(2, "0")}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        endDate = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;
      } else {
        startDate = `${year}-01-01`;
        endDate = `${year}-12-31`;
      }

      const totalDays = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1;

      const allReservations = await db.select({
        apartmentId: reservations.apartmentId,
        startDate: reservations.startDate,
        endDate: reservations.endDate,
      })
        .from(reservations)
        .where(and(
          lte(reservations.startDate, endDate),
          gte(reservations.endDate, startDate),
          ne(reservations.status, "ANULOWANA"),
        ));

      const result = allApartments.map(apt => {
        const aptReservations = allReservations.filter(r => r.apartmentId === apt.id);
        let occupiedDays = 0;
        for (const r of aptReservations) {
          const rStart = new Date(Math.max(new Date(r.startDate).getTime(), new Date(startDate).getTime()));
          const rEnd = new Date(Math.min(new Date(r.endDate).getTime(), new Date(endDate).getTime()));
          occupiedDays += Math.max(0, Math.ceil((rEnd.getTime() - rStart.getTime()) / 86400000));
        }
        return {
          apartmentId: apt.id,
          apartmentName: apt.name,
          occupiedDays,
          totalDays,
          rate: totalDays > 0 ? Math.round((occupiedDays / totalDays) * 100) : 0,
        };
      });

      const totalOccupied = result.reduce((s, r) => s + r.occupiedDays, 0);
      const totalPossible = result.reduce((s, r) => s + r.totalDays, 0);

      res.json({
        apartments: result,
        overall: {
          rate: totalPossible > 0 ? Math.round((totalOccupied / totalPossible) * 100) : 0,
          occupiedDays: totalOccupied,
          totalDays: totalPossible,
        },
      });
    } catch (err) {
      console.error("Occupancy rates error:", err);
      res.status(500).json({ message: "Failed to calculate occupancy rates" });
    }
  });

  app.get("/api/profitability", isAuthenticated, async (req, res) => {
    try {
      const year = Number(req.query.year) || new Date().getFullYear();
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      const allApartments = await db.select({ id: apartments.id, name: apartments.name }).from(apartments);

      const yearReservations = await db.select({
        apartmentId: reservations.apartmentId,
        price: reservations.price,
      })
        .from(reservations)
        .where(and(
          gte(reservations.startDate, startDate),
          lte(reservations.startDate, endDate),
          ne(reservations.status, "ANULOWANA"),
        ));

      const result = allApartments.map(apt => {
        const aptReservations = yearReservations.filter(r => r.apartmentId === apt.id);
        const revenue = aptReservations.reduce((s, r) => s + Number(r.price || 0), 0);
        return {
          apartmentId: apt.id,
          apartmentName: apt.name,
          revenue,
          reservationCount: aptReservations.length,
        };
      });

      result.sort((a, b) => b.revenue - a.revenue);

      res.json({
        apartments: result,
        totalRevenue: result.reduce((s, r) => s + r.revenue, 0),
      });
    } catch (err) {
      console.error("Profitability error:", err);
      res.status(500).json({ message: "Failed to calculate profitability" });
    }
  });

  app.get("/api/year-comparison", isAuthenticated, async (req, res) => {
    try {
      const currentYear = new Date().getFullYear();
      const years = [currentYear - 2, currentYear - 1, currentYear];

      const result: Record<number, number[]> = {};

      for (const year of years) {
        const monthlyRevenue: number[] = new Array(12).fill(0);

        const yearReservations = await db.select({
          startDate: reservations.startDate,
          price: reservations.price,
        })
          .from(reservations)
          .where(and(
            gte(reservations.startDate, `${year}-01-01`),
            lte(reservations.startDate, `${year}-12-31`),
            ne(reservations.status, "ANULOWANA"),
          ));

        for (const r of yearReservations) {
          const month = new Date(r.startDate).getMonth();
          monthlyRevenue[month] += Number(r.price || 0);
        }

        result[year] = monthlyRevenue;
      }

      res.json({ years, data: result });
    } catch (err) {
      console.error("Year comparison error:", err);
      res.status(500).json({ message: "Failed to get year comparison" });
    }
  });

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
      logActivity(req, "create", "reservation", reservation.id, reservation.guestName, `Nr: ${reservation.reservationNumber}`);
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
      logActivity(req, "update", "reservation", reservation.id, reservation.guestName);
      res.json(reservation);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.delete(api.reservations.delete.path, isAuthenticated, async (req, res) => {
    await storage.deleteReservation(Number(req.params.id));
    logActivity(req, "delete", "reservation", Number(req.params.id));
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
      logActivity(req, "create", "expense", expense.id, input.description);
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

    const allChangesRaw = await storage.getAllSubleaseApartmentChanges();
    const allApartmentChanges: Record<number, any[]> = {};
    for (const ch of allChangesRaw) {
      if (!allApartmentChanges[ch.subleaseId]) allApartmentChanges[ch.subleaseId] = [];
      allApartmentChanges[ch.subleaseId].push(ch);
    }

    const resolveAptIds = (s: any, dueDate: string, paymentAptId: number | null): number[] => {
      if (paymentAptId) return [paymentAptId];
      const baseIds = s.apartmentIds && s.apartmentIds.length > 0
        ? [...s.apartmentIds]
        : (s.apartmentId ? [s.apartmentId] : []);
      const changes = allApartmentChanges[s.id] || [];
      const resolved = baseIds.map((id: number) => {
        let currentId = id;
        for (const ch of changes) {
          if (ch.oldApartmentId === currentId && dueDate >= ch.changeDate) {
            currentId = ch.newApartmentId;
          }
        }
        return currentId;
      });
      return resolved;
    };

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
        const payAptIds = resolveAptIds(s, p.dueDate, p.apartmentId);

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
      const data = { ...req.body };
      if (data.rentAmount === "" || data.rentAmount === undefined) data.rentAmount = null;
      if (data.additionalFees === "" || data.additionalFees === undefined) data.additionalFees = null;
      if (data.depositAmount === "" || data.depositAmount === undefined) data.depositAmount = null;
      if (data.depositReturnDate === "") data.depositReturnDate = null;
      if (data.status === "W_TRAKCIE_PODPISYWANIA" && !data.preparedAt) {
        data.preparedAt = new Date();
      }
      if (typeof data.preparedAt === "string") {
        data.preparedAt = new Date(data.preparedAt);
      }
      const parsed = insertSubleaseSchema.parse(data);
      const created = await storage.createSublease(parsed);
      logActivity(req, "create", "sublease", created.id, parsed.firstName ? `${parsed.firstName} ${parsed.lastName || ""}` : parsed.companyName || undefined);
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
      if (data.depositAmount === "" || data.depositAmount === undefined) data.depositAmount = null;
      if (data.depositReturnDate === "") data.depositReturnDate = null;
      if (typeof data.preparedAt === "string") {
        data.preparedAt = new Date(data.preparedAt);
      }
      const updated = await storage.updateSublease(Number(req.params.id), data);
      logActivity(req, "update", "sublease", updated.id);
      res.status(200).json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Błąd aktualizacji" });
    }
  });

  app.delete('/api/subleases/:id', isAuthenticated, async (req, res) => {
    await storage.deleteSublease(Number(req.params.id));
    logActivity(req, "delete", "sublease", Number(req.params.id));
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

  // Sublease Apartment Changes
  app.get('/api/sublease-apartment-changes/all', isAuthenticated, async (_req, res) => {
    const changes = await storage.getAllSubleaseApartmentChanges();
    res.json(changes);
  });

  app.get('/api/subleases/:id/apartment-changes', isAuthenticated, async (req, res) => {
    const changes = await storage.getSubleaseApartmentChanges(Number(req.params.id));
    res.json(changes);
  });

  app.post('/api/subleases/:id/apartment-changes', isAuthenticated, async (req, res) => {
    const parsed = insertSubleaseApartmentChangeSchema.safeParse({ ...req.body, subleaseId: Number(req.params.id) });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const created = await storage.createSubleaseApartmentChange(parsed.data);
    res.status(201).json(created);
  });

  app.delete('/api/sublease-apartment-changes/:id', isAuthenticated, async (req, res) => {
    await storage.deleteSubleaseApartmentChange(Number(req.params.id));
    res.status(204).send();
  });

  app.post('/api/subleases/generate-contract', isAuthenticated, async (req, res) => {
    try {
      const { templateId, data } = req.body;
      if (!templateId) return res.status(400).json({ message: "Brak ID szablonu" });

      const templates = await storage.getDocumentTemplates();
      const template = templates.find(t => t.id === templateId);
      if (!template) return res.status(404).json({ message: "Szablon nie znaleziony" });

      const { ObjectStorageService, objectStorageClient: osStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
      const osService = new ObjectStorageService();
      const objectFile = await osService.getObjectEntityFile(template.objectPath);
      const [fileBuffer] = await objectFile.download();

      const PizZip = (await import("pizzip")).default;

      const aptIds: number[] = data.apartmentIds || (data.apartmentId ? [data.apartmentId] : []);
      const allApartments = await storage.getApartments();
      const aptNames = aptIds.map(id => allApartments.find(a => a.id === id)?.name || "").filter(Boolean);

      const companyData = await storage.getCompanySettings();

      const today = new Date();
      const formatDatePL = (d: string) => {
        if (!d) return "";
        const [y, m, dd] = d.split("-");
        return `${dd}.${m}.${y}`;
      };

      const fullName = `${data.firstName || ""} ${data.lastName || ""}`.trim();
      const fullAddress = [data.street, data.postalCode, data.city].filter(Boolean).join(", ");
      const companyFullAddress = companyData ? [companyData.street, companyData.postalCode, companyData.city].filter(Boolean).join(", ") : "";

      const paymentDayStr = data.paymentDay ? String(data.paymentDay) : "";

      let scheduleDetails = "";
      if (data.startDate && data.endDate && data.rentAmount && data.paymentDay) {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        const lines: string[] = [];
        const rent = Number(data.rentAmount);
        let current = new Date(start.getFullYear(), start.getMonth(), data.paymentDay);
        if (current < start) current.setMonth(current.getMonth() + 1);
        while (current <= end) {
          lines.push(`${formatDatePL(current.toISOString().slice(0, 10))} - ${rent.toFixed(2)} PLN`);
          current.setMonth(current.getMonth() + 1);
        }
        scheduleDetails = lines.join("; ");
      }

      const replacements: Record<string, string> = {
        "IMIĘ_I_NAZWISKO_NAJEMCY": fullName,
        "IMIE_I_NAZWISKO_NAJEMCY": fullName,
        "IMIĘ_NAZWISKO_NAJEMCY": fullName,
        "IMIE_NAZWISKO_NAJEMCY": fullName,
        "IMIĘ_NAZWISKO_REPREZENTANTA": fullName,
        "IMIE_NAZWISKO_REPREZENTANTA": fullName,
        "IMIĘ_NAZWISKO_WYNAJMUJĄCEGO": companyData?.representativeName || "",
        "IMIE_NAZWISKO_WYNAJMUJACEGO": companyData?.representativeName || "",
        "STANOWISKO_WYNAJMUJĄCEGO": companyData?.representativeRole || "",
        "STANOWISKO_WYNAJMUJACEGO": companyData?.representativeRole || "",
        "ADRES_NAJEMCY": fullAddress,
        "ULICA_NAJEMCY": data.street || "",
        "KOD_POCZTOWY_NAJEMCY": data.postalCode || "",
        "MIEJSCOWOŚĆ_NAJEMCY": data.city || "",
        "MIEJSCOWOSC_NAJEMCY": data.city || "",
        "PESEL": data.peselOrPassport || "",
        "NR_DOWODU": data.idNumber || "",
        "NUMER_DOWODU": data.idNumber || "",
        "NAZWA_FIRMY_NAJEMCY": data.companyName || "",
        "NIP_NAJEMCY": data.nip || "",
        "REGON_NAJEMCY": "",
        "NAZWA_FIRMY_WYNAJMUJĄCEGO": companyData?.companyName || "",
        "NAZWA_FIRMY_WYNAJMUJACEGO": companyData?.companyName || "",
        "ADRES_FIRMY": companyFullAddress,
        "ADRES_WYNAJMUJĄCEGO": companyFullAddress,
        "ADRES_WYNAJMUJACEGO": companyFullAddress,
        "ULICA_WYNAJMUJĄCEGO": companyData?.street || "",
        "ULICA_WYNAJMUJACEGO": companyData?.street || "",
        "KOD_POCZTOWY_WYNAJMUJĄCEGO": companyData?.postalCode || "",
        "KOD_POCZTOWY_WYNAJMUJACEGO": companyData?.postalCode || "",
        "MIEJSCOWOŚĆ_WYNAJMUJĄCEGO": companyData?.city || "",
        "MIEJSCOWOSC_WYNAJMUJACEGO": companyData?.city || "",
        "NIP_WYNAJMUJĄCEGO": companyData?.nip || "",
        "NIP_WYNAJMUJACEGO": companyData?.nip || "",
        "REGON_WYNAJMUJĄCEGO": companyData?.regon || "",
        "REGON_WYNAJMUJACEGO": companyData?.regon || "",
        "NUMER_LOKALU": aptNames[0] || "",
        "ADRES_LOKALU": aptNames.join(", "),
        "MIEJSCOWOŚĆ": data.city || "",
        "MIEJSCOWOSC": data.city || "",
        "DATA_ZAWARCIA": formatDatePL(today.toISOString().slice(0, 10)),
        "DATA_OD": formatDatePL(data.startDate || ""),
        "DATA_DO": formatDatePL(data.endDate || ""),
        "DATA_ROZPOCZECIA": formatDatePL(data.startDate || ""),
        "DATA_ZAKONCZENIA": formatDatePL(data.endDate || ""),
        "KWOTA_CZYNSZU": data.rentAmount ? Number(data.rentAmount).toFixed(2) : "",
        "KWOTA_CZYNSZU_NETTO": data.rentAmount ? Number(data.rentAmount).toFixed(2) : "",
        "KWOTA_VAT": data.vatRate || "23%",
        "KWOTA_KAUCJI": data.depositAmount ? Number(data.depositAmount).toFixed(2) : "",
        "NUMER_KONTA": companyData?.bankAccount || "",
        "NAZWA_BANKU": companyData?.bankName || "",
        "DZIEŃ_PŁATNOŚCI": paymentDayStr,
        "DZIEN_PLATNOSCI": paymentDayStr,
        "LICZBA_DNI_ZALEGŁOŚCI": "",
        "LICZBA_DNI_ZALEGLOSCI": "",
        "DATA_PROPORCJONALNIE_OD": formatDatePL(data.startDate || ""),
        "DATA_PROPORCJONALNIE_DO": formatDatePL(data.endDate || ""),
        "DATA_CZYNSZ_OD": formatDatePL(data.startDate || ""),
        "DATA_CZYNSZ_DO": formatDatePL(data.endDate || ""),
        "KWOTA_PROPORCJONALNA": "",
        "ADRES_RECEPCJI": "",
        "ILOŚĆ_KOMPLETÓW_KLUCZY": "",
        "ILOSC_KOMPLETOW_KLUCZY": "",
        "SZCZEGÓŁY_HARMONOGRAMU": scheduleDetails,
        "SZCZEGOLY_HARMONOGRAMU": scheduleDetails,
        "TELEFON_WYNAJMUJĄCEGO": companyData?.phone || "",
        "TELEFON_WYNAJMUJACEGO": companyData?.phone || "",
        "EMAIL_WYNAJMUJĄCEGO": companyData?.email || "",
        "EMAIL_WYNAJMUJACEGO": companyData?.email || "",
      };

      const zip = new PizZip(fileBuffer);

      const mergeRunsAndReplace = (xml: string, repls: Record<string, string>): string => {
        return xml.replace(/<w:p[\s>][\s\S]*?<\/w:p>/g, (para) => {
          const textParts: { match: string; text: string }[] = [];
          const runRegex = /<w:r[\s>][\s\S]*?<\/w:r>/g;
          let m;
          while ((m = runRegex.exec(para)) !== null) {
            const runXml = m[0];
            const texts: string[] = [];
            const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
            let tm;
            while ((tm = tRegex.exec(runXml)) !== null) {
              texts.push(tm[1]);
            }
            textParts.push({ match: runXml, text: texts.join("") });
          }
          const fullText = textParts.map(p => p.text).join("");
          let hasPlaceholder = false;
          for (const key of Object.keys(repls)) {
            if (fullText.includes(`[${key}]`)) { hasPlaceholder = true; break; }
          }
          if (!hasPlaceholder) return para;

          let replacedText = fullText;
          for (const [key, val] of Object.entries(repls)) {
            replacedText = replacedText.split(`[${key}]`).join(val);
          }
          if (textParts.length === 0) return para;
          const firstRun = textParts[0].match;
          const newRun = firstRun.replace(/<w:t[^>]*>[^<]*<\/w:t>/g, "").replace(/<\/w:r>$/, "") +
            `<w:t xml:space="preserve">${replacedText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</w:t></w:r>`;
          let result = para;
          for (let i = textParts.length - 1; i >= 1; i--) {
            result = result.replace(textParts[i].match, "");
          }
          result = result.replace(textParts[0].match, newRun);
          return result;
        });
      };

      const xmlFiles = ["word/document.xml", "word/header1.xml", "word/header2.xml", "word/header3.xml", "word/footer1.xml", "word/footer2.xml", "word/footer3.xml"];
      for (const xmlFile of xmlFiles) {
        const entry = zip.files[xmlFile];
        if (!entry) continue;
        let xml = entry.asText();
        const beforeCount = (xml.match(/\[[A-ZĘÓĄŚŁŻŹĆŃ_]+\]/g) || []).length;
        xml = mergeRunsAndReplace(xml, replacements);
        const afterCount = (xml.match(/\[[A-ZĘÓĄŚŁŻŹĆŃ_]+\]/g) || []).length;
        console.log(`Contract gen: ${xmlFile} - placeholders before: ${beforeCount}, after: ${afterCount}`);
        zip.file(xmlFile, xml);
      }

      let logoImgBuffer: Buffer | null = null;
      let logoImgExt = "png";
      if (companyData?.logoUrl) {
        try {
          const { objectStorageClient: osClient } = await import("./replit_integrations/object_storage/objectStorage");
          const lp = (() => {
            const p = companyData.logoUrl!.startsWith("/") ? companyData.logoUrl!.slice(1) : companyData.logoUrl!;
            const parts = p.split("/");
            return { bucketName: parts[0], objectName: parts.slice(1).join("/") };
          })();
          const [buf] = await osClient.bucket(lp.bucketName).file(lp.objectName).download();
          logoImgBuffer = buf;
          logoImgExt = companyData.logoUrl!.split(".").pop()?.toLowerCase() || "png";
        } catch (e) { console.error("Contract logo load error:", e); }
      }

      let qrImgBuffer: Buffer | null = null;
      if (companyData?.websiteUrl) {
        try {
          const QRCode = (await import("qrcode")).default;
          qrImgBuffer = await QRCode.toBuffer(companyData.websiteUrl, { width: 200, margin: 1 });
        } catch (e) { console.error("Contract QR generation error:", e); }
      }

      let contentTypesXml = zip.files["[Content_Types].xml"]?.asText() || "";
      if (!contentTypesXml.includes('Extension="png"')) {
        contentTypesXml = contentTypesXml.replace("</Types>", '<Default Extension="png" ContentType="image/png"/></Types>');
      }
      if ((logoImgExt === "jpg" || logoImgExt === "jpeg") && !contentTypesXml.includes('Extension="jpeg"') && !contentTypesXml.includes('Extension="jpg"')) {
        contentTypesXml = contentTypesXml.replace("</Types>", '<Default Extension="jpeg" ContentType="image/jpeg"/></Types>');
      }

      const makeDrawingXml = (rId: string, cx: number, cy: number, docPrId: number, name: string) =>
        `<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${docPrId}" name="${name}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${docPrId}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`;

      const getNextRid = (relsContent: string): number => {
        const ids = (relsContent.match(/rId(\d+)/g) || []).map(s => parseInt(s.replace("rId", "")));
        return Math.max(0, ...ids) + 1;
      };

      const docRelsPath = "word/_rels/document.xml.rels";
      let docRelsXml = zip.files[docRelsPath]?.asText() || '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';

      const nsAll = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';

      let docXml = zip.files["word/document.xml"]?.asText() || "";

      if (logoImgBuffer) {
        const logoMediaName = `image_logo.${logoImgExt}`;
        zip.file(`word/media/${logoMediaName}`, logoImgBuffer);

        const headerPartName = "word/header_logo.xml";
        const headerRelsPath = "word/_rels/header_logo.xml.rels";
        const hdrRid = "rId1";
        zip.file(headerRelsPath, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="${hdrRid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${logoMediaName}"/></Relationships>`);
        zip.file(headerPartName, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${nsAll}><w:p><w:pPr><w:jc w:val="left"/></w:pPr><w:r>${makeDrawingXml(hdrRid, 1800000, 1080000, 100, "Logo")}</w:r></w:p></w:hdr>`);

        if (!contentTypesXml.includes(`PartName="/${headerPartName}"`)) {
          contentTypesXml = contentTypesXml.replace("</Types>", `<Override PartName="/${headerPartName}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/></Types>`);
        }

        let nextDocRid = getNextRid(docRelsXml);
        const hdrRefId = `rId${nextDocRid}`;
        docRelsXml = docRelsXml.replace("</Relationships>", `<Relationship Id="${hdrRefId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header_logo.xml"/></Relationships>`);

        const sectPrMatch = docXml.match(/<w:sectPr[\s>][\s\S]*?<\/w:sectPr>/);
        if (sectPrMatch) {
          let sectPr = sectPrMatch[0];
          sectPr = sectPr.replace(/<w:headerReference[^/]*w:type="default"[^/]*\/>/g, "");
          const headerRef = `<w:headerReference w:type="default" r:id="${hdrRefId}"/>`;
          sectPr = sectPr.replace(/<w:sectPr([\s>])/, `<w:sectPr$1${headerRef}`);
          docXml = docXml.replace(sectPrMatch[0], sectPr);
        }
      }

      if (qrImgBuffer) {
        zip.file("word/media/image_qr.png", qrImgBuffer);

        const footerPartName = "word/footer_qr.xml";
        const footerRelsPath = "word/_rels/footer_qr.xml.rels";
        const ftrRid = "rId1";
        zip.file(footerRelsPath, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="${ftrRid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image_qr.png"/></Relationships>`);

        const websiteText = (companyData?.websiteUrl || "").replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        zip.file(footerPartName, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${nsAll}><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r>${makeDrawingXml(ftrRid, 800000, 800000, 101, "QR")}</w:r></w:p><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve">${websiteText}</w:t></w:r></w:p></w:ftr>`);

        if (!contentTypesXml.includes(`PartName="/${footerPartName}"`)) {
          contentTypesXml = contentTypesXml.replace("</Types>", `<Override PartName="/${footerPartName}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>`);
        }

        let nextDocRid = getNextRid(docRelsXml);
        const ftrRefId = `rId${nextDocRid}`;
        docRelsXml = docRelsXml.replace("</Relationships>", `<Relationship Id="${ftrRefId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer_qr.xml"/></Relationships>`);

        const sectPrMatch = docXml.match(/<w:sectPr[\s>][\s\S]*?<\/w:sectPr>/);
        if (sectPrMatch) {
          let sectPr = sectPrMatch[0];
          sectPr = sectPr.replace(/<w:footerReference[^/]*w:type="default"[^/]*\/>/g, "");
          const footerRef = `<w:footerReference w:type="default" r:id="${ftrRefId}"/>`;
          sectPr = sectPr.replace(/<w:sectPr([\s>])/, `<w:sectPr$1${footerRef}`);
          docXml = docXml.replace(sectPrMatch[0], sectPr);
        }
      }

      zip.file("word/document.xml", docXml);
      zip.file(docRelsPath, docRelsXml);
      if (contentTypesXml) zip.file("[Content_Types].xml", contentTypesXml);

      const nullGetter = () => "";
      const Docxtemplater = (await import("docxtemplater")).default;
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: "{{", end: "}}" },
        nullGetter,
      });

      const templateData: Record<string, string> = {
        ...data,
        imie: data.firstName || "",
        nazwisko: data.lastName || "",
        imie_nazwisko: fullName,
        nazwa_firmy: data.companyName || "",
        apartament: aptNames.join(", "),
        apartamenty: aptNames.join(", "),
        data_rozpoczecia: formatDatePL(data.startDate || ""),
        data_zakonczenia: formatDatePL(data.endDate || ""),
        data_od: formatDatePL(data.startDate || ""),
        data_do: formatDatePL(data.endDate || ""),
        czynsz: data.rentAmount ? Number(data.rentAmount).toFixed(2) : "",
        kwota_czynszu: data.rentAmount ? Number(data.rentAmount).toFixed(2) : "",
        kaucja: data.depositAmount ? Number(data.depositAmount).toFixed(2) : "",
        kwota_kaucji: data.depositAmount ? Number(data.depositAmount).toFixed(2) : "",
        data_dzisiejsza: formatDatePL(today.toISOString().slice(0, 10)),
        data_umowy: formatDatePL(today.toISOString().slice(0, 10)),
        nr_dowodu: data.idNumber || "",
        numer_dowodu: data.idNumber || "",
        dzien_platnosci: paymentDayStr,
        numer_konta: companyData?.bankAccount || "",
        nazwa_banku: companyData?.bankName || "",
        nazwa_firmy_wynajmujacego: companyData?.companyName || "",
        nip_wynajmujacego: companyData?.nip || "",
        regon_wynajmujacego: companyData?.regon || "",
        adres_wynajmujacego: companyFullAddress,
        imie_nazwisko_wynajmujacego: companyData?.representativeName || "",
        stanowisko_wynajmujacego: companyData?.representativeRole || "",
        harmonogram: scheduleDetails,
      };

      doc.render(templateData);
      const buf = doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });

      const tenantName = data.tenantType === 'firma' 
        ? (data.companyName || 'firma') 
        : `${data.firstName || ''}_${data.lastName || ''}`.trim();
      const fileName = `Umowa_podnajem_${tenantName}_${new Date().toISOString().slice(0, 10)}.docx`;

      // Create the sublease record
      const subleaseData: any = {
        tenantType: data.tenantType || "osoba_fizyczna",
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        companyName: data.companyName || null,
        nip: data.nip || null,
        street: data.street || null,
        postalCode: data.postalCode || null,
        city: data.city || null,
        peselOrPassport: data.peselOrPassport || null,
        idNumber: data.idNumber || null,
        phone: data.phone || null,
        email: data.email || null,
        invoiceEmail: data.invoiceEmail || null,
        vatRate: data.vatRate || "23%",
        apartmentId: data.apartmentId || (data.apartmentIds?.length ? data.apartmentIds[0] : null),
        apartmentIds: data.apartmentIds || (data.apartmentId ? [data.apartmentId] : null),
        startDate: data.startDate,
        endDate: data.endDate,
        paymentDay: data.paymentDay ? Number(data.paymentDay) : null,
        rentAmount: data.rentAmount || null,
        additionalFees: data.additionalFees || null,
        mediaByMeters: data.mediaByMeters || false,
        hasDeposit: data.hasDeposit || false,
        depositAmount: data.depositAmount || null,
        depositReturnDate: data.depositReturnDate || null,
        status: "W_TRAKCIE_PODPISYWANIA",
        preparedAt: new Date(),
      };
      if (subleaseData.rentAmount === "") subleaseData.rentAmount = null;
      if (subleaseData.additionalFees === "") subleaseData.additionalFees = null;
      if (subleaseData.depositAmount === "") subleaseData.depositAmount = null;
      if (subleaseData.depositReturnDate === "") subleaseData.depositReturnDate = null;
      const parsed = insertSubleaseSchema.parse(subleaseData);
      const created = await storage.createSublease(parsed);

      // Save generated document to Object Storage
      const privateDir = osService.getPrivateObjectDir();
      const storagePath = `${privateDir}/contracts/${created.id}_${fileName}`;
      const parsedPath = (() => {
        const p = storagePath.startsWith("/") ? storagePath.slice(1) : storagePath;
        const parts = p.split("/");
        return { bucketName: parts[0], objectName: parts.slice(1).join("/") };
      })();
      const storageFile = osStorageClient.bucket(parsedPath.bucketName).file(parsedPath.objectName);
      await storageFile.save(buf, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });

      const objectPath = `/objects/contracts/${created.id}_${fileName}`;

      // Create attachment record
      await storage.createSubleaseAttachment({
        subleaseId: created.id,
        fileName,
        objectPath,
        fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        category: "UMOWA",
      });

      logActivity(req, "create", "sublease", created.id, parsed.firstName ? `${parsed.firstName} ${parsed.lastName || ""}` : parsed.companyName || undefined);

      // Return file as download + sublease info in header
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("X-Sublease-Id", String(created.id));
      res.send(buf);
    } catch (error: any) {
      console.error("Error generating contract:", error);
      res.status(500).json({ message: error.message || "Błąd generowania umowy" });
    }
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

  app.get('/api/sublease-attachments/:id/download', isAuthenticated, async (req, res) => {
    try {
      const atts = await storage.getAllSubleaseAttachments();
      const att = atts.find(a => a.id === Number(req.params.id));
      if (!att) return res.status(404).json({ message: "Załącznik nie znaleziony" });
      const { ObjectStorageService } = await import("./replit_integrations/object_storage/objectStorage");
      const os = new ObjectStorageService();
      const objectFile = await os.getObjectEntityFile(att.objectPath);
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(att.fileName)}"`);
      await os.downloadObject(objectFile, res, 0);
    } catch (err: any) {
      console.error("Download attachment error:", err);
      res.status(500).json({ message: "Błąd pobierania załącznika" });
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
  app.get('/api/company-settings', isAuthenticated, async (_req, res) => {
    const settings = await storage.getCompanySettings();
    res.json(settings || {});
  });

  app.put('/api/company-settings', isAuthenticated, async (req, res) => {
    try {
      const saved = await storage.upsertCompanySettings(req.body);
      res.json(saved);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post('/api/company-settings/logo', isAuthenticated, upload.single('logo'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "Brak pliku" });
      const allowedMimes = ["image/png", "image/jpeg", "image/jpg"];
      if (!allowedMimes.includes(req.file.mimetype)) {
        return res.status(400).json({ message: "Dozwolone formaty: PNG, JPG" });
      }

      const { ObjectStorageService, objectStorageClient: osStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
      const osService = new ObjectStorageService();
      const publicPaths = osService.getPublicSearchPaths();
      const publicDir = publicPaths[0];

      const ext = req.file.originalname.split(".").pop() || "png";
      const fileName = `company-logo.${ext}`;
      const storagePath = `${publicDir}/${fileName}`;
      const parsedPath = (() => {
        const p = storagePath.startsWith("/") ? storagePath.slice(1) : storagePath;
        const parts = p.split("/");
        return { bucketName: parts[0], objectName: parts.slice(1).join("/") };
      })();

      const storageFile = osStorageClient.bucket(parsedPath.bucketName).file(parsedPath.objectName);
      await storageFile.save(req.file.buffer, { contentType: req.file.mimetype });

      const logoUrl = storagePath;
      await storage.upsertCompanySettings({ logoUrl });
      res.json({ logoUrl });
    } catch (err: any) {
      console.error("Logo upload error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/company-settings/logo', async (req, res) => {
    try {
      const settings = await storage.getCompanySettings();
      if (!settings?.logoUrl) return res.status(404).json({ message: "Brak logo" });

      const { objectStorageClient: osStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
      const parsedPath = (() => {
        const p = settings.logoUrl!.startsWith("/") ? settings.logoUrl!.slice(1) : settings.logoUrl!;
        const parts = p.split("/");
        return { bucketName: parts[0], objectName: parts.slice(1).join("/") };
      })();
      const storageFile = osStorageClient.bucket(parsedPath.bucketName).file(parsedPath.objectName);
      const [fileBuffer] = await storageFile.download();

      const ext = settings.logoUrl!.split(".").pop()?.toLowerCase() || "png";
      const mimeMap: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", svg: "image/svg+xml", webp: "image/webp" };
      res.setHeader("Content-Type", mimeMap[ext] || "image/png");
      res.send(fileBuffer);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Accounting Notes
  app.get('/api/accounting-notes', isAuthenticated, async (req, res) => {
    const subleaseId = req.query.subleaseId ? parseInt(req.query.subleaseId as string) : undefined;
    const notes = await storage.getAccountingNotes(subleaseId);
    res.json(notes);
  });

  app.get('/api/accounting-notes/by-report/:reportId', isAuthenticated, async (req, res) => {
    const note = await storage.getAccountingNoteByReportId(parseInt(req.params.reportId));
    res.json(note);
  });

  app.post('/api/accounting-notes/generate', isAuthenticated, async (req, res) => {
    try {
      const { reportId, subleaseId } = req.body;
      if (!reportId || !subleaseId) return res.status(400).json({ message: "Brak reportId lub subleaseId" });

      const existing = await storage.getAccountingNoteByReportId(reportId);
      if (existing) {
        return res.json(existing);
      }

      const report = (await storage.getSettlementReports(subleaseId)).find(r => r.id === reportId);
      if (!report) return res.status(404).json({ message: "Raport nie znaleziony" });

      const sublease = await storage.getSublease(subleaseId);
      if (!sublease) return res.status(404).json({ message: "Podnajem nie znaleziony" });

      const apartments = await storage.getApartments();
      const apt = apartments.find(a => a.id === sublease.apartmentId);
      const companyData = await storage.getCompanySettings();

      const now = new Date();
      const noteNumber = await storage.getNextNoteNumber(now.getFullYear(), now.getMonth() + 1);

      const removeDiacritics = (text: string): string => {
        const map: Record<string, string> = {
          "ą": "a", "ć": "c", "ę": "e", "ł": "l", "ń": "n", "ó": "o", "ś": "s", "ź": "z", "ż": "z",
          "Ą": "A", "Ć": "C", "Ę": "E", "Ł": "L", "Ń": "N", "Ó": "O", "Ś": "S", "Ź": "Z", "Ż": "Z",
        };
        return text.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (ch) => map[ch] || ch);
      };
      const rd = removeDiacritics;
      const plnFmt = (v: number | string | null | undefined): string => {
        const num = typeof v === "string" ? parseFloat(v) : v;
        if (num === null || num === undefined || isNaN(num as number)) return "0,00";
        return (num as number).toFixed(2).replace(".", ",");
      };
      const formatDatePL = (d: string | null | undefined): string => {
        if (!d) return "";
        const parts = d.split("-");
        if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
        return d;
      };

      const aptName = apt?.name || "";
      const tenantName = sublease.tenantType === "firma"
        ? (sublease.companyName || "")
        : `${sublease.firstName || ""} ${sublease.lastName || ""}`.trim();
      const tenantAddress = [sublease.street, sublease.postalCode, sublease.city].filter(Boolean).join(", ");
      const companyName = companyData?.companyName || "Baltyckie Finanse";
      const companyAddress = companyData
        ? [companyData.street, companyData.postalCode, companyData.city].filter(Boolean).join(", ")
        : "";

      const jsPDF = (await import("jspdf")).default;
      await import("jspdf-autotable");
      const QRCode = (await import("qrcode")).default;
      const doc = new jsPDF();

      let logoBuffer: Buffer | null = null;
      let logoExt = "png";
      if (companyData?.logoUrl) {
        try {
          const { objectStorageClient: osClient } = await import("./replit_integrations/object_storage/objectStorage");
          const lp = (() => {
            const p = companyData.logoUrl!.startsWith("/") ? companyData.logoUrl!.slice(1) : companyData.logoUrl!;
            const parts = p.split("/");
            return { bucketName: parts[0], objectName: parts.slice(1).join("/") };
          })();
          const [buf] = await osClient.bucket(lp.bucketName).file(lp.objectName).download();
          logoBuffer = buf;
          logoExt = companyData.logoUrl!.split(".").pop()?.toLowerCase() || "png";
        } catch (e) { console.error("Logo load error:", e); }
      }

      let qrDataUrl: string | null = null;
      if (companyData?.websiteUrl) {
        try {
          qrDataUrl = await QRCode.toDataURL(companyData.websiteUrl, { width: 80, margin: 1 });
        } catch (e) { console.error("QR generation error:", e); }
      }

      let headerY = 14;
      if (logoBuffer) {
        const imgFormat = (logoExt === "jpg" || logoExt === "jpeg") ? "JPEG" : "PNG";
        const base64 = logoBuffer.toString("base64");
        const dataUri = `data:image/${logoExt};base64,${base64}`;
        doc.addImage(dataUri, imgFormat, 14, headerY, 35, 21);
        headerY += 24;
      }

      doc.setFontSize(16);
      doc.text(rd("NOTA KSIEGOWA"), 105, headerY + 4, { align: "center" });
      doc.setFontSize(10);
      doc.text(rd(`Nr: ${noteNumber}`), 105, headerY + 12, { align: "center" });
      doc.text(rd(`Data wystawienia: ${now.toLocaleDateString("pl-PL")}`), 105, headerY + 18, { align: "center" });

      doc.setFontSize(9);
      let y = headerY + 30;
      doc.setFont("helvetica", "bold");
      doc.text(rd("Wystawca:"), 14, y);
      doc.setFont("helvetica", "normal");
      y += 6;
      doc.text(rd(companyName), 14, y);
      if (companyData?.nip) { y += 5; doc.text(rd(`NIP: ${companyData.nip}`), 14, y); }
      if (companyAddress) { y += 5; doc.text(rd(companyAddress), 14, y); }
      if (companyData?.bankAccount) { y += 5; doc.text(rd(`Konto: ${companyData.bankAccount}`), 14, y); }

      let y2 = 46;
      doc.setFont("helvetica", "bold");
      doc.text(rd("Obciazony:"), 110, y2);
      doc.setFont("helvetica", "normal");
      y2 += 6;
      doc.text(rd(tenantName), 110, y2);
      if (sublease.nip) { y2 += 5; doc.text(rd(`NIP: ${sublease.nip}`), 110, y2); }
      if (tenantAddress) { y2 += 5; doc.text(rd(tenantAddress), 110, y2); }

      const startY = Math.max(y, y2) + 14;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(rd(`Rozliczenie mediow - ${aptName}`), 14, startY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(rd(`Okres: ${formatDatePL(report.periodFrom)} - ${formatDatePL(report.periodTo)}`), 14, startY + 7);

      const rows: string[][] = [];
      if (report.electricityConsumption && Number(report.electricityConsumption) > 0) {
        rows.push([rd("Energia elektryczna"), `${plnFmt(report.electricityConsumption)} kWh`, `${plnFmt(report.electricityCost)} PLN`]);
      }
      if (report.coldWaterConsumption && Number(report.coldWaterConsumption) > 0) {
        rows.push([rd("Woda zimna"), rd(`${plnFmt(report.coldWaterConsumption)} m3`), `${plnFmt(report.coldWaterCost)} PLN`]);
      }
      if (report.hotWaterConsumption && Number(report.hotWaterConsumption) > 0) {
        rows.push([rd("Woda ciepla"), rd(`${plnFmt(report.hotWaterConsumption)} m3`), `${plnFmt(report.hotWaterCost)} PLN`]);
      }

      (doc as any).autoTable({
        startY: startY + 12,
        head: [["Medium", rd("Zuzycie"), "Koszt"]],
        body: rows,
        foot: [[rd("RAZEM DO ZAPLATY"), "", `${plnFmt(report.totalCost)} PLN`]],
        theme: "grid",
        headStyles: { fillColor: [41, 128, 185], fontSize: 9 },
        footStyles: { fillColor: [236, 240, 241], textColor: [0, 0, 0], fontStyle: "bold", fontSize: 9 },
        styles: { fontSize: 9 },
        columnStyles: { 1: { halign: "right" as const }, 2: { halign: "right" as const } },
        margin: { left: 14, right: 14 },
      });

      const finalY = (doc as any).lastAutoTable?.finalY || startY + 60;
      doc.setFontSize(8);
      doc.text(rd("Nota ksiegowa nie jest faktura VAT."), 14, finalY + 14);
      doc.text(rd("Termin platnosci: 14 dni od daty wystawienia."), 14, finalY + 20);

      if (qrDataUrl) {
        doc.addImage(qrDataUrl, "PNG", 88, 268, 16, 16);
        doc.setFontSize(6);
        doc.text(rd(companyData?.websiteUrl || ""), 105, 286, { align: "center" });
      } else {
        doc.setFontSize(8);
        doc.text(rd(`Wygenerowano: ${now.toLocaleDateString("pl-PL")} | Baltyckie Finanse`), 105, 285, { align: "center" });
      }

      const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

      const safeTenantName = rd(tenantName.replace(/\s+/g, "_"));
      const fileName = `Nota_ksiegowa_${safeTenantName}_${report.periodFrom}_${report.periodTo}.pdf`;

      const { ObjectStorageService, objectStorageClient: osStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
      const osService = new ObjectStorageService();
      const privateDir = osService.getPrivateObjectDir();
      const storagePath = `${privateDir}/accounting-notes/${fileName}`;
      const parsedPath = (() => {
        const p = storagePath.startsWith("/") ? storagePath.slice(1) : storagePath;
        const parts = p.split("/");
        return { bucketName: parts[0], objectName: parts.slice(1).join("/") };
      })();
      const storageFile = osStorageClient.bucket(parsedPath.bucketName).file(parsedPath.objectName);
      await storageFile.save(pdfBuffer, { contentType: "application/pdf" });

      const objectPath = `/objects/accounting-notes/${fileName}`;

      const note = await storage.createAccountingNote({
        subleaseId,
        reportId,
        noteNumber,
        objectPath: storagePath,
        fileName,
      });

      res.json(note);
    } catch (err: any) {
      console.error("Error generating accounting note:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/accounting-notes/:id/download', isAuthenticated, async (req, res) => {
    try {
      const notes = await storage.getAccountingNotes();
      const note = notes.find(n => n.id === parseInt(req.params.id));
      if (!note) return res.status(404).json({ message: "Nota nie znaleziona" });

      const { ObjectStorageService, objectStorageClient: osStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
      const parsedPath = (() => {
        const p = note.objectPath.startsWith("/") ? note.objectPath.slice(1) : note.objectPath;
        const parts = p.split("/");
        return { bucketName: parts[0], objectName: parts.slice(1).join("/") };
      })();
      const storageFile = osStorageClient.bucket(parsedPath.bucketName).file(parsedPath.objectName);
      const [fileBuffer] = await storageFile.download();

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(note.fileName)}"`);
      res.send(fileBuffer);
    } catch (err: any) {
      console.error("Error downloading accounting note:", err);
      res.status(500).json({ message: err.message });
    }
  });

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
    const subleases = await storage.getSubleases();
    const allSubleasePayments: { dueDate: string; amount: string; status: string }[] = [];
    for (const sub of subleases) {
      const payments = await storage.getSubleasePayments(sub.id);
      allSubleasePayments.push(...payments.map(p => ({ dueDate: p.dueDate, amount: p.amount, status: p.status })));
    }

    const months: { year: number; month: number; label: string }[] = [];
    for (let i = 0; i < 12; i++) {
      months.push({ year: currentYear, month: i, label: "" });
    }

    const result = months.map(m => {
      const daysInMonth = new Date(m.year, m.month + 1, 0).getDate();
      const isCurrentMonth = m.year === now.getFullYear() && m.month === now.getMonth();
      const dayOfMonth = isCurrentMonth ? now.getDate() : (m.month < now.getMonth() && m.year === now.getFullYear() ? daysInMonth : 0);
      const daysRemaining = Math.max(0, daysInMonth - dayOfMonth);

      let reservationRevenue = 0;
      for (const r of reservations) {
        if (!r.startDate || r.status === "ANULOWANA") continue;
        const sd = new Date(r.startDate);
        if (sd.getFullYear() === m.year && sd.getMonth() === m.month) {
          reservationRevenue += Number(r.price) || 0;
        }
      }

      let subleaseRevenue = 0;
      for (const p of allSubleasePayments) {
        if (!p.dueDate) continue;
        const pd = new Date(p.dueDate);
        if (pd.getFullYear() === m.year && pd.getMonth() === m.month) {
          subleaseRevenue += Number(p.amount) || 0;
        }
      }

      const actual = reservationRevenue + subleaseRevenue;

      return {
        year: m.year,
        month: m.month,
        actual,
        reservationRevenue,
        subleaseRevenue,
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

  // Activity Logs (Enhanced)
  app.get('/api/activity-logs', isAuthenticated, async (req, res) => {
    try {
      const limitVal = req.query.limit ? Number(req.query.limit) : 100;
      const offsetVal = req.query.offset ? Number(req.query.offset) : 0;
      const entityType = req.query.entityType as string | undefined;
      const action = req.query.action as string | undefined;

      const conditions = [];
      if (entityType) conditions.push(eq(activityLogs.entityType, entityType));
      if (action) conditions.push(eq(activityLogs.action, action));

      const whereClause = conditions.length ? and(...conditions) : undefined;

      const [totalResult] = await db.select({ count: sql<number>`count(*)` })
        .from(activityLogs)
        .where(whereClause);

      const logs = await db.select()
        .from(activityLogs)
        .where(whereClause)
        .orderBy(desc(activityLogs.createdAt))
        .limit(limitVal)
        .offset(offsetVal);

      res.json({ logs, total: Number(totalResult?.count || 0) });
    } catch (err) {
      console.error("Activity logs error:", err);
      res.status(500).json({ message: "Failed to get activity logs" });
    }
  });

  const MONTH_NAMES = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];

  // Apartment Comparison
  app.get('/api/apartment-comparison', isAuthenticated, async (req, res) => {
    try {
      const year = Number(req.query.year) || new Date().getFullYear();
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      const daysInYear = ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) ? 366 : 365;

      const allApartments = await db.select({ id: apartments.id, name: apartments.name }).from(apartments);

      const yearReservations = await db.select({
        apartmentId: reservations.apartmentId,
        price: reservations.price,
        startDate: reservations.startDate,
        endDate: reservations.endDate,
      })
        .from(reservations)
        .where(and(
          lte(reservations.startDate, endDate),
          gte(reservations.endDate, startDate),
          ne(reservations.status, "ANULOWANA"),
        ));

      const yearExpenses = await db.select({
        apartmentId: expenses.apartmentId,
        amount: expenses.amount,
      })
        .from(expenses)
        .where(and(
          gte(expenses.date, startDate),
          lte(expenses.date, endDate),
        ));

      const result = allApartments.map(apt => {
        const aptReservations = yearReservations.filter(r => r.apartmentId === apt.id);
        const revenue = aptReservations.reduce((s, r) => s + Number(r.price || 0), 0);
        const aptExpenses = yearExpenses.filter(e => e.apartmentId === apt.id);
        const expenseTotal = aptExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);

        let occupiedDays = 0;
        for (const r of aptReservations) {
          const rStart = new Date(Math.max(new Date(r.startDate).getTime(), new Date(startDate).getTime()));
          const rEnd = new Date(Math.min(new Date(r.endDate).getTime(), new Date(endDate).getTime()));
          occupiedDays += Math.max(0, Math.ceil((rEnd.getTime() - rStart.getTime()) / 86400000));
        }

        return {
          apartmentId: apt.id,
          apartmentName: apt.name,
          revenue: Math.round(revenue * 100) / 100,
          expenses: Math.round(expenseTotal * 100) / 100,
          reservationCount: aptReservations.length,
          occupancyRate: Math.round((occupiedDays / daysInYear) * 100 * 100) / 100,
          netProfit: Math.round((revenue - expenseTotal) * 100) / 100,
        };
      });

      res.json(result);
    } catch (err) {
      console.error("Apartment comparison error:", err);
      res.status(500).json({ message: "Failed to get apartment comparison" });
    }
  });

  // Price Seasonality
  app.get('/api/price-seasonality', isAuthenticated, async (req, res) => {
    try {
      const currentYear = new Date().getFullYear();
      const year = Number(req.query.year) || currentYear;
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      const allApartments = await db.select({ id: apartments.id, name: apartments.name }).from(apartments);

      const monthNames = [
        "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
        "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"
      ];

      // Get all reservations for the year
      const yearReservations = await db.select({
        apartmentId: reservations.apartmentId,
        price: reservations.price,
        startDate: reservations.startDate,
        endDate: reservations.endDate,
      })
        .from(reservations)
        .where(and(
          lte(reservations.startDate, endDate),
          gte(reservations.endDate, startDate),
          ne(reservations.status, "ANULOWANA"),
        ));

      // Calculate monthly aggregates
      const monthlyData: Record<number, { prices: number[]; count: number; occupancyRate: number }> = {};
      for (let m = 0; m < 12; m++) {
        monthlyData[m] = { prices: [], count: 0, occupancyRate: 0 };
      }

      // For each apartment, collect monthly rate data
      const apartmentMonthlyData: Record<number, { prices: number[]; count: number }[]> = {};
      for (const apt of allApartments) {
        apartmentMonthlyData[apt.id] = Array.from({ length: 12 }, () => ({ prices: [], count: 0 }));
      }

      // Process reservations
      for (const r of yearReservations) {
        const rStart = new Date(r.startDate);
        const rEnd = new Date(r.endDate);
        const price = Number(r.price || 0);
        const nights = Math.ceil((rEnd.getTime() - rStart.getTime()) / 86400000);
        const pricePerNight = nights > 0 ? price / nights : price;

        // Determine which months this reservation spans
        let currentDate = new Date(rStart);
        while (currentDate < rEnd) {
          const month = currentDate.getMonth();
          const year = currentDate.getFullYear();

          // Only count if within our target year
          if (year === parseInt(startDate.split('-')[0])) {
            monthlyData[month].prices.push(pricePerNight);
            monthlyData[month].count++;

            if (apartmentMonthlyData[r.apartmentId]) {
              apartmentMonthlyData[r.apartmentId][month].prices.push(pricePerNight);
              apartmentMonthlyData[r.apartmentId][month].count++;
            }
          }

          currentDate.setDate(currentDate.getDate() + 1);
        }
      }

      // Calculate occupancy for each month
      const daysInMonth = (m: number) => {
        if ([0, 2, 4, 6, 7, 9, 11].includes(m)) return 31;
        if ([3, 5, 8, 10].includes(m)) return 30;
        return (parseInt(startDate.split('-')[0]) % 4 === 0) ? 29 : 28;
      };

      // Build monthly data
      const monthlyResult: Record<string, any>[] = [];
      const yearNum = parseInt(startDate.split('-')[0]);
      for (let m = 0; m < 12; m++) {
        const monthReservations = yearReservations.filter(r => {
          const rStart = new Date(r.startDate);
          const rEnd = new Date(r.endDate);
          // Check if reservation overlaps with this month
          const monthStart = new Date(yearNum, m, 1);
          const monthEnd = new Date(yearNum, m + 1, 0);
          return rStart <= monthEnd && rEnd >= monthStart;
        });

        // Calculate occupancy
        let totalOccupiedDays = 0;
        for (const r of monthReservations) {
          const rStart = new Date(r.startDate);
          const rEnd = new Date(r.endDate);
          const monthStart = new Date(yearNum, m, 1);
          const monthEnd = new Date(yearNum, m + 1, 0);

          const overlapStart = new Date(Math.max(rStart.getTime(), monthStart.getTime()));
          const overlapEnd = new Date(Math.min(rEnd.getTime(), monthEnd.getTime()));
          const days = Math.max(0, Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / 86400000));
          totalOccupiedDays += days;
        }

        const data = monthlyData[m];
        const avgRate = data.prices.length > 0 ? data.prices.reduce((a, b) => a + b, 0) / data.prices.length : 0;
        const avgOccupancy = daysInMonth(m) > 0 ? totalOccupiedDays / (daysInMonth(m) * allApartments.length) : 0;

        monthlyResult.push({
          month: m + 1,
          monthName: monthNames[m],
          avgNightlyRate: avgRate,
          reservationCount: data.count,
          avgOccupancy: Math.min(avgOccupancy, 1), // Cap at 100%
        });
      }

      // Build per-apartment data
      const byApartmentResult = allApartments.map(apt => {
        const aptMonths = apartmentMonthlyData[apt.id] || Array.from({ length: 12 }, () => ({ prices: [], count: 0 }));
        return {
          apartmentId: apt.id,
          apartmentName: apt.name,
          monthlyRates: aptMonths.map((md, m) => ({
            month: m,
            avgRate: md.prices.length > 0 ? md.prices.reduce((a, b) => a + b, 0) / md.prices.length : 0,
            count: md.count,
          })),
        };
      });

      res.json({
        data: monthlyResult,
        byApartment: byApartmentResult,
      });
    } catch (err) {
      console.error("Price seasonality error:", err);
      res.status(500).json({ message: "Failed to get price seasonality data" });
    }
  });

  // Cash Flow Forecast
  app.get('/api/cash-flow-forecast', isAuthenticated, async (req, res) => {
    try {
      const now = new Date();
      const months: any[] = [];

      for (let i = 0; i < 6; i++) {
        const targetDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const year = targetDate.getFullYear();
        const month = targetDate.getMonth() + 1;
        const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const monthEnd = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

        const monthReservations = await db.select({ price: reservations.price })
          .from(reservations)
          .where(and(
            lte(reservations.startDate, monthEnd),
            gte(reservations.endDate, monthStart),
            ne(reservations.status, "ANULOWANA"),
          ));
        const expectedIncome = monthReservations.reduce((s, r) => s + Number(r.price || 0), 0);

        const activeSubleases = await db.select({ rentAmount: subleases.rentAmount })
          .from(subleases)
          .where(and(
            lte(subleases.startDate, monthEnd),
            gte(subleases.endDate, monthStart),
          ));
        const expectedSubleaseIncome = activeSubleases.reduce((s, sl) => s + Number(sl.rentAmount || 0), 0);

        const costPayments = await db.select({ amount: costSchedulePayments.amount })
          .from(costSchedulePayments)
          .where(and(
            gte(costSchedulePayments.dueDate, monthStart),
            lte(costSchedulePayments.dueDate, monthEnd),
            eq(costSchedulePayments.status, "NIEOPLACONE"),
          ));
        const expectedExpenses = costPayments.reduce((s, p) => s + Number(p.amount || 0), 0);

        const instPayments = await db.select({ amount: installmentPayments.amount })
          .from(installmentPayments)
          .where(and(
            gte(installmentPayments.dueDate, monthStart),
            lte(installmentPayments.dueDate, monthEnd),
            eq(installmentPayments.status, "NIEOPLACONE"),
          ));
        const expectedInstallments = instPayments.reduce((s, p) => s + Number(p.amount || 0), 0);

        months.push({
          year,
          month,
          monthName: MONTH_NAMES[month - 1],
          expectedIncome: Math.round(expectedIncome * 100) / 100,
          expectedSubleaseIncome: Math.round(expectedSubleaseIncome * 100) / 100,
          expectedExpenses: Math.round(expectedExpenses * 100) / 100,
          expectedInstallments: Math.round(expectedInstallments * 100) / 100,
          netCashFlow: Math.round((expectedIncome + expectedSubleaseIncome - expectedExpenses - expectedInstallments) * 100) / 100,
        });
      }

      res.json({ months });
    } catch (err) {
      console.error("Cash flow forecast error:", err);
      res.status(500).json({ message: "Failed to get cash flow forecast" });
    }
  });

  // Price Seasonality
  app.get('/api/price-seasonality', isAuthenticated, async (req, res) => {
    try {
      const allApartments = await db.select({ id: apartments.id, name: apartments.name }).from(apartments);

      const allReservations = await db.select({
        apartmentId: reservations.apartmentId,
        startDate: reservations.startDate,
        endDate: reservations.endDate,
        price: reservations.price,
      })
        .from(reservations)
        .where(ne(reservations.status, "ANULOWANA"));

      const monthlyData: Record<number, { totalRate: number; count: number; totalDays: number }> = {};
      const apartmentMonthlyData: Record<number, Record<number, { totalRate: number; count: number }>> = {};

      for (let m = 0; m < 12; m++) {
        monthlyData[m] = { totalRate: 0, count: 0, totalDays: 0 };
      }

      for (const apt of allApartments) {
        apartmentMonthlyData[apt.id] = {};
        for (let m = 0; m < 12; m++) {
          apartmentMonthlyData[apt.id][m] = { totalRate: 0, count: 0 };
        }
      }

      for (const r of allReservations) {
        const start = new Date(r.startDate);
        const end = new Date(r.endDate);
        const nights = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
        const nightlyRate = Number(r.price || 0) / nights;
        const month = start.getMonth();

        monthlyData[month].totalRate += nightlyRate;
        monthlyData[month].count += 1;
        monthlyData[month].totalDays += nights;

        if (r.apartmentId && apartmentMonthlyData[r.apartmentId]) {
          apartmentMonthlyData[r.apartmentId][month].totalRate += nightlyRate;
          apartmentMonthlyData[r.apartmentId][month].count += 1;
        }
      }

      const data = Array.from({ length: 12 }, (_, m) => ({
        month: m + 1,
        monthName: MONTH_NAMES[m],
        avgNightlyRate: monthlyData[m].count > 0 ? Math.round((monthlyData[m].totalRate / monthlyData[m].count) * 100) / 100 : 0,
        reservationCount: monthlyData[m].count,
        avgOccupancy: monthlyData[m].count > 0 ? Math.round((monthlyData[m].totalDays / 30) * 100) / 100 : 0,
      }));

      const byApartment = allApartments.map(apt => ({
        apartmentId: apt.id,
        apartmentName: apt.name,
        monthlyRates: Array.from({ length: 12 }, (_, m) => ({
          month: m + 1,
          avgRate: apartmentMonthlyData[apt.id][m].count > 0 ? Math.round((apartmentMonthlyData[apt.id][m].totalRate / apartmentMonthlyData[apt.id][m].count) * 100) / 100 : 0,
          count: apartmentMonthlyData[apt.id][m].count,
        })),
      }));

      res.json({ data, byApartment });
    } catch (err) {
      console.error("Price seasonality error:", err);
      res.status(500).json({ message: "Failed to get price seasonality" });
    }
  });

  // Data Backup Export
  app.get('/api/backup/export', isAuthenticated, async (_req, res) => {
    try {
      const [
        allReservations,
        allApartments,
        allExpenses,
        allLeases,
        allSubleases,
        allEmployees,
        allAccounts,
        allOwners,
        allBlockades,
        allLocations,
        allServiceContracts,
        allServiceContractCats,
        allCostSchedules,
        allInstallmentSchedules,
        allDocumentCategories,
        allDocumentTemplates,
        allAppUsers,
      ] = await Promise.all([
        storage.getReservations(),
        storage.getApartments(),
        storage.getExpenses(),
        storage.getLeases(),
        storage.getSubleases(),
        storage.getEmployees(),
        storage.getAccounts(),
        storage.getOwners(),
        storage.getBlockades(),
        storage.getLocations(),
        storage.getServiceContracts(),
        storage.getServiceContractCategories(),
        storage.getCostSchedules(),
        storage.getInstallmentSchedules(),
        storage.getDocumentCategories(),
        storage.getDocumentTemplates(),
        storage.getAppUsers(),
      ]);

      const [
        allSnapshots,
        allAttachments,
        allCostSchedulePayments,
        allInstallmentPayments,
        allServiceContractAttachments,
        allSaldoEntries,
        allActivityLogs,
      ] = await Promise.all([
        storage.getSnapshots(),
        storage.getAllAttachments(),
        storage.getAllCostSchedulePayments(),
        storage.getAllInstallmentPayments(),
        storage.getAllServiceContractAttachments(),
        storage.getSaldoEntries(),
        storage.getActivityLogs(10000),
      ]);

      res.json({
        exportDate: new Date().toISOString(),
        reservations: allReservations,
        apartments: allApartments,
        expenses: allExpenses,
        leases: allLeases,
        subleases: allSubleases,
        employees: allEmployees,
        accounts: allAccounts,
        accountSnapshots: allSnapshots,
        owners: allOwners,
        blockades: allBlockades,
        locations: allLocations,
        serviceContracts: allServiceContracts,
        serviceContractCategories: allServiceContractCats,
        costSchedules: allCostSchedules,
        costSchedulePayments: allCostSchedulePayments,
        installmentSchedules: allInstallmentSchedules,
        installmentPayments: allInstallmentPayments,
        documentCategories: allDocumentCategories,
        documentTemplates: allDocumentTemplates,
        appUsers: allAppUsers,
        attachments: allAttachments,
        serviceContractAttachments: allServiceContractAttachments,
        saldoEntries: allSaldoEntries,
        activityLogs: allActivityLogs,
      });
    } catch (err) {
      console.error("Backup export error:", err);
      res.status(500).json({ message: "Failed to export backup" });
    }
  });

  // Invoices
  app.get("/api/invoices", isAuthenticated, async (_req, res) => {
    try {
      const allInvoices = await storage.getInvoices();
      res.json(allInvoices);
    } catch (err) {
      console.error("Get invoices error:", err);
      res.status(500).json({ message: "Failed to get invoices" });
    }
  });

  app.post("/api/invoices", isAuthenticated, async (req, res) => {
    try {
      const input = insertInvoiceSchema.parse(req.body);
      const invoice = await storage.createInvoice(input);
      logActivity(req, "create", "invoice", invoice.id, invoice.invoiceNumber);
      res.status(201).json(invoice);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      console.error("Create invoice error:", err);
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  app.patch("/api/invoices/:id", isAuthenticated, async (req, res) => {
    try {
      const invoice = await storage.updateInvoice(Number(req.params.id), req.body);
      logActivity(req, "update", "invoice", invoice.id, invoice.invoiceNumber);
      res.json(invoice);
    } catch (err) {
      console.error("Update invoice error:", err);
      res.status(500).json({ message: "Failed to update invoice" });
    }
  });

  app.delete("/api/invoices/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteInvoice(Number(req.params.id));
      logActivity(req, "delete", "invoice", Number(req.params.id));
      res.status(204).send();
    } catch (err) {
      console.error("Delete invoice error:", err);
      res.status(500).json({ message: "Failed to delete invoice" });
    }
  });

  app.post("/api/invoices/generate-from-reservation/:id", isAuthenticated, async (req, res) => {
    try {
      const reservationId = Number(req.params.id);
      const allReservations = await storage.getReservations({});
      const reservation = allReservations.find(r => r.id === reservationId);
      if (!reservation) return res.status(404).json({ message: "Rezerwacja nie znaleziona" });

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const existingInvoices = await storage.getInvoices();
      const monthInvoices = existingInvoices.filter(inv => inv.invoiceNumber.startsWith(`FV/${year}/${month}/`));
      const nextNum = String(monthInvoices.length + 1).padStart(3, "0");
      const invoiceNumber = `FV/${year}/${month}/${nextNum}`;

      const netAmount = Number(reservation.price);
      const vatRate = 23;
      const vatAmount = Math.round(netAmount * vatRate) / 100;
      const grossAmount = netAmount + vatAmount;

      const items = JSON.stringify([{
        name: `Rezerwacja ${reservation.reservationNumber}`,
        quantity: 1,
        unitPrice: netAmount,
        netAmount: netAmount,
        vatRate: `${vatRate}%`,
        vatAmount: vatAmount,
        grossAmount: grossAmount,
      }]);

      const invoice = await storage.createInvoice({
        invoiceNumber,
        issueDate: now.toISOString().split("T")[0],
        dueDate: new Date(now.getTime() + 14 * 86400000).toISOString().split("T")[0],
        sellerName: "Bałtyckie Apartamenty",
        buyerName: reservation.guestName,
        items,
        netAmount: netAmount.toFixed(2),
        vatRate: `${vatRate}%`,
        vatAmount: vatAmount.toFixed(2),
        grossAmount: grossAmount.toFixed(2),
        status: "WYSTAWIONA",
        sourceType: "reservation",
        sourceId: reservationId,
      });

      logActivity(req, "create", "invoice", invoice.id, invoice.invoiceNumber, `Z rezerwacji ${reservation.reservationNumber}`);
      res.status(201).json(invoice);
    } catch (err) {
      console.error("Generate invoice from reservation error:", err);
      res.status(500).json({ message: "Failed to generate invoice from reservation" });
    }
  });

  app.post("/api/invoices/generate-from-sublease/:id", isAuthenticated, async (req, res) => {
    try {
      const subleaseId = Number(req.params.id);
      const sublease = await storage.getSublease(subleaseId);
      if (!sublease) return res.status(404).json({ message: "Podnajem nie znaleziony" });

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const existingInvoices = await storage.getInvoices();
      const monthInvoices = existingInvoices.filter(inv => inv.invoiceNumber.startsWith(`FV/${year}/${month}/`));
      const nextNum = String(monthInvoices.length + 1).padStart(3, "0");
      const invoiceNumber = `FV/${year}/${month}/${nextNum}`;

      const tenantName = sublease.companyName || `${sublease.firstName || ""} ${sublease.lastName || ""}`.trim() || "Najemca";
      const netAmount = Number(sublease.rentAmount || 0);
      const vatRateNum = parseInt(sublease.vatRate || "23%") || 23;
      const vatAmount = Math.round(netAmount * vatRateNum) / 100;
      const grossAmount = netAmount + vatAmount;

      const items = JSON.stringify([{
        name: `Czynsz najmu`,
        quantity: 1,
        unitPrice: netAmount,
        netAmount: netAmount,
        vatRate: `${vatRateNum}%`,
        vatAmount: vatAmount,
        grossAmount: grossAmount,
      }]);

      const invoice = await storage.createInvoice({
        invoiceNumber,
        issueDate: now.toISOString().split("T")[0],
        dueDate: new Date(now.getTime() + 14 * 86400000).toISOString().split("T")[0],
        sellerName: "Bałtyckie Apartamenty",
        buyerName: tenantName,
        buyerNip: sublease.nip || undefined,
        buyerAddress: [sublease.street, sublease.postalCode, sublease.city].filter(Boolean).join(", ") || undefined,
        items,
        netAmount: netAmount.toFixed(2),
        vatRate: `${vatRateNum}%`,
        vatAmount: vatAmount.toFixed(2),
        grossAmount: grossAmount.toFixed(2),
        status: "WYSTAWIONA",
        sourceType: "sublease",
        sourceId: subleaseId,
      });

      logActivity(req, "create", "invoice", invoice.id, invoice.invoiceNumber, `Z podnajmu ${tenantName}`);
      res.status(201).json(invoice);
    } catch (err) {
      console.error("Generate invoice from sublease error:", err);
      res.status(500).json({ message: "Failed to generate invoice from sublease" });
    }
  });

  app.get("/api/notifications", isAuthenticated, async (_req, res) => {
    try {
      const allNotifications = await storage.getNotifications();
      res.json(allNotifications);
    } catch (err) {
      console.error("Get notifications error:", err);
      res.status(500).json({ message: "Failed to get notifications" });
    }
  });

  app.get("/api/notifications/unread-count", isAuthenticated, async (_req, res) => {
    try {
      const unread = await storage.getUnreadNotifications();
      res.json({ count: unread.length });
    } catch (err) {
      console.error("Get unread count error:", err);
      res.status(500).json({ message: "Failed to get unread count" });
    }
  });

  app.post("/api/notifications/:id/read", isAuthenticated, async (req, res) => {
    try {
      await storage.markNotificationRead(Number(req.params.id));
      res.json({ success: true });
    } catch (err) {
      console.error("Mark notification read error:", err);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.post("/api/notifications/read-all", isAuthenticated, async (_req, res) => {
    try {
      await storage.markAllNotificationsRead();
      res.json({ success: true });
    } catch (err) {
      console.error("Mark all read error:", err);
      res.status(500).json({ message: "Failed to mark all as read" });
    }
  });

  app.post("/api/notifications/generate", isAuthenticated, async (_req, res) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const in30days = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
      const existing = await storage.getNotifications();
      const existingKeys = new Set(existing.map(n => `${n.entityType}:${n.entityId}`));
      let created = 0;

      const overduePayments = await db.select({
        id: subleasePayments.id,
        title: subleasePayments.title,
        amount: subleasePayments.amount,
        dueDate: subleasePayments.dueDate,
      })
        .from(subleasePayments)
        .where(and(ne(subleasePayments.status, "oplacone"), lt(subleasePayments.dueDate, today)));

      for (const p of overduePayments) {
        if (!existingKeys.has(`sublease_payment:${p.id}`)) {
          await storage.createNotification({
            type: "payment_due",
            title: "Zaległa płatność podnajmu",
            message: `Płatność "${p.title}" (${p.amount} zł) miała termin ${p.dueDate}`,
            entityType: "sublease_payment",
            entityId: p.id,
            dueDate: p.dueDate,
          });
          created++;
        }
      }

      const expiringLeasesList = await db.select({
        id: leases.id,
        tenantName: leases.tenantName,
        endDate: leases.endDate,
      })
        .from(leases)
        .where(and(lte(leases.endDate, in30days), gte(leases.endDate, today)));

      for (const l of expiringLeasesList) {
        if (!existingKeys.has(`lease:${l.id}`)) {
          await storage.createNotification({
            type: "lease_expiring",
            title: "Wygasająca umowa najmu",
            message: `Umowa najmu${l.tenantName ? ` (${l.tenantName})` : ""} wygasa ${l.endDate}`,
            entityType: "lease",
            entityId: l.id,
            dueDate: l.endDate,
          });
          created++;
        }
      }

      const expiringExams = await db.select({
        id: medicalExams.id,
        examName: medicalExams.examName,
        validUntil: medicalExams.validUntil,
        employeeId: medicalExams.employeeId,
      })
        .from(medicalExams)
        .where(and(lte(medicalExams.validUntil, in30days), gte(medicalExams.validUntil, today)));

      for (const e of expiringExams) {
        if (!existingKeys.has(`medical_exam:${e.id}`)) {
          await storage.createNotification({
            type: "exam_expiring",
            title: "Wygasające badanie lekarskie",
            message: `Badanie "${e.examName}" ważne do ${e.validUntil}`,
            entityType: "medical_exam",
            entityId: e.id,
            dueDate: e.validUntil,
          });
          created++;
        }
      }

      const expiringSubleasesList = await db.select({
        id: subleases.id,
        firstName: subleases.firstName,
        lastName: subleases.lastName,
        companyName: subleases.companyName,
        endDate: subleases.endDate,
      })
        .from(subleases)
        .where(and(lte(subleases.endDate, in30days), gte(subleases.endDate, today)));

      for (const s of expiringSubleasesList) {
        if (!existingKeys.has(`sublease:${s.id}`)) {
          const tenantName = s.companyName || `${s.firstName || ""} ${s.lastName || ""}`.trim() || "Najemca";
          await storage.createNotification({
            type: "sublease_expiring",
            title: "Wygasający podnajem",
            message: `Podnajem (${tenantName}) wygasa ${s.endDate}`,
            entityType: "sublease",
            entityId: s.id,
            dueDate: s.endDate,
          });
          created++;
        }
      }

      res.json({ created, message: `Wygenerowano ${created} nowych powiadomień` });
    } catch (err) {
      console.error("Generate notifications error:", err);
      res.status(500).json({ message: "Failed to generate notifications" });
    }
  });

  // Revenue Forecasts API
  app.get("/api/revenue-forecasts", isAuthenticated, async (req, res) => {
    try {
      const year = req.query.year ? Number(req.query.year) : undefined;
      const forecasts = await storage.getRevenueForecasts(year);
      res.json(forecasts);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/revenue-forecasts", isAuthenticated, async (req, res) => {
    try {
      const parsed = insertRevenueForecastSchema.parse(req.body);
      const result = await storage.upsertRevenueForecast(parsed);
      res.json(result);
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: "Nieprawidłowe dane prognozy", errors: err.errors });
      }
      res.status(500).json({ message: err.message });
    }
  });

  // Import costs from Excel KOSZTY sheet
  app.post("/api/import-costs", isAuthenticated, async (req, res) => {
    try {
      const filePath = path.resolve("attached_assets/BAŁTYCKIE_1771496530840.xlsx");
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Plik Excel nie został znaleziony" });
      }

      const fileBuffer = fs.readFileSync(filePath);
      const wb = XLSX.read(fileBuffer);
      const ws = wb.Sheets["KOSZTY"];
      if (!ws) {
        return res.status(404).json({ message: "Arkusz KOSZTY nie został znaleziony" });
      }

      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];
      const allApartments = await storage.getApartments();
      const activeApts = allApartments.filter(a => a.active !== false);

      const dateRow = data[4];
      const monthColumns: { col: number; year: number; month: number }[] = [];
      for (let c = 0; c < dateRow.length; c++) {
        if (typeof dateRow[c] === "number" && dateRow[c] > 40000) {
          const excelEpoch = new Date(1899, 11, 30).getTime();
          const d = new Date(excelEpoch + dateRow[c] * 86400000);
          monthColumns.push({ col: c, year: d.getFullYear(), month: d.getMonth() });
        }
      }

      const GB_CATEGORIES: Record<string, number[]> = {
        "GRAND BALTIC": [],
      };
      const GB_SUPERIOR = activeApts.filter(a => a.location === "GRAND BALTIC" && a.name.toLowerCase().includes("superior")).map(a => a.id);
      const GB_STUDIO = activeApts.filter(a => a.location === "GRAND BALTIC" && /^\d+\s*-\s*studio$/i.test(a.name)).map(a => a.id);
      const GB_STUDIO_MINI = activeApts.filter(a => a.location === "GRAND BALTIC" && a.name.toLowerCase().includes("studio mini")).map(a => a.id);
      const GB_2OS = activeApts.filter(a => a.location === "GRAND BALTIC" && a.name.toLowerCase().includes("2os")).map(a => a.id);
      const ALL_GB = [...GB_SUPERIOR, ...GB_STUDIO, ...GB_STUDIO_MINI, ...GB_2OS];

      const aptNameVariants: Record<string, string> = {
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
        "BULWAR - SCANIA": "BULWAR SCANIA",
        "LUXORO PARK": "",
        "LUXURO 49-1": "49-1",
        "LUXURO 49-2": "49-2",
        "LUXURO 51-1": "51-1",
        "LUXURO 51-2": "51-2",
        "GARDEN 2": "GARDEN2",
        "SŁONECZNA OAZA 2": "SŁONECZNA OAZA 2",
      };

      function resolveApartment(excelName: string): { ids: number[]; divideBy: number } | null {
        const upper = excelName.toUpperCase().trim();

        if (upper === "GRAND BALTIC") {
          return { ids: ALL_GB, divideBy: ALL_GB.length || 1 };
        }
        if (upper.includes("SUPERIOR") && !upper.includes("BULWAR")) {
          return { ids: GB_SUPERIOR, divideBy: GB_SUPERIOR.length || 1 };
        }
        if (upper === "STUDIO") {
          return { ids: GB_STUDIO, divideBy: GB_STUDIO.length || 1 };
        }
        if (upper === "STUDIO MINI") {
          return { ids: GB_STUDIO_MINI, divideBy: GB_STUDIO_MINI.length || 1 };
        }
        if (upper.includes("2-OSOBOWY") || upper === "2-OS") {
          return { ids: GB_2OS, divideBy: GB_2OS.length || 1 };
        }

        const dbName = aptNameVariants[upper] ?? upper;
        if (dbName === "") return null;

        const matched = activeApts.filter(a => a.name.toUpperCase().trim() === dbName);
        if (matched.length > 0) return { ids: matched.map(a => a.id), divideBy: 1 };

        const fuzzy = activeApts.filter(a => {
          const n = a.name.toUpperCase().trim();
          return n.includes(dbName) || dbName.includes(n);
        });
        if (fuzzy.length === 1) return { ids: [fuzzy[0].id], divideBy: 1 };

        return null;
      }

      const companyCategories = new Set([
        "OPŁATY", "WYNAGRODZENIA", "ZUS", "PODATKI", "KREDYTY & POŻYCZKI",
        "NIERUCHOMOŚCI", "OBSŁUGA PRAWNO-KSIĘGOWA", "MARKETING & REKLAMA",
        "USŁUGI", "POZOSTAŁE"
      ]);

      const expensesToInsert: any[] = [];
      let imported = 0;
      let skipped = 0;
      const log: string[] = [];

      let currentSection = "COMPANY";

      for (let r = 6; r < data.length; r++) {
        const rowLabel = String(data[r][0] || "").trim();
        if (!rowLabel) continue;

        if (rowLabel === "APARTAMENTY") {
          currentSection = "APARTMENT";
          continue;
        }

        if (rowLabel === "PODSUMOWANIE" || rowLabel.includes("RAZEM") || rowLabel === "prognoza" || rowLabel === "koszty" || rowLabel === "saldo") {
          continue;
        }

        const isCompanyCost = companyCategories.has(rowLabel.toUpperCase());
        let aptResolution: { ids: number[]; divideBy: number } | null = null;

        if (!isCompanyCost && currentSection === "APARTMENT") {
          aptResolution = resolveApartment(rowLabel);
          if (!aptResolution) {
            log.push(`Pominięto: ${rowLabel} (nie znaleziono apartamentu)`);
            skipped++;
            continue;
          }
        }

        for (const mc of monthColumns) {
          if (mc.year < 2022) continue;

          const realCol = mc.col + 1;
          const realVal = Number(data[r][realCol]) || 0;

          if (realVal === 0) continue;

          const dateStr = `${mc.year}-${String(mc.month + 1).padStart(2, "0")}-01`;

          if (isCompanyCost || currentSection === "COMPANY") {
            expensesToInsert.push({
              date: dateStr,
              category: rowLabel,
              amount: String(Math.round(realVal * 100) / 100),
              apartmentId: null,
              description: `Import z Excel: ${rowLabel}`,
              type: "FIXED",
              isForecast: false,
            });
            imported++;
          } else if (aptResolution) {
            const perApt = Math.round((realVal / aptResolution.divideBy) * 100) / 100;
            for (const aptId of aptResolution.ids) {
              expensesToInsert.push({
                date: dateStr,
                category: rowLabel,
                amount: String(perApt),
                apartmentId: aptId,
                description: `Import z Excel: ${rowLabel}`,
                type: "VARIABLE",
                isForecast: false,
              });
              imported++;
            }
          }
        }
      }

      if (expensesToInsert.length > 0) {
        const batchSize = 500;
        for (let i = 0; i < expensesToInsert.length; i += batchSize) {
          const batch = expensesToInsert.slice(i, i + batchSize);
          await db.insert(expenses).values(batch);
        }
      }

      log.push(`Zaimportowano ${imported} rekordów kosztów`);
      if (skipped > 0) log.push(`Pominięto ${skipped} nierozpoznanych wierszy`);

      res.json({ imported, skipped, log, message: `Import kosztów zakończony: ${imported} rekordów` });
    } catch (err: any) {
      console.error("Cost import error:", err);
      res.status(500).json({ message: "Błąd importu kosztów: " + (err.message || "Nieznany błąd") });
    }
  });

  // Import revenue forecasts from Excel Przychody sheet
  app.post("/api/import-revenue-forecasts", isAuthenticated, async (req, res) => {
    try {
      const filePath = path.resolve("attached_assets/BAŁTYCKIE_1771496530840.xlsx");
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Plik Excel nie został znaleziony" });
      }

      const fileBuffer = fs.readFileSync(filePath);
      const wb = XLSX.read(fileBuffer);
      const ws = wb.Sheets["Przychody"];
      if (!ws) {
        return res.status(404).json({ message: "Arkusz Przychody nie został znaleziony" });
      }

      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];
      const excelEpoch = new Date(1899, 11, 30).getTime();

      const headerRow = data[0];
      const yearBlocks: { startCol: number; year: number; months: { col: number; month: number }[] }[] = [];

      let currentBlockStart = -1;
      let currentBlockYear = 0;
      let monthsInBlock: { col: number; month: number }[] = [];

      for (let c = 1; c < headerRow.length; c++) {
        const val = headerRow[c];
        if (typeof val === "number" && val >= 2022 && val <= 2030) {
          if (currentBlockStart > 0 && monthsInBlock.length > 0) {
            yearBlocks.push({ startCol: currentBlockStart, year: currentBlockYear, months: monthsInBlock });
          }
          currentBlockYear = val;
          currentBlockStart = -1;
          monthsInBlock = [];
          continue;
        }
        if (typeof val === "number" && val > 40000) {
          const d = new Date(excelEpoch + val * 86400000);
          const yr = d.getFullYear();
          const mo = d.getMonth();
          if (yr >= 2022) {
            if (currentBlockStart < 0) currentBlockStart = c;
            if (currentBlockYear === 0) currentBlockYear = yr;
            monthsInBlock.push({ col: c, month: mo });
          }
        }
        if (val === "" && currentBlockStart > 0 && monthsInBlock.length >= 12) {
          yearBlocks.push({ startCol: currentBlockStart, year: currentBlockYear, months: monthsInBlock });
          currentBlockStart = -1;
          currentBlockYear = 0;
          monthsInBlock = [];
        }
      }
      if (currentBlockStart > 0 && monthsInBlock.length > 0) {
        yearBlocks.push({ startCol: currentBlockStart, year: currentBlockYear, months: monthsInBlock });
      }

      const locationRows: { name: string; prognozaRow: number; przychodyRow: number }[] = [];
      for (let r = 1; r < data.length; r++) {
        const label = String(data[r][0] || "").trim();
        if (["GRAND BALTIC", "BULWAR PORTOWY", "WCZASOWA", "NA WYDMIE", "PRZEWŁOKA", "LUXURO PARK"].includes(label.toUpperCase())) {
          const nextLabel1 = String(data[r + 1]?.[0] || "").trim().toLowerCase();
          const nextLabel2 = String(data[r + 2]?.[0] || "").trim().toLowerCase();
          if (nextLabel1 === "prognoza" && nextLabel2 === "przychody") {
            locationRows.push({ name: label.toUpperCase(), prognozaRow: r + 1, przychodyRow: r + 2 });
          }
        }
        if (label === "RAZEM:" || label.toUpperCase() === "RAZEM:") {
          const nextLabel1 = String(data[r + 1]?.[0] || "").trim().toLowerCase();
          const nextLabel2 = String(data[r + 2]?.[0] || "").trim().toLowerCase();
          if (nextLabel1 === "prognoza" && nextLabel2 === "przychody") {
            locationRows.push({ name: "RAZEM", prognozaRow: r + 1, przychodyRow: r + 2 });
          }
        }
      }

      await storage.deleteLocationLevelForecasts();

      const forecastsToInsert: any[] = [];
      let imported = 0;

      for (const loc of locationRows) {
        for (const block of yearBlocks) {
          for (const mc of block.months) {
            const forecastVal = Number(data[loc.prognozaRow]?.[mc.col]) || 0;
            const actualVal = Number(data[loc.przychodyRow]?.[mc.col]) || 0;

            if (forecastVal === 0 && actualVal === 0) continue;

            forecastsToInsert.push({
              year: block.year,
              month: mc.month,
              locationName: loc.name,
              apartmentId: null,
              forecast: String(Math.round(forecastVal * 100) / 100),
              actual: String(Math.round(actualVal * 100) / 100),
            });
            imported++;
          }
        }
      }

      if (forecastsToInsert.length > 0) {
        await storage.createRevenueForecastsBulk(forecastsToInsert);
      }

      const yearSummary: Record<number, number> = {};
      for (const f of forecastsToInsert) {
        yearSummary[f.year] = (yearSummary[f.year] || 0) + 1;
      }

      res.json({
        imported,
        yearSummary,
        locations: locationRows.map(l => l.name),
        message: `Import prognoz zakończony: ${imported} rekordów dla ${locationRows.length} lokalizacji`,
      });
    } catch (err: any) {
      console.error("Revenue forecast import error:", err);
      res.status(500).json({ message: "Błąd importu prognoz: " + (err.message || "Nieznany błąd") });
    }
  });

  const contractUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
  app.post('/api/parse-sublease-pdf', isAuthenticated, contractUpload.array('files', 20), async (req, res) => {
    const tmpFiles: string[] = [];
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "Brak plików" });
      }

      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
      for (const file of files) {
        const ext = file.originalname.toLowerCase();
        const isAllowed = allowedTypes.includes(file.mimetype) ||
          ext.endsWith('.pdf') || ext.endsWith('.jpg') || ext.endsWith('.jpeg') ||
          ext.endsWith('.png') || ext.endsWith('.webp') || ext.endsWith('.heic');
        if (!isAllowed) {
          return res.status(400).json({ message: `Nieobsługiwany format pliku: ${file.originalname}. Dozwolone: PDF, JPG, PNG, WEBP` });
        }
      }

      const tmpDir = os.tmpdir();
      const pageImages: string[] = [];

      for (const file of files) {
        if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
          const pdfPath = path.join(tmpDir, `sublease_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`);
          fs.writeFileSync(pdfPath, file.buffer);
          tmpFiles.push(pdfPath);

          const prefix = path.join(tmpDir, `sublease_pages_${Date.now()}_${Math.random().toString(36).slice(2)}`);
          execSync(`pdftoppm -png -r 200 "${pdfPath}" "${prefix}"`, { timeout: 30000 });

          const pageFiles = fs.readdirSync(tmpDir)
            .filter((f: string) => f.startsWith(path.basename(prefix)) && f.endsWith('.png'))
            .sort();

          for (const pageFile of pageFiles) {
            const pagePath = path.join(tmpDir, pageFile);
            tmpFiles.push(pagePath);
            const imgBuffer = fs.readFileSync(pagePath);
            pageImages.push(imgBuffer.toString('base64'));
          }
        } else {
          pageImages.push(file.buffer.toString('base64'));
        }
      }

      if (pageImages.length === 0) {
        return res.status(400).json({ message: "Nie udało się odczytać plików" });
      }

      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const maxPages = Math.min(pageImages.length, 8);
      const content: any[] = [
        {
          type: 'text',
          text: `Przeanalizuj te zdjecia/strony umowy podnajmu/najmu mieszkania. Wyciagnij nastepujace dane w formacie JSON.
Jesli dane nie wystepuja w dokumencie, wpisz null.
{
  "tenantType": "osoba_fizyczna" lub "firma",
  "firstName": "imie najemcy",
  "lastName": "nazwisko najemcy",
  "companyName": "nazwa firmy (jesli firma)",
  "nip": "NIP firmy",
  "peselOrPassport": "PESEL lub numer paszportu osoby fizycznej",
  "street": "ulica i numer najemcy",
  "postalCode": "kod pocztowy najemcy",
  "city": "miasto najemcy",
  "phone": "telefon",
  "email": "email",
  "apartmentAddress": "pelny adres wynajmowanej nieruchomosci (ulica, numer, kod pocztowy, miasto)",
  "startDate": "YYYY-MM-DD data rozpoczecia",
  "endDate": "YYYY-MM-DD data zakonczenia",
  "rentAmount": kwota czynszu miesiecznego BRUTTO (z VAT) jako liczba. Jesli na umowie widnieje kwota netto + VAT (np. 15000 + 8% VAT = 16200), ZAWSZE podaj kwote brutto lacznie z podatkiem (czyli 16200),
  "additionalFees": dodatkowe oplaty BRUTTO (z VAT) jako liczba lub null,
  "mediaByMeters": true jesli media wg licznikow, false jesli ryczalt,
  "hasDeposit": true jesli jest kaucja,
  "depositAmount": kwota kaucji jako liczba lub null,
  "vatRate": "stawka VAT np. 23%",
  "paymentSchedule": [
    {
      "date": "YYYY-MM-DD termin platnosci",
      "amount": kwota jako liczba,
      "description": "opis platnosci np. Czynsz za styczeń 2025"
    }
  ]
}
WAZNE: Wszystkie kwoty w paymentSchedule musza byc BRUTTO (z VAT). Jesli kwota na umowie jest podana jako netto + VAT, oblicz kwote brutto i uzyj jej.
Pole "paymentSchedule" - jesli w umowie jest harmonogram oplat, tabela rat, lub lista platnosci z datami i kwotami, wyciagnij je wszystkie. Jesli nie ma harmonogramu, ale sa podane czynsz miesieczny i daty umowy, wygeneruj harmonogram miesiecznych platnosci od startDate do endDate z kwota rentAmount (brutto!) i tytulami "Czynsz za [miesiac] [rok]". Daty platnosci ustaw na 10. dzien kazdego miesiaca. Jesli jest kaucja, dodaj ja jako pierwsza platnosc z opisem "Kaucja".
Odpowiedz TYLKO czystym JSON bez zadnych komentarzy ani markdown.`
        }
      ];

      for (let i = 0; i < maxPages; i++) {
        content.push({
          type: 'image_url',
          image_url: { url: `data:image/png;base64,${pageImages[i]}` }
        });
      }

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content }],
        max_tokens: 4000,
      });

      const rawText = response.choices[0]?.message?.content || '';
      const jsonMatch = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

      let extracted;
      try {
        extracted = JSON.parse(jsonMatch);
      } catch {
        return res.status(422).json({ message: "Nie udalo sie sparsowac odpowiedzi AI", raw: rawText });
      }

      res.json({ extracted, pages: pageImages.length });
    } catch (err: any) {
      console.error("Contract parse error:", err);
      res.status(500).json({ message: "Blad parsowania: " + (err.message || "Nieznany blad") });
    } finally {
      for (const f of tmpFiles) {
        try { fs.unlinkSync(f); } catch {}
      }
    }
  });

  return httpServer;
}
