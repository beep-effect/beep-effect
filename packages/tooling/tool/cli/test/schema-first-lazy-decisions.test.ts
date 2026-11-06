import { describe, expect, it, vi } from "@effect/vitest";
import { Project } from "ts-morph";
import { SchemaFirstDetectors } from "../src/commands/Lint/internal/SchemaFirstDetectors.ts";

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
