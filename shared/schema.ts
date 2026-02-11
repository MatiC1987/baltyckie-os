import { pgTable, text, serial, integer, boolean, timestamp, numeric, date, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
// Export auth models as required by Replit Auth
export * from "./models/auth";

export const owners = pgTable("owners", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ownerType: text("owner_type").default("osoba_fizyczna"),
  nip: text("nip"),
  phone: text("phone"),
  email: text("email"),
  notes: text("notes"),
});

export const apartments = pgTable("apartments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  hotresName: text("hotres_name"),
  location: text("location"),
  address: text("address"),
  ownerName: text("owner_name"),
  ownerId: integer("owner_id").references(() => owners.id),
  active: boolean("active").default(true),
  photoUrl: text("photo_url"),
  leaseStartDate: date("lease_start_date"),
  leaseEndDate: date("lease_end_date"),
});

export const reservations = pgTable("reservations", {
  id: serial("id").primaryKey(),
  reservationNumber: text("reservation_number").notNull(),
  apartmentId: integer("apartment_id").references(() => apartments.id),
  apartmentIds: integer("apartment_ids").array(),
  addDate: date("add_date"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  guestName: text("guest_name").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  prepayment: decimal("prepayment", { precision: 10, scale: 2 }).default("0"),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).default("0"),
  surcharge: decimal("surcharge", { precision: 10, scale: 2 }).default("0"),
  status: text("status").notNull(), // 'DO_OPLACENIA', 'PRZYJETA', 'ANULOWANA'
  createdAt: timestamp("created_at").defaultNow(),
});

export const leases = pgTable("leases", {
  id: serial("id").primaryKey(),
  apartmentId: integer("apartment_id").references(() => apartments.id),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"), // Nullable for indefinite
  rentAmount: decimal("rent_amount", { precision: 10, scale: 2 }).notNull(),
  communityFee: decimal("community_fee", { precision: 10, scale: 2 }).default("0"),
  tenantName: text("tenant_name"),
  description: text("description"),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  category: text("category").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  apartmentId: integer("apartment_id").references(() => apartments.id),
  description: text("description"),
  type: text("type").notNull(), // 'FIXED', 'VARIABLE'
  vatAmount: decimal("vat_amount", { precision: 10, scale: 2 }),
  isForecast: boolean("is_forecast").default(false),
  vendor: text("vendor"),
  invoiceIssued: boolean("invoice_issued").default(false),
  invoiceNumber: text("invoice_number"),
});

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").default("BANK"),
});

export const accountSnapshots = pgTable("account_snapshots", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").references(() => accounts.id).notNull(),
  date: date("date").notNull(),
  balance: decimal("balance", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
});

