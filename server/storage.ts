import { 
  users, User, InsertUser,
  owners, Owner, InsertOwner,
  apartments, Apartment, InsertApartment,
  reservations, Reservation, InsertReservation,
  leases, Lease, InsertLease,
  expenses, Expense, InsertExpense,
  accounts, Account, InsertAccount,
  accountSnapshots, AccountSnapshot, InsertAccountSnapshot,
  attachments, Attachment, InsertAttachment,
  employees, Employee, InsertEmployee,
  medicalExams, MedicalExam, InsertMedicalExam,
  ownerPayments, OwnerPayment, InsertOwnerPayment,
  blockades, Blockade, InsertBlockade,
  locations, Location, InsertLocation,
  serviceContractCategories, ServiceContractCategory, InsertServiceContractCategory,
  serviceContracts, ServiceContract, InsertServiceContract,
  saldoEntries, SaldoEntry, InsertSaldoEntry,
  saldoInitialBalances,
  saldoCategories,
  subleases, Sublease, InsertSublease,
  subleasePayments, SubleasePayment, InsertSubleasePayment,
  subleaseAttachments, SubleaseAttachment, InsertSubleaseAttachment,
  subleaseMeterReadings, SubleaseMeterReading, InsertSubleaseMeterReading,
  subleaseMeterSettings, SubleaseMeterSetting, InsertSubleaseMeterSetting,
  subleaseMeterPrices, SubleaseMeterPrice, InsertSubleaseMeterPrice,
  mediaSettlementReports, MediaSettlementReport, InsertMediaSettlementReport,
  appUsers, AppUser, InsertAppUser,
  documentCategories, DocumentCategory, InsertDocumentCategory,
  documentTemplates, DocumentTemplate, InsertDocumentTemplate,
  costSchedules, CostSchedule, InsertCostSchedule,
  costSchedulePayments, CostSchedulePayment, InsertCostSchedulePayment,
  installmentSchedules, InstallmentSchedule, InsertInstallmentSchedule,
  installmentPayments, InstallmentPayment, InsertInstallmentPayment,
  serviceContractAttachments, ServiceContractAttachment, InsertServiceContractAttachment,
  importMetadata, ImportMetadata,
  activityLogs, ActivityLog, InsertActivityLog,
  invoices, Invoice, InsertInvoice,
  notifications, Notification, InsertNotification,
  revenueForecasts, RevenueForecast, InsertRevenueForecast,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, sql, isNotNull } from "drizzle-orm";

export interface IStorage {
  // Users (optional if auth handles it separately, but good to have)
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Owners
  getOwners(): Promise<Owner[]>;
  getOwner(id: number): Promise<Owner | undefined>;
  createOwner(owner: InsertOwner): Promise<Owner>;
  updateOwner(id: number, owner: Partial<InsertOwner>): Promise<Owner>;
  deleteOwner(id: number): Promise<void>;

  // Apartments
  getApartments(): Promise<Apartment[]>;
  getApartment(id: number): Promise<Apartment | undefined>;
  createApartment(apartment: InsertApartment): Promise<Apartment>;
  updateApartment(id: number, apartment: Partial<InsertApartment>): Promise<Apartment>;
  deleteApartment(id: number): Promise<void>;

  // Reservations
  getReservations(filters?: { apartmentId?: number, startDate?: string, endDate?: string }): Promise<Reservation[]>;
  createReservation(reservation: InsertReservation): Promise<Reservation>;
  updateReservation(id: number, reservation: Partial<InsertReservation>): Promise<Reservation>;
  deleteReservation(id: number): Promise<void>;
  createReservationsBulk(reservationsData: InsertReservation[]): Promise<Reservation[]>;

  // Leases
  getLeases(apartmentId?: number): Promise<Lease[]>;
  createLease(lease: InsertLease): Promise<Lease>;
  updateLease(id: number, lease: Partial<InsertLease>): Promise<Lease>;

  // Expenses
  getExpenses(filters?: { startDate?: string, endDate?: string }): Promise<Expense[]>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpense(id: number, expense: Partial<InsertExpense>): Promise<Expense>;
  deleteExpense(id: number): Promise<void>;

  // Accounts & Snapshots
  getAccounts(): Promise<Account[]>;
  createAccount(account: InsertAccount): Promise<Account>;
  getSnapshots(accountId?: number): Promise<AccountSnapshot[]>;
  createSnapshot(snapshot: InsertAccountSnapshot): Promise<AccountSnapshot>;
  getCompanyBalance(): Promise<{ accounts: { id: number; name: string; type: string | null; category: string | null; balanceSource: string | null; latestBalance: string }[]; totalBalance: string }>;
  
  // Attachments
  getAllAttachments(): Promise<Attachment[]>;
  getAttachments(apartmentId: number): Promise<Attachment[]>;
  createAttachment(attachment: InsertAttachment): Promise<Attachment>;
  deleteAttachment(id: number): Promise<void>;

  // Employees
  getEmployees(): Promise<Employee[]>;
  getEmployee(id: number): Promise<Employee | undefined>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee>;
  deleteEmployee(id: number): Promise<void>;

  // Medical Exams
  getMedicalExams(employeeId: number): Promise<MedicalExam[]>;
  createMedicalExam(exam: InsertMedicalExam): Promise<MedicalExam>;
  deleteMedicalExam(id: number): Promise<void>;

  // Owner Payments
  getOwnerPayments(apartmentId: number): Promise<OwnerPayment[]>;
  createOwnerPayment(payment: InsertOwnerPayment): Promise<OwnerPayment>;
  deleteOwnerPayment(id: number): Promise<void>;

  // Blockades
  getBlockades(): Promise<Blockade[]>;
  createBlockade(blockade: InsertBlockade): Promise<Blockade>;
  deleteBlockade(id: number): Promise<void>;

  // Locations
  getLocations(): Promise<Location[]>;
  createLocation(location: InsertLocation): Promise<Location>;
  updateLocation(id: number, location: Partial<InsertLocation>): Promise<Location>;
  deleteLocation(id: number): Promise<void>;

  // Service Contract Categories
  getServiceContractCategories(): Promise<ServiceContractCategory[]>;
  createServiceContractCategory(cat: InsertServiceContractCategory): Promise<ServiceContractCategory>;
  updateServiceContractCategory(id: number, data: Partial<InsertServiceContractCategory>): Promise<ServiceContractCategory>;
  deleteServiceContractCategory(id: number): Promise<void>;

