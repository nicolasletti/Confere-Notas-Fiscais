import { index, integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const companyLogoUploadsTable = pgTable(
  "company_logo_uploads",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    objectPath: varchar("object_path", { length: 1000 }).notNull().unique(),
    contentType: varchar("content_type", { length: 40 }).notNull(),
    size: integer("size").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("company_logo_uploads_owner_created_idx").on(table.userId, table.createdAt)],
);

export type CompanyLogoUpload = typeof companyLogoUploadsTable.$inferSelect;
