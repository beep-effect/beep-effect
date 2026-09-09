import { fcRuns } from "@beep/fc-runs";
import { KebabCaseStr, PascalCaseStr, SnakeCaseStr } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const decodeUnknownKebabCaseStrSync = S.decodeUnknownSync(KebabCaseStr);
const decodeUnknownPascalCaseStrSync = S.decodeUnknownSync(PascalCaseStr);
const decodeUnknownSnakeCaseStrSync = S.decodeUnknownSync(SnakeCaseStr);

describe("KebabCaseStr", () => {
  const arbitrary = S.toArbitrary(KebabCaseStr)(fc);

  it("accepts lowercase kebab-case values that start with a letter", () => {
    expect(decodeUnknownKebabCaseStrSync("command")).toBe("command");
    expect(decodeUnknownKebabCaseStrSync("command-handler")).toBe("command-handler");
    expect(decodeUnknownKebabCaseStrSync("command-handler-2")).toBe("command-handler-2");
  });

  it("rejects digit-leading and non-kebab-case values", () => {
    expect(() => decodeUnknownKebabCaseStrSync("1-command")).toThrow("Must be KebabCase format");
    expect(() => decodeUnknownKebabCaseStrSync("Command-Handler")).toThrow("Must be KebabCase format");
    expect(() => decodeUnknownKebabCaseStrSync("command_handler")).toThrow("Must be KebabCase format");
  });

  it("derives valid values from the source schema and round-trips", () => {
    fc.assert(
      fc.property(arbitrary, (value) => {
        expect(decodeUnknownKebabCaseStrSync(value)).toBe(value);
        expect(value).toMatch(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);
      }),
      fcRuns(50)
    );
  });
});

describe("PascalCaseStr", () => {
  const arbitrary = S.toArbitrary(PascalCaseStr)(fc);

  it("accepts PascalCase values", () => {
    expect(decodeUnknownPascalCaseStrSync("WorkflowStatus")).toBe("WorkflowStatus");
    expect(decodeUnknownPascalCaseStrSync("URLParser")).toBe("URLParser");
    expect(decodeUnknownPascalCaseStrSync("A")).toBe("A");
  });

  it("rejects lowercase-leading and separator-based values", () => {
    expect(() => decodeUnknownPascalCaseStrSync("workflowStatus")).toThrow("Must be PascalCase format");
    expect(() => decodeUnknownPascalCaseStrSync("Workflow_Status")).toThrow("Must be PascalCase format");
    expect(() => decodeUnknownPascalCaseStrSync("Workflow-Status")).toThrow("Must be PascalCase format");
  });

  it("derives valid values from the source schema and round-trips", () => {
    fc.assert(
      fc.property(arbitrary, (value) => {
        expect(decodeUnknownPascalCaseStrSync(value)).toBe(value);
        expect(value).toMatch(/^[A-Z][a-z0-9]*(?:[A-Z][a-z0-9]*)*$/);
      }),
      fcRuns(50)
    );
  });
});

describe("SnakeCaseStr", () => {
  const arbitrary = S.toArbitrary(SnakeCaseStr)(fc);

  it("accepts lowercase snake_case values", () => {
    expect(decodeUnknownSnakeCaseStrSync("workflow_status")).toBe("workflow_status");
    expect(decodeUnknownSnakeCaseStrSync("workflow_status_2")).toBe("workflow_status_2");
  });

  it("rejects uppercase and hyphenated values", () => {
    expect(() => decodeUnknownSnakeCaseStrSync("WorkflowStatus")).toThrow("Must be SnakeCase format");
    expect(() => decodeUnknownSnakeCaseStrSync("workflow-status")).toThrow("Must be SnakeCase format");
  });

  it("derives valid values from the source schema and round-trips", () => {
    fc.assert(
      fc.property(arbitrary, (value) => {
        expect(decodeUnknownSnakeCaseStrSync(value)).toBe(value);
        expect(value).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/);
      }),
      fcRuns(50)
    );
  });
});