  // Service Contracts
  getServiceContracts(): Promise<ServiceContract[]>;
  createServiceContract(contract: InsertServiceContract): Promise<ServiceContract>;
  updateServiceContract(id: number, contract: Partial<InsertServiceContract>): Promise<ServiceContract>;
  deleteServiceContract(id: number): Promise<void>;

  getAllServiceContractAttachments(): Promise<ServiceContractAttachment[]>;
  getServiceContractAttachments(contractId: number): Promise<ServiceContractAttachment[]>;
  createServiceContractAttachment(attachment: InsertServiceContractAttachment): Promise<ServiceContractAttachment>;
  deleteServiceContractAttachment(id: number): Promise<void>;

  // Saldo
  getSaldoEntries(filters?: { startDate?: string; endDate?: string; personName?: string }): Promise<SaldoEntry[]>;
  getSaldoCategories(personName?: string): Promise<string[]>;
  createSaldoCategory(name: string, personName?: string): Promise<void>;
  updateSaldoCategory(oldName: string, newName: string, personName?: string): Promise<void>;
  deleteSaldoCategory(name: string, personName?: string): Promise<void>;
  createSaldoEntry(entry: InsertSaldoEntry): Promise<SaldoEntry>;
  createSaldoEntriesBulk(entries: InsertSaldoEntry[]): Promise<SaldoEntry[]>;
  updateSaldoEntry(id: number, entry: Partial<InsertSaldoEntry>): Promise<SaldoEntry>;
  deleteSaldoEntry(id: number): Promise<void>;
  deleteAllSaldoEntries(): Promise<void>;
  getSaldoInitialBalance(personName: string): Promise<string>;
  setSaldoInitialBalance(personName: string, initialBalance: string): Promise<void>;

  // Subleases
  getSubleases(): Promise<Sublease[]>;
  getSublease(id: number): Promise<Sublease | undefined>;
  createSublease(sublease: InsertSublease): Promise<Sublease>;
  updateSublease(id: number, sublease: Partial<InsertSublease>): Promise<Sublease>;
  deleteSublease(id: number): Promise<void>;

  // Sublease Payments
  getSubleasePayments(subleaseId: number): Promise<SubleasePayment[]>;
  createSubleasePayment(payment: InsertSubleasePayment): Promise<SubleasePayment>;
  updateSubleasePayment(id: number, payment: Partial<InsertSubleasePayment>): Promise<SubleasePayment>;
  deleteSubleasePayment(id: number): Promise<void>;

  // Sublease Attachments
  getSubleaseAttachments(subleaseId: number): Promise<SubleaseAttachment[]>;
  createSubleaseAttachment(attachment: InsertSubleaseAttachment): Promise<SubleaseAttachment>;
  deleteSubleaseAttachment(id: number): Promise<void>;

  // Sublease Meter Readings & Settings
  getMeterReadings(subleaseId: number): Promise<SubleaseMeterReading[]>;
  upsertMeterReading(reading: InsertSubleaseMeterReading): Promise<SubleaseMeterReading>;
  deleteMeterReading(id: number): Promise<void>;
  getMeterSettings(subleaseId: number): Promise<SubleaseMeterSetting[]>;
  upsertMeterSetting(setting: InsertSubleaseMeterSetting): Promise<SubleaseMeterSetting>;
  getMeterPrices(subleaseId: number): Promise<SubleaseMeterPrice[]>;
  createMeterPrice(price: InsertSubleaseMeterPrice): Promise<SubleaseMeterPrice>;
  deleteMeterPrice(id: number): Promise<void>;

  getMediaSettlementReports(subleaseId: number): Promise<MediaSettlementReport[]>;
  createMediaSettlementReport(report: InsertMediaSettlementReport): Promise<MediaSettlementReport>;
  updateMediaSettlementReportStatus(id: number, status: string): Promise<MediaSettlementReport>;
  updateMediaSettlementReport(id: number, data: Partial<InsertMediaSettlementReport>): Promise<MediaSettlementReport>;
  deleteMediaSettlementReport(id: number): Promise<void>;

  // App Users
  getAppUsers(): Promise<AppUser[]>;
  createAppUser(user: InsertAppUser): Promise<AppUser>;
  updateAppUser(id: number, user: Partial<InsertAppUser>): Promise<AppUser>;
  deleteAppUser(id: number): Promise<void>;
  getAppUserByEmail(email: string): Promise<AppUser | undefined>;

  // Document Categories
  getDocumentCategories(): Promise<DocumentCategory[]>;
  createDocumentCategory(cat: InsertDocumentCategory): Promise<DocumentCategory>;
  updateDocumentCategory(id: number, cat: Partial<InsertDocumentCategory>): Promise<DocumentCategory>;
  deleteDocumentCategory(id: number): Promise<void>;

  // Document Templates
  getDocumentTemplates(): Promise<DocumentTemplate[]>;
  createDocumentTemplate(template: InsertDocumentTemplate): Promise<DocumentTemplate>;
  updateDocumentTemplate(id: number, template: Partial<InsertDocumentTemplate>): Promise<DocumentTemplate>;
  deleteDocumentTemplate(id: number): Promise<void>;

  // Cost Schedules
  getCostSchedules(): Promise<CostSchedule[]>;
  createCostSchedule(schedule: InsertCostSchedule): Promise<CostSchedule>;
  updateCostSchedule(id: number, schedule: Partial<InsertCostSchedule>): Promise<CostSchedule>;
  deleteCostSchedule(id: number): Promise<void>;
  getCostSchedulePayments(scheduleId: number): Promise<CostSchedulePayment[]>;
  getAllCostSchedulePayments(): Promise<CostSchedulePayment[]>;
  createCostSchedulePayment(payment: InsertCostSchedulePayment): Promise<CostSchedulePayment>;
  updateCostSchedulePayment(id: number, payment: Partial<InsertCostSchedulePayment>): Promise<CostSchedulePayment>;
  deleteCostSchedulePayment(id: number): Promise<void>;

