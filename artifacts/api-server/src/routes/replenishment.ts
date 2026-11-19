import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { accountInvoicesTable, db } from "@workspace/db";
import { GetReplenishmentResponse } from "@workspace/api-zod";
import { replenishment } from "../lib/replenishment";

const router: IRouter = Router();
router.get("/account/replenishment", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Entre na sua conta para continuar." });
    return;
  }
  const invoices = await db.select({
    id: accountInvoicesTable.id, invoice: accountInvoicesTable.invoice,
    originalXml: accountInvoicesTable.originalXml,
  }).from(accountInvoicesTable).where(eq(accountInvoicesTable.userId, req.user.id));
  res.json(GetReplenishmentResponse.parse(replenishment(invoices)));
});
export default router;
