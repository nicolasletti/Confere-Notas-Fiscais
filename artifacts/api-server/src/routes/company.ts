import { randomUUID } from "node:crypto";
import { and, eq, gte } from "drizzle-orm";
import {
  GetAccountCompanyResponse,
  RequestCompanyLogoUploadBody,
  RequestCompanyLogoUploadResponse,
  SaveAccountCompanyBody,
  SaveAccountCompanyResponse,
} from "@workspace/api-zod";
import { companyLogoUploadsTable, db, usersTable } from "@workspace/db";
import { Router, type IRouter } from "express";
import { isValidCnpj } from "@workspace/api-zod";
import {
  createCompanyLogoUpload,
  deleteCompanyLogo,
  serveCompanyLogo,
  validateUploadedCompanyLogo,
} from "../lib/company-logo-storage";

const router: IRouter = Router();
const states = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);
const uploadLifetimeMs = 20 * 60 * 1000;

function profileRecord(row: typeof usersTable.$inferSelect) {
  const complete = Boolean(
    row.companyName?.trim() && row.companyCnpj && row.companyBusinessType &&
    row.companyCity?.trim() && row.companyState && row.companyTaxRegime,
  );
  if (!complete) return null;
  return {
    name: row.companyName!.trim(),
    cnpj: row.companyCnpj!,
    businessType: row.companyBusinessType!,
    city: row.companyCity!.trim(),
    state: row.companyState!,
    whatsapp: row.companyWhatsapp ?? "",
    taxRegime: row.companyTaxRegime!,
    accountantEmail: row.accountantEmail ?? "",
    hasLogo: Boolean(row.companyLogoObjectPath),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function validateText(input: {
  name: string;
  cnpj: string;
  city: string;
  state: string;
  whatsapp: string;
  accountantEmail: string;
}): string | null {
  if (!input.name.trim() || !input.city.trim()) return "Informe o nome do comércio e a cidade.";
  if (!isValidCnpj(input.cnpj)) return "Confira o CNPJ e seus dígitos verificadores.";
  if (!states.has(input.state)) return "Escolha uma UF válida.";
  if (input.whatsapp && (
    !/^[+\d\s().-]+$/.test(input.whatsapp) ||
    input.whatsapp.replace(/\D/g, "").length < 10 ||
    input.whatsapp.replace(/\D/g, "").length > 13
  )) return "Informe um WhatsApp com DDD válido.";
  if (input.accountantEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.accountantEmail)) {
    return "Informe um e-mail válido para o contador.";
  }
  return null;
}

router.get("/account/company", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Entre na sua conta para continuar." });
    return;
  }
  const [row] = await db.select().from(usersTable).where(eq(usersTable.id, req.user.id)).limit(1);
  const profile = row ? profileRecord(row) : null;
  res.json(GetAccountCompanyResponse.parse({ profile }));
});

router.post("/account/company/logo-upload-url", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Entre na sua conta para continuar." });
    return;
  }
  const parsed = RequestCompanyLogoUploadBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Envie um logo PNG, JPG ou WebP de até 2 MB." });
    return;
  }

  const uploadId = randomUUID();
  try {
    const { uploadURL, objectPath } = await createCompanyLogoUpload(uploadId);
    await db.insert(companyLogoUploadsTable).values({
      id: uploadId,
      userId: req.user.id,
      objectPath,
      contentType: parsed.data.contentType,
      size: parsed.data.size,
    });
    res.json(RequestCompanyLogoUploadResponse.parse({ uploadId, uploadURL }));
  } catch (error) {
    req.log.error({ err: error }, "Could not prepare company logo upload");
    res.status(503).json({ error: "Não foi possível preparar o envio do logo agora." });
  }
});