  // Installment Schedules
  getInstallmentSchedules(): Promise<InstallmentSchedule[]>;
  createInstallmentSchedule(schedule: InsertInstallmentSchedule): Promise<InstallmentSchedule>;
  updateInstallmentSchedule(id: number, schedule: Partial<InsertInstallmentSchedule>): Promise<InstallmentSchedule>;
  deleteInstallmentSchedule(id: number): Promise<void>;
  getInstallmentPayments(scheduleId: number): Promise<InstallmentPayment[]>;
  getAllInstallmentPayments(): Promise<InstallmentPayment[]>;
  createInstallmentPayment(payment: InsertInstallmentPayment): Promise<InstallmentPayment>;
  updateInstallmentPayment(id: number, payment: Partial<InsertInstallmentPayment>): Promise<InstallmentPayment>;
  deleteInstallmentPayment(id: number): Promise<void>;

  // Import Metadata
  getLastImport(importType: string): Promise<ImportMetadata | undefined>;
  saveImportMetadata(data: { importType: string; recordsImported: number; recordsUpdated: number; recordsSkipped: number; details?: string }): Promise<ImportMetadata>;

  // Reservations by number
  getReservationByNumber(reservationNumber: string): Promise<Reservation | undefined>;

  // Activity Logs
  getActivityLogs(limit?: number): Promise<ActivityLog[]>;
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;

  // Invoices
  getInvoices(): Promise<Invoice[]>;
  getInvoice(id: number): Promise<Invoice | undefined>;
  createInvoice(data: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: number, data: Partial<InsertInvoice>): Promise<Invoice>;
  deleteInvoice(id: number): Promise<void>;

  // Notifications
  getNotifications(): Promise<Notification[]>;
  getUnreadNotifications(): Promise<Notification[]>;
  createNotification(data: InsertNotification): Promise<Notification>;
  markNotificationRead(id: number): Promise<void>;
  markAllNotificationsRead(): Promise<void>;

  // Revenue Forecasts
  getRevenueForecasts(year?: number): Promise<RevenueForecast[]>;
  upsertRevenueForecast(data: InsertRevenueForecast): Promise<RevenueForecast>;
  createRevenueForecastsBulk(data: InsertRevenueForecast[]): Promise<void>;
  deleteRevenueForecasts(year?: number): Promise<void>;
  deleteLocationLevelForecasts(): Promise<void>;

  // Stats
  getDashboardStats(): Promise<{
    totalRevenue: number;
    totalExpenses: number;
    netIncome: number;
    occupancyRate: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Owners
  async getOwners(): Promise<Owner[]> {
    return await db.select().from(owners).orderBy(owners.name);
  }

  async getOwner(id: number): Promise<Owner | undefined> {
    const [owner] = await db.select().from(owners).where(eq(owners.id, id));
    return owner;
  }

  async createOwner(owner: InsertOwner): Promise<Owner> {
    const [newOwner] = await db.insert(owners).values(owner).returning();
    return newOwner;
  }

  async updateOwner(id: number, owner: Partial<InsertOwner>): Promise<Owner> {
    const [updated] = await db.update(owners).set(owner).where(eq(owners.id, id)).returning();
    return updated;
  }

  async deleteOwner(id: number): Promise<void> {
    await db.update(apartments).set({ ownerId: null }).where(eq(apartments.ownerId, id));
    await db.delete(owners).where(eq(owners.id, id));
  }

  // Apartments
  async getApartments(): Promise<Apartment[]> {
    return await db.select().from(apartments).orderBy(apartments.name);
  }

  async getApartment(id: number): Promise<Apartment | undefined> {
    const [apartment] = await db.select().from(apartments).where(eq(apartments.id, id));
    return apartment;
  }

  async createApartment(apartment: InsertApartment): Promise<Apartment> {
    const [newApartment] = await db.insert(apartments).values(apartment).returning();
    return newApartment;
  }

  async updateApartment(id: number, apartment: Partial<InsertApartment>): Promise<Apartment> {
    const [updated] = await db.update(apartments).set(apartment).where(eq(apartments.id, id)).returning();
    return updated;
  }

  async deleteApartment(id: number): Promise<void> {
    await db.delete(reservations).where(eq(reservations.apartmentId, id));
    await db.delete(leases).where(eq(leases.apartmentId, id));
    await db.delete(expenses).where(eq(expenses.apartmentId, id));
    await db.delete(blockades).where(eq(blockades.apartmentId, id));
    await db.delete(ownerPayments).where(eq(ownerPayments.apartmentId, id));
    await db.delete(attachments).where(eq(attachments.apartmentId, id));
    await db.delete(apartments).where(eq(apartments.id, id));
  }

  // Reservations
  async getReservations(filters?: { apartmentId?: number, startDate?: string, endDate?: string }): Promise<Reservation[]> {
    const conditions = [];
    if (filters?.apartmentId) conditions.push(eq(reservations.apartmentId, filters.apartmentId));
    if (filters?.startDate) conditions.push(gte(reservations.startDate, filters.startDate));
    if (filters?.endDate) conditions.push(lte(reservations.endDate, filters.endDate));

    return await db.select()
      .from(reservations)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(reservations.startDate));
  }

  async createReservation(reservation: InsertReservation): Promise<Reservation> {
    const [newReservation] = await db.insert(reservations).values(reservation).returning();
    return newReservation;
  }
  
  async createReservationsBulk(reservationsData: InsertReservation[]): Promise<Reservation[]> {
    if (reservationsData.length === 0) return [];
    return await db.insert(reservations).values(reservationsData).returning();
  }

  async updateReservation(id: number, reservation: Partial<InsertReservation>): Promise<Reservation> {
    const [updated] = await db.update(reservations).set(reservation).where(eq(reservations.id, id)).returning();
    return updated;
  }

  async deleteReservation(id: number): Promise<void> {
    await db.delete(reservations).where(eq(reservations.id, id));
  }

  // Leases
  async getLeases(apartmentId?: number): Promise<Lease[]> {
    if (apartmentId) {
      return await db.select().from(leases).where(eq(leases.apartmentId, apartmentId));
    }
    return await db.select().from(leases);
  }

  async createLease(lease: InsertLease): Promise<Lease> {
    const [newLease] = await db.insert(leases).values(lease).returning();
    return newLease;
  }

  async updateLease(id: number, lease: Partial<InsertLease>): Promise<Lease> {
    const [updated] = await db.update(leases).set(lease).where(eq(leases.id, id)).returning();
    return updated;
  }

