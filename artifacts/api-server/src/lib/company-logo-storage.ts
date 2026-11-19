import { randomUUID } from "node:crypto";
import type { Response } from "express";

const SIDECAR = "http://127.0.0.1:1106";
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
type ObjectMethod = "GET" | "PUT" | "DELETE";

function privateDirectory(): string {
  const directory = process.env.PRIVATE_OBJECT_DIR?.trim();
  if (!directory) throw new Error("PRIVATE_OBJECT_DIR is not configured.");
  return directory.replace(/\/+$/, "");
}

function parsePath(path: string): { bucketName: string; objectName: string } {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const parts = normalized.split("/").filter(Boolean);
  const bucketName = parts.shift();
  const objectName = parts.join("/");
  if (!bucketName || !objectName) throw new Error("Invalid private object path.");
  return { bucketName, objectName };
}

function getStorageLocation(objectPath: string): { bucketName: string; objectName: string } {
  if (!objectPath.startsWith("/objects/uploads/company/")) {
    throw new Error("Invalid company logo path.");
  }
  const relativePath = objectPath.slice("/objects/".length);
  return parsePath(`${privateDirectory()}/${relativePath}`);
}

async function signedObjectUrl(objectPath: string, method: ObjectMethod): Promise<string> {
  const { bucketName, objectName } = getStorageLocation(objectPath);
  const response = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName,
      object_name: objectName,
      method,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Could not sign company logo ${method} URL (${response.status}).`);
  const result: unknown = await response.json();
  if (!result || typeof result !== "object" || !("signed_url" in result) ||
      typeof result.signed_url !== "string") {
    throw new Error("Object storage returned an invalid signed URL.");
  }
  return result.signed_url;
}

export async function createCompanyLogoUpload(
  uploadId = randomUUID(),
): Promise<{ uploadURL: string; objectPath: string }> {
  const objectPath = `/objects/uploads/company/${uploadId}`;
  const uploadURL = await signedObjectUrl(objectPath, "PUT");
  return { uploadURL, objectPath };
}

function sniffImageType(bytes: Buffer): string | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

async function readCompanyLogo(objectPath: string): Promise<{ bytes: Buffer; contentType: string }> {
  const url = await signedObjectUrl(objectPath, "GET");
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Could not read company logo (${response.status}).`);
  const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_TYPES.has(contentType)) throw new Error("Unsupported company logo content type.");
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_LOGO_BYTES) {
    throw new Error("Company logo is larger than allowed.");
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_LOGO_BYTES) throw new Error("Company logo size is invalid.");
  return { bytes, contentType };
}

export async function validateUploadedCompanyLogo(
  objectPath: string,
  expectedType: string,
  expectedSize: number,
): Promise<void> {
  if (!ALLOWED_TYPES.has(expectedType) || expectedSize < 1 || expectedSize > MAX_LOGO_BYTES) {
    throw new Error("Invalid company logo size or format.");
  }
  const { bytes, contentType } = await readCompanyLogo(objectPath);
  if (bytes.length !== expectedSize || contentType !== expectedType || sniffImageType(bytes) !== expectedType) {
    throw new Error("The uploaded file does not match the declared image type or size.");
  }
}

export async function serveCompanyLogo(objectPath: string, res: Response): Promise<void> {
  const { bytes, contentType } = await readCompanyLogo(objectPath);
  if (sniffImageType(bytes) !== contentType) throw new Error("Invalid company logo data.");
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Length", String(bytes.length));
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", "inline");
  res.end(bytes);
}

export async function deleteCompanyLogo(objectPath: string): Promise<void> {
  const url = await signedObjectUrl(objectPath, "DELETE");
  const response = await fetch(url, { method: "DELETE", signal: AbortSignal.timeout(30_000) });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Could not delete replaced company logo (${response.status}).`);
  }
}
