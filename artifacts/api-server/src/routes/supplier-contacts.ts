import { Router, type IRouter } from "express";
import { db, supplierContactsTable } from "@workspace/db";
import { ListSupplierContactsResponse, SaveSupplierContactBody, SaveSupplierContactResponse } from "@workspace/api-zod";
import { normalizeWhatsapp } from "../lib/supplier-order-utils";
import { ownedSupplierContacts } from "../lib/owned-suppliers";

const router: IRouter = Router();
router.get("/account/supplier-contacts", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Entre na sua conta." }); return; }
  res.json(ListSupplierContactsResponse.parse(await ownedSupplierContacts(req.user.id)));
});
router.put("/account/supplier-contacts", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Entre na sua conta." }); return; }
  const parsed = SaveSupplierContactBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Informe o fornecedor e o WhatsApp." }); return; }
  const contact = (await ownedSupplierContacts(req.user.id)).find((c) => c.key === parsed.data.key);
  if (!contact) { res.status(400).json({ error: "Fornecedor não encontrado nesta conta." }); return; }
  let whatsapp: string;
  try { whatsapp = normalizeWhatsapp(parsed.data.whatsapp); }
  catch (error) { res.status(400).json({ error: (error as Error).message }); return; }
  await db.insert(supplierContactsTable).values({
    userId: req.user.id, key: contact.key, name: contact.name, whatsapp,
  }).onConflictDoUpdate({
    target: [supplierContactsTable.userId, supplierContactsTable.key],
    set: { name: contact.name, whatsapp, updatedAt: new Date() },
  });
  res.json(SaveSupplierContactResponse.parse({ ...contact, whatsapp }));
});
export default router;
