import { index, jsonb, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";
import type { StoredOrderItem } from "./account";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const supplierContactsTable = pgTable("supplier_contacts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  key: text("supplier_key").notNull(),
  name: text("supplier_name").notNull(),
  whatsapp: varchar("whatsapp", { length: 15 }).notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("supplier_contacts_owner_key_idx").on(t.userId, t.key)]);

export const generatedOrdersTable = pgTable("generated_orders", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  requestId: text("request_id").notNull(),
  selectionFingerprint: text("selection_fingerprint").notNull(),
  supplierKey: text("supplier_key").notNull(),
  supplierName: text("supplier_name").notNull(),
  kind: text("kind").$type<"replenishment" | "backup">().notNull(),
  items: jsonb("items").$type<StoredOrderItem[]>().notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("generated_orders_owner_request_supplier_idx").on(t.userId, t.requestId, t.supplierKey),
  index("generated_orders_owner_created_idx").on(t.userId, t.createdAt),
]);
export const insertSupplierContactSchema = createInsertSchema(supplierContactsTable).omit({ id: true, updatedAt: true });
export const insertGeneratedOrderSchema = createInsertSchema(generatedOrdersTable).omit({ id: true, createdAt: true });
export type InsertSupplierContact = z.infer<typeof insertSupplierContactSchema>;
export type SupplierContactRow = typeof supplierContactsTable.$inferSelect;
export type InsertGeneratedOrder = z.infer<typeof insertGeneratedOrderSchema>;
export type GeneratedOrderRow = typeof generatedOrdersTable.$inferSelect;