router.put("/account/company", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Entre na sua conta para continuar." });
    return;
  }
  const parsed = SaveAccountCompanyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Confira os campos do cadastro da empresa." });
    return;
  }
  const input = {
    ...parsed.data,
    name: parsed.data.name.trim(),
    city: parsed.data.city.trim(),
    state: parsed.data.state.trim().toUpperCase(),
    whatsapp: parsed.data.whatsapp.trim(),
    accountantEmail: parsed.data.accountantEmail.trim(),
  };
  const validationError = validateText(input);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }
  if (input.logoUploadId && input.removeLogo) {
    res.status(400).json({ error: "Escolha um novo logo ou remova o atual, não os dois." });
    return;
  }

  const [current] = await db
    .select({ logoPath: usersTable.companyLogoObjectPath })
    .from(usersTable)
    .where(eq(usersTable.id, req.user.id))
    .limit(1);
  if (!current) {
    res.status(404).json({ error: "Conta não encontrada." });
    return;
  }

  let newLogoPath = input.removeLogo ? null : current.logoPath;
  if (input.logoUploadId) {
    const validAfter = new Date(Date.now() - uploadLifetimeMs);
    const [upload] = await db
      .select()
      .from(companyLogoUploadsTable)
      .where(and(
        eq(companyLogoUploadsTable.id, input.logoUploadId),
        eq(companyLogoUploadsTable.userId, req.user.id),
        gte(companyLogoUploadsTable.createdAt, validAfter),
      ))
      .limit(1);
    if (!upload) {
      res.status(400).json({ error: "O envio do logo expirou. Selecione a imagem novamente." });
      return;
    }
    try {
      await validateUploadedCompanyLogo(upload.objectPath, upload.contentType, upload.size);
    } catch (error) {
      req.log.warn({ err: error }, "Rejected invalid company logo upload");
      res.status(400).json({ error: "O arquivo enviado não é uma imagem válida." });
      return;
    }
    newLogoPath = upload.objectPath;
  }

  const saved = await db.transaction(async (tx) => {
    if (input.logoUploadId) {
      const [claimed] = await tx
        .delete(companyLogoUploadsTable)
        .where(and(
          eq(companyLogoUploadsTable.id, input.logoUploadId),
          eq(companyLogoUploadsTable.userId, req.user.id),
          gte(companyLogoUploadsTable.createdAt, new Date(Date.now() - uploadLifetimeMs)),
        ))
        .returning({ id: companyLogoUploadsTable.id });
      if (!claimed) return null;
    }
    const [row] = await tx
      .update(usersTable)
      .set({
        companyName: input.name,
        companyCnpj: input.cnpj,
        companyBusinessType: input.businessType,
        companyCity: input.city,
        companyState: input.state,
        companyWhatsapp: input.whatsapp || null,
        companyTaxRegime: input.taxRegime,
        accountantEmail: input.accountantEmail || null,
        companyLogoObjectPath: newLogoPath,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, req.user.id))
      .returning();
    return row ?? null;
  });

  if (!saved) {
    res.status(409).json({ error: "O envio do logo já foi usado. Selecione a imagem novamente." });
    return;
  }
  if (current.logoPath && current.logoPath !== newLogoPath) {
    try {
      await deleteCompanyLogo(current.logoPath);
    } catch (error) {
      req.log.warn({ err: error }, "Could not remove replaced company logo");
    }
  }
  res.json(SaveAccountCompanyResponse.parse({ profile: profileRecord(saved) }));
});

router.get("/account/company/logo", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Entre na sua conta para continuar." });
    return;
  }
  const [row] = await db
    .select({ objectPath: usersTable.companyLogoObjectPath })
    .from(usersTable)
    .where(eq(usersTable.id, req.user.id))
    .limit(1);
  if (!row?.objectPath) {
    res.status(404).json({ error: "Logo não encontrado." });
    return;
  }
  try {
    await serveCompanyLogo(row.objectPath, res);
  } catch (error) {
    req.log.error({ err: error }, "Could not serve company logo");
    if (!res.headersSent) res.status(404).json({ error: "Logo não encontrado." });
  }
});

export default router;
