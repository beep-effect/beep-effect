import { SchemaFirstDetectors } from "@beep/repo-cli/test/Lint";
import { describe, expect, it, vi } from "@effect/vitest";
import { Project } from "ts-morph";

describe("schema-first data-like decision short circuiting", () => {
  it("does not inspect terminal object signatures after an array decision", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const source = project.createSourceFile("fixture.ts", "export interface Payload { value: string[] }");
    const declaration = source.getInterfaceOrThrow("Payload");
    const array = declaration.getPropertyOrThrow("value").getType();
    const unnecessary = vi.spyOn(array, "getCallSignatures").mockImplementation(() => {
      throw new Error("Array classification already decided this type");
    });
    try {
      expect(SchemaFirstDetectors.isInterfaceSchemaFirstCandidate(declaration)).toBe(true);
      expect(unnecessary).not.toHaveBeenCalled();
    } finally {
      unnecessary.mockRestore();
    }
  });

  it("does not inspect collections after an aliased runtime handle decision", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const source = project.createSourceFile(
      "fixture.ts",
      "declare class AbortSignal { aborted: boolean }; type Handle = AbortSignal; export interface Payload { value: Handle }"
    );
    const declaration = source.getInterfaceOrThrow("Payload");
    const handle = declaration.getPropertyOrThrow("value").getType();
    const unnecessary = vi.spyOn(handle, "isArray").mockImplementation(() => {
      throw new Error("Runtime classification already decided this type");
    });
    try {
      expect(SchemaFirstDetectors.isInterfaceSchemaFirstCandidate(declaration)).toBe(false);
      expect(unnecessary).not.toHaveBeenCalled();
    } finally {
      unnecessary.mockRestore();
    }
  });
});

describe("schema-first live schema registry contracts", () => {
  it.each([
    ["plain data", "readonly name: string", true],
    ["S schema and method", "readonly name: string; readonly body: S.Top; encode(): unknown", false],
    ["Schema schema and method", "readonly name: string; readonly body: Schema.Top; encode(): unknown", false],
    ["mixed data and method", "readonly name: string; encode(): unknown", true],
    ["schema handle without method", "readonly name: string; readonly body: S.Top", true],
  ])("classifies %s", (_name, members, expected) => {
    const project = new Project({ useInMemoryFileSystem: true });
    const source = project.createSourceFile("fixture.ts", `export interface Contract { ${members} }`);
    expect(SchemaFirstDetectors.isInterfaceSchemaFirstCandidate(source.getInterfaceOrThrow("Contract"))).toBe(expected);
  });
});