export const attachments = pgTable("attachments", {
  id: serial("id").primaryKey(),
  apartmentId: integer("apartment_id").references(() => apartments.id).notNull(),
  fileName: text("file_name").notNull(),
  objectPath: text("object_path").notNull(),
  fileType: text("file_type"),
  category: text("category").default("UMOWA"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone"),
  email: text("email"),
  pesel: text("pesel"),
  birthDate: date("birth_date"),
  cooperationType: text("cooperation_type").notNull(), // 'ETAT', 'PRACA_NA_H'
  contractType: text("contract_type"), // 'CZAS_OKRESLONY', 'CZAS_NIEOKRESLONY'
  contractStart: date("contract_start"),
  contractEnd: date("contract_end"),
  position: text("position").notNull(), // 'KIEROWNIK_RECEPCJI', 'PRACOWNIK_RECEPCJI', 'KONSERWATOR', 'OSOBA_SPRZATAJACA', 'FINANCIAL_MANAGER'
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }),
  comment: text("comment"),
  status: text("status").notNull().default("AKTYWNY"), // 'AKTYWNY', 'NIEAKTYWNY'
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const medicalExams = pgTable("medical_exams", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  examName: text("exam_name").notNull(),
  examDate: date("exam_date").notNull(),
  validUntil: date("valid_until").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const ownerPayments = pgTable("owner_payments", {
  id: serial("id").primaryKey(),
  apartmentId: integer("apartment_id").references(() => apartments.id).notNull(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentDate: date("payment_date").notNull(),
});

export const blockades = pgTable("blockades", {
  id: serial("id").primaryKey(),
  apartmentId: integer("apartment_id").references(() => apartments.id).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  photoUrl: text("photo_url"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const serviceContractCategories = pgTable("service_contract_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const serviceContracts = pgTable("service_contracts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  categoryId: integer("category_id").references(() => serviceContractCategories.id),
  signDate: date("sign_date"),
  duration: text("duration"),
  endDate: date("end_date"),
  serviceAddress: text("service_address"),
  monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const ownersRelations = relations(owners, ({ many }) => ({
  apartments: many(apartments),
}));

export const apartmentsRelations = relations(apartments, ({ one, many }) => ({
  owner: one(owners, {
    fields: [apartments.ownerId],
    references: [owners.id],
  }),
  reservations: many(reservations),
  leases: many(leases),
  expenses: many(expenses),
  attachments: many(attachments),
  ownerPayments: many(ownerPayments),
}));

export const reservationsRelations = relations(reservations, ({ one }) => ({
  apartment: one(apartments, {
    fields: [reservations.apartmentId],
    references: [apartments.id],
  }),
}));

export const leasesRelations = relations(leases, ({ one }) => ({
  apartment: one(apartments, {
    fields: [leases.apartmentId],
    references: [apartments.id],
  }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  apartment: one(apartments, {
    fields: [expenses.apartmentId],
    references: [apartments.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ many }) => ({
  snapshots: many(accountSnapshots),
}));

export const accountSnapshotsRelations = relations(accountSnapshots, ({ one }) => ({
  account: one(accounts, {
    fields: [accountSnapshots.accountId],
    references: [accounts.id],
  }),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  apartment: one(apartments, {
    fields: [attachments.apartmentId],
    references: [apartments.id],
  }),
}));

export const employeesRelations = relations(employees, ({ many }) => ({
  medicalExams: many(medicalExams),
}));

export const medicalExamsRelations = relations(medicalExams, ({ one }) => ({
  employee: one(employees, {
    fields: [medicalExams.employeeId],
    references: [employees.id],
  }),
}));

export const ownerPaymentsRelations = relations(ownerPayments, ({ one }) => ({
  apartment: one(apartments, {
    fields: [ownerPayments.apartmentId],
    references: [apartments.id],
  }),
}));

export const blockadesRelations = relations(blockades, ({ one }) => ({
  apartment: one(apartments, {
    fields: [blockades.apartmentId],
    references: [apartments.id],
  }),
}));

export const locationsRelations = relations(locations, () => ({}));

export const serviceContractCategoriesRelations = relations(serviceContractCategories, ({ many }) => ({
  contracts: many(serviceContracts),
}));

export const serviceContractsRelations = relations(serviceContracts, ({ one }) => ({
  category: one(serviceContractCategories, {
    fields: [serviceContracts.categoryId],
    references: [serviceContractCategories.id],
  }),
}));

// Insert Schemas
export const insertOwnerSchema = createInsertSchema(owners).omit({ id: true });
export const insertApartmentSchema = createInsertSchema(apartments).omit({ id: true });
export const insertReservationSchema = createInsertSchema(reservations).omit({ id: true, createdAt: true });
export const insertLeaseSchema = createInsertSchema(leases).omit({ id: true });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true });
export const insertAccountSchema = createInsertSchema(accounts).omit({ id: true });
export const insertAccountSnapshotSchema = createInsertSchema(accountSnapshots).omit({ id: true });
export const insertAttachmentSchema = createInsertSchema(attachments).omit({ id: true, uploadedAt: true });
export const insertEmployeeSchema = createInsertSchema(employees).omit({ id: true, createdAt: true });
export const insertMedicalExamSchema = createInsertSchema(medicalExams).omit({ id: true, createdAt: true });
export const insertOwnerPaymentSchema = createInsertSchema(ownerPayments).omit({ id: true });
export const insertBlockadeSchema = createInsertSchema(blockades).omit({ id: true, createdAt: true });
export const insertLocationSchema = createInsertSchema(locations).omit({ id: true, createdAt: true });
export const insertServiceContractCategorySchema = createInsertSchema(serviceContractCategories).omit({ id: true, createdAt: true });
export const insertServiceContractSchema = createInsertSchema(serviceContracts).omit({ id: true, createdAt: true });

// Types
export type Owner = typeof owners.$inferSelect;
export type InsertOwner = z.infer<typeof insertOwnerSchema>;
export type Apartment = typeof apartments.$inferSelect;
export type InsertApartment = z.infer<typeof insertApartmentSchema>;
export type Reservation = typeof reservations.$inferSelect;
export type InsertReservation = z.infer<typeof insertReservationSchema>;
export type Lease = typeof leases.$inferSelect;
export type InsertLease = z.infer<typeof insertLeaseSchema>;
export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Account = typeof accounts.$inferSelect;
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type AccountSnapshot = typeof accountSnapshots.$inferSelect;
export type InsertAccountSnapshot = z.infer<typeof insertAccountSnapshotSchema>;
export type Attachment = typeof attachments.$inferSelect;
export type InsertAttachment = z.infer<typeof insertAttachmentSchema>;
export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type MedicalExam = typeof medicalExams.$inferSelect;
export type InsertMedicalExam = z.infer<typeof insertMedicalExamSchema>;
export type OwnerPayment = typeof ownerPayments.$inferSelect;
export type InsertOwnerPayment = z.infer<typeof insertOwnerPaymentSchema>;
export type Blockade = typeof blockades.$inferSelect;
export type InsertBlockade = z.infer<typeof insertBlockadeSchema>;
export type Location = typeof locations.$inferSelect;
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type ServiceContractCategory = typeof serviceContractCategories.$inferSelect;
export type InsertServiceContractCategory = z.infer<typeof insertServiceContractCategorySchema>;
export type ServiceContract = typeof serviceContracts.$inferSelect;
export type InsertServiceContract = z.infer<typeof insertServiceContractSchema>;

export const saldoEntries = pgTable("saldo_entries", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  operationName: text("operation_name").notNull(),
  reservationNumber: text("reservation_number"),
  guestName: text("guest_name"),
  type: text("type"),
  paymentMethod: text("payment_method"),
  kasaFiskalna: text("kasa_fiskalna"),
  faktura: text("faktura"),
  cashAmount: numeric("cash_amount", { precision: 12, scale: 2 }),
  saldo: numeric("saldo", { precision: 12, scale: 2 }),
  authCode: text("auth_code"),
  cardAmount: numeric("card_amount", { precision: 12, scale: 2 }),
  notes: text("notes"),
  entryKind: text("entry_kind"),
  category: text("category"),
});

export const insertSaldoEntrySchema = createInsertSchema(saldoEntries).omit({ id: true });
export type SaldoEntry = typeof saldoEntries.$inferSelect;
export type InsertSaldoEntry = z.infer<typeof insertSaldoEntrySchema>;
