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
  saldoCategories
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";

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
  getCompanyBalance(): Promise<{ accounts: { id: number; name: string; type: string | null; latestBalance: string }[]; totalBalance: string }>;
  
  // Attachments
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
  deleteServiceContractCategory(id: number): Promise<void>;

  // Service Contracts
  getServiceContracts(): Promise<ServiceContract[]>;
  createServiceContract(contract: InsertServiceContract): Promise<ServiceContract>;
  updateServiceContract(id: number, contract: Partial<InsertServiceContract>): Promise<ServiceContract>;
  deleteServiceContract(id: number): Promise<void>;

  // Saldo
  getSaldoEntries(filters?: { startDate?: string; endDate?: string }): Promise<SaldoEntry[]>;
  getSaldoCategories(): Promise<string[]>;
  createSaldoCategory(name: string): Promise<void>;
  updateSaldoCategory(oldName: string, newName: string): Promise<void>;
  deleteSaldoCategory(name: string): Promise<void>;
  createSaldoEntry(entry: InsertSaldoEntry): Promise<SaldoEntry>;
  createSaldoEntriesBulk(entries: InsertSaldoEntry[]): Promise<SaldoEntry[]>;
  updateSaldoEntry(id: number, entry: Partial<InsertSaldoEntry>): Promise<SaldoEntry>;
  deleteSaldoEntry(id: number): Promise<void>;
  deleteAllSaldoEntries(): Promise<void>;

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

  async getCompanyBalance(): Promise<{ accounts: { id: number; name: string; type: string | null; latestBalance: string }[]; totalBalance: string }> {
    const allAccounts = await db.select().from(accounts);
    const allSnapshots = await db.select().from(accountSnapshots).orderBy(desc(accountSnapshots.date));

    const accountBalances = allAccounts.map(acc => {
      const latestSnapshot = allSnapshots.find(s => s.accountId === acc.id);
      return {
        id: acc.id,
        name: acc.name,
        type: acc.type,
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

  // Saldo
  async getSaldoEntries(filters?: { startDate?: string; endDate?: string }): Promise<SaldoEntry[]> {
    const conditions = [];
    if (filters?.startDate) conditions.push(gte(saldoEntries.date, filters.startDate));
    if (filters?.endDate) conditions.push(lte(saldoEntries.date, filters.endDate));
    return db.select().from(saldoEntries).where(conditions.length ? and(...conditions) : undefined).orderBy(saldoEntries.id);
  }

  async getSaldoCategories(): Promise<string[]> {
    const fromEntries = await db.selectDistinct({ category: saldoEntries.category }).from(saldoEntries).where(sql`${saldoEntries.category} IS NOT NULL AND ${saldoEntries.category} != ''`);
    const fromTable = await db.select({ name: saldoCategories.name }).from(saldoCategories);
    const all = new Set<string>();
    fromEntries.forEach(r => { if (r.category) all.add(r.category); });
    fromTable.forEach(r => all.add(r.name));
    return [...all].sort((a, b) => a.localeCompare(b, "pl"));
  }

  async createSaldoCategory(name: string): Promise<void> {
    await db.insert(saldoCategories).values({ name }).onConflictDoNothing();
  }

  async updateSaldoCategory(oldName: string, newName: string): Promise<void> {
    await db.update(saldoEntries).set({ category: newName }).where(eq(saldoEntries.category, oldName));
    const existing = await db.select().from(saldoCategories).where(eq(saldoCategories.name, oldName));
    if (existing.length > 0) {
      await db.update(saldoCategories).set({ name: newName }).where(eq(saldoCategories.name, oldName));
    }
  }

  async deleteSaldoCategory(name: string): Promise<void> {
    await db.update(saldoEntries).set({ category: null }).where(eq(saldoEntries.category, name));
    await db.delete(saldoCategories).where(eq(saldoCategories.name, name));
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
}

export const storage = new DatabaseStorage();
