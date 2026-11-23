import { SchemaFirstDetectors } from "@beep/repo-cli/test/Lint";
import { describe, expect, it, vi } from "@effect/vitest";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { Project, SyntaxKind } from "ts-morph";

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

describe("schema-first AST classification edges", () => {
  it.each([
    ["intersection payload", "export interface Payload { value: { left: string } & { right: number } }", true],
    ["class with no schema heritage", "export class Payload {}; export interface Payload { id: string }", true],
    [
      "class with ordinary class heritage",
      "class Base {}; export class Payload extends Base {}; export interface Payload { id: string }",
      true,
    ],
    [
      "class with unresolved heritage",
      "export class Payload extends Missing {}; export interface Payload { id: string }",
      true,
    ],
    [
      "class with schema variable heritage",
      "const Base = S.Struct({ id: S.String }); export class Payload extends Base {}; export interface Payload { id: string }",
      false,
    ],
    [
      "class with uninitialized variable heritage",
      "declare const Base: unknown; export class Payload extends Base {}; export interface Payload { id: string }",
      true,
    ],
    [
      "same-name uninitialized value",
      "export declare const Payload: unknown; export interface Payload { id: string }",
      true,
    ],
    ["data index signature", "export interface Payload { [key: string]: number }", true],
    ["runtime index signature", "export interface Payload { [key: string]: AbortSignal }", false],
    [
      "method without a type annotation",
      "export interface Payload { handle; readonly id: string; encode(): unknown }",
      true,
    ],
  ])("classifies %s", (_name, text, expected) => {
    const project = new Project({ useInMemoryFileSystem: true });
    const source = project.createSourceFile("fixture.ts", text);
    expect(SchemaFirstDetectors.isInterfaceSchemaFirstCandidate(source.getInterfaceOrThrow("Payload"))).toBe(expected);
  });

  it.each([
    ["primitive alias", "export type Payload = string", false],
    ["call signature", "export type Payload = { (): void; id: string }", true],
    ["construct signature", "export type Payload = { new (): unknown; id: string }", true],
    ["method-only contract", "export type Payload = { encode(): void }", false],
    ["function-valued contract", "export type Payload = { encode: () => void }", false],
    ["runtime-only index contract", "export type Payload = { [key: string]: AbortSignal }", false],
  ])("classifies %s", (_name, text, expected) => {
    const project = new Project({ useInMemoryFileSystem: true });
    const source = project.createSourceFile("fixture.ts", text);
    expect(SchemaFirstDetectors.isTypeAliasSchemaFirstCandidate(source.getTypeAliasOrThrow("Payload"))).toBe(expected);
  });
});

const detectorFixture = (text: string, path = "fixture.ts") =>
  new Project({ useInMemoryFileSystem: true }).createSourceFile(path, text);

describe("schema-first advisory container names", () => {
  it.each([
    ["S.Struct({ rate: S.NumberFromString })", "anonymous@1.rate"],
    ["const Payload = S.Struct({ rate: S.NumberFromString })", "Payload.rate"],
    ["export default class extends S.Class('Payload')({ rate: S.NumberFromString }) {}", "anonymous-class.rate"],
  ])("names the numeric field in %s", (text, symbol) => {
    const source = detectorFixture(text);
    const property = source.getFirstDescendantByKindOrThrow(SyntaxKind.PropertyAssignment);
    const entry = SchemaFirstDetectors.numericDomainEntryFromProperty(property, "fixture.ts", "@beep/test");
    expect(O.map(entry, (value) => value.symbol)).toEqual(O.some(symbol));
  });

  it.each([
    ["switch (kind) {}", "anonymous@1.switch(kind)"],
    ["const run = function () { switch (kind) {} }", "run.switch(kind)"],
    ["export default function () { switch (kind) {} }", "anonymous-function.switch(kind)"],
  ])("names the discriminator in %s", (text, symbol) => {
    const source = detectorFixture(text);
    const statement = source.getFirstDescendantByKindOrThrow(SyntaxKind.SwitchStatement);
    const entry = SchemaFirstDetectors.staticApiEntryFromSwitch(statement, "fixture.ts", "@beep/test");
    expect(O.map(entry, (value) => value.symbol)).toEqual(O.some(symbol));
  });

  it("ignores a switch without a schema discriminator", () => {
    const source = detectorFixture("switch (input) {}");
    expect(
      SchemaFirstDetectors.staticApiEntryFromSwitch(
        source.getFirstDescendantByKindOrThrow(SyntaxKind.SwitchStatement),
        "fixture.ts",
        "@beep/test"
      )
    ).toEqual(O.none());
  });

  it("does not classify unrelated getSomes receivers or parameter defaults", () => {
    const source = detectorFixture("function parse(value = { a: 1 }) { return Other.getSomes({ a: 1 }) }");
    expect(
      SchemaFirstDetectors.getsomesStructEntryFromCallExpression(
        source.getFirstDescendantByKindOrThrow(SyntaxKind.CallExpression),
        "fixture.ts",
        "@beep/test"
      )
    ).toEqual(O.none());
    expect(
      SchemaFirstDetectors.defaultsEntryFromParameter(
        source.getFirstDescendantByKindOrThrow(SyntaxKind.Parameter),
        "fixture.ts",
        "@beep/test"
      )
    ).toEqual(O.none());
  });

  it("does not advise a generic null-return contract or module-scope normalization", () => {
    const source = detectorFixture("export function parse<T>(): T | null { return null }; value.trim()");
    expect(
      SchemaFirstDetectors.nullReturnEntryFromFunctionLike(
        source.getFunctionOrThrow("parse"),
        "fixture.ts",
        "@beep/test"
      )
    ).toEqual(O.none());
    expect(
      SchemaFirstDetectors.normalizationEntryFromCallExpression(
        source.getFirstDescendantByKindOrThrow(SyntaxKind.CallExpression),
        "fixture.ts",
        "@beep/test"
      )
    ).toEqual(O.none());
  });

  it.layer(Digest.layerWebCrypto)((it) =>
    it.effect("does not report a parity wrapper inside its own implementation", () =>
      Effect.gen(function* () {
        const source = detectorFixture(
          "export const decodeUnknown = (input: unknown) => input",
          "/packages/foundation/modeling/schema/src/SchemaUtils/decodeUnknown.ts"
        );
        const entries = yield* SchemaFirstDetectors.parityEntriesFromSourceFile(source, "fixture.ts", "@beep/test");
        expect(entries).toEqual([]);
      })
    )
  );
});
