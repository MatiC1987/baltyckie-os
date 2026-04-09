import type { Express } from "express";
import type { Server } from "http";
import * as fs from "fs";
import * as path from "path";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { storage } from "./storage";
import { api } from "@shared/routes";
import webpush from "web-push";
import { insertBlockadeSchema, insertSaldoEntrySchema, insertSubleaseSchema, insertSubleasePaymentSchema, insertSubleaseApartmentChangeSchema, insertDocumentCategorySchema, insertDocumentTemplateSchema, insertSubleaseMeterReadingSchema, insertSubleaseMeterSettingSchema, insertSubleaseMeterPriceSchema, insertSubleaseElectricityChargeSchema, insertMediaSettlementReportSchema, insertCostScheduleSchema, insertCostSchedulePaymentSchema, insertInstallmentScheduleSchema, insertInstallmentPaymentSchema, insertServiceContractAttachmentSchema, insertInvoiceSchema, insertRevenueForecastSchema, insertCostForecastSchema, insertOperationalCostForecastSchema, insertVariableCostForecastSchema, insertOwnerContractSchema, insertHandoverProtocolSchema, insertHandoverProtocolRoomSchema, insertHandoverProtocolItemSchema, insertHandoverProtocolMeterSchema, insertTechnicalInspectionSchema, insertLoanSchema, insertLoanPaymentSchema, insertCustomerSchema, insertWorkScheduleSchema, insertLeaveRequestSchema, insertLegalCaseSchema, insertLegalCaseEventSchema, legalCases, legalCaseEvents, userPreferences, costSchedulePayments, subleasePayments, medicalExams, employees, leases, subleases, reservations, apartments, expenses, accounts, accountSnapshots, activityLogs, owners, blockades, locations, serviceContracts, serviceContractCategories, saldoEntries, saldoInitialBalances, saldoCategories, installmentPayments, installmentSchedules, costSchedules, documentCategories, documentTemplates, appUsers, attachments, subleaseAttachments, subleaseApartmentChanges, subleaseMeterReadings, subleaseMeterSettings, subleaseMeterPrices, subleaseElectricityCharges, mediaSettlementReports, ownerPayments, ownerContracts, ownerContractApartments, costForecasts, revenueForecasts, operationalCostForecasts, variableCostForecasts, serviceContractAttachments, importMetadata, invoices, notifications, handoverProtocols, handoverProtocolRooms, handoverProtocolItems, handoverProtocolMeters, loans, loanPayments, users, bankTransactions, appConfig, aptCostData, opCostData, issues, locationLogs, insertIssueSchema, employeeTrainings, insertEmployeeTrainingSchema, employeeContracts, insertEmployeeContractSchema, webauthnCredentials, payrollPeriods, payrollEntries, extraRevenues, insertExtraRevenueSchema } from "@shared/schema";
import { eq, and, lt, lte, gte, ne, sql, count, desc, ilike, or, asc, inArray, between } from "drizzle-orm";
import { db } from "./db";
import { z } from "zod";
import multer from "multer";
import * as XLSX from "xlsx";
import * as gocardless from "./gocardless";
import { execSync } from "child_process";
import os from "os";
import OpenAI from "openai";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const contractUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const MAX_PDF_DIRECT_SIZE = 15 * 1024 * 1024;

interface PdfConversionResult {
  images: Array<{ mimeType: string; data: string }>;
  pdfBuffer: Buffer | null;
  tmpFiles: string[];
}

function convertPdfToImages(
  pdfBuffer: Buffer,
  tmpDir: string,
  options: { maxPages?: number; label?: string } = {}
): PdfConversionResult {
  const maxPages = options.maxPages || 10;
  const label = options.label || 'pdf';
  const result: PdfConversionResult = { images: [], pdfBuffer: null, tmpFiles: [] };

  const pdfPath = path.join(tmpDir, `${label}_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`);
  fs.writeFileSync(pdfPath, pdfBuffer);
  result.tmpFiles.push(pdfPath);

  const prefix = path.join(tmpDir, `${label}_pages_${Date.now()}_${Math.random().toString(36).slice(2)}`);

  let convertedOk = false;

  try {
    execSync(`pdftoppm -jpeg -r 72 -l ${maxPages} "${pdfPath}" "${prefix}"`, { timeout: 120000 });
    const pageFiles = fs.readdirSync(tmpDir)
      .filter((f: string) => f.startsWith(path.basename(prefix)) && (f.endsWith('.jpg') || f.endsWith('.png')))
      .sort();
    if (pageFiles.length > 0) {
      convertedOk = true;
      for (const pageFile of pageFiles) {
        const pagePath = path.join(tmpDir, pageFile);
        result.tmpFiles.push(pagePath);
        const imgBuf = fs.readFileSync(pagePath);
        result.images.push({ mimeType: 'image/jpeg', data: imgBuf.toString('base64') });
      }
    }
  } catch (e: any) {
    console.log(`pdftoppm (72 DPI) failed for ${label}: ${e.message}`);
  }

  if (!convertedOk) {
    try {
      const convertPrefix = path.join(tmpDir, `${label}_convert_${Date.now()}_${Math.random().toString(36).slice(2)}`);
      execSync(`convert -density 72 "${pdfPath}[0-${maxPages - 1}]" -quality 80 "${convertPrefix}-%d.jpg"`, { timeout: 120000 });
      const convertFiles = fs.readdirSync(tmpDir)
        .filter((f: string) => f.startsWith(path.basename(convertPrefix)) && f.endsWith('.jpg'))
        .sort();
      if (convertFiles.length > 0) {
        convertedOk = true;
        for (const cf of convertFiles) {
          const cfPath = path.join(tmpDir, cf);
          result.tmpFiles.push(cfPath);
          const imgBuf = fs.readFileSync(cfPath);
          result.images.push({ mimeType: 'image/jpeg', data: imgBuf.toString('base64') });
        }
      }
    } catch (e2: any) {
      console.log(`ImageMagick convert failed for ${label}: ${e2.message}`);
    }
  }

  if (!convertedOk) {
    if (pdfBuffer.length <= MAX_PDF_DIRECT_SIZE) {
      console.log(`Sending ${label} PDF directly to AI (${(pdfBuffer.length / 1024 / 1024).toFixed(1)}MB)`);
      result.pdfBuffer = pdfBuffer;
    } else {
      console.log(`PDF ${label} too large for direct send (${(pdfBuffer.length / 1024 / 1024).toFixed(1)}MB > ${(MAX_PDF_DIRECT_SIZE / 1024 / 1024).toFixed(0)}MB limit), and conversion failed`);
    }
  }

  return result;
}

function generateRecurrenceDates(startDate: string, endDate: string, recurrenceType: string): string[] {
  const VALID_TYPES = ["MIESIECZNIE", "KWARTALNIE", "ROCZNIE"];
  if (!VALID_TYPES.includes(recurrenceType)) return [];
  if (endDate < startDate) return [];

  const dates: string[] = [];
  const startParts = startDate.split("-").map(Number);
  const origYear = startParts[0], origMonth = startParts[1], origDay = startParts[2];
  const end = new Date(endDate + "T12:00:00Z");
  const monthStep = recurrenceType === "MIESIECZNIE" ? 1 : recurrenceType === "KWARTALNIE" ? 3 : 12;

  let step = 1;
  while (true) {
    const totalMonths = (origMonth - 1) + step * monthStep;
    const targetYear = origYear + Math.floor(totalMonths / 12);
    const targetMonth = (totalMonths % 12) + 1;
    const lastDayOfMonth = new Date(targetYear, targetMonth, 0).getDate();
    const day = Math.min(origDay, lastDayOfMonth);
    const dateStr = `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const d = new Date(dateStr + "T12:00:00Z");
    if (d > end) break;
    dates.push(dateStr);
    step++;
  }
  return dates;
}

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
    { name: "Pożyczki", type: "LOAN", category: "INNE", balanceSource: "auto_loans" },
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

function computeNextRecurringDate(currentDate: string | null, recurring: string): string | null {
  if (!currentDate) return null;
  const d = new Date(currentDate);
  const r = recurring.toLowerCase().trim();
  if (r === "codziennie" || r === "co dzień" || r === "daily") d.setDate(d.getDate() + 1);
  else if (r === "co tydzień" || r === "weekly") d.setDate(d.getDate() + 7);
  else if (r === "co 2 tygodnie" || r === "biweekly") d.setDate(d.getDate() + 14);
  else if (r === "co miesiąc" || r === "monthly") d.setMonth(d.getMonth() + 1);
  else if (r === "co kwartał" || r === "quarterly") d.setMonth(d.getMonth() + 3);
  else if (r === "co rok" || r === "yearly") d.setFullYear(d.getFullYear() + 1);
  else d.setDate(d.getDate() + 7);
  return d.toISOString().split("T")[0];
}

async function syncApartmentLeaseDates(apartmentId: number) {
  try {
    const allContracts = await storage.getOwnerContracts({ apartmentId });
    const activeContracts = allContracts.filter(c => c.status === 'AKTYWNA');
    if (activeContracts.length === 0) return;

    activeContracts.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
    const latest = activeContracts[0];

    await db.update(apartments).set({
      leaseStartDate: latest.startDate || null,
      leaseEndDate: latest.endDate || null,
    }).where(eq(apartments.id, apartmentId));
  } catch (err) {
    console.error('Error syncing apartment lease dates:', err);
  }
}

async function syncApartmentAddressAndLocation(apartmentId: number, parsedData: any) {
  try {
    if (!parsedData) return;
    const apt = await storage.getApartment(apartmentId);
    if (!apt) return;

    const updates: any = {};

    if (parsedData.apartmentAddress && (!apt.address || apt.address.trim() === '')) {
      updates.address = parsedData.apartmentAddress;
    }

    if (parsedData.locationHint && (!apt.location || apt.location.trim() === '' || apt.location === 'INNE')) {
      const locationMap: Record<string, string> = {
        'grand baltic': 'GRAND BALTIC',
        'bulwar portowy': 'BULWAR PORTOWY',
        'na wydmie': 'NA WYDMIE',
        'wczasowa': 'WCZASOWA',
        'luxuro park': 'LUXURO PARK',
        'przewloka': 'PRZEWŁOKA',
        'przewłoka': 'PRZEWŁOKA',
      };
      const hint = parsedData.locationHint.toLowerCase().trim();
      for (const [key, val] of Object.entries(locationMap)) {
        if (hint.includes(key)) {
          updates.location = val;
          break;
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.update(apartments).set(updates).where(eq(apartments.id, apartmentId));
    }
  } catch (err) {
    console.error('Error syncing apartment address/location:', err);
  }
}

function getPaymentDatesForFrequency(
  frequency: string,
  startDate: Date,
  endDate: Date,
  payDay: number
): Date[] {
  const dates: Date[] = [];
  const freq = (frequency || 'MIESIECZNIE').toUpperCase();

  if (freq === 'NIEREGULARNE') return [];

  let monthStep = 1;
  if (freq === 'KWARTALNIE') monthStep = 3;
  else if (freq === 'POLROCZNIE') monthStep = 6;
  else if (freq === 'ROCZNIE') monthStep = 12;

  const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  while (current <= endDate) {
    const paymentDate = new Date(current.getFullYear(), current.getMonth(), Math.min(payDay, 28));
    if (paymentDate >= startDate && paymentDate <= endDate) {
      dates.push(paymentDate);
    }
    current.setMonth(current.getMonth() + monthStep);
  }
  return dates;
}

async function syncContractPaymentSchedule(contract: any) {
  try {
    if (!contract.apartmentId || !contract.monthlyRent || !contract.startDate) return;
    const freq = contract.paymentFrequency || 'MIESIECZNIE';
    if (freq === 'NIEREGULARNE') return;

    const startDate = new Date(contract.startDate);
    const endDate = contract.endDate ? new Date(contract.endDate) : new Date(startDate.getFullYear() + 1, startDate.getMonth(), startDate.getDate());

    const existingPayments = await storage.getOwnerPayments(contract.apartmentId);
    const contractPayments = existingPayments.filter(p => p.title?.includes(`Umowa #${contract.id}`));
    if (contractPayments.length > 0) return;

    const payDay = contract.paymentDay || 10;
    const paymentDates = getPaymentDatesForFrequency(freq, startDate, endDate, payDay);

    for (const paymentDate of paymentDates) {
      await storage.createOwnerPayment({
        apartmentId: contract.apartmentId,
        title: `Czynsz - Umowa #${contract.id}`,
        category: 'czynsz_wlasciciel',
        amount: String(contract.monthlyRent),
        paymentDate: paymentDate.toISOString().split('T')[0],
      });
    }
  } catch (err) {
    console.error('Error syncing contract payment schedule:', err);
  }
}

async function syncContractPaymentScheduleForApartment(contract: any, alloc: any) {
  try {
    if (!alloc.apartmentId || !alloc.rentAmount || !contract.startDate) return;
    const freq = contract.paymentFrequency || 'MIESIECZNIE';
    if (freq === 'NIEREGULARNE') return;

    const startDate = new Date(contract.startDate);
    const endDate = contract.endDate ? new Date(contract.endDate) : new Date(startDate.getFullYear() + 1, startDate.getMonth(), startDate.getDate());

    const existingPayments = await storage.getOwnerPayments(alloc.apartmentId);
    const contractPayments = existingPayments.filter(p => p.title?.includes(`Umowa #${contract.id}`));
    if (contractPayments.length > 0) return;

    const payDay = contract.paymentDay || 10;
    const paymentDates = getPaymentDatesForFrequency(freq, startDate, endDate, payDay);

    for (const paymentDate of paymentDates) {
      await storage.createOwnerPayment({
        apartmentId: alloc.apartmentId,
        title: `Czynsz - Umowa #${contract.id}`,
        category: 'czynsz_wlasciciel',
        amount: String(alloc.rentAmount),
        paymentDate: paymentDate.toISOString().split('T')[0],
      });
    }
  } catch (err) {
    console.error('Error syncing contract payment schedule for apartment:', err);
  }
}

function checkContractOverlap(contracts: any[], newContract: any): { overlap: boolean; conflicting?: any } {
  if (!newContract.startDate) return { overlap: false };
  const newStart = new Date(newContract.startDate);
  const newEnd = newContract.endDate ? new Date(newContract.endDate) : new Date(9999, 11, 31);

  for (const c of contracts) {
    if (c.id === newContract.id) continue;
    if (c.status !== 'AKTYWNA') continue;
    if (c.contractType === 'ANEKS') continue;

    const cStart = c.startDate ? new Date(c.startDate) : new Date(0);
    const cEnd = c.endDate ? new Date(c.endDate) : new Date(9999, 11, 31);

    if (newStart <= cEnd && newEnd >= cStart) {
      return { overlap: true, conflicting: c };
    }
  }
  return { overlap: false };
}

async function syncContractCostForecasts(contract: any) {
  try {
    if (!contract.apartmentId || !contract.monthlyRent) return;

    const apt = await storage.getApartment(contract.apartmentId);
    const startDate = contract.startDate ? new Date(contract.startDate) : null;
    const endDate = contract.endDate ? new Date(contract.endDate) : null;
    const currentYear = new Date().getFullYear();

    for (const year of [currentYear, currentYear + 1]) {
      await db.delete(costForecasts).where(
        and(
          eq(costForecasts.year, year),
          eq(costForecasts.sourceType, 'owner_contract'),
          eq(costForecasts.sourceContractId, contract.id)
        )
      );

      const costsToCreate: any[] = [];
      const freq = contract.paymentFrequency || 'MIESIECZNIE';
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year, 11, 31);
      const effStart = startDate && startDate > yearStart ? startDate : yearStart;
      const effEnd = endDate && endDate < yearEnd ? endDate : yearEnd;
      const payDay = contract.paymentDay || 10;

      if (freq === 'NIEREGULARNE') {
        // skip
      } else {
        const paymentDates = getPaymentDatesForFrequency(freq, effStart, effEnd, payDay);
        for (const pd of paymentDates) {
          const month = pd.getMonth() + 1;
          if (contract.monthlyRent) {
            costsToCreate.push({
              year,
              month,
              apartmentId: contract.apartmentId,
              category: 'czynsz_wlasciciel',
              forecast: String(contract.monthlyRent),
              actual: "0",
              sourceType: 'owner_contract',
              sourceContractId: contract.id,
              locationName: apt?.location || null,
            });
          }
          if (contract.additionalFees && Number(contract.additionalFees) > 0) {
            costsToCreate.push({
              year,
              month,
              apartmentId: contract.apartmentId,
              category: 'oplaty_dodatkowe_wlasciciel',
              forecast: String(contract.additionalFees),
              actual: "0",
              sourceType: 'owner_contract',
              sourceContractId: contract.id,
              locationName: apt?.location || null,
            });
          }
        }
      }
      if (costsToCreate.length > 0) {
        await storage.createCostForecastsBulk(costsToCreate);
      }
    }
  } catch (err) {
    console.error('Error syncing contract cost forecasts:', err);
  }
}

async function backfillContractAllocations() {
  try {
    const contracts = await storage.getOwnerContracts();
    for (const contract of contracts) {
      if (!contract.apartmentId) continue;
      const existing = await storage.getOwnerContractApartments(contract.id);
      if (existing.length === 0) {
        await storage.createOwnerContractApartment({
          contractId: contract.id,
          apartmentId: contract.apartmentId,
          rentAmount: contract.monthlyRent || '0',
          additionalFeesAmount: contract.additionalFees || '0',
        });
      }
    }
    if (contracts.length > 0) {
      console.log(`Backfilled allocations for ${contracts.length} contracts`);
    }
  } catch (err) {
    console.error('Error backfilling contract allocations:', err);
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
  backfillContractAllocations().catch(console.error);

  // VAPID keys setup
  async function getOrCreateVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
    const pubKey = await storage.getAppConfig("vapid_public_key");
    const privKey = await storage.getAppConfig("vapid_private_key");
    if (pubKey && privKey) {
      return { publicKey: pubKey, privateKey: privKey };
    }
    const keys = webpush.generateVAPIDKeys();
    await storage.setAppConfig("vapid_public_key", keys.publicKey);
    await storage.setAppConfig("vapid_private_key", keys.privateKey);
    return keys;
  }

  const vapidKeysPromise = getOrCreateVapidKeys().then((keys) => {
    webpush.setVapidDetails("mailto:admin@baltyckie.pl", keys.publicKey, keys.privateKey);
    return keys;
  }).catch((err) => {
    console.error("Failed to initialize VAPID keys:", err);
    return null;
  });

  app.get("/api/push/vapid-public-key", async (_req, res) => {
    try {
      const keys = await vapidKeysPromise;
      res.json({ publicKey: keys?.publicKey || null });
    } catch {
      res.status(500).json({ message: "VAPID keys not available" });
    }
  });

  app.post("/api/push/subscribe", async (req, res) => {
    try {
      const { endpoint, p256dh, auth, userType } = req.body;
      if (!endpoint || !p256dh || !auth) {
        return res.status(400).json({ message: "Missing subscription fields" });
      }
      const sub = await storage.createPushSubscription({
        endpoint,
        p256dh,
        auth,
        userType: userType || "admin",
        userId: null,
      });
      res.json(sub);
    } catch (err) {
      console.error("Push subscribe error:", err);
      res.status(500).json({ message: "Failed to save subscription" });
    }
  });

  app.post("/api/push/unsubscribe", async (req, res) => {
    try {
      const { endpoint } = req.body;
      if (!endpoint) return res.status(400).json({ message: "Missing endpoint" });
      await storage.deletePushSubscription(endpoint);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to remove subscription" });
    }
  });

  app.post("/api/push/send", isAuthenticated, async (req, res) => {
    try {
      const { title, body, url, tag, userType } = req.body;
      if (!title || !body) return res.status(400).json({ message: "title and body required" });

      const subs = await storage.getPushSubscriptions(userType || undefined);
      const payload = JSON.stringify({ title, body, url: url || "/", tag: tag || "default" });

      let sent = 0;
      let failed = 0;
      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
          sent++;
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await storage.deletePushSubscriptionById(sub.id);
          }
          failed++;
        }
      }
      res.json({ sent, failed, total: subs.length });
    } catch (err) {
      console.error("Push send error:", err);
      res.status(500).json({ message: "Failed to send notifications" });
    }
  });

  app.get("/api/push/subscriptions", isAuthenticated, async (req, res) => {
    try {
      const userType = req.query.userType as string | undefined;
      const subs = await storage.getPushSubscriptions(userType);
      res.json({ count: subs.length, subscriptions: subs });
    } catch (err) {
      res.status(500).json({ message: "Failed to get subscriptions" });
    }
  });

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

  app.get("/api/default-menu-config", isAuthenticated, async (_req, res) => {
    try {
      const [config] = await db.select().from(appConfig).where(eq(appConfig.key, "default_menu_config"));
      if (config?.value) {
        res.json(JSON.parse(config.value));
      } else {
        res.json(null);
      }
    } catch (err) {
      res.status(500).json({ message: "Failed to load default config" });
    }
  });

  app.put("/api/default-menu-config", isAuthenticated, async (req: any, res) => {
    try {
      const value = JSON.stringify(req.body);
      const [existing] = await db.select().from(appConfig).where(eq(appConfig.key, "default_menu_config"));
      if (existing) {
        await db.update(appConfig).set({ value, updatedAt: new Date() }).where(eq(appConfig.key, "default_menu_config"));
      } else {
        await db.insert(appConfig).values({ key: "default_menu_config", value });
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to save default config" });
    }
  });

  app.post("/api/force-menu-config", isAuthenticated, async (req: any, res) => {
    try {
      const { sidebarLayout } = req.body;
      if (!sidebarLayout || typeof sidebarLayout !== "string") {
        return res.status(400).json({ message: "sidebarLayout is required" });
      }

      const [existing] = await db.select().from(appConfig).where(eq(appConfig.key, "forced_menu_config"));
      if (existing) {
        await db.update(appConfig).set({ value: sidebarLayout, updatedAt: new Date() }).where(eq(appConfig.key, "forced_menu_config"));
      } else {
        await db.insert(appConfig).values({ key: "forced_menu_config", value: sidebarLayout });
      }

      const result = await db.update(userPreferences).set({ sidebarLayout, updatedAt: new Date() }).returning();
      const updatedCount = result.length;

      res.json({ success: true, updatedCount });
    } catch (err) {
      console.error("Failed to force menu config:", err);
      res.status(500).json({ message: "Failed to force menu config" });
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
      let upcomingInspectionsResult: any[] = [];

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

      try {
        const allInspections = await storage.getTechnicalInspections();
        upcomingInspectionsResult = allInspections.filter(i => {
          if (i.status === 'WYKONANY') return false;
          return i.nextDate <= in30days;
        }).map(i => ({
          id: i.id,
          inspectionType: i.inspectionType,
          nextDate: i.nextDate,
          apartmentId: i.apartmentId,
          isOverdue: i.nextDate < today,
        }));
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
        upcomingInspections: upcomingInspectionsResult,
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

      const activeSubleases = await db.select({
        id: subleases.id,
        apartmentId: subleases.apartmentId,
        apartmentIds: subleases.apartmentIds,
        startDate: subleases.startDate,
        endDate: subleases.endDate,
      })
        .from(subleases)
        .where(and(
          lte(subleases.startDate, endDate),
          gte(subleases.endDate, startDate),
          ne(subleases.status, "ANULOWANA"),
        ));

      const allSubChangesOcc = await db.select().from(subleaseApartmentChanges);
      const changesBySubOcc: Record<number, any[]> = {};
      for (const ch of allSubChangesOcc) {
        if (!changesBySubOcc[ch.subleaseId]) changesBySubOcc[ch.subleaseId] = [];
        changesBySubOcc[ch.subleaseId].push(ch);
      }

      const occPeriodStart = new Date(startDate);
      const occPeriodEnd = new Date(endDate);
      const periodStartMs = occPeriodStart.getTime();

      const subleaseOccByApt: Record<number, Set<number>> = {};
      for (const s of activeSubleases) {
        const subStart = new Date(s.startDate);
        const subEnd = new Date(s.endDate);

        const baseIds: number[] = s.apartmentIds && s.apartmentIds.length > 0
          ? [...s.apartmentIds]
          : (s.apartmentId ? [s.apartmentId] : []);
        if (baseIds.length === 0) continue;

        const changes = (changesBySubOcc[s.id] || [])
          .slice().sort((a: any, b: any) => a.changeDate.localeCompare(b.changeDate));

        for (const baseId of baseIds) {
          const segments: { aptId: number; start: Date; end: Date }[] = [];
          let curId = baseId;
          let curStart = subStart;
          for (const ch of changes) {
            if (ch.oldApartmentId === curId) {
              const chDate = new Date(ch.changeDate);
              if (chDate > curStart && chDate <= subEnd) {
                segments.push({ aptId: curId, start: curStart, end: new Date(chDate.getTime() - 86400000) });
                curId = ch.newApartmentId;
                curStart = chDate;
              }
            }
          }
          segments.push({ aptId: curId, start: curStart, end: subEnd });

          for (const seg of segments) {
            const segStart = seg.start > occPeriodStart ? seg.start : occPeriodStart;
            const segEnd = seg.end < occPeriodEnd ? seg.end : occPeriodEnd;
            const days = Math.max(0, Math.ceil((segEnd.getTime() - segStart.getTime()) / 86400000));
            if (!subleaseOccByApt[seg.aptId]) subleaseOccByApt[seg.aptId] = new Set<number>();
            for (let d = 0; d < days; d++) {
              const dayNum = Math.floor((segStart.getTime() + d * 86400000 - periodStartMs) / 86400000);
              subleaseOccByApt[seg.aptId].add(dayNum);
            }
          }
        }
      }

      const periodStart = periodStartMs;

      const result = allApartments.map(apt => {
        const occupiedDaySet = new Set<number>();

        const aptReservations = allReservations.filter(r => r.apartmentId === apt.id);
        for (const r of aptReservations) {
          const rStart = new Date(Math.max(new Date(r.startDate).getTime(), new Date(startDate).getTime()));
          const rEnd = new Date(Math.min(new Date(r.endDate).getTime(), new Date(endDate).getTime()));
          const days = Math.max(0, Math.ceil((rEnd.getTime() - rStart.getTime()) / 86400000));
          for (let d = 0; d < days; d++) {
            const dayNum = Math.floor((rStart.getTime() + d * 86400000 - periodStart) / 86400000);
            occupiedDaySet.add(dayNum);
          }
        }

        const aptSubDays = subleaseOccByApt[apt.id];
        if (aptSubDays) {
          for (const dayNum of aptSubDays) {
            occupiedDaySet.add(dayNum);
          }
        }

        const occupiedDays = occupiedDaySet.size;
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

      const allApartments = await db.select({ id: apartments.id, name: apartments.name, location: apartments.location }).from(apartments);

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

      const yearSubleases = await db.select().from(subleases).where(and(
        lte(subleases.startDate, endDate),
        gte(subleases.endDate, startDate),
        ne(subleases.status, "ZAKONCZONA"),
      ));

      const aptCostRowsProfit = await db.select({
        entryId: aptCostData.entryId,
        prognoza: aptCostData.prognoza,
        realized: aptCostData.realized,
      }).from(aptCostData).where(eq(aptCostData.year, year));

      const allSubChangesProfit = await db.select().from(subleaseApartmentChanges);
      const changesBySubProfit: Record<number, any[]> = {};
      for (const ch of allSubChangesProfit) {
        if (!changesBySubProfit[ch.subleaseId]) changesBySubProfit[ch.subleaseId] = [];
        changesBySubProfit[ch.subleaseId].push(ch);
      }

      const subleaseRevenueByApt: Record<number, number> = {};
      const yearStartDate = new Date(startDate);
      const yearEndDate = new Date(endDate);

      for (const sub of yearSubleases) {
        const subStart = new Date(sub.startDate);
        const subEnd = new Date(sub.endDate);
        const totalDays = Math.max(0, Math.floor((subEnd.getTime() - subStart.getTime()) / 86400000) + 1);
        if (totalDays === 0) continue;

        const monthlyRent = Number(sub.rentAmount || 0);
        const totalSubleaseValue = monthlyRent * (totalDays / 30.44);

        const baseIds: number[] = sub.apartmentIds && sub.apartmentIds.length > 0
          ? [...sub.apartmentIds]
          : (sub.apartmentId ? [sub.apartmentId] : []);
        if (baseIds.length === 0) continue;

        const changes = ((changesBySubProfit as any)[sub.id] || [])
          .slice().sort((a: any, b: any) => a.changeDate.localeCompare(b.changeDate));

        for (const baseId of baseIds) {
          const segments: { aptId: number; start: Date; end: Date }[] = [];
          let curId = baseId;
          let curStart = subStart;
          for (const ch of changes) {
            if (ch.oldApartmentId === curId) {
              const chDate = new Date(ch.changeDate);
              if (chDate > curStart && chDate <= subEnd) {
                segments.push({ aptId: curId, start: curStart, end: new Date(chDate.getTime() - 86400000) });
                curId = ch.newApartmentId;
                curStart = chDate;
              }
            }
          }
          segments.push({ aptId: curId, start: curStart, end: subEnd });

          for (const seg of segments) {
            const segStart = seg.start > yearStartDate ? seg.start : yearStartDate;
            const segEnd = seg.end < yearEndDate ? seg.end : yearEndDate;
            const segDays = Math.max(0, Math.floor((segEnd.getTime() - segStart.getTime()) / 86400000) + 1);
            if (segDays <= 0) continue;
            const revenue = (segDays / totalDays) * totalSubleaseValue / baseIds.length;
            subleaseRevenueByApt[seg.aptId] = (subleaseRevenueByApt[seg.aptId] || 0) + revenue;
          }
        }
      }

      const costByApt: Record<number, number> = {};
      let gbAllCost = 0;
      for (const c of aptCostRowsProfit) {
        const val = Number(c.realized || 0) > 0 ? Number(c.realized) : Number(c.prognoza || 0);
        if (c.entryId === 'gb-all') {
          gbAllCost += val;
        } else if (c.entryId.startsWith('apt-')) {
          const aptId = parseInt(c.entryId.replace('apt-', ''));
          if (!isNaN(aptId)) costByApt[aptId] = (costByApt[aptId] || 0) + val;
        }
      }

      const perAptData = allApartments.map(apt => {
        const aptReservations = yearReservations.filter(r => r.apartmentId === apt.id);
        const reservationRevenue = aptReservations.reduce((s, r) => s + Number(r.price || 0), 0);
        const subleaseRevenue = subleaseRevenueByApt[apt.id] || 0;
        const totalRevenue = reservationRevenue + subleaseRevenue;
        const cost = costByApt[apt.id] || 0;
        const rentownosc = totalRevenue - cost;
        return {
          apartmentId: apt.id,
          apartmentName: apt.name,
          location: apt.location || '',
          reservationRevenue,
          subleaseRevenue: Math.round(subleaseRevenue * 100) / 100,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          cost: Math.round(cost * 100) / 100,
          rentownosc: Math.round(rentownosc * 100) / 100,
          reservationCount: aptReservations.length,
        };
      });

      const grandBalticApts = perAptData.filter(a => a.location === 'GRAND BALTIC');
      const otherApts = perAptData.filter(a => a.location !== 'GRAND BALTIC');

      const result: any[] = [...otherApts];

      if (grandBalticApts.length > 0) {
        const grouped = {
          apartmentId: -1,
          apartmentName: `GRAND BALTIC (${grandBalticApts.length} lokali)`,
          location: 'GRAND BALTIC',
          reservationRevenue: grandBalticApts.reduce((s, a) => s + a.reservationRevenue, 0),
          subleaseRevenue: Math.round(grandBalticApts.reduce((s, a) => s + a.subleaseRevenue, 0) * 100) / 100,
          totalRevenue: Math.round(grandBalticApts.reduce((s, a) => s + a.totalRevenue, 0) * 100) / 100,
          cost: Math.round((grandBalticApts.reduce((s, a) => s + a.cost, 0) + gbAllCost) * 100) / 100,
          rentownosc: Math.round((grandBalticApts.reduce((s, a) => s + a.rentownosc, 0) - gbAllCost) * 100) / 100,
          reservationCount: grandBalticApts.reduce((s, a) => s + a.reservationCount, 0),
        };
        result.push(grouped);
      }

      result.sort((a, b) => b.rentownosc - a.rentownosc);

      const totalRevenue = result.reduce((s, r) => s + r.totalRevenue, 0);
      const totalCost = result.reduce((s, r) => s + r.cost, 0);
      const totalProfit = result.reduce((s, r) => s + r.rentownosc, 0);

      res.json({
        apartments: result,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        totalProfit: Math.round(totalProfit * 100) / 100,
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

        const yearSubleases = await db.select({
          startDate: subleases.startDate,
          endDate: subleases.endDate,
          rentAmount: subleases.rentAmount,
        })
          .from(subleases)
          .where(and(
            lte(subleases.startDate, `${year}-12-31`),
            gte(subleases.endDate, `${year}-01-01`),
            ne(subleases.status, "ZAKONCZONA"),
          ));

        for (const sub of yearSubleases) {
          const monthlyRent = Number(sub.rentAmount || 0);
          if (monthlyRent <= 0) continue;
          const subStart = new Date(sub.startDate);
          const subEnd = new Date(sub.endDate);

          for (let m = 0; m < 12; m++) {
            const monthStart = new Date(year, m, 1);
            const monthEnd = new Date(year, m + 1, 0);
            const daysInMonth = monthEnd.getDate();

            const overlapStart = subStart > monthStart ? subStart : monthStart;
            const overlapEnd = subEnd < monthEnd ? subEnd : monthEnd;

            if (overlapStart <= overlapEnd) {
              const overlapDays = Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / 86400000) + 1;
              const proportionalRent = (monthlyRent / daysInMonth) * overlapDays;
              monthlyRevenue[m] += proportionalRent;
            }
          }
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
      const aptId = Number(req.params.id);

      await db.delete(costForecasts).where(eq(costForecasts.apartmentId, aptId));
      await db.delete(revenueForecasts).where(eq(revenueForecasts.apartmentId, aptId));
      await db.delete(ownerPayments).where(eq(ownerPayments.apartmentId, aptId));
      await db.delete(ownerContractApartments).where(eq(ownerContractApartments.apartmentId, aptId));
      await db.delete(ownerContracts).where(eq(ownerContracts.apartmentId, aptId));

      await storage.deleteApartment(aptId);
      res.status(204).send();
    } catch (err: any) {
      console.error("Error deleting apartment:", err);
      res.status(500).json({ message: "Nie udało się usunąć apartamentu." });
    }
  });

  app.post('/api/apartments/recalculate-cleaning-fees', isAuthenticated, async (req, res) => {
    try {
      const allApartments = await storage.getApartments();
      const aptMap = new Map(allApartments.map(a => [a.id, a]));
      const allReservations = await storage.getReservations();
      const toUpdate = allReservations.filter(r =>
        (!r.surcharge || Number(r.surcharge) === 0) && r.apartmentId
      );

      let updatedCount = 0;
      const log: string[] = [];

      for (const r of toUpdate) {
        let totalCleaningFee = 0;
        const aptIds = r.apartmentIds && r.apartmentIds.length > 0 ? r.apartmentIds : (r.apartmentId ? [r.apartmentId] : []);
        for (const aptId of aptIds) {
          const apt = aptMap.get(aptId);
          if (apt && apt.cleaningFee && Number(apt.cleaningFee) > 0) {
            totalCleaningFee += Number(apt.cleaningFee);
          }
        }
        if (totalCleaningFee > 0) {
          const basePrice = Number(r.price) || 0;
          const newPrice = (basePrice + totalCleaningFee).toFixed(2);
          await storage.updateReservation(r.id, {
            price: newPrice,
            surcharge: totalCleaningFee.toFixed(2),
          });
          updatedCount++;
          log.push(`Rez. ${r.reservationNumber}: ${basePrice.toFixed(2)} → ${newPrice} (+${totalCleaningFee.toFixed(2)} sprzątanie)`);
        }
      }

      res.json({ updated: updatedCount, log });
    } catch (err: any) {
      console.error("Error recalculating cleaning fees:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // Reservations
  app.get(api.reservations.list.path, isAuthenticated, async (req, res) => {
    const pageParam = req.query.page ? Number(req.query.page) : undefined;
    const limitParam = req.query.limit ? Number(req.query.limit) : undefined;

    if (pageParam && limitParam) {
      try {
        const page = Math.max(1, pageParam);
        const limit = Math.min(100, Math.max(1, limitParam));
        const result = await storage.getReservationsPaginated({
          page,
          limit,
          sortField: 'startDate',
          sortDir: 'desc',
          status: req.query.status as string | undefined,
          dateFrom: req.query.startDate as string | undefined,
          dateTo: req.query.endDate as string | undefined,
          search: req.query.search as string | undefined,
          source: req.query.source as string | undefined,
        });
        res.json({ data: result.data, total: result.total, page: result.page, limit });
      } catch (err) {
        console.error("Error fetching paginated reservations:", err);
        res.status(500).json({ message: "Nie udało się pobrać rezerwacji" });
      }
    } else {
      const filters = {
        apartmentId: req.query.apartmentId ? Number(req.query.apartmentId) : undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      };
      const reservationsList = await storage.getReservations(filters);
      res.json(reservationsList);
    }
  });

  app.get("/api/reservations-paginated", isAuthenticated, async (req, res) => {
    try {
      const result = await storage.getReservationsPaginated({
        page: Math.max(1, Number(req.query.page) || 1),
        limit: Math.min(100, Math.max(1, Number(req.query.limit) || 40)),
        sortField: (req.query.sortField as string) || 'startDate',
        sortDir: (req.query.sortDir as 'asc' | 'desc') || 'desc',
        status: req.query.status as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        search: req.query.search as string | undefined,
        source: req.query.source as string | undefined,
      });
      res.json(result);
    } catch (err) {
      console.error("Error fetching paginated reservations:", err);
      res.status(500).json({ message: "Nie udało się pobrać rezerwacji" });
    }
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

      if (input.recurrenceType && input.recurrenceEndDate) {
        const recurDates = generateRecurrenceDates(input.date, input.recurrenceEndDate, input.recurrenceType);
        for (const d of recurDates) {
          await storage.createExpense({
            ...input,
            date: d,
            parentExpenseId: expense.id,
            recurrenceType: null,
            recurrenceEndDate: null,
            isForecast: true,
          });
        }
      }

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
      if (acc.type === "LOAN") {
        const loansBalance = await storage.getLoansBalance();
        acc.latestBalance = loansBalance.toFixed(2);
        acc.balanceSource = "auto_loans";
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
      const subleaseAptIds = s.apartmentIds && s.apartmentIds.length > 0
        ? s.apartmentIds
        : (s.apartmentId ? [s.apartmentId] : []);

      const payments = subleasePaymentsAll[s.id] || [];
      for (const p of payments) {
        if (!p.dueDate) continue;
        if ((p.category || '').toLowerCase() === 'kaucja') continue;
        const pd = new Date(p.dueDate);
        if (pd.getFullYear() !== year) continue;
        const month = pd.getMonth();
        const amount = Number(p.amount) || 0;
        const paymentAptIds = p.apartmentId ? [p.apartmentId] : subleaseAptIds;

        for (const aptId of paymentAptIds) {
          if (!aptId) continue;
          initMonth(aptId, month);
          revenueData[aptId][month].podnajem += paymentAptIds.length > 0 ? amount / paymentAptIds.length : amount;
          if (p.status === "do_oplacenia") {
            revenueData[aptId][month].doplaty_podnajem += paymentAptIds.length > 0 ? amount / paymentAptIds.length : amount;
          }
        }
      }
    }

    const checksumData = await storage.getSubleasePaymentsTotalByYear(year);

    res.json({ ...revenueData, _checksum: { totalPodnajem: checksumData.total, byMonth: checksumData.byMonth } });
  });

  app.get("/api/costs", isAuthenticated, async (req, res) => {
    try {
      const year = Number(req.query.year) || new Date().getFullYear();
      const allExpenses = await storage.getExpenses();
      const costsData: Record<number, Record<number, number>> = {};
      for (const exp of allExpenses) {
        if (!exp.date || !exp.apartmentId) continue;
        const d = new Date(exp.date);
        if (d.getFullYear() !== year) continue;
        const month = d.getMonth();
        const aptId = exp.apartmentId;
        if (!costsData[aptId]) costsData[aptId] = {};
        if (!costsData[aptId][month]) costsData[aptId][month] = 0;
        costsData[aptId][month] += Number(exp.amount) || 0;
      }
      res.json(costsData);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
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

  app.get("/api/account-balance-history", isAuthenticated, async (_req, res) => {
    const allSnapshots = await storage.getSnapshots();
    const grouped: Record<number, { date: string; balance: string }[]> = {};
    for (const s of allSnapshots) {
      if (!grouped[s.accountId]) grouped[s.accountId] = [];
      grouped[s.accountId].push({ date: s.date, balance: s.balance });
    }
    for (const key of Object.keys(grouped)) {
      grouped[Number(key)].sort((a, b) => a.date.localeCompare(b.date));
    }
    res.json(grouped);
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

  app.post('/api/apartments/:apartmentId/payments/recurring', isAuthenticated, async (req, res) => {
    try {
      const apartmentId = Number(req.params.apartmentId);
      const { title, category, amount, frequency, startDate, endDate, paymentDay } = req.body;

      if (!title || !category || !amount || !frequency || !startDate) {
        return res.status(400).json({ message: "Brakuje wymaganych pól" });
      }

      const validFrequencies = ['MIESIECZNIE', 'KWARTALNIE', 'POLROCZNIE', 'ROCZNIE', 'NIEREGULARNE'];
      if (!validFrequencies.includes(frequency)) {
        return res.status(400).json({ message: "Nieprawidłowa częstotliwość" });
      }

      const parsedAmount = Number(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ message: "Kwota musi być liczbą większą od 0" });
      }

      const day = paymentDay ? Number(paymentDay) : 10;
      if (isNaN(day) || day < 1 || day > 31) {
        return res.status(400).json({ message: "Dzień płatności musi być między 1 a 31" });
      }

      const start = new Date(startDate);
      if (isNaN(start.getTime())) {
        return res.status(400).json({ message: "Nieprawidłowa data rozpoczęcia" });
      }

      const end = endDate && endDate.trim()
        ? new Date(endDate)
        : new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
      if (isNaN(end.getTime())) {
        return res.status(400).json({ message: "Nieprawidłowa data zakończenia" });
      }

      if (end < start) {
        return res.status(400).json({ message: "Data zakończenia musi być późniejsza niż data rozpoczęcia" });
      }

      if (frequency === 'NIEREGULARNE') {
        const paymentDate = new Date(start.getFullYear(), start.getMonth(), Math.min(day, 28));
        if (paymentDate < start) paymentDate.setMonth(paymentDate.getMonth() + 1);
        const payment = await storage.createOwnerPayment({
          apartmentId,
          title,
          category,
          amount: String(parsedAmount),
          paymentDate: paymentDate.toISOString().split('T')[0],
        });
        return res.status(201).json({ count: 1, payments: [payment] });
      }

      const dates = getPaymentDatesForFrequency(frequency, start, end, day);

      if (dates.length === 0) {
        return res.status(400).json({ message: "Nie wygenerowano żadnych opłat w podanym zakresie dat" });
      }

      if (dates.length > 120) {
        return res.status(400).json({ message: "Zbyt wiele opłat do wygenerowania (max 120)" });
      }

      const created = [];
      for (const d of dates) {
        const payment = await storage.createOwnerPayment({
          apartmentId,
          title,
          category,
          amount: String(parsedAmount),
          paymentDate: d.toISOString().split('T')[0],
        });
        created.push(payment);
      }

      res.status(201).json({ count: created.length, payments: created });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.delete('/api/owner-payments/:id', isAuthenticated, async (req, res) => {
    try {
      const paymentId = Number(req.params.id);
      const [payment] = await db.select().from(ownerPayments).where(eq(ownerPayments.id, paymentId));

      if (payment && payment.title) {
        const contractMatch = payment.title.match(/Umowa #(\d+)/);
        if (contractMatch) {
          const contractId = Number(contractMatch[1]);
          const paymentDate = new Date(payment.paymentDate);
          const month = paymentDate.getMonth() + 1;
          const year = paymentDate.getFullYear();

          await db.delete(costForecasts).where(
            and(
              eq(costForecasts.year, year),
              eq(costForecasts.month, month),
              eq(costForecasts.apartmentId, payment.apartmentId),
              eq(costForecasts.sourceType, 'owner_contract'),
              eq(costForecasts.sourceContractId, contractId)
            )
          );
        }
      }

      await storage.deleteOwnerPayment(paymentId);
      res.status(204).send();
    } catch (err: any) {
      console.error("Error deleting owner payment:", err);
      res.status(500).json({ message: "Nie udało się usunąć raty." });
    }
  });

  // Owner Contracts
  app.get('/api/owner-contracts', isAuthenticated, async (req, res) => {
    try {
      const filters: { ownerId?: number; apartmentId?: number; status?: string } = {};
      if (req.query.ownerId) filters.ownerId = Number(req.query.ownerId);
      if (req.query.apartmentId) filters.apartmentId = Number(req.query.apartmentId);
      if (req.query.status) filters.status = String(req.query.status);
      const contracts = await storage.getOwnerContracts(filters);
      const allAllocations = await db.select().from(ownerContractApartments);
      const allocMap = new Map<number, typeof allAllocations>();
      for (const a of allAllocations) {
        if (!allocMap.has(a.contractId)) allocMap.set(a.contractId, []);
        allocMap.get(a.contractId)!.push(a);
      }
      const enriched = contracts.map(c => ({
        ...c,
        allocations: allocMap.get(c.id) || [],
      }));
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/owner-contracts/:id', isAuthenticated, async (req, res) => {
    const contract = await storage.getOwnerContract(Number(req.params.id));
    if (!contract) return res.status(404).json({ message: "Umowa nie znaleziona" });
    const allocations = await storage.getOwnerContractApartments(contract.id);
    res.json({ ...contract, allocations });
  });

  app.get('/api/apartments/:id/dashboard-stats', isAuthenticated, async (req, res) => {
    try {
      const aptId = Number(req.params.id);
      const currentYear = new Date().getFullYear();
      const prevYear = currentYear - 1;

      const allReservations = await storage.getReservations({ apartmentId: aptId });
      const currentYearRes = allReservations.filter(r => r.startDate?.startsWith(String(currentYear)) && r.status !== 'ANULOWANA');
      const prevYearRes = allReservations.filter(r => r.startDate?.startsWith(String(prevYear)) && r.status !== 'ANULOWANA');

      const sumPaid = (list: any[]) => list.reduce((s, r) => s + Number(r.paidAmount || 0), 0);
      const revenueCurrentYear = sumPaid(currentYearRes);
      const revenuePrevYear = sumPaid(prevYearRes);

      const allRevForecasts = await storage.getRevenueForecasts();
      const aptRevForecasts = allRevForecasts.filter(f => f.apartmentId === aptId && f.year === currentYear);
      const forecastRevenue = aptRevForecasts.reduce((s, f) => s + Number(f.forecast || 0), 0);
      const actualRevenue = aptRevForecasts.reduce((s, f) => s + Number(f.actual || 0), 0);

      const allCostForecasts = await storage.getCostForecasts();
      const aptCostsCurrent = allCostForecasts.filter(f => f.apartmentId === aptId && f.year === currentYear);
      const aptCostsPrev = allCostForecasts.filter(f => f.apartmentId === aptId && f.year === prevYear);
      const costsCurrent = aptCostsCurrent.reduce((s, f) => s + Number(f.forecast || 0), 0);
      const costsPrev = aptCostsPrev.reduce((s, f) => s + Number(f.forecast || 0), 0);

      const monthlyData: { month: number; revenue: number; costs: number }[] = [];
      for (let m = 0; m < 12; m++) {
        const monthRes = currentYearRes.filter(r => {
          const d = r.startDate ? new Date(r.startDate) : null;
          return d && d.getMonth() === m;
        });
        const monthCosts = aptCostsCurrent.filter(f => f.month === m + 1);
        monthlyData.push({
          month: m + 1,
          revenue: sumPaid(monthRes),
          costs: monthCosts.reduce((s, f) => s + Number(f.forecast || 0), 0),
        });
      }

      const daysInYear = 365;
      const occupiedDays = currentYearRes.reduce((total, r) => {
        const start = new Date(r.startDate);
        const end = new Date(r.endDate);
        return total + Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      }, 0);
      const occupancyRate = Math.min(100, Math.round((occupiedDays / daysInYear) * 100));

      const directContracts = await storage.getOwnerContracts({ apartmentId: aptId });
      const aptAllocations = await storage.getOwnerContractApartmentsByApartment(aptId);
      const allocContractIds = aptAllocations.map(a => a.contractId);
      const allContracts = allocContractIds.length > 0 ? await storage.getOwnerContracts() : [];
      const allocContracts = allContracts.filter(c => allocContractIds.includes(c.id) && !directContracts.some(dc => dc.id === c.id));
      const contracts = [...directContracts, ...allocContracts];

      const activeContract = contracts.find(c => c.status === 'AKTYWNA' && c.contractType === 'UMOWA');
      const activeAlloc = activeContract ? aptAllocations.find(a => a.contractId === activeContract.id) : null;

      const unpaidReservations = currentYearRes.filter(r => r.status === 'DO_OPLACENIA');

      const rentHistory = contracts
        .filter(c => c.startDate)
        .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''))
        .map(c => {
          const alloc = aptAllocations.find(a => a.contractId === c.id);
          const rent = alloc ? Number(alloc.rentAmount || 0) : Number(c.monthlyRent || 0);
          return { date: c.startDate, rent, type: c.contractType, id: c.id };
        })
        .filter(r => r.rent > 0);

      res.json({
        revenueCurrentYear,
        revenuePrevYear,
        forecastRevenue,
        actualRevenue,
        forecastRealization: forecastRevenue > 0 ? Math.round((revenueCurrentYear / forecastRevenue) * 100) : 0,
        costsCurrent,
        costsPrev,
        profitCurrent: revenueCurrentYear - costsCurrent,
        profitPrev: revenuePrevYear - costsPrev,
        profitMargin: revenueCurrentYear > 0 ? Math.round(((revenueCurrentYear - costsCurrent) / revenueCurrentYear) * 100) : 0,
        occupancyRate,
        monthlyData,
        activeContract: activeContract ? {
          monthlyRent: activeAlloc ? activeAlloc.rentAmount : activeContract.monthlyRent,
          startDate: activeContract.startDate,
          endDate: activeContract.endDate,
          status: activeContract.status,
        } : null,
        unpaidCount: unpaidReservations.length,
        unpaidAmount: sumPaid(unpaidReservations.filter(r => Number(r.paidAmount) < Number(r.price))),
        currentYear,
        rentHistory,
      });
    } catch (err: any) {
      console.error('Dashboard stats error:', err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/owner-contracts', isAuthenticated, async (req, res) => {
    try {
      const body = { ...req.body };
      const allocationsInput = body.allocations || [];
      delete body.allocations;
      if (body.monthlyRent !== null && body.monthlyRent !== undefined) body.monthlyRent = String(body.monthlyRent);
      if (body.additionalFees !== null && body.additionalFees !== undefined) body.additionalFees = String(body.additionalFees);
      const parsed = insertOwnerContractSchema.parse(body);
      const contract = await storage.createOwnerContract(parsed);

      let allocations: any[] = [];
      if (allocationsInput.length > 0) {
        const allocs = allocationsInput.map((a: any) => ({
          contractId: contract.id,
          apartmentId: Number(a.apartmentId),
          rentAmount: a.rentAmount != null ? String(a.rentAmount) : null,
          additionalFeesAmount: a.additionalFeesAmount != null ? String(a.additionalFeesAmount) : null,
        }));
        allocations = await storage.setOwnerContractApartments(contract.id, allocs);
      } else if (contract.apartmentId) {
        allocations = await storage.setOwnerContractApartments(contract.id, [{
          contractId: contract.id,
          apartmentId: contract.apartmentId,
          rentAmount: contract.monthlyRent,
          additionalFeesAmount: contract.additionalFees,
        }]);
      }

      let overlapWarning: string | null = null;
      const allContracts = await storage.getOwnerContracts();
      const aptIds = allocations.length > 0 ? allocations.map(a => a.apartmentId) : (contract.apartmentId ? [contract.apartmentId] : []);
      for (const aptId of aptIds) {
        const aptContracts = allContracts.filter(c => c.apartmentId === aptId || allocations.some((al: any) => al.apartmentId === aptId && al.contractId === c.id));
        const result = checkContractOverlap(aptContracts, contract);
        if (result.overlap) {
          overlapWarning = `Uwaga: umowa pokrywa się z umową #${result.conflicting?.id} (${result.conflicting?.startDate} - ${result.conflicting?.endDate || 'bezterminowo'})`;
          break;
        }
      }

      if (contract.status === 'AKTYWNA') {
        for (const alloc of allocations) {
          await syncApartmentLeaseDates(alloc.apartmentId);
          await syncContractPaymentScheduleForApartment(contract, alloc);
        }
        if (allocations.length === 0 && contract.apartmentId) {
          await syncApartmentLeaseDates(contract.apartmentId);
          await syncContractPaymentSchedule(contract);
        }
      }

      res.status(201).json({ ...contract, allocations, overlapWarning });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: err.message });
    }
  });

  app.put('/api/owner-contracts/:id', isAuthenticated, async (req, res) => {
    try {
      const body = { ...req.body };
      const allocationsInput = body.allocations;
      delete body.allocations;
      if (body.monthlyRent !== null && body.monthlyRent !== undefined) body.monthlyRent = String(body.monthlyRent);
      if (body.additionalFees !== null && body.additionalFees !== undefined) body.additionalFees = String(body.additionalFees);
      const contract = await storage.updateOwnerContract(Number(req.params.id), body);

      let allocations: any[] = [];
      if (allocationsInput && Array.isArray(allocationsInput)) {
        const allocs = allocationsInput.map((a: any) => ({
          contractId: contract.id,
          apartmentId: Number(a.apartmentId),
          rentAmount: a.rentAmount != null ? String(a.rentAmount) : null,
          additionalFeesAmount: a.additionalFeesAmount != null ? String(a.additionalFeesAmount) : null,
        }));
        allocations = await storage.setOwnerContractApartments(contract.id, allocs);
      } else {
        allocations = await storage.getOwnerContractApartments(contract.id);
      }

      if (contract.status === 'AKTYWNA') {
        for (const alloc of allocations) {
          await syncApartmentLeaseDates(alloc.apartmentId);
          await syncContractPaymentScheduleForApartment(contract, alloc);
        }
      }

      let overlapWarning: string | null = null;
      const allContracts = await storage.getOwnerContracts();
      for (const alloc of allocations) {
        const aptContracts = allContracts.filter(c => c.apartmentId === alloc.apartmentId);
        const result = checkContractOverlap(aptContracts, contract);
        if (result.overlap) {
          overlapWarning = `Uwaga: umowa pokrywa się z umową #${result.conflicting?.id}`;
          break;
        }
      }

      res.json({ ...contract, allocations, overlapWarning });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete('/api/owner-contracts/:id', isAuthenticated, async (req, res) => {
    await storage.deleteOwnerContract(Number(req.params.id));
    res.status(204).send();
  });

  // Owner contract cost forecasts — view and delete auto-generated entries
  app.get('/api/owner-contracts/:id/cost-forecasts', isAuthenticated, async (req, res) => {
    try {
      const contractId = Number(req.params.id);
      const entries = await db.select({
        year: costForecasts.year,
        month: costForecasts.month,
        apartmentId: costForecasts.apartmentId,
        forecast: costForecasts.forecast,
        actual: costForecasts.actual,
      })
        .from(costForecasts)
        .where(and(
          eq(costForecasts.sourceType, 'owner_contract'),
          eq(costForecasts.sourceContractId, contractId)
        ))
        .orderBy(costForecasts.year, costForecasts.month);

      const totalByYear: Record<number, number> = {};
      for (const e of entries) {
        const val = Number(e.actual && Number(e.actual) > 0 ? e.actual : e.forecast) || 0;
        totalByYear[e.year] = (totalByYear[e.year] || 0) + val;
      }

      res.json({ contractId, entries, totalByYear });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete('/api/owner-contracts/:id/cost-forecasts', isAuthenticated, async (req, res) => {
    try {
      const contractId = Number(req.params.id);
      const year = req.query.year ? Number(req.query.year) : undefined;

      const conditions = [
        eq(costForecasts.sourceType, 'owner_contract'),
        eq(costForecasts.sourceContractId, contractId),
      ];
      if (year) conditions.push(eq(costForecasts.year, year));

      const deleted = await db.delete(costForecasts).where(and(...conditions)).returning({ id: costForecasts.id });
      res.json({ deleted: deleted.length });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Cost forecasts diagnostics — all auto-generated entries with contract existence check
  app.get('/api/cost-forecasts/diagnostics', isAuthenticated, async (req, res) => {
    try {
      const allEntries = await db.select({
        contractId: costForecasts.sourceContractId,
        apartmentId: costForecasts.apartmentId,
        year: costForecasts.year,
        forecast: costForecasts.forecast,
        actual: costForecasts.actual,
      })
        .from(costForecasts)
        .where(eq(costForecasts.sourceType, 'owner_contract'));

      const allContracts = await db.select({ id: ownerContracts.id }).from(ownerContracts);
      const contractIdSet = new Set(allContracts.map(c => c.id));

      const allApartments = await db.select({ id: apartments.id, name: apartments.name }).from(apartments);
      const aptMap = new Map(allApartments.map(a => [a.id, a.name]));

      // Group by contractId + apartmentId + year
      const grouped: Record<string, { contractId: number; contractExists: boolean; apartmentId: number; apartmentName: string; year: number; totalForecast: number }> = {};
      for (const e of allEntries) {
        if (!e.contractId) continue;
        const key = `${e.contractId}_${e.apartmentId}_${e.year}`;
        if (!grouped[key]) {
          grouped[key] = {
            contractId: e.contractId,
            contractExists: contractIdSet.has(e.contractId),
            apartmentId: e.apartmentId,
            apartmentName: aptMap.get(e.apartmentId) || `#${e.apartmentId}`,
            year: e.year,
            totalForecast: 0,
          };
        }
        const val = Number(e.actual && Number(e.actual) > 0 ? e.actual : e.forecast) || 0;
        grouped[key].totalForecast += val;
      }

      res.json(Object.values(grouped).sort((a, b) => b.year - a.year || a.apartmentName.localeCompare(b.apartmentName)));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Cost forecasts bulk operations
  app.post('/api/cost-forecasts/bulk', isAuthenticated, async (req, res) => {
    try {
      const { data } = req.body;
      if (!Array.isArray(data)) return res.status(400).json({ message: "Oczekiwano tablicy danych" });
      const parsed = data.map((d: any) => insertCostForecastSchema.parse(d));
      await storage.createCostForecastsBulk(parsed);
      res.json({ message: `Zaimportowano ${parsed.length} rekordów` });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: err.message });
    }
  });

  app.delete('/api/cost-forecasts', isAuthenticated, async (req, res) => {
    try {
      const year = req.query.year ? Number(req.query.year) : undefined;
      await storage.deleteCostForecasts(year);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Revenue forecasts bulk delete
  app.delete('/api/revenue-forecasts', isAuthenticated, async (req, res) => {
    try {
      const year = req.query.year ? Number(req.query.year) : undefined;
      await storage.deleteRevenueForecasts(year);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Copy forecasts from one year to another
  app.post('/api/forecasts/copy', isAuthenticated, async (req, res) => {
    try {
      const { sourceYear, targetYear, copyRevenue, copyCosts } = req.body;
      if (!sourceYear || !targetYear) return res.status(400).json({ message: "Podaj rok źródłowy i docelowy" });
      let revenueCount = 0;
      let costCount = 0;
      let opCostCount = 0;

      if (copyRevenue) {
        const sourceForecasts = await storage.getRevenueForecasts(sourceYear);
        const targetData = sourceForecasts.map(f => ({
          year: targetYear,
          month: f.month,
          locationName: f.locationName,
          apartmentId: f.apartmentId,
          forecast: f.forecast,
          actual: "0",
        }));
        if (targetData.length > 0) {
          await storage.deleteRevenueForecasts(targetYear);
          await storage.createRevenueForecastsBulk(targetData);
          revenueCount = targetData.length;
        }
      }

      if (copyCosts) {
        const sourceCosts = await storage.getCostForecasts(sourceYear);
        const targetData = sourceCosts.map(f => ({
          year: targetYear,
          month: f.month,
          apartmentId: f.apartmentId,
          category: f.category,
          forecast: f.forecast,
          actual: "0",
          sourceType: f.sourceType,
          sourceContractId: f.sourceContractId,
          locationName: f.locationName,
        }));
        if (targetData.length > 0) {
          await storage.deleteCostForecasts(targetYear);
          await storage.createCostForecastsBulk(targetData);
          costCount = targetData.length;
        }

        const sourceOpCosts = await storage.getOperationalCostForecasts(sourceYear);
        const opTargetData = sourceOpCosts.map(f => ({
          year: targetYear,
          month: f.month,
          categoryId: f.categoryId,
          itemIndex: f.itemIndex,
          forecast: f.forecast || "0",
          actual: "0",
        }));
        if (opTargetData.length > 0) {
          await storage.deleteOperationalCostForecasts(targetYear);
          await storage.createOperationalCostForecastsBulk(opTargetData);
          opCostCount = opTargetData.length;
        }
      }

      res.json({ message: `Skopiowano prognozy z ${sourceYear} na ${targetYear}: ${revenueCount} przychodów, ${costCount} kosztów apt., ${opCostCount} kosztów operacyjnych` });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Generate cost forecasts from owner contracts
  app.post('/api/owner-contracts/generate-costs', isAuthenticated, async (req, res) => {
    try {
      const { year } = req.body;
      if (!year) return res.status(400).json({ message: "Podaj rok" });

      const contracts = await storage.getOwnerContracts({ status: 'AKTYWNA' });
      const costsToCreate: any[] = [];

      for (const contract of contracts) {
        if (!contract.apartmentId) continue;

        const apt = await storage.getApartment(contract.apartmentId);
        const startDate = contract.startDate ? new Date(contract.startDate) : null;
        const endDate = contract.endDate ? new Date(contract.endDate) : null;

        for (let month = 0; month < 12; month++) {
          const checkDate = new Date(year, month, 15);
          if (startDate && checkDate < startDate) continue;
          if (endDate && checkDate > endDate) continue;

          if (contract.monthlyRent) {
            costsToCreate.push({
              year,
              month,
              apartmentId: contract.apartmentId,
              category: 'czynsz_wlasciciel',
              forecast: contract.monthlyRent,
              actual: "0",
              sourceType: 'owner_contract',
              sourceContractId: contract.id,
              locationName: apt?.location || null,
            });
          }

          if (contract.additionalFees) {
            costsToCreate.push({
              year,
              month,
              apartmentId: contract.apartmentId,
              category: 'oplaty_dodatkowe_wlasciciel',
              forecast: contract.additionalFees,
              actual: "0",
              sourceType: 'owner_contract',
              sourceContractId: contract.id,
              locationName: apt?.location || null,
            });
          }
        }
      }

      // Remove old contract-generated costs for this year
      await db.delete(costForecasts).where(
        and(
          eq(costForecasts.year, year),
          eq(costForecasts.sourceType, 'owner_contract')
        )
      );

      if (costsToCreate.length > 0) {
        await storage.createCostForecastsBulk(costsToCreate);
      }

      res.json({ message: `Wygenerowano ${costsToCreate.length} rekordów kosztów z ${contracts.length} umów na rok ${year}` });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/apartment-contract-costs', isAuthenticated, async (req, res) => {
    try {
      const year = Number(req.query.year) || new Date().getFullYear();
      const contracts = await storage.getOwnerContracts({ status: 'AKTYWNA' });
      const allAllocations = await db.select().from(ownerContractApartments);
      const allApartments = await storage.getApartments();
      const allLocations = await storage.getLocations();

      const result: Record<string, { apartmentId: number; apartmentName: string; location: string; items: { name: string; monthlyAmount: number; contractId: number }[] }> = {};

      for (const contract of contracts) {
        const startDate = contract.startDate ? new Date(contract.startDate) : null;
        const endDate = contract.endDate ? new Date(contract.endDate) : null;

        const yearStart = new Date(year, 0, 1);
        const yearEnd = new Date(year, 11, 31);
        if (startDate && startDate > yearEnd) continue;
        if (endDate && endDate < yearStart) continue;

        const contractAllocations = allAllocations.filter(a => a.contractId === contract.id);
        const aptEntries: { aptId: number; rent: number; fees: number }[] = [];

        if (contractAllocations.length > 0) {
          for (const alloc of contractAllocations) {
            aptEntries.push({
              aptId: alloc.apartmentId,
              rent: Number(alloc.rentAmount || contract.monthlyRent || 0),
              fees: Number(alloc.additionalFeesAmount || contract.additionalFees || 0),
            });
          }
        } else if (contract.apartmentId) {
          aptEntries.push({
            aptId: contract.apartmentId,
            rent: Number(contract.monthlyRent || 0),
            fees: Number(contract.additionalFees || 0),
          });
        }

        for (const entry of aptEntries) {
          const apt = allApartments.find(a => a.id === entry.aptId);
          if (!apt || apt.active === false) continue;

          const loc = allLocations.find(l => l.name === apt.location);
          const locName = apt.location || "Inne";
          const isGB = locName === "GRAND BALTIC";
          const key = isGB ? "gb-all" : `apt-${apt.id}`;

          if (!result[key]) {
            result[key] = {
              apartmentId: apt.id,
              apartmentName: isGB ? "GRAND BALTIC" : apt.name,
              location: locName,
              items: [],
            };
          }

          if (entry.rent > 0) {
            result[key].items.push({ name: "RATA DLA WŁAŚCICIELA", monthlyAmount: entry.rent, contractId: contract.id });
          }
          if (entry.fees > 0) {
            result[key].items.push({ name: "OPŁATY DODATKOWE", monthlyAmount: entry.fees, contractId: contract.id });
          }
        }
      }

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Excel export endpoint
  app.get('/api/forecasts/export-excel', isAuthenticated, async (req, res) => {
    try {
      const year = Number(req.query.year) || new Date().getFullYear();
      const revForecasts = await storage.getRevenueForecasts(year);
      const costForecasts = await storage.getCostForecasts(year);
      const allApartments = await storage.getApartments();
      
      const wb = XLSX.utils.book_new();
      
      // Revenue sheet
      const revRows: any[] = [];
      const aptMap = new Map(allApartments.map(a => [a.id, a]));
      const revByApt = new Map<number, Record<number, number>>();
      for (const f of revForecasts) {
        if (!f.apartmentId) continue;
        if (!revByApt.has(f.apartmentId)) revByApt.set(f.apartmentId, {});
        revByApt.get(f.apartmentId)![f.month] = Number(f.forecast) || 0;
      }
      for (const [aptId, months] of revByApt) {
        const apt = aptMap.get(aptId);
        const row: any = { Apartament: apt?.name || `ID:${aptId}`, Lokalizacja: apt?.location || "" };
        for (let m = 0; m < 12; m++) row[`M${m + 1}`] = months[m] || 0;
        revRows.push(row);
      }
      const revWs = XLSX.utils.json_to_sheet(revRows);
      XLSX.utils.book_append_sheet(wb, revWs, "Przychody");
      
      // Costs sheet
      const costRows: any[] = [];
      const costByApt = new Map<number, Record<number, number>>();
      for (const f of costForecasts) {
        if (!f.apartmentId) continue;
        if (!costByApt.has(f.apartmentId)) costByApt.set(f.apartmentId, {});
        const existing = costByApt.get(f.apartmentId)![f.month] || 0;
        costByApt.get(f.apartmentId)![f.month] = existing + (Number(f.forecast) || 0);
      }
      for (const [aptId, months] of costByApt) {
        const apt = aptMap.get(aptId);
        const row: any = { Apartament: apt?.name || `ID:${aptId}`, Lokalizacja: apt?.location || "" };
        for (let m = 0; m < 12; m++) row[`M${m + 1}`] = months[m] || 0;
        costRows.push(row);
      }
      const costWs = XLSX.utils.json_to_sheet(costRows);
      XLSX.utils.book_append_sheet(wb, costWs, "Koszty");
      
      // Operational costs sheet - uses new dedicated table with category/item structure
      const opForecasts = await storage.getOperationalCostForecasts(year);
      const opRows: any[] = [];
      const { DEFAULT_OPLATY_CATEGORIES } = await import("../shared/oplaty-defaults");
      for (const cat of DEFAULT_OPLATY_CATEGORIES) {
        for (let itemIdx = 0; itemIdx < cat.items.length; itemIdx++) {
          const item = cat.items[itemIdx];
          const itemLabel = item.subLabel ? `${item.name} (${item.subLabel})` : item.name;
          const row: any = { Kategoria: cat.title, Pozycja: itemLabel, KategoriaId: cat.id, ItemIndex: itemIdx };
          for (let m = 0; m < 12; m++) {
            const match = opForecasts.find(f => f.categoryId === cat.id && f.itemIndex === itemIdx && f.month === m);
            row[`M${m + 1}`] = match ? Number(match.forecast) || 0 : 0;
          }
          opRows.push(row);
        }
      }
      const opWs = XLSX.utils.json_to_sheet(opRows);
      XLSX.utils.book_append_sheet(wb, opWs, "Koszty operacyjne");
      
      const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
      res.setHeader("Content-Disposition", `attachment; filename=prognoza_${year}.xlsx`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.send(buffer);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Excel import endpoint
  app.post('/api/forecasts/import-excel', isAuthenticated, upload.single('file'), async (req, res) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ message: "Brak pliku" });
      
      const year = Number(req.body.year) || new Date().getFullYear();
      const wb = XLSX.read(file.buffer);
      const allApartments = await storage.getApartments();
      const aptNameMap = new Map(allApartments.map(a => [a.name.toLowerCase().trim(), a]));
      
      let revCount = 0;
      let costCount = 0;
      
      // Process Przychody sheet
      const revSheet = wb.Sheets["Przychody"];
      if (revSheet) {
        const rows = XLSX.utils.sheet_to_json<any>(revSheet);
        const revData: any[] = [];
        for (const row of rows) {
          const aptName = String(row.Apartament || "").toLowerCase().trim();
          const apt = aptNameMap.get(aptName);
          if (!apt) continue;
          for (let m = 0; m < 12; m++) {
            const val = Number(row[`M${m + 1}`]) || 0;
            if (val > 0) {
              revData.push({ year, month: m, apartmentId: apt.id, forecast: String(val), locationName: apt.location });
              revCount++;
            }
          }
        }
        if (revData.length > 0) {
          await storage.deleteRevenueForecasts(year);
          await storage.createRevenueForecastsBulk(revData);
        }
      }
      
      // Process Koszty sheet
      const costSheet = wb.Sheets["Koszty"];
      if (costSheet) {
        const rows = XLSX.utils.sheet_to_json<any>(costSheet);
        const costData: any[] = [];
        for (const row of rows) {
          const aptName = String(row.Apartament || "").toLowerCase().trim();
          const apt = aptNameMap.get(aptName);
          if (!apt) continue;
          for (let m = 0; m < 12; m++) {
            const val = Number(row[`M${m + 1}`]) || 0;
            if (val > 0) {
              costData.push({ year, month: m, apartmentId: apt.id, category: "czynsz_wlasciciel", forecast: String(val), sourceType: "manual", locationName: apt.location });
              costCount++;
            }
          }
        }
        if (costData.length > 0) {
          await storage.deleteManualCostForecasts(year);
          await storage.createCostForecastsBulk(costData);
        }
      }
      
      // Process Koszty operacyjne sheet
      let opCount = 0;
      const opSheet = wb.Sheets["Koszty operacyjne"];
      if (opSheet) {
        const rows = XLSX.utils.sheet_to_json<any>(opSheet);
        const opData: any[] = [];
        for (const row of rows) {
          const categoryId = String(row.KategoriaId || "").trim();
          const itemIndex = Number(row.ItemIndex);
          if (!categoryId || isNaN(itemIndex)) continue;
          for (let m = 0; m < 12; m++) {
            const val = Number(row[`M${m + 1}`]) || 0;
            if (val > 0) {
              opData.push({ year, month: m, categoryId, itemIndex, forecast: String(val), actual: "0" });
              opCount++;
            }
          }
        }
        if (opData.length > 0) {
          await storage.deleteOperationalCostForecasts(year);
          await storage.createOperationalCostForecastsBulk(opData);
        }
      }

      res.json({ message: `Zaimportowano: ${revCount} prognoz przychodów, ${costCount} kosztów apt., ${opCount} kosztów operacyjnych` });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
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
      const { fileName, objectPath, fileType, category, contractId } = req.body;
      if (!fileName || !objectPath) return res.status(400).json({ message: "Brak wymaganych pól" });
      const attachment = await storage.createAttachment({
        apartmentId: Number(req.params.id),
        contractId: contractId || null,
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

  app.put('/api/locations/:id/gps', isAuthenticated, async (req, res) => {
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
      res.json(loc);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Błąd aktualizacji GPS" });
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
      const emptyToNull = (key: string) => { if (data[key] === "" || data[key] === undefined) data[key] = null; };
      emptyToNull("rentAmount");
      emptyToNull("additionalFees");
      emptyToNull("depositAmount");
      emptyToNull("depositReturnDate");
      emptyToNull("paymentDay");
      emptyToNull("idNumber");
      emptyToNull("peselOrPassport");
      emptyToNull("comment");
      emptyToNull("phone");
      emptyToNull("email");
      emptyToNull("invoiceEmail");
      emptyToNull("street");
      emptyToNull("postalCode");
      emptyToNull("city");
      emptyToNull("nip");
      emptyToNull("firstName");
      emptyToNull("lastName");
      emptyToNull("companyName");
      emptyToNull("vatRate");
      if (typeof data.paymentDay === "string" && data.paymentDay !== null) data.paymentDay = parseInt(data.paymentDay, 10) || null;
      if (data.apartmentId === null || data.apartmentId === "" || data.apartmentId === undefined) data.apartmentId = null;
      if (typeof data.apartmentId === "string") data.apartmentId = parseInt(data.apartmentId, 10) || null;
      if (data.apartmentIds && Array.isArray(data.apartmentIds) && data.apartmentIds.length === 0) delete data.apartmentIds;
      if (data.status === "W_TRAKCIE_PODPISYWANIA" && !data.preparedAt) {
        data.preparedAt = new Date();
      }
      if (typeof data.preparedAt === "string" && data.preparedAt) {
        data.preparedAt = new Date(data.preparedAt);
      }
      if (data.preparedAt === "" || data.preparedAt === undefined) data.preparedAt = null;
      if (data.mediaByMeters === "" || data.mediaByMeters === undefined) data.mediaByMeters = false;
      if (data.hasDeposit === "" || data.hasDeposit === undefined) data.hasDeposit = false;
      delete data._apartmentAddress;
      const parsed = insertSubleaseSchema.parse(data);
      const created = await storage.createSublease(parsed);
      logActivity(req, "create", "sublease", created.id, parsed.firstName ? `${parsed.firstName} ${parsed.lastName || ""}` : parsed.companyName || undefined);
      res.status(201).json(created);
    } catch (err: any) {
      console.error("POST /api/subleases error:", JSON.stringify(err?.issues || err?.message || err));
      res.status(400).json({ message: err.message || "Błąd zapisu" });
    }
  });

  app.put('/api/subleases/:id', isAuthenticated, async (req, res) => {
    try {
      const data = { ...req.body };
      const emptyToNull = (key: string) => { if (data[key] === "" || data[key] === undefined) data[key] = null; };
      emptyToNull("rentAmount");
      emptyToNull("additionalFees");
      emptyToNull("depositAmount");
      emptyToNull("depositReturnDate");
      emptyToNull("paymentDay");
      emptyToNull("idNumber");
      emptyToNull("peselOrPassport");
      emptyToNull("comment");
      emptyToNull("phone");
      emptyToNull("email");
      emptyToNull("invoiceEmail");
      emptyToNull("street");
      emptyToNull("postalCode");
      emptyToNull("city");
      emptyToNull("nip");
      emptyToNull("firstName");
      emptyToNull("lastName");
      emptyToNull("companyName");
      emptyToNull("vatRate");
      if (typeof data.paymentDay === "string" && data.paymentDay !== null) data.paymentDay = parseInt(data.paymentDay, 10) || null;
      if (data.apartmentId === null || data.apartmentId === "" || data.apartmentId === undefined) data.apartmentId = null;
      if (typeof data.apartmentId === "string") data.apartmentId = parseInt(data.apartmentId, 10) || null;
      if (data.apartmentIds && Array.isArray(data.apartmentIds) && data.apartmentIds.length === 0) delete data.apartmentIds;
      if (typeof data.preparedAt === "string" && data.preparedAt) {
        data.preparedAt = new Date(data.preparedAt);
      }
      if (data.preparedAt === "" || data.preparedAt === undefined) data.preparedAt = null;
      if (data.mediaByMeters === "") data.mediaByMeters = false;
      if (data.hasDeposit === "") data.hasDeposit = false;
      delete data._apartmentAddress;
      const updated = await storage.updateSublease(Number(req.params.id), data);
      logActivity(req, "update", "sublease", updated.id);
      res.status(200).json(updated);
    } catch (err: any) {
      console.error("PUT /api/subleases error:", JSON.stringify(err?.issues || err?.message || err));
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

  app.get('/api/subleases/:id/electricity-charges', isAuthenticated, async (req, res) => {
    try {
      const charges = await storage.getElectricityCharges(Number(req.params.id));
      res.json(charges);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post('/api/subleases/:id/electricity-charges', isAuthenticated, async (req, res) => {
    try {
      const parsed = insertSubleaseElectricityChargeSchema.parse({ ...req.body, subleaseId: Number(req.params.id) });
      const created = await storage.createElectricityCharge(parsed);
      res.status(201).json(created);
    } catch (err: any) { res.status(400).json({ message: err.message || "Nieprawidłowe dane" }); }
  });

  app.post('/api/subleases/:id/electricity-charges/bulk', isAuthenticated, async (req, res) => {
    try {
      const { charges } = req.body;
      if (!Array.isArray(charges)) return res.status(400).json({ message: "charges must be an array" });
      const created = [];
      for (const charge of charges) {
        const parsed = insertSubleaseElectricityChargeSchema.parse({ ...charge, subleaseId: Number(req.params.id) });
        created.push(await storage.createElectricityCharge(parsed));
      }
      res.status(201).json(created);
    } catch (err: any) { res.status(400).json({ message: err.message || "Nieprawidłowe dane" }); }
  });

  app.put('/api/electricity-charges/:id', isAuthenticated, async (req, res) => {
    try {
      const updated = await storage.updateElectricityCharge(Number(req.params.id), req.body);
      res.json(updated);
    } catch (err: any) { res.status(400).json({ message: err.message || "Błąd aktualizacji" }); }
  });

  app.delete('/api/electricity-charges/:id', isAuthenticated, async (req, res) => {
    try {
      await storage.deleteElectricityCharge(Number(req.params.id));
      res.status(204).send();
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post('/api/subleases/:id/import-electricity-invoice', isAuthenticated, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "Brak pliku" });
      const tmpDir = os.tmpdir();

      let base64Images: Array<{data: string; mimeType: string}> = [];
      const conv = convertPdfToImages(req.file.buffer, tmpDir, { maxPages: 10, label: 'invoice' });
      for (const img of conv.images) {
        base64Images.push({ data: img.data, mimeType: img.mimeType });
      }
      for (const f of conv.tmpFiles) {
        try { fs.unlinkSync(f); } catch {}
      }

      if (base64Images.length === 0) {
        return res.status(400).json({ message: "Nie udało się przetworzyć PDF" });
      }

      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });
      const content: any[] = [
        {
          type: "text",
          text: `Analizujesz polską fakturę VAT od operatora energii elektrycznej. Wyciągnij WSZYSTKIE pozycje opłat z sekcji rozliczeniowej.

Dla każdej pozycji podaj:
- chargeName: nazwa opłaty (np. "Energia czynna", "Opłata sieciowa zmienna", "Opłata dystrybucyjna stała", "Akcyza", "Opłata jakościowa", "Opłata OZE", "Opłata kogeneracyjna", "Opłata abonamentowa", "Opłata mocowa")
- chargeType: "variable" jeśli opłata jest za kWh/MWh, "fixed" jeśli jest za miesiąc/okres rozliczeniowy
- unitPrice: cena jednostkowa netto (jako liczba, np. 0.4521)
- unit: "kWh" dla zmiennych, "mc" dla stałych
- vatRate: stawka VAT w % (np. 23)

WAŻNE:
- Ignoruj sekcję "Rozliczenie energii wprowadzonej do sieci" (prosument)
- Podawaj ceny NETTO (bez VAT)
- Jeśli cena jest za MWh, przelicz na kWh (podziel przez 1000)

Odpowiedz TYLKO prawidłowym JSON w formacie:
{"charges": [...], "vatRate": 23}`
        }
      ];
      for (const img of base64Images) {
        content.push({
          type: "image_url",
          image_url: { url: `data:${img.mimeType};base64,${img.data}`, detail: "high" }
        });
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content }],
        max_tokens: 2000,
        temperature: 0,
      });

      const text = response.choices[0]?.message?.content || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return res.status(400).json({ message: "AI nie mogło sparsować faktury. Spróbuj dodać stawki ręcznie." });
      }
      const parsed = JSON.parse(jsonMatch[0]);
      res.json(parsed);
    } catch (err: any) {
      console.error('Invoice import error:', err);
      res.status(500).json({ message: err.message || "Błąd importu faktury" });
    }
  });

  app.get('/api/pending-meter-readings', isAuthenticated, async (req, res) => {
    try {
      const pending = await storage.getPendingMeterReadings();
      const subleaseIds = [...new Set(pending.map(r => r.subleaseId))];
      const result: any[] = [];
      for (const sid of subleaseIds) {
        const sublease = await storage.getSublease(sid);
        if (!sublease) continue;
        const apts = await storage.getApartments();
        const apt = apts.find(a => a.id === sublease.apartmentId);
        const readings = pending.filter(r => r.subleaseId === sid);
        result.push({
          subleaseId: sid,
          apartmentName: apt?.name || "Nieznany",
          tenantName: sublease.tenantType === "firma"
            ? (sublease.companyName || "")
            : `${sublease.firstName || ""} ${sublease.lastName || ""}`.trim(),
          readings,
        });
      }
      res.json(result);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post('/api/meter-readings/confirm', isAuthenticated, async (req, res) => {
    try {
      const { readingIds } = req.body;
      if (!Array.isArray(readingIds)) return res.status(400).json({ message: "readingIds must be an array" });
      for (const id of readingIds) {
        await storage.updateMeterReadingStatus(id, "confirmed");
      }
      res.json({ success: true, confirmed: readingIds.length });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post('/api/meter-readings/settle', isAuthenticated, async (req, res) => {
    try {
      const { readingIds } = req.body;
      if (!Array.isArray(readingIds)) return res.status(400).json({ message: "readingIds must be an array" });
      for (const id of readingIds) {
        await storage.updateMeterReadingStatus(id, "settled");
      }
      res.json({ success: true, settled: readingIds.length });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
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
      const { paymentStatus, paidDate, paymentMethod } = req.body;
      if (!paymentStatus || !["NIEOPLACONE", "OPLACONE"].includes(paymentStatus)) {
        return res.status(400).json({ message: "Nieprawidłowy status płatności" });
      }
      const updated = await storage.updateMediaSettlementReportStatus(Number(req.params.id), paymentStatus, paidDate, paymentMethod);
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

  app.post('/api/saldo', isAuthenticated, async (req: any, res) => {
    try {
      const parsed = insertSaldoEntrySchema.parse(req.body);
      const user = req.user;
      const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
      const createdBy = fullName || user?.username || "Nieznany";
      const entry = await storage.createSaldoEntry({ ...parsed, createdBy });
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
    const withType = req.query.withType === 'true';
    if (withType) {
      const categories = await storage.getSaldoCategoriesWithType(personName);
      res.json(categories);
    } else {
      const categories = await storage.getSaldoCategories(personName);
      res.json(categories);
    }
  });

  app.post('/api/saldo/categories', isAuthenticated, async (req, res) => {
    const { name, personName, type } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: "Podaj nazwę kategorii" });
    }
    const validType = type === 'PRZYCHOD' ? 'PRZYCHOD' : 'KOSZT';
    await storage.createSaldoCategory(name.trim(), personName, validType);
    res.json({ success: true });
  });

  app.put('/api/saldo/categories/:name', isAuthenticated, async (req, res) => {
    const { newName, personName, type } = req.body;
    if (!newName || typeof newName !== 'string') {
      return res.status(400).json({ message: "Podaj nową nazwę kategorii" });
    }
    const validType = type === 'PRZYCHOD' ? 'PRZYCHOD' : type === 'KOSZT' ? 'KOSZT' : undefined;
    await storage.updateSaldoCategory(req.params.name, newName.trim(), personName, validType);
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

  app.get('/api/reservations/by-number/:number', isAuthenticated, async (req, res) => {
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

  app.post('/api/saldo/import-xlsx', isAuthenticated, upload.single('file'), async (req: any, res) => {
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
          createdBy: [req.user?.firstName, req.user?.lastName].filter(Boolean).join(" ") || req.user?.username || "Import",
        });
      }

      let filteredEntries = entries;
      let skippedCount = 0;
      const doReplace = req.body?.replace === 'true' || req.query?.replace === 'true';
      const doSkipDuplicates = req.query?.skipDuplicates === 'true';

      if (doSkipDuplicates) {
        const pName = req.query?.personName as string;
        const existing = await storage.getSaldoEntries({ personName: pName });
        filteredEntries = entries.filter((e: any) => {
          return !existing.some(ex =>
            ex.date === e.date &&
            ex.operationName === e.operationName &&
            Math.abs(parseFloat(ex.cashAmount || "0") - parseFloat(e.cashAmount || "0")) < 0.01
          );
        });
        skippedCount = entries.length - filteredEntries.length;
      } else if (doReplace) {
        await storage.deleteAllSaldoEntries();
      }

      const created = await storage.createSaldoEntriesBulk(filteredEntries);
      res.json({ imported: created.length, sheetName, skippedDuplicates: skippedCount });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Błąd importu" });
    }
  });

  app.post('/api/saldo/import-to-targets', isAuthenticated, async (req, res) => {
    try {
      const { assignments } = req.body;
      if (!assignments || !Array.isArray(assignments)) {
        return res.status(400).json({ message: "Brak przypisań" });
      }

      const seenIds = new Set<number>();
      const results: any[] = [];

      for (const a of assignments) {
        if (!a.entryId || !a.targetType) continue;
        if (seenIds.has(a.entryId)) continue;
        seenIds.add(a.entryId);

        const allEntries = await storage.getSaldoEntries({});
        const entry = allEntries.find(e => e.id === a.entryId);
        if (!entry) continue;
        if (entry.costImported || entry.costSkipped) {
          results.push({ entryId: a.entryId, skipped: true, message: "Wpis już przypisany lub pominięty" });
          continue;
        }

        const absAmount = Math.abs(parseFloat(entry.cashAmount || "0"));
        const txMonth = new Date(entry.date).getMonth();
        const txYear = new Date(entry.date).getFullYear();

        if (a.targetType === "operational") {
          const opRows = await storage.getOpCostData(txYear);
          const existing = opRows.find(r => r.catId === a.catId && r.itemIdx === a.itemIdx && r.month === txMonth);
          const currentRealized = Number(existing?.realized) || 0;

          if (Math.abs(currentRealized - absAmount) < 0.01 && currentRealized > 0) {
            results.push({
              entryId: a.entryId, duplicateWarning: true, currentRealized, importAmount: absAmount,
              message: `Pozycja ma już realizację ${currentRealized.toFixed(2)} zł — identyczna kwota.`,
            });
            continue;
          }

          const newRealized = currentRealized + absAmount;
          await storage.upsertOpCostCells([{
            year: txYear, catId: a.catId, itemIdx: a.itemIdx, month: txMonth,
            prognoza: existing?.prognoza ? Number(existing.prognoza) : undefined,
            realized: newRealized,
          }]);

          await storage.updateSaldoEntry(a.entryId, {
            costImported: true, costTargetType: "operational",
            costTargetCatId: a.catId, costTargetItemIdx: a.itemIdx,
          });
          results.push({ entryId: a.entryId, success: true, newRealized });

        } else if (a.targetType === "apartment") {
          const aptRows = await storage.getAptCostData(txYear);
          const existing = aptRows.find(r => r.entryId === a.aptEntryId && r.category === a.category && r.month === txMonth);
          const currentRealized = Number(existing?.realized) || 0;

          if (Math.abs(currentRealized - absAmount) < 0.01 && currentRealized > 0) {
            results.push({
              entryId: a.entryId, duplicateWarning: true, currentRealized, importAmount: absAmount,
              message: `Pozycja ma już realizację ${currentRealized.toFixed(2)} zł — identyczna kwota.`,
            });
            continue;
          }

          const newRealized = currentRealized + absAmount;
          const currentPrognoza = Number(existing?.prognoza) || 0;
          await storage.upsertAptCostCells([{
            year: txYear, entryId: a.aptEntryId, category: a.category, month: txMonth,
            prognoza: String(currentPrognoza), realized: String(newRealized),
          }]);

          await storage.updateSaldoEntry(a.entryId, {
            costImported: true, costTargetType: "apartment",
            costTargetEntryId: a.aptEntryId, costTargetCategory: a.category,
          });
          results.push({ entryId: a.entryId, success: true, newRealized });

        } else if (a.targetType === "sublease") {
          const paymentId = a.subleasePaymentId;
          if (!paymentId) continue;

          if (!a.forceAmount) {
            const allSubleases = await storage.getSubleases();
            let targetPayment: { id: number; amount: string; status: string } | null = null;
            for (const sub of allSubleases) {
              const payments = await storage.getSubleasePayments(sub.id);
              const found = payments.find(p => p.id === paymentId);
              if (found) { targetPayment = found; break; }
            }

            if (targetPayment) {
              const paymentAmount = parseFloat(targetPayment.amount);
              if (Math.abs(paymentAmount - absAmount) > 0.01) {
                results.push({
                  entryId: a.entryId, amountMismatch: true,
                  paymentAmount, transactionAmount: absAmount, paymentId,
                  message: `Kwota wpisu (${absAmount.toFixed(2)} zł) różni się od kwoty płatności (${paymentAmount.toFixed(2)} zł).`,
                });
                continue;
              }
            }
          }

          await storage.updateSubleasePayment(paymentId, { status: "oplacona" });
          await storage.updateSaldoEntry(a.entryId, {
            costImported: true, costTargetType: "sublease",
            costTargetSubleasePaymentId: paymentId,
          });
          results.push({ entryId: a.entryId, success: true });
        }
      }

      res.json({ results });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/saldo/:id/skip', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.updateSaldoEntry(id, { costSkipped: true });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/saldo/:id/unskip', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.updateSaldoEntry(id, { costSkipped: false });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/saldo/:id/unassign-cost', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const allEntries = await storage.getSaldoEntries({});
      const entry = allEntries.find(e => e.id === id);
      if (!entry) return res.status(404).json({ message: "Wpis nie znaleziony" });
      if (!entry.costImported) return res.status(400).json({ message: "Wpis nie jest przypisany" });

      const absAmount = Math.abs(parseFloat(entry.cashAmount || "0"));
      const txMonth = new Date(entry.date).getMonth();
      const txYear = new Date(entry.date).getFullYear();

      if (entry.costTargetType === "operational" && entry.costTargetCatId != null && entry.costTargetItemIdx != null) {
        const opRows = await storage.getOpCostData(txYear);
        const existing = opRows.find(r => r.catId === entry.costTargetCatId && r.itemIdx === entry.costTargetItemIdx && r.month === txMonth);
        if (existing) {
          const newRealized = Math.max(0, (Number(existing.realized) || 0) - absAmount);
          await storage.upsertOpCostCells([{
            year: txYear, catId: entry.costTargetCatId, itemIdx: entry.costTargetItemIdx!, month: txMonth,
            prognoza: existing.prognoza ? Number(existing.prognoza) : undefined,
            realized: newRealized,
          }]);
        }
      } else if (entry.costTargetType === "apartment" && entry.costTargetEntryId && entry.costTargetCategory) {
        const aptRows = await storage.getAptCostData(txYear);
        const existing = aptRows.find(r => r.entryId === entry.costTargetEntryId && r.category === entry.costTargetCategory && r.month === txMonth);
        if (existing) {
          const newRealized = Math.max(0, (Number(existing.realized) || 0) - absAmount);
          await storage.upsertAptCostCells([{
            year: txYear, entryId: entry.costTargetEntryId!, category: entry.costTargetCategory!, month: txMonth,
            prognoza: String(Number(existing.prognoza) || 0), realized: String(newRealized),
          }]);
        }
      } else if (entry.costTargetType === "sublease" && entry.costTargetSubleasePaymentId) {
        await storage.updateSubleasePayment(entry.costTargetSubleasePaymentId, { status: "do_oplacenia" });
      }

      await storage.updateSaldoEntry(id, {
        costImported: false, costTargetType: null, costTargetCatId: null,
        costTargetItemIdx: null, costTargetEntryId: null, costTargetCategory: null,
        costTargetSubleasePaymentId: null,
      });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/bank-transactions/:id/unskip', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tx = await storage.getBankTransactionById(id);
      if (!tx) return res.status(404).json({ message: "Transakcja nie znaleziona" });
      await storage.updateBankTransaction(id, { costSkipped: false });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/bank-transactions/:id/unassign-cost', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tx = await storage.getBankTransactionById(id);
      if (!tx) return res.status(404).json({ message: "Transakcja nie znaleziona" });
      if (!tx.costImported) return res.status(400).json({ message: "Transakcja nie jest przypisana" });

      const absAmount = Math.abs(parseFloat(tx.amount));
      const txMonth = new Date(tx.date).getMonth();
      const txYear = new Date(tx.date).getFullYear();

      if (tx.costTargetType === "operational" && tx.costTargetCatId != null && tx.costTargetItemIdx != null) {
        const opRows = await storage.getOpCostData(txYear);
        const existing = opRows.find(r => r.catId === tx.costTargetCatId && r.itemIdx === tx.costTargetItemIdx && r.month === txMonth);
        if (existing) {
          const newRealized = Math.max(0, (Number(existing.realized) || 0) - absAmount);
          await storage.upsertOpCostCells([{
            year: txYear, catId: tx.costTargetCatId!, itemIdx: tx.costTargetItemIdx!, month: txMonth,
            prognoza: existing.prognoza ? Number(existing.prognoza) : undefined,
            realized: newRealized,
          }]);
        }
      } else if (tx.costTargetType === "apartment" && tx.costTargetEntryId && tx.costTargetCategory) {
        const aptRows = await storage.getAptCostData(txYear);
        const existing = aptRows.find(r => r.entryId === tx.costTargetEntryId && r.category === tx.costTargetCategory && r.month === txMonth);
        if (existing) {
          const newRealized = Math.max(0, (Number(existing.realized) || 0) - absAmount);
          await storage.upsertAptCostCells([{
            year: txYear, entryId: tx.costTargetEntryId!, category: tx.costTargetCategory!, month: txMonth,
            prognoza: String(Number(existing.prognoza) || 0), realized: String(newRealized),
          }]);
        }
      } else if (tx.costTargetType === "sublease" && tx.costTargetSubleasePaymentId) {
        await storage.updateSubleasePayment(tx.costTargetSubleasePaymentId, { status: "do_oplacenia" });
      }

      await storage.updateBankTransaction(id, {
        costImported: false, costTargetType: null, costTargetCatId: null,
        costTargetItemIdx: null, costTargetEntryId: null, costTargetCategory: null,
        costTargetSubleasePaymentId: null,
      });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/saldo/ai-categorize', isAuthenticated, async (req, res) => {
    try {
      const { entries: entryList, personCategories } = req.body;
      if (!entryList || !Array.isArray(entryList)) {
        return res.status(400).json({ message: "Brak wpisów" });
      }
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const categoryList = personCategories && Array.isArray(personCategories)
        ? personCategories.map((c: any) => `- ${c.name} (${c.type === 'PRZYCHOD' ? 'przychód' : 'koszt'})`).join("\n")
        : "";

      const targetHints = req.body.targetOptions && Array.isArray(req.body.targetOptions)
        ? `\nDostępne pozycje kosztowe:\n${req.body.targetOptions.map((t: any) => `- ${t.key}: [${t.group}] ${t.label}`).join("\n")}`
        : "";

      const prompt = `Jesteś asystentem finansowym zarządzającym wynajmem apartamentów. Kategoryzuj poniższe wpisy z salda osobowego i zasugeruj pozycję kosztową. ${categoryList ? `Dostępne kategorie:\n${categoryList}` : `Dostępne kategorie:\n- CZYNSZ (opłaty czynszowe)\n- MEDIA (prąd, gaz, woda, internet)\n- WYNAGRODZENIA (pensje, zlecenia)\n- PODATKI (PIT, ZUS, składki)\n- NAPRAWY (konserwacja, remonty)\n- PRZYCHOD_REZERWACJA (wpływy od gości)\n- PRZYCHOD_PODNAJEM (wpływy od podnajemców)\n- UBEZPIECZENIE (polisy)\n- ADMINISTRACJA (opłaty biurowe)\n- INNE (pozostałe)`}${targetHints}

Wpisy do kategoryzacji:
${entryList.map((e: any, i: number) => `${i + 1}. ${e.date} | ${e.cashAmount || 0} PLN | ${e.operationName} | ${e.guestName || ""} | ${e.type || ""}`).join("\n")}

Odpowiedz TYLKO jako JSON array z obiektami { "index": number, "category": string, "targetKey": string | null, "confidence": number (0-1) }. targetKey to klucz pasującej pozycji kosztowej (lub null jeśli brak pewności). Bez dodatkowego tekstu.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 2000,
      });

      const text = response.choices[0]?.message?.content || "[]";
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      const categories = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

      for (const cat of categories) {
        const idx = cat.index - 1;
        if (idx >= 0 && idx < entryList.length && entryList[idx].id) {
          await storage.updateSaldoEntry(entryList[idx].id, { aiCategory: cat.category });
        }
      }

      res.json({ categories });
    } catch (err: any) {
      console.error("Saldo AI categorization error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/saldo/check-duplicates', isAuthenticated, async (req, res) => {
    try {
      const { personName, entries: checkEntries } = req.body;
      if (!checkEntries || !Array.isArray(checkEntries)) {
        return res.status(400).json({ message: "Brak wpisów do sprawdzenia" });
      }

      const existing = await storage.getSaldoEntries({ personName });
      const duplicates: { index: number; existingId: number; date: string; operationName: string }[] = [];

      checkEntries.forEach((entry: any, idx: number) => {
        const match = existing.find(e =>
          e.date === entry.date &&
          e.operationName === entry.operationName &&
          Math.abs(parseFloat(e.cashAmount || "0") - parseFloat(entry.cashAmount || "0")) < 0.01
        );
        if (match) {
          duplicates.push({ index: idx, existingId: match.id, date: entry.date, operationName: entry.operationName });
        }
      });

      res.json({ duplicates });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
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
      const { email: rawEmail, firstName, lastName, password, permissions } = req.body;
      const email = rawEmail?.trim()?.toLowerCase();
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

      const existingAuthUser = await db.execute(sql`SELECT id FROM users WHERE LOWER(email) = LOWER(${email})`);
      if (existingAuthUser.rows.length > 0) {
        await db.execute(sql`UPDATE users SET password_hash = ${passwordHash}, first_name = ${firstName}, last_name = ${lastName}, email = ${email} WHERE LOWER(email) = LOWER(${email})`);
      } else {
        const crypto = await import('crypto');
        const userId = crypto.randomBytes(16).toString('hex');
        await db.execute(sql`INSERT INTO users (id, email, password_hash, first_name, last_name) VALUES (${userId}, ${email}, ${passwordHash}, ${firstName}, ${lastName})`);
      }

      res.json({ ...user, passwordHash: undefined });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put('/api/app-users/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { email: rawEmail, firstName, lastName, password, permissions } = req.body;
      const email = rawEmail?.trim()?.toLowerCase();

      const [currentAppUser] = await db.select().from(appUsers).where(eq(appUsers.id, id));
      if (!currentAppUser) return res.status(404).json({ message: "Nie znaleziono użytkownika" });
      const oldEmail = currentAppUser.email;

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

      if (data.passwordHash || data.email || data.firstName || data.lastName) {
        const existingAuthUser = await db.execute(sql`SELECT id FROM users WHERE LOWER(email) = LOWER(${oldEmail})`);
        if (existingAuthUser.rows.length > 0) {
          const newEmail = (data.email && data.email !== oldEmail) ? data.email : oldEmail;
          const newFirstName = data.firstName || currentAppUser.firstName || '';
          const newLastName = data.lastName || currentAppUser.lastName || '';
          const newHash = data.passwordHash || null;
          if (newHash) {
            await db.execute(sql`UPDATE users SET password_hash = ${newHash}, first_name = ${newFirstName}, last_name = ${newLastName}, email = ${newEmail} WHERE LOWER(email) = LOWER(${oldEmail})`);
          } else {
            await db.execute(sql`UPDATE users SET first_name = ${newFirstName}, last_name = ${newLastName}, email = ${newEmail} WHERE LOWER(email) = LOWER(${oldEmail})`);
          }
        } else {
          const appUserHash = data.passwordHash || currentAppUser.passwordHash;
          if (appUserHash) {
            const crypto = await import('crypto');
            const userId = crypto.randomBytes(16).toString('hex');
            const fn = data.firstName || currentAppUser.firstName || '';
            const ln = data.lastName || currentAppUser.lastName || '';
            const em = data.email || oldEmail;
            await db.execute(sql`INSERT INTO users (id, email, password_hash, first_name, last_name) VALUES (${userId}, ${em}, ${appUserHash}, ${fn}, ${ln})`);
          }
        }
      }

      res.json({ ...user, passwordHash: undefined });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete('/api/app-users/:id', isAuthenticated, async (req, res) => {
    await storage.deleteAppUser(parseInt(req.params.id));
    res.status(204).send();
  });

  app.get('/api/app-users/:id/webauthn-credentials', isAuthenticated, async (req: any, res) => {
    try {
      const appUserId = parseInt(req.params.id);
      const [appUser] = await db.select().from(appUsers).where(eq(appUsers.id, appUserId));
      if (!appUser) return res.status(404).json({ message: "Nie znaleziono użytkownika" });

      const [authUser] = await db.select().from(users).where(eq(users.email, appUser.email));
      if (!authUser) return res.json([]);

      const creds = await db.select().from(webauthnCredentials).where(eq(webauthnCredentials.userId, authUser.id));
      res.json(creds.map(c => ({
        id: c.id,
        deviceName: c.deviceName,
        createdAt: c.createdAt,
      })));
    } catch (err) {
      console.error("[WEBAUTHN] Error fetching credentials for app user:", err);
      res.status(500).json({ message: "Błąd pobierania urządzeń" });
    }
  });

  app.delete('/api/app-users/:id/webauthn-credentials/:credId', isAuthenticated, async (req: any, res) => {
    try {
      const appUserId = parseInt(req.params.id);
      const credId = parseInt(req.params.credId);

      const [appUser] = await db.select().from(appUsers).where(eq(appUsers.id, appUserId));
      if (!appUser) return res.status(404).json({ message: "Nie znaleziono użytkownika" });

      const [authUser] = await db.select().from(users).where(eq(users.email, appUser.email));
      if (!authUser) return res.status(404).json({ message: "Brak powiązanego konta" });

      const [cred] = await db.select().from(webauthnCredentials)
        .where(and(eq(webauthnCredentials.id, credId), eq(webauthnCredentials.userId, authUser.id)));
      if (!cred) return res.status(404).json({ message: "Nie znaleziono urządzenia" });

      await db.delete(webauthnCredentials).where(eq(webauthnCredentials.id, credId));
      res.json({ ok: true });
    } catch (err) {
      console.error("[WEBAUTHN] Error deleting credential:", err);
      res.status(500).json({ message: "Błąd usuwania urządzenia" });
    }
  });

  app.delete('/api/app-users/:id/webauthn-credentials', isAuthenticated, async (req: any, res) => {
    try {
      const appUserId = parseInt(req.params.id);
      const [appUser] = await db.select().from(appUsers).where(eq(appUsers.id, appUserId));
      if (!appUser) return res.status(404).json({ message: "Nie znaleziono użytkownika" });

      const [authUser] = await db.select().from(users).where(eq(users.email, appUser.email));
      if (!authUser) return res.json({ ok: true });

      await db.delete(webauthnCredentials).where(eq(webauthnCredentials.userId, authUser.id));
      res.json({ ok: true });
    } catch (err) {
      console.error("[WEBAUTHN] Error deleting all credentials:", err);
      res.status(500).json({ message: "Błąd usuwania urządzeń" });
    }
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
      const oldSettings = await storage.getCompanySettings();
      const saved = await storage.upsertCompanySettings(req.body);
      const changedFields: string[] = [];
      if (req.body.companyName !== undefined && req.body.companyName !== oldSettings?.companyName) changedFields.push("nazwa firmy");
      if (req.body.nip !== undefined && req.body.nip !== oldSettings?.nip) changedFields.push("NIP");
      if (req.body.regon !== undefined && req.body.regon !== oldSettings?.regon) changedFields.push("REGON");
      if (req.body.street !== undefined && req.body.street !== oldSettings?.street) changedFields.push("ulica");
      if (req.body.city !== undefined && req.body.city !== oldSettings?.city) changedFields.push("miasto");
      if (req.body.bankAccount !== undefined && req.body.bankAccount !== oldSettings?.bankAccount) changedFields.push("konto bankowe");
      if (req.body.email !== undefined && req.body.email !== oldSettings?.email) changedFields.push("email");
      if (req.body.phone !== undefined && req.body.phone !== oldSettings?.phone) changedFields.push("telefon");
      if (changedFields.length > 0) {
        await storage.createActivityLog({
          action: "update",
          entityType: "settings",
          entityName: "Dane firmowe",
          details: `Zmieniono: ${changedFields.join(", ")}`,
        });
      }
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

  app.post('/api/company-settings/logo-dark', isAuthenticated, upload.single('logo'), async (req, res) => {
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
      const fileName = `company-logo-dark.${ext}`;
      const storagePath = `${publicDir}/${fileName}`;
      const parsedPath = (() => {
        const p = storagePath.startsWith("/") ? storagePath.slice(1) : storagePath;
        const parts = p.split("/");
        return { bucketName: parts[0], objectName: parts.slice(1).join("/") };
      })();

      const storageFile = osStorageClient.bucket(parsedPath.bucketName).file(parsedPath.objectName);
      await storageFile.save(req.file.buffer, { contentType: req.file.mimetype });

      const logoDarkUrl = storagePath;
      await storage.upsertCompanySettings({ logoDarkUrl });
      res.json({ logoDarkUrl });
    } catch (err: any) {
      console.error("Dark logo upload error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/company-settings/logo-dark', async (req, res) => {
    try {
      const settings = await storage.getCompanySettings();
      if (!settings?.logoDarkUrl) return res.status(404).json({ message: "Brak logo dark" });

      const { objectStorageClient: osStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
      const parsedPath = (() => {
        const p = settings.logoDarkUrl!.startsWith("/") ? settings.logoDarkUrl!.slice(1) : settings.logoDarkUrl!;
        const parts = p.split("/");
        return { bucketName: parts[0], objectName: parts.slice(1).join("/") };
      })();
      const storageFile = osStorageClient.bucket(parsedPath.bucketName).file(parsedPath.objectName);
      const [fileBuffer] = await storageFile.download();

      const ext = settings.logoDarkUrl!.split(".").pop()?.toLowerCase() || "png";
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

      const report = (await storage.getMediaSettlementReports(subleaseId)).find(r => r.id === reportId);
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

      const { jsPDF } = require("jspdf");
      const autoTableModule = require("jspdf-autotable");
      const autoTable = autoTableModule.default || autoTableModule;
      const QRCode = require("qrcode");
      const doc = new jsPDF({ compress: true });

      let logoJpegBuffer: Buffer | null = null;
      if (companyData?.logoUrl) {
        try {
          const { objectStorageClient: osClient } = await import("./replit_integrations/object_storage/objectStorage");
          const lp = (() => {
            const p = companyData.logoUrl!.startsWith("/") ? companyData.logoUrl!.slice(1) : companyData.logoUrl!;
            const parts = p.split("/");
            return { bucketName: parts[0], objectName: parts.slice(1).join("/") };
          })();
          const [buf] = await osClient.bucket(lp.bucketName).file(lp.objectName).download();
          const PNG = require("pngjs").PNG;
          const jpeg = require("jpeg-js");
          const png = PNG.sync.read(buf);
          const w = Math.min(png.width, 300);
          const scale = w / png.width;
          const h = Math.round(png.height * scale);
          const resizedData = Buffer.alloc(w * h * 4);
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const sx = Math.floor(x / scale);
              const sy = Math.floor(y / scale);
              const si = (sy * png.width + sx) * 4;
              const di = (y * w + x) * 4;
              const a = png.data[si + 3] / 255;
              resizedData[di] = Math.round(png.data[si] * a + 255 * (1 - a));
              resizedData[di + 1] = Math.round(png.data[si + 1] * a + 255 * (1 - a));
              resizedData[di + 2] = Math.round(png.data[si + 2] * a + 255 * (1 - a));
              resizedData[di + 3] = 255;
            }
          }
          const jpegData = jpeg.encode({ data: resizedData, width: w, height: h }, 70);
          logoJpegBuffer = jpegData.data;
        } catch (e) { console.error("Logo load error:", e); }
      }

      let qrDataUrl: string | null = null;
      if (companyData?.websiteUrl) {
        try {
          qrDataUrl = await QRCode.toDataURL(companyData.websiteUrl, { width: 80, margin: 1 });
        } catch (e) { console.error("QR generation error:", e); }
      }

      let headerY = 14;
      if (logoJpegBuffer) {
        const dataUri = `data:image/jpeg;base64,${logoJpegBuffer.toString("base64")}`;
        doc.addImage(dataUri, "JPEG", 14, headerY, 35, 21);
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

      let y2 = headerY + 30;
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

      const rows: string[][] = [];
      const hasNewElecFields = report.electricityNetto && Number(report.electricityNetto) > 0;
      if (report.electricityConsumption && Number(report.electricityConsumption) > 0) {
        if (hasNewElecFields) {
          const vatRate = report.electricityVatRate ? `${plnFmt(report.electricityVatRate)}%` : "23%";
          rows.push([
            rd("Energia elektryczna"),
            `${plnFmt(report.electricityConsumption)} kWh`,
            `${plnFmt(report.electricityNetto)} PLN`,
            vatRate,
            `${plnFmt(report.electricityBrutto)} PLN`,
          ]);
        } else {
          rows.push([
            rd("Energia elektryczna"),
            `${plnFmt(report.electricityConsumption)} kWh`,
            `${plnFmt(report.electricityCost)} PLN`,
            "",
            `${plnFmt(report.electricityCost)} PLN`,
          ]);
        }
      }
      if (report.coldWaterConsumption && Number(report.coldWaterConsumption) > 0) {
        rows.push([
          rd("Woda zimna"),
          rd(`${plnFmt(report.coldWaterConsumption)} m3`),
          `${plnFmt(report.coldWaterCost)} PLN`,
          rd("—"),
          `${plnFmt(report.coldWaterCost)} PLN`,
        ]);
      }
      if (report.hotWaterConsumption && Number(report.hotWaterConsumption) > 0) {
        rows.push([
          rd("Woda ciepla"),
          rd(`${plnFmt(report.hotWaterConsumption)} m3`),
          `${plnFmt(report.hotWaterCost)} PLN`,
          rd("—"),
          `${plnFmt(report.hotWaterCost)} PLN`,
        ]);
      }

      autoTable(doc, {
        startY: startY + 7,
        head: [["Medium", rd("Zuzycie"), "Netto", "VAT", "Brutto"]],
        body: rows,
        foot: [[rd("RAZEM DO ZAPLATY"), "", "", "", `${plnFmt(report.totalCost)} PLN`]],
        theme: "grid",
        headStyles: { fillColor: [41, 128, 185], fontSize: 9 },
        footStyles: { fillColor: [236, 240, 241], textColor: [0, 0, 0], fontStyle: "bold", fontSize: 9 },
        styles: { fontSize: 9 },
        columnStyles: { 1: { halign: "right" as const }, 2: { halign: "right" as const }, 3: { halign: "center" as const }, 4: { halign: "right" as const } },
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

      const hasElectricity = report.electricityConsumption && Number(report.electricityConsumption) > 0;
      const hasWater = (report.coldWaterConsumption && Number(report.coldWaterConsumption) > 0) ||
                       (report.hotWaterConsumption && Number(report.hotWaterConsumption) > 0);
      const mediaTypes = hasElectricity && hasWater ? "both" : hasElectricity ? "electricity" : "water";
      const periodDate = new Date(report.periodTo);

      const note = await storage.createAccountingNote({
        subleaseId,
        reportId,
        noteNumber,
        objectPath: storagePath,
        fileName,
        status: "NOWA",
        apartmentName: aptName,
        tenantName,
        mediaTypes,
        noteMonth: periodDate.getMonth() + 1,
        noteYear: periodDate.getFullYear(),
      });

      await storage.createNotification({
        type: "accounting_note_ready",
        title: "Nowa nota księgowa do wydrukowania",
        message: `${aptName} — ${tenantName}: nota ${noteNumber}`,
        entityType: "accounting_note",
        entityId: note.id,
        isRead: false,
        targetPanel: "recepcja",
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
      const safeFileName = note.fileName.replace(/[^\w.\-]/g, '_');
      res.setHeader("Content-Disposition", `attachment; filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(note.fileName)}`);
      res.send(fileBuffer);
    } catch (err: any) {
      console.error("Error downloading accounting note:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.patch('/api/accounting-notes/:id/status', isAuthenticated, async (req, res) => {
    try {
      const { status } = req.body;
      if (!status || !["NOWA", "WYSŁANA", "ZAKSIĘGOWANA"].includes(status)) {
        return res.status(400).json({ message: "Nieprawidłowy status" });
      }
      const updated = await storage.updateAccountingNoteStatus(Number(req.params.id), status);
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete('/api/accounting-notes/:id', isAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const notes = await storage.getAccountingNotes();
      const note = notes.find(n => n.id === id);
      if (!note) return res.status(404).json({ message: "Nota nie znaleziona" });

      if (note.objectPath) {
        try {
          const { objectStorageClient: osStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
          const p = note.objectPath.startsWith("/") ? note.objectPath.slice(1) : note.objectPath;
          const parts = p.split("/");
          const storageFile = osStorageClient.bucket(parts[0]).file(parts.slice(1).join("/"));
          await storageFile.delete();
        } catch (e) { console.error("Error deleting note file from storage:", e); }
      }

      await storage.deleteAccountingNote(id);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting accounting note:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.patch('/api/accounting-notes/bulk-status', isAuthenticated, async (req, res) => {
    try {
      const { noteIds, status } = req.body;
      if (!Array.isArray(noteIds) || !status || !["NOWA", "WYSŁANA", "ZAKSIĘGOWANA"].includes(status)) {
        return res.status(400).json({ message: "Nieprawidłowe dane" });
      }
      const updated = [];
      for (const id of noteIds) {
        updated.push(await storage.updateAccountingNoteStatus(id, status));
      }
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post('/api/accounting-notes/download-zip', isAuthenticated, async (req, res) => {
    try {
      const { noteIds } = req.body;
      if (!Array.isArray(noteIds) || noteIds.length === 0) {
        return res.status(400).json({ message: "Brak not do pobrania" });
      }
      const allNotes = await storage.getAccountingNotes();
      const selectedNotes = allNotes.filter(n => noteIds.includes(n.id));
      if (selectedNotes.length === 0) return res.status(404).json({ message: "Nie znaleziono not" });

      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const { objectStorageClient: osStorageClient } = await import("./replit_integrations/object_storage/objectStorage");

      for (const note of selectedNotes) {
        try {
          const parsedPath = (() => {
            const p = note.objectPath.startsWith("/") ? note.objectPath.slice(1) : note.objectPath;
            const parts = p.split("/");
            return { bucketName: parts[0], objectName: parts.slice(1).join("/") };
          })();
          const [fileBuffer] = await osStorageClient.bucket(parsedPath.bucketName).file(parsedPath.objectName).download();
          zip.file(note.fileName, fileBuffer);
          if (note.status === "NOWA") {
            await storage.updateAccountingNoteStatus(note.id, "WYSŁANA");
          }
        } catch (e) {
          console.error(`Error downloading note ${note.id}:`, e);
        }
      }

      const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="noty_ksiegowe_${new Date().toISOString().split('T')[0]}.zip"`);
      res.send(zipBuffer);
    } catch (err: any) {
      console.error("ZIP download error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // ---- Cost Invoices (Faktury kosztowe) ----
  app.get('/api/cost-invoices', isAuthenticated, async (_req, res) => {
    const invoicesList = await storage.getCostInvoices();
    res.json(invoicesList);
  });

  app.post('/api/cost-invoices', isAuthenticated, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "Brak pliku" });
      const allowedMimes = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
      if (!allowedMimes.includes(req.file.mimetype)) {
        return res.status(400).json({ message: "Dozwolone formaty: PDF, PNG, JPG, WEBP" });
      }

      const { ObjectStorageService, objectStorageClient: osStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
      const osService = new ObjectStorageService();
      const privateDir = osService.getPrivateObjectDir();

      const uniqueId = Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      const ext = req.file.originalname.split(".").pop() || "pdf";
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
      const user = req.user as any;

      const invoice = await storage.createCostInvoice({
        fileName: storedName,
        originalFileName: req.file.originalname,
        mimeType: req.file.mimetype,
        objectStoragePath: storagePath,
        invoiceDate,
        invoiceMonth,
        invoiceYear,
        comment: req.body.comment || null,
        status: "NOWA",
        uploadedBy: user?.username || user?.firstName || "Nieznany",
        linkedExpenseId: null,
      });

      await logActivity(req, "create", "cost_invoice", invoice.id, req.file.originalname, `Dodano fakturę kosztową: ${req.file.originalname}`);
      res.status(201).json(invoice);
    } catch (err: any) {
      console.error("Cost invoice upload error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.patch('/api/cost-invoices/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates: any = {};
      if (req.body.status) updates.status = req.body.status;
      if (req.body.comment !== undefined) updates.comment = req.body.comment;
      if (req.body.linkedExpenseId !== undefined) updates.linkedExpenseId = req.body.linkedExpenseId;
      if (req.body.ocrVendor !== undefined) updates.ocrVendor = req.body.ocrVendor;
      if (req.body.ocrAmount !== undefined) updates.ocrAmount = req.body.ocrAmount;
      if (req.body.ocrInvoiceNumber !== undefined) updates.ocrInvoiceNumber = req.body.ocrInvoiceNumber;
      if (req.body.ocrProcessed !== undefined) updates.ocrProcessed = req.body.ocrProcessed;
      if (req.body.invoiceDate !== undefined) {
        updates.invoiceDate = req.body.invoiceDate;
        const d = new Date(req.body.invoiceDate);
        updates.invoiceMonth = d.getMonth() + 1;
        updates.invoiceYear = d.getFullYear();
      }
      if (req.body.originalFileName !== undefined) updates.originalFileName = req.body.originalFileName;
      const updated = await storage.updateCostInvoice(id, updates);
      await logActivity(req, "update", "cost_invoice", id, updates.originalFileName || "", "Zaktualizowano fakturę kosztową");
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch('/api/cost-invoices/bulk-status', isAuthenticated, async (req, res) => {
    try {
      const { ids, status } = req.body;
      if (!ids || !Array.isArray(ids) || !status) return res.status(400).json({ message: "Brak ids lub status" });
      const results = [];
      for (const id of ids) {
        const updated = await storage.updateCostInvoice(id, { status });
        results.push(updated);
      }
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete('/api/cost-invoices/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const invoice = await storage.getCostInvoice(id);
      if (invoice) {
        try {
          const { objectStorageClient: osStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
          const p = invoice.objectStoragePath.startsWith("/") ? invoice.objectStoragePath.slice(1) : invoice.objectStoragePath;
          const parts = p.split("/");
          const storageFile = osStorageClient.bucket(parts[0]).file(parts.slice(1).join("/"));
          await storageFile.delete().catch(() => {});
        } catch (e) {}
        await storage.deleteCostInvoice(id);
        await logActivity(req, "delete", "cost_invoice", id, invoice.originalFileName);
      }
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/cost-invoices/:id/file', isAuthenticated, async (req, res) => {
    try {
      const invoice = await storage.getCostInvoice(parseInt(req.params.id));
      if (!invoice) return res.status(404).json({ message: "Nie znaleziono faktury" });

      const { objectStorageClient: osStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
      const p = invoice.objectStoragePath.startsWith("/") ? invoice.objectStoragePath.slice(1) : invoice.objectStoragePath;
      const parts = p.split("/");
      const storageFile = osStorageClient.bucket(parts[0]).file(parts.slice(1).join("/"));
      const [fileBuffer] = await storageFile.download();

      res.setHeader("Content-Type", invoice.mimeType);
      if (req.query.download === "true") {
        res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(invoice.originalFileName)}"`);
      } else {
        res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(invoice.originalFileName)}"`);
      }
      res.send(fileBuffer);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/cost-invoices/:id/ocr', isAuthenticated, async (req, res) => {
    try {
      const invoice = await storage.getCostInvoice(parseInt(req.params.id));
      if (!invoice) return res.status(404).json({ message: "Nie znaleziono faktury" });

      const { objectStorageClient: osStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
      const p = invoice.objectStoragePath.startsWith("/") ? invoice.objectStoragePath.slice(1) : invoice.objectStoragePath;
      const parts = p.split("/");
      const storageFile = osStorageClient.bucket(parts[0]).file(parts.slice(1).join("/"));
      const [fileBuffer] = await storageFile.download();

      let base64Images: Array<{data: string; mimeType: string}> = [];

      if (invoice.mimeType.startsWith("image/")) {
        base64Images.push({ data: fileBuffer.toString("base64"), mimeType: invoice.mimeType });
      } else if (invoice.mimeType === "application/pdf") {
        const tmpDir = os.tmpdir();
        const conv = convertPdfToImages(fileBuffer, tmpDir, { maxPages: 2, label: 'ocr' });
        for (const img of conv.images) {
          base64Images.push({ data: img.data, mimeType: img.mimeType });
        }
        for (const f of conv.tmpFiles) {
          try { fs.unlinkSync(f); } catch {}
        }
      }

      if (base64Images.length === 0) {
        return res.status(400).json({ message: "Nie udało się przetworzyć pliku do OCR" });
      }

      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const content: any[] = [
        {
          type: "text",
          text: `Analizujesz skan lub zdjęcie polskiej faktury kosztowej. Wyciągnij z niej następujące dane:
- vendor: nazwa dostawcy/wystawcy faktury (firma lub osoba)
- amount: kwota brutto do zapłaty (jako string z liczbą, np. "1234.56")
- invoiceNumber: numer faktury (np. "FV/2025/01/123")

Jeśli nie możesz odczytać któregoś z pól, wpisz null.

Odpowiedz TYLKO prawidłowym JSON w formacie:
{"vendor": "...", "amount": "...", "invoiceNumber": "..."}`
        }
      ];
      for (const img of base64Images) {
        content.push({
          type: "image_url",
          image_url: { url: `data:${img.mimeType};base64,${img.data}`, detail: "high" }
        });
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content }],
        max_tokens: 500,
        temperature: 0,
      });

      const text = response.choices[0]?.message?.content || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return res.status(400).json({ message: "AI nie mogło odczytać danych z faktury" });
      }
      const parsed = JSON.parse(jsonMatch[0]);

      await storage.updateCostInvoice(invoice.id, {
        ocrVendor: parsed.vendor || null,
        ocrAmount: parsed.amount || null,
        ocrInvoiceNumber: parsed.invoiceNumber || null,
        ocrProcessed: true,
      });

      res.json({
        vendor: parsed.vendor || null,
        amount: parsed.amount || null,
        invoiceNumber: parsed.invoiceNumber || null,
      });
    } catch (err: any) {
      console.error("OCR error:", err);
      res.status(500).json({ message: err.message || "Błąd OCR" });
    }
  });

  app.post('/api/cost-invoices/download-zip', isAuthenticated, async (req, res) => {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "Brak wybranych faktur" });
      }

      const JSZip = (await import("jszip")).default;
      const zipFile = new JSZip();
      const { objectStorageClient: osStorageClient } = await import("./replit_integrations/object_storage/objectStorage");

      const invoicesList = [];
      for (const id of ids) {
        const invoice = await storage.getCostInvoice(id);
        if (!invoice) continue;
        invoicesList.push(invoice);
        try {
          const p = invoice.objectStoragePath.startsWith("/") ? invoice.objectStoragePath.slice(1) : invoice.objectStoragePath;
          const parts = p.split("/");
          const storageFile = osStorageClient.bucket(parts[0]).file(parts.slice(1).join("/"));
          const [fileBuffer] = await storageFile.download();
          zipFile.file(invoice.originalFileName, fileBuffer);
        } catch (e) {
          console.error(`Error downloading file for invoice ${id}:`, e);
        }
      }

      if (invoicesList.length > 0) {
        const months = [...new Set(invoicesList.map(i => `${i.invoiceYear}-${String(i.invoiceMonth).padStart(2, "0")}`))];
        const user = req.user as any;
        for (const m of months) {
          const [y, mo] = m.split("-").map(Number);
          await storage.createZipDownloadHistory({
            month: mo,
            year: y,
            downloadedBy: user?.username || user?.firstName || "Nieznany",
            invoiceCount: invoicesList.filter(i => i.invoiceYear === y && i.invoiceMonth === mo).length,
          });
        }

        for (const inv of invoicesList) {
          if (inv.status === "NOWA") {
            await storage.updateCostInvoice(inv.id, { status: "WYSLANA" });
          }
        }
      }

      const zipBuffer = await zipFile.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
      const now = new Date();
      const zipName = `faktury_kosztowe_${now.toISOString().slice(0, 10)}.zip`;

      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);
      res.send(zipBuffer);
    } catch (err: any) {
      console.error("ZIP download error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/zip-download-history', isAuthenticated, async (_req, res) => {
    const history = await storage.getZipDownloadHistory();
    res.json(history);
  });

  app.delete('/api/zip-download-history/:id', isAuthenticated, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Nieprawidłowe ID" });
    await storage.deleteZipDownloadHistory(id);
    res.status(204).end();
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
        const tenantDisplayName = s.tenantType === "firma" ? (s.companyName || "Firma") : `${s.firstName || ""} ${s.lastName || ""}`.trim() || "—";
        allPayments.push({ ...p, subleaseTenantName: tenantDisplayName, subleaseApartmentIds: s.apartmentIds || (s.apartmentId ? [s.apartmentId] : []) });
      }
    }
    res.json(allPayments);
  });

  app.get("/api/dashboard/revenue-forecast", isAuthenticated, async (req, res) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const year = Number(req.query.year) || currentYear;

    const reservations = await storage.getReservations();
    const subleases = await storage.getSubleases();
    const allSubleasePayments: { dueDate: string; amount: string; status: string }[] = [];
    for (const sub of subleases) {
      const payments = await storage.getSubleasePayments(sub.id);
      allSubleasePayments.push(...payments.filter(p => (p.category || '').toLowerCase() !== 'kaucja').map(p => ({ dueDate: p.dueDate, amount: p.amount, status: p.status })));
    }

    const revForecasts = await storage.getRevenueForecasts(year);
    const forecastByMonth: Record<number, number> = {};
    for (const f of revForecasts) {
      if (f.apartmentId) {
        forecastByMonth[f.month] = (forecastByMonth[f.month] || 0) + (Number(f.forecast) || 0);
      }
    }
    const hasApartmentForecasts = Object.keys(forecastByMonth).length > 0;
    if (!hasApartmentForecasts) {
      for (const f of revForecasts) {
        if (!f.apartmentId && f.locationName === "RAZEM") {
          forecastByMonth[f.month] = (forecastByMonth[f.month] || 0) + (Number(f.forecast) || 0);
        }
      }
    }

    const months: { year: number; month: number; label: string }[] = [];
    for (let i = 0; i < 12; i++) {
      months.push({ year, month: i, label: "" });
    }

    const climateByMonth: Record<number, { forecast: number; actual: number }> = {};
    for (let i = 0; i < 12; i++) {
      climateByMonth[i] = { forecast: 0, actual: 0 };
    }
    for (const f of revForecasts) {
      if (f.locationName === "RAZEM" && (f.climateFeeForecast || f.climateFeeActual)) {
        climateByMonth[f.month].forecast += Number(f.climateFeeForecast || 0);
        climateByMonth[f.month].actual += Number(f.climateFeeActual || 0);
      }
    }

    const result = months.map(m => {
      const daysInMonth = new Date(m.year, m.month + 1, 0).getDate();
      const isCurrentMonth = m.year === currentYear && m.month === currentMonth;
      const dayOfMonth = isCurrentMonth ? now.getDate() : (m.year < currentYear || (m.year === currentYear && m.month < currentMonth) ? daysInMonth : 0);
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

      const climateFeeActual = climateByMonth[m.month]?.actual || 0;
      const climateFeeForecast = climateByMonth[m.month]?.forecast || 0;
      const actual = reservationRevenue + subleaseRevenue + climateFeeActual;
      const forecast = (forecastByMonth[m.month] || 0) + climateFeeForecast;

      return {
        year: m.year,
        month: m.month,
        actual,
        forecast,
        reservationRevenue,
        subleaseRevenue,
        climateFeeActual,
        climateFeeForecast,
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
    const id = Number(req.params.id);
    const schedule = await storage.updateCostSchedule(id, req.body);
    let deletedPayments = 0;
    if (req.body.endDate) {
      deletedPayments = await storage.deleteUnpaidPaymentsAfterDate(id, req.body.endDate);
    }
    res.json({ ...schedule, _deletedPayments: deletedPayments });
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

      const aptCostRowsComp = await db.select({
        entryId: aptCostData.entryId,
        prognoza: aptCostData.prognoza,
        realized: aptCostData.realized,
      }).from(aptCostData).where(eq(aptCostData.year, year));

      const costByAptComp: Record<number, number> = {};
      for (const c of aptCostRowsComp) {
        const val = Number(c.realized || 0) > 0 ? Number(c.realized) : Number(c.prognoza || 0);
        if (c.entryId.startsWith('apt-')) {
          const aptId = parseInt(c.entryId.replace('apt-', ''));
          if (!isNaN(aptId)) costByAptComp[aptId] = (costByAptComp[aptId] || 0) + val;
        }
      }

      const yearSubleases = await db.select({
        id: subleases.id,
        apartmentId: subleases.apartmentId,
        apartmentIds: subleases.apartmentIds,
        startDate: subleases.startDate,
        endDate: subleases.endDate,
        rentAmount: subleases.rentAmount,
        status: subleases.status,
      })
        .from(subleases)
        .where(and(
          lte(subleases.startDate, endDate),
          gte(subleases.endDate, startDate),
          ne(subleases.status, "ZAKONCZONA"),
        ));

      const allSubChangesComp = await db.select().from(subleaseApartmentChanges);
      const changesBySubComp: Record<number, any[]> = {};
      for (const ch of allSubChangesComp) {
        if (!changesBySubComp[ch.subleaseId]) changesBySubComp[ch.subleaseId] = [];
        changesBySubComp[ch.subleaseId].push(ch);
      }

      const subleaseRevenueByAptComp: Record<number, number> = {};
      const compYearStart = new Date(startDate);
      const compYearEnd = new Date(endDate);

      for (const sub of yearSubleases) {
        const subStart = new Date(sub.startDate);
        const subEnd = new Date(sub.endDate);
        const totalDays = Math.max(0, Math.floor((subEnd.getTime() - subStart.getTime()) / 86400000) + 1);
        if (totalDays === 0) continue;

        const monthlyRent = Number(sub.rentAmount || 0);
        const totalSubleaseValue = monthlyRent * (totalDays / 30.44);

        const baseIds: number[] = sub.apartmentIds && sub.apartmentIds.length > 0
          ? [...sub.apartmentIds]
          : (sub.apartmentId ? [sub.apartmentId] : []);
        if (baseIds.length === 0) continue;

        const changes = (changesBySubComp[sub.id] || [])
          .slice().sort((a: any, b: any) => a.changeDate.localeCompare(b.changeDate));

        for (const baseId of baseIds) {
          const segments: { aptId: number; start: Date; end: Date }[] = [];
          let curId = baseId;
          let curStart = subStart;
          for (const ch of changes) {
            if (ch.oldApartmentId === curId) {
              const chDate = new Date(ch.changeDate);
              if (chDate > curStart && chDate <= subEnd) {
                segments.push({ aptId: curId, start: curStart, end: new Date(chDate.getTime() - 86400000) });
                curId = ch.newApartmentId;
                curStart = chDate;
              }
            }
          }
          segments.push({ aptId: curId, start: curStart, end: subEnd });

          for (const seg of segments) {
            const segStart = seg.start > compYearStart ? seg.start : compYearStart;
            const segEnd = seg.end < compYearEnd ? seg.end : compYearEnd;
            const segDays = Math.max(0, Math.floor((segEnd.getTime() - segStart.getTime()) / 86400000) + 1);
            if (segDays <= 0) continue;
            const revenue = (segDays / totalDays) * totalSubleaseValue / baseIds.length;
            subleaseRevenueByAptComp[seg.aptId] = (subleaseRevenueByAptComp[seg.aptId] || 0) + revenue;
          }
        }
      }

      const result = allApartments.map(apt => {
        const aptReservations = yearReservations.filter(r => r.apartmentId === apt.id);
        const reservationRevenue = aptReservations.reduce((s, r) => s + Number(r.price || 0), 0);

        const subleaseRevenue = subleaseRevenueByAptComp[apt.id] || 0;

        const totalRevenue = reservationRevenue + subleaseRevenue;

        const expenseTotal = costByAptComp[apt.id] || 0;

        let occupiedDays = 0;
        for (const r of aptReservations) {
          const rStart = new Date(Math.max(new Date(r.startDate).getTime(), new Date(startDate).getTime()));
          const rEnd = new Date(Math.min(new Date(r.endDate).getTime(), new Date(endDate).getTime()));
          occupiedDays += Math.max(0, Math.ceil((rEnd.getTime() - rStart.getTime()) / 86400000));
        }

        return {
          apartmentId: apt.id,
          apartmentName: apt.name,
          revenue: Math.round(totalRevenue * 100) / 100,
          reservationRevenue: Math.round(reservationRevenue * 100) / 100,
          subleaseRevenue: Math.round(subleaseRevenue * 100) / 100,
          expenses: Math.round(expenseTotal * 100) / 100,
          reservationCount: aptReservations.length,
          occupancyRate: Math.round((occupiedDays / daysInYear) * 100 * 100) / 100,
          netProfit: Math.round((totalRevenue - expenseTotal) * 100) / 100,
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
      const allNotifications = await storage.getNotifications(undefined);
      res.json(allNotifications);
    } catch (err) {
      console.error("Get notifications error:", err);
      res.status(500).json({ message: "Failed to get notifications" });
    }
  });

  app.get("/api/notifications/unread-count", isAuthenticated, async (_req, res) => {
    try {
      const unread = await storage.getUnreadNotifications(undefined);
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

      const in90days = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 90).toISOString().split('T')[0];
      const expiringContracts = await db.select({
        id: ownerContracts.id,
        ownerId: ownerContracts.ownerId,
        apartmentId: ownerContracts.apartmentId,
        endDate: ownerContracts.endDate,
        status: ownerContracts.status,
      })
        .from(ownerContracts)
        .where(and(
          eq(ownerContracts.status, 'AKTYWNA'),
          lte(ownerContracts.endDate, in90days),
          gte(ownerContracts.endDate, today)
        ));

      for (const c of expiringContracts) {
        if (!existingKeys.has(`owner_contract:${c.id}`)) {
          const daysLeft = Math.ceil((new Date(c.endDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const apt = c.apartmentId ? await storage.getApartment(c.apartmentId) : null;
          const aptName = apt?.name || `#${c.apartmentId}`;
          await storage.createNotification({
            type: "contract_expiring",
            title: "Wygasająca umowa właścicielska",
            message: `Umowa dla ${aptName} wygasa za ${daysLeft} dni (${c.endDate})`,
            entityType: "owner_contract",
            entityId: c.id,
            dueDate: c.endDate,
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

  app.put("/api/revenue-forecasts/climate-fee", isAuthenticated, async (req, res) => {
    try {
      const { year, month, climateFeeForecast, climateFeeActual } = req.body;
      if (!year || month === undefined) {
        return res.status(400).json({ message: "year and month are required" });
      }
      const locationName = "RAZEM";
      const existing = await db.select().from(revenueForecasts)
        .where(and(
          eq(revenueForecasts.year, year),
          eq(revenueForecasts.month, month),
          eq(revenueForecasts.locationName, locationName),
        )).limit(1);

      const updateData: any = {};
      if (climateFeeForecast !== undefined) updateData.climateFeeForecast = String(climateFeeForecast);
      if (climateFeeActual !== undefined) updateData.climateFeeActual = String(climateFeeActual);

      if (existing.length > 0) {
        const [updated] = await db.update(revenueForecasts).set(updateData)
          .where(eq(revenueForecasts.id, existing[0].id)).returning();
        return res.json(updated);
      }
      const [created] = await db.insert(revenueForecasts).values({
        year,
        month,
        locationName,
        forecast: "0",
        actual: "0",
        ...updateData,
      }).returning();
      res.json(created);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/cost-forecasts", isAuthenticated, async (req, res) => {
    try {
      const year = req.query.year ? Number(req.query.year) : undefined;
      const forecasts = await storage.getCostForecasts(year);
      res.json(forecasts);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/cost-forecasts", isAuthenticated, async (req, res) => {
    try {
      const parsed = insertCostForecastSchema.parse(req.body);
      const result = await storage.upsertCostForecast(parsed);
      res.json(result);
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: "Nieprawidłowe dane prognozy kosztów", errors: err.errors });
      }
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/operational-cost-forecasts", isAuthenticated, async (req, res) => {
    try {
      const year = req.query.year ? Number(req.query.year) : undefined;
      const forecasts = await storage.getOperationalCostForecasts(year);
      res.json(forecasts);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/operational-cost-forecasts", isAuthenticated, async (req, res) => {
    try {
      const parsed = insertOperationalCostForecastSchema.parse(req.body);
      const result = await storage.upsertOperationalCostForecast(parsed);
      res.json(result);
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: "Nieprawidłowe dane", errors: err.errors });
      }
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/operational-cost-forecasts/bulk", isAuthenticated, async (req, res) => {
    try {
      const { entries } = req.body;
      if (!Array.isArray(entries)) return res.status(400).json({ message: "Oczekiwano tablicy entries" });
      const results = [];
      for (const entry of entries) {
        const parsed = insertOperationalCostForecastSchema.parse(entry);
        const result = await storage.upsertOperationalCostForecast(parsed);
        results.push(result);
      }
      res.json({ count: results.length, results });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: "Nieprawidłowe dane", errors: err.errors });
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/operational-cost-forecasts/archive", isAuthenticated, async (req, res) => {
    try {
      const { categoryId, year, archived } = req.body;
      if (!categoryId || year === undefined || archived === undefined) {
        return res.status(400).json({ message: "categoryId, year, and archived are required" });
      }
      await db.update(operationalCostForecasts)
        .set({ archived: !!archived })
        .where(and(
          eq(operationalCostForecasts.categoryId, categoryId),
          eq(operationalCostForecasts.year, Number(year)),
        ));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/operational-cost-forecasts/delete", isAuthenticated, async (req, res) => {
    try {
      const { year, month, categoryId, itemIndex } = req.body;
      if (year === undefined || month === undefined || !categoryId || itemIndex === undefined) {
        return res.status(400).json({ message: "year, month, categoryId, itemIndex are required" });
      }
      await storage.deleteOperationalCostForecast(Number(year), Number(month), categoryId, Number(itemIndex));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/operational-cost-forecasts", isAuthenticated, async (req, res) => {
    try {
      const year = req.query.year ? Number(req.query.year) : undefined;
      await storage.deleteOperationalCostForecasts(year);
      res.json({ success: true });
    } catch (err: any) {
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
      const imageAttachments: Array<{type: string; mimeType: string; data: string}> = [];
      let hasPdfDirect = false;
      const pdfBuffers: Buffer[] = [];

      for (const file of files) {
        if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
          const conv = convertPdfToImages(file.buffer, tmpDir, { maxPages: 10, label: 'sublease' });
          tmpFiles.push(...conv.tmpFiles);
          for (const img of conv.images) {
            imageAttachments.push({ type: 'image', mimeType: img.mimeType, data: img.data });
          }
          if (conv.images.length === 0 && conv.pdfBuffer) {
            hasPdfDirect = true;
            pdfBuffers.push(conv.pdfBuffer);
          }
        } else {
          imageAttachments.push({ type: 'image', mimeType: file.mimetype || 'image/png', data: file.buffer.toString('base64') });
        }
      }

      if (imageAttachments.length === 0 && pdfBuffers.length === 0) {
        return res.status(400).json({ message: "Nie udało się odczytać plików" });
      }

      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const promptText = `Przeanalizuj te zdjecia/strony umowy podnajmu/najmu mieszkania. Wyciagnij nastepujace dane w formacie JSON.
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
Odpowiedz TYLKO czystym JSON bez zadnych komentarzy ani markdown.`;

      const content: any[] = [{ type: 'text', text: promptText }];

      for (const pdfBuf of pdfBuffers) {
        content.push({
          type: 'file',
          file: { filename: 'contract.pdf', file_data: `data:application/pdf;base64,${pdfBuf.toString('base64')}` }
        });
      }

      const maxImages = Math.min(imageAttachments.length, 8);
      for (let i = 0; i < maxImages; i++) {
        content.push({
          type: 'image_url',
          image_url: { url: `data:${imageAttachments[i].mimeType};base64,${imageAttachments[i].data}` }
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

      res.json({ extracted, pages: imageAttachments.length });
    } catch (err: any) {
      console.error("Contract parse error:", err);
      res.status(500).json({ message: "Blad parsowania: " + (err.message || "Nieznany blad") });
    } finally {
      for (const f of tmpFiles) {
        try { fs.unlinkSync(f); } catch {}
      }
    }
  });

  app.post('/api/parse-sublease-pdfs-bulk', isAuthenticated, contractUpload.array('files', 20), async (req, res) => {
    const allTmpFiles: string[] = [];
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

      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const promptText = `Przeanalizuj te zdjecia/strony umowy podnajmu/najmu mieszkania. Wyciagnij nastepujace dane w formacie JSON.
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
Odpowiedz TYLKO czystym JSON bez zadnych komentarzy ani markdown.`;

      const results: Array<{ fileName: string; extracted: any; pages: number; error?: string }> = [];

      for (const file of files) {
        const tmpFiles: string[] = [];
        try {
          const tmpDir = os.tmpdir();

          const bulkImageAttachments: Array<{mimeType: string; data: string}> = [];
          let bulkPdfBuffer: Buffer | null = null;

          if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
            const conv = convertPdfToImages(file.buffer, tmpDir, { maxPages: 10, label: 'sublease_bulk' });
            tmpFiles.push(...conv.tmpFiles);
            allTmpFiles.push(...conv.tmpFiles);
            bulkImageAttachments.push(...conv.images);
            if (conv.images.length === 0 && conv.pdfBuffer) {
              bulkPdfBuffer = conv.pdfBuffer;
            }
          } else {
            bulkImageAttachments.push({ mimeType: file.mimetype || 'image/png', data: file.buffer.toString('base64') });
          }

          if (bulkImageAttachments.length === 0 && !bulkPdfBuffer) {
            results.push({ fileName: file.originalname, extracted: null, pages: 0, error: "Nie udało się odczytać pliku" });
            continue;
          }

          const content: any[] = [{ type: 'text', text: promptText }];

          if (bulkPdfBuffer) {
            content.push({
              type: 'file',
              file: { filename: file.originalname, file_data: `data:application/pdf;base64,${bulkPdfBuffer.toString('base64')}` }
            });
          }

          const maxPages = Math.min(bulkImageAttachments.length, 8);
          for (let i = 0; i < maxPages; i++) {
            content.push({
              type: 'image_url',
              image_url: { url: `data:${bulkImageAttachments[i].mimeType};base64,${bulkImageAttachments[i].data}` }
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
            results.push({ fileName: file.originalname, extracted: null, pages: bulkImageAttachments.length, error: "Nie udało się sparsować odpowiedzi AI" });
            continue;
          }

          results.push({ fileName: file.originalname, extracted, pages: bulkImageAttachments.length });
        } catch (err: any) {
          results.push({ fileName: file.originalname, extracted: null, pages: 0, error: err.message || "Błąd przetwarzania" });
        }
      }

      res.json({ results });
    } catch (err: any) {
      console.error("Bulk contract parse error:", err);
      res.status(500).json({ message: "Błąd parsowania: " + (err.message || "Nieznany błąd") });
    } finally {
      for (const f of allTmpFiles) {
        try { fs.unlinkSync(f); } catch {}
      }
    }
  });

  app.post('/api/parse-owner-contract-pdf', isAuthenticated, contractUpload.array('files', 20), async (req, res) => {
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
      const ownerImageAttachments: Array<{mimeType: string; data: string}> = [];
      const ownerPdfBuffers: Buffer[] = [];

      for (const file of files) {
        if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
          const conv = convertPdfToImages(file.buffer, tmpDir, { maxPages: 10, label: 'owner_contract' });
          tmpFiles.push(...conv.tmpFiles);
          for (const img of conv.images) {
            ownerImageAttachments.push(img);
          }
          if (conv.images.length === 0 && conv.pdfBuffer) {
            ownerPdfBuffers.push(conv.pdfBuffer);
          }
        } else {
          ownerImageAttachments.push({ mimeType: file.mimetype || 'image/png', data: file.buffer.toString('base64') });
        }
      }

      if (ownerImageAttachments.length === 0 && ownerPdfBuffers.length === 0) {
        return res.status(400).json({ message: "Nie udało się odczytać plików" });
      }

      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const ownerPromptText = `Przeanalizuj te zdjecia/strony umowy najmu z wlascicielem nieruchomosci (umowa miedzy agencja/firma zarzadzajaca a wlascicielem mieszkania/apartamentu). Wyciagnij nastepujace dane w formacie JSON.
Jesli dane nie wystepuja w dokumencie, wpisz null.
{
  "ownerFirstName": "imie wlasciciela",
  "ownerLastName": "nazwisko wlasciciela",
  "ownerCompanyName": "nazwa firmy wlasciciela (jesli jest firma)",
  "ownerNip": "NIP wlasciciela",
  "ownerPesel": "PESEL wlasciciela",
  "ownerAddress": "pelny adres wlasciciela (ulica, numer, kod pocztowy, miasto)",
  "ownerPhone": "telefon wlasciciela",
  "ownerEmail": "email wlasciciela",
  "ownerBankAccount": "numer konta bankowego wlasciciela",
  "apartments": [
    {
      "name": "nazwa/numer apartamentu/lokalu (np. 'Studio Superior 305' lub 'Apartament 12A')",
      "address": "pelny adres apartamentu (ulica, numer, kod pocztowy, miasto)",
      "floor": "pietro (jesli podane)",
      "area": "powierzchnia w m2 (jesli podana, jako liczba)"
    }
  ],
  "startDate": "YYYY-MM-DD data rozpoczecia umowy",
  "endDate": "YYYY-MM-DD data zakonczenia umowy (null jesli bezterminowa)",
  "monthlyRent": kwota czynszu miesiecznego BRUTTO jako liczba. Jesli na umowie widnieje kwota netto + VAT, ZAWSZE podaj kwote brutto lacznie z podatkiem,
  "additionalFees": dodatkowe oplaty miesieczne BRUTTO (administracja, wspolnota, itp.) jako liczba lub null,
  "paymentFrequency": "MIESIECZNIE" lub "KWARTALNIE" lub "POLROCZNIE" lub "ROCZNIE",
  "paymentDay": dzien miesiaca do kiedy nalezy oplacic (jako liczba, np. 10),
  "contractType": "UMOWA" lub "ANEKS" lub "POROZUMIENIE",
  "depositAmount": kwota kaucji jako liczba lub null,
  "vatRate": "stawka VAT np. 23% lub zw (zwolniony)",
  "noticePeriod": "okres wypowiedzenia (np. '3 miesiace', '1 miesiac')" lub null,
  "notes": "istotne uwagi, warunki szczegolne, dodatkowe ustalenia z umowy (krotko, max 500 znakow)" lub null
}
WAZNE:
- Pole "apartments" to TABLICA - jesli umowa dotyczy jednego mieszkania, zwroc tablice z jednym elementem. Jesli wielu - wypisz wszystkie.
- Jesli czynsz jest podany lacznie dla wielu mieszkan, podaj laczna kwote w monthlyRent.
- Kwoty zawsze BRUTTO (z VAT). Jesli kwota netto + VAT, oblicz brutto.
Odpowiedz TYLKO czystym JSON bez zadnych komentarzy ani markdown.`;

      const content: any[] = [{ type: 'text', text: ownerPromptText }];

      for (const pdfBuf of ownerPdfBuffers) {
        content.push({
          type: 'file',
          file: { filename: 'contract.pdf', file_data: `data:application/pdf;base64,${pdfBuf.toString('base64')}` }
        });
      }

      const maxImages = Math.min(ownerImageAttachments.length, 8);
      for (let i = 0; i < maxImages; i++) {
        content.push({
          type: 'image_url',
          image_url: { url: `data:${ownerImageAttachments[i].mimeType};base64,${ownerImageAttachments[i].data}` }
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
        return res.status(422).json({ message: "Nie udało się sparsować odpowiedzi AI", raw: rawText });
      }

      res.json({ extracted, pages: ownerImageAttachments.length });
    } catch (err: any) {
      console.error("Owner contract parse error:", err);
      res.status(500).json({ message: "Błąd parsowania: " + (err.message || "Nieznany błąd") });
    } finally {
      for (const f of tmpFiles) {
        try { fs.unlinkSync(f); } catch {}
      }
    }
  });

  app.post('/api/owner-contracts/:id/upload-pdf', isAuthenticated, contractUpload.single('file'), async (req, res) => {
    try {
      const contractId = Number(req.params.id);
      const file = req.file;
      if (!file) return res.status(400).json({ message: "Brak pliku" });

      const { ObjectStorageService } = await import("./replit_integrations/object_storage/objectStorage");
      const osService = new ObjectStorageService();
      const privateDir = osService.getPrivateObjectDir();
      const fileName = `owner_contract_${contractId}_${Date.now()}.pdf`;
      const objectPath = `${privateDir}/owner-contracts/${fileName}`;

      await osService.uploadObject(objectPath, file.buffer, file.mimetype || 'application/pdf');

      await db.update(ownerContracts).set({ pdfPath: objectPath }).where(eq(ownerContracts.id, contractId));

      res.json({ pdfPath: objectPath });
    } catch (err: any) {
      console.error("Upload owner contract PDF error:", err);
      res.status(500).json({ message: err.message || "Błąd uploadu" });
    }
  });

  app.get('/api/owner-contracts/:id/pdf', isAuthenticated, async (req, res) => {
    try {
      const contractId = Number(req.params.id);
      const [contract] = await db.select().from(ownerContracts).where(eq(ownerContracts.id, contractId)).limit(1);
      if (!contract || !contract.pdfPath) return res.status(404).json({ message: "Brak PDF" });

      const { ObjectStorageService } = await import("./replit_integrations/object_storage/objectStorage");
      const osService = new ObjectStorageService();
      const url = await osService.getPresignedDownloadUrl(contract.pdfPath, 300);
      res.json({ url });
    } catch (err: any) {
      console.error("Get owner contract PDF error:", err);
      res.status(500).json({ message: err.message || "Błąd pobierania" });
    }
  });

  // ============ Handover Protocols (Protokoły zdawczo-odbiorcze) ============

  app.get('/api/handover-protocols', isAuthenticated, async (req, res) => {
    try {
      const subleaseId = req.query.subleaseId ? Number(req.query.subleaseId) : undefined;
      const protocols = await storage.getHandoverProtocols(subleaseId);
      res.json(protocols);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/handover-protocols/:id', isAuthenticated, async (req, res) => {
    try {
      const protocol = await storage.getHandoverProtocol(Number(req.params.id));
      if (!protocol) return res.status(404).json({ message: "Nie znaleziono protokołu" });
      const rooms = await storage.getHandoverProtocolRooms(protocol.id);
      const items = await storage.getHandoverProtocolItems(protocol.id);
      const meters = await storage.getHandoverProtocolMeters(protocol.id);
      res.json({ ...protocol, rooms, items, meters });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/handover-protocols', isAuthenticated, async (req, res) => {
    try {
      const { rooms, items, meters, ...protocolData } = req.body;
      const parsed = insertHandoverProtocolSchema.parse(protocolData);
      const protocol = await storage.createHandoverProtocol(parsed);

      if (rooms && Array.isArray(rooms)) {
        for (const room of rooms) {
          await storage.createHandoverProtocolRoom({ ...room, protocolId: protocol.id });
        }
      }
      if (items && Array.isArray(items)) {
        for (const item of items) {
          await storage.createHandoverProtocolItem({ ...item, protocolId: protocol.id });
        }
      }
      if (meters && Array.isArray(meters)) {
        for (const meter of meters) {
          await storage.createHandoverProtocolMeter({ ...meter, protocolId: protocol.id });
        }
      }

      const full = await storage.getHandoverProtocol(protocol.id);
      const fullRooms = await storage.getHandoverProtocolRooms(protocol.id);
      const fullItems = await storage.getHandoverProtocolItems(protocol.id);
      const fullMeters = await storage.getHandoverProtocolMeters(protocol.id);
      res.json({ ...full, rooms: fullRooms, items: fullItems, meters: fullMeters });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch('/api/handover-protocols/:id', isAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { rooms, items, meters, ...protocolData } = req.body;
      const protocol = await storage.updateHandoverProtocol(id, protocolData);

      if (rooms && Array.isArray(rooms)) {
        const existing = await storage.getHandoverProtocolRooms(id);
        for (const r of existing) await storage.deleteHandoverProtocolRoom(r.id);
        for (const room of rooms) {
          await storage.createHandoverProtocolRoom({ ...room, protocolId: id });
        }
      }
      if (items && Array.isArray(items)) {
        const existing = await storage.getHandoverProtocolItems(id);
        for (const i of existing) await storage.deleteHandoverProtocolItem(i.id);
        for (const item of items) {
          await storage.createHandoverProtocolItem({ ...item, protocolId: id });
        }
      }
      if (meters && Array.isArray(meters)) {
        const existing = await storage.getHandoverProtocolMeters(id);
        for (const m of existing) await storage.deleteHandoverProtocolMeter(m.id);
        for (const meter of meters) {
          await storage.createHandoverProtocolMeter({ ...meter, protocolId: id });
        }
      }

      const fullRooms = await storage.getHandoverProtocolRooms(id);
      const fullItems = await storage.getHandoverProtocolItems(id);
      const fullMeters = await storage.getHandoverProtocolMeters(id);
      res.json({ ...protocol, rooms: fullRooms, items: fullItems, meters: fullMeters });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete('/api/handover-protocols/:id', isAuthenticated, async (req, res) => {
    try {
      await storage.deleteHandoverProtocol(Number(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // PDF generation for handover protocol
  app.get('/api/handover-protocols/:id/pdf', isAuthenticated, async (req, res) => {
    try {
      const protocol = await storage.getHandoverProtocol(Number(req.params.id));
      if (!protocol) return res.status(404).json({ message: "Nie znaleziono protokołu" });
      const rooms = await storage.getHandoverProtocolRooms(protocol.id);
      const items = await storage.getHandoverProtocolItems(protocol.id);
      const meters = await storage.getHandoverProtocolMeters(protocol.id);
      const settings = await storage.getCompanySettings();

      const { jsPDF } = require("jspdf");
      const autoTableMod = require("jspdf-autotable");
      const autoTable = autoTableMod.default || autoTableMod;

      function stripPl(s: string): string {
        const map: Record<string, string> = {
          'ą':'a','ć':'c','ę':'e','ł':'l','ń':'n','ó':'o','ś':'s','ź':'z','ż':'z',
          'Ą':'A','Ć':'C','Ę':'E','Ł':'L','Ń':'N','Ó':'O','Ś':'S','Ź':'Z','Ż':'Z'
        };
        return s.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, c => map[c] || c);
      }

      const doc = new jsPDF({ compress: true });
      let y = 15;

      if (settings?.logoUrl) {
        try {
          const logoResp = await fetch(settings.logoUrl);
          if (logoResp.ok) {
            const rawLogoBuffer = Buffer.from(await logoResp.arrayBuffer());
            const isPng = settings.logoUrl.toLowerCase().includes('.png');
            let imgBuf = rawLogoBuffer;
            let imgFmt: string = isPng ? "PNG" : "JPEG";
            if (isPng) {
              try {
                const PNG = require("pngjs").PNG;
                const jpegMod = require("jpeg-js");
                const png = PNG.sync.read(rawLogoBuffer);
                const sw = Math.min(png.width, 300);
                const sc = sw / png.width;
                const sh = Math.round(png.height * sc);
                const rd2 = Buffer.alloc(sw * sh * 4);
                for (let py = 0; py < sh; py++) {
                  for (let px = 0; px < sw; px++) {
                    const sox = Math.floor(px / sc), soy = Math.floor(py / sc);
                    const si2 = (soy * png.width + sox) * 4, di2 = (py * sw + px) * 4;
                    const al = png.data[si2 + 3] / 255;
                    rd2[di2] = Math.round(png.data[si2] * al + 255 * (1 - al));
                    rd2[di2 + 1] = Math.round(png.data[si2 + 1] * al + 255 * (1 - al));
                    rd2[di2 + 2] = Math.round(png.data[si2 + 2] * al + 255 * (1 - al));
                    rd2[di2 + 3] = 255;
                  }
                }
                imgBuf = jpegMod.encode({ data: rd2, width: sw, height: sh }, 70).data;
                imgFmt = "JPEG";
              } catch (convErr) { console.error("PNG→JPEG conversion failed, using raw:", convErr); }
            }
            doc.addImage(imgBuf, imgFmt, 14, y, 30, 15);
          }
        } catch (e) { console.error("Logo load error:", e); }
      }

      // Header
      if (settings?.companyName) {
        doc.setFontSize(8);
        doc.text(stripPl(settings.companyName), 50, y + 4);
        if (settings.address) doc.text(stripPl(settings.address), 50, y + 8);
        if (settings.nip) doc.text(stripPl(`NIP: ${settings.nip}`), 50, y + 12);
      }

      y = 40;
      doc.setFontSize(14);
      const typeLabel = protocol.protocolType === 'WYDANIE' ? 'WYDANIA' : 'ZWROTU';
      doc.text(stripPl(`PROTOKOL ZDAWCZO-ODBIORCZY ${typeLabel}`), 105, y, { align: 'center' });

      y += 10;
      doc.setFontSize(10);
      doc.text(stripPl(`Data: ${protocol.protocolDate}${protocol.protocolTime ? ' godz. ' + protocol.protocolTime : ''}`), 14, y);
      y += 6;
      doc.text(stripPl(`Lokal: ${protocol.apartmentName}${protocol.apartmentAddress ? ', ' + protocol.apartmentAddress : ''}`), 14, y);
      y += 6;
      doc.text(stripPl(`Najemca: ${protocol.tenantName}`), 14, y);
      if (protocol.tenantPesel) {
        y += 6;
        doc.text(stripPl(`PESEL: ${protocol.tenantPesel}`), 14, y);
      }
      if (protocol.tenantIdNumber) {
        y += 6;
        doc.text(stripPl(`Nr dowodu: ${protocol.tenantIdNumber}`), 14, y);
      }

      // Meters table
      if (meters.length > 0) {
        y += 10;
        doc.setFontSize(11);
        doc.text(stripPl("STANY LICZNIKOW"), 14, y);
        y += 2;

        const meterLabels: Record<string, string> = {
          'PRAD': 'Prad', 'WODA_ZIMNA': 'Woda zimna', 'WODA_CIEPLA': 'Woda ciepla',
          'GAZ': 'Gaz', 'OGRZEWANIE': 'Ogrzewanie'
        };

        autoTable(doc, {
          startY: y,
          head: [['Typ', 'Nr licznika', 'Odczyt', 'Jednostka']],
          body: meters.map(m => [
            stripPl(meterLabels[m.meterType] || m.meterType),
            m.meterNumber || '-',
            m.reading || '-',
            m.unit || '-',
          ]),
          styles: { fontSize: 9 },
          headStyles: { fillColor: [60, 60, 60] },
          margin: { left: 14 },
        });
        y = (doc as any).lastAutoTable.finalY + 6;
      }

      // Rooms table
      if (rooms.length > 0) {
        doc.setFontSize(11);
        doc.text(stripPl("STAN POMIESZCZEN"), 14, y);
        y += 2;

        const condLabels: Record<string, string> = {
          'DOBRY': 'Dobry', 'USZKODZONY': 'Uszkodzony', 'DO_NAPRAWY': 'Do naprawy'
        };
        const condLabel = (v: string | null) => v ? (condLabels[v] || v) : '-';

        autoTable(doc, {
          startY: y,
          head: [['Pomieszczenie', 'Sciany', 'Podloga', 'Okna', 'Drzwi', 'Uwagi']],
          body: rooms.map(r => [
            stripPl(r.roomName),
            stripPl(condLabel(r.wallsCondition)),
            stripPl(condLabel(r.floorCondition)),
            stripPl(condLabel(r.windowsCondition)),
            stripPl(condLabel(r.doorsCondition)),
            stripPl(r.comments || '-'),
          ]),
          styles: { fontSize: 8 },
          headStyles: { fillColor: [60, 60, 60] },
          margin: { left: 14 },
          columnStyles: { 5: { cellWidth: 40 } },
        });
        y = (doc as any).lastAutoTable.finalY + 6;
      }

      // Items table
      if (items.length > 0) {
        if (y > 240) { doc.addPage(); y = 15; }
        doc.setFontSize(11);
        doc.text(stripPl("WYPOSAZENIE"), 14, y);
        y += 2;

        const itemCondLabels: Record<string, string> = {
          'NOWY': 'Nowy', 'DOBRY': 'Dobry', 'ZUZYTY': 'Zuzyty', 'USZKODZONY': 'Uszkodzony'
        };

        autoTable(doc, {
          startY: y,
          head: [['Lp.', 'Nazwa', 'Ilosc', 'Stan', 'Uwagi']],
          body: items.map((it, idx) => [
            idx + 1,
            stripPl(it.itemName),
            it.quantity || 1,
            stripPl(it.condition ? (itemCondLabels[it.condition] || it.condition) : '-'),
            stripPl(it.comments || '-'),
          ]),
          styles: { fontSize: 8 },
          headStyles: { fillColor: [60, 60, 60] },
          margin: { left: 14 },
        });
        y = (doc as any).lastAutoTable.finalY + 6;
      }

      // Notes
      if (protocol.notes) {
        if (y > 250) { doc.addPage(); y = 15; }
        doc.setFontSize(11);
        doc.text(stripPl("UWAGI"), 14, y);
        y += 6;
        doc.setFontSize(9);
        const lines = doc.splitTextToSize(stripPl(protocol.notes), 180);
        doc.text(lines, 14, y);
        y += lines.length * 5 + 6;
      }

      // Signatures
      if (y > 240) { doc.addPage(); y = 15; }
      y += 15;
      doc.setFontSize(9);
      doc.text(".....................................", 30, y, { align: 'center' });
      doc.text(".....................................", 170, y, { align: 'center' });
      y += 5;
      doc.text(stripPl("Przekazujacy"), 30, y, { align: 'center' });
      doc.text(stripPl("Przejmujacy"), 170, y, { align: 'center' });

      // QR code footer
      if (settings?.websiteUrl) {
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setFontSize(7);
        doc.text(stripPl(settings.websiteUrl), 105, pageHeight - 10, { align: 'center' });
      }

      const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
      const fileName = `protokol_${protocol.protocolType.toLowerCase()}_${protocol.id}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
      res.send(pdfBuffer);
    } catch (err: any) {
      console.error("Protocol PDF error:", err);
      res.status(500).json({ message: "Blad generowania PDF: " + err.message });
    }
  });

  // ============ Universal Importer: Templates & Import ============

  const IMPORTER_CONFIGS: Record<string, {
    sheetName: string;
    columns: { header: string; key: string; example: string; type?: 'date' | 'decimal' | 'string' }[];
    requiredKeys: string[];
    createFn: (row: any) => Promise<any>;
    invalidateKeys: string[];
  }> = {
    owners: {
      sheetName: "Właściciele",
      columns: [
        { header: "Nazwa / Imię i nazwisko", key: "name", example: "Jan Kowalski" },
        { header: "Typ (osoba_fizyczna / firma)", key: "ownerType", example: "osoba_fizyczna" },
        { header: "NIP", key: "nip", example: "1234567890" },
        { header: "Telefon", key: "phone", example: "+48 600 100 200" },
        { header: "Email", key: "email", example: "jan@example.com" },
        { header: "Notatki", key: "notes", example: "" },
      ],
      requiredKeys: ["name"],
      createFn: async (row: any) => {
        return storage.createOwner({
          name: row.name,
          ownerType: row.ownerType || "osoba_fizyczna",
          nip: row.nip || null,
          phone: row.phone || null,
          email: row.email || null,
          notes: row.notes || null,
        });
      },
      invalidateKeys: ["/api/owners"],
    },
    employees: {
      sheetName: "Pracownicy",
      columns: [
        { header: "Imię", key: "firstName", example: "Anna" },
        { header: "Nazwisko", key: "lastName", example: "Nowak" },
        { header: "Telefon", key: "phone", example: "+48 600 100 200" },
        { header: "Email", key: "email", example: "anna@example.com" },
        { header: "PESEL", key: "pesel", example: "90010112345" },
        { header: "Data urodzenia (RRRR-MM-DD)", key: "birthDate", example: "1990-01-01", type: "date" as const },
        { header: "Forma współpracy (ETAT / PRACA_NA_H)", key: "cooperationType", example: "ETAT" },
        { header: "Typ umowy (CZAS_OKRESLONY / CZAS_NIEOKRESLONY)", key: "contractType", example: "CZAS_OKRESLONY" },
        { header: "Początek umowy (RRRR-MM-DD)", key: "contractStart", example: "2024-01-01", type: "date" as const },
        { header: "Koniec umowy (RRRR-MM-DD)", key: "contractEnd", example: "2025-12-31", type: "date" as const },
        { header: "Stanowisko (KIEROWNIK_RECEPCJI / PRACOWNIK_RECEPCJI / KONSERWATOR / OSOBA_SPRZATAJACA / FINANCIAL_MANAGER)", key: "position", example: "PRACOWNIK_RECEPCJI" },
        { header: "Stawka godzinowa", key: "hourlyRate", example: "35.00", type: "decimal" as const },
        { header: "Komentarz", key: "comment", example: "" },
        { header: "Status (AKTYWNY / NIEAKTYWNY)", key: "status", example: "AKTYWNY" },
      ],
      requiredKeys: ["firstName", "lastName", "cooperationType", "position"],
      createFn: async (row: any) => {
        return storage.createEmployee({
          firstName: row.firstName,
          lastName: row.lastName,
          phone: row.phone || null,
          email: row.email || null,
          pesel: row.pesel || null,
          birthDate: row.birthDate || null,
          cooperationType: row.cooperationType || "ETAT",
          contractType: row.contractType || null,
          contractStart: row.contractStart || null,
          contractEnd: row.contractEnd || null,
          position: row.position || "PRACOWNIK_RECEPCJI",
          hourlyRate: row.hourlyRate || null,
          comment: row.comment || null,
          status: row.status || "AKTYWNY",
          photoUrl: null,
        });
      },
      invalidateKeys: ["/api/employees"],
    },
    "service-contracts": {
      sheetName: "Umowy serwisowe",
      columns: [
        { header: "Nazwa umowy", key: "name", example: "Internet - Biuro" },
        { header: "Kategoria (nazwa)", key: "categoryName", example: "Internet" },
        { header: "Data podpisania (RRRR-MM-DD)", key: "signDate", example: "2024-01-15", type: "date" as const },
        { header: "Czas trwania", key: "duration", example: "24 miesiące" },
        { header: "Data zakończenia (RRRR-MM-DD)", key: "endDate", example: "2026-01-15", type: "date" as const },
        { header: "Adres usługi", key: "serviceAddress", example: "ul. Morska 15, Gdańsk" },
        { header: "Cena miesięczna", key: "monthlyPrice", example: "120.00", type: "decimal" as const },
      ],
      requiredKeys: ["name"],
      createFn: async (row: any) => {
        let categoryId: number | null = null;
        if (row.categoryName) {
          const cats = await storage.getServiceContractCategories();
          const existing = cats.find((c: any) => c.name.toLowerCase() === row.categoryName.toLowerCase());
          if (existing) {
            categoryId = existing.id;
          } else {
            const newCat = await storage.createServiceContractCategory({ name: row.categoryName, sortOrder: 0 });
            categoryId = newCat.id;
          }
        }
        return storage.createServiceContract({
          name: row.name,
          categoryId,
          signDate: row.signDate || null,
          duration: row.duration || null,
          endDate: row.endDate || null,
          serviceAddress: row.serviceAddress || null,
          monthlyPrice: row.monthlyPrice || null,
        });
      },
      invalidateKeys: ["/api/service-contracts"],
    },
  };

  app.get('/api/import-template/:type', isAuthenticated, (req, res) => {
    const config = IMPORTER_CONFIGS[req.params.type];
    if (!config) {
      return res.status(400).json({ message: "Nieznany typ importu: " + req.params.type });
    }

    const wb = XLSX.utils.book_new();
    const headers = config.columns.map(c => c.header);
    const examples = config.columns.map(c => c.example);
    const ws = XLSX.utils.aoa_to_sheet([headers, examples]);

    const colWidths = headers.map(h => ({ wch: Math.max(h.length + 2, 20) }));
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, config.sheetName);
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=szablon_${req.params.type}.xlsx`);
    res.send(buf);
  });

  app.post('/api/import-data/:type', isAuthenticated, upload.single('file'), async (req, res) => {
    const config = IMPORTER_CONFIGS[req.params.type];
    if (!config) {
      return res.status(400).json({ message: "Nieznany typ importu: " + req.params.type });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Brak pliku" });
    }

    try {
      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) {
        return res.status(400).json({ message: "Plik nie zawiera arkuszy" });
      }

      const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      if (rawRows.length === 0) {
        return res.status(400).json({ message: "Plik nie zawiera danych (puste wiersze)" });
      }

      const headerMap: Record<string, string> = {};
      for (const col of config.columns) {
        headerMap[col.header] = col.key;
      }

      const log: string[] = [];
      let imported = 0;
      let skipped = 0;

      const typeMap: Record<string, string> = {};
      for (const col of config.columns) {
        if (col.type) typeMap[col.key] = col.type;
      }

      for (let i = 0; i < rawRows.length; i++) {
        const rawRow = rawRows[i];
        const mapped: Record<string, any> = {};

        for (const [excelHeader, value] of Object.entries(rawRow)) {
          const key = headerMap[excelHeader];
          if (!key) continue;
          const colType = typeMap[key];

          if (colType === 'date') {
            mapped[key] = excelDateToISO(value);
          } else if (colType === 'decimal') {
            if (value === "" || value === null || value === undefined) {
              mapped[key] = null;
            } else {
              const num = parseFloat(String(value).replace(",", "."));
              mapped[key] = isNaN(num) ? null : String(num);
            }
          } else {
            const str = typeof value === 'string' ? value.trim() : String(value ?? "").trim();
            mapped[key] = str || null;
          }
        }

        const missingRequired = config.requiredKeys.filter(k => !mapped[k]);
        if (missingRequired.length > 0) {
          const labels = missingRequired.map(k => {
            const col = config.columns.find(c => c.key === k);
            return col ? col.header : k;
          });
          log.push(`Wiersz ${i + 2}: pominięty (brak wymaganych pól: ${labels.join(", ")})`);
          skipped++;
          continue;
        }

        try {
          await config.createFn(mapped);
          imported++;
          log.push(`Wiersz ${i + 2}: zaimportowano`);
        } catch (err: any) {
          log.push(`Wiersz ${i + 2}: błąd - ${err.message}`);
          skipped++;
        }
      }

      res.json({
        message: `Zaimportowano ${imported} rekordów, pominięto ${skipped}`,
        imported,
        skipped,
        log,
      });
    } catch (err: any) {
      console.error("Import error:", err);
      res.status(500).json({ message: "Błąd importu: " + (err.message || "Nieznany błąd") });
    }
  });

  // Technical Inspections
  app.get('/api/technical-inspections', isAuthenticated, async (req, res) => {
    try {
      const filters: any = {};
      if (req.query.apartmentId) filters.apartmentId = Number(req.query.apartmentId);
      if (req.query.inspectionType) filters.inspectionType = String(req.query.inspectionType);
      if (req.query.status) filters.status = String(req.query.status);
      const inspections = await storage.getTechnicalInspections(filters);
      res.json(inspections);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/technical-inspections/upcoming', isAuthenticated, async (req, res) => {
    try {
      const all = await storage.getTechnicalInspections();
      const today = new Date();
      const thirtyDaysLater = new Date();
      thirtyDaysLater.setDate(today.getDate() + 30);
      const todayStr = today.toISOString().split('T')[0];
      const upcoming = all.filter(i => {
        if (!i.nextDate) return false;
        return i.nextDate <= thirtyDaysLater.toISOString().split('T')[0] && i.status !== 'WYKONANY';
      }).map(i => ({
        ...i,
        isOverdue: i.nextDate < todayStr,
      }));
      res.json(upcoming);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/technical-inspections/:id', isAuthenticated, async (req, res) => {
    try {
      const inspection = await storage.getTechnicalInspection(Number(req.params.id));
      if (!inspection) return res.status(404).json({ message: "Nie znaleziono przeglądu" });
      res.json(inspection);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/technical-inspections', isAuthenticated, async (req, res) => {
    try {
      const parsed = insertTechnicalInspectionSchema.parse(req.body);
      const inspection = await storage.createTechnicalInspection(parsed);
      res.status(201).json(inspection);
    } catch (err: any) {
      if (err.name === 'ZodError') return res.status(400).json({ message: "Nieprawidłowe dane", errors: err.errors });
      res.status(500).json({ message: err.message });
    }
  });

  app.patch('/api/technical-inspections/:id', isAuthenticated, async (req, res) => {
    try {
      const parsed = insertTechnicalInspectionSchema.partial().parse(req.body);
      const inspection = await storage.updateTechnicalInspection(Number(req.params.id), parsed);
      res.json(inspection);
    } catch (err: any) {
      if (err.name === 'ZodError') return res.status(400).json({ message: "Nieprawidłowe dane", errors: err.errors });
      res.status(500).json({ message: err.message });
    }
  });

  app.delete('/api/technical-inspections/:id', isAuthenticated, async (req, res) => {
    try {
      await storage.deleteTechnicalInspection(Number(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/loans', isAuthenticated, async (req, res) => {
    try {
      const allLoans = await storage.getLoans();
      const allPayments = await storage.getAllLoanPayments();
      const paymentsByLoan: Record<number, typeof allPayments> = {};
      for (const p of allPayments) {
        if (!paymentsByLoan[p.loanId]) paymentsByLoan[p.loanId] = [];
        paymentsByLoan[p.loanId].push(p);
      }
      const result = allLoans.map(loan => {
        const payments = paymentsByLoan[loan.id] || [];
        const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
        const remaining = Number(loan.amount) - totalPaid;
        return { ...loan, payments, totalPaid: totalPaid.toFixed(2), remaining: remaining.toFixed(2) };
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/loans', isAuthenticated, async (req, res) => {
    try {
      const input = insertLoanSchema.parse(req.body);
      const created = await storage.createLoan(input);
      res.json(created);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch('/api/loans/:id', isAuthenticated, async (req, res) => {
    try {
      const updated = await storage.updateLoan(Number(req.params.id), req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete('/api/loans/:id', isAuthenticated, async (req, res) => {
    try {
      await storage.deleteLoan(Number(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/loan-payments', isAuthenticated, async (req, res) => {
    try {
      const input = insertLoanPaymentSchema.parse(req.body);
      const created = await storage.createLoanPayment(input);
      res.json(created);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete('/api/loan-payments/:id', isAuthenticated, async (req, res) => {
    try {
      await storage.deleteLoanPayment(Number(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/loans-balance', isAuthenticated, async (req, res) => {
    try {
      const balance = await storage.getLoansBalance();
      res.json({ balance: balance.toFixed(2) });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ==================== CUSTOMERS (CRM) ====================
  app.get('/api/customers', isAuthenticated, async (req, res) => {
    try {
      const data = await storage.getCustomers();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/customers/:id', isAuthenticated, async (req, res) => {
    try {
      const data = await storage.getCustomer(Number(req.params.id));
      if (!data) return res.status(404).json({ message: 'Nie znaleziono klienta' });
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/customers', isAuthenticated, async (req, res) => {
    try {
      const input = insertCustomerSchema.parse(req.body);
      const created = await storage.createCustomer(input);
      res.json(created);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch('/api/customers/:id', isAuthenticated, async (req, res) => {
    try {
      const updated = await storage.updateCustomer(Number(req.params.id), req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete('/api/customers/:id', isAuthenticated, async (req, res) => {
    try {
      await storage.deleteCustomer(Number(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ==================== PROFILE PHOTO ====================
  app.post('/api/users/:id/profile-photo', isAuthenticated, upload.single('photo'), async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "Brak pliku" });
      const allowedMimes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
      if (!allowedMimes.includes(req.file.mimetype)) {
        return res.status(400).json({ message: "Dozwolone formaty: PNG, JPG, WebP" });
      }
      if (req.file.size > 5 * 1024 * 1024) {
        return res.status(400).json({ message: "Maksymalny rozmiar pliku: 5MB" });
      }

      const targetUserId = req.params.id;
      const currentUserId = req.user?.claims?.sub;

      const isOwnProfile = targetUserId === currentUserId;

      const [authUser] = await db.select().from(users).where(eq(users.id, targetUserId));
      const isAuthUser = !!authUser;
      const isNumericId = /^\d+$/.test(targetUserId);

      if (!isOwnProfile) {
        if (isNumericId && !isAuthUser) {
          const [targetUser] = await db.select().from(appUsers).where(eq(appUsers.id, parseInt(targetUserId)));
          if (!targetUser) {
            return res.status(404).json({ message: "Nie znaleziono użytkownika" });
          }
        } else if (!isAuthUser) {
          return res.status(403).json({ message: "Brak uprawnień" });
        }
      }

      const { ObjectStorageService, objectStorageClient: osStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
      const osService = new ObjectStorageService();
      const publicPaths = osService.getPublicObjectSearchPaths();
      const publicDir = publicPaths[0];

      const ext = req.file.originalname.split(".").pop()?.toLowerCase() || "png";
      const fileName = `profile-photos/${targetUserId}.${ext}`;
      const storagePath = `${publicDir}/${fileName}`;
      const parsedPath = (() => {
        const p = storagePath.startsWith("/") ? storagePath.slice(1) : storagePath;
        const parts = p.split("/");
        return { bucketName: parts[0], objectName: parts.slice(1).join("/") };
      })();

      const storageFile = osStorageClient.bucket(parsedPath.bucketName).file(parsedPath.objectName);
      await storageFile.save(req.file.buffer, { contentType: req.file.mimetype });

      const photoUrl = `/api/users/${targetUserId}/profile-photo`;

      if (isAuthUser) {
        await db.update(users).set({ profileImageUrl: storagePath, updatedAt: new Date() }).where(eq(users.id, targetUserId));
      } else if (isNumericId) {
        await db.update(appUsers).set({ profileImageUrl: storagePath }).where(eq(appUsers.id, parseInt(targetUserId)));
      }

      res.json({ photoUrl });
    } catch (err: any) {
      console.error("Profile photo upload error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/users/:id/profile-photo', async (req, res) => {
    try {
      const targetUserId = req.params.id;

      let storagePath: string | null = null;
      const [authUser] = await db.select().from(users).where(eq(users.id, targetUserId));
      if (authUser) {
        storagePath = authUser.profileImageUrl || null;
      } else if (/^\d+$/.test(targetUserId)) {
        const [appUser] = await db.select().from(appUsers).where(eq(appUsers.id, parseInt(targetUserId)));
        storagePath = appUser?.profileImageUrl || null;
      }

      if (!storagePath) return res.status(404).json({ message: "Brak zdjęcia" });

      const { objectStorageClient: osStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
      const parsedPath = (() => {
        const p = storagePath!.startsWith("/") ? storagePath!.slice(1) : storagePath!;
        const parts = p.split("/");
        return { bucketName: parts[0], objectName: parts.slice(1).join("/") };
      })();
      const storageFile = osStorageClient.bucket(parsedPath.bucketName).file(parsedPath.objectName);
      const [exists] = await storageFile.exists();
      if (!exists) return res.status(404).json({ message: "Brak zdjęcia" });

      const [fileBuffer] = await storageFile.download();
      const extMatch = storagePath!.match(/\.(\w+)$/);
      const ext = extMatch ? extMatch[1].toLowerCase() : "png";
      const mimeMap: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };
      res.setHeader("Content-Type", mimeMap[ext] || "image/png");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(fileBuffer);
    } catch (err: any) {
      console.error("Profile photo fetch error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.delete('/api/users/:id/profile-photo', isAuthenticated, async (req: any, res) => {
    try {
      const targetUserId = req.params.id;
      const currentUserId = req.user?.claims?.sub;
      const isOwnProfile = targetUserId === currentUserId;

      const [authUser] = await db.select().from(users).where(eq(users.id, targetUserId));
      const isAuthUser = !!authUser;
      const isNumericId = /^\d+$/.test(targetUserId);

      if (!isOwnProfile) {
        if (isNumericId && !isAuthUser) {
          const [targetUser] = await db.select().from(appUsers).where(eq(appUsers.id, parseInt(targetUserId)));
          if (!targetUser) {
            return res.status(404).json({ message: "Nie znaleziono użytkownika" });
          }
        } else if (!isAuthUser) {
          return res.status(403).json({ message: "Brak uprawnień" });
        }
      }

      if (isAuthUser) {
        await db.update(users).set({ profileImageUrl: null, updatedAt: new Date() }).where(eq(users.id, targetUserId));
      } else if (isNumericId) {
        await db.update(appUsers).set({ profileImageUrl: null }).where(eq(appUsers.id, parseInt(targetUserId)));
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ==================== ALL USERS (for sharing) ====================
  app.get('/api/all-users', isAuthenticated, async (_req, res) => {
    try {
      const allUsers = await db.select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        profileImageUrl: users.profileImageUrl,
      }).from(users);
      res.json(allUsers);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });


  app.get('/api/gus/lookup-nip/:nip', isAuthenticated, async (req, res) => {
    try {
      const nip = req.params.nip.replace(/[\s-]/g, '');
      if (!/^\d{10}$/.test(nip)) {
        return res.status(400).json({ message: "NIP musi mieć 10 cyfr" });
      }

      const Bir = (await import('bir1')).default;
      const bir = new Bir();
      await bir.login();

      const results = await bir.search({ nip });
      if (!results || (Array.isArray(results) && results.length === 0)) {
        return res.status(404).json({ message: "Nie znaleziono podmiotu o podanym NIP" });
      }

      const entity = Array.isArray(results) ? results[0] : results;
      const name = entity.Nazwa || entity.nazwa || '';
      const street = [entity.Ulica || entity.ulica, entity.NrNieruchomosci || entity.nrNieruchomosci, entity.NrLokalu || entity.nrLokalu].filter(Boolean).join(' ');
      const city = entity.Miejscowosc || entity.miejscowosc || '';
      const postalCode = entity.KodPocztowy || entity.kodPocztowy || '';
      const regon = entity.Regon || entity.regon || '';

      res.json({
        name: name.trim(),
        street: street.trim(),
        city,
        postalCode,
        regon,
        nip,
      });
    } catch (err: any) {
      console.error("GUS lookup error:", err);
      res.status(500).json({ message: "Błąd komunikacji z bazą GUS: " + (err.message || "Nieznany błąd") });
    }
  });

  // ========== V2 API ROUTES ==========

  // Variable Cost Forecasts CRUD
  app.get("/api/variable-cost-forecasts", isAuthenticated, async (req, res) => {
    try {
      const year = req.query.year ? Number(req.query.year) : undefined;
      const forecasts = await storage.getVariableCostForecasts(year);
      res.json(forecasts);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/variable-cost-forecasts", isAuthenticated, async (req, res) => {
    try {
      const parsed = insertVariableCostForecastSchema.parse(req.body);
      const result = await storage.upsertVariableCostForecast(parsed);
      res.json(result);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: "Nieprawidłowe dane", errors: err.errors });
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/variable-cost-forecasts/:id", isAuthenticated, async (req, res) => {
    try {
      await db.delete(variableCostForecasts).where(eq(variableCostForecasts.id, Number(req.params.id)));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // V2 Copy forecasts between years
  app.post("/api/v2/copy-forecasts", isAuthenticated, async (req, res) => {
    try {
      const { sourceYear, targetYear, adjustmentPct, types } = req.body as {
        sourceYear: number;
        targetYear: number;
        adjustmentPct: number;
        types: string[];
      };
      if (!sourceYear || !targetYear || sourceYear === targetYear) {
        return res.status(400).json({ message: "Nieprawidłowe lata" });
      }
      const multiplier = 1 + (adjustmentPct || 0) / 100;
      let copied = { revenue: 0, cost: 0, operational: 0, variable: 0 };

      if (types.includes("revenue")) {
        const source = await storage.getRevenueForecasts(sourceYear);
        for (const f of source) {
          if (!f.apartmentId) continue;
          await storage.upsertRevenueForecast({
            year: targetYear,
            month: f.month,
            apartmentId: f.apartmentId,
            locationName: f.locationName,
            forecast: String(Math.round(Number(f.forecast || 0) * multiplier * 100) / 100),
          });
          copied.revenue++;
        }
      }

      if (types.includes("cost")) {
        const source = await storage.getCostForecasts(sourceYear);
        const manualOnly = source.filter(c => !c.sourceType || c.sourceType === "manual");
        for (const f of manualOnly) {
          await storage.upsertCostForecast({
            year: targetYear,
            month: f.month,
            apartmentId: f.apartmentId,
            category: f.category,
            forecast: String(Math.round(Number(f.forecast || 0) * multiplier * 100) / 100),
            sourceType: "manual",
          });
          copied.cost++;
        }
      }

      if (types.includes("operational")) {
        const source = await storage.getOperationalCostForecasts(sourceYear);
        for (const f of source) {
          await storage.upsertOperationalCostForecast({
            year: targetYear,
            month: f.month,
            categoryId: f.categoryId,
            itemIndex: f.itemIndex,
            forecast: String(Math.round(Number(f.forecast || 0) * multiplier * 100) / 100),
          });
          copied.operational++;
        }
      }

      if (types.includes("variable")) {
        const source = await storage.getVariableCostForecasts(sourceYear);
        for (const f of source) {
          await storage.upsertVariableCostForecast({
            year: targetYear,
            month: f.month,
            name: f.name,
            forecast: String(Math.round(Number(f.forecast || 0) * multiplier * 100) / 100),
            actual: "0",
          });
          copied.variable++;
        }
      }

      res.json({ success: true, copied });
    } catch (err: any) {
      console.error("Copy forecasts error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // V2 Auto-fill forecasts from historical averages
  app.post("/api/v2/auto-fill-forecasts", isAuthenticated, async (req, res) => {
    try {
      const { targetYear, lookbackYears } = req.body as { targetYear: number; lookbackYears: number };
      if (!targetYear || !lookbackYears) return res.status(400).json({ message: "Nieprawidłowe parametry" });

      const yearsToAverage: number[] = [];
      for (let i = 1; i <= lookbackYears; i++) yearsToAverage.push(targetYear - i);

      const allApartments = await storage.getApartments();
      const allForecasts: any[] = [];
      for (const y of yearsToAverage) {
        allForecasts.push(...await storage.getRevenueForecasts(y));
      }

      const allReservations = await storage.getReservations();
      const proposals: Array<{ apartmentId: number; apartmentName: string; month: number; proposed: number; currentForecast: number; basedOn: string }> = [];

      for (const apt of allApartments) {
        for (let m = 0; m < 12; m++) {
          const historicalValues: number[] = [];
          for (const y of yearsToAverage) {
            let actualRevenue = 0;
            for (const r of allReservations) {
              if (!r.startDate || r.status === "ANULOWANA") continue;
              const d = new Date(r.startDate);
              if (d.getFullYear() !== y || d.getMonth() !== m) continue;
              const aptIds = r.apartmentIds && r.apartmentIds.length > 0 ? r.apartmentIds : (r.apartmentId ? [r.apartmentId] : []);
              if (aptIds.includes(apt.id)) {
                actualRevenue += (Number(r.price) || 0) / Math.max(aptIds.length, 1);
              }
            }
            const fc = allForecasts.find(f => f.year === y && f.month === m && f.apartmentId === apt.id);
            const value = actualRevenue > 0 ? actualRevenue : Number(fc?.forecast || 0);
            if (value > 0) historicalValues.push(value);
          }

          if (historicalValues.length > 0) {
            const avg = Math.round(historicalValues.reduce((s, v) => s + v, 0) / historicalValues.length);
            const existing = await storage.getRevenueForecasts(targetYear);
            const currentFc = existing.find(f => f.apartmentId === apt.id && f.month === m);
            proposals.push({
              apartmentId: apt.id,
              apartmentName: apt.name,
              month: m,
              proposed: avg,
              currentForecast: Number(currentFc?.forecast || 0),
              basedOn: `Średnia z ${historicalValues.length} lat`,
            });
          }
        }
      }

      res.json({ proposals, targetYear, lookbackYears });
    } catch (err: any) {
      console.error("Auto-fill error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // V2 Apply auto-fill proposals
  app.post("/api/v2/apply-auto-fill", isAuthenticated, async (req, res) => {
    try {
      const { targetYear, items } = req.body as {
        targetYear: number;
        items: Array<{ apartmentId: number; month: number; forecast: number }>;
      };
      let applied = 0;
      for (const item of items) {
        await storage.upsertRevenueForecast({
          year: targetYear,
          month: item.month,
          apartmentId: item.apartmentId,
          forecast: String(item.forecast),
        });
        applied++;
      }
      res.json({ success: true, applied });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // V2 Apartment trend data (historical revenue per apartment)
  app.get("/api/v2/apartment-trend/:id", isAuthenticated, async (req, res) => {
    try {
      const aptId = Number(req.params.id);
      const apt = (await storage.getApartments()).find(a => a.id === aptId);
      if (!apt) return res.status(404).json({ message: "Nie znaleziono apartamentu" });

      const currentYear = new Date().getFullYear();
      const yearsRange = [currentYear - 3, currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

      const allReservations = await storage.getReservations();
      const allForecasts = await storage.getRevenueForecasts();
      const allCostForecasts = await storage.getCostForecasts();
      const allSubleases = await storage.getSubleases();
      const subleasePaymentsMap: Record<number, any[]> = {};
      for (const s of allSubleases) {
        subleasePaymentsMap[s.id] = await storage.getSubleasePayments(s.id);
      }

      const yearlyData: Record<number, { months: Record<number, { actual: number; forecast: number; cost: number }>; totalActual: number; totalForecast: number; totalCost: number }> = {};

      for (const y of yearsRange) {
        const months: Record<number, { actual: number; forecast: number; cost: number }> = {};
        let totalActual = 0, totalForecast = 0, totalCost = 0;

        for (let m = 0; m < 12; m++) {
          let actual = 0;
          // Najem (reservations)
          for (const r of allReservations) {
            if (!r.startDate || r.status === "ANULOWANA") continue;
            const d = new Date(r.startDate);
            if (d.getFullYear() !== y || d.getMonth() !== m) continue;
            const aptIds = r.apartmentIds?.length ? r.apartmentIds : (r.apartmentId ? [r.apartmentId] : []);
            if (aptIds.includes(aptId)) {
              actual += (Number(r.price) || 0) / Math.max(aptIds.length, 1);
            }
          }
          // Podnajem (sublease payments)
          for (const s of allSubleases) {
            const payments = subleasePaymentsMap[s.id] || [];
            const subleaseAptIds = s.apartmentIds && s.apartmentIds.length > 0
              ? s.apartmentIds : (s.apartmentId ? [s.apartmentId] : []);
            for (const p of payments) {
              if (!p.dueDate) continue;
              if ((p.category || '').toLowerCase() === 'kaucja') continue;
              const d = new Date(p.dueDate);
              if (d.getFullYear() !== y || d.getMonth() !== m) continue;
              const paymentAptIds = p.apartmentId ? [p.apartmentId] : subleaseAptIds;
              if (paymentAptIds.includes(aptId)) {
                actual += (Number(p.amount) || 0) / Math.max(paymentAptIds.length, 1);
              }
            }
          }
          const fc = allForecasts.find(f => f.year === y && f.month === m && f.apartmentId === aptId);
          const cost = allCostForecasts.filter(f => f.year === y && f.month === m && f.apartmentId === aptId)
            .reduce((s, f) => s + Number(f.forecast || 0), 0);

          months[m] = { actual: Math.round(actual), forecast: Number(fc?.forecast || 0), cost: Math.round(cost) };
          totalActual += actual;
          totalForecast += Number(fc?.forecast || 0);
          totalCost += cost;
        }

        yearlyData[y] = { months, totalActual: Math.round(totalActual), totalForecast: Math.round(totalForecast), totalCost: Math.round(totalCost) };
      }

      res.json({
        apartment: { id: apt.id, name: apt.name, location: apt.location },
        years: yearsRange,
        yearlyData,
      });
    } catch (err: any) {
      console.error("Apartment trend error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // V2 Year comparison
  app.get("/api/v2/year-comparison", isAuthenticated, async (req, res) => {
    try {
      const yearA = Number(req.query.yearA) || new Date().getFullYear() - 1;
      const yearB = Number(req.query.yearB) || new Date().getFullYear();

      const allApartments = await storage.getApartments();
      const allLocations = await storage.getLocations();
      const allReservations = await storage.getReservations();
      const forecastsA = await storage.getRevenueForecasts(yearA);
      const forecastsB = await storage.getRevenueForecasts(yearB);
      const allExpenses = await storage.getExpenses();

      const buildYearData = (year: number, forecasts: any[]) => {
        const monthlyRevenue: number[] = new Array(12).fill(0);
        const monthlyExpenses: number[] = new Array(12).fill(0);
        const monthlyForecast: number[] = new Array(12).fill(0);

        for (const r of allReservations) {
          if (!r.startDate || r.status === "ANULOWANA") continue;
          const d = new Date(r.startDate);
          if (d.getFullYear() !== year) continue;
          monthlyRevenue[d.getMonth()] += Number(r.price || 0);
        }

        for (const e of allExpenses) {
          if (!e.date) continue;
          const d = new Date(e.date);
          if (d.getFullYear() !== year) continue;
          monthlyExpenses[d.getMonth()] += Number(e.amount || 0);
        }

        for (const f of forecasts) {
          monthlyForecast[f.month] += Number(f.forecast || 0);
        }

        return { monthlyRevenue, monthlyExpenses, monthlyForecast };
      };

      const dataA = buildYearData(yearA, forecastsA);
      const dataB = buildYearData(yearB, forecastsB);

      const months = [];
      for (let m = 0; m < 12; m++) {
        months.push({
          month: m,
          revenueA: Math.round(dataA.monthlyRevenue[m]),
          revenueB: Math.round(dataB.monthlyRevenue[m]),
          revenueDiff: Math.round(dataB.monthlyRevenue[m] - dataA.monthlyRevenue[m]),
          revenueDiffPct: dataA.monthlyRevenue[m] > 0
            ? Math.round(((dataB.monthlyRevenue[m] - dataA.monthlyRevenue[m]) / dataA.monthlyRevenue[m]) * 10000) / 100
            : 0,
          expensesA: Math.round(dataA.monthlyExpenses[m]),
          expensesB: Math.round(dataB.monthlyExpenses[m]),
          forecastA: Math.round(dataA.monthlyForecast[m]),
          forecastB: Math.round(dataB.monthlyForecast[m]),
          profitA: Math.round(dataA.monthlyRevenue[m] - dataA.monthlyExpenses[m]),
          profitB: Math.round(dataB.monthlyRevenue[m] - dataB.monthlyExpenses[m]),
        });
      }

      res.json({
        yearA,
        yearB,
        months,
        totals: {
          revenueA: Math.round(dataA.monthlyRevenue.reduce((s, v) => s + v, 0)),
          revenueB: Math.round(dataB.monthlyRevenue.reduce((s, v) => s + v, 0)),
          expensesA: Math.round(dataA.monthlyExpenses.reduce((s, v) => s + v, 0)),
          expensesB: Math.round(dataB.monthlyExpenses.reduce((s, v) => s + v, 0)),
          forecastA: Math.round(dataA.monthlyForecast.reduce((s, v) => s + v, 0)),
          forecastB: Math.round(dataB.monthlyForecast.reduce((s, v) => s + v, 0)),
        },
      });
    } catch (err: any) {
      console.error("Year comparison error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // V2 Financial Forecast - comprehensive endpoint
  const V2_MONTH_NAMES = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];

  app.get("/api/v2/financial-forecast", isAuthenticated, async (req, res) => {
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-indexed

      // Get company balance (saldo firmowe)
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
        if (acc.type === "LOAN") {
          const loansBalance = await storage.getLoansBalance();
          acc.latestBalance = loansBalance.toFixed(2);
          acc.balanceSource = "auto_loans";
        }
      }
      const companyBalance = balance.accounts.reduce((sum, a) => sum + Number(a.latestBalance), 0);

      // Get all revenue forecasts
      const allRevenueForecasts = await storage.getRevenueForecasts();
      // Get all cost forecasts (apartment costs)
      const allCostForecasts = await storage.getCostForecasts();
      // Get all operational cost forecasts
      const allOperationalCosts = await storage.getOperationalCostForecasts();
      // Get all variable cost forecasts
      const allVariableCosts = await storage.getVariableCostForecasts();

      // Get actual revenue from reservations for current year
      const allReservations = await storage.getReservations();
      const allSubleases = await storage.getSubleases();
      const allExpenses = await storage.getExpenses();

      // Build month-by-month data for 5 years (60 months)
      const months: any[] = [];
      let runningBalance = companyBalance;

      for (let i = 0; i < 60; i++) {
        const targetDate = new Date(currentYear, currentMonth + i, 1);
        const year = targetDate.getFullYear();
        const month = targetDate.getMonth(); // 0-indexed
        const monthNum1 = month + 1; // 1-indexed for date strings
        const monthStart = `${year}-${String(monthNum1).padStart(2, '0')}-01`;
        const lastDay = new Date(year, monthNum1, 0).getDate();
        const monthEnd = `${year}-${String(monthNum1).padStart(2, '0')}-${lastDay}`;
        const isPast = year < currentYear || (year === currentYear && month < currentMonth);
        const isCurrent = year === currentYear && month === currentMonth;

        // Revenue forecast for this month
        // Prefer RAZEM (total) records, then sum per-apartment records, then sum per-location records
        const aptRevForecasts = allRevenueForecasts.filter(f => f.year === year && f.month === month && f.apartmentId);
        const razemForecast = allRevenueForecasts.find(f => f.year === year && f.month === month && !f.apartmentId && f.locationName === "RAZEM");
        const locForecasts = allRevenueForecasts.filter(f => f.year === year && f.month === month && !f.apartmentId && f.locationName && f.locationName !== "RAZEM");
        let revenueForecast: number;
        if (aptRevForecasts.length > 0) {
          revenueForecast = aptRevForecasts.reduce((s, f) => s + Number(f.forecast || 0), 0);
        } else if (razemForecast) {
          revenueForecast = Number(razemForecast.forecast || 0);
        } else if (locForecasts.length > 0) {
          revenueForecast = locForecasts.reduce((s, f) => s + Number(f.forecast || 0), 0);
        } else {
          revenueForecast = 0;
        }

        // Actual revenue from reservations
        let actualRevenue = 0;
        let pendingPayments = 0;
        for (const r of allReservations) {
          if (!r.startDate || r.status === "ANULOWANA") continue;
          const d = new Date(r.startDate);
          if (d.getFullYear() === year && d.getMonth() === month) {
            const price = Number(r.price) || 0;
            const paid = Number(r.paidAmount) || 0;
            actualRevenue += paid;
            pendingPayments += Math.max(0, price - paid);
          }
        }

        // Sublease revenue
        let subleaseRevenue = 0;
        for (const s of allSubleases) {
          if (!s.startDate || !s.endDate) continue;
          if (s.startDate <= monthEnd && s.endDate >= monthStart) {
            subleaseRevenue += Number(s.rentAmount || 0);
          }
        }

        // Apartment costs (from cost_forecasts)
        const aptCosts = allCostForecasts.filter(f => f.year === year && f.month === month);
        const apartmentCostForecast = aptCosts.reduce((s, f) => s + Number(f.forecast || 0), 0);

        // Operational costs
        const opCosts = allOperationalCosts.filter(f => f.year === year && f.month === month);
        const operationalCostForecast = opCosts.reduce((s, f) => s + Number(f.forecast || 0), 0);

        // Variable costs
        const varCosts = allVariableCosts.filter(f => f.year === year && f.month === month);
        const variableCostForecast = varCosts.reduce((s, f) => s + Number(f.forecast || 0), 0);

        // Actual expenses
        let actualExpenses = 0;
        for (const e of allExpenses) {
          if (!e.date) continue;
          const d = new Date(e.date);
          if (d.getFullYear() === year && d.getMonth() === month) {
            actualExpenses += Number(e.amount || 0);
          }
        }

        const totalCostForecast = apartmentCostForecast + operationalCostForecast + variableCostForecast;
        const totalRevenueForecast = revenueForecast;

        let monthResult: number;
        if (isCurrent) {
          const unrealizedRevenue = Math.max(0, revenueForecast - actualRevenue - pendingPayments);
          const unrealizedCosts = Math.max(0, totalCostForecast - actualExpenses);
          monthResult = unrealizedRevenue + pendingPayments + subleaseRevenue + actualRevenue - actualExpenses - unrealizedCosts;
          runningBalance = companyBalance;
        } else if (isPast) {
          monthResult = actualRevenue + subleaseRevenue - actualExpenses;
          runningBalance += monthResult;
        } else {
          monthResult = totalRevenueForecast + subleaseRevenue - totalCostForecast;
          runningBalance += monthResult;
        }

        months.push({
          year,
          month,
          monthLabel: V2_MONTH_NAMES[month],
          isPast,
          isCurrent,
          revenueForecast: Math.round(revenueForecast * 100) / 100,
          actualRevenue: Math.round((actualRevenue + pendingPayments) * 100) / 100,
          subleaseRevenue: Math.round(subleaseRevenue * 100) / 100,
          apartmentCostForecast: Math.round(apartmentCostForecast * 100) / 100,
          operationalCostForecast: Math.round(operationalCostForecast * 100) / 100,
          variableCostForecast: Math.round(variableCostForecast * 100) / 100,
          totalCostForecast: Math.round(totalCostForecast * 100) / 100,
          actualExpenses: Math.round(actualExpenses * 100) / 100,
          pendingPayments: Math.round(pendingPayments * 100) / 100,
          monthResult: Math.round(monthResult * 100) / 100,
          cumulativeBalance: Math.round(runningBalance * 100) / 100,
        });
      }

      res.json({
        companyBalance: Math.round(companyBalance * 100) / 100,
        months,
      });
    } catch (err: any) {
      console.error("V2 Financial forecast error:", err);
      res.status(500).json({ message: "Failed to compute financial forecast" });
    }
  });

  // V2 Revenue summary with actuals per apartment per month
  app.get("/api/v2/revenue-summary", isAuthenticated, async (req, res) => {
    try {
      const yearParam = req.query.year ? Number(req.query.year) : new Date().getFullYear();

      const allApartments = await storage.getApartments();
      const allLocations = await storage.getLocations();
      const forecasts = await storage.getRevenueForecasts(yearParam);
      const allReservations = await storage.getReservations();
      const allSubleases = await storage.getSubleases();
      const subleasePaymentsMap: Record<number, any[]> = {};
      for (const s of allSubleases) {
        subleasePaymentsMap[s.id] = await storage.getSubleasePayments(s.id);
      }

      // Compute actuals per apartment per month
      const actuals: Record<number, Record<number, { najem: number; podnajem: number }>> = {};

      for (const r of allReservations) {
        if (!r.startDate || r.status === "ANULOWANA") continue;
        const d = new Date(r.startDate);
        if (d.getFullYear() !== yearParam) continue;
        const month = d.getMonth();
        const price = Number(r.price) || 0;
        const aptIds = r.apartmentIds && r.apartmentIds.length > 0
          ? r.apartmentIds : (r.apartmentId ? [r.apartmentId] : []);
        for (const aptId of aptIds) {
          if (!aptId) continue;
          if (!actuals[aptId]) actuals[aptId] = {};
          if (!actuals[aptId][month]) actuals[aptId][month] = { najem: 0, podnajem: 0 };
          actuals[aptId][month].najem += aptIds.length > 0 ? price / aptIds.length : price;
        }
      }

      // Sublease revenue per apartment per month
      for (const s of allSubleases) {
        if (!s.startDate || !s.endDate) continue;
        const payments = subleasePaymentsMap[s.id] || [];
        const subleaseAptIds = s.apartmentIds && s.apartmentIds.length > 0
          ? s.apartmentIds : (s.apartmentId ? [s.apartmentId] : []);

        for (const p of payments) {
          if (!p.dueDate) continue;
          if ((p.category || '').toLowerCase() === 'kaucja') continue;
          const d = new Date(p.dueDate);
          if (d.getFullYear() !== yearParam) continue;
          const month = d.getMonth();
          const amount = Number(p.amount || 0);
          // If payment has its own apartment_id, use that; otherwise fall back to sublease apartment IDs
          const paymentAptIds = p.apartmentId ? [p.apartmentId] : subleaseAptIds;
          for (const aptId of paymentAptIds) {
            if (!aptId) continue;
            if (!actuals[aptId]) actuals[aptId] = {};
            if (!actuals[aptId][month]) actuals[aptId][month] = { najem: 0, podnajem: 0 };
            actuals[aptId][month].podnajem += paymentAptIds.length > 0 ? amount / paymentAptIds.length : amount;
          }
        }
      }

      // Build location-level forecast lookup (for when per-apartment data is missing)
      const locNameMap: Record<string, string> = { "LUXURO PARK": "PRZEWŁOKA" };
      const locForecastLookup: Record<string, Record<number, number>> = {};
      for (const f of forecasts) {
        if (!f.apartmentId && f.locationName && f.locationName !== "RAZEM") {
          const mappedName = locNameMap[f.locationName] || f.locationName;
          if (!locForecastLookup[mappedName]) locForecastLookup[mappedName] = {};
          locForecastLookup[mappedName][f.month] = Number(f.forecast || 0);
        }
      }

      // Build per-apartment forecast lookup
      const aptForecastLookup: Record<string, number> = {};
      for (const f of forecasts) {
        if (f.apartmentId) {
          aptForecastLookup[`${f.apartmentId}-${f.month}`] = Number(f.forecast || 0);
        }
      }

      // Build response
      const aptData = allApartments.map(apt => {
        const monthlyData: Record<number, { forecast: number; actual: number; najem: number; podnajem: number }> = {};
        const locName = apt.location || "";

        for (let m = 0; m < 12; m++) {
          const aptKey = `${apt.id}-${m}`;
          let forecastVal = 0;
          if (aptKey in aptForecastLookup) {
            forecastVal = aptForecastLookup[aptKey];
          } else if (locName && locForecastLookup[locName]) {
            const locTotal = locForecastLookup[locName][m] || 0;
            const locApts = allApartments.filter(a => a.location === locName);
            forecastVal = locApts.length > 0 ? locTotal / locApts.length : 0;
          }
          const act = actuals[apt.id]?.[m];
          monthlyData[m] = {
            forecast: forecastVal,
            actual: (act?.najem || 0) + (act?.podnajem || 0),
            najem: act?.najem || 0,
            podnajem: act?.podnajem || 0,
          };
        }
        return {
          apartmentId: apt.id,
          apartmentName: apt.name,
          locationId: apt.location ? (allLocations.find(l => l.name === apt.location)?.id || null) : null,
          months: monthlyData,
        };
      });

      const climateFeeSummary: Record<number, { forecast: number; actual: number }> = {};
      for (let m = 0; m < 12; m++) {
        climateFeeSummary[m] = { forecast: 0, actual: 0 };
      }
      for (const f of forecasts) {
        if (f.locationName === "RAZEM" && (f.climateFeeForecast || f.climateFeeActual)) {
          const m = f.month;
          if (m >= 0 && m < 12) {
            climateFeeSummary[m].forecast += Number(f.climateFeeForecast || 0);
            climateFeeSummary[m].actual += Number(f.climateFeeActual || 0);
          }
        }
      }

      res.json({
        year: yearParam,
        locations: allLocations,
        apartments: aptData,
        climateFee: climateFeeSummary,
      });
    } catch (err: any) {
      console.error("V2 Revenue summary error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // V2 Costs summary
  app.get("/api/v2/costs-summary", isAuthenticated, async (req, res) => {
    try {
      const yearParam = req.query.year ? Number(req.query.year) : new Date().getFullYear();

      const allApartments = await storage.getApartments();
      const allLocations = await storage.getLocations();
      const costFcasts = await storage.getCostForecasts(yearParam);
      const opCosts = await storage.getOperationalCostForecasts(yearParam);
      const varCosts = await storage.getVariableCostForecasts(yearParam);
      const allExpenses = await storage.getExpenses();

      // Apartment costs grouped by apartment
      const aptCosts: Record<number, Record<number, number>> = {};
      for (const c of costFcasts) {
        if (!c.apartmentId) continue;
        if (!aptCosts[c.apartmentId]) aptCosts[c.apartmentId] = {};
        aptCosts[c.apartmentId][c.month] = (aptCosts[c.apartmentId][c.month] || 0) + Number(c.forecast || 0);
      }

      // Operational costs grouped by category (separate active vs archived)
      const opCostsByCategory: Record<string, Record<number, number>> = {};
      const archivedOpCostsByCategory: Record<string, Record<number, number>> = {};
      for (const c of opCosts) {
        const target = c.archived ? archivedOpCostsByCategory : opCostsByCategory;
        if (!target[c.categoryId]) target[c.categoryId] = {};
        target[c.categoryId][c.month] = (target[c.categoryId][c.month] || 0) + Number(c.forecast || 0);
      }

      // Variable costs
      const varCostItems: Record<string, Record<number, { forecast: number; actual: number }>> = {};
      for (const v of varCosts) {
        if (!varCostItems[v.name]) varCostItems[v.name] = {};
        varCostItems[v.name][v.month] = {
          forecast: Number(v.forecast || 0),
          actual: Number(v.actual || 0),
        };
      }

      // Actual expenses by month
      const actualByMonth: Record<number, number> = {};
      for (const e of allExpenses) {
        if (!e.date) continue;
        const d = new Date(e.date);
        if (d.getFullYear() !== yearParam) continue;
        const m = d.getMonth();
        actualByMonth[m] = (actualByMonth[m] || 0) + Number(e.amount || 0);
      }

      res.json({
        year: yearParam,
        locations: allLocations,
        apartments: allApartments.map(a => ({ id: a.id, name: a.name, locationId: a.location ? (allLocations.find(l => l.name === a.location)?.id || null) : null })),
        apartmentCosts: aptCosts,
        operationalCosts: opCostsByCategory,
        archivedOperationalCosts: archivedOpCostsByCategory,
        variableCosts: varCostItems,
        actualExpensesByMonth: actualByMonth,
      });
    } catch (err: any) {
      console.error("V2 Costs summary error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // V2 Realization (plan vs actual) - per apartment analysis
  app.get("/api/v2/realization", isAuthenticated, async (req, res) => {
    try {
      const yearParam = req.query.year ? Number(req.query.year) : new Date().getFullYear();

      const allApartments = await storage.getApartments();
      const allLocations = await storage.getLocations();
      const forecasts = await storage.getRevenueForecasts(yearParam);
      const costFcasts = await storage.getCostForecasts(yearParam);
      const opCosts = await storage.getOperationalCostForecasts(yearParam);
      const varCosts = await storage.getVariableCostForecasts(yearParam);
      const allReservations = await storage.getReservations();
      const allExpenses = await storage.getExpenses();

      const now = new Date();
      const currentMonth = now.getFullYear() === yearParam ? now.getMonth() : (yearParam < now.getFullYear() ? 12 : 0);

      // Per-apartment revenue actuals
      const aptRevActuals: Record<number, Record<number, number>> = {};
      for (const r of allReservations) {
        if (!r.startDate || r.status === "ANULOWANA") continue;
        const d = new Date(r.startDate);
        if (d.getFullYear() !== yearParam) continue;
        const month = d.getMonth();
        const price = Number(r.price) || 0;
        const aptIds = r.apartmentIds && r.apartmentIds.length > 0
          ? r.apartmentIds : (r.apartmentId ? [r.apartmentId] : []);
        for (const aptId of aptIds) {
          if (!aptId) continue;
          if (!aptRevActuals[aptId]) aptRevActuals[aptId] = {};
          aptRevActuals[aptId][month] = (aptRevActuals[aptId][month] || 0) + (aptIds.length > 0 ? price / aptIds.length : price);
        }
      }

      // Build per-apartment forecast lookup (same logic as revenue-summary)
      const locNameMap: Record<string, string> = { "LUXURO PARK": "PRZEWŁOKA" };
      const locForecastLookup: Record<string, Record<number, number>> = {};
      for (const f of forecasts) {
        if (!f.apartmentId && f.locationName && f.locationName !== "RAZEM") {
          const mappedName = locNameMap[f.locationName] || f.locationName;
          if (!locForecastLookup[mappedName]) locForecastLookup[mappedName] = {};
          locForecastLookup[mappedName][f.month] = Number(f.forecast || 0);
        }
      }
      const aptForecastLookup: Record<string, number> = {};
      for (const f of forecasts) {
        if (f.apartmentId) {
          aptForecastLookup[`${f.apartmentId}-${f.month}`] = Number(f.forecast || 0);
        }
      }

      // Compute per-apartment forecasts with fallback
      const aptForecastResolved: Record<number, Record<number, number>> = {};
      for (const apt of allApartments) {
        aptForecastResolved[apt.id] = {};
        const locName = apt.location || "";
        for (let m = 0; m < 12; m++) {
          const aptKey = `${apt.id}-${m}`;
          if (aptKey in aptForecastLookup) {
            aptForecastResolved[apt.id][m] = aptForecastLookup[aptKey];
          } else if (locName && locForecastLookup[locName]) {
            const locTotal = locForecastLookup[locName][m] || 0;
            const locApts = allApartments.filter(a => a.location === locName);
            aptForecastResolved[apt.id][m] = locApts.length > 0 ? locTotal / locApts.length : 0;
          } else {
            aptForecastResolved[apt.id][m] = 0;
          }
        }
      }

      // Monthly totals (sum from resolved per-apartment forecasts to avoid double-counting)
      const monthlyData = [];
      for (let m = 0; m < 12; m++) {
        let revFc = 0;
        for (const apt of allApartments) {
          revFc += aptForecastResolved[apt.id]?.[m] || 0;
        }
        const revAct = Object.values(aptRevActuals).reduce((s, aptData) => s + (aptData[m] || 0), 0);
        const costFc = costFcasts.filter(f => f.month === m).reduce((s, f) => s + Number(f.forecast || 0), 0);
        const opFc = opCosts.filter(f => f.month === m).reduce((s, f) => s + Number(f.forecast || 0), 0);
        const varFc = varCosts.filter(f => f.month === m).reduce((s, f) => s + Number(f.forecast || 0), 0);

        let expAct = 0;
        for (const e of allExpenses) {
          if (!e.date) continue;
          const d = new Date(e.date);
          if (d.getFullYear() === yearParam && d.getMonth() === m) {
            expAct += Number(e.amount || 0);
          }
        }

        monthlyData.push({
          month: m,
          revenueForecast: Math.round(revFc * 100) / 100,
          revenueActual: Math.round(revAct * 100) / 100,
          revenueDeviation: Math.round((revAct - revFc) * 100) / 100,
          revenueDeviationPct: revFc > 0 ? Math.round(((revAct - revFc) / revFc) * 10000) / 100 : 0,
          costForecast: Math.round((costFc + opFc + varFc) * 100) / 100,
          costActual: Math.round(expAct * 100) / 100,
          profitForecast: Math.round((revFc - costFc - opFc - varFc) * 100) / 100,
          profitActual: Math.round((revAct - expAct) * 100) / 100,
          isRealized: m < currentMonth,
        });
      }

      // Per-apartment performance (using resolved forecasts with fallback)
      const aptPerformance = allApartments.map(apt => {
        let totalForecast = 0;
        let totalActual = 0;
        for (let m = 0; m < Math.min(currentMonth, 12); m++) {
          totalForecast += aptForecastResolved[apt.id]?.[m] || 0;
          totalActual += aptRevActuals[apt.id]?.[m] || 0;
        }
        const deviation = totalActual - totalForecast;
        const deviationPct = totalForecast > 0 ? (deviation / totalForecast) * 100 : 0;
        return {
          apartmentId: apt.id,
          apartmentName: apt.name,
          locationId: apt.location ? (allLocations.find(l => l.name === apt.location)?.id || null) : null,
          totalForecast: Math.round(totalForecast * 100) / 100,
          totalActual: Math.round(totalActual * 100) / 100,
          deviation: Math.round(deviation * 100) / 100,
          deviationPct: Math.round(deviationPct * 100) / 100,
          status: deviationPct >= 0 ? "above" : deviationPct > -10 ? "close" : "below",
        };
      });

      res.json({
        year: yearParam,
        currentMonth,
        locations: allLocations,
        monthlyData,
        apartmentPerformance: aptPerformance,
      });
    } catch (err: any) {
      console.error("V2 Realization error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // ==================== COST ANALYTICS ====================
  app.get("/api/v2/cost-analytics", isAuthenticated, async (req, res) => {
    try {
      const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
      const prevYear = year - 1;

      const allApartments = await storage.getApartments();
      const allLocations = await storage.getLocations();
      const allExpenses = await storage.getExpenses();
      const allReservations = await storage.getReservations();

      const aptCostDataCurr = await db.select().from(aptCostData).where(eq(aptCostData.year, year));
      const aptCostDataPrev = await db.select().from(aptCostData).where(eq(aptCostData.year, prevYear));
      const opCostDataCurr = await db.select().from(opCostData).where(eq(opCostData.year, year));
      const opCostDataPrev = await db.select().from(opCostData).where(eq(opCostData.year, prevYear));

      const now = new Date();
      const currentMonth = now.getFullYear() === year ? now.getMonth() : (year < now.getFullYear() ? 12 : 0);
      const MONTH_NAMES = ["Sty","Lut","Mar","Kwi","Maj","Cze","Lip","Sie","Wrz","Paź","Lis","Gru"];

      // === Aggregate apt costs (realized + forecast) ===
      const sumAptCosts = (data: typeof aptCostDataCurr, field: "realized" | "prognoza") => {
        const byCategory: Record<string, number> = {};
        const byMonth: Record<number, number> = {};
        const byEntry: Record<string, number> = {};
        let total = 0;
        for (const r of data) {
          const val = Number(r[field] || 0);
          if (val === 0) continue;
          total += val;
          byCategory[r.category] = (byCategory[r.category] || 0) + val;
          byMonth[r.month] = (byMonth[r.month] || 0) + val;
          byEntry[r.entryId] = (byEntry[r.entryId] || 0) + val;
        }
        return { total, byCategory, byMonth, byEntry };
      };

      const sumOpCosts = (data: typeof opCostDataCurr, field: "realized" | "prognoza") => {
        const byCategory: Record<string, number> = {};
        const byMonth: Record<number, number> = {};
        let total = 0;
        for (const r of data) {
          const val = Number(r[field] || 0);
          if (val === 0) continue;
          total += val;
          byCategory[r.catId] = (byCategory[r.catId] || 0) + val;
          byMonth[r.month] = (byMonth[r.month] || 0) + val;
        }
        return { total, byCategory, byMonth };
      };

      const aptRealized = sumAptCosts(aptCostDataCurr, "realized");
      const aptForecast = sumAptCosts(aptCostDataCurr, "prognoza");
      const opRealized = sumOpCosts(opCostDataCurr, "realized");
      const opForecast = sumOpCosts(opCostDataCurr, "prognoza");

      const aptRealizedPrev = sumAptCosts(aptCostDataPrev, "realized");
      const opRealizedPrev = sumOpCosts(opCostDataPrev, "realized");

      const totalRealized = aptRealized.total + opRealized.total;
      const totalForecast = aptForecast.total + opForecast.total;
      const totalRealizedPrev = aptRealizedPrev.total + opRealizedPrev.total;

      // === Expenses (legacy) for vendor analysis ===
      const expensesCurrYear = allExpenses.filter(e => {
        if (!e.date) return false;
        return new Date(e.date).getFullYear() === year;
      });
      const expensesPrevYear = allExpenses.filter(e => {
        if (!e.date) return false;
        return new Date(e.date).getFullYear() === prevYear;
      });

      // Vendor analysis from expenses
      const vendorMap: Record<string, { total: number; count: number; categories: Set<string> }> = {};
      for (const e of expensesCurrYear) {
        const v = e.vendor || "Brak dostawcy";
        if (!vendorMap[v]) vendorMap[v] = { total: 0, count: 0, categories: new Set() };
        vendorMap[v].total += Number(e.amount || 0);
        vendorMap[v].count++;
        if (e.category) vendorMap[v].categories.add(e.category);
      }
      const topVendors = Object.entries(vendorMap)
        .map(([name, d]) => ({ name, total: Math.round(d.total * 100) / 100, count: d.count, categories: Array.from(d.categories) }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 15);

      // === Monthly trends (current + previous year) ===
      const monthlyTrends = [];
      for (let m = 0; m < 12; m++) {
        const aptR = aptRealized.byMonth[m] || 0;
        const opR = opRealized.byMonth[m] || 0;
        const aptF = aptForecast.byMonth[m] || 0;
        const opF = opForecast.byMonth[m] || 0;
        const prevAptR = aptRealizedPrev.byMonth[m] || 0;
        const prevOpR = opRealizedPrev.byMonth[m] || 0;

        monthlyTrends.push({
          month: m,
          monthName: MONTH_NAMES[m],
          realized: Math.round((aptR + opR) * 100) / 100,
          forecast: Math.round((aptF + opF) * 100) / 100,
          aptRealized: Math.round(aptR * 100) / 100,
          opRealized: Math.round(opR * 100) / 100,
          prevYearRealized: Math.round((prevAptR + prevOpR) * 100) / 100,
          deviation: aptF + opF > 0 ? Math.round(((aptR + opR) - (aptF + opF)) / (aptF + opF) * 10000) / 100 : 0,
        });
      }

      // === Category breakdown (merge apt + op) ===
      const allCategories: Record<string, { realized: number; forecast: number; prevRealized: number; type: string }> = {};
      for (const [cat, val] of Object.entries(aptRealized.byCategory)) {
        if (!allCategories[cat]) allCategories[cat] = { realized: 0, forecast: 0, prevRealized: 0, type: "apartment" };
        allCategories[cat].realized += val;
      }
      for (const [cat, val] of Object.entries(aptForecast.byCategory)) {
        if (!allCategories[cat]) allCategories[cat] = { realized: 0, forecast: 0, prevRealized: 0, type: "apartment" };
        allCategories[cat].forecast += val;
      }
      for (const [cat, val] of Object.entries(aptRealizedPrev.byCategory)) {
        if (!allCategories[cat]) allCategories[cat] = { realized: 0, forecast: 0, prevRealized: 0, type: "apartment" };
        allCategories[cat].prevRealized += val;
      }
      for (const [cat, val] of Object.entries(opRealized.byCategory)) {
        if (!allCategories[cat]) allCategories[cat] = { realized: 0, forecast: 0, prevRealized: 0, type: "operational" };
        allCategories[cat].realized += val;
      }
      for (const [cat, val] of Object.entries(opForecast.byCategory)) {
        if (!allCategories[cat]) allCategories[cat] = { realized: 0, forecast: 0, prevRealized: 0, type: "operational" };
        allCategories[cat].forecast += val;
      }
      for (const [cat, val] of Object.entries(opRealizedPrev.byCategory)) {
        if (!allCategories[cat]) allCategories[cat] = { realized: 0, forecast: 0, prevRealized: 0, type: "operational" };
        allCategories[cat].prevRealized += val;
      }
      const categoryBreakdown = Object.entries(allCategories)
        .map(([name, d]) => ({
          name,
          realized: Math.round(d.realized * 100) / 100,
          forecast: Math.round(d.forecast * 100) / 100,
          prevRealized: Math.round(d.prevRealized * 100) / 100,
          type: d.type,
          rrChange: d.prevRealized > 0 ? Math.round((d.realized - d.prevRealized) / d.prevRealized * 10000) / 100 : null,
          budgetUsage: d.forecast > 0 ? Math.round(d.realized / d.forecast * 10000) / 100 : null,
        }))
        .filter(c => c.realized > 0 || c.forecast > 0)
        .sort((a, b) => b.realized - a.realized);

      // === Per-apartment profitability ===
      const aptRevByApt: Record<number, number> = {};
      for (const r of allReservations) {
        if (!r.startDate || r.status === "ANULOWANA") continue;
        const d = new Date(r.startDate);
        if (d.getFullYear() !== year) continue;
        const price = Number(r.price) || 0;
        const aptIds = r.apartmentIds && r.apartmentIds.length > 0
          ? r.apartmentIds : (r.apartmentId ? [r.apartmentId] : []);
        for (const aptId of aptIds) {
          if (!aptId) continue;
          aptRevByApt[aptId] = (aptRevByApt[aptId] || 0) + (aptIds.length > 0 ? price / aptIds.length : price);
        }
      }

      const apartmentProfitability = allApartments.map(apt => {
        const entryId = `apt-${apt.id}`;
        const costs = aptRealized.byEntry[entryId] || 0;
        const revenue = aptRevByApt[apt.id] || 0;
        const profit = revenue - costs;
        const margin = revenue > 0 ? Math.round(profit / revenue * 10000) / 100 : 0;
        return {
          id: apt.id,
          name: apt.name,
          location: apt.location || "",
          revenue: Math.round(revenue * 100) / 100,
          costs: Math.round(costs * 100) / 100,
          profit: Math.round(profit * 100) / 100,
          margin,
        };
      }).filter(a => a.revenue > 0 || a.costs > 0)
        .sort((a, b) => b.profit - a.profit);

      // === Per-location margins ===
      const locationMap: Record<string, { revenue: number; costs: number }> = {};
      for (const apt of apartmentProfitability) {
        const loc = apt.location || "Inne";
        if (!locationMap[loc]) locationMap[loc] = { revenue: 0, costs: 0 };
        locationMap[loc].revenue += apt.revenue;
        locationMap[loc].costs += apt.costs;
      }
      const locationMargins = Object.entries(locationMap).map(([name, d]) => ({
        name,
        revenue: Math.round(d.revenue * 100) / 100,
        costs: Math.round(d.costs * 100) / 100,
        profit: Math.round((d.revenue - d.costs) * 100) / 100,
        margin: d.revenue > 0 ? Math.round((d.revenue - d.costs) / d.revenue * 10000) / 100 : 0,
      })).sort((a, b) => b.profit - a.profit);

      // === Budget alerts ===
      const budgetAlerts = categoryBreakdown
        .filter(c => c.budgetUsage !== null && c.budgetUsage > 90)
        .map(c => ({
          category: c.name,
          budgetUsage: c.budgetUsage!,
          realized: c.realized,
          forecast: c.forecast,
          overspend: Math.round((c.realized - c.forecast) * 100) / 100,
          severity: c.budgetUsage! > 110 ? "critical" : c.budgetUsage! > 100 ? "warning" : "info",
        }))
        .sort((a, b) => b.budgetUsage - a.budgetUsage);

      // === KPI summary ===
      const aptCount = allApartments.length;
      const costPerApartment = aptCount > 0 ? Math.round(totalRealized / aptCount * 100) / 100 : 0;
      const totalRevenue = Object.values(aptRevByApt).reduce((s, v) => s + v, 0);
      const operatingMargin = totalRevenue > 0 ? Math.round((totalRevenue - totalRealized) / totalRevenue * 10000) / 100 : 0;

      // Fixed vs variable from expenses
      const fixedTotal = expensesCurrYear.filter(e => e.type === "FIXED").reduce((s, e) => s + Number(e.amount || 0), 0);
      const variableTotal = expensesCurrYear.filter(e => e.type === "VARIABLE").reduce((s, e) => s + Number(e.amount || 0), 0);

      res.json({
        year,
        currentMonth,
        kpi: {
          totalRealized: Math.round(totalRealized * 100) / 100,
          totalForecast: Math.round(totalForecast * 100) / 100,
          totalRealizedPrevYear: Math.round(totalRealizedPrev * 100) / 100,
          rrChange: totalRealizedPrev > 0 ? Math.round((totalRealized - totalRealizedPrev) / totalRealizedPrev * 10000) / 100 : null,
          budgetDeviation: totalForecast > 0 ? Math.round((totalRealized - totalForecast) / totalForecast * 10000) / 100 : 0,
          costPerApartment,
          aptCostsTotal: Math.round(aptRealized.total * 100) / 100,
          opCostsTotal: Math.round(opRealized.total * 100) / 100,
          fixedCosts: Math.round(fixedTotal * 100) / 100,
          variableCosts: Math.round(variableTotal * 100) / 100,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          operatingMargin,
          apartmentCount: aptCount,
        },
        monthlyTrends,
        categoryBreakdown,
        topVendors,
        apartmentProfitability,
        locationMargins,
        budgetAlerts,
      });
    } catch (err: any) {
      console.error("Cost analytics error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // ==================== APT COST DATA ====================
  app.get('/api/apt-cost-data', isAuthenticated, async (req, res) => {
    try {
      const year = Number(req.query.year) || new Date().getFullYear();
      const data = await storage.getAptCostData(year);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/apt-cost-data/export-excel', isAuthenticated, async (req, res) => {
    try {
      const year = Number(req.query.year) || new Date().getFullYear();
      const filterEntryId = req.query.entryId as string | undefined;
      const allCostRows = await storage.getAptCostData(year);
      const costRows = filterEntryId ? allCostRows.filter(r => r.entryId === filterEntryId) : allCostRows;
      const settings = await storage.getAptCostSettings();
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(`Koszty ${year}`);
      const MONTHS = ["Sty","Lut","Mar","Kwi","Maj","Cze","Lip","Sie","Wrz","Paź","Lis","Gru"];
      const entryIds = [...new Set(costRows.map(r => r.entryId))];
      const settingsMap: Record<string, { categories?: string[]; colors?: Record<string, string>; entryColor?: string }> = {};
      for (const s of settings) settingsMap[s.entryId] = s;
      for (const entryId of entryIds) {
        const cats = settingsMap[entryId]?.categories as string[] || [...new Set(costRows.filter(r => r.entryId === entryId).map(r => r.category))];
        const headerRow = ws.addRow([entryId, ...cats.flatMap(c => [`${c} P`, `${c} R`, `${c} S`])]);
        headerRow.font = { bold: true };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
        for (let m = 0; m < 12; m++) {
          const vals: (string | number)[] = [MONTHS[m]];
          for (const cat of cats) {
            const row = costRows.find(r => r.entryId === entryId && r.category === cat && r.month === m);
            const p = parseFloat(row?.prognoza ?? '0');
            const r2 = parseFloat(row?.realized ?? '0');
            vals.push(p, r2, p - r2);
          }
          ws.addRow(vals);
        }
        ws.addRow([]);
      }
      ws.columns.forEach(col => { col.width = 14; });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=koszty_apartamentow_${year}.xlsx`);
      await wb.xlsx.write(res);
      res.end();
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/apt-cost-data/:year', isAuthenticated, async (req, res) => {
    try {
      const year = Number(req.params.year) || new Date().getFullYear();
      const data = await storage.getAptCostData(year);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/apt-cost-data/bulk', isAuthenticated, async (req, res) => {
    try {
      const { cells } = req.body;
      if (!Array.isArray(cells) || cells.length === 0) return res.status(400).json({ message: 'Brak komórek' });
      if (cells.length > 2000) return res.status(400).json({ message: 'Za dużo komórek (max 2000)' });
      await storage.upsertAptCostCells(cells);
      res.json({ updated: cells.length });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete('/api/apt-cost-data', isAuthenticated, async (req, res) => {
    try {
      const year = Number(req.query.year);
      if (!year) return res.status(400).json({ message: 'year wymagany' });
      const entryId = req.query.entryId as string | undefined;
      await storage.clearAptCostData(year, entryId);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/apt-cost-data/seed', isAuthenticated, async (_req, res) => {
    try {
      const existing = await storage.getAptCostData(2024);
      if (existing.length > 0) {
        return res.json({ seeded: 0, skipped: true, message: 'Baza danych już zawiera dane (seed pominięty)' });
      }
      const filePath = path.join(process.cwd(), 'attached_assets', 'APARTAMENTY_1771982164657.xlsx');
      if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Plik Excel nie znaleziony' });
      const fileBuffer = fs.readFileSync(filePath);
      const workbook = XLSX.read(fileBuffer);
      const ws = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      const APARTMENT_MAP = [
        { colStart: 6,   entryId: 'gb-all',  categories: ['RATA DLA WŁAŚCICIELA', 'GAZ - PGNiG', 'ENERGIA - ENERGA', 'WODOCIĄGI', 'WYWÓZ ŚMIECI - ZGK'] },
        { colStart: 39,  entryId: 'apt-168', categories: ['RATA DLA WŁAŚCICIELA', 'CZYNSZ DO WSPÓLNOTY', 'ROZLICZENIE ROCZNE', 'ENERGIA - ENERGA'] },
        { colStart: 54,  entryId: 'apt-134', categories: ['RATA DLA WŁAŚCICIELA', 'CZYNSZ DO WSPÓLNOTY', 'ROZLICZENIE ROCZNE', 'ENERGIA - ENERGA'] },
        { colStart: 84,  entryId: 'apt-167', categories: ['RATA DLA WŁAŚCICIELA', 'CZYNSZ DO WSPÓLNOTY', 'ROZLICZENIE ROCZNE', 'ENERGIA - ENERGA'] },
        { colStart: 99,  entryId: 'apt-142', categories: ['RATA DLA WŁAŚCICIELA', 'CZYNSZ DO WSPÓLNOTY', 'ROZLICZENIE ROCZNE', 'ENERGIA - ENERGA'] },
        { colStart: 114, entryId: 'apt-184', categories: ['RATA DLA WŁAŚCICIELA', 'CZYNSZ DO WSPÓLNOTY', 'ROZLICZENIE ROCZNE', 'ENERGIA - ENERGA'] },
        { colStart: 129, entryId: 'apt-145', categories: ['RATA DLA WŁAŚCICIELA', 'CZYNSZ DO WSPÓLNOTY', 'ROZLICZENIE ROCZNE', 'ENERGIA - ENERGA'] },
        { colStart: 144, entryId: 'apt-131', categories: ['RATA DLA WŁAŚCICIELA', 'CZYNSZ DO WSPÓLNOTY', 'ROZLICZENIE ROCZNE', 'ENERGIA - ENERGA'] },
        { colStart: 159, entryId: 'apt-166', categories: ['RATA DLA WŁAŚCICIELA', 'CZYNSZ DO WSPÓLNOTY', 'ROZLICZENIE ROCZNE', 'ENERGIA - ENERGA'] },
        { colStart: 174, entryId: 'apt-152', categories: ['RATA DLA WŁAŚCICIELA', 'CZYNSZ DO WSPÓLNOTY', 'ROZLICZENIE ROCZNE', 'ENERGIA - ENERGA'] },
        { colStart: 189, entryId: 'apt-151', categories: ['RATA DLA WŁAŚCICIELA', 'CZYNSZ DO WSPÓLNOTY', 'ROZLICZENIE ROCZNE', 'ENERGIA - ENERGA'] },
        { colStart: 204, entryId: 'apt-155', categories: ['RATA DLA WŁAŚCICIELA', 'CZYNSZ DO WSPÓLNOTY', 'ROZLICZENIE ROCZNE', 'ENERGIA - ENERGA'] },
        { colStart: 219, entryId: 'apt-129', categories: ['RATA DLA WŁAŚCICIELA', 'CZYNSZ DO WSPÓLNOTY', 'ROZLICZENIE ROCZNE', 'ENERGIA - ENERGA'] },
        { colStart: 234, entryId: 'apt-136', categories: ['RATA DLA WŁAŚCICIELA', 'CZYNSZ DO WSPÓLNOTY', 'ROZLICZENIE ROCZNE', 'ENERGIA - ENERGA'] },
        { colStart: 249, entryId: 'apt-159', categories: ['RATA DLA WŁAŚCICIELA', 'CZYNSZ DO WSPÓLNOTY', 'ROZLICZENIE ROCZNE', 'ENERGIA - ENERGA'] },
        { colStart: 324, entryId: 'apt-170', categories: ['RATA DLA WŁAŚCICIELA', 'CZYNSZ DO WSPÓLNOTY', 'ROZLICZENIE ROCZNE', 'ENERGIA - ENERGA'] },
        { colStart: 339, entryId: 'apt-156', categories: ['RATA DLA WŁAŚCICIELA', 'CZYNSZ DO WSPÓLNOTY', 'ROZLICZENIE ROCZNE', 'ENERGIA - ENERGA'] },
        { colStart: 354, entryId: 'apt-144', categories: ['RATA DLA WŁAŚCICIELA', 'CZYNSZ DO WSPÓLNOTY', 'ROZLICZENIE ROCZNE', 'ENERGIA - ENERGA'] },
        { colStart: 369, entryId: 'apt-132', categories: ['RATA DLA WŁAŚCICIELA', 'CZYNSZ DO WSPÓLNOTY', 'ROZLICZENIE ROCZNE', 'ENERGIA - ENERGA'] },
        { colStart: 384, entryId: 'apt-163', categories: ['RATA DLA WŁAŚCICIELA', 'CZYNSZ DO WSPÓLNOTY', 'ROZLICZENIE ROCZNE', 'ENERGIA - ENERGA'] },
        { colStart: 399, entryId: 'apt-139', categories: ['RATA DLA WŁAŚCICIELA', 'CZYNSZ DO WSPÓLNOTY', 'ROZLICZENIE ROCZNE', 'ENERGIA - ENERGA'] },
        { colStart: 414, entryId: 'apt-177', categories: ['RATA DLA WŁAŚCICIELA', 'CZYNSZ DO WSPÓLNOTY', 'ROZLICZENIE ROCZNE', 'ENERGIA - ENERGA'] },
        { colStart: 429, entryId: 'apt-173', categories: ['RATA DLA WŁAŚCICIELA', 'CZYNSZ DO WSPÓLNOTY', 'ROZLICZENIE ROCZNE', 'ENERGIA - ENERGA'] },
        { colStart: 444, entryId: 'apt-165', categories: ['RATA DLA WŁAŚCICIELA', 'CZYNSZ DO WSPÓLNOTY', 'ROZLICZENIE ROCZNE', 'ENERGIA - ENERGA'] },
        { colStart: 504, entryId: 'apt-176', categories: ['RATA DLA WŁAŚCICIELA', 'CZYNSZ DO WSPÓLNOTY', 'ROZLICZENIE ROCZNE', 'ENERGIA - ENERGA'] },
        { colStart: 519, entryId: 'apt-181', categories: ['RATA DLA WŁAŚCICIELA', 'CZYNSZ DO WSPÓLNOTY', 'ROZLICZENIE ROCZNE', 'ENERGIA - ENERGA'] },
        { colStart: 534, entryId: 'apt-172', categories: ['RATA DLA WŁAŚCICIELA', 'CZYNSZ DO WSPÓLNOTY', 'ROZLICZENIE ROCZNE', 'ENERGIA - ENERGA'] },
        { colStart: 549, entryId: 'apt-135', categories: ['RATA DLA WŁAŚCICIELA', 'CZYNSZ DO WSPÓLNOTY', 'ROZLICZENIE ROCZNE', 'ENERGIA - ENERGA'] },
        { colStart: 579, entryId: 'apt-162', categories: ['RATA DLA WŁAŚCICIELA', 'CZYNSZ DO WSPÓLNOTY', 'ROZLICZENIE ROCZNE', 'ENERGIA - ENERGA'] },
        { colStart: 639, entryId: 'apt-179', categories: ['RATA DLA WŁAŚCICIELA', 'CZYNSZ DO WSPÓLNOTY', 'ROZLICZENIE ROCZNE', 'ENERGIA - ENERGA'] },
        { colStart: 654, entryId: 'apt-182', categories: ['RATA DLA WŁAŚCICIELA', 'CZYNSZ DO WSPÓLNOTY', 'ROZLICZENIE ROCZNE', 'ENERGIA - ENERGA'] },
        { colStart: 669, entryId: 'apt-150', categories: ['RATA DLA WŁAŚCICIELA', 'CZYNSZ DO WSPÓLNOTY', 'ROZLICZENIE ROCZNE', 'ENERGIA - ENERGA'] },
      ];
      const allCells: any[] = [];
      for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
        const row = rows[rowIdx];
        if (row[1] === 'PROGNOZA' && typeof row[4] === 'number' && row[4] >= 2020) {
          const year = row[4] as number;
          for (let monthOffset = 0; monthOffset < 12; monthOffset++) {
            const monthRow = rows[rowIdx + monthOffset];
            if (!monthRow) continue;
            for (const apt of APARTMENT_MAP) {
              for (let catIdx = 0; catIdx < apt.categories.length; catIdx++) {
                const cat = apt.categories[catIdx];
                const colBase = apt.colStart + catIdx * 3;
                const pVal = typeof monthRow[colBase] === 'number' ? monthRow[colBase] : 0;
                const rVal = typeof monthRow[colBase + 1] === 'number' ? monthRow[colBase + 1] : 0;
                if (pVal !== 0 || rVal !== 0) {
                  allCells.push({ year, entryId: apt.entryId, category: cat, month: monthOffset, prognoza: String(pVal), realized: String(rVal) });
                }
              }
            }
          }
        }
      }
      await storage.upsertAptCostCells(allCells);
      res.json({ seeded: allCells.length, skipped: false });
    } catch (err: any) {
      res.status(500).json({ message: 'Błąd seedowania: ' + err.message });
    }
  });

  app.get('/api/apt-cost-settings', isAuthenticated, async (_req, res) => {
    try {
      const data = await storage.getAptCostSettings();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/apt-cost-settings/:entryId', isAuthenticated, async (req, res) => {
    try {
      const { entryId } = req.params;
      const { categories, colors, entryColor, sortOrder } = req.body;
      const result = await storage.upsertAptCostSettings(entryId, { categories, colors, entryColor, sortOrder });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ==================== OP COST DATA ====================
  app.get('/api/op-cost-data', isAuthenticated, async (req, res) => {
    try {
      const year = Number(req.query.year) || new Date().getFullYear();
      const data = await storage.getOpCostData(year);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/op-cost-data/:year', isAuthenticated, async (req, res) => {
    try {
      const year = Number(req.params.year) || new Date().getFullYear();
      const data = await storage.getOpCostData(year);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/op-cost-data/bulk', isAuthenticated, async (req, res) => {
    try {
      const { cells } = req.body;
      if (!Array.isArray(cells) || cells.length === 0) return res.status(400).json({ message: 'Brak komórek' });
      if (cells.length > 2000) return res.status(400).json({ message: 'Za dużo komórek (max 2000)' });
      await storage.upsertOpCostCells(cells);
      res.json({ updated: cells.length });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete('/api/op-cost-data/item/:catId/:itemIdx', isAuthenticated, async (req, res) => {
    try {
      const { catId, itemIdx } = req.params;
      await storage.deleteOpCostItem(catId, Number(itemIdx));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/op-cost-data/reindex', isAuthenticated, async (req, res) => {
    try {
      const { catId, oldToNew } = req.body;
      if (!catId || !oldToNew) return res.status(400).json({ message: 'Brak catId lub oldToNew' });
      await storage.reindexOpCostItems(catId, oldToNew);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ==================== OP COST CATEGORIES ====================
  app.get('/api/op-cost-categories', isAuthenticated, async (_req, res) => {
    try {
      const raw = await storage.getAppConfig('op-cost-categories');
      res.json(raw ? JSON.parse(raw) : []);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put('/api/op-cost-categories', isAuthenticated, async (req, res) => {
    try {
      await storage.setAppConfig('op-cost-categories', JSON.stringify(req.body));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ==================== TERMINARZ COLORS ====================
  app.get('/api/terminarz-colors', isAuthenticated, async (_req, res) => {
    try {
      const raw = await storage.getAppConfig('terminarz-colors');
      res.json(raw ? JSON.parse(raw) : {});
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put('/api/terminarz-colors', isAuthenticated, async (req, res) => {
    try {
      await storage.setAppConfig('terminarz-colors', JSON.stringify(req.body));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });


  // ==================== SALDO FIRMOWE - BALANCE FORECAST ====================
  app.get('/api/balance-forecast', isAuthenticated, async (req, res) => {
    try {
      const today = new Date();
      today.setDate(1);
      const currentYear = today.getFullYear();
      const fetchStartYear = currentYear;
      const fetchEndYear = currentYear + 5;

      const companyBalance = await storage.getCompanyBalance();
      const saldoPersonMap: Record<string, string> = {
        "Saldo - M. Latasiewicz": "Małgorzata Latasiewicz",
        "Saldo - J. Głodkowska": "Jolanta Głodkowska",
        "Saldo - M. Cieślak": "Mateusz Cieślak",
      };
      for (const acc of companyBalance.accounts) {
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
        if (acc.type === "LOAN") {
          const loansBalance = await storage.getLoansBalance();
          acc.latestBalance = loansBalance.toFixed(2);
          acc.balanceSource = "auto_loans";
        }
      }
      const currentBalance = companyBalance.accounts.reduce((sum, a) => sum + Number(a.latestBalance), 0);

      const revForecastRows = await db.select({
        year: revenueForecasts.year,
        month: revenueForecasts.month,
        forecast: revenueForecasts.forecast,
        apartmentId: revenueForecasts.apartmentId,
        locationName: revenueForecasts.locationName,
      }).from(revenueForecasts).where(
        and(gte(revenueForecasts.year, fetchStartYear - 1), lte(revenueForecasts.year, fetchEndYear))
      );
      const revForecastMap: Record<number, Record<number, number>> = {};
      const revForecastAptMap: Record<number, Record<number, number>> = {};
      const revForecastRazemMap: Record<number, Record<number, number>> = {};
      for (const row of revForecastRows) {
        const val = Number(row.forecast || 0);
        if (row.apartmentId) {
          if (!revForecastAptMap[row.year]) revForecastAptMap[row.year] = {};
          revForecastAptMap[row.year][row.month] = (revForecastAptMap[row.year][row.month] || 0) + val;
        } else if (row.locationName === "RAZEM") {
          if (!revForecastRazemMap[row.year]) revForecastRazemMap[row.year] = {};
          revForecastRazemMap[row.year][row.month] = (revForecastRazemMap[row.year][row.month] || 0) + val;
        }
      }
      for (let y = fetchStartYear - 1; y <= fetchEndYear; y++) {
        const hasApt = revForecastAptMap[y] && Object.keys(revForecastAptMap[y]).length > 0;
        const source = hasApt ? revForecastAptMap[y] : (revForecastRazemMap[y] || {});
        if (Object.keys(source).length > 0) {
          revForecastMap[y] = { ...source };
        }
      }

      const futureLimit = `${fetchEndYear}-12-31`;
      const pastLimit = `${fetchStartYear - 1}-01-01`;
      const activeReservations = await db.select({
        startDate: reservations.startDate,
        price: reservations.price,
        paidAmount: reservations.paidAmount,
      }).from(reservations).where(
        and(
          sql`${reservations.status} != 'ANULOWANA'`,
          gte(reservations.startDate, pastLimit),
          lte(reservations.startDate, futureLimit),
        )
      );

      const revActualMap: Record<number, Record<number, number>> = {};
      const surchargeMap: Record<number, Record<number, number>> = {};
      for (const r of activeReservations) {
        const d = new Date(r.startDate);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const price = Number(r.price || 0);
        const paid = Number(r.paidAmount || 0);
        const surcharge = Math.max(0, price - paid);
        if (!revActualMap[y]) revActualMap[y] = {};
        revActualMap[y][m] = (revActualMap[y][m] || 0) + price;
        if (!surchargeMap[y]) surchargeMap[y] = {};
        surchargeMap[y][m] = (surchargeMap[y][m] || 0) + surcharge;
      }

      const allSubleasesList = await db.select().from(subleasePayments).where(
        and(
          sql`lower(${subleasePayments.category}) != 'kaucja'`,
          gte(subleasePayments.dueDate, pastLimit),
          lte(subleasePayments.dueDate, futureLimit),
        )
      );
      for (const sp of allSubleasesList) {
        const d = new Date(sp.dueDate);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const amt = Number(sp.amount || 0);
        if (!revActualMap[y]) revActualMap[y] = {};
        revActualMap[y][m] = (revActualMap[y][m] || 0) + amt;
        if (sp.status === 'do_oplacenia') {
          if (!surchargeMap[y]) surchargeMap[y] = {};
          surchargeMap[y][m] = (surchargeMap[y][m] || 0) + amt;
        }
      }

      const allExtraRevenues = await db.select().from(extraRevenues).where(
        and(
          gte(extraRevenues.date, pastLimit),
          lte(extraRevenues.date, futureLimit),
        )
      );
      for (const er of allExtraRevenues) {
        const d = new Date(er.date);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const amt = Number(er.amount || 0);
        if (er.status === 'zrealizowany') {
          if (!revActualMap[y]) revActualMap[y] = {};
          revActualMap[y][m] = (revActualMap[y][m] || 0) + amt;
        } else {
          if (!revForecastMap[y]) revForecastMap[y] = {};
          const rfMonth = d.getMonth();
          revForecastMap[y][rfMonth] = (revForecastMap[y][rfMonth] || 0) + amt;
        }
      }

      const aptCostRows = await db.select({
        year: aptCostData.year,
        month: aptCostData.month,
        prognoza: aptCostData.prognoza,
        realized: aptCostData.realized,
      }).from(aptCostData).where(
        and(gte(aptCostData.year, fetchStartYear - 1), lte(aptCostData.year, fetchEndYear))
      );
      const aptForecastMap: Record<number, Record<number, number>> = {};
      const aptActualMap: Record<number, Record<number, number>> = {};
      for (const row of aptCostRows) {
        if (!aptForecastMap[row.year]) aptForecastMap[row.year] = {};
        if (!aptActualMap[row.year]) aptActualMap[row.year] = {};
        aptForecastMap[row.year][row.month] = (aptForecastMap[row.year][row.month] || 0) + Number(row.prognoza || 0);
        aptActualMap[row.year][row.month] = (aptActualMap[row.year][row.month] || 0) + Number(row.realized || 0);
      }

      const opForecastMap: Record<number, Record<number, number>> = {};
      const opActualMap: Record<number, Record<number, number>> = {};

      const opCategoriesRow = await db.select({ value: appConfig.value }).from(appConfig).where(eq(appConfig.key, 'op-cost-categories')).limit(1);
      let opCategories: Array<{ id: string; items: Array<{ archived?: boolean }>; archived?: boolean }> = [];
      if (opCategoriesRow.length > 0) {
        try { opCategories = JSON.parse(opCategoriesRow[0].value); } catch {}
      }

      const opCostRows = await db.select({
        year: opCostData.year,
        catId: opCostData.catId,
        itemIdx: opCostData.itemIdx,
        month: opCostData.month,
        prognoza: opCostData.prognoza,
        realized: opCostData.realized,
      }).from(opCostData).where(
        and(gte(opCostData.year, fetchStartYear - 1), lte(opCostData.year, fetchEndYear))
      );
      const opCellData: Record<string, number> = {};
      for (const row of opCostRows) {
        const pKey = `${row.year}__${row.catId}__${row.itemIdx}__${row.month}__p`;
        const rKey = `${row.year}__${row.catId}__${row.itemIdx}__${row.month}__r`;
        opCellData[pKey] = (opCellData[pKey] || 0) + Number(row.prognoza || 0);
        opCellData[rKey] = (opCellData[rKey] || 0) + Number(row.realized || 0);
      }

      const opServerForecasts = await db.select({
        year: operationalCostForecasts.year,
        categoryId: operationalCostForecasts.categoryId,
        itemIndex: operationalCostForecasts.itemIndex,
        month: operationalCostForecasts.month,
        forecast: operationalCostForecasts.forecast,
      }).from(operationalCostForecasts).where(
        and(gte(operationalCostForecasts.year, fetchStartYear - 1), lte(operationalCostForecasts.year, fetchEndYear))
      );
      const opServerForecastLookup: Record<string, number> = {};
      for (const f of opServerForecasts) {
        const key = `${f.year}__${f.categoryId}__${f.itemIndex}__${f.month}__p`;
        opServerForecastLookup[key] = Number(f.forecast || 0);
      }

      const allCostSchedulesForOp = await db.select().from(costSchedules).where(eq(costSchedules.active, true));
      const allCostSchedulePaymentsForOp = await db.select().from(costSchedulePayments);
      const opScheduleOverlay: Record<string, number> = {};
      const paymentsByScheduleOp: Record<number, typeof allCostSchedulePaymentsForOp> = {};
      for (const p of allCostSchedulePaymentsForOp) {
        if (!paymentsByScheduleOp[p.scheduleId]) paymentsByScheduleOp[p.scheduleId] = [];
        paymentsByScheduleOp[p.scheduleId].push(p);
      }
      for (const schedule of allCostSchedulesForOp) {
        if (!schedule.linkCategoryId || schedule.linkItemIndex === null || schedule.linkItemIndex === undefined) continue;
        const catId = schedule.linkCategoryId;
        const itemIdx = schedule.linkItemIndex;
        const schPayments = paymentsByScheduleOp[schedule.id] || [];
        for (const p of schPayments) {
          const dd = new Date(p.dueDate);
          const y = dd.getFullYear();
          const m = dd.getMonth();
          if (y < fetchStartYear - 1 || y > fetchEndYear) continue;
          const amt = parseFloat(p.amount || "0");
          const forecast = p.forecastAmount ? parseFloat(p.forecastAmount) : amt;
          const pKey = `${y}__${catId}__${itemIdx}__${m}__p`;
          const rKey = `${y}__${catId}__${itemIdx}__${m}__r`;
          if (!isNaN(forecast) && forecast !== 0) opScheduleOverlay[pKey] = (opScheduleOverlay[pKey] || 0) + (isNaN(forecast) ? amt : forecast);
          if (p.status === "OPLACONE" && amt !== 0) opScheduleOverlay[rKey] = (opScheduleOverlay[rKey] || 0) + amt;
        }
      }

      if (opCategories.length > 0) {
        for (let y = fetchStartYear - 1; y <= fetchEndYear; y++) {
          opForecastMap[y] = {};
          opActualMap[y] = {};
          for (const cat of opCategories) {
            if (cat.archived) continue;
            for (let itemIdx = 0; itemIdx < cat.items.length; itemIdx++) {
              if (cat.items[itemIdx].archived) continue;
              for (let m = 0; m < 12; m++) {
                const cellKey = `${y}__${cat.id}__${itemIdx}__${m}`;
                let prognoza = 0;
                if (`${cellKey}__p` in opServerForecastLookup) {
                  prognoza = opServerForecastLookup[`${cellKey}__p`];
                } else if (`${cellKey}__p` in opScheduleOverlay) {
                  prognoza = opScheduleOverlay[`${cellKey}__p`];
                } else if (`${cellKey}__p` in opCellData) {
                  prognoza = opCellData[`${cellKey}__p`];
                }

                let realized = 0;
                if (`${cellKey}__r` in opScheduleOverlay) {
                  realized = opScheduleOverlay[`${cellKey}__r`];
                } else if (`${cellKey}__r` in opCellData) {
                  realized = opCellData[`${cellKey}__r`];
                }

                opForecastMap[y][m] = (opForecastMap[y][m] || 0) + prognoza;
                opActualMap[y][m] = (opActualMap[y][m] || 0) + realized;
              }
            }
          }
        }
      } else {
        for (const row of opCostRows) {
          if (!opForecastMap[row.year]) opForecastMap[row.year] = {};
          if (!opActualMap[row.year]) opActualMap[row.year] = {};
          opForecastMap[row.year][row.month] = (opForecastMap[row.year][row.month] || 0) + Number(row.prognoza || 0);
          opActualMap[row.year][row.month] = (opActualMap[row.year][row.month] || 0) + Number(row.realized || 0);
        }
        for (const f of opServerForecasts) {
          const y = f.year;
          const m = f.month;
          if (!opForecastMap[y]) opForecastMap[y] = {};
          opForecastMap[y][m] = (opForecastMap[y][m] || 0) + Number(f.forecast || 0);
        }
      }

      function getVal(map: Record<number, Record<number, number>>, year: number, month: number): number {
        for (let y = year; y >= year - 4; y--) {
          const v = map[y]?.[month];
          if (v !== undefined && v > 0) return v;
        }
        return 0;
      }

      let runningBalance = Math.round(currentBalance * 100) / 100;
      const months: any[] = [];
      for (let i = 0; i < 60; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const year = d.getFullYear();
        const calMonth = d.getMonth() + 1;
        const rfMonth = d.getMonth();

        const revForecast = getVal(revForecastMap, year, rfMonth);
        const revActual = revActualMap[year]?.[calMonth] ?? 0;
        const revenueRemaining = Math.max(0, revForecast - revActual);

        const aptCostForecast = getVal(aptForecastMap, year, rfMonth);
        const aptCostActual = aptActualMap[year]?.[rfMonth] ?? 0;
        const aptCostRemaining = Math.max(0, aptCostForecast - aptCostActual);

        const opCostForecast = getVal(opForecastMap, year, rfMonth);
        const opCostActual = opActualMap[year]?.[rfMonth] ?? 0;
        const opCostRemaining = Math.max(0, opCostForecast - opCostActual);

        const surcharges = surchargeMap[year]?.[calMonth] ?? 0;

        const endBalance = Math.round((runningBalance + revenueRemaining + surcharges - aptCostRemaining - opCostRemaining) * 100) / 100;

        months.push({
          year,
          month: calMonth,
          revenueForecast: Math.round(revForecast * 100) / 100,
          revenueActual: Math.round(revActual * 100) / 100,
          revenueRemaining: Math.round(revenueRemaining * 100) / 100,
          aptCostForecast: Math.round(aptCostForecast * 100) / 100,
          aptCostActual: Math.round(aptCostActual * 100) / 100,
          aptCostRemaining: Math.round(aptCostRemaining * 100) / 100,
          opCostForecast: Math.round(opCostForecast * 100) / 100,
          opCostActual: Math.round(opCostActual * 100) / 100,
          opCostRemaining: Math.round(opCostRemaining * 100) / 100,
          surcharges: Math.round(surcharges * 100) / 100,
          endBalance,
        });

        runningBalance = endBalance;
      }

      res.json({
        currentBalance: Math.round(currentBalance * 100) / 100,
        months,
      });
    } catch (err) {
      console.error('Balance forecast error:', err);
      res.status(500).json({ message: 'Failed to calculate balance forecast' });
    }
  });

  // ==================== EXTRA REVENUES ====================
  app.get('/api/extra-revenues', isAuthenticated, async (req, res) => {
    try {
      const year = req.query.year ? Number(req.query.year) : undefined;
      const data = await storage.getExtraRevenues(year);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/extra-revenues', isAuthenticated, async (req, res) => {
    try {
      const parsed = insertExtraRevenueSchema.parse(req.body);
      const created = await storage.createExtraRevenue(parsed);
      res.json(created);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch('/api/extra-revenues/:id', isAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const parsed = insertExtraRevenueSchema.partial().parse(req.body);
      const updated = await storage.updateExtraRevenue(id, parsed);
      if (!updated) return res.status(404).json({ message: 'Not found' });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete('/api/extra-revenues/:id', isAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await storage.deleteExtraRevenue(id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ==================== BACKUP LOG ====================
  app.post('/api/backup/log', isAuthenticated, async (req, res) => {
    try {
      const { recordCount = 0, details = 'JSON/Excel export' } = req.body;
      const result = await storage.logBackup(Number(recordCount), String(details));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ==================== RCP - SESSION TOKENS & RATE LIMITING ====================
  const crypto = await import('crypto');
  const rcpSessions = new Map<string, { employeeId: number; expiresAt: number }>();
  const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
  const RCP_SESSION_TTL = 12 * 60 * 60 * 1000;
  const RCP_MAX_ATTEMPTS = 3;
  const RCP_LOCKOUT_MS = 60 * 1000;

  function createRcpToken(employeeId: number): string {
    const token = crypto.randomBytes(32).toString('hex');
    rcpSessions.set(token, { employeeId, expiresAt: Date.now() + RCP_SESSION_TTL });
    return token;
  }

  function validateRcpToken(token: string): number | null {
    const session = rcpSessions.get(token);
    if (!session) return null;
    if (Date.now() > session.expiresAt) { rcpSessions.delete(token); return null; }
    return session.employeeId;
  }

  function getRcpEmployeeId(req: any): number | null {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return null;
    return validateRcpToken(auth.slice(7));
  }

  function safeEmployee(emp: any) {
    const { pin, pesel, email, phone, ...safe } = emp;
    return safe;
  }

  // ==================== RCP - HAVERSINE HELPER ====================
  function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function findNearestLocation(lat: number, lng: number, locs: any[]): { location: any; distance: number; inside: boolean } | null {
    let nearest: { location: any; distance: number; inside: boolean } | null = null;
    for (const loc of locs) {
      if (!loc.latitude || !loc.longitude) continue;
      const dist = haversineDistance(lat, lng, Number(loc.latitude), Number(loc.longitude));
      const radius = loc.gpsRadius || 200;
      if (!nearest || dist < nearest.distance) {
        nearest = { location: loc, distance: dist, inside: dist <= radius };
      }
    }
    return nearest;
  }

  // ==================== RCP - TIME CLOCK (public, no auth) ====================
  app.post('/api/time-clock/login', async (req, res) => {
    try {
      const { pin } = req.body;
      if (!pin || typeof pin !== 'string' || pin.length !== 6) {
        return res.status(400).json({ message: 'PIN musi mieć 6 cyfr' });
      }

      const ip = req.ip || 'unknown';
      const attempt = loginAttempts.get(ip);
      if (attempt && attempt.lockedUntil > Date.now()) {
        const remaining = Math.ceil((attempt.lockedUntil - Date.now()) / 1000);
        return res.status(429).json({ message: `Zbyt wiele prób. Spróbuj za ${remaining}s`, lockedUntil: attempt.lockedUntil });
      }

      console.log(`[RCP LOGIN] PIN length=${pin.length}, chars=${pin.split('').map((c: string) => c.charCodeAt(0)).join(',')}`);
      const employee = await storage.getEmployeeByPin(pin);
      console.log(`[RCP LOGIN] Employee found: ${!!employee}${employee ? `, name=${employee.firstName} ${employee.lastName}` : ''}`);
      if (!employee) {
        const current = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };
        current.count++;
        if (current.count >= RCP_MAX_ATTEMPTS) {
          current.lockedUntil = Date.now() + RCP_LOCKOUT_MS;
          current.count = 0;
        }
        loginAttempts.set(ip, current);
        return res.status(401).json({ message: 'Nieprawidłowy PIN' });
      }

      loginAttempts.delete(ip);
      const token = createRcpToken(employee.id);
      const activeEntry = await storage.getActiveTimeEntry(employee.id);
      res.json({ employee: safeEmployee(employee), activeEntry: activeEntry || null, token });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/time-clock/clock-in', async (req, res) => {
    try {
      const employeeId = getRcpEmployeeId(req);
      if (!employeeId) return res.status(401).json({ message: 'Sesja wygasła — zaloguj się ponownie' });
      const { lat, lng } = req.body;

      const existing = await storage.getActiveTimeEntry(employeeId);
      if (existing) return res.status(400).json({ message: 'Masz już aktywne wejście' });

      const locs = await storage.getLocationsWithGps();
      let locationId: number | null = null;
      let isOutsideZone = false;
      let nearestInfo: any = null;

      if (lat && lng) {
        nearestInfo = findNearestLocation(Number(lat), Number(lng), locs);
        if (nearestInfo) {
          locationId = nearestInfo.location.id;
          isOutsideZone = !nearestInfo.inside;
        }
      }

      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const entry = await storage.createTimeEntry({
        employeeId,
        date: dateStr,
        clockIn: now,
        clockInLat: lat ? String(lat) : null,
        clockInLng: lng ? String(lng) : null,
        clockInLocationId: locationId,
        status: isOutsideZone ? 'WARUNKOWA' : 'AKTYWNA',
        isOutsideZone,
      });
      res.json({ entry, nearestLocation: nearestInfo });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/time-clock/clock-out', async (req, res) => {
    try {
      const employeeId = getRcpEmployeeId(req);
      if (!employeeId) return res.status(401).json({ message: 'Sesja wygasła — zaloguj się ponownie' });
      const { lat, lng } = req.body;

      const active = await storage.getActiveTimeEntry(employeeId);
      if (!active) return res.status(400).json({ message: 'Brak aktywnego wejścia' });

      if (active.status === 'PRZERWA' && active.breakStart) {
        const breakEnd = new Date();
        const breakMs = breakEnd.getTime() - new Date(active.breakStart).getTime();
        const addedMinutes = Math.round(breakMs / 60000);
        await storage.updateTimeEntry(active.id, {
          breakEnd,
          breakMinutes: (active.breakMinutes || 0) + addedMinutes,
          status: active.isOutsideZone ? 'WARUNKOWA' : 'AKTYWNA',
        });
      }

      const locs = await storage.getLocationsWithGps();
      let clockOutLocationId: number | null = null;
      if (lat && lng) {
        const nearest = findNearestLocation(Number(lat), Number(lng), locs);
        if (nearest) clockOutLocationId = nearest.location.id;
      }

      const now = new Date();
      const finalStatus = active.isOutsideZone ? 'WARUNKOWA' : 'ZAKONCZONA';
      const entry = await storage.updateTimeEntry(active.id, {
        clockOut: now,
        clockOutLat: lat ? String(lat) : null,
        clockOutLng: lng ? String(lng) : null,
        clockOutLocationId,
        status: finalStatus,
      });
      res.json({ entry });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/time-clock/break-start', async (req, res) => {
    try {
      const employeeId = getRcpEmployeeId(req);
      if (!employeeId) return res.status(401).json({ message: 'Sesja wygasła — zaloguj się ponownie' });
      const active = await storage.getActiveTimeEntry(employeeId);
      if (!active || active.status === 'PRZERWA') {
        return res.status(400).json({ message: 'Nie możesz rozpocząć przerwy' });
      }
      const entry = await storage.updateTimeEntry(active.id, {
        breakStart: new Date(),
        status: 'PRZERWA',
      });
      res.json({ entry });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/time-clock/break-end', async (req, res) => {
    try {
      const employeeId = getRcpEmployeeId(req);
      if (!employeeId) return res.status(401).json({ message: 'Sesja wygasła — zaloguj się ponownie' });
      const active = await storage.getActiveTimeEntry(employeeId);
      if (!active || active.status !== 'PRZERWA' || !active.breakStart) {
        return res.status(400).json({ message: 'Nie jesteś na przerwie' });
      }
      const breakEnd = new Date();
      const breakMs = breakEnd.getTime() - new Date(active.breakStart).getTime();
      const addedMinutes = Math.round(breakMs / 60000);
      const entry = await storage.updateTimeEntry(active.id, {
        breakEnd,
        breakMinutes: (active.breakMinutes || 0) + addedMinutes,
        breakStart: null,
        status: active.isOutsideZone ? 'WARUNKOWA' : 'AKTYWNA',
      });
      res.json({ entry });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/time-clock/locations', async (_req, res) => {
    try {
      const locs = await storage.getLocationsWithGps();
      res.json(locs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/time-clock/history/:employeeId', async (req, res) => {
    try {
      const tokenEmployeeId = getRcpEmployeeId(req);
      if (!tokenEmployeeId) return res.status(401).json({ message: 'Sesja wygasła — zaloguj się ponownie' });
      const employeeId = Number(req.params.employeeId);
      if (employeeId !== tokenEmployeeId) return res.status(403).json({ message: 'Brak dostępu' });
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const entries = await storage.getTimeEntries({
        employeeId,
        from: weekAgo.toISOString().split('T')[0],
        to: now.toISOString().split('T')[0],
      });
      res.json(entries);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/time-clock/team-status', async (_req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const allEmployees = await storage.getEmployees();
      const activeEmployees = allEmployees.filter(e => e.status === 'AKTYWNY');
      const todayEntries = await storage.getTimeEntriesByDay(today);

      let working = 0, onBreak = 0;
      const workingIds = new Set<number>();
      for (const entry of todayEntries) {
        if (entry.status === 'AKTYWNA' || entry.status === 'WARUNKOWA') {
          working++;
          workingIds.add(entry.employeeId);
        } else if (entry.status === 'PRZERWA') {
          onBreak++;
          workingIds.add(entry.employeeId);
        }
      }
      const absent = activeEmployees.length - workingIds.size;
      res.json({ working, onBreak, absent, total: activeEmployees.length });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ==================== RCP - ADMIN (authenticated) ====================
  app.get('/api/rcp/dashboard', isAuthenticated, async (_req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const allEmployees = await storage.getEmployees();
      const activeEmployees = allEmployees.filter(e => e.status === 'AKTYWNY');
      const todayEntries = await storage.getTimeEntriesByDay(today);

      const pendingEntries = await storage.getTimeEntries({ status: 'WARUNKOWA' });

      let working = 0, onBreak = 0;
      const employeeStatuses: any[] = [];
      const workingIds = new Set<number>();

      for (const entry of todayEntries) {
        const emp = entry.employee;
        if (entry.status === 'AKTYWNA' || entry.status === 'WARUNKOWA') {
          working++;
          workingIds.add(entry.employeeId);
          employeeStatuses.push({
            employee: emp,
            status: 'working',
            clockIn: entry.clockIn,
            entryId: entry.id,
            isOutsideZone: entry.isOutsideZone,
          });
        } else if (entry.status === 'PRZERWA') {
          onBreak++;
          workingIds.add(entry.employeeId);
          employeeStatuses.push({
            employee: emp,
            status: 'break',
            clockIn: entry.clockIn,
            breakStart: entry.breakStart,
            entryId: entry.id,
          });
        } else if (entry.status === 'ZAKONCZONA' || entry.status === 'ZAAKCEPTOWANA') {
          if (!workingIds.has(entry.employeeId)) {
            employeeStatuses.push({
              employee: emp,
              status: 'finished',
              clockIn: entry.clockIn,
              clockOut: entry.clockOut,
              entryId: entry.id,
            });
            workingIds.add(entry.employeeId);
          }
        }
      }

      for (const emp of activeEmployees) {
        if (!workingIds.has(emp.id)) {
          employeeStatuses.push({ employee: emp, status: 'absent' });
        }
      }

      const pendingLeaves = await storage.getLeaveRequests({ status: 'OCZEKUJACY' });

      const todaySchedules = await storage.getWorkSchedules({ from: today, to: today });
      const employeesWithPin = activeEmployees.filter(e => e.pin);
      const scheduledEmpIds = new Set(todaySchedules.map(s => s.employeeId));
      const missingSchedules = employeesWithPin
        .filter(e => !scheduledEmpIds.has(e.id))
        .map(e => ({ id: e.id, firstName: e.firstName, lastName: e.lastName }));

      const lateToday: any[] = [];
      const LATE_THRESHOLD_MIN = 15;
      for (const sched of todaySchedules) {
        const emp = activeEmployees.find(e => e.id === sched.employeeId);
        if (!emp) continue;
        const entry = todayEntries.find(te => te.employeeId === sched.employeeId);
        const [sh, sm] = sched.startTime.split(':').map(Number);
        const scheduledStart = new Date(`${today}T${String(sh).padStart(2,'0')}:${String(sm).padStart(2,'0')}:00`);
        if (entry && entry.clockIn) {
          const actualStart = new Date(entry.clockIn);
          const diffMin = Math.round((actualStart.getTime() - scheduledStart.getTime()) / 60000);
          if (diffMin > LATE_THRESHOLD_MIN) {
            lateToday.push({
              employee: { id: emp.id, firstName: emp.firstName, lastName: emp.lastName },
              scheduledStart: sched.startTime,
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
              scheduledStart: sched.startTime,
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
          const workMin = Math.round(totalMs / 60000) - (entry.breakMinutes || 0);
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
        absent: activeEmployees.length - workingIds.size,
        pendingCount: pendingEntries.length,
        pendingEntries,
        employeeStatuses,
        pendingLeavesCount: pendingLeaves.length,
        missingSchedules,
        lateToday,
        overtimeYesterday,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/time-entries', isAuthenticated, async (req, res) => {
    try {
      const filters: any = {};
      if (req.query.employeeId) filters.employeeId = Number(req.query.employeeId);
      if (req.query.from) filters.from = String(req.query.from);
      if (req.query.to) filters.to = String(req.query.to);
      if (req.query.status) filters.status = String(req.query.status);
      const entries = await storage.getTimeEntries(filters);
      res.json(entries);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/time-entries/day', isAuthenticated, async (req, res) => {
    try {
      const date = String(req.query.date || new Date().toISOString().split('T')[0]);
      const entries = await storage.getTimeEntriesByDay(date);
      res.json(entries);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put('/api/time-entries/:id', isAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const user = (req as any).user;
      const data = { ...req.body, editedBy: user?.username || user?.email || 'admin', editedAt: new Date() };
      const entry = await storage.updateTimeEntry(id, data);
      res.json(entry);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put('/api/time-entries/:id/approve', isAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { adminNote } = req.body;
      const user = (req as any).user;
      const entry = await storage.updateTimeEntry(id, {
        status: 'ZAAKCEPTOWANA',
        adminNote: adminNote || null,
        editedBy: user?.username || user?.email || 'admin',
        editedAt: new Date(),
      });
      res.json(entry);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put('/api/time-entries/:id/reject', isAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { adminNote } = req.body;
      const user = (req as any).user;
      const entry = await storage.updateTimeEntry(id, {
        status: 'ODRZUCONA',
        adminNote: adminNote || null,
        editedBy: user?.username || user?.email || 'admin',
        editedAt: new Date(),
      });
      res.json(entry);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete('/api/time-entries/:id', isAuthenticated, async (req, res) => {
    try {
      await storage.deleteTimeEntry(Number(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/leave-requests', isAuthenticated, async (req, res) => {
    try {
      const filters: any = {};
      if (req.query.employeeId) filters.employeeId = Number(req.query.employeeId);
      if (req.query.status) filters.status = String(req.query.status);
      if (req.query.from) filters.from = String(req.query.from);
      if (req.query.to) filters.to = String(req.query.to);
      const requests = await storage.getLeaveRequests(filters);
      res.json(requests);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/leave-requests', isAuthenticated, async (req, res) => {
    try {
      const data = insertLeaveRequestSchema.parse(req.body);
      const request = await storage.createLeaveRequest(data);
      res.json(request);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.put('/api/leave-requests/:id', isAuthenticated, async (req, res) => {
    try {
      const request = await storage.updateLeaveRequest(Number(req.params.id), req.body);
      res.json(request);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put('/api/leave-requests/:id/approve', isAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const user = (req as any).user;
      const request = await storage.updateLeaveRequest(id, {
        status: 'ZAAKCEPTOWANY',
        reviewedBy: user?.username || user?.email || 'admin',
        reviewedAt: new Date(),
      });
      res.json(request);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put('/api/leave-requests/:id/reject', isAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const user = (req as any).user;
      const { comment } = req.body;
      const request = await storage.updateLeaveRequest(id, {
        status: 'ODRZUCONY',
        comment: comment || undefined,
        reviewedBy: user?.username || user?.email || 'admin',
        reviewedAt: new Date(),
      });
      res.json(request);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete('/api/leave-requests/:id', isAuthenticated, async (req, res) => {
    try {
      await storage.deleteLeaveRequest(Number(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ==================== RCP - MONTHLY REPORT ====================
  app.get('/api/rcp/report', isAuthenticated, async (req, res) => {
    try {
      const employeeId = Number(req.query.employeeId);
      const year = Number(req.query.year);
      const month = Number(req.query.month);
      if (!employeeId || !year || !month) {
        return res.status(400).json({ message: 'Wymagane: employeeId, year, month' });
      }

      const employee = await storage.getEmployee(employeeId);
      if (!employee) return res.status(404).json({ message: 'Pracownik nie znaleziony' });

      const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const lastDayStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const entries = await storage.getTimeEntries({ employeeId, from: firstDay, to: lastDayStr });
      const leaveReqs = await storage.getLeaveRequests({ employeeId, status: 'ZAAKCEPTOWANY' });
      const schedules = await storage.getWorkSchedules({ employeeId, from: firstDay, to: lastDayStr });
      const scheduleByDate: Record<string, any> = {};
      for (const s of schedules) { scheduleByDate[s.date] = s; }

      const days: any[] = [];
      let totalWorkMinutes = 0;
      let totalBreakMinutes = 0;
      let totalOvertimeMinutes = 0;
      let workDays = 0;

      for (let d = 1; d <= lastDay; d++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dateObj = new Date(dateStr + 'T12:00:00');
        const dayOfWeek = dateObj.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const dayNames = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So'];

        const dayEntries = entries.filter(e => e.date === dateStr);
        const leave = leaveReqs.find(lr =>
          lr.startDate <= dateStr && lr.endDate >= dateStr
        );
        const sched = scheduleByDate[dateStr];

        if (dayEntries.length > 0) {
          let dayWorkMin = 0;
          let dayBreakMin = 0;
          let clockInStr = '';
          let clockOutStr = '';
          let status = '';
          let firstClockIn: Date | null = null;

          for (const entry of dayEntries) {
            if (entry.clockIn && entry.clockOut) {
              const workMs = new Date(entry.clockOut).getTime() - new Date(entry.clockIn).getTime();
              const breakMin = entry.breakMinutes || 0;
              dayWorkMin += Math.round(workMs / 60000) - breakMin;
              dayBreakMin += breakMin;
            }
            if (!clockInStr && entry.clockIn) {
              clockInStr = new Date(entry.clockIn).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
              firstClockIn = new Date(entry.clockIn);
            }
            if (entry.clockOut) {
              clockOutStr = new Date(entry.clockOut).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
            }
            status = entry.status;
          }

          let lateMinutes = 0;
          let scheduledStart = sched?.startTime || null;
          let scheduledEnd = sched?.endTime || null;
          if (sched && firstClockIn) {
            const [sh, sm] = sched.startTime.split(':').map(Number);
            const schedTime = new Date(`${dateStr}T${String(sh).padStart(2,'0')}:${String(sm).padStart(2,'0')}:00`);
            const diff = Math.round((firstClockIn.getTime() - schedTime.getTime()) / 60000);
            if (diff > 0) lateMinutes = diff;
          }

          const overtime = dayWorkMin > 480 ? dayWorkMin - 480 : 0;
          totalWorkMinutes += dayWorkMin;
          totalBreakMinutes += dayBreakMin;
          totalOvertimeMinutes += overtime;
          workDays++;

          days.push({
            date: dateStr,
            dayName: dayNames[dayOfWeek],
            isWeekend,
            clockIn: clockInStr,
            clockOut: clockOutStr,
            breakMinutes: dayBreakMin,
            workMinutes: dayWorkMin,
            overtime,
            lateMinutes,
            scheduledStart,
            scheduledEnd,
            status,
            type: 'work',
          });
        } else if (leave) {
          const typeLabels: Record<string, string> = {
            URLOP_WYPOCZYNKOWY: 'Urlop wypoczynkowy',
            URLOP_NA_ZADANIE: 'Urlop na żądanie',
            ZWOLNIENIE_LEKARSKIE: 'Zwolnienie lekarskie',
            INNY: 'Inny',
          };
          days.push({
            date: dateStr,
            dayName: dayNames[dayOfWeek],
            isWeekend,
            type: 'leave',
            leaveType: typeLabels[leave.type] || leave.type,
          });
        } else {
          days.push({
            date: dateStr,
            dayName: dayNames[dayOfWeek],
            isWeekend,
            type: isWeekend ? 'weekend' : 'absent',
          });
        }
      }

      const hourlyRate = employee.hourlyRate ? parseFloat(employee.hourlyRate) : 0;
      const totalHours = Math.round(totalWorkMinutes / 6) / 10;
      const grossPay = Math.round(totalHours * hourlyRate * 100) / 100;

      res.json({
        employee: { id: employee.id, firstName: employee.firstName, lastName: employee.lastName, position: employee.position, hourlyRate: employee.hourlyRate },
        year,
        month,
        days,
        summary: {
          workDays,
          totalWorkMinutes,
          totalBreakMinutes,
          totalOvertimeMinutes,
          totalHours,
          hourlyRate,
          grossPay,
        },
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ==================== RCP - LEAVE BALANCE ====================
  app.get('/api/rcp/leave-balance', isAuthenticated, async (req, res) => {
    try {
      const year = Number(req.query.year) || new Date().getFullYear();
      const allEmployees = await storage.getEmployees();
      const activeEmployees = allEmployees.filter(e => e.status === 'AKTYWNY');
      const allLeaves = await storage.getLeaveRequests({});

      const balance = activeEmployees.map(emp => {
        const empLeaves = allLeaves.filter(lr => lr.employeeId === emp.id);
        const yearLeaves = empLeaves.filter(lr => {
          const startYear = new Date(lr.startDate + 'T12:00:00').getFullYear();
          return startYear === year;
        });
        const usedDays = yearLeaves
          .filter(lr => lr.status === 'ZAAKCEPTOWANY')
          .reduce((s, lr) => s + lr.days, 0);
        const pendingDays = yearLeaves
          .filter(lr => lr.status === 'OCZEKUJACY')
          .reduce((s, lr) => s + lr.days, 0);
        const allocated = 26;
        return {
          employeeId: emp.id,
          firstName: emp.firstName,
          lastName: emp.lastName,
          allocated,
          used: usedDays,
          pending: pendingDays,
          remaining: allocated - usedDays,
        };
      });

      res.json(balance);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ==================== RCP - EMPLOYEE LEAVE REQUESTS (Bearer token) ====================
  app.get('/api/time-clock/leave-requests', async (req, res) => {
    try {
      const employeeId = getRcpEmployeeId(req);
      if (!employeeId) return res.status(401).json({ message: 'Brak autoryzacji' });
      const requests = await storage.getLeaveRequests({ employeeId });
      res.json(requests);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/time-clock/leave-requests', async (req, res) => {
    try {
      const employeeId = getRcpEmployeeId(req);
      if (!employeeId) return res.status(401).json({ message: 'Brak autoryzacji' });
      const parsed = insertLeaveRequestSchema.safeParse({
        ...req.body,
        employeeId,
        status: 'OCZEKUJACY',
      });
      if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
      const request = await storage.createLeaveRequest(parsed.data);
      res.json(request);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ==================== RCP - EMPLOYEE SCHEDULE (Bearer token) ====================
  app.get('/api/time-clock/my-schedule', async (req, res) => {
    try {
      const employeeId = getRcpEmployeeId(req);
      if (!employeeId) return res.status(401).json({ message: 'Brak autoryzacji' });
      const now = new Date();
      const from = now.toISOString().split('T')[0];
      const toDate = new Date(now.getTime() + 13 * 24 * 60 * 60 * 1000);
      const to = toDate.toISOString().split('T')[0];
      const schedules = await storage.getWorkSchedules({ employeeId, from, to });
      res.json(schedules);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ==================== RCP - EMPLOYEE MONTHLY SUMMARY (Bearer token) ====================
  app.get('/api/time-clock/my-summary', async (req, res) => {
    try {
      const employeeId = getRcpEmployeeId(req);
      if (!employeeId) return res.status(401).json({ message: 'Brak autoryzacji' });

      const now = new Date();
      let year = Number(req.query.year) || now.getFullYear();
      let month = Number(req.query.month) || (now.getMonth() + 1);
      if (!Number.isInteger(month) || month < 1 || month > 12) return res.status(400).json({ message: 'Nieprawidłowy miesiąc (1-12)' });
      if (!Number.isInteger(year) || year < 2020 || year > 2100) return res.status(400).json({ message: 'Nieprawidłowy rok' });

      const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
      const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(new Date(nextMonth).getTime() - 86400000).toISOString().split('T')[0];

      const entries = await storage.getTimeEntries({ employeeId, from: monthStart, to: lastDay });
      const completedEntries = entries.filter(e => e.status === 'ZAKONCZONA' || e.status === 'ZAAKCEPTOWANA');

      let totalMinutes = 0;
      for (const entry of completedEntries) {
        if (entry.clockIn && entry.clockOut) {
          const dur = new Date(String(entry.clockOut)).getTime() - new Date(String(entry.clockIn)).getTime();
          const breakMin = entry.breakMinutes || 0;
          totalMinutes += Math.max(0, Math.round(dur / 60000) - breakMin);
        }
      }

      const allLeaves = await storage.getLeaveRequests({ employeeId });
      const yearLeaves = allLeaves.filter(lr => {
        const startYear = new Date(lr.startDate + 'T12:00:00').getFullYear();
        return startYear === year;
      });
      const usedDays = yearLeaves.filter(lr => lr.status === 'ZAAKCEPTOWANY').reduce((s, lr) => s + lr.days, 0);
      const pendingDays = yearLeaves.filter(lr => lr.status === 'OCZEKUJACY').reduce((s, lr) => s + lr.days, 0);
      const allocated = 26;

      const schedules = await storage.getWorkSchedules({ employeeId, from: monthStart, to: lastDay });
      let scheduledMinutes = 0;
      for (const s of schedules) {
        if (s.startTime && s.endTime) {
          const [sh, sm] = s.startTime.split(':').map(Number);
          const [eh, em] = s.endTime.split(':').map(Number);
          let diff = (eh * 60 + em) - (sh * 60 + sm);
          if (diff < 0) diff += 24 * 60;
          scheduledMinutes += diff;
        }
      }

      const normHours = 168;

      res.json({
        year,
        month,
        workedMinutes: totalMinutes,
        workedHours: Math.round(totalMinutes / 6) / 10,
        scheduledMinutes,
        scheduledHours: Math.round(scheduledMinutes / 6) / 10,
        normHours,
        daysWorked: completedEntries.length,
        leaveBalance: {
          allocated,
          used: usedDays,
          pending: pendingDays,
          remaining: allocated - usedDays,
        },
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ==================== LOCATION LOGS (GPS tracking) ====================
  app.post('/api/time-clock/location-log', async (req, res) => {
    try {
      const employeeId = getRcpEmployeeId(req);
      if (!employeeId) return res.status(401).json({ message: 'Brak autoryzacji' });

      const { latitude, longitude, accuracy } = req.body;
      if (latitude == null || longitude == null || isNaN(Number(latitude)) || isNaN(Number(longitude))) {
        return res.status(400).json({ message: 'Brak współrzędnych' });
      }

      const activeEntries = await db.select().from(timeEntries)
        .where(and(
          eq(timeEntries.employeeId, employeeId),
          sql`${timeEntries.status} IN ('AKTYWNA', 'WARUNKOWA', 'PRZERWA')`
        ));
      const activeEntry = activeEntries[0];
      if (!activeEntry) return res.status(400).json({ message: 'Brak aktywnej zmiany' });

      const allLocations = await db.select().from(locations).where(
        and(sql`${locations.latitude} IS NOT NULL`, sql`${locations.longitude} IS NOT NULL`)
      );

      let nearestLocationId: number | null = null;
      let minDistance = Infinity;
      for (const loc of allLocations) {
        if (!loc.latitude || !loc.longitude) continue;
        const dist = haversineDistance(
          Number(latitude), Number(longitude),
          Number(loc.latitude), Number(loc.longitude)
        );
        if (dist < minDistance) {
          minDistance = dist;
          nearestLocationId = loc.id;
        }
      }

      const [log] = await db.insert(locationLogs).values({
        employeeId,
        timeEntryId: activeEntry.id,
        latitude: String(latitude),
        longitude: String(longitude),
        accuracy: accuracy ? String(accuracy) : null,
        timestamp: new Date(),
        locationId: nearestLocationId,
        distanceFromZone: String(Math.round(minDistance * 100) / 100),
      }).returning();

      res.json(log);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/location-logs', isAuthenticated, async (req, res) => {
    try {
      const { employeeId, date } = req.query;
      if (!employeeId || !date) return res.status(400).json({ message: 'Wymagane employeeId i date' });

      const dayStart = new Date(`${date}T00:00:00`);
      const dayEnd = new Date(`${date}T23:59:59`);

      const logs = await db.select({
        log: locationLogs,
        locationName: locations.name,
      }).from(locationLogs)
        .leftJoin(locations, eq(locationLogs.locationId, locations.id))
        .where(and(
          eq(locationLogs.employeeId, Number(employeeId)),
          gte(locationLogs.timestamp, dayStart),
          lte(locationLogs.timestamp, dayEnd),
        ))
        .orderBy(locationLogs.timestamp);

      res.json(logs.map(r => ({ ...r.log, locationName: r.locationName })));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/location-logs/summary', isAuthenticated, async (req, res) => {
    try {
      const { date } = req.query;
      if (!date) return res.status(400).json({ message: 'Wymagane date' });

      const dayStart = new Date(`${date}T00:00:00`);
      const dayEnd = new Date(`${date}T23:59:59`);

      const allLogs = await db.select()
        .from(locationLogs)
        .where(and(
          gte(locationLogs.timestamp, dayStart),
          lte(locationLogs.timestamp, dayEnd),
        ));

      const uniqueEmployees = new Set(allLogs.map(l => l.employeeId));
      const outsideZone = allLogs.filter(l => l.distanceFromZone && parseFloat(l.distanceFromZone) > 0).length;

      res.json({
        totalEmployees: uniqueEmployees.size,
        totalLogs: allLogs.length,
        outsideZone,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ==================== ISSUES (admin management) ====================
  app.get('/api/issues', isAuthenticated, async (req, res) => {
    try {
      const results = await db.select({
        issue: issues,
        apartmentName: apartments.name,
      }).from(issues)
        .leftJoin(apartments, eq(issues.apartmentId, apartments.id))
        .orderBy(desc(issues.createdAt));
      res.json(results.map(r => ({ ...r.issue, apartmentName: r.apartmentName })));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put('/api/issues/:id', isAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { status, assignedTo, cost, notes, priority } = req.body;
      const update: any = { updatedAt: new Date() };
      if (status) update.status = status;
      if (assignedTo !== undefined) update.assignedTo = assignedTo;
      if (cost !== undefined) update.cost = cost;
      if (notes !== undefined) update.notes = notes;
      if (priority) update.priority = priority;
      if (status === 'ROZWIĄZANE' || status === 'ZAMKNIĘTE') update.resolvedAt = new Date();
      const [updated] = await db.update(issues).set(update).where(eq(issues.id, id)).returning();
      if (!updated) return res.status(404).json({ message: 'Nie znaleziono' });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete('/api/issues/:id', isAuthenticated, async (req, res) => {
    try {
      await db.delete(issues).where(eq(issues.id, Number(req.params.id)));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ==================== RECEPCJA SIDEBAR VISIBILITY CONFIG (admin) ====================
  app.get('/api/recepcja-sidebar-config', isAuthenticated, async (_req, res) => {
    try {
      const raw = await storage.getAppConfig('recepcja-sidebar-visibility');
      res.json(raw ? JSON.parse(raw) : { hiddenItems: [] });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put('/api/recepcja-sidebar-config', isAuthenticated, async (req, res) => {
    try {
      await storage.setAppConfig('recepcja-sidebar-visibility', JSON.stringify(req.body));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ==================== EMPLOYEE TRAININGS ====================
  function computeTrainingStatus(expiryDate: string | null): string {
    if (!expiryDate) return "AKTUALNE";
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffDays = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return "WYGASŁE";
    if (diffDays <= 30) return "WYGASAJĄCE";
    return "AKTUALNE";
  }

  app.get('/api/employee-trainings', isAuthenticated, async (req, res) => {
    try {
      const { employeeId } = req.query;
      let rows;
      if (employeeId) {
        rows = await db.select().from(employeeTrainings).where(eq(employeeTrainings.employeeId, Number(employeeId))).orderBy(desc(employeeTrainings.completedDate));
      } else {
        rows = await db.select().from(employeeTrainings).orderBy(desc(employeeTrainings.completedDate));
      }
      const allEmployees = await db.select().from(employees);
      const empMap = new Map(allEmployees.map(e => [e.id, e]));
      const result = rows.map(r => ({
        ...r,
        status: computeTrainingStatus(r.expiryDate),
        employeeName: empMap.has(r.employeeId) ? `${empMap.get(r.employeeId)!.firstName} ${empMap.get(r.employeeId)!.lastName}` : "—",
      }));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/employee-trainings/expiring', isAuthenticated, async (_req, res) => {
    try {
      const rows = await db.select().from(employeeTrainings);
      const allEmployees = await db.select().from(employees);
      const empMap = new Map(allEmployees.map(e => [e.id, e]));
      const result = rows
        .map(r => ({
          ...r,
          status: computeTrainingStatus(r.expiryDate),
          employeeName: empMap.has(r.employeeId) ? `${empMap.get(r.employeeId)!.firstName} ${empMap.get(r.employeeId)!.lastName}` : "—",
        }))
        .filter(r => r.status === "WYGASAJĄCE" || r.status === "WYGASŁE");
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/employee-trainings', isAuthenticated, async (req, res) => {
    try {
      const data = insertEmployeeTrainingSchema.parse(req.body);
      const [created] = await db.insert(employeeTrainings).values(data).returning();
      res.json(created);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.put('/api/employee-trainings/:id', isAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const data = insertEmployeeTrainingSchema.partial().parse(req.body);
      const [updated] = await db.update(employeeTrainings).set(data).where(eq(employeeTrainings.id, id)).returning();
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete('/api/employee-trainings/:id', isAuthenticated, async (req, res) => {
    try {
      await db.delete(employeeTrainings).where(eq(employeeTrainings.id, Number(req.params.id)));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ==================== EMPLOYEE CONTRACTS ====================
  function computeContractStatus(status: string, endDate: string | null): string {
    if (status === "WYPOWIEDZIANA") return "WYPOWIEDZIANA";
    if (status === "ZAKOŃCZONA") return "ZAKOŃCZONA";
    if (!endDate) return "AKTYWNA";
    const now = new Date();
    const end = new Date(endDate);
    if (end < now) return "ZAKOŃCZONA";
    return "AKTYWNA";
  }

  app.get('/api/employee-contracts', isAuthenticated, async (req, res) => {
    try {
      const { employeeId } = req.query;
      let rows;
      if (employeeId) {
        rows = await db.select().from(employeeContracts).where(eq(employeeContracts.employeeId, Number(employeeId))).orderBy(desc(employeeContracts.startDate));
      } else {
        rows = await db.select().from(employeeContracts).orderBy(desc(employeeContracts.startDate));
      }
      const allEmployees = await db.select().from(employees);
      const empMap = new Map(allEmployees.map(e => [e.id, e]));
      const result = rows.map(r => ({
        ...r,
        computedStatus: computeContractStatus(r.status, r.endDate),
        employeeName: empMap.has(r.employeeId) ? `${empMap.get(r.employeeId)!.firstName} ${empMap.get(r.employeeId)!.lastName}` : "—",
      }));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/employee-contracts/expiring', isAuthenticated, async (_req, res) => {
    try {
      const rows = await db.select().from(employeeContracts);
      const allEmployees = await db.select().from(employees);
      const empMap = new Map(allEmployees.map(e => [e.id, e]));
      const now = new Date();
      const in30days = new Date(now);
      in30days.setDate(in30days.getDate() + 30);
      const result = rows
        .filter(r => {
          if (r.status === "ZAKOŃCZONA" || r.status === "WYPOWIEDZIANA") return false;
          if (!r.endDate) return false;
          const end = new Date(r.endDate);
          return end <= in30days && end >= now;
        })
        .map(r => ({
          ...r,
          computedStatus: "KOŃCZĄCA_SIĘ",
          employeeName: empMap.has(r.employeeId) ? `${empMap.get(r.employeeId)!.firstName} ${empMap.get(r.employeeId)!.lastName}` : "—",
        }));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/employee-contracts', isAuthenticated, async (req, res) => {
    try {
      const data = insertEmployeeContractSchema.parse(req.body);
      const [created] = await db.insert(employeeContracts).values(data).returning();
      res.json(created);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.put('/api/employee-contracts/:id', isAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const data = insertEmployeeContractSchema.partial().parse(req.body);
      const [updated] = await db.update(employeeContracts).set(data).where(eq(employeeContracts.id, id)).returning();
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete('/api/employee-contracts/:id', isAuthenticated, async (req, res) => {
    try {
      await db.delete(employeeContracts).where(eq(employeeContracts.id, Number(req.params.id)));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/employee-contracts/:id/generate-pdf', isAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [contract] = await db.select().from(employeeContracts).where(eq(employeeContracts.id, id));
      if (!contract) return res.status(404).json({ message: "Not found" });
      const [emp] = await db.select().from(employees).where(eq(employees.id, contract.employeeId));

      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ format: "a4" });

      doc.setFontSize(10);
      doc.text("Bałtyckie Apartamenty", 105, 15, { align: "center" });
      doc.setFontSize(16);
      doc.text(contract.title, 105, 30, { align: "center" });
      doc.setFontSize(10);

      let y = 50;
      const addLine = (label: string, value: string) => {
        doc.text(`${label}: ${value}`, 20, y);
        y += 7;
      };

      const typeLabels: Record<string, string> = {
        UMOWA_O_PRACE: "Umowa o prac\u0119",
        UMOWA_ZLECENIE: "Umowa zlecenie",
        UMOWA_O_DZIELO: "Umowa o dzie\u0142o",
        ANEKS: "Aneks",
        WYPOWIEDZENIE: "Wypowiedzenie",
      };

      addLine("Typ umowy", typeLabels[contract.type] || contract.type);
      if (emp) {
        addLine("Pracownik", `${emp.firstName} ${emp.lastName}`);
        if (emp.pesel) addLine("PESEL", emp.pesel);
      }
      addLine("Data rozpocz\u0119cia", contract.startDate);
      if (contract.endDate) addLine("Data zako\u0144czenia", contract.endDate);
      if (contract.position) addLine("Stanowisko", contract.position);
      if (contract.workHours) addLine("Wymiar czasu pracy", contract.workHours);
      if (contract.salary) addLine("Wynagrodzenie brutto", `${contract.salary} PLN`);
      if (contract.hourlyRate) addLine("Stawka godzinowa", `${contract.hourlyRate} PLN/h`);
      if (contract.trialPeriod) {
        addLine("Okres pr\u00f3bny", "Tak");
        if (contract.trialEndDate) addLine("Koniec okresu pr\u00f3bnego", contract.trialEndDate);
      }
      if (contract.signedDate) addLine("Data podpisania", contract.signedDate);
      if (contract.notes) {
        y += 5;
        doc.text("Uwagi:", 20, y);
        y += 7;
        doc.setFontSize(9);
        const lines = doc.splitTextToSize(contract.notes, 170);
        doc.text(lines, 20, y);
        y += lines.length * 5;
        doc.setFontSize(10);
      }

      y += 20;
      doc.text("_______________________", 20, y);
      doc.text("_______________________", 120, y);
      y += 5;
      doc.text("Pracodawca", 35, y);
      doc.text("Pracownik", 140, y);

      const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${contract.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf"`);
      res.send(pdfBuffer);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/employees/:id/profile', isAuthenticated, async (req, res) => {
    try {
      const empId = Number(req.params.id);
      const [emp] = await db.select().from(employees).where(eq(employees.id, empId));
      if (!emp) return res.status(404).json({ message: "Employee not found" });

      const contracts = await db.select().from(employeeContracts)
        .where(eq(employeeContracts.employeeId, empId))
        .orderBy(desc(employeeContracts.startDate));

      const trainings = await db.select().from(employeeTrainings)
        .where(eq(employeeTrainings.employeeId, empId))
        .orderBy(desc(employeeTrainings.completedDate));

      const exams = await db.select().from(medicalExams)
        .where(eq(medicalExams.employeeId, empId))
        .orderBy(desc(medicalExams.examDate));

      const allPayrollEntries = await db.select().from(payrollEntries)
        .where(eq(payrollEntries.employeeId, empId));
      const periodIds = [...new Set(allPayrollEntries.map(e => e.periodId))];
      let periods: any[] = [];
      if (periodIds.length > 0) {
        periods = await db.select().from(payrollPeriods)
          .where(inArray(payrollPeriods.id, periodIds));
      }
      const periodMap = new Map(periods.map((p: any) => [p.id, p]));
      const payroll = allPayrollEntries.map(entry => ({
        ...entry,
        month: periodMap.get(entry.periodId)?.month,
        year: periodMap.get(entry.periodId)?.year,
        periodStatus: periodMap.get(entry.periodId)?.status,
      })).sort((a, b) => {
        const yearDiff = (b.year || 0) - (a.year || 0);
        if (yearDiff !== 0) return yearDiff;
        return (b.month || 0) - (a.month || 0);
      });

      const totalCost = allPayrollEntries.reduce((sum, e) => sum + Number(e.grossPay || 0), 0);

      const contractsWithStatus = contracts.map(c => ({
        ...c,
        computedStatus: computeContractStatus(c.status, c.endDate),
      }));

      const trainingsWithStatus = trainings.map(t => ({
        ...t,
        computedStatus: computeTrainingStatus(t.expiryDate),
      }));

      const timeline: any[] = [];
      contractsWithStatus.forEach(c => {
        timeline.push({ type: 'contract', date: c.startDate, title: c.title, status: c.computedStatus, data: c });
        if (c.endDate) timeline.push({ type: 'contract_end', date: c.endDate, title: `Koniec: ${c.title}`, status: c.computedStatus, data: c });
      });
      trainingsWithStatus.forEach(t => {
        timeline.push({ type: 'training', date: t.completedDate, title: t.name, status: t.computedStatus, data: t });
      });
      exams.forEach(e => {
        timeline.push({ type: 'exam', date: e.examDate, title: e.examName, status: e.validUntil && new Date(e.validUntil) < new Date() ? 'WYGASŁE' : 'AKTUALNE', data: e });
      });
      timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      res.json({
        employee: emp,
        contracts: contractsWithStatus,
        trainings: trainingsWithStatus,
        exams,
        payroll,
        totalCost,
        timeline,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/hr-calendar', isAuthenticated, async (_req, res) => {
    try {
      const allEmployees = await db.select().from(employees);
      const empMap = new Map(allEmployees.map(e => [e.id, `${e.firstName} ${e.lastName}`]));

      const contracts = await db.select().from(employeeContracts);
      const trainings = await db.select().from(employeeTrainings);
      const exams = await db.select().from(medicalExams);

      const events: any[] = [];

      contracts.forEach(c => {
        if (c.endDate) {
          events.push({
            id: `contract-${c.id}`,
            type: 'contract',
            date: c.endDate,
            title: c.title,
            employeeName: empMap.get(c.employeeId) || '—',
            employeeId: c.employeeId,
            status: computeContractStatus(c.status, c.endDate),
          });
        }
      });

      trainings.forEach(t => {
        if (t.expiryDate) {
          events.push({
            id: `training-${t.id}`,
            type: 'training',
            date: t.expiryDate,
            title: t.name,
            employeeName: empMap.get(t.employeeId) || '—',
            employeeId: t.employeeId,
            status: computeTrainingStatus(t.expiryDate),
          });
        }
      });

      exams.forEach(e => {
        if (e.validUntil) {
          events.push({
            id: `exam-${e.id}`,
            type: 'exam',
            date: e.validUntil,
            title: e.examName,
            employeeName: empMap.get(e.employeeId) || '—',
            employeeId: e.employeeId,
            status: new Date(e.validUntil) < new Date() ? 'WYGASŁE' : new Date(e.validUntil) <= new Date(Date.now() + 30 * 86400000) ? 'WYGASAJĄCE' : 'AKTUALNE',
          });
        }
      });

      events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      res.json(events);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ==================== BANK STATEMENTS ====================
  app.get("/api/bank-statements", async (_req, res) => {
    try {
      const statements = await storage.getBankStatements();
      res.json(statements);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/bank-statements", async (req, res) => {
    try {
      const statement = await storage.createBankStatement(req.body);
      res.json(statement);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/bank-statements/:id", async (req, res) => {
    try {
      await storage.deleteBankStatement(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/bank-transactions", async (req, res) => {
    try {
      const statementId = req.query.statementId ? parseInt(req.query.statementId as string) : undefined;
      const transactions = await storage.getBankTransactions(statementId);
      res.json(transactions);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/bank-transactions/history", async (req, res) => {
    try {
      const accountId = parseInt(req.query.accountId as string);
      if (!accountId) return res.status(400).json({ message: "Brak accountId" });
      const result = await storage.getBankTransactionHistory({
        accountId,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        search: req.query.search as string | undefined,
        costStatus: (["all", "categorized", "skipped", "pending"].includes(req.query.costStatus as string) ? req.query.costStatus as "all" | "categorized" | "skipped" | "pending" : "all"),
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 30,
      });

      const snapshots = await storage.getSnapshots(accountId);
      const latestSnapshot = snapshots[0];
      const statements = await storage.getBankStatements();
      const accountStatements = statements.filter(s => s.accountId === accountId);
      const lastImport = accountStatements[0];

      const summary = await storage.getBankTransactionSummary(
        accountId,
        req.query.dateFrom as string | undefined,
        req.query.dateTo as string | undefined,
      );

      res.json({
        ...result,
        summary: {
          currentBalance: latestSnapshot?.balance || "0",
          lastImportDate: lastImport?.importDate || null,
          lastImportFileName: lastImport?.fileName || null,
          totalIncome: summary.totalIncome.toFixed(2),
          totalExpense: summary.totalExpense.toFixed(2),
          pendingCount: summary.pendingCount,
        },
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/bank-transactions/bulk", async (req, res) => {
    try {
      const transactions = await storage.createBankTransactionsBulk(req.body);

      if (transactions.length > 0) {
        const lastTx = transactions.reduce((latest, tx) => {
          if (!latest) return tx;
          if ((tx.date || "") > (latest.date || "")) return tx;
          if ((tx.date || "") === (latest.date || "") && tx.id > latest.id) return tx;
          return latest;
        }, transactions[0]);

        if (lastTx.balance && lastTx.accountId) {
          try {
            await storage.createSnapshot({
              accountId: lastTx.accountId,
              date: lastTx.date,
              balance: lastTx.balance,
              notes: "Import bankowy",
            });
          } catch (snapErr: any) {
            console.warn("Auto-snapshot po imporcie nie powiódł się:", snapErr?.message || snapErr);
          }
        }
      }

      res.json(transactions);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/bank-transactions/:id", async (req, res) => {
    try {
      const transaction = await storage.updateBankTransaction(parseInt(req.params.id), req.body);
      res.json(transaction);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/bank-statements/check-duplicates", async (req, res) => {
    try {
      const { accountId, transactions } = req.body;
      if (!accountId || !transactions) return res.status(400).json({ message: "Brak danych" });
      const duplicates = await storage.checkDuplicateTransactions(accountId, transactions);
      res.json({ duplicates });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/bank-statements/parse-csv", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "Brak pliku" });
      const content = req.file.buffer.toString("utf-8");
      const bankFormat = (req.body?.bankFormat || req.query?.bankFormat || "generic") as string;
      const lines = content.split("\n").filter(l => l.trim());
      const transactions: any[] = [];

      const cleanNum = (s: string) => s?.replace(/\s/g, "").replace(/,/g, ".") || "0";
      const cleanStr = (s: string) => s?.replace(/"/g, "").trim() || "";

      function parseCsvLine(line: string, delimiter: string): string[] {
        const fields: string[] = [];
        let current = "";
        let inQuotes = false;
        for (let j = 0; j < line.length; j++) {
          const ch = line[j];
          if (inQuotes) {
            if (ch === '"') {
              if (j + 1 < line.length && line[j + 1] === '"') {
                current += '"';
                j++;
              } else {
                inQuotes = false;
              }
            } else {
              current += ch;
            }
          } else {
            if (ch === '"') {
              inQuotes = true;
            } else if (ch === delimiter) {
              fields.push(current);
              current = "";
            } else {
              current += ch;
            }
          }
        }
        fields.push(current);
        return fields;
      }

      if (bankFormat === "mbank") {
        let dataStart = 0;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes("#Data operacji") || lines[i].includes("#Data księgowania")) {
            dataStart = i + 1;
            break;
          }
        }
        if (dataStart === 0) dataStart = 1;
        for (let i = dataStart; i < lines.length; i++) {
          const parts = parseCsvLine(lines[i], ";").map(cleanStr);
          if (parts.length >= 6 && parts[0].match(/\d{4}-\d{2}-\d{2}/)) {
            transactions.push({
              date: parts[0],
              description: parts[3] || parts[2] || "Transakcja",
              amount: cleanNum(parts[5] || parts[4]),
              balance: parts[6] ? cleanNum(parts[6]) : null,
              counterparty: parts[4] || parts[3] || null,
            });
          }
        }
      } else if (bankFormat === "pko") {
        for (let i = 1; i < lines.length; i++) {
          const parts = parseCsvLine(lines[i], ",").map(cleanStr);
          if (parts.length < 4) {
            const semiParts = parseCsvLine(lines[i], ";").map(cleanStr);
            if (semiParts.length >= 4 && semiParts[0].match(/\d{4}-?\d{2}-?\d{2}/)) {
              const dateStr = semiParts[0].replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
              transactions.push({
                date: dateStr,
                description: semiParts[2] || semiParts[1] || "Transakcja",
                amount: cleanNum(semiParts[3]),
                balance: semiParts[4] ? cleanNum(semiParts[4]) : null,
                counterparty: semiParts[1] || null,
              });
            }
            continue;
          }
          if (parts[0].match(/\d{4}-?\d{2}-?\d{2}/)) {
            const dateStr = parts[0].replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
            transactions.push({
              date: dateStr,
              description: parts[2] || parts[3] || "Transakcja",
              amount: cleanNum(parts[4] || parts[3]),
              balance: parts[5] ? cleanNum(parts[5]) : null,
              counterparty: parts[3] || parts[2] || null,
            });
          }
        }
      } else if (bankFormat === "ing") {
        for (let i = 1; i < lines.length; i++) {
          const parts = parseCsvLine(lines[i], ";").map(cleanStr);
          if (parts.length >= 5 && parts[0].match(/\d{4}-\d{2}-\d{2}/)) {
            transactions.push({
              date: parts[0],
              description: parts[2] || parts[3] || "Transakcja",
              amount: cleanNum(parts[8] || parts[4]),
              balance: parts[9] ? cleanNum(parts[9]) : (parts[5] ? cleanNum(parts[5]) : null),
              counterparty: parts[4] || parts[3] || null,
            });
          }
        }
      } else if (bankFormat === "pekao") {
        let headerIdx = -1;
        let colDate = -1, colAmount = -1, colBalance = -1, colDesc = -1, colCounterparty = -1;
        for (let i = 0; i < Math.min(lines.length, 10); i++) {
          const lower = lines[i].toLowerCase();
          if (lower.includes("data") && (lower.includes("kwota") || lower.includes("operacj"))) {
            headerIdx = i;
            const cols = parseCsvLine(lines[i], ";").map(cleanStr);
            for (let c = 0; c < cols.length; c++) {
              const cl = cols[c].toLowerCase();
              if (cl.includes("data") && cl.includes("operacj")) colDate = c;
              else if (cl.includes("data") && cl.includes("ksieg")) { if (colDate < 0) colDate = c; }
              else if (cl.includes("data") && colDate < 0) colDate = c;
              else if (cl.includes("kwota")) colAmount = c;
              else if (cl.includes("saldo")) colBalance = c;
              else if (cl.includes("tytuł") || cl.includes("tytul") || cl.includes("opis")) { if (colDesc < 0) colDesc = c; }
              else if (cl.includes("nadawca") || cl.includes("odbiorca") || cl.includes("kontrahent") || cl.includes("nazwa")) { if (colCounterparty < 0) colCounterparty = c; }
            }
            break;
          }
        }
        if (headerIdx < 0) headerIdx = 0;
        if (colDate < 0) colDate = 0;
        if (colAmount < 0) colAmount = 3;
        if (colDesc < 0) colDesc = 2;

        for (let i = headerIdx + 1; i < lines.length; i++) {
          const parts = parseCsvLine(lines[i], ";").map(cleanStr);
          if (parts.length < 3) continue;
          const rawDate = parts[colDate] || "";
          let dateStr = rawDate;
          const dotMatch = rawDate.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
          if (dotMatch) {
            dateStr = `${dotMatch[3]}-${dotMatch[2]}-${dotMatch[1]}`;
          }
          const dashMatch = rawDate.match(/^(\d{2})-(\d{2})-(\d{4})$/);
          if (dashMatch) {
            dateStr = `${dashMatch[3]}-${dashMatch[2]}-${dashMatch[1]}`;
          }
          if (!dateStr.match(/\d{4}-\d{2}-\d{2}/)) continue;

          const amount = colAmount >= 0 && parts[colAmount] ? cleanNum(parts[colAmount]) : "0";
          const balance = colBalance >= 0 && parts[colBalance] ? cleanNum(parts[colBalance]) : null;
          const description = colDesc >= 0 ? (parts[colDesc] || "Transakcja") : "Transakcja";
          const counterparty = colCounterparty >= 0 ? (parts[colCounterparty] || null) : null;

          if (amount === "0" && !parts[colAmount]) continue;

          transactions.push({
            date: dateStr,
            description,
            amount,
            balance,
            counterparty: counterparty || description,
          });
        }
      } else if (bankFormat === "santander") {
        for (let i = 1; i < lines.length; i++) {
          const parts = parseCsvLine(lines[i], ",").map(cleanStr);
          if (parts.length < 4) {
            const semiParts = parseCsvLine(lines[i], ";").map(cleanStr);
            if (semiParts.length >= 4 && semiParts[0].match(/\d{2}-\d{2}-\d{4}/)) {
              const dp = semiParts[0].split("-");
              const dateStr = `${dp[2]}-${dp[1]}-${dp[0]}`;
              transactions.push({
                date: dateStr,
                description: semiParts[2] || semiParts[1] || "Transakcja",
                amount: cleanNum(semiParts[3]),
                balance: semiParts[4] ? cleanNum(semiParts[4]) : null,
                counterparty: semiParts[1] || null,
              });
            }
            continue;
          }
          if (parts[0].match(/\d{2}-\d{2}-\d{4}/)) {
            const dp = parts[0].split("-");
            const dateStr = `${dp[2]}-${dp[1]}-${dp[0]}`;
            transactions.push({
              date: dateStr,
              description: parts[2] || parts[1] || "Transakcja",
              amount: cleanNum(parts[5] || parts[3]),
              balance: parts[6] ? cleanNum(parts[6]) : (parts[4] ? cleanNum(parts[4]) : null),
              counterparty: parts[3] || parts[1] || null,
            });
          }
        }
      } else {
        for (let i = 1; i < lines.length; i++) {
          const parts = parseCsvLine(lines[i], ";").map(p => p.replace(/"/g, "").trim());
          if (parts.length >= 4) {
            transactions.push({
              date: parts[0] || new Date().toISOString().split("T")[0],
              description: parts[1] || parts[2] || "Transakcja",
              amount: parts[3]?.replace(/,/g, ".") || "0",
              balance: parts[4]?.replace(/,/g, ".") || null,
              counterparty: parts[2] || null,
            });
          }
        }
      }
      res.json({ transactions, rowCount: transactions.length, bankFormat });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/bank-transactions/ai-categorize", async (req, res) => {
    try {
      const { transactions } = req.body;
      if (!transactions || !Array.isArray(transactions)) {
        return res.status(400).json({ message: "Brak transakcji" });
      }
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });
      const prompt = `Jesteś asystentem finansowym zarządzającym wynajmem apartamentów. Kategoryzuj poniższe transakcje bankowe. Dostępne kategorie:
- CZYNSZ (opłaty czynszowe, wynajem)
- MEDIA (prąd, gaz, woda, ogrzewanie, internet)
- WYNAGRODZENIA (pensje, zlecenia)
- PODATKI (PIT, CIT, ZUS, składki)
- NAPRAWY (konserwacja, remonty, materiały)
- PRZYCHOD_REZERWACJA (wpływy od gości, Booking, Airbnb)
- PRZYCHOD_PODNAJEM (wpływy od podnajemców)
- UBEZPIECZENIE (polisy)
- ADMINISTRACJA (opłaty administracyjne, biuro, materiały biurowe)
- INNE (pozostałe)

Transakcje do kategoryzacji:
${transactions.map((t: any, i: number) => `${i + 1}. ${t.date} | ${t.amount} PLN | ${t.description} | ${t.counterparty || ""}`).join("\n")}

Odpowiedz TYLKO jako JSON array z obiektami { "index": number, "category": string, "confidence": number (0-1) }. Bez dodatkowego tekstu.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 2000,
      });

      const text = response.choices[0]?.message?.content || "[]";
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      const categories = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      res.json({ categories });
    } catch (err: any) {
      console.error("AI categorization error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/bank-statements/:id/ai-categorize", isAuthenticated, async (req, res) => {
    try {
      const statementId = parseInt(req.params.id);
      const allTx = await db.select().from(bankTransactions).where(eq(bankTransactions.statementId, statementId));
      const uncategorized = allTx.filter(t => !t.category && !t.aiCategory);
      if (uncategorized.length === 0) {
        return res.json({ updated: 0 });
      }
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });
      const prompt = `Jesteś asystentem finansowym zarządzającym wynajmem apartamentów. Kategoryzuj poniższe transakcje bankowe. Dostępne kategorie:
- CZYNSZ (opłaty czynszowe, wynajem)
- MEDIA (prąd, gaz, woda, ogrzewanie, internet)
- WYNAGRODZENIA (pensje, zlecenia)
- PODATKI (PIT, CIT, ZUS, składki)
- NAPRAWY (konserwacja, remonty, materiały)
- PRZYCHOD_REZERWACJA (wpływy od gości, Booking, Airbnb)
- PRZYCHOD_PODNAJEM (wpływy od podnajemców)
- UBEZPIECZENIE (polisy)
- ADMINISTRACJA (opłaty administracyjne, biuro, materiały biurowe)
- INNE (pozostałe)

Transakcje do kategoryzacji:
${uncategorized.map((t, i) => `${i + 1}. ${t.date} | ${t.amount} PLN | ${t.description} | ${t.counterparty || ""}`).join("\n")}

Odpowiedz TYLKO jako JSON array z obiektami { "index": number, "category": string, "confidence": number (0-1) }. Bez dodatkowego tekstu.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 2000,
      });
      const text = response.choices[0]?.message?.content || "[]";
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      const categories: { index: number; category: string; confidence: number }[] = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      let updated = 0;
      for (const cat of categories) {
        const idx = cat.index - 1;
        if (idx >= 0 && idx < uncategorized.length) {
          await db.update(bankTransactions).set({ aiCategory: cat.category }).where(eq(bankTransactions.id, uncategorized[idx].id));
          updated++;
        }
      }
      res.json({ updated });
    } catch (err: any) {
      console.error("AI categorization error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/accounts/:id/ai-categorize", isAuthenticated, async (req, res) => {
    try {
      const accountId = parseInt(req.params.id);
      const stmts = await storage.getBankStatements();
      const accountStmts = stmts.filter(s => s.accountId === accountId);
      if (accountStmts.length === 0) {
        return res.json({ updated: 0 });
      }
      let totalUpdated = 0;
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });
      for (const stmt of accountStmts) {
        const allTx = await db.select().from(bankTransactions).where(eq(bankTransactions.statementId, stmt.id));
        const uncategorized = allTx.filter(t => !t.category && !t.aiCategory);
        if (uncategorized.length === 0) continue;
        const prompt = `Jesteś asystentem finansowym zarządzającym wynajmem apartamentów. Kategoryzuj poniższe transakcje bankowe. Dostępne kategorie:
- CZYNSZ (opłaty czynszowe, wynajem)
- MEDIA (prąd, gaz, woda, ogrzewanie, internet)
- WYNAGRODZENIA (pensje, zlecenia)
- PODATKI (PIT, CIT, ZUS, składki)
- NAPRAWY (konserwacja, remonty, materiały)
- PRZYCHOD_REZERWACJA (wpływy od gości, Booking, Airbnb)
- PRZYCHOD_PODNAJEM (wpływy od podnajemców)
- UBEZPIECZENIE (polisy)
- ADMINISTRACJA (opłaty administracyjne, biuro, materiały biurowe)
- INNE (pozostałe)

Transakcje do kategoryzacji:
${uncategorized.map((t, i) => `${i + 1}. ${t.date} | ${t.amount} PLN | ${t.description} | ${t.counterparty || ""}`).join("\n")}

Odpowiedz TYLKO jako JSON array z obiektami { "index": number, "category": string, "confidence": number (0-1) }. Bez dodatkowego tekstu.`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
          max_tokens: 2000,
        });
        const text = response.choices[0]?.message?.content || "[]";
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        const categories: { index: number; category: string; confidence: number }[] = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        for (const cat of categories) {
          const idx = cat.index - 1;
          if (idx >= 0 && idx < uncategorized.length) {
            await db.update(bankTransactions).set({ aiCategory: cat.category }).where(eq(bankTransactions.id, uncategorized[idx].id));
            totalUpdated++;
          }
        }
      }
      res.json({ updated: totalUpdated });
    } catch (err: any) {
      console.error("AI categorization error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // ==================== BANK ASSIGNMENT TARGETS ====================
  app.get("/api/assignment-targets", async (req, res) => {
    try {
      const year = parseInt(req.query.year as string) || new Date().getFullYear();

      const opRows = await storage.getOpCostData(year);
      const aptRows = await storage.getAptCostData(year);
      const allSubleases = await storage.getSubleases();
      const apartments = await storage.getApartments();
      const catConfigStr = await storage.getAppConfig("op-cost-categories");
      let opCategories: { id: string; title: string; items: { name: string; subLabel?: string; archived?: boolean }[] }[] = [];
      if (catConfigStr) {
        try { opCategories = JSON.parse(catConfigStr); } catch {}
      }
      if (opCategories.length === 0) {
        const { DEFAULT_OPLATY_CATEGORIES } = await import("../shared/oplaty-defaults");
        opCategories = DEFAULT_OPLATY_CATEGORIES;
      }

      const operational: any[] = [];
      for (const cat of opCategories) {
        const items: any[] = [];
        for (let itemIdx = 0; itemIdx < cat.items.length; itemIdx++) {
          const item = cat.items[itemIdx];
          if (item.archived) continue;
          const realizedByMonth: Record<number, number> = {};
          for (const row of opRows) {
            if (row.catId === cat.id && row.itemIdx === itemIdx) {
              realizedByMonth[row.month] = Number(row.realized) || 0;
            }
          }
          items.push({
            catId: cat.id,
            itemIdx,
            name: item.name,
            subLabel: item.subLabel || null,
            realizedByMonth,
          });
        }
        if (items.length > 0) {
          operational.push({ catId: cat.id, title: cat.title, items });
        }
      }

      const aptSettingsRows = await storage.getAptCostSettings();
      const apartment_: any[] = [];
      const aptSettingsMap: Record<string, any> = {};
      for (const s of aptSettingsRows) {
        aptSettingsMap[s.entryId] = s;
      }
      const aptEntryIds = new Set<string>();
      for (const r of aptRows) { aptEntryIds.add(r.entryId); }
      for (const eid of Object.keys(aptSettingsMap)) { aptEntryIds.add(eid); }

      for (const entryId of aptEntryIds) {
        const settings = aptSettingsMap[entryId];
        const cats: string[] = settings?.categories || ["RATA DLA WŁAŚCICIELA", "CZYNSZ DO WSPÓLNOTY", "ENERGIA - ENERGA"];
        const catItems: any[] = [];
        for (const cat of cats) {
          const realizedByMonth: Record<number, number> = {};
          for (const row of aptRows) {
            if (row.entryId === entryId && row.category === cat) {
              realizedByMonth[row.month] = Number(row.realized) || 0;
            }
          }
          catItems.push({ category: cat, realizedByMonth });
        }
        let apt = apartments.find(a => a.name === entryId || a.id.toString() === entryId);
        if (!apt && entryId.startsWith("apt-")) {
          const numId = parseInt(entryId.replace("apt-", ""), 10);
          if (!isNaN(numId)) {
            apt = apartments.find(a => a.id === numId);
          }
        }
        if (!apt && entryId === "gb-all") {
          apt = undefined;
        }
        apartment_.push({
          entryId,
          name: entryId === "gb-all" ? "Grand Baltic (wszystkie)" : (apt?.name || entryId),
          location: apt?.location || null,
          categories: catItems,
        });
      }

      const subleaseTargets: any[] = [];
      for (const sub of allSubleases) {
        if (sub.status !== "AKTYWNA") continue;
        const payments = await storage.getSubleasePayments(sub.id);
        const unpaid = payments
          .filter(p => p.status === "do_oplacenia")
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        if (unpaid.length === 0) continue;
        const tenantName = sub.tenantType === "firma"
          ? (sub.companyName || "Firma")
          : `${sub.firstName || ""} ${sub.lastName || ""}`.trim();
        const aptNames = (sub.apartmentIds || [sub.apartmentId])
          .filter(Boolean)
          .map(id => apartments.find(a => a.id === id)?.name || `#${id}`)
          .join(", ");
        subleaseTargets.push({
          subleaseId: sub.id,
          tenantName,
          apartmentNames: aptNames,
          unpaidPayments: unpaid.map(p => ({
            id: p.id,
            title: p.title,
            category: p.category,
            amount: p.amount,
            dueDate: p.dueDate,
          })),
        });
      }

      res.json({ operational, apartment: apartment_, sublease: subleaseTargets });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/bank-transactions/import-to-targets", async (req, res) => {
    try {
      const { assignments } = req.body;
      if (!assignments || !Array.isArray(assignments)) {
        return res.status(400).json({ message: "Brak przypisań" });
      }

      const seenTxIds = new Set<number>();
      const results: any[] = [];

      for (const a of assignments) {
        if (!a.transactionId || !a.targetType) continue;
        if (seenTxIds.has(a.transactionId)) continue;
        seenTxIds.add(a.transactionId);

        const transaction = await storage.getBankTransactionById(a.transactionId);
        if (!transaction) continue;
        if (transaction.costImported || transaction.costSkipped) {
          results.push({ transactionId: a.transactionId, skipped: true, message: "Transakcja już przypisana lub pominięta" });
          continue;
        }

        const absAmount = Math.abs(parseFloat(transaction.amount));
        const txMonth = new Date(transaction.date).getMonth();
        const txYear = new Date(transaction.date).getFullYear();

        if (a.targetType === "operational") {
          const opRows = await storage.getOpCostData(txYear);
          const existing = opRows.find(r => r.catId === a.catId && r.itemIdx === a.itemIdx && r.month === txMonth);
          const currentRealized = Number(existing?.realized) || 0;

          if (Math.abs(currentRealized - absAmount) < 0.01 && currentRealized > 0) {
            results.push({
              transactionId: a.transactionId,
              duplicateWarning: true,
              currentRealized,
              importAmount: absAmount,
              message: `Pozycja ma już realizację ${currentRealized.toFixed(2)} zł — identyczna kwota.`,
            });
            continue;
          }

          const newRealized = currentRealized + absAmount;
          await storage.upsertOpCostCells([{
            year: txYear,
            catId: a.catId,
            itemIdx: a.itemIdx,
            month: txMonth,
            prognoza: existing?.prognoza ? Number(existing.prognoza) : undefined,
            realized: newRealized,
          }]);

          await storage.updateBankTransaction(a.transactionId, {
            costImported: true,
            costTargetType: "operational",
            costTargetCatId: a.catId,
            costTargetItemIdx: a.itemIdx,
          });

          results.push({ transactionId: a.transactionId, success: true, newRealized });

        } else if (a.targetType === "apartment") {
          const aptRows = await storage.getAptCostData(txYear);
          const existing = aptRows.find(r => r.entryId === a.entryId && r.category === a.category && r.month === txMonth);
          const currentRealized = Number(existing?.realized) || 0;

          if (Math.abs(currentRealized - absAmount) < 0.01 && currentRealized > 0) {
            results.push({
              transactionId: a.transactionId,
              duplicateWarning: true,
              currentRealized,
              importAmount: absAmount,
              message: `Pozycja ma już realizację ${currentRealized.toFixed(2)} zł — identyczna kwota.`,
            });
            continue;
          }

          const newRealized = currentRealized + absAmount;
          const currentPrognoza = Number(existing?.prognoza) || 0;
          await storage.upsertAptCostCells([{
            year: txYear,
            entryId: a.entryId,
            category: a.category,
            month: txMonth,
            prognoza: String(currentPrognoza),
            realized: String(newRealized),
          }]);

          await storage.updateBankTransaction(a.transactionId, {
            costImported: true,
            costTargetType: "apartment",
            costTargetEntryId: a.entryId,
            costTargetCategory: a.category,
          });

          results.push({ transactionId: a.transactionId, success: true, newRealized });

        } else if (a.targetType === "sublease") {
          const paymentId = a.subleasePaymentId;
          if (!paymentId) continue;

          if (!a.forceAmount) {
            const allSubleases = await storage.getSubleases();
            let targetPayment: { id: number; amount: string; status: string } | null = null;
            for (const sub of allSubleases) {
              const payments = await storage.getSubleasePayments(sub.id);
              const found = payments.find(p => p.id === paymentId);
              if (found) { targetPayment = found; break; }
            }

            if (targetPayment) {
              const paymentAmount = parseFloat(targetPayment.amount);
              if (Math.abs(paymentAmount - absAmount) > 0.01) {
                results.push({
                  transactionId: a.transactionId,
                  amountMismatch: true,
                  paymentAmount,
                  transactionAmount: absAmount,
                  paymentId,
                  message: `Kwota transakcji (${absAmount.toFixed(2)} zł) różni się od kwoty płatności (${paymentAmount.toFixed(2)} zł).`,
                });
                continue;
              }
            }
          }

          await storage.updateSubleasePayment(paymentId, { status: "oplacona" });

          await storage.updateBankTransaction(a.transactionId, {
            costImported: true,
            costTargetType: "sublease",
            costTargetSubleasePaymentId: paymentId,
          });

          results.push({ transactionId: a.transactionId, success: true });
        }

        if (a.forceAmount) continue;
        const rulePattern = transaction.counterparty?.trim() || transaction.description?.substring(0, 80)?.trim();
        if (rulePattern && rulePattern.length >= 3) {
          const existingRules = await storage.getBankMappingRules();
          const alreadyExists = existingRules.some(
            r => r.pattern.toLowerCase() === rulePattern.toLowerCase() &&
              r.targetType === a.targetType
          );
          if (!alreadyExists) {
            try {
              await storage.createBankMappingRule({
                pattern: rulePattern,
                matchField: transaction.counterparty?.trim() ? "counterparty" : "description",
                targetType: a.targetType,
                targetCatId: a.catId || null,
                targetItemIdx: a.itemIdx ?? null,
                targetEntryId: a.entryId || null,
                targetCategory: a.category || null,
                targetSubleaseId: a.subleaseId || null,
              });
            } catch (e) {}
          }
        }
      }

      res.json({ results });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/bank-transactions/confirm-duplicate-import", async (req, res) => {
    try {
      const { assignments } = req.body;
      if (!assignments || !Array.isArray(assignments)) {
        return res.status(400).json({ message: "Brak przypisań" });
      }

      const results: any[] = [];

      for (const a of assignments) {
        if (!a.transactionId || !a.targetType) continue;
        const transaction = await storage.getBankTransactionById(a.transactionId);
        if (!transaction) continue;

        const absAmount = Math.abs(parseFloat(transaction.amount));
        const txMonth = new Date(transaction.date).getMonth();
        const txYear = new Date(transaction.date).getFullYear();

        if (a.targetType === "operational") {
          const opRows = await storage.getOpCostData(txYear);
          const existing = opRows.find(r => r.catId === a.catId && r.itemIdx === a.itemIdx && r.month === txMonth);
          const currentRealized = Number(existing?.realized) || 0;
          const newRealized = currentRealized + absAmount;

          await storage.upsertOpCostCells([{
            year: txYear, catId: a.catId, itemIdx: a.itemIdx, month: txMonth,
            prognoza: existing?.prognoza ? Number(existing.prognoza) : undefined,
            realized: newRealized,
          }]);

          await storage.updateBankTransaction(a.transactionId, {
            costImported: true, costTargetType: "operational",
            costTargetCatId: a.catId, costTargetItemIdx: a.itemIdx,
          });

          results.push({ transactionId: a.transactionId, success: true, newRealized });

        } else if (a.targetType === "apartment") {
          const aptRows = await storage.getAptCostData(txYear);
          const existing = aptRows.find(r => r.entryId === a.entryId && r.category === a.category && r.month === txMonth);
          const currentRealized = Number(existing?.realized) || 0;
          const newRealized = currentRealized + absAmount;
          const currentPrognoza = Number(existing?.prognoza) || 0;

          await storage.upsertAptCostCells([{
            year: txYear, entryId: a.entryId, category: a.category, month: txMonth,
            prognoza: String(currentPrognoza), realized: String(newRealized),
          }]);

          await storage.updateBankTransaction(a.transactionId, {
            costImported: true, costTargetType: "apartment",
            costTargetEntryId: a.entryId, costTargetCategory: a.category,
          });

          results.push({ transactionId: a.transactionId, success: true, newRealized });
        }
      }

      res.json({ results });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/bank-transactions/skip", async (req, res) => {
    try {
      const { transactionIds } = req.body;
      if (!transactionIds || !Array.isArray(transactionIds)) {
        return res.status(400).json({ message: "Brak ID transakcji" });
      }
      for (const id of transactionIds) {
        await storage.updateBankTransaction(id, { costSkipped: true });
      }
      res.json({ success: true, count: transactionIds.length });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Bank Mapping Rules
  app.get("/api/bank-mapping-rules", async (_req, res) => {
    try {
      const rules = await storage.getBankMappingRules();
      res.json(rules);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/bank-mapping-rules", async (req, res) => {
    try {
      const rule = await storage.createBankMappingRule(req.body);
      res.json(rule);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/bank-mapping-rules/:id", async (req, res) => {
    try {
      await storage.deleteBankMappingRule(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ==================== PAYROLL ====================
  app.get("/api/payroll-periods", async (_req, res) => {
    try {
      const periods = await storage.getPayrollPeriods();
      res.json(periods);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/payroll-periods/:id", async (req, res) => {
    try {
      const period = await storage.getPayrollPeriod(parseInt(req.params.id));
      if (!period) return res.status(404).json({ message: "Nie znaleziono" });
      res.json(period);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/payroll-periods", async (req, res) => {
    try {
      const period = await storage.createPayrollPeriod(req.body);
      res.json(period);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/payroll-periods/:id", async (req, res) => {
    try {
      const updateData: any = { ...req.body };
      if (updateData.status === "ZATWIERDZONY" && !updateData.approvedAt) {
        updateData.approvedAt = new Date();
      }
      if (updateData.approvedAt === null) {
        updateData.approvedAt = null;
        updateData.approvedBy = null;
      }
      const period = await storage.updatePayrollPeriod(parseInt(req.params.id), updateData);
      res.json(period);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/payroll-periods/:id", async (req, res) => {
    try {
      await storage.deletePayrollPeriod(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/payroll-entries/:periodId", async (req, res) => {
    try {
      const entries = await storage.getPayrollEntries(parseInt(req.params.periodId));
      res.json(entries);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/payroll-entries", async (req, res) => {
    try {
      const entry = await storage.createPayrollEntry(req.body);
      res.json(entry);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/payroll-entries/:id", async (req, res) => {
    try {
      const entry = await storage.updatePayrollEntry(parseInt(req.params.id), req.body);
      res.json(entry);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/payroll-entries/:id", async (req, res) => {
    try {
      await storage.deletePayrollEntry(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/payroll-periods/:id/generate", async (req, res) => {
    try {
      const periodId = parseInt(req.params.id);
      const period = await storage.getPayrollPeriod(periodId);
      if (!period) return res.status(404).json({ message: "Nie znaleziono okresu" });

      const allEmployees = await storage.getEmployees();
      const activeEmployees = allEmployees.filter(e => e.status === "AKTYWNY");
      const { startDate, endDate } = req.body;

      const entries: any[] = [];
      for (const emp of activeEmployees) {
        const timeEntries = await storage.getTimeEntries({ employeeId: emp.id, from: startDate, to: endDate });
        let totalMinutes = 0;
        for (const te of timeEntries) {
          if (te.clockOut) {
            const diff = new Date(te.clockOut).getTime() - new Date(te.clockIn).getTime();
            totalMinutes += diff / 60000 - (te.breakMinutes || 0);
          }
        }
        const totalHours = Math.round(totalMinutes / 60 * 100) / 100;
        const overtimeHours = Math.max(0, totalHours - 160);
        const rate = parseFloat(emp.hourlyRate || "0");
        const basePay = Math.round(Math.min(totalHours, 160) * rate * 100) / 100;
        const overtimePay = Math.round(overtimeHours * rate * 1.5 * 100) / 100;
        const grossPay = basePay + overtimePay;
        const netPay = Math.round(grossPay * 0.77 * 100) / 100;

        entries.push({
          periodId,
          employeeId: emp.id,
          totalHours: String(totalHours),
          overtimeHours: String(overtimeHours),
          hourlyRate: emp.hourlyRate || "0",
          basePay: String(basePay),
          overtimePay: String(overtimePay),
          bonus: "0",
          deductions: "0",
          grossPay: String(grossPay),
          netPay: String(netPay),
        });
      }

      const created = await storage.createPayrollEntriesBulk(entries);
      const totalGross = entries.reduce((s, e) => s + parseFloat(e.grossPay), 0);
      const totalNet = entries.reduce((s, e) => s + parseFloat(e.netPay), 0);
      await storage.updatePayrollPeriod(periodId, {
        totalGross: String(totalGross),
        totalNet: String(totalNet),
        status: "WYGENEROWANY",
      });

      res.json({ entries: created, totalGross, totalNet });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ==================== CHECKOUT SETTLEMENTS ====================
  app.get("/api/checkout-settlements", async (_req, res) => {
    try {
      const settlements = await storage.getCheckoutSettlements();
      res.json(settlements);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/checkout-settlements/:id", async (req, res) => {
    try {
      const settlement = await storage.getCheckoutSettlement(parseInt(req.params.id));
      if (!settlement) return res.status(404).json({ message: "Nie znaleziono" });
      res.json(settlement);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/checkout-settlements", async (req, res) => {
    try {
      const settlement = await storage.createCheckoutSettlement(req.body);
      res.json(settlement);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/checkout-settlements/:id", async (req, res) => {
    try {
      const settlement = await storage.updateCheckoutSettlement(parseInt(req.params.id), req.body);
      res.json(settlement);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/checkout-settlements/:id", async (req, res) => {
    try {
      await storage.deleteCheckoutSettlement(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ==================== DASHBOARD WIDGETS ====================
  app.get("/api/dashboard-widgets", async (req, res) => {
    try {
      const userId = (req as any).user?.id || "default";
      const widgets = await storage.getDashboardWidgets(userId);
      res.json(widgets);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/dashboard-widgets", async (req, res) => {
    try {
      const userId = (req as any).user?.id || "default";
      const result = await storage.saveDashboardWidgets(userId, req.body.widgets);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ==================== CRM STAY HISTORY ====================
  app.get("/api/customers/:id/stay-history", async (req, res) => {
    try {
      const customer = await storage.getCustomer(parseInt(req.params.id));
      if (!customer) return res.status(404).json({ message: "Nie znaleziono klienta" });

      const allReservations = await storage.getReservations({});
      const fullName = `${customer.firstName} ${customer.lastName}`.toLowerCase();
      const matched = allReservations.filter(r => {
        const gn = (r.guestName || "").toLowerCase();
        return gn === fullName || gn.includes(customer.lastName.toLowerCase());
      });

      const apartments = await storage.getApartments();
      const aptMap = new Map(apartments.map(a => [a.id, a.name]));

      const history = matched.map(r => ({
        id: r.id,
        reservationNumber: r.reservationNumber,
        apartmentId: r.apartmentId,
        apartmentName: r.apartmentId ? aptMap.get(r.apartmentId) || "Nieznane" : "Nieznane",
        startDate: r.startDate,
        endDate: r.endDate,
        price: r.price,
        status: r.status,
        source: r.source,
      })).sort((a, b) => b.startDate.localeCompare(a.startDate));

      const totalRevenue = matched.reduce((s, r) => s + parseFloat(r.price || "0"), 0);
      const totalStays = matched.length;

      res.json({ history, totalRevenue, totalStays });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ==================== RCP EMPLOYEE STATS ====================
  app.get("/api/rcp/employee-stats", async (req, res) => {
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
        : allEmployees.filter(e => e.status === "AKTYWNY");

      const stats = activeEmps.map(emp => {
        const empEntries = allEntries.filter(e => e.employeeId === emp.id);
        const completedEntries = empEntries.filter(e => e.clockOut);

        let totalMinutes = 0;
        let lateCount = 0;
        let earlyLeaveCount = 0;
        const dailyHours: number[] = [];

        for (const entry of completedEntries) {
          const clockIn = new Date(entry.clockIn);
          const clockOut = new Date(entry.clockOut!);
          const mins = (clockOut.getTime() - clockIn.getTime()) / 60000 - (entry.breakMinutes || 0);
          totalMinutes += mins;
          dailyHours.push(mins / 60);

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
          outsideZoneCount: empEntries.filter(e => e.isOutsideZone).length,
        };
      });

      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/rcp/monthly-trend", isAuthenticated, async (req, res) => {
    try {
      const months = Number(req.query.months) || 6;
      const now = new Date();
      const allEmployees = await storage.getEmployees();
      const activeEmployees = allEmployees.filter(e => e.status === "AKTYWNY");

      const trend: any[] = [];
      const monthNames = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];

      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = d.getMonth();
        const firstDay = `${y}-${String(m + 1).padStart(2, "0")}-01`;
        const lastDayNum = new Date(y, m + 1, 0).getDate();
        const lastDay = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDayNum).padStart(2, "0")}`;

        const entries = await storage.getTimeEntries({ from: firstDay, to: lastDay });
        const schedules = await storage.getWorkSchedules({ from: firstDay, to: lastDay });
        const scheduleMap = new Map<string, any>();
        for (const s of schedules) {
          scheduleMap.set(`${s.employeeId}-${s.date}`, s);
        }

        let totalLate = 0;
        let totalOvertimeMin = 0;
        let totalWorkMin = 0;
        let totalMissedClockIns = 0;

        for (const entry of entries) {
          if (entry.clockIn && entry.clockOut) {
            const workMs = new Date(entry.clockOut).getTime() - new Date(entry.clockIn).getTime();
            const workMin = Math.round(workMs / 60000) - (entry.breakMinutes || 0);
            totalWorkMin += workMin;
            if (workMin > 480) totalOvertimeMin += workMin - 480;

            const sched = scheduleMap.get(`${entry.employeeId}-${entry.date}`);
            if (sched && sched.startTime) {
              const [sh, sm] = sched.startTime.split(":").map(Number);
              const schedTime = new Date(`${entry.date}T${String(sh).padStart(2, "0")}:${String(sm).padStart(2, "0")}:00`);
              const clockIn = new Date(entry.clockIn);
              const diff = Math.round((clockIn.getTime() - schedTime.getTime()) / 60000);
              if (diff > 5) totalLate++;
            }
          }
        }

        for (let day = 1; day <= lastDayNum; day++) {
          const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dateObj = new Date(dateStr + "T12:00:00");
          const dow = dateObj.getDay();
          if (dow === 0 || dow === 6) continue;
          if (new Date(dateStr) > now) continue;

          for (const emp of activeEmployees) {
            const sched = scheduleMap.get(`${emp.id}-${dateStr}`);
            if (sched) {
              const hasEntry = entries.some(e => e.employeeId === emp.id && e.date === dateStr);
              if (!hasEntry) totalMissedClockIns++;
            }
          }
        }

        trend.push({
          month: `${monthNames[m]} ${y}`,
          lateCount: totalLate,
          overtimeHours: Math.round(totalOvertimeMin / 60 * 10) / 10,
          totalWorkHours: Math.round(totalWorkMin / 60 * 10) / 10,
          missedClockIns: totalMissedClockIns,
        });
      }

      res.json(trend);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/rcp/missing-clockins", isAuthenticated, async (_req, res) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const allEmployees = await storage.getEmployees();
      const activeEmployees = allEmployees.filter(e => e.status === "AKTYWNY");
      const todaySchedules = await storage.getWorkSchedules({ from: today, to: today });
      const todayEntries = await storage.getTimeEntriesByDay(today);

      const now = new Date();
      const missing: any[] = [];

      for (const sched of todaySchedules) {
        const emp = activeEmployees.find(e => e.id === sched.employeeId);
        if (!emp) continue;
        const hasEntry = todayEntries.some(e => e.employeeId === sched.employeeId);
        if (!hasEntry) {
          const [sh, sm] = sched.startTime.split(":").map(Number);
          const schedTime = new Date(`${today}T${String(sh).padStart(2, "0")}:${String(sm).padStart(2, "0")}:00`);
          const diffMin = Math.round((now.getTime() - schedTime.getTime()) / 60000);
          if (diffMin > 0) {
            missing.push({
              employeeId: emp.id,
              employeeName: `${emp.firstName} ${emp.lastName}`,
              position: emp.position,
              scheduledStart: sched.startTime,
              minutesOverdue: diffMin,
            });
          }
        }
      }

      res.json(missing);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/legal-cases", isAuthenticated, async (req: any, res) => {
    try {
      const { status, caseType, priority, search } = req.query;
      const conditions: any[] = [];
      if (status) conditions.push(eq(legalCases.status, status as string));
      if (caseType) conditions.push(eq(legalCases.caseType, caseType as string));
      if (priority) conditions.push(eq(legalCases.priority, priority as string));
      if (search) {
        const term = `%${search}%`;
        conditions.push(or(
          ilike(legalCases.title, term),
          ilike(legalCases.caseNumber, term),
          ilike(legalCases.opposingParty, term),
        ));
      }
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const results = await db.select().from(legalCases).where(where).orderBy(desc(legalCases.createdAt));
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/legal-cases/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const [legalCase] = await db.select().from(legalCases).where(eq(legalCases.id, id));
      if (!legalCase) return res.status(404).json({ message: "Sprawa nie znaleziona" });
      const events = await db.select().from(legalCaseEvents)
        .where(eq(legalCaseEvents.legalCaseId, id))
        .orderBy(desc(legalCaseEvents.eventDate));
      res.json({ ...legalCase, events });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/legal-cases", isAuthenticated, async (req: any, res) => {
    try {
      const parsed = insertLegalCaseSchema.parse(req.body);
      const [created] = await db.insert(legalCases).values(parsed).returning();
      await logActivity(req, "CREATE", "legal_case", created.id, created.title, `Utworzono sprawę sądową: ${created.title}`);
      res.status(201).json(created);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: "Błąd walidacji", errors: err.errors });
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/legal-cases/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const [existing] = await db.select().from(legalCases).where(eq(legalCases.id, id));
      if (!existing) return res.status(404).json({ message: "Sprawa nie znaleziona" });
      const parsed = insertLegalCaseSchema.partial().parse(req.body);
      const [updated] = await db.update(legalCases)
        .set({ ...parsed, updatedAt: new Date() })
        .where(eq(legalCases.id, id))
        .returning();
      await logActivity(req, "UPDATE", "legal_case", updated.id, updated.title, `Zaktualizowano sprawę sądową: ${updated.title}`);
      res.json(updated);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: "Błąd walidacji", errors: err.errors });
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/legal-cases/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const [existing] = await db.select().from(legalCases).where(eq(legalCases.id, id));
      if (!existing) return res.status(404).json({ message: "Sprawa nie znaleziona" });
      await db.delete(legalCases).where(eq(legalCases.id, id));
      await logActivity(req, "DELETE", "legal_case", id, existing.title, `Usunięto sprawę sądową: ${existing.title}`);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/legal-cases/:id/events", isAuthenticated, async (req: any, res) => {
    try {
      const legalCaseId = parseInt(req.params.id);
      const events = await db.select().from(legalCaseEvents)
        .where(eq(legalCaseEvents.legalCaseId, legalCaseId))
        .orderBy(desc(legalCaseEvents.eventDate));
      res.json(events);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/legal-cases/:id/events", isAuthenticated, async (req: any, res) => {
    try {
      const legalCaseId = parseInt(req.params.id);
      const [parentCase] = await db.select().from(legalCases).where(eq(legalCases.id, legalCaseId));
      if (!parentCase) return res.status(404).json({ message: "Sprawa nie znaleziona" });
      const parsed = insertLegalCaseEventSchema.parse({ ...req.body, legalCaseId });
      const [created] = await db.insert(legalCaseEvents).values(parsed).returning();
      await db.update(legalCases).set({ updatedAt: new Date() }).where(eq(legalCases.id, legalCaseId));
      await logActivity(req, "CREATE", "legal_case_event", created.id, created.title, `Dodano zdarzenie do sprawy: ${parentCase.title}`);
      res.status(201).json(created);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: "Błąd walidacji", errors: err.errors });
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/legal-case-events/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const [existing] = await db.select().from(legalCaseEvents).where(eq(legalCaseEvents.id, id));
      if (!existing) return res.status(404).json({ message: "Zdarzenie nie znalezione" });
      const parsed = insertLegalCaseEventSchema.partial().parse(req.body);
      const [updated] = await db.update(legalCaseEvents)
        .set(parsed)
        .where(eq(legalCaseEvents.id, id))
        .returning();
      await db.update(legalCases).set({ updatedAt: new Date() }).where(eq(legalCases.id, existing.legalCaseId));
      await logActivity(req, "UPDATE", "legal_case_event", updated.id, updated.title, `Zaktualizowano zdarzenie: ${updated.title}`);
      res.json(updated);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: "Błąd walidacji", errors: err.errors });
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/legal-case-events/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const [existing] = await db.select().from(legalCaseEvents).where(eq(legalCaseEvents.id, id));
      if (!existing) return res.status(404).json({ message: "Zdarzenie nie znalezione" });
      await db.delete(legalCaseEvents).where(eq(legalCaseEvents.id, id));
      await db.update(legalCases).set({ updatedAt: new Date() }).where(eq(legalCases.id, existing.legalCaseId));
      await logActivity(req, "DELETE", "legal_case_event", id, existing.title, `Usunięto zdarzenie: ${existing.title}`);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/legal-case-events/:id/upload", isAuthenticated, upload.single("file"), async (req: any, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const [event] = await db.select().from(legalCaseEvents).where(eq(legalCaseEvents.id, eventId));
      if (!event) return res.status(404).json({ message: "Zdarzenie nie znalezione" });
      if (!req.file) return res.status(400).json({ message: "Brak pliku" });

      const fileName = req.file.originalname;
      const objectPath = `legal-cases/events/${eventId}/${Date.now()}_${fileName}`;

      const { Client } = await import("@replit/object-storage");
      const client = new Client();
      await client.uploadFromBytes(objectPath, req.file.buffer);

      const currentUrls = event.documentUrls || [];
      const updatedUrls = [...currentUrls, objectPath];
      await db.update(legalCaseEvents).set({ documentUrls: updatedUrls }).where(eq(legalCaseEvents.id, eventId));
      await db.update(legalCases).set({ updatedAt: new Date() }).where(eq(legalCases.id, event.legalCaseId));

      res.json({ objectPath, fileName });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/legal-case-events/:id/attachments", isAuthenticated, async (req: any, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const { objectPath } = req.body;
      if (!objectPath) return res.status(400).json({ message: "Brak ścieżki pliku" });

      const [event] = await db.select().from(legalCaseEvents).where(eq(legalCaseEvents.id, eventId));
      if (!event) return res.status(404).json({ message: "Zdarzenie nie znalezione" });

      const updatedUrls = (event.documentUrls || []).filter((u: string) => u !== objectPath);
      await db.update(legalCaseEvents).set({ documentUrls: updatedUrls }).where(eq(legalCaseEvents.id, eventId));

      try {
        const { Client } = await import("@replit/object-storage");
        const client = new Client();
        await client.delete(objectPath);
      } catch {}

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/legal-case-files", isAuthenticated, async (req: any, res) => {
    try {
      const objectPath = req.query.path as string;
      if (!objectPath || !objectPath.startsWith("legal-cases/")) {
        return res.status(400).json({ message: "Nieprawidłowa ścieżka" });
      }
      const { Client } = await import("@replit/object-storage");
      const client = new Client();
      const result = await client.downloadAsBytes(objectPath);
      if (!result.ok) return res.status(404).json({ message: "Plik nie znaleziony" });
      const fileName = objectPath.split("/").pop() || "file";
      const cleanName = fileName.replace(/^\d+_/, "");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(cleanName)}"`);
      res.setHeader("Content-Type", "application/octet-stream");
      res.send(Buffer.from(result.value));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/legal-cases/:id/documents", isAuthenticated, upload.single("file"), async (req: any, res) => {
    try {
      const legalCaseId = parseInt(req.params.id);
      const [parentCase] = await db.select().from(legalCases).where(eq(legalCases.id, legalCaseId));
      if (!parentCase) return res.status(404).json({ message: "Sprawa nie znaleziona" });

      if (!req.file) return res.status(400).json({ message: "Brak pliku" });

      const fileName = req.file.originalname;
      const objectPath = `legal-cases/${legalCaseId}/${Date.now()}_${fileName}`;

      const { Client } = await import("@replit/object-storage");
      const client = new Client();
      await client.uploadFromBytes(objectPath, req.file.buffer);

      const currentUrls = parentCase.documentUrls || [];
      const updatedUrls = [...currentUrls, objectPath];
      await db.update(legalCases)
        .set({ documentUrls: updatedUrls, updatedAt: new Date() })
        .where(eq(legalCases.id, legalCaseId));

      await logActivity(req, "UPLOAD", "legal_case", legalCaseId, parentCase.title, `Dodano dokument: ${fileName}`);
      res.json({ objectPath, fileName });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/admin/bootstrap-production', async (req, res) => {
    try {
      const key = req.headers['x-bootstrap-key'];
      if (key !== 'BaltFinBootstrap2026!') {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const bcrypt = await import('bcryptjs');
      const results: string[] = [];

      const existingUser = await db.execute(sql`SELECT id FROM users WHERE email = 'mateusz.cieslak@baltyckie.pl'`);
      if (existingUser.rows.length === 0) {
        const hash = await bcrypt.hash('AudiA72025!', 10);
        await db.execute(sql`
          INSERT INTO users (id, email, first_name, last_name, password_hash, created_at, updated_at)
          VALUES ('mateusz-cieslak-admin', 'mateusz.cieslak@baltyckie.pl', 'Mateusz', 'Cieślak', ${hash}, NOW(), NOW())
        `);
        results.push('User mateusz.cieslak@baltyckie.pl created');
      } else {
        results.push('User mateusz.cieslak@baltyckie.pl already exists');
      }

      const existingAppUser = await db.execute(sql`SELECT id FROM app_users WHERE email = 'mateusz.cieslak@baltyckie.pl'`);
      if (existingAppUser.rows.length === 0) {
        const hash = await bcrypt.hash('AudiA72025!', 10);
        await db.execute(sql`
          INSERT INTO app_users (email, first_name, last_name, password_hash, active, permissions)
          VALUES ('mateusz.cieslak@baltyckie.pl', 'Mateusz', 'Cieślak', ${hash}, true, ARRAY['admin'])
        `);
        results.push('App user mateusz.cieslak@baltyckie.pl created');
      } else {
        results.push('App user mateusz.cieslak@baltyckie.pl already exists');
      }

      await db.execute(sql`DELETE FROM sublease_meter_readings WHERE sublease_id IN (4, 15)`);
      await db.execute(sql`DELETE FROM sublease_meter_settings WHERE sublease_id IN (4, 15)`);
      results.push('Cleaned test meter data for subleases 4 and 15');

      const XLSX_LIB = (await import('xlsx')).default || (await import('xlsx'));
      const filePath = path.join(process.cwd(), 'attached_assets', 'podnajem_1772620255156.xlsx');
      if (!fs.existsSync(filePath)) {
        results.push('Excel file not found at ' + filePath);
        return res.json({ results });
      }

      const wb = XLSX_LIB.readFile(filePath);
      const excelDate = (serial: number) => new Date((serial - 25569) * 86400000).toISOString().slice(0, 10);

      const LOKAL_MAP: Record<string, number> = {
        'NA WYDMIE 7/2': 4, 'NA WYDMIE 8/21': 9, 'NA WYDMIE 7/23': 9,
        'NA WYDMIE 8/32': 3, 'NA WYDMIE 7/1': 14, 'NA WYDMIE 8/36': 15, 'NA WYDMIE 8/26': 15,
      };

      const waterSheet = XLSX_LIB.utils.sheet_to_json(wb.Sheets['woda'], { header: 1 }) as any[][];
      const energySheet = XLSX_LIB.utils.sheet_to_json(wb.Sheets['energia'], { header: 1 }) as any[][];

      interface ReadingRow { subleaseId: number; from: string; to: string; start: number; end: number | null; }
      const grouped: Record<string, Record<string, ReadingRow[]>> = {};

      for (let i = 1; i < waterSheet.length; i++) {
        const r = waterSheet[i];
        if (!r || !r[0] || typeof r[0] !== 'string') continue;
        const from = excelDate(r[3]);
        if (from < '2025-09-01') continue;
        const sid = LOKAL_MAP[r[2]];
        if (!sid) continue;
        const key = String(sid);
        if (!grouped[key]) grouped[key] = {};
        if (!grouped[key]['cold_water']) grouped[key]['cold_water'] = [];
        if (!grouped[key]['hot_water']) grouped[key]['hot_water'] = [];
        grouped[key]['cold_water'].push({ subleaseId: sid, from, to: excelDate(r[4]), start: r[5], end: r[6] });
        grouped[key]['hot_water'].push({ subleaseId: sid, from, to: excelDate(r[4]), start: r[7], end: r[8] });
      }

      for (let i = 1; i < energySheet.length; i++) {
        const r = energySheet[i];
        if (!r || !r[0] || typeof r[0] === 'number') continue;
        const tenant = String(r[0]).trim();
        if (!tenant) continue;
        if (typeof r[3] !== 'number') continue;
        const from = excelDate(r[3]);
        if (from < '2025-09-01') continue;
        const sid = LOKAL_MAP[r[2]];
        if (!sid) continue;
        const key = String(sid);
        if (!grouped[key]) grouped[key] = {};
        if (!grouped[key]['electricity']) grouped[key]['electricity'] = [];
        grouped[key]['electricity'].push({ subleaseId: sid, from, to: typeof r[4] === 'number' ? excelDate(r[4]) : from, start: r[5], end: r[6] != null ? r[6] : null });
      }

      let totalSettings = 0, totalReadings = 0;

      for (const [sidStr, types] of Object.entries(grouped)) {
        const sid = parseInt(sidStr);
        for (const [meterType, rows] of Object.entries(types)) {
          const sorted = rows.sort((a, b) => a.from.localeCompare(b.from));
          const existingSetting = await db.execute(sql`SELECT id FROM sublease_meter_settings WHERE sublease_id = ${sid} AND meter_type = ${meterType}`);
          if (existingSetting.rows.length === 0 && sorted.length > 0) {
            const first = sorted[0];
            await db.execute(sql`
              INSERT INTO sublease_meter_settings (sublease_id, meter_type, unit_price, initial_reading, initial_date)
              VALUES (${sid}, ${meterType}, 0, ${String(first.start) + '.000'}, ${first.from})
            `);
            totalSettings++;
          }

          for (const row of sorted) {
            if (row.end === null || row.end === undefined) continue;
            const existingReading = await db.execute(sql`
              SELECT id FROM sublease_meter_readings WHERE sublease_id = ${sid} AND meter_type = ${meterType} AND reading_date = ${row.to}
            `);
            if (existingReading.rows.length === 0) {
              await db.execute(sql`
                INSERT INTO sublease_meter_readings (sublease_id, meter_type, reading, reading_date, status)
                VALUES (${sid}, ${meterType}, ${String(row.end) + '.000'}, ${row.to}, 'confirmed')
              `);
              totalReadings++;
            }
          }
        }
      }

      results.push(`Imported ${totalSettings} meter settings, ${totalReadings} meter readings`);

      res.json({ success: true, results });
    } catch (err: any) {
      console.error('[BOOTSTRAP]', err);
      res.status(500).json({ message: err.message });
    }
  });

  // ==================== GOCARDLESS — INTEGRACJA BANKOWA ====================

  app.get("/api/gocardless/status", isAuthenticated, async (_req, res) => {
    res.json({ configured: gocardless.isConfigured() });
  });

  app.get("/api/gocardless/institutions", isAuthenticated, async (_req, res) => {
    try {
      if (!gocardless.isConfigured()) {
        return res.status(400).json({ message: "GoCardless nie jest skonfigurowany. Ustaw GOCARDLESS_SECRET_ID i GOCARDLESS_SECRET_KEY." });
      }
      const institutions = await gocardless.listInstitutions("pl");
      res.json(institutions);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/gocardless/connect", isAuthenticated, async (req, res) => {
    try {
      if (!gocardless.isConfigured()) {
        return res.status(400).json({ message: "GoCardless nie jest skonfigurowany." });
      }
      const { institutionId, institutionName } = req.body;
      if (!institutionId || !institutionName) {
        return res.status(400).json({ message: "Brak institutionId lub institutionName" });
      }
      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      const redirectUrl = `${protocol}://${host}/api/gocardless/callback`;
      const requisition = await gocardless.createRequisition(institutionId, redirectUrl);
      await storage.createGocardlessConnection({
        institutionId,
        institutionName,
        requisitionId: requisition.id,
        status: "PENDING",
      });
      res.json({ link: requisition.link, requisitionId: requisition.id });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/gocardless/callback", async (req, res) => {
    try {
      const ref = req.query.ref as string;
      if (!ref) {
        return res.redirect("/bank-connections?error=brak_ref");
      }
      const connections = await storage.getGocardlessConnections();
      const conn = connections.find(c => c.requisitionId === ref || c.requisitionId.startsWith(ref.substring(0, 8)));
      if (!conn) {
        const allConns = await storage.getGocardlessConnections();
        const pendingConn = allConns.find(c => c.status === "PENDING");
        if (!pendingConn) {
          return res.redirect("/bank-connections?error=nie_znaleziono");
        }
        const requisition = await gocardless.getRequisition(pendingConn.requisitionId);
        if (requisition.accounts && requisition.accounts.length > 0) {
          const gcAccountId = requisition.accounts[0];
          let iban: string | null = null;
          try {
            const details = await gocardless.getAccountDetails(gcAccountId);
            iban = details.iban || null;
          } catch (e) {}
          await storage.updateGocardlessConnection(pendingConn.id, {
            accountId: gcAccountId,
            iban,
            status: "ACTIVE",
          });
        } else {
          await storage.updateGocardlessConnection(pendingConn.id, { status: "ERROR" });
        }
        return res.redirect("/bank-connections?success=1");
      }
      const requisition = await gocardless.getRequisition(conn.requisitionId);
      if (requisition.accounts && requisition.accounts.length > 0) {
        const gcAccountId = requisition.accounts[0];
        let iban: string | null = null;
        try {
          const details = await gocardless.getAccountDetails(gcAccountId);
          iban = details.iban || null;
        } catch (e) {}
        await storage.updateGocardlessConnection(conn.id, {
          accountId: gcAccountId,
          iban,
          status: "ACTIVE",
        });
      } else {
        await storage.updateGocardlessConnection(conn.id, { status: "ERROR" });
      }
      res.redirect("/bank-connections?success=1");
    } catch (err: any) {
      console.error("[GoCardless callback error]", err);
      res.redirect("/bank-connections?error=callback_error");
    }
  });

  app.get("/api/gocardless/connections", isAuthenticated, async (_req, res) => {
    try {
      const connections = await storage.getGocardlessConnections();
      res.json(connections);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/gocardless/connections/:id", isAuthenticated, async (req, res) => {
    try {
      const conn = await storage.getGocardlessConnection(parseInt(req.params.id));
      if (conn) {
        try {
          await gocardless.deleteRequisition(conn.requisitionId);
        } catch (e) {}
      }
      await storage.deleteGocardlessConnection(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/gocardless/sync/:connectionId", isAuthenticated, async (req, res) => {
    try {
      const connId = parseInt(req.params.connectionId);
      const conn = await storage.getGocardlessConnection(connId);
      if (!conn) return res.status(404).json({ message: "Połączenie nie znalezione" });
      if (!conn.accountId) return res.status(400).json({ message: "Konto nie zostało jeszcze autoryzowane" });
      if (conn.status !== "ACTIVE") return res.status(400).json({ message: "Połączenie nie jest aktywne" });

      const dateFrom = conn.lastSyncAt
        ? new Date(conn.lastSyncAt).toISOString().split("T")[0]
        : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const dateTo = new Date().toISOString().split("T")[0];

      const txData = await gocardless.getAccountTransactions(conn.accountId, dateFrom, dateTo);
      const bookedTxs = txData.booked || [];

      let imported = 0;
      let skipped = 0;

      if (bookedTxs.length > 0 && conn.localAccountId) {
        const txItems = bookedTxs.map(tx => ({
          date: tx.bookingDate,
          amount: tx.transactionAmount.amount,
          description: gocardless.getTransactionDescription(tx),
        }));
        const duplicates = await storage.checkDuplicateTransactions(conn.localAccountId, txItems);
        const dupSet = new Set(duplicates.map(d => `${d.date}|${d.amount}|${d.description}`));

        const newTxs = bookedTxs.filter(tx => {
          const key = `${tx.bookingDate}|${tx.transactionAmount.amount}|${gocardless.getTransactionDescription(tx)}`;
          return !dupSet.has(key);
        });

        if (newTxs.length > 0) {
          const statement = await storage.createBankStatement({
            accountId: conn.localAccountId,
            fileName: `GoCardless-${conn.institutionName}-${dateTo}`,
            startDate: dateFrom,
            endDate: dateTo,
            transactionCount: newTxs.length,
            status: "ZAIMPORTOWANY",
          });

          const bulkData = newTxs.map(tx => ({
            statementId: statement.id,
            accountId: conn.localAccountId!,
            date: tx.bookingDate,
            description: gocardless.getTransactionDescription(tx),
            amount: tx.transactionAmount.amount,
            balance: null as string | null,
            counterparty: gocardless.getTransactionCounterparty(tx) || null,
            category: null as string | null,
          }));

          await storage.createBankTransactionsBulk(bulkData);
          imported = newTxs.length;
        }
        skipped = bookedTxs.length - imported;
      } else if (bookedTxs.length > 0 && !conn.localAccountId) {
        imported = 0;
        skipped = bookedTxs.length;
      }

      await storage.updateGocardlessConnection(connId, {
        lastSyncAt: new Date(),
      });

      let balanceInfo = null;
      try {
        const balances = await gocardless.getAccountBalances(conn.accountId);
        if (balances.length > 0) {
          balanceInfo = {
            amount: balances[0].balanceAmount.amount,
            currency: balances[0].balanceAmount.currency,
            type: balances[0].balanceType,
          };
        }
      } catch (e) {}

      res.json({
        imported,
        skipped,
        total: bookedTxs.length,
        balance: balanceInfo,
      });
    } catch (err: any) {
      console.error("[GoCardless sync error]", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/gocardless/sync-all", isAuthenticated, async (_req, res) => {
    try {
      const connections = await storage.getGocardlessConnections();
      const activeConns = connections.filter(c => c.status === "ACTIVE" && c.accountId);
      const results: { connectionId: number; institutionName: string; imported: number; skipped: number; error?: string }[] = [];

      for (const conn of activeConns) {
        try {
          const dateFrom = conn.lastSyncAt
            ? new Date(conn.lastSyncAt).toISOString().split("T")[0]
            : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
          const dateTo = new Date().toISOString().split("T")[0];

          const txData = await gocardless.getAccountTransactions(conn.accountId!, dateFrom, dateTo);
          const bookedTxs = txData.booked || [];
          let imported = 0;

          if (bookedTxs.length > 0 && conn.localAccountId) {
            const txItems = bookedTxs.map(tx => ({
              date: tx.bookingDate,
              amount: tx.transactionAmount.amount,
              description: gocardless.getTransactionDescription(tx),
            }));
            const duplicates = await storage.checkDuplicateTransactions(conn.localAccountId, txItems);
            const dupSet = new Set(duplicates.map(d => `${d.date}|${d.amount}|${d.description}`));

            const newTxs = bookedTxs.filter(tx => {
              const key = `${tx.bookingDate}|${tx.transactionAmount.amount}|${gocardless.getTransactionDescription(tx)}`;
              return !dupSet.has(key);
            });

            if (newTxs.length > 0) {
              const statement = await storage.createBankStatement({
                accountId: conn.localAccountId,
                fileName: `GoCardless-${conn.institutionName}-${dateTo}`,
                startDate: dateFrom,
                endDate: dateTo,
                transactionCount: newTxs.length,
                status: "ZAIMPORTOWANY",
              });

              const bulkData = newTxs.map(tx => ({
                statementId: statement.id,
                accountId: conn.localAccountId!,
                date: tx.bookingDate,
                description: gocardless.getTransactionDescription(tx),
                amount: tx.transactionAmount.amount,
                balance: null as string | null,
                counterparty: gocardless.getTransactionCounterparty(tx) || null,
                category: null as string | null,
              }));

              await storage.createBankTransactionsBulk(bulkData);
              imported = newTxs.length;
            }
          }

          await storage.updateGocardlessConnection(conn.id, { lastSyncAt: new Date() });
          results.push({ connectionId: conn.id, institutionName: conn.institutionName, imported, skipped: bookedTxs.length - imported });
        } catch (err: any) {
          results.push({ connectionId: conn.id, institutionName: conn.institutionName, imported: 0, skipped: 0, error: err.message });
        }
      }

      res.json({ results, totalConnections: activeConns.length });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/gocardless/connections/:id/link-account", isAuthenticated, async (req, res) => {
    try {
      const { localAccountId } = req.body;
      const conn = await storage.updateGocardlessConnection(parseInt(req.params.id), { localAccountId });
      res.json(conn);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

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
              apartments.push(apt);
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

        let totalCleaningFee = 0;
        for (const aptId of resolvedAptIds) {
          const apt = apartments.find(a => a.id === aptId);
          if (apt && apt.cleaningFee) {
            totalCleaningFee += Number(apt.cleaningFee);
          }
        }
        const basePrice = Number(hr.price) || 0;
        const adjustedPrice = (basePrice + totalCleaningFee).toFixed(2);
        const cleaningSurcharge = totalCleaningFee.toFixed(2);
        if (totalCleaningFee > 0) {
          log.push(`Rez. ${hr.reservationNumber}: doliczono sprzątanie ${totalCleaningFee.toFixed(2)} zł (${basePrice.toFixed(2)} → ${adjustedPrice})`);
        }

        const existing = await storage.getReservationByNumber(hr.reservationNumber);
        if (existing) {
          await storage.updateReservation(existing.id, {
            apartmentId: primaryAptId,
            apartmentIds: isGroupReservation ? resolvedAptIds : null,
            startDate: hr.startDate,
            endDate: hr.endDate,
            guestName: hr.guestName,
            price: adjustedPrice,
            prepayment: hr.prepayment || "0",
            paidAmount: hr.paidAmount || "0",
            surcharge: cleaningSurcharge,
            status: hr.status,
            ...(hr.source && { source: hr.source }),
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
          price: adjustedPrice,
          prepayment: hr.prepayment || "0",
          paidAmount: hr.paidAmount || "0",
          surcharge: cleaningSurcharge,
          status: hr.status,
          ...(hr.source && { source: hr.source }),
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

  return httpServer;
}


