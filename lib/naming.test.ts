import { describe, expect, it } from "vitest";
import { singularize, toSnakeCase, validateIdentifier } from "./naming";

describe("toSnakeCase", () => {
  it("converts camelCase to snake_case", () => {
    expect(toSnakeCase("nombreCliente")).toBe("nombre_cliente");
  });
  it("converts spaces to underscores", () => {
    expect(toSnakeCase("Nombre Cliente")).toBe("nombre_cliente");
  });
  it("strips accents and symbols", () => {
    expect(toSnakeCase("dirección#1")).toBe("direccin1");
  });
});

describe("validateIdentifier", () => {
  it("accepts a clean snake_case name", () => {
    expect(validateIdentifier("cliente_id").valid).toBe(true);
  });
  it("rejects empty names", () => {
    expect(validateIdentifier("   ").valid).toBe(false);
  });
  it("rejects names with spaces and suggests a fix", () => {
    const result = validateIdentifier("nombre cliente");
    expect(result.valid).toBe(false);
    expect(result.suggestion).toBe("nombre_cliente");
  });
  it("rejects camelCase and suggests snake_case", () => {
    const result = validateIdentifier("clienteId");
    expect(result.valid).toBe(false);
    expect(result.suggestion).toBe("cliente_id");
  });
  it("rejects names starting with a digit", () => {
    const result = validateIdentifier("1cliente");
    expect(result.valid).toBe(false);
  });
  it("rejects SQL reserved words", () => {
    const result = validateIdentifier("select");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("reservada");
  });
});

describe("singularize", () => {
  it("handles plain plurals", () => {
    expect(singularize("clientes")).toBe("cliente");
  });
  it("handles -ies plurals", () => {
    expect(singularize("categories")).toBe("category");
  });
  it("leaves already-singular words alone", () => {
    expect(singularize("cliente")).toBe("cliente");
  });
});
