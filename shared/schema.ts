import { pgTable, text, serial, integer, boolean, timestamp, numeric, date, decimal, jsonb, varchar, uniqueIndex } from "drizzle-orm/pg-core";
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
  notes: text("notes"),
  source: text("source"),
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
  recurrenceType: text("recurrence_type"), // 'MIESIECZNIE', 'KWARTALNIE', 'ROCZNIE'
  recurrenceEndDate: date("recurrence_end_date"),
  parentExpenseId: integer("parent_expense_id"),
});

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").default("BANK"),
  category: text("category").default("KONTA_BANKOWE"),
  balanceSource: text("balance_source").default("manual"),
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
  contractId: integer("contract_id").references(() => ownerContracts.id),
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
  pin: text("pin"),
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

export const ownerContracts = pgTable("owner_contracts", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").references(() => owners.id),
  apartmentId: integer("apartment_id").references(() => apartments.id),
  monthlyRent: decimal("monthly_rent", { precision: 12, scale: 2 }),
  additionalFees: decimal("additional_fees", { precision: 12, scale: 2 }),
  startDate: date("start_date"),
  endDate: date("end_date"),
  contractType: text("contract_type").default("UMOWA"),
  parentContractId: integer("parent_contract_id"),
  pdfPath: text("pdf_path"),
  extractedData: text("extracted_data"),
  status: text("status").default("AKTYWNA"),
  notes: text("notes"),
  paymentFrequency: text("payment_frequency").default("MIESIECZNIE"),
  paymentDay: integer("payment_day"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const ownerContractApartments = pgTable("owner_contract_apartments", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").references(() => ownerContracts.id, { onDelete: 'cascade' }).notNull(),
  apartmentId: integer("apartment_id").references(() => apartments.id).notNull(),
  rentAmount: decimal("rent_amount", { precision: 12, scale: 2 }),
  additionalFeesAmount: decimal("additional_fees_amount", { precision: 12, scale: 2 }),
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
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  gpsRadius: integer("gps_radius").default(200),
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
  contractType: text("contract_type"),
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
  timeEntries: many(timeEntries),
  workSchedules: many(workSchedules),
  leaveRequests: many(leaveRequests),
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

export const ownerContractsRelations = relations(ownerContracts, ({ one }) => ({
  owner: one(owners, { fields: [ownerContracts.ownerId], references: [owners.id] }),
  apartment: one(apartments, { fields: [ownerContracts.apartmentId], references: [apartments.id] }),
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

export const serviceContractAttachments = pgTable("service_contract_attachments", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").references(() => serviceContracts.id, { onDelete: "cascade" }).notNull(),
  category: text("category").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type"),
  objectPath: text("object_path").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const serviceContractsRelations = relations(serviceContracts, ({ one, many }) => ({
  category: one(serviceContractCategories, {
    fields: [serviceContracts.categoryId],
    references: [serviceContractCategories.id],
  }),
  attachments: many(serviceContractAttachments),
}));

export const serviceContractAttachmentsRelations = relations(serviceContractAttachments, ({ one }) => ({
  contract: one(serviceContracts, { fields: [serviceContractAttachments.contractId], references: [serviceContracts.id] }),
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
export const insertServiceContractAttachmentSchema = createInsertSchema(serviceContractAttachments).omit({ id: true, uploadedAt: true });
export const insertOwnerContractSchema = createInsertSchema(ownerContracts).omit({ id: true, createdAt: true });
export const insertOwnerContractApartmentSchema = createInsertSchema(ownerContractApartments).omit({ id: true });

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
export type ServiceContractAttachment = typeof serviceContractAttachments.$inferSelect;
export type InsertServiceContractAttachment = z.infer<typeof insertServiceContractAttachmentSchema>;
export type OwnerContract = typeof ownerContracts.$inferSelect;
export type InsertOwnerContract = z.infer<typeof insertOwnerContractSchema>;
export type OwnerContractApartment = typeof ownerContractApartments.$inferSelect;
export type InsertOwnerContractApartment = z.infer<typeof insertOwnerContractApartmentSchema>;

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
  personName: text("person_name"),
});

export const insertSaldoEntrySchema = createInsertSchema(saldoEntries).omit({ id: true });
export type SaldoEntry = typeof saldoEntries.$inferSelect;
export type InsertSaldoEntry = z.infer<typeof insertSaldoEntrySchema>;

export const saldoInitialBalances = pgTable("saldo_initial_balances", {
  id: serial("id").primaryKey(),
  personName: text("person_name").notNull().unique(),
  initialBalance: numeric("initial_balance", { precision: 12, scale: 2 }).notNull().default("0.00"),
});

export type SaldoInitialBalance = typeof saldoInitialBalances.$inferSelect;

export const saldoCategories = pgTable("saldo_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  personName: text("person_name"),
});

export const insertSaldoCategorySchema = createInsertSchema(saldoCategories).omit({ id: true });
export type SaldoCategory = typeof saldoCategories.$inferSelect;
export type InsertSaldoCategory = z.infer<typeof insertSaldoCategorySchema>;

export const subleases = pgTable("subleases", {
  id: serial("id").primaryKey(),
  tenantType: text("tenant_type").notNull().default("osoba_fizyczna"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  companyName: text("company_name"),
  nip: text("nip"),
  street: text("street"),
  postalCode: text("postal_code"),
  city: text("city"),
  peselOrPassport: text("pesel_or_passport"),
  idNumber: text("id_number"),
  phone: text("phone"),
  email: text("email"),
  invoiceEmail: text("invoice_email"),
  vatRate: text("vat_rate").default("23%"),
  apartmentId: integer("apartment_id").references(() => apartments.id),
  apartmentIds: integer("apartment_ids").array(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  paymentDay: integer("payment_day"),
  rentAmount: numeric("rent_amount", { precision: 12, scale: 2 }),
  additionalFees: numeric("additional_fees", { precision: 12, scale: 2 }),
  mediaByMeters: boolean("media_by_meters").default(false),
  hasDeposit: boolean("has_deposit").default(false),
  depositAmount: numeric("deposit_amount", { precision: 12, scale: 2 }),
  depositReturnDate: date("deposit_return_date"),
  status: text("status").notNull().default("AKTYWNA"),
  comment: text("comment"),
  preparedAt: timestamp("prepared_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const subleasePayments = pgTable("sublease_payments", {
  id: serial("id").primaryKey(),
  subleaseId: integer("sublease_id").references(() => subleases.id, { onDelete: "cascade" }).notNull(),
  apartmentId: integer("apartment_id").references(() => apartments.id),
  title: text("title").notNull(),
  category: text("category").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  dueDate: date("due_date").notNull(),
  status: text("status").notNull().default("do_oplacenia"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const subleaseAttachments = pgTable("sublease_attachments", {
  id: serial("id").primaryKey(),
  subleaseId: integer("sublease_id").references(() => subleases.id, { onDelete: "cascade" }).notNull(),
  category: text("category").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type"),
  objectPath: text("object_path").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const subleaseApartmentChanges = pgTable("sublease_apartment_changes", {
  id: serial("id").primaryKey(),
  subleaseId: integer("sublease_id").references(() => subleases.id, { onDelete: "cascade" }).notNull(),
  oldApartmentId: integer("old_apartment_id").references(() => apartments.id).notNull(),
  newApartmentId: integer("new_apartment_id").references(() => apartments.id).notNull(),
  changeDate: date("change_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const subleasesRelations = relations(subleases, ({ one, many }) => ({
  apartment: one(apartments, { fields: [subleases.apartmentId], references: [apartments.id] }),
  payments: many(subleasePayments),
  attachments: many(subleaseAttachments),
  apartmentChanges: many(subleaseApartmentChanges),
}));

export const subleasePaymentsRelations = relations(subleasePayments, ({ one }) => ({
  sublease: one(subleases, { fields: [subleasePayments.subleaseId], references: [subleases.id] }),
}));

export const subleaseAttachmentsRelations = relations(subleaseAttachments, ({ one }) => ({
  sublease: one(subleases, { fields: [subleaseAttachments.subleaseId], references: [subleases.id] }),
}));

export const subleaseApartmentChangesRelations = relations(subleaseApartmentChanges, ({ one }) => ({
  sublease: one(subleases, { fields: [subleaseApartmentChanges.subleaseId], references: [subleases.id] }),
  oldApartment: one(apartments, { fields: [subleaseApartmentChanges.oldApartmentId], references: [apartments.id] }),
  newApartment: one(apartments, { fields: [subleaseApartmentChanges.newApartmentId], references: [apartments.id] }),
}));

export const insertSubleaseSchema = createInsertSchema(subleases).omit({ id: true, createdAt: true });
export type Sublease = typeof subleases.$inferSelect;
export type InsertSublease = z.infer<typeof insertSubleaseSchema>;

export const insertSubleasePaymentSchema = createInsertSchema(subleasePayments).omit({ id: true, createdAt: true });
export type SubleasePayment = typeof subleasePayments.$inferSelect;
export type InsertSubleasePayment = z.infer<typeof insertSubleasePaymentSchema>;

export const insertSubleaseAttachmentSchema = createInsertSchema(subleaseAttachments).omit({ id: true, uploadedAt: true });
export type SubleaseAttachment = typeof subleaseAttachments.$inferSelect;
export type InsertSubleaseAttachment = z.infer<typeof insertSubleaseAttachmentSchema>;

export const insertSubleaseApartmentChangeSchema = createInsertSchema(subleaseApartmentChanges).omit({ id: true, createdAt: true });
export type SubleaseApartmentChange = typeof subleaseApartmentChanges.$inferSelect;
export type InsertSubleaseApartmentChange = z.infer<typeof insertSubleaseApartmentChangeSchema>;

export const subleaseMeterReadings = pgTable("sublease_meter_readings", {
  id: serial("id").primaryKey(),
  subleaseId: integer("sublease_id").references(() => subleases.id, { onDelete: "cascade" }).notNull(),
  meterType: text("meter_type").notNull(),
  yearMonth: text("year_month"),
  readingDate: date("reading_date"),
  reading: numeric("reading", { precision: 12, scale: 3 }),
  status: text("status").notNull().default("confirmed"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const subleaseMeterSettings = pgTable("sublease_meter_settings", {
  id: serial("id").primaryKey(),
  subleaseId: integer("sublease_id").references(() => subleases.id, { onDelete: "cascade" }).notNull(),
  meterType: text("meter_type").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 4 }),
  initialReading: numeric("initial_reading", { precision: 12, scale: 3 }),
  initialDate: date("initial_date"),
});

export const subleaseMeterPrices = pgTable("sublease_meter_prices", {
  id: serial("id").primaryKey(),
  subleaseId: integer("sublease_id").references(() => subleases.id, { onDelete: "cascade" }).notNull(),
  meterType: text("meter_type").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 4 }).notNull(),
  validFrom: date("valid_from").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSubleaseMeterReadingSchema = createInsertSchema(subleaseMeterReadings).omit({ id: true, createdAt: true });
export type SubleaseMeterReading = typeof subleaseMeterReadings.$inferSelect;
export type InsertSubleaseMeterReading = z.infer<typeof insertSubleaseMeterReadingSchema>;

export const insertSubleaseMeterSettingSchema = createInsertSchema(subleaseMeterSettings).omit({ id: true });
export type SubleaseMeterSetting = typeof subleaseMeterSettings.$inferSelect;
export type InsertSubleaseMeterSetting = z.infer<typeof insertSubleaseMeterSettingSchema>;

export const insertSubleaseMeterPriceSchema = createInsertSchema(subleaseMeterPrices).omit({ id: true, createdAt: true });
export type SubleaseMeterPrice = typeof subleaseMeterPrices.$inferSelect;
export type InsertSubleaseMeterPrice = z.infer<typeof insertSubleaseMeterPriceSchema>;

export const subleaseElectricityCharges = pgTable("sublease_electricity_charges", {
  id: serial("id").primaryKey(),
  subleaseId: integer("sublease_id").references(() => subleases.id, { onDelete: "cascade" }).notNull(),
  chargeName: text("charge_name").notNull(),
  chargeType: text("charge_type").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 4 }).notNull(),
  validFrom: date("valid_from").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSubleaseElectricityChargeSchema = createInsertSchema(subleaseElectricityCharges).omit({ id: true, createdAt: true });
export type SubleaseElectricityCharge = typeof subleaseElectricityCharges.$inferSelect;
export type InsertSubleaseElectricityCharge = z.infer<typeof insertSubleaseElectricityChargeSchema>;

export const mediaSettlementReports = pgTable("media_settlement_reports", {
  id: serial("id").primaryKey(),
  subleaseId: integer("sublease_id").references(() => subleases.id, { onDelete: "cascade" }).notNull(),
  periodFrom: date("period_from").notNull(),
  periodTo: date("period_to").notNull(),
  electricityConsumption: numeric("electricity_consumption", { precision: 12, scale: 3 }),
  electricityCost: numeric("electricity_cost", { precision: 12, scale: 2 }),
  electricityFixedCharges: numeric("electricity_fixed_charges", { precision: 12, scale: 2 }),
  electricityVatRate: numeric("electricity_vat_rate", { precision: 5, scale: 2 }),
  electricityNetto: numeric("electricity_netto", { precision: 12, scale: 2 }),
  electricityBrutto: numeric("electricity_brutto", { precision: 12, scale: 2 }),
  coldWaterConsumption: numeric("cold_water_consumption", { precision: 12, scale: 3 }),
  coldWaterCost: numeric("cold_water_cost", { precision: 12, scale: 2 }),
  hotWaterConsumption: numeric("hot_water_consumption", { precision: 12, scale: 3 }),
  hotWaterCost: numeric("hot_water_cost", { precision: 12, scale: 2 }),
  totalCost: numeric("total_cost", { precision: 12, scale: 2 }),
  paymentStatus: text("payment_status").notNull().default("NIEOPLACONE"),
  generatedAt: timestamp("generated_at").defaultNow(),
});

export const insertMediaSettlementReportSchema = createInsertSchema(mediaSettlementReports).omit({ id: true, generatedAt: true });
export type MediaSettlementReport = typeof mediaSettlementReports.$inferSelect;
export type InsertMediaSettlementReport = z.infer<typeof insertMediaSettlementReportSchema>;

export const appUsers = pgTable("app_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  permissions: text("permissions").array().default([]),
  active: boolean("active").default(true),
  profileImageUrl: text("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAppUserSchema = createInsertSchema(appUsers).omit({ id: true, createdAt: true });
export type AppUser = typeof appUsers.$inferSelect;
export type InsertAppUser = z.infer<typeof insertAppUserSchema>;

export const documentCategories = pgTable("document_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").default(0),
});

export const insertDocumentCategorySchema = createInsertSchema(documentCategories).omit({ id: true });
export type DocumentCategory = typeof documentCategories.$inferSelect;
export type InsertDocumentCategory = z.infer<typeof insertDocumentCategorySchema>;

export const documentTemplates = pgTable("document_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  categoryId: integer("category_id").references(() => documentCategories.id),
  fileName: text("file_name").notNull(),
  objectPath: text("object_path").notNull(),
  description: text("description"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const insertDocumentTemplateSchema = createInsertSchema(documentTemplates).omit({ id: true, uploadedAt: true });
export type DocumentTemplate = typeof documentTemplates.$inferSelect;
export type InsertDocumentTemplate = z.infer<typeof insertDocumentTemplateSchema>;

export const costSchedules = pgTable("cost_schedules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  frequency: text("frequency").notNull().default("monthly"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  notes: text("notes"),
  active: boolean("active").default(true),
  linkCategoryId: text("link_category_id"),
  linkItemIndex: integer("link_item_index"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const costSchedulePayments = pgTable("cost_schedule_payments", {
  id: serial("id").primaryKey(),
  scheduleId: integer("schedule_id").references(() => costSchedules.id, { onDelete: "cascade" }).notNull(),
  dueDate: date("due_date").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  forecastAmount: numeric("forecast_amount", { precision: 12, scale: 2 }),
  status: text("status").notNull().default("NIEOPLACONE"),
  paidDate: date("paid_date"),
  notes: text("notes"),
});

export const costSchedulesRelations = relations(costSchedules, ({ many }) => ({
  payments: many(costSchedulePayments),
}));

export const costSchedulePaymentsRelations = relations(costSchedulePayments, ({ one }) => ({
  schedule: one(costSchedules, { fields: [costSchedulePayments.scheduleId], references: [costSchedules.id] }),
}));

export const insertCostScheduleSchema = createInsertSchema(costSchedules).omit({ id: true, createdAt: true });
export type CostSchedule = typeof costSchedules.$inferSelect;
export type InsertCostSchedule = z.infer<typeof insertCostScheduleSchema>;

export const insertCostSchedulePaymentSchema = createInsertSchema(costSchedulePayments).omit({ id: true });
export type CostSchedulePayment = typeof costSchedulePayments.$inferSelect;
export type InsertCostSchedulePayment = z.infer<typeof insertCostSchedulePaymentSchema>;

export const installmentSchedules = pgTable("installment_schedules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  installmentAmount: numeric("installment_amount", { precision: 12, scale: 2 }).notNull(),
  numberOfInstallments: integer("number_of_installments").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  interestRate: numeric("interest_rate", { precision: 5, scale: 2 }),
  notes: text("notes"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const installmentPayments = pgTable("installment_payments", {
  id: serial("id").primaryKey(),
  scheduleId: integer("schedule_id").references(() => installmentSchedules.id, { onDelete: "cascade" }).notNull(),
  installmentNumber: integer("installment_number").notNull(),
  dueDate: date("due_date").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  principalAmount: numeric("principal_amount", { precision: 12, scale: 2 }),
  interestAmount: numeric("interest_amount", { precision: 12, scale: 2 }),
  status: text("status").notNull().default("NIEOPLACONE"),
  paidDate: date("paid_date"),
  notes: text("notes"),
});

export const installmentSchedulesRelations = relations(installmentSchedules, ({ many }) => ({
  payments: many(installmentPayments),
}));

export const installmentPaymentsRelations = relations(installmentPayments, ({ one }) => ({
  schedule: one(installmentSchedules, { fields: [installmentPayments.scheduleId], references: [installmentSchedules.id] }),
}));

export const insertInstallmentScheduleSchema = createInsertSchema(installmentSchedules).omit({ id: true, createdAt: true });
export type InstallmentSchedule = typeof installmentSchedules.$inferSelect;
export type InsertInstallmentSchedule = z.infer<typeof insertInstallmentScheduleSchema>;

export const insertInstallmentPaymentSchema = createInsertSchema(installmentPayments).omit({ id: true });
export type InstallmentPayment = typeof installmentPayments.$inferSelect;
export type InsertInstallmentPayment = z.infer<typeof insertInstallmentPaymentSchema>;

export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  sidebarLayout: text("sidebar_layout"),
  sidebarCollapsed: text("sidebar_collapsed"),
  sidebarLabels: text("sidebar_labels"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UserPreference = typeof userPreferences.$inferSelect;

export const importMetadata = pgTable("import_metadata", {
  id: serial("id").primaryKey(),
  importType: text("import_type").notNull(),
  importedAt: timestamp("imported_at").defaultNow(),
  recordsImported: integer("records_imported").default(0),
  recordsUpdated: integer("records_updated").default(0),
  recordsSkipped: integer("records_skipped").default(0),
  details: text("details"),
});

export const insertImportMetadataSchema = createInsertSchema(importMetadata).omit({ id: true, importedAt: true });
export type ImportMetadata = typeof importMetadata.$inferSelect;
export type InsertImportMetadata = z.infer<typeof insertImportMetadataSchema>;

export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  userName: text("user_name"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id"),
  entityName: text("entity_name"),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({ id: true, createdAt: true });
export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull(),
  documentType: text("document_type").default("FAKTURA_VAT"),
  currency: text("currency").default("PLN"),
  issueDate: date("issue_date").notNull(),
  saleDate: date("sale_date"),
  dueDate: date("due_date").notNull(),
  issuePlace: text("issue_place"),
  sellerName: text("seller_name").notNull(),
  sellerNip: text("seller_nip"),
  sellerAddress: text("seller_address"),
  sellerCity: text("seller_city"),
  sellerPostalCode: text("seller_postal_code"),
  sellerCountry: text("seller_country"),
  sellerBankAccount: text("seller_bank_account"),
  sellerBankAccount2: text("seller_bank_account2"),
  buyerName: text("buyer_name").notNull(),
  buyerNip: text("buyer_nip"),
  buyerAddress: text("buyer_address"),
  buyerCity: text("buyer_city"),
  buyerPostalCode: text("buyer_postal_code"),
  buyerCountry: text("buyer_country"),
  buyerEmail: text("buyer_email"),
  items: text("items").notNull(),
  netAmount: numeric("net_amount", { precision: 12, scale: 2 }).notNull(),
  vatRate: text("vat_rate").default("23%"),
  vatAmount: numeric("vat_amount", { precision: 12, scale: 2 }),
  grossAmount: numeric("gross_amount", { precision: 12, scale: 2 }).notNull(),
  paymentStatus: text("payment_status").default("NIEOPLACONA"),
  paymentMethod: text("payment_method"),
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).default("0"),
  status: text("status").notNull().default("WYSTAWIONA"),
  sourceType: text("source_type"),
  sourceId: integer("source_id"),
  correctionOfId: integer("correction_of_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true });
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  entityType: text("entity_type"),
  entityId: integer("entity_id"),
  isRead: boolean("is_read").default(false),
  dueDate: date("due_date"),
  targetPanel: text("target_panel"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export const revenueForecasts = pgTable("revenue_forecasts", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  locationName: text("location_name"),
  apartmentId: integer("apartment_id").references(() => apartments.id),
  forecast: decimal("forecast", { precision: 12, scale: 2 }).default("0"),
  actual: decimal("actual", { precision: 12, scale: 2 }).default("0"),
  rentalType: text("rental_type"),
});

export const insertRevenueForecastSchema = createInsertSchema(revenueForecasts).omit({ id: true });
export type RevenueForecast = typeof revenueForecasts.$inferSelect;
export type InsertRevenueForecast = z.infer<typeof insertRevenueForecastSchema>;

export const costForecasts = pgTable("cost_forecasts", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  apartmentId: integer("apartment_id").references(() => apartments.id),
  category: text("category"),
  forecast: decimal("forecast", { precision: 12, scale: 2 }).default("0"),
  actual: decimal("actual", { precision: 12, scale: 2 }).default("0"),
  sourceType: text("source_type").default("manual"),
  sourceContractId: integer("source_contract_id"),
  locationName: text("location_name"),
});

export const insertCostForecastSchema = createInsertSchema(costForecasts).omit({ id: true });
export type CostForecast = typeof costForecasts.$inferSelect;
export type InsertCostForecast = z.infer<typeof insertCostForecastSchema>;

export const companySettings = pgTable("company_settings", {
  id: serial("id").primaryKey(),
  companyName: text("company_name"),
  nip: text("nip"),
  regon: text("regon"),
  street: text("street"),
  postalCode: text("postal_code"),
  city: text("city"),
  bankAccount: text("bank_account"),
  bankName: text("bank_name"),
  representativeName: text("representative_name"),
  representativeRole: text("representative_role"),
  phone: text("phone"),
  email: text("email"),
  logoUrl: text("logo_url"),
  logoDarkUrl: text("logo_dark_url"),
  websiteUrl: text("website_url"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCompanySettingsSchema = createInsertSchema(companySettings).omit({ id: true, updatedAt: true });
export type CompanySettings = typeof companySettings.$inferSelect;
export type InsertCompanySettings = z.infer<typeof insertCompanySettingsSchema>;

export const accountingNotes = pgTable("accounting_notes", {
  id: serial("id").primaryKey(),
  subleaseId: integer("sublease_id").references(() => subleases.id, { onDelete: "cascade" }).notNull(),
  reportId: integer("report_id").references(() => mediaSettlementReports.id, { onDelete: "cascade" }).notNull(),
  noteNumber: text("note_number").notNull(),
  objectPath: text("object_path").notNull(),
  fileName: text("file_name").notNull(),
  status: text("status").notNull().default("NOWA"),
  apartmentName: text("apartment_name"),
  tenantName: text("tenant_name"),
  mediaTypes: text("media_types"),
  noteMonth: integer("note_month"),
  noteYear: integer("note_year"),
  generatedAt: timestamp("generated_at").defaultNow(),
});

export const insertAccountingNoteSchema = createInsertSchema(accountingNotes).omit({ id: true, generatedAt: true });
export type AccountingNote = typeof accountingNotes.$inferSelect;
export type InsertAccountingNote = z.infer<typeof insertAccountingNoteSchema>;

export const costInvoices = pgTable("cost_invoices", {
  id: serial("id").primaryKey(),
  fileName: text("file_name").notNull(),
  originalFileName: text("original_file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  objectStoragePath: text("object_storage_path").notNull(),
  invoiceDate: date("invoice_date").notNull(),
  invoiceMonth: integer("invoice_month").notNull(),
  invoiceYear: integer("invoice_year").notNull(),
  comment: text("comment"),
  status: text("status").notNull().default("NOWA"),
  uploadedBy: text("uploaded_by").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  linkedExpenseId: integer("linked_expense_id").references(() => expenses.id),
});

export const insertCostInvoiceSchema = createInsertSchema(costInvoices).omit({ id: true, uploadedAt: true });
export type CostInvoice = typeof costInvoices.$inferSelect;
export type InsertCostInvoice = z.infer<typeof insertCostInvoiceSchema>;

export const zipDownloadHistory = pgTable("zip_download_history", {
  id: serial("id").primaryKey(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  downloadedAt: timestamp("downloaded_at").defaultNow(),
  downloadedBy: text("downloaded_by").notNull(),
  invoiceCount: integer("invoice_count").notNull(),
});

export const insertZipDownloadHistorySchema = createInsertSchema(zipDownloadHistory).omit({ id: true, downloadedAt: true });
export type ZipDownloadHistory = typeof zipDownloadHistory.$inferSelect;
export type InsertZipDownloadHistory = z.infer<typeof insertZipDownloadHistorySchema>;

// ============ Handover Protocols (Protokoły zdawczo-odbiorcze) ============

export const handoverProtocols = pgTable("handover_protocols", {
  id: serial("id").primaryKey(),
  subleaseId: integer("sublease_id").references(() => subleases.id, { onDelete: "cascade" }).notNull(),
  protocolType: text("protocol_type").notNull(), // 'WYDANIE' | 'ZWROT'
  protocolDate: date("protocol_date").notNull(),
  protocolTime: text("protocol_time"), // HH:MM
  tenantName: text("tenant_name").notNull(),
  tenantPesel: text("tenant_pesel"),
  tenantIdNumber: text("tenant_id_number"),
  apartmentName: text("apartment_name").notNull(),
  apartmentAddress: text("apartment_address"),
  notes: text("notes"),
  status: text("status").notNull().default("SZKIC"), // 'SZKIC' | 'ZATWIERDZONY'
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const handoverProtocolRooms = pgTable("handover_protocol_rooms", {
  id: serial("id").primaryKey(),
  protocolId: integer("protocol_id").references(() => handoverProtocols.id, { onDelete: "cascade" }).notNull(),
  roomName: text("room_name").notNull(),
  wallsCondition: text("walls_condition"), // 'DOBRY' | 'USZKODZONY' | 'DO_NAPRAWY'
  floorCondition: text("floor_condition"),
  windowsCondition: text("windows_condition"),
  doorsCondition: text("doors_condition"),
  comments: text("comments"),
  sortOrder: integer("sort_order").default(0),
});

export const handoverProtocolItems = pgTable("handover_protocol_items", {
  id: serial("id").primaryKey(),
  protocolId: integer("protocol_id").references(() => handoverProtocols.id, { onDelete: "cascade" }).notNull(),
  itemName: text("item_name").notNull(),
  quantity: integer("quantity").default(1),
  condition: text("condition"), // 'NOWY' | 'DOBRY' | 'ZUZYTY' | 'USZKODZONY'
  comments: text("comments"),
  sortOrder: integer("sort_order").default(0),
});

export const handoverProtocolMeters = pgTable("handover_protocol_meters", {
  id: serial("id").primaryKey(),
  protocolId: integer("protocol_id").references(() => handoverProtocols.id, { onDelete: "cascade" }).notNull(),
  meterType: text("meter_type").notNull(), // 'PRAD' | 'WODA_ZIMNA' | 'WODA_CIEPLA' | 'GAZ' | 'OGRZEWANIE'
  meterNumber: text("meter_number"),
  reading: decimal("reading", { precision: 12, scale: 3 }),
  unit: text("unit"), // 'kWh' | 'm³' | 'GJ'
});

export const handoverProtocolsRelations = relations(handoverProtocols, ({ one, many }) => ({
  sublease: one(subleases, { fields: [handoverProtocols.subleaseId], references: [subleases.id] }),
  rooms: many(handoverProtocolRooms),
  items: many(handoverProtocolItems),
  meters: many(handoverProtocolMeters),
}));

export const handoverProtocolRoomsRelations = relations(handoverProtocolRooms, ({ one }) => ({
  protocol: one(handoverProtocols, { fields: [handoverProtocolRooms.protocolId], references: [handoverProtocols.id] }),
}));

export const handoverProtocolItemsRelations = relations(handoverProtocolItems, ({ one }) => ({
  protocol: one(handoverProtocols, { fields: [handoverProtocolItems.protocolId], references: [handoverProtocols.id] }),
}));

export const handoverProtocolMetersRelations = relations(handoverProtocolMeters, ({ one }) => ({
  protocol: one(handoverProtocols, { fields: [handoverProtocolMeters.protocolId], references: [handoverProtocols.id] }),
}));

export const insertHandoverProtocolSchema = createInsertSchema(handoverProtocols).omit({ id: true, createdAt: true });
export type HandoverProtocol = typeof handoverProtocols.$inferSelect;
export type InsertHandoverProtocol = z.infer<typeof insertHandoverProtocolSchema>;

export const insertHandoverProtocolRoomSchema = createInsertSchema(handoverProtocolRooms).omit({ id: true });
export type HandoverProtocolRoom = typeof handoverProtocolRooms.$inferSelect;
export type InsertHandoverProtocolRoom = z.infer<typeof insertHandoverProtocolRoomSchema>;

export const insertHandoverProtocolItemSchema = createInsertSchema(handoverProtocolItems).omit({ id: true });
export type HandoverProtocolItem = typeof handoverProtocolItems.$inferSelect;
export type InsertHandoverProtocolItem = z.infer<typeof insertHandoverProtocolItemSchema>;

export const insertHandoverProtocolMeterSchema = createInsertSchema(handoverProtocolMeters).omit({ id: true });
export type HandoverProtocolMeter = typeof handoverProtocolMeters.$inferSelect;
export type InsertHandoverProtocolMeter = z.infer<typeof insertHandoverProtocolMeterSchema>;

export const technicalInspections = pgTable("technical_inspections", {
  id: serial("id").primaryKey(),
  apartmentId: integer("apartment_id").references(() => apartments.id, { onDelete: "cascade" }),
  inspectionType: text("inspection_type").notNull(),
  lastDate: date("last_date"),
  nextDate: date("next_date").notNull(),
  status: text("status").notNull().default("ZAPLANOWANY"),
  notes: text("notes"),
  cost: numeric("cost", { precision: 12, scale: 2 }),
  contractor: text("contractor"),
  contractorPhone: text("contractor_phone"),
  recurrenceMonths: integer("recurrence_months"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const technicalInspectionsRelations = relations(technicalInspections, ({ one }) => ({
  apartment: one(apartments, { fields: [technicalInspections.apartmentId], references: [apartments.id] }),
}));

export const insertTechnicalInspectionSchema = createInsertSchema(technicalInspections).omit({ id: true, createdAt: true });
export type TechnicalInspection = typeof technicalInspections.$inferSelect;
export type InsertTechnicalInspection = z.infer<typeof insertTechnicalInspectionSchema>;

export const loans = pgTable("loans", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  debtor: text("debtor").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("AKTYWNA"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const loanPayments = pgTable("loan_payments", {
  id: serial("id").primaryKey(),
  loanId: integer("loan_id").references(() => loans.id, { onDelete: "cascade" }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  date: date("date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const loanPaymentsRelations = relations(loanPayments, ({ one }) => ({
  loan: one(loans, { fields: [loanPayments.loanId], references: [loans.id] }),
}));

export const loansRelations = relations(loans, ({ many }) => ({
  payments: many(loanPayments),
}));

export const insertLoanSchema = createInsertSchema(loans).omit({ id: true, createdAt: true });
export type Loan = typeof loans.$inferSelect;
export type InsertLoan = z.infer<typeof insertLoanSchema>;

export const insertLoanPaymentSchema = createInsertSchema(loanPayments).omit({ id: true, createdAt: true });
export type LoanPayment = typeof loanPayments.$inferSelect;
export type InsertLoanPayment = z.infer<typeof insertLoanPaymentSchema>;

// ==================== CUSTOMERS (CRM) ====================
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  companyName: text("company_name"),
  nip: text("nip"),
  street: text("street"),
  city: text("city"),
  postalCode: text("postal_code"),
  country: text("country").default("Polska"),
  segment: text("segment"),
  notes: text("notes"),
  totalStays: integer("total_stays").default(0),
  totalRevenue: numeric("total_revenue", { precision: 12, scale: 2 }).default("0"),
  lastStayDate: date("last_stay_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const customersRelations = relations(customers, () => ({}));

export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true });
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

// ==================== TASK MANAGEMENT ====================
export const taskProjects = pgTable("task_projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").default("#5ADBFA"),
  area: text("area"),
  archived: boolean("archived").default(false),
  sortOrder: integer("sort_order").default(0),
  userId: text("user_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const taskSections = pgTable("task_sections", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => taskProjects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").default(0),
  userId: text("user_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  notes: text("notes"),
  completed: boolean("completed").default(false),
  completedAt: timestamp("completed_at"),
  priority: text("priority").default("BRAK"),
  dueDate: date("due_date"),
  dueTime: text("due_time"),
  tags: text("tags").array(),
  projectId: integer("project_id").references(() => taskProjects.id, { onDelete: "set null" }),
  sectionId: integer("section_id").references(() => taskSections.id, { onDelete: "set null" }),
  parentTaskId: integer("parent_task_id"),
  sortOrder: integer("sort_order").default(0),
  recurring: text("recurring"),
  reminderDate: date("reminder_date"),
  reminderTime: text("reminder_time"),
  deadlineDate: date("deadline_date"),
  someday: boolean("someday").default(false),
  evening: boolean("evening").default(false),
  userId: text("user_id"),
  sharedWith: text("shared_with").array().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

export const taskChecklistItems = pgTable("task_checklist_items", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").references(() => tasks.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  completed: boolean("completed").default(false),
  sortOrder: integer("sort_order").default(0),
});

export const taskProjectsRelations = relations(taskProjects, ({ many }) => ({
  sections: many(taskSections),
  tasks: many(tasks),
}));

export const taskSectionsRelations = relations(taskSections, ({ one, many }) => ({
  project: one(taskProjects, { fields: [taskSections.projectId], references: [taskProjects.id] }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(taskProjects, { fields: [tasks.projectId], references: [taskProjects.id] }),
  section: one(taskSections, { fields: [tasks.sectionId], references: [taskSections.id] }),
  checklistItems: many(taskChecklistItems),
}));

export const taskChecklistItemsRelations = relations(taskChecklistItems, ({ one }) => ({
  task: one(tasks, { fields: [taskChecklistItems.taskId], references: [tasks.id] }),
}));

export const insertTaskProjectSchema = createInsertSchema(taskProjects).omit({ id: true, createdAt: true });
export type TaskProject = typeof taskProjects.$inferSelect;
export type InsertTaskProject = z.infer<typeof insertTaskProjectSchema>;

export const insertTaskSectionSchema = createInsertSchema(taskSections).omit({ id: true, createdAt: true });
export type TaskSection = typeof taskSections.$inferSelect;
export type InsertTaskSection = z.infer<typeof insertTaskSectionSchema>;

export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true });
export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;

export const insertTaskChecklistItemSchema = createInsertSchema(taskChecklistItems).omit({ id: true });
export type TaskChecklistItem = typeof taskChecklistItems.$inferSelect;
export type InsertTaskChecklistItem = z.infer<typeof insertTaskChecklistItemSchema>;

export const operationalCostForecasts = pgTable("operational_cost_forecasts", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  categoryId: text("category_id").notNull(),
  itemIndex: integer("item_index").notNull(),
  forecast: decimal("forecast", { precision: 12, scale: 2 }).default("0"),
  actual: decimal("actual", { precision: 12, scale: 2 }).default("0"),
  archived: boolean("archived").default(false),
});

export const insertOperationalCostForecastSchema = createInsertSchema(operationalCostForecasts).omit({ id: true });
export type OperationalCostForecast = typeof operationalCostForecasts.$inferSelect;
export type InsertOperationalCostForecast = z.infer<typeof insertOperationalCostForecastSchema>;

export const variableCostForecasts = pgTable("variable_cost_forecasts", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  name: text("name").notNull(),
  forecast: decimal("forecast", { precision: 12, scale: 2 }).default("0"),
  actual: decimal("actual", { precision: 12, scale: 2 }).default("0"),
});

export const insertVariableCostForecastSchema = createInsertSchema(variableCostForecasts).omit({ id: true });
export type VariableCostForecast = typeof variableCostForecasts.$inferSelect;
export type InsertVariableCostForecast = z.infer<typeof insertVariableCostForecastSchema>;

export const appConfig = pgTable("app_config", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type AppConfig = typeof appConfig.$inferSelect;

export const aptCostData = pgTable("apt_cost_data", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  entryId: varchar("entry_id", { length: 100 }).notNull(),
  category: varchar("category", { length: 200 }).notNull(),
  month: integer("month").notNull(),
  prognoza: numeric("prognoza", { precision: 12, scale: 2 }).default("0"),
  realized: numeric("realized", { precision: 12, scale: 2 }).default("0"),
}, (t) => [
  uniqueIndex("apt_cost_data_unique").on(t.year, t.entryId, t.category, t.month),
]);

export const insertAptCostDataSchema = createInsertSchema(aptCostData).omit({ id: true });
export type AptCostData = typeof aptCostData.$inferSelect;
export type InsertAptCostData = z.infer<typeof insertAptCostDataSchema>;

export const aptCostSettings = pgTable("apt_cost_settings", {
  entryId: varchar("entry_id", { length: 100 }).primaryKey(),
  categories: jsonb("categories"),
  colors: jsonb("colors"),
  entryColor: varchar("entry_color", { length: 50 }),
  sortOrder: jsonb("sort_order"),
});

export const insertAptCostSettingsSchema = createInsertSchema(aptCostSettings);
export type AptCostSettings = typeof aptCostSettings.$inferSelect;
export type InsertAptCostSettings = z.infer<typeof insertAptCostSettingsSchema>;

export const opCostData = pgTable("op_cost_data", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  catId: varchar("cat_id", { length: 100 }).notNull(),
  itemIdx: integer("item_idx").notNull(),
  month: integer("month").notNull(),
  prognoza: numeric("prognoza", { precision: 12, scale: 2 }).default("0"),
  realized: numeric("realized", { precision: 12, scale: 2 }).default("0"),
}, (t) => [
  uniqueIndex("op_cost_data_unique").on(t.year, t.catId, t.itemIdx, t.month),
]);

export const insertOpCostDataSchema = createInsertSchema(opCostData).omit({ id: true });
export type OpCostData = typeof opCostData.$inferSelect;
export type InsertOpCostData = z.infer<typeof insertOpCostDataSchema>;

export const timeEntries = pgTable("time_entries", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  date: date("date").notNull(),
  clockIn: timestamp("clock_in").notNull(),
  clockOut: timestamp("clock_out"),
  breakStart: timestamp("break_start"),
  breakEnd: timestamp("break_end"),
  breakMinutes: integer("break_minutes").default(0),
  clockInLocationId: integer("clock_in_location_id").references(() => locations.id),
  clockOutLocationId: integer("clock_out_location_id").references(() => locations.id),
  clockInLat: decimal("clock_in_lat", { precision: 10, scale: 7 }),
  clockInLng: decimal("clock_in_lng", { precision: 10, scale: 7 }),
  clockOutLat: decimal("clock_out_lat", { precision: 10, scale: 7 }),
  clockOutLng: decimal("clock_out_lng", { precision: 10, scale: 7 }),
  status: text("status").notNull().default("AKTYWNA"),
  isOutsideZone: boolean("is_outside_zone").default(false),
  note: text("note"),
  adminNote: text("admin_note"),
  editedBy: text("edited_by"),
  editedAt: timestamp("edited_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  employee: one(employees, { fields: [timeEntries.employeeId], references: [employees.id] }),
  clockInLocation: one(locations, { fields: [timeEntries.clockInLocationId], references: [locations.id] }),
}));

export const insertTimeEntrySchema = createInsertSchema(timeEntries).omit({ id: true, createdAt: true });
export type TimeEntry = typeof timeEntries.$inferSelect;
export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;

export const workSchedules = pgTable("work_schedules", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  locationId: integer("location_id").references(() => locations.id),
  date: date("date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  shiftName: text("shift_name"),
  shiftColor: text("shift_color"),
  allowEarlyStart: boolean("allow_early_start").default(false),
  allowOvertime: boolean("allow_overtime").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const workSchedulesRelations = relations(workSchedules, ({ one }) => ({
  employee: one(employees, { fields: [workSchedules.employeeId], references: [employees.id] }),
  location: one(locations, { fields: [workSchedules.locationId], references: [locations.id] }),
}));

export const insertWorkScheduleSchema = createInsertSchema(workSchedules).omit({ id: true, createdAt: true });
export type WorkSchedule = typeof workSchedules.$inferSelect;
export type InsertWorkSchedule = z.infer<typeof insertWorkScheduleSchema>;

export const leaveRequests = pgTable("leave_requests", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  type: text("type").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  days: integer("days").notNull(),
  comment: text("comment"),
  status: text("status").notNull().default("OCZEKUJACY"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const leaveRequestsRelations = relations(leaveRequests, ({ one }) => ({
  employee: one(employees, { fields: [leaveRequests.employeeId], references: [employees.id] }),
}));

export const insertLeaveRequestSchema = createInsertSchema(leaveRequests).omit({ id: true, createdAt: true });
export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type InsertLeaveRequest = z.infer<typeof insertLeaveRequestSchema>;

export const recepcjaUsers = pgTable("recepcja_users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  role: text("role").default("kierownik_recepcji"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRecepcjaUserSchema = createInsertSchema(recepcjaUsers).omit({ id: true, createdAt: true });
export type RecepcjaUser = typeof recepcjaUsers.$inferSelect;
export type InsertRecepcjaUser = z.infer<typeof insertRecepcjaUserSchema>;

export const recepcjaAuditLog = pgTable("recepcja_audit_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => recepcjaUsers.id),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type RecepcjaAuditLog = typeof recepcjaAuditLog.$inferSelect;

export const tenantDataSubmissions = pgTable("tenant_data_submissions", {
  id: serial("id").primaryKey(),
  submittedBy: integer("submitted_by").references(() => recepcjaUsers.id),
  tenantName: text("tenant_name").notNull(),
  tenantPesel: text("tenant_pesel"),
  tenantNip: text("tenant_nip"),
  tenantEmail: text("tenant_email"),
  tenantPhone: text("tenant_phone"),
  tenantAddress: text("tenant_address"),
  apartmentId: integer("apartment_id").references(() => apartments.id),
  moveInDate: date("move_in_date"),
  rentAmount: numeric("rent_amount", { precision: 10, scale: 2 }),
  depositAmount: numeric("deposit_amount", { precision: 10, scale: 2 }),
  notes: text("notes"),
  status: text("status").notNull().default("NOWE"),
  contractPdfPath: text("contract_pdf_path"),
  signedPdfPath: text("signed_pdf_path"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTenantDataSubmissionSchema = createInsertSchema(tenantDataSubmissions).omit({ id: true, createdAt: true, updatedAt: true });
export type TenantDataSubmission = typeof tenantDataSubmissions.$inferSelect;
export type InsertTenantDataSubmission = z.infer<typeof insertTenantDataSubmissionSchema>;

export const meterReadingsLog = pgTable("meter_readings_log", {
  id: serial("id").primaryKey(),
  subleaseId: integer("sublease_id").references(() => subleases.id),
  meterType: text("meter_type").notNull(),
  readingDate: date("reading_date").notNull(),
  readingValue: numeric("reading_value", { precision: 12, scale: 3 }).notNull(),
  submittedBy: integer("submitted_by").references(() => recepcjaUsers.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export type MeterReadingsLog = typeof meterReadingsLog.$inferSelect;

export const subleaseChangeHistory = pgTable("sublease_change_history", {
  id: serial("id").primaryKey(),
  subleaseId: integer("sublease_id").references(() => subleases.id),
  changedBy: text("changed_by"),
  fieldName: text("field_name").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type SubleaseChangeHistory = typeof subleaseChangeHistory.$inferSelect;

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  userType: text("user_type").notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const issues = pgTable("issues", {
  id: serial("id").primaryKey(),
  apartmentId: integer("apartment_id").references(() => apartments.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority").notNull().default("NORMALNY"),
  status: text("status").notNull().default("OTWARTE"),
  category: text("category").notNull().default("ogólne"),
  reportedBy: text("reported_by").notNull(),
  assignedTo: text("assigned_to"),
  photoUrls: text("photo_urls").array(),
  cost: numeric("cost", { precision: 12, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertIssueSchema = createInsertSchema(issues).omit({ id: true, createdAt: true, updatedAt: true });
export type Issue = typeof issues.$inferSelect;
export type InsertIssue = z.infer<typeof insertIssueSchema>;

export const locationLogs = pgTable("location_logs", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  timeEntryId: integer("time_entry_id").references(() => timeEntries.id, { onDelete: "cascade" }),
  latitude: numeric("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: numeric("longitude", { precision: 10, scale: 7 }).notNull(),
  accuracy: numeric("accuracy", { precision: 8, scale: 2 }),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  locationId: integer("location_id").references(() => locations.id),
  distanceFromZone: numeric("distance_from_zone", { precision: 10, scale: 2 }),
});

export const insertLocationLogSchema = createInsertSchema(locationLogs).omit({ id: true });
export type LocationLog = typeof locationLogs.$inferSelect;
export type InsertLocationLog = z.infer<typeof insertLocationLogSchema>;

export const employeeTrainings = pgTable("employee_trainings", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  provider: text("provider"),
  completedDate: date("completed_date").notNull(),
  expiryDate: date("expiry_date"),
  certificateNumber: text("certificate_number"),
  certificateFileUrl: text("certificate_file_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEmployeeTrainingSchema = createInsertSchema(employeeTrainings).omit({ id: true, createdAt: true });
export type EmployeeTraining = typeof employeeTrainings.$inferSelect;
export type InsertEmployeeTraining = z.infer<typeof insertEmployeeTrainingSchema>;

export const employeeContracts = pgTable("employee_contracts", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  salary: decimal("salary", { precision: 12, scale: 2 }),
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }),
  position: text("position"),
  workHours: text("work_hours"),
  trialPeriod: boolean("trial_period").default(false),
  trialEndDate: date("trial_end_date"),
  signedDate: date("signed_date"),
  fileUrl: text("file_url"),
  status: text("status").notNull().default("AKTYWNA"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEmployeeContractSchema = createInsertSchema(employeeContracts).omit({ id: true, createdAt: true });
export type EmployeeContract = typeof employeeContracts.$inferSelect;
export type InsertEmployeeContract = z.infer<typeof insertEmployeeContractSchema>;

// ==================== BANK STATEMENT IMPORT ====================
export const bankStatements = pgTable("bank_statements", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").references(() => accounts.id),
  fileName: text("file_name").notNull(),
  importDate: timestamp("import_date").defaultNow(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  transactionCount: integer("transaction_count").default(0),
  status: text("status").notNull().default("ZAIMPORTOWANY"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bankTransactions = pgTable("bank_transactions", {
  id: serial("id").primaryKey(),
  statementId: integer("statement_id").references(() => bankStatements.id, { onDelete: "cascade" }).notNull(),
  accountId: integer("account_id").references(() => accounts.id),
  date: date("date").notNull(),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  balance: decimal("balance", { precision: 12, scale: 2 }),
  counterparty: text("counterparty"),
  category: text("category"),
  aiCategory: text("ai_category"),
  matched: boolean("matched").default(false),
  matchedExpenseId: integer("matched_expense_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBankStatementSchema = createInsertSchema(bankStatements).omit({ id: true, createdAt: true, importDate: true });
export type BankStatement = typeof bankStatements.$inferSelect;
export type InsertBankStatement = z.infer<typeof insertBankStatementSchema>;

export const insertBankTransactionSchema = createInsertSchema(bankTransactions).omit({ id: true, createdAt: true });
export type BankTransaction = typeof bankTransactions.$inferSelect;
export type InsertBankTransaction = z.infer<typeof insertBankTransactionSchema>;

// ==================== PAYROLL ====================
export const payrollPeriods = pgTable("payroll_periods", {
  id: serial("id").primaryKey(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  status: text("status").notNull().default("OTWARTY"),
  totalGross: decimal("total_gross", { precision: 12, scale: 2 }).default("0"),
  totalNet: decimal("total_net", { precision: 12, scale: 2 }).default("0"),
  generatedAt: timestamp("generated_at"),
  approvedAt: timestamp("approved_at"),
  approvedBy: text("approved_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const payrollEntries = pgTable("payroll_entries", {
  id: serial("id").primaryKey(),
  periodId: integer("period_id").references(() => payrollPeriods.id, { onDelete: "cascade" }).notNull(),
  employeeId: integer("employee_id").references(() => employees.id).notNull(),
  totalHours: decimal("total_hours", { precision: 8, scale: 2 }).default("0"),
  overtimeHours: decimal("overtime_hours", { precision: 8, scale: 2 }).default("0"),
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }),
  basePay: decimal("base_pay", { precision: 12, scale: 2 }).default("0"),
  overtimePay: decimal("overtime_pay", { precision: 12, scale: 2 }).default("0"),
  bonus: decimal("bonus", { precision: 12, scale: 2 }).default("0"),
  deductions: decimal("deductions", { precision: 12, scale: 2 }).default("0"),
  grossPay: decimal("gross_pay", { precision: 12, scale: 2 }).default("0"),
  netPay: decimal("net_pay", { precision: 12, scale: 2 }).default("0"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPayrollPeriodSchema = createInsertSchema(payrollPeriods).omit({ id: true, createdAt: true, generatedAt: true, approvedAt: true });
export type PayrollPeriod = typeof payrollPeriods.$inferSelect;
export type InsertPayrollPeriod = z.infer<typeof insertPayrollPeriodSchema>;

export const insertPayrollEntrySchema = createInsertSchema(payrollEntries).omit({ id: true, createdAt: true });
export type PayrollEntry = typeof payrollEntries.$inferSelect;
export type InsertPayrollEntry = z.infer<typeof insertPayrollEntrySchema>;

// ==================== CHECKOUT SETTLEMENT ====================
export const checkoutSettlements = pgTable("checkout_settlements", {
  id: serial("id").primaryKey(),
  subleaseId: integer("sublease_id").references(() => subleases.id, { onDelete: "cascade" }).notNull(),
  settlementDate: date("settlement_date").notNull(),
  depositAmount: decimal("deposit_amount", { precision: 12, scale: 2 }).default("0"),
  depositReturned: decimal("deposit_returned", { precision: 12, scale: 2 }).default("0"),
  depositDeductions: decimal("deposit_deductions", { precision: 12, scale: 2 }).default("0"),
  outstandingRent: decimal("outstanding_rent", { precision: 12, scale: 2 }).default("0"),
  mediaCost: decimal("media_cost", { precision: 12, scale: 2 }).default("0"),
  damageCost: decimal("damage_cost", { precision: 12, scale: 2 }).default("0"),
  otherCosts: decimal("other_costs", { precision: 12, scale: 2 }).default("0"),
  finalBalance: decimal("final_balance", { precision: 12, scale: 2 }).default("0"),
  notes: text("notes"),
  damageDescription: text("damage_description"),
  status: text("status").notNull().default("SZKIC"),
  items: jsonb("items"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCheckoutSettlementSchema = createInsertSchema(checkoutSettlements).omit({ id: true, createdAt: true });
export type CheckoutSettlement = typeof checkoutSettlements.$inferSelect;
export type InsertCheckoutSettlement = z.infer<typeof insertCheckoutSettlementSchema>;

// ==================== DASHBOARD WIDGETS ====================
export const dashboardWidgetConfigs = pgTable("dashboard_widget_configs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  widgets: jsonb("widgets").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ==================== LEGAL CASES ====================
export const legalCases = pgTable("legal_cases", {
  id: serial("id").primaryKey(),
  caseNumber: text("case_number"),
  title: text("title").notNull(),
  description: text("description"),
  caseType: text("case_type"),
  status: text("status").default("NOWA"),
  priority: text("priority").default("NORMALNY"),
  role: text("role"),
  courtName: text("court_name"),
  judge: text("judge"),
  opposingParty: text("opposing_party"),
  opposingPartyContact: text("opposing_party_contact"),
  lawyerName: text("lawyer_name"),
  lawyerContact: text("lawyer_contact"),
  apartmentId: integer("apartment_id").references(() => apartments.id),
  tenantName: text("tenant_name"),
  claimAmount: numeric("claim_amount", { precision: 12, scale: 2 }),
  settledAmount: numeric("settled_amount", { precision: 12, scale: 2 }),
  legalCosts: numeric("legal_costs", { precision: 12, scale: 2 }),
  filingDate: date("filing_date"),
  nextHearingDate: date("next_hearing_date"),
  deadlineDate: date("deadline_date"),
  closedDate: date("closed_date"),
  notes: text("notes"),
  tags: text("tags").array(),
  documentUrls: text("document_urls").array(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const legalCaseEvents = pgTable("legal_case_events", {
  id: serial("id").primaryKey(),
  legalCaseId: integer("legal_case_id").references(() => legalCases.id, { onDelete: "cascade" }).notNull(),
  eventDate: date("event_date").notNull(),
  eventType: text("event_type"),
  title: text("title").notNull(),
  description: text("description"),
  outcome: text("outcome"),
  documentUrls: text("document_urls").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const legalCasesRelations = relations(legalCases, ({ one, many }) => ({
  apartment: one(apartments, { fields: [legalCases.apartmentId], references: [apartments.id] }),
  events: many(legalCaseEvents),
}));

export const legalCaseEventsRelations = relations(legalCaseEvents, ({ one }) => ({
  legalCase: one(legalCases, { fields: [legalCaseEvents.legalCaseId], references: [legalCases.id] }),
}));

export const insertLegalCaseSchema = createInsertSchema(legalCases).omit({ id: true, createdAt: true, updatedAt: true });
export type LegalCase = typeof legalCases.$inferSelect;
export type InsertLegalCase = z.infer<typeof insertLegalCaseSchema>;

export const insertLegalCaseEventSchema = createInsertSchema(legalCaseEvents).omit({ id: true, createdAt: true });
export type LegalCaseEvent = typeof legalCaseEvents.$inferSelect;
export type InsertLegalCaseEvent = z.infer<typeof insertLegalCaseEventSchema>;

export const taskPanelUsers = pgTable("task_panel_users", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  active: boolean("active").default(true),
  isAdmin: boolean("is_admin").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTaskPanelUserSchema = createInsertSchema(taskPanelUsers).omit({ id: true, createdAt: true });
export type TaskPanelUser = typeof taskPanelUsers.$inferSelect;
export type InsertTaskPanelUser = z.infer<typeof insertTaskPanelUserSchema>;
