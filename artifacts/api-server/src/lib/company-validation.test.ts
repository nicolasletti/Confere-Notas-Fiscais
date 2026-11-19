import assert from "node:assert/strict";
import { test } from "node:test";
import { formatCnpj, isValidCnpj } from "@workspace/api-zod";

test("validates numeric CNPJ check digits and rejects malformed values", () => {
  assert.equal(isValidCnpj("11.222.333/0001-81"), true);
  assert.equal(isValidCnpj("11.222.333/0001-80"), false);
  assert.equal(isValidCnpj("00.000.000/0000-00"), false);
  assert.equal(isValidCnpj("1122233300018"), false);
});

test("validates the official alphanumeric CNPJ example", () => {
  assert.equal(isValidCnpj("12.ABC.345/01DE-35"), true);
  assert.equal(isValidCnpj("12.ABC.345/01DE-36"), false);
  assert.equal(isValidCnpj("12.abc.345/01de-35"), true);
});

test("formats numeric and alphanumeric CNPJ as the user types", () => {
  assert.equal(formatCnpj("11222333000181"), "11.222.333/0001-81");
  assert.equal(formatCnpj("12abc34501de35"), "12.ABC.345/01DE-35");
  assert.equal(formatCnpj("12A"), "12.A");
});
