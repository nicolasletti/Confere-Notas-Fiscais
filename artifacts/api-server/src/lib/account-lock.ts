import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

type AccountTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function lockAccountUser(tx: AccountTransaction, userId: string): Promise<void> {
  await tx
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .for("update");
}
