import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export interface StoredOrderItem {
  id: string;
  descricao: string;
  quantidade: string;
  unidade: string;
  precoUnitario: string;
}

export interface StoredNfeItem {
  productCode?: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  total: string;
}

export interface StoredInvoice {
  issuerCnpj?: string;
  issuer: string;
  number: string;
  issuedAt: string;
  hasCompleteIbsCbs: boolean;
  items: StoredNfeItem[];
}

export interface StoredConferenceResult {
  invoiceItemIndex: number;
  description: string;
  orderItemId: string | null;
  matchedOrderDescription: string | null;
  receivedQuantity: string;
  kind: "charge" | "favorable" | "ok" | "invalid" | "not-in-order";
  totalCents: string | null;
  quantityPartCents: string | null;
  pricePartCents: string | null;
}

export const accountOrdersTable = pgTable(
  "account_orders",
  {
    userId: varchar("user_id")
      .primaryKey()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    items: jsonb("items").$type<StoredOrderItem[]>().notNull().default([]),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
);

export const accountInvoicesTable = pgTable(
  "account_invoices",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    identity: text("identity").notNull(),
    originalFileName: varchar("original_file_name", { length: 255 }).notNull(),
    issuer: varchar("issuer", { length: 500 }).notNull(),
    invoiceNumber: varchar("invoice_number", { length: 40 }).notNull(),
    issuedAt: text("issued_at").notNull(),
    hasCompleteIbsCbs: boolean("has_complete_ibs_cbs").notNull(),
    invoice: jsonb("invoice").$type<StoredInvoice>().notNull(),
    originalXml: text("original_xml").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("account_invoices_owner_identity_idx").on(table.userId, table.identity),
    index("account_invoices_owner_created_idx").on(table.userId, table.createdAt),
  ],
);

export const accountConferencesTable = pgTable(
  "account_conferences",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    invoiceId: integer("invoice_id"),
    identity: text("identity").notNull(),
    supplierName: varchar("supplier_name", { length: 500 }).notNull(),
    invoiceNumber: varchar("invoice_number", { length: 40 }).notNull(),
    issuedAt: text("issued_at").notNull(),
    totalExtraChargeCents: text("total_extra_charge_cents").notNull(),
    hasCompleteIbsCbs: boolean("has_complete_ibs_cbs").notNull(),
    results: jsonb("results").$type<StoredConferenceResult[]>().notNull().default([]),
    savedAt: timestamp("saved_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.invoiceId],
      foreignColumns: [accountInvoicesTable.id],
      name: "account_conferences_invoice_id_fkey",
    }).onDelete("set null"),
    uniqueIndex("account_conferences_owner_identity_idx").on(table.userId, table.identity),
    index("account_conferences_owner_saved_idx").on(table.userId, table.savedAt),
  ],
);