  // Expenses
  async getExpenses(filters?: { startDate?: string, endDate?: string }): Promise<Expense[]> {
    const conditions = [];
    if (filters?.startDate) conditions.push(gte(expenses.date, filters.startDate));
    if (filters?.endDate) conditions.push(lte(expenses.date, filters.endDate));

    return await db.select()
      .from(expenses)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(expenses.date));
  }

  async createExpense(expense: InsertExpense): Promise<Expense> {
    const [newExpense] = await db.insert(expenses).values(expense).returning();
    return newExpense;
  }

  async updateExpense(id: number, expense: Partial<InsertExpense>): Promise<Expense> {
    const [updated] = await db.update(expenses).set(expense).where(eq(expenses.id, id)).returning();
    return updated;
  }

  async deleteExpense(id: number): Promise<void> {
    await db.delete(expenses).where(eq(expenses.id, id));
  }

  // Accounts & Snapshots
  async getAccounts(): Promise<Account[]> {
    return await db.select().from(accounts);
  }

  async createAccount(account: InsertAccount): Promise<Account> {
    const [newAccount] = await db.insert(accounts).values(account).returning();
    return newAccount;
  }

  async getSnapshots(accountId?: number): Promise<AccountSnapshot[]> {
    if (accountId) {
      return await db.select().from(accountSnapshots).where(eq(accountSnapshots.accountId, accountId)).orderBy(desc(accountSnapshots.date));
    }
    return await db.select().from(accountSnapshots).orderBy(desc(accountSnapshots.date));
  }

  async createSnapshot(snapshot: InsertAccountSnapshot): Promise<AccountSnapshot> {
    const [newSnapshot] = await db.insert(accountSnapshots).values(snapshot).returning();
    return newSnapshot;
  }

  async getCompanyBalance(): Promise<{ accounts: { id: number; name: string; type: string | null; category: string | null; balanceSource: string | null; latestBalance: string }[]; totalBalance: string }> {
    const allAccounts = await db.select().from(accounts);
    const allSnapshots = await db.select().from(accountSnapshots).orderBy(desc(accountSnapshots.date));

    const accountBalances = allAccounts.map(acc => {
      const latestSnapshot = allSnapshots.find(s => s.accountId === acc.id);
      return {
        id: acc.id,
        name: acc.name,
        type: acc.type,
        category: acc.category,
        balanceSource: acc.balanceSource,
        latestBalance: latestSnapshot?.balance ?? "0.00",
      };
    });

    const total = accountBalances.reduce((sum, a) => sum + Number(a.latestBalance), 0);

    return {
      accounts: accountBalances,
      totalBalance: total.toFixed(2),
    };
  }
  
  // Attachments
  async getAllAttachments(): Promise<Attachment[]> {
    return db.select().from(attachments).orderBy(desc(attachments.uploadedAt));
  }

  async getAttachments(apartmentId: number): Promise<Attachment[]> {
    return await db.select().from(attachments).where(eq(attachments.apartmentId, apartmentId)).orderBy(desc(attachments.uploadedAt));
  }

  async createAttachment(attachment: InsertAttachment): Promise<Attachment> {
    const [newAttachment] = await db.insert(attachments).values(attachment).returning();
    return newAttachment;
  }

  async deleteAttachment(id: number): Promise<void> {
    await db.delete(attachments).where(eq(attachments.id, id));
  }

  // Employees
  async getEmployees(): Promise<Employee[]> {
    return await db.select().from(employees).orderBy(employees.lastName);
  }

  async getEmployee(id: number): Promise<Employee | undefined> {
    const [employee] = await db.select().from(employees).where(eq(employees.id, id));
    return employee;
  }

  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    const [newEmployee] = await db.insert(employees).values(employee).returning();
    return newEmployee;
  }

  async updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee> {
    const [updated] = await db.update(employees).set(employee).where(eq(employees.id, id)).returning();
    return updated;
  }

  async deleteEmployee(id: number): Promise<void> {
    await db.delete(employees).where(eq(employees.id, id));
  }

  // Medical Exams
  async getMedicalExams(employeeId: number): Promise<MedicalExam[]> {
    return await db.select().from(medicalExams)
      .where(eq(medicalExams.employeeId, employeeId))
      .orderBy(desc(medicalExams.validUntil));
  }

  async createMedicalExam(exam: InsertMedicalExam): Promise<MedicalExam> {
    const [newExam] = await db.insert(medicalExams).values(exam).returning();
    return newExam;
  }

  async deleteMedicalExam(id: number): Promise<void> {
    await db.delete(medicalExams).where(eq(medicalExams.id, id));
  }

  // Owner Payments
  async getOwnerPayments(apartmentId: number): Promise<OwnerPayment[]> {
    return await db.select().from(ownerPayments)
      .where(eq(ownerPayments.apartmentId, apartmentId))
      .orderBy(desc(ownerPayments.paymentDate));
  }

  async createOwnerPayment(payment: InsertOwnerPayment): Promise<OwnerPayment> {
    const [newPayment] = await db.insert(ownerPayments).values(payment).returning();
    return newPayment;
  }

  async deleteOwnerPayment(id: number): Promise<void> {
    await db.delete(ownerPayments).where(eq(ownerPayments.id, id));
  }

  // Blockades
  async getBlockades(): Promise<Blockade[]> {
    return await db.select().from(blockades).orderBy(blockades.startDate);
  }

  async createBlockade(blockade: InsertBlockade): Promise<Blockade> {
    const [newBlockade] = await db.insert(blockades).values(blockade).returning();
    return newBlockade;
  }

  async deleteBlockade(id: number): Promise<void> {
    await db.delete(blockades).where(eq(blockades.id, id));
  }

  // Locations
  async getLocations(): Promise<Location[]> {
    return await db.select().from(locations).orderBy(locations.sortOrder);
  }

  async createLocation(location: InsertLocation): Promise<Location> {
    const [newLocation] = await db.insert(locations).values(location).returning();
    return newLocation;
  }

  async updateLocation(id: number, location: Partial<InsertLocation>): Promise<Location> {
    const [updated] = await db.update(locations).set(location).where(eq(locations.id, id)).returning();
    return updated;
  }

  async deleteLocation(id: number): Promise<void> {
    await db.delete(locations).where(eq(locations.id, id));
  }

  // Service Contract Categories
  async getServiceContractCategories(): Promise<ServiceContractCategory[]> {
    return await db.select().from(serviceContractCategories).orderBy(serviceContractCategories.sortOrder);
  }

  async createServiceContractCategory(cat: InsertServiceContractCategory): Promise<ServiceContractCategory> {
    const [newCat] = await db.insert(serviceContractCategories).values(cat).returning();
    return newCat;
  }

  async updateServiceContractCategory(id: number, data: Partial<InsertServiceContractCategory>): Promise<ServiceContractCategory> {
    const [updated] = await db.update(serviceContractCategories).set(data).where(eq(serviceContractCategories.id, id)).returning();
    return updated;
  }

  async deleteServiceContractCategory(id: number): Promise<void> {
    await db.delete(serviceContracts).where(eq(serviceContracts.categoryId, id));
    await db.delete(serviceContractCategories).where(eq(serviceContractCategories.id, id));
  }

  // Service Contracts
  async getServiceContracts(): Promise<ServiceContract[]> {
    return await db.select().from(serviceContracts).orderBy(desc(serviceContracts.createdAt));
  }

  async createServiceContract(contract: InsertServiceContract): Promise<ServiceContract> {
    const [newContract] = await db.insert(serviceContracts).values(contract).returning();
    return newContract;
  }

  async updateServiceContract(id: number, contract: Partial<InsertServiceContract>): Promise<ServiceContract> {
    const [updated] = await db.update(serviceContracts).set(contract).where(eq(serviceContracts.id, id)).returning();
    return updated;
  }

  async deleteServiceContract(id: number): Promise<void> {
    await db.delete(serviceContracts).where(eq(serviceContracts.id, id));
  }

  async getAllServiceContractAttachments(): Promise<ServiceContractAttachment[]> {
    return db.select().from(serviceContractAttachments).orderBy(desc(serviceContractAttachments.uploadedAt));
  }

  async getServiceContractAttachments(contractId: number): Promise<ServiceContractAttachment[]> {
    return db.select().from(serviceContractAttachments).where(eq(serviceContractAttachments.contractId, contractId)).orderBy(desc(serviceContractAttachments.uploadedAt));
  }

  async createServiceContractAttachment(attachment: InsertServiceContractAttachment): Promise<ServiceContractAttachment> {
    const [created] = await db.insert(serviceContractAttachments).values(attachment).returning();
    return created;
  }

  async deleteServiceContractAttachment(id: number): Promise<void> {
    await db.delete(serviceContractAttachments).where(eq(serviceContractAttachments.id, id));
  }

  // Saldo
  async getSaldoEntries(filters?: { startDate?: string; endDate?: string; personName?: string }): Promise<SaldoEntry[]> {
    const conditions = [];
    if (filters?.startDate) conditions.push(gte(saldoEntries.date, filters.startDate));
    if (filters?.endDate) conditions.push(lte(saldoEntries.date, filters.endDate));
    if (filters?.personName) conditions.push(eq(saldoEntries.personName, filters.personName));
    return db.select().from(saldoEntries).where(conditions.length ? and(...conditions) : undefined).orderBy(saldoEntries.id);
  }

  async getSaldoCategories(personName?: string): Promise<string[]> {
    const conditions: any[] = [];
    if (personName) {
      conditions.push(eq(saldoEntries.personName, personName));
    }
    conditions.push(sql`${saldoEntries.category} IS NOT NULL AND ${saldoEntries.category} != ''`);
    const fromEntries = await db.selectDistinct({ category: saldoEntries.category }).from(saldoEntries).where(and(...conditions));
    
    const tableConditions: any[] = [];
    if (personName) {
      tableConditions.push(eq(saldoCategories.personName, personName));
    }
    const fromTable = tableConditions.length > 0
      ? await db.select({ name: saldoCategories.name }).from(saldoCategories).where(and(...tableConditions))
      : await db.select({ name: saldoCategories.name }).from(saldoCategories);
    
    const all = new Set<string>();
    fromEntries.forEach(r => { if (r.category) all.add(r.category); });
    fromTable.forEach(r => all.add(r.name));
    return [...all].sort((a, b) => a.localeCompare(b, "pl"));
  }

  async createSaldoCategory(name: string, personName?: string): Promise<void> {
    await db.insert(saldoCategories).values({ name, personName: personName || null });
  }

  async updateSaldoCategory(oldName: string, newName: string, personName?: string): Promise<void> {
    const entryConditions: any[] = [eq(saldoEntries.category, oldName)];
    if (personName) entryConditions.push(eq(saldoEntries.personName, personName));
    await db.update(saldoEntries).set({ category: newName }).where(and(...entryConditions));
    
    const catConditions: any[] = [eq(saldoCategories.name, oldName)];
    if (personName) catConditions.push(eq(saldoCategories.personName, personName));
    const existing = await db.select().from(saldoCategories).where(and(...catConditions));
    if (existing.length > 0) {
      await db.update(saldoCategories).set({ name: newName }).where(and(...catConditions));
    }
  }

  async deleteSaldoCategory(name: string, personName?: string): Promise<void> {
    const entryConditions: any[] = [eq(saldoEntries.category, name)];
    if (personName) entryConditions.push(eq(saldoEntries.personName, personName));
    await db.update(saldoEntries).set({ category: null }).where(and(...entryConditions));
    
    const catConditions: any[] = [eq(saldoCategories.name, name)];
    if (personName) catConditions.push(eq(saldoCategories.personName, personName));
    await db.delete(saldoCategories).where(and(...catConditions));
  }

  async createSaldoEntry(entry: InsertSaldoEntry): Promise<SaldoEntry> {
    const lastRows = await db.select({ saldo: saldoEntries.saldo }).from(saldoEntries).orderBy(desc(saldoEntries.id)).limit(1);
    const lastSaldo = lastRows.length > 0 && lastRows[0].saldo ? parseFloat(lastRows[0].saldo) : 0;
    const cashAmt = entry.cashAmount ? parseFloat(entry.cashAmount) : 0;
    const newSaldo = (lastSaldo + cashAmt).toFixed(2);
    const [created] = await db.insert(saldoEntries).values({ ...entry, saldo: newSaldo }).returning();
    return created;
  }

  async createSaldoEntriesBulk(entries: InsertSaldoEntry[]): Promise<SaldoEntry[]> {
    if (entries.length === 0) return [];
    const batchSize = 500;
    const results: SaldoEntry[] = [];
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      const created = await db.insert(saldoEntries).values(batch).returning();
      results.push(...created);
    }
    return results;
  }

  async updateSaldoEntry(id: number, entry: Partial<InsertSaldoEntry>): Promise<SaldoEntry> {
    const [updated] = await db.update(saldoEntries).set(entry).where(eq(saldoEntries.id, id)).returning();
    return updated;
  }

  async deleteSaldoEntry(id: number): Promise<void> {
    await db.delete(saldoEntries).where(eq(saldoEntries.id, id));
  }

  async deleteAllSaldoEntries(): Promise<void> {
    await db.delete(saldoEntries);
  }

  async getSaldoInitialBalance(personName: string): Promise<string> {
    const rows = await db.select().from(saldoInitialBalances).where(eq(saldoInitialBalances.personName, personName));
    return rows.length > 0 ? (rows[0].initialBalance || "0.00") : "0.00";
  }

  async setSaldoInitialBalance(personName: string, initialBalance: string): Promise<void> {
    const existing = await db.select().from(saldoInitialBalances).where(eq(saldoInitialBalances.personName, personName));
    if (existing.length > 0) {
      await db.update(saldoInitialBalances).set({ initialBalance }).where(eq(saldoInitialBalances.personName, personName));
    } else {
      await db.insert(saldoInitialBalances).values({ personName, initialBalance });
    }
  }

  // Simple Stats (mocked or basic calculation for now, can be optimized with SQL aggregations)
  async getDashboardStats(): Promise<{
    totalRevenue: number;
    totalExpenses: number;
    netIncome: number;
    occupancyRate: number;
  }> {
    // This is a placeholder for complex logic requested by user. 
    // In a real app we'd run aggregations.
    // For now, let's just return some basic sums or 0s if empty.
    
    // We can do real SQL sums here easily
    const revenueResult = await db.select({ value: sql<number>`sum(${reservations.price})` }).from(reservations).where(eq(reservations.status, 'PRZYJETA'));
    const expenseResult = await db.select({ value: sql<number>`sum(${expenses.amount})` }).from(expenses);
    
    const totalRevenue = Number(revenueResult[0]?.value || 0);
    const totalExpenses = Number(expenseResult[0]?.value || 0);
    
    return {
      totalRevenue,
      totalExpenses,
      netIncome: totalRevenue - totalExpenses,
      occupancyRate: 0, // Needs complex date range calculation
    };
  }
  // Subleases
  async getSubleases(): Promise<Sublease[]> {
    return db.select().from(subleases).orderBy(desc(subleases.id));
  }

  async getSublease(id: number): Promise<Sublease | undefined> {
    const [s] = await db.select().from(subleases).where(eq(subleases.id, id));
    return s;
  }

  async createSublease(sublease: InsertSublease): Promise<Sublease> {
    const [created] = await db.insert(subleases).values(sublease).returning();
    return created;
  }

  async updateSublease(id: number, sublease: Partial<InsertSublease>): Promise<Sublease> {
    const [updated] = await db.update(subleases).set(sublease).where(eq(subleases.id, id)).returning();
    return updated;
  }

  async deleteSublease(id: number): Promise<void> {
    await db.delete(subleases).where(eq(subleases.id, id));
  }

  // Sublease Payments
  async getSubleasePayments(subleaseId: number): Promise<SubleasePayment[]> {
    return db.select().from(subleasePayments).where(eq(subleasePayments.subleaseId, subleaseId)).orderBy(desc(subleasePayments.dueDate));
  }

  async createSubleasePayment(payment: InsertSubleasePayment): Promise<SubleasePayment> {
    const [created] = await db.insert(subleasePayments).values(payment).returning();
    return created;
  }

  async updateSubleasePayment(id: number, payment: Partial<InsertSubleasePayment>): Promise<SubleasePayment> {
    const [updated] = await db.update(subleasePayments).set(payment).where(eq(subleasePayments.id, id)).returning();
    return updated;
  }

  async deleteSubleasePayment(id: number): Promise<void> {
    await db.delete(subleasePayments).where(eq(subleasePayments.id, id));
  }

  // Sublease Attachments
  async getAllSubleaseAttachments(): Promise<SubleaseAttachment[]> {
    return db.select().from(subleaseAttachments).orderBy(desc(subleaseAttachments.uploadedAt));
  }

  async getSubleaseAttachments(subleaseId: number): Promise<SubleaseAttachment[]> {
    return db.select().from(subleaseAttachments).where(eq(subleaseAttachments.subleaseId, subleaseId)).orderBy(desc(subleaseAttachments.uploadedAt));
  }

  async createSubleaseAttachment(attachment: InsertSubleaseAttachment): Promise<SubleaseAttachment> {
    const [created] = await db.insert(subleaseAttachments).values(attachment).returning();
    return created;
  }

  async deleteSubleaseAttachment(id: number): Promise<void> {
    await db.delete(subleaseAttachments).where(eq(subleaseAttachments.id, id));
  }

  async getMeterReadings(subleaseId: number): Promise<SubleaseMeterReading[]> {
    return db.select().from(subleaseMeterReadings)
      .where(eq(subleaseMeterReadings.subleaseId, subleaseId))
      .orderBy(subleaseMeterReadings.readingDate);
  }

  async upsertMeterReading(reading: InsertSubleaseMeterReading): Promise<SubleaseMeterReading> {
    if (reading.readingDate) {
      const existing = await db.select().from(subleaseMeterReadings)
        .where(and(
          eq(subleaseMeterReadings.subleaseId, reading.subleaseId),
          eq(subleaseMeterReadings.meterType, reading.meterType),
          eq(subleaseMeterReadings.readingDate, reading.readingDate)
        ));
      if (existing.length > 0) {
        const [updated] = await db.update(subleaseMeterReadings)
          .set({ reading: reading.reading, readingDate: reading.readingDate })
          .where(eq(subleaseMeterReadings.id, existing[0].id))
          .returning();
        return updated;
      }
    }
    const [created] = await db.insert(subleaseMeterReadings).values(reading).returning();
    return created;
  }

  async deleteMeterReading(id: number): Promise<void> {
    await db.delete(subleaseMeterReadings).where(eq(subleaseMeterReadings.id, id));
  }

  async getMeterSettings(subleaseId: number): Promise<SubleaseMeterSetting[]> {
    return db.select().from(subleaseMeterSettings)
      .where(eq(subleaseMeterSettings.subleaseId, subleaseId));
  }

  async upsertMeterSetting(setting: InsertSubleaseMeterSetting): Promise<SubleaseMeterSetting> {
    const existing = await db.select().from(subleaseMeterSettings)
      .where(and(
        eq(subleaseMeterSettings.subleaseId, setting.subleaseId),
        eq(subleaseMeterSettings.meterType, setting.meterType)
      ));
    if (existing.length > 0) {
      const [updated] = await db.update(subleaseMeterSettings)
        .set({ unitPrice: setting.unitPrice, initialReading: setting.initialReading, initialDate: setting.initialDate })
        .where(eq(subleaseMeterSettings.id, existing[0].id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(subleaseMeterSettings).values(setting).returning();
    return created;
  }

  async getMeterPrices(subleaseId: number): Promise<SubleaseMeterPrice[]> {
    return db.select().from(subleaseMeterPrices)
      .where(eq(subleaseMeterPrices.subleaseId, subleaseId))
      .orderBy(subleaseMeterPrices.validFrom);
  }

  async createMeterPrice(price: InsertSubleaseMeterPrice): Promise<SubleaseMeterPrice> {
    const [created] = await db.insert(subleaseMeterPrices).values(price).returning();
    return created;
  }

  async deleteMeterPrice(id: number): Promise<void> {
    await db.delete(subleaseMeterPrices).where(eq(subleaseMeterPrices.id, id));
  }

  async getMediaSettlementReports(subleaseId: number): Promise<MediaSettlementReport[]> {
    return db.select().from(mediaSettlementReports)
      .where(eq(mediaSettlementReports.subleaseId, subleaseId))
      .orderBy(desc(mediaSettlementReports.periodFrom));
  }

  async createMediaSettlementReport(report: InsertMediaSettlementReport): Promise<MediaSettlementReport> {
    const [created] = await db.insert(mediaSettlementReports).values(report).returning();
    return created;
  }

  async updateMediaSettlementReportStatus(id: number, status: string): Promise<MediaSettlementReport> {
    const [updated] = await db.update(mediaSettlementReports)
      .set({ paymentStatus: status })
      .where(eq(mediaSettlementReports.id, id))
      .returning();
    return updated;
  }

  async updateMediaSettlementReport(id: number, data: Partial<InsertMediaSettlementReport>): Promise<MediaSettlementReport> {
    const [updated] = await db.update(mediaSettlementReports)
      .set(data)
      .where(eq(mediaSettlementReports.id, id))
      .returning();
    return updated;
  }

  async deleteMediaSettlementReport(id: number): Promise<void> {
    await db.delete(mediaSettlementReports).where(eq(mediaSettlementReports.id, id));
  }

  // App Users
  async getAppUsers(): Promise<AppUser[]> {
    return db.select().from(appUsers).orderBy(appUsers.lastName);
  }

  async createAppUser(user: InsertAppUser): Promise<AppUser> {
    const [created] = await db.insert(appUsers).values(user).returning();
    return created;
  }

  async updateAppUser(id: number, user: Partial<InsertAppUser>): Promise<AppUser> {
    const [updated] = await db.update(appUsers).set(user).where(eq(appUsers.id, id)).returning();
    return updated;
  }

  async deleteAppUser(id: number): Promise<void> {
    await db.delete(appUsers).where(eq(appUsers.id, id));
  }

  async getAppUserByEmail(email: string): Promise<AppUser | undefined> {
    const [user] = await db.select().from(appUsers).where(eq(appUsers.email, email));
    return user;
  }

  async getDocumentCategories(): Promise<DocumentCategory[]> {
    return db.select().from(documentCategories).orderBy(documentCategories.sortOrder);
  }

  async createDocumentCategory(cat: InsertDocumentCategory): Promise<DocumentCategory> {
    const [created] = await db.insert(documentCategories).values(cat).returning();
    return created;
  }

  async updateDocumentCategory(id: number, cat: Partial<InsertDocumentCategory>): Promise<DocumentCategory> {
    const [updated] = await db.update(documentCategories).set(cat).where(eq(documentCategories.id, id)).returning();
    return updated;
  }

  async deleteDocumentCategory(id: number): Promise<void> {
    await db.delete(documentCategories).where(eq(documentCategories.id, id));
  }

  async getDocumentTemplates(): Promise<DocumentTemplate[]> {
    return db.select().from(documentTemplates).orderBy(desc(documentTemplates.uploadedAt));
  }

  async createDocumentTemplate(template: InsertDocumentTemplate): Promise<DocumentTemplate> {
    const [created] = await db.insert(documentTemplates).values(template).returning();
    return created;
  }

  async updateDocumentTemplate(id: number, template: Partial<InsertDocumentTemplate>): Promise<DocumentTemplate> {
    const [updated] = await db.update(documentTemplates).set(template).where(eq(documentTemplates.id, id)).returning();
    return updated;
  }

  async deleteDocumentTemplate(id: number): Promise<void> {
    await db.delete(documentTemplates).where(eq(documentTemplates.id, id));
  }

  // Cost Schedules
  async getCostSchedules(): Promise<CostSchedule[]> {
    return db.select().from(costSchedules).orderBy(costSchedules.name);
  }

  async createCostSchedule(schedule: InsertCostSchedule): Promise<CostSchedule> {
    const [created] = await db.insert(costSchedules).values(schedule).returning();
    return created;
  }

  async updateCostSchedule(id: number, schedule: Partial<InsertCostSchedule>): Promise<CostSchedule> {
    const [updated] = await db.update(costSchedules).set(schedule).where(eq(costSchedules.id, id)).returning();
    return updated;
  }

  async deleteCostSchedule(id: number): Promise<void> {
    await db.delete(costSchedules).where(eq(costSchedules.id, id));
  }

  async getCostSchedulePayments(scheduleId: number): Promise<CostSchedulePayment[]> {
    return db.select().from(costSchedulePayments)
      .where(eq(costSchedulePayments.scheduleId, scheduleId))
      .orderBy(costSchedulePayments.dueDate);
  }

  async getAllCostSchedulePayments(): Promise<CostSchedulePayment[]> {
    return db.select().from(costSchedulePayments).orderBy(costSchedulePayments.dueDate);
  }

  async createCostSchedulePayment(payment: InsertCostSchedulePayment): Promise<CostSchedulePayment> {
    const [created] = await db.insert(costSchedulePayments).values(payment).returning();
    return created;
  }

  async updateCostSchedulePayment(id: number, payment: Partial<InsertCostSchedulePayment>): Promise<CostSchedulePayment> {
    const [updated] = await db.update(costSchedulePayments).set(payment).where(eq(costSchedulePayments.id, id)).returning();
    return updated;
  }

  async deleteCostSchedulePayment(id: number): Promise<void> {
    await db.delete(costSchedulePayments).where(eq(costSchedulePayments.id, id));
  }

  // Installment Schedules
  async getInstallmentSchedules(): Promise<InstallmentSchedule[]> {
    return db.select().from(installmentSchedules).orderBy(installmentSchedules.name);
  }

  async createInstallmentSchedule(schedule: InsertInstallmentSchedule): Promise<InstallmentSchedule> {
    const [created] = await db.insert(installmentSchedules).values(schedule).returning();
    return created;
  }

  async updateInstallmentSchedule(id: number, schedule: Partial<InsertInstallmentSchedule>): Promise<InstallmentSchedule> {
    const [updated] = await db.update(installmentSchedules).set(schedule).where(eq(installmentSchedules.id, id)).returning();
    return updated;
  }

  async deleteInstallmentSchedule(id: number): Promise<void> {
    await db.delete(installmentSchedules).where(eq(installmentSchedules.id, id));
  }

  async getInstallmentPayments(scheduleId: number): Promise<InstallmentPayment[]> {
    return db.select().from(installmentPayments)
      .where(eq(installmentPayments.scheduleId, scheduleId))
      .orderBy(installmentPayments.installmentNumber);
  }

  async getAllInstallmentPayments(): Promise<InstallmentPayment[]> {
    return db.select().from(installmentPayments).orderBy(installmentPayments.dueDate);
  }

  async createInstallmentPayment(payment: InsertInstallmentPayment): Promise<InstallmentPayment> {
    const [created] = await db.insert(installmentPayments).values(payment).returning();
    return created;
  }

  async updateInstallmentPayment(id: number, payment: Partial<InsertInstallmentPayment>): Promise<InstallmentPayment> {
    const [updated] = await db.update(installmentPayments).set(payment).where(eq(installmentPayments.id, id)).returning();
    return updated;
  }

  async deleteInstallmentPayment(id: number): Promise<void> {
    await db.delete(installmentPayments).where(eq(installmentPayments.id, id));
  }

  async getLastImport(importType: string): Promise<ImportMetadata | undefined> {
    const [result] = await db.select().from(importMetadata)
      .where(eq(importMetadata.importType, importType))
      .orderBy(desc(importMetadata.importedAt))
      .limit(1);
    return result;
  }

  async saveImportMetadata(data: { importType: string; recordsImported: number; recordsUpdated: number; recordsSkipped: number; details?: string }): Promise<ImportMetadata> {
    const [created] = await db.insert(importMetadata).values(data).returning();
    return created;
  }

  async getReservationByNumber(reservationNumber: string): Promise<Reservation | undefined> {
    const [result] = await db.select().from(reservations)
      .where(eq(reservations.reservationNumber, reservationNumber));
    return result;
  }

  async getActivityLogs(limit: number = 100): Promise<ActivityLog[]> {
    return db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(limit);
  }

  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const [created] = await db.insert(activityLogs).values(log).returning();
    return created;
  }

  async getInvoices(): Promise<Invoice[]> {
    return db.select().from(invoices).orderBy(desc(invoices.createdAt));
  }

  async getInvoice(id: number): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice;
  }

  async createInvoice(data: InsertInvoice): Promise<Invoice> {
    const [created] = await db.insert(invoices).values(data).returning();
    return created;
  }

  async updateInvoice(id: number, data: Partial<InsertInvoice>): Promise<Invoice> {
    const [updated] = await db.update(invoices).set(data).where(eq(invoices.id, id)).returning();
    return updated;
  }

  async deleteInvoice(id: number): Promise<void> {
    await db.delete(invoices).where(eq(invoices.id, id));
  }

  async getNotifications(): Promise<Notification[]> {
    return db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(100);
  }

  async getUnreadNotifications(): Promise<Notification[]> {
    return db.select().from(notifications).where(eq(notifications.isRead, false)).orderBy(desc(notifications.createdAt));
  }

  async createNotification(data: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(data).returning();
    return created;
  }

  async markNotificationRead(id: number): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
  }

  async markAllNotificationsRead(): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.isRead, false));
  }

  async getRevenueForecasts(year?: number): Promise<RevenueForecast[]> {
    if (year) {
      return db.select().from(revenueForecasts).where(eq(revenueForecasts.year, year));
    }
    return db.select().from(revenueForecasts);
  }

  async upsertRevenueForecast(data: InsertRevenueForecast): Promise<RevenueForecast> {
    const conditions = [
      eq(revenueForecasts.year, data.year),
      eq(revenueForecasts.month, data.month),
    ];
    if (data.apartmentId) {
      conditions.push(eq(revenueForecasts.apartmentId, data.apartmentId));
    } else if (data.locationName) {
      conditions.push(eq(revenueForecasts.locationName, data.locationName));
    }
    const existing = await db.select().from(revenueForecasts).where(and(...conditions)).limit(1);
    if (existing.length > 0) {
      const [updated] = await db.update(revenueForecasts).set(data).where(eq(revenueForecasts.id, existing[0].id)).returning();
      return updated;
    }
    const [created] = await db.insert(revenueForecasts).values(data).returning();
    return created;
  }

  async createRevenueForecastsBulk(data: InsertRevenueForecast[]): Promise<void> {
    if (data.length === 0) return;
    const batchSize = 500;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      await db.insert(revenueForecasts).values(batch);
    }
  }

  async deleteRevenueForecasts(year?: number): Promise<void> {
    if (year) {
      await db.delete(revenueForecasts).where(eq(revenueForecasts.year, year));
    } else {
      await db.delete(revenueForecasts);
    }
  }

  async deleteLocationLevelForecasts(): Promise<void> {
    await db.delete(revenueForecasts).where(isNotNull(revenueForecasts.locationName));
  }
}

export const storage = new DatabaseStorage();
