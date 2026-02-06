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
  ownerPayments, OwnerPayment, InsertOwnerPayment
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

  // Accounts & Snapshots
  getAccounts(): Promise<Account[]>;
  createAccount(account: InsertAccount): Promise<Account>;
  getSnapshots(accountId?: number): Promise<AccountSnapshot[]>;
  createSnapshot(snapshot: InsertAccountSnapshot): Promise<AccountSnapshot>;
  
  // Attachments
  getAttachments(apartmentId: number): Promise<Attachment[]>;
  createAttachment(attachment: InsertAttachment): Promise<Attachment>;
  deleteAttachment(id: number): Promise<void>;

  // Owner Payments
  getOwnerPayments(apartmentId: number): Promise<OwnerPayment[]>;
  createOwnerPayment(payment: InsertOwnerPayment): Promise<OwnerPayment>;
  deleteOwnerPayment(id: number): Promise<void>;

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
    const revenueResult = await db.select({ value: sql<number>`sum(${reservations.price})` }).from(reservations).where(eq(reservations.status, 'ACCEPTED'));
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
