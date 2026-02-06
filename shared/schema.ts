import { pgTable, text, serial, integer, boolean, timestamp, numeric, date, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
// Export auth models as required by Replit Auth
export * from "./models/auth";

export const owners = pgTable("owners", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  notes: text("notes"),
});

export const apartments = pgTable("apartments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location"),
  address: text("address"),
  ownerName: text("owner_name"),
  ownerId: integer("owner_id").references(() => owners.id),
  active: boolean("active").default(true),
  photoUrl: text("photo_url"),
});

export const reservations = pgTable("reservations", {
  id: serial("id").primaryKey(),
  reservationNumber: text("reservation_number").notNull(),
  apartmentId: integer("apartment_id").references(() => apartments.id),
  startDate: date("start_date").notNull(), // stored as YYYY-MM-DD string
  endDate: date("end_date").notNull(),
  guestName: text("guest_name").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  prepayment: decimal("prepayment", { precision: 10, scale: 2 }).default("0"),
  surcharge: decimal("surcharge", { precision: 10, scale: 2 }).default("0"),
  status: text("status").notNull(), // 'ACCEPTED', 'CANCELLED', etc.
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

// Insert Schemas
export const insertOwnerSchema = createInsertSchema(owners).omit({ id: true });
export const insertApartmentSchema = createInsertSchema(apartments).omit({ id: true });
export const insertReservationSchema = createInsertSchema(reservations).omit({ id: true, createdAt: true });
export const insertLeaseSchema = createInsertSchema(leases).omit({ id: true });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true });
export const insertAccountSchema = createInsertSchema(accounts).omit({ id: true });
export const insertAccountSnapshotSchema = createInsertSchema(accountSnapshots).omit({ id: true });
export const insertAttachmentSchema = createInsertSchema(attachments).omit({ id: true, uploadedAt: true });

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
