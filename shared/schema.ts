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

export const mediaSettlementReports = pgTable("media_settlement_reports", {
  id: serial("id").primaryKey(),
  subleaseId: integer("sublease_id").references(() => subleases.id, { onDelete: "cascade" }).notNull(),
  periodFrom: date("period_from").notNull(),
  periodTo: date("period_to").notNull(),
  electricityConsumption: numeric("electricity_consumption", { precision: 12, scale: 3 }),
  electricityCost: numeric("electricity_cost", { precision: 12, scale: 2 }),
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
