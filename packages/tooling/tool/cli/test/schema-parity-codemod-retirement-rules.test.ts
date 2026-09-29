import {
  opaqueRecordRetirementRule,
  planSchemaParityCodemodFile,
  SchemaParityCodemodFileOutcome,
  unknownJsonRetirementRule,
} from "@beep/repo-cli/test/Lint";
import { A } from "@beep/utils";
import { assert, describe, it } from "@effect/vitest";
import { Project, ts } from "ts-morph";
import type { SchemaParityCodemodRule } from "@beep/repo-cli/test/Lint";

const SCHEMA_SRC = "packages/foundation/modeling/schema/src";
const FIXTURE_MODULE = "packages/example/src/fixture.ts";
const ROOT_IMPORT = '"../../foundation/modeling/schema/src/index.ts"';
const OPAQUE_IMPORT = '"../../foundation/modeling/schema/src/Opaque.ts"';

// Stand-ins at the owner module paths: the rule resolves members by the
// module that declares them, so these stubs play the retired concepts.
const STUBS: ReadonlyArray<readonly [string, string]> = [
  [
    `${SCHEMA_SRC}/Unknown.ts`,
    `export declare const Unknown: { readonly annotate: (annotations: object) => unknown };
export type Unknown = unknown;
export declare const UnknownFromJsonString: { readonly [codec: string]: (input: unknown) => unknown };
export type UnknownFromJsonString = unknown;
`,
  ],
  [
    `${SCHEMA_SRC}/Record/Record.schema.ts`,
    `export declare const UnknownRecord: { readonly [codec: string]: (input: unknown) => unknown };
export type UnknownRecord = { readonly [x: string]: unknown };
`,
  ],
  [
    `${SCHEMA_SRC}/Opaque.ts`,
    `export interface Field { readonly pipe: (...stages: ReadonlyArray<unknown>) => Field; readonly annotateKey: (a: object) => Field }
export declare const Defect: (options?: { readonly includeStack?: boolean }) => Field;
export declare const OpaqueUnknown: Field;
export type OpaqueUnknown = unknown;
`,
  ],
  [
    `${SCHEMA_SRC}/Json.ts`,
    `export declare const decodeJsonString: (input: unknown) => unknown;
export declare const encodeJsonString: (input: unknown) => unknown;
export declare const JsonObject: { readonly check: (check: unknown) => unknown };
export type JsonObject = { readonly [x: string]: unknown };
`,
  ],
  [`${SCHEMA_SRC}/LiteralKit.ts`, "export declare const LiteralKit: (literals: ReadonlyArray<string>) => unknown;\n"],
  [
    `${SCHEMA_SRC}/index.ts`,
    'export * from "./Unknown.ts";\nexport * from "./Json.ts";\nexport * from "./Record/Record.schema.ts";\nexport * from "./Opaque.ts";\nexport * from "./LiteralKit.ts";\n',
  ],
  ["packages/example/src/other.ts", "export declare const Defect: (options?: object) => unknown;\n"],
];

const compilerOptions = {
  strict: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  allowImportingTsExtensions: true,
  noEmit: true,
};

const planFixture = (
  text: string,
  rule: SchemaParityCodemodRule = unknownJsonRetirementRule
): SchemaParityCodemodFileOutcome => {
  const project = new Project({ useInMemoryFileSystem: true, compilerOptions });
  A.forEach(STUBS, ([filePath, stub]) => void project.createSourceFile(`/repo/${filePath}`, stub));
  const sourceFile = project.createSourceFile(`/repo/${FIXTURE_MODULE}`, text);
  return planSchemaParityCodemodFile(sourceFile, [rule], FIXTURE_MODULE);
};

const plannedText = (outcome: SchemaParityCodemodFileOutcome): string => {
  assert.strictEqual(outcome._tag, "Planned");
  return SchemaParityCodemodFileOutcome.guards.Planned(outcome) ? outcome.nextText : "";
};

const residueReasons = (outcome: SchemaParityCodemodFileOutcome): ReadonlyArray<string> =>
  SchemaParityCodemodFileOutcome.guards.Planned(outcome) ? A.map(outcome.plan.residue, (entry) => entry.reason) : [];

const schemaImport = 'import * as S from "effect/Schema";\n';

describe("unknown-json-retirement rule", () => {
  it("hoists a single bound codec static into a module-level runner", () => {
    const text = `${schemaImport}import { UnknownFromJsonString } from ${ROOT_IMPORT};

export const render = (value: unknown) => UnknownFromJsonString.encodeUnknownEffect(value);
`;
    assert.strictEqual(
      plannedText(planFixture(text)),
      `${schemaImport}
const encodeUnknownJsonEffect = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

export const render = (value: unknown) => encodeUnknownJsonEffect(value);
`
    );
  });

  it("shares one hoisted schema between several runners and schema-value uses", () => {
    const text = `${schemaImport}import { UnknownFromJsonString } from ${ROOT_IMPORT};

const Payload = S.Struct({ body: UnknownFromJsonString });
export const decode = (text: string) => UnknownFromJsonString.decodeUnknownEffect(text);
export const decodeOption = (text: string) => UnknownFromJsonString.decodeUnknownOption(text);
export const encode = (value: unknown) => UnknownFromJsonString.encodeEffect(value);
`;
    assert.strictEqual(
      plannedText(planFixture(text)),
      `${schemaImport}
const UnknownJson = S.fromJsonString(S.Unknown);
const decodeUnknownJsonEffect = S.decodeUnknownEffect(UnknownJson);
const decodeUnknownJsonOption = S.decodeUnknownOption(UnknownJson);
const encodeJsonEffect = S.encodeEffect(UnknownJson);

const Payload = S.Struct({ body: UnknownJson });
export const decode = (text: string) => decodeUnknownJsonEffect(text);
export const decodeOption = (text: string) => decodeUnknownJsonOption(text);
export const encode = (value: unknown) => encodeJsonEffect(value);
`
    );
  });

  it("compiles module-level static reads in place instead of aliasing a hoisted runner", () => {
    const text = `${schemaImport}import { UnknownFromJsonString } from ${ROOT_IMPORT};

const encodeJson = UnknownFromJsonString.encodeUnknownEffect;
export const decodeJson = UnknownFromJsonString.decodeUnknownEffect;
`;
    assert.strictEqual(
      plannedText(planFixture(text)),
      `${schemaImport}
const UnknownJson = S.fromJsonString(S.Unknown);

const encodeJson = S.encodeUnknownEffect(UnknownJson);
export const decodeJson = S.decodeUnknownEffect(UnknownJson);
`
    );
  });

  it("compiles Sync codecs through their Result form and Result.getOrThrow", () => {
    const text = `${schemaImport}import { UnknownFromJsonString } from ${ROOT_IMPORT};

const encodeJson = UnknownFromJsonString.encodeUnknownSync;
export const parse = (text: string) => UnknownFromJsonString.decodeUnknownSync(text);
`;
    const next = plannedText(planFixture(text));
    assert.include(next, 'import { flow, Result } from "effect";');
    assert.include(next, "const decodeUnknownJsonSync = flow(S.decodeUnknownResult(UnknownJson), Result.getOrThrow);");
    assert.include(next, "const encodeJson = flow(S.encodeUnknownResult(UnknownJson), Result.getOrThrow);");
    assert.include(next, "export const parse = (text: string) => decodeUnknownJsonSync(text);");
  });

  it("reports Sync codecs as residue when Result names something else", () => {
    const text = `${schemaImport}import { UnknownFromJsonString } from ${ROOT_IMPORT};

type Result = string;
export const parse = (text: string): Result => String(UnknownFromJsonString.decodeUnknownSync(text));
`;
    assert.deepStrictEqual(residueReasons(planFixture(text)), ["sync-codec-flow-or-Result-binding-unavailable"]);
  });

  it("rewrites Json codec aliases and JsonObject, keeping shorthand property names", () => {
    const text = `${schemaImport}import { decodeJsonString, encodeJsonString, JsonObject } from ${ROOT_IMPORT};

const decodeSse = decodeJsonString;
export const handlers = { decodeJsonString };
export const render = (value: unknown) => encodeJsonString(value);
export const Frontmatter = S.OptionFromOptionalKey(JsonObject);
export const first = (value: JsonObject): JsonObject => value;
`;
    assert.strictEqual(
      plannedText(planFixture(text)),
      `${schemaImport}
const UnknownJson = S.fromJsonString(S.Unknown);
const encodeUnknownJsonEffect = S.encodeUnknownEffect(UnknownJson);

const decodeSse = S.decodeUnknownEffect(UnknownJson);
export const handlers = { decodeJsonString: S.decodeUnknownEffect(UnknownJson) };
export const render = (value: unknown) => encodeUnknownJsonEffect(value);
export const Frontmatter = S.OptionFromOptionalKey(S.JsonObject);
export const first = (value: S.JsonObject): S.JsonObject => value;
`
    );
  });

  it("inlines Unknown, rewrites its type to unknown and adds the effect/Schema import when absent", () => {
    const text = `import { Unknown } from ${ROOT_IMPORT};

export const Fields = { raw: Unknown.annotate({ title: "raw" }) };
export type Raw = Unknown;
`;
    const next = plannedText(planFixture(text));
    assert.include(next, 'export const Fields = { raw: S.Unknown.annotate({ title: "raw" }) };');
    assert.include(next, "export type Raw = unknown;");
    assert.include(next, 'import * as S from "effect/Schema"');
    assert.notInclude(next, ROOT_IMPORT);
  });

  it("hoists runners read inside generator function bodies", () => {
    const text = `${schemaImport}import { encodeJsonString } from ${ROOT_IMPORT};

export const write = Effect.fn(function* (document: unknown) {
  return yield* encodeJsonString(document);
});
`;
    assert.strictEqual(
      plannedText(planFixture(text)),
      `${schemaImport}
const encodeUnknownJsonEffect = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

export const write = Effect.fn(function* (document: unknown) {
  return yield* encodeUnknownJsonEffect(document);
});
`
    );
  });

  it("hoists before the first module statement when statements sit between imports", () => {
    const text = `${schemaImport}import { UnknownFromJsonString } from ${ROOT_IMPORT};

const encodeJson = UnknownFromJsonString.encodeUnknownEffect;

import * as O from "effect/Option";

const decodeJson = UnknownFromJsonString.decodeEffect;
`;
    assert.strictEqual(
      plannedText(planFixture(text)),
      `${schemaImport}
const UnknownJson = S.fromJsonString(S.Unknown);

const encodeJson = S.encodeUnknownEffect(UnknownJson);

import * as O from "effect/Option";

const decodeJson = S.decodeEffect(UnknownJson);
`
    );
  });

  it("keeps directives ahead of the hoisted block and anchors it on the last import", () => {
    const text = `"use client";

${schemaImport}import { UnknownFromJsonString } from ${ROOT_IMPORT};
import type { Option } from "effect/Option";
export { LiteralKit } from ${ROOT_IMPORT};

export const render = (value: unknown): Option<string> | string => UnknownFromJsonString.encodeUnknownEffect(value) as never;
`;
    assert.strictEqual(
      plannedText(planFixture(text)),
      `"use client";

${schemaImport}import type { Option } from "effect/Option";

const encodeUnknownJsonEffect = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));
export { LiteralKit } from ${ROOT_IMPORT};

export const render = (value: unknown): Option<string> | string => encodeUnknownJsonEffect(value) as never;
`
    );
  });

  it("shares one hoisted schema across the Unknown and Json members of a file", () => {
    const text = `${schemaImport}import { decodeJsonString, encodeJsonString } from ${ROOT_IMPORT};
import { UnknownFromJsonString } from ${ROOT_IMPORT};

const decodeSse = decodeJsonString;
const decodeOption = UnknownFromJsonString.decodeUnknownOption;
const encode = encodeJsonString;
`;
    assert.strictEqual(
      plannedText(planFixture(text)),
      `${schemaImport}
const UnknownJson = S.fromJsonString(S.Unknown);

const decodeSse = S.decodeUnknownEffect(UnknownJson);
const decodeOption = S.decodeUnknownOption(UnknownJson);
const encode = S.encodeUnknownEffect(UnknownJson);
`
    );
  });

  it("reports re-exports as residue and keeps their imports", () => {
    const text = `${schemaImport}import { UnknownFromJsonString } from ${ROOT_IMPORT};

export { UnknownFromJsonString };
`;
    const outcome = planFixture(text);
    assert.deepStrictEqual(residueReasons(outcome), ["unsupported-ExportSpecifier"]);
    assert.include(plannedText(outcome), `import { UnknownFromJsonString } from ${ROOT_IMPORT};`);
  });

  it("reports a runner name the file already declares instead of shadowing it", () => {
    const text = `${schemaImport}import { UnknownFromJsonString } from ${ROOT_IMPORT};

const encodeUnknownJsonSync = (value: unknown) => String(value);
export const render = (value: unknown) => UnknownFromJsonString.encodeUnknownSync(encodeUnknownJsonSync(value));
`;
    const outcome = planFixture(text);
    assert.deepStrictEqual(residueReasons(outcome), ["name-conflict:encodeUnknownJsonSync"]);
    assert.strictEqual(plannedText(outcome), text);
  });

  it("leaves Opaque and Record members to the other rule", () => {
    const text = `${schemaImport}import { Defect, UnknownFromJsonString } from ${ROOT_IMPORT};

export const cause = Defect();
export const decode = UnknownFromJsonString.decodeUnknownEffect;
`;
    assert.strictEqual(
      plannedText(planFixture(text)),
      `${schemaImport}import { Defect } from ${ROOT_IMPORT};

export const cause = Defect();
export const decode = S.decodeUnknownEffect(S.fromJsonString(S.Unknown));
`
    );
  });
});

describe("opaque-record-retirement rule", () => {
  const planOpaque = (text: string) => planFixture(text, opaqueRecordRetirementRule);

  it("rewrites Defect calls onto S.Defect with an always-true equivalence override", () => {
    const text = `${schemaImport}import { Defect, LiteralKit } from ${ROOT_IMPORT};

export const Fields = {
  bare: Defect(),
  optional: S.optionalKey(Defect({ includeStack: true })),
  piped: Defect({ includeStack: true }).pipe(S.optionalKey),
  keyed: Defect({ includeStack: true }).annotateKey({ description: "cause" }),
};
export const kit = LiteralKit(["a"]);
`;
    assert.strictEqual(
      plannedText(planOpaque(text)),
      `${schemaImport}import { LiteralKit } from ${ROOT_IMPORT};

export const Fields = {
  bare: S.Defect().pipe(S.overrideToEquivalence(() => () => true)),
  optional: S.optionalKey(S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(() => () => true))),
  piped: S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(() => () => true), S.optionalKey),
  keyed: S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(() => () => true)).annotateKey({ description: "cause" }),
};
export const kit = LiteralKit(["a"]);
`
    );
  });

  it("rewrites UnknownRecord values and types and keeps a shared local schema name", () => {
    const text = `${schemaImport}import { UnknownRecord } from ${ROOT_IMPORT};

export const Event = S.Struct({ payload: UnknownRecord, extra: S.Array(UnknownRecord) });
export const first = (records: ReadonlyArray<UnknownRecord>): UnknownRecord | undefined => records[0];
`;
    assert.strictEqual(
      plannedText(planOpaque(text)),
      `${schemaImport}
const UnknownRecord = S.Record(S.String, S.Unknown);

export const Event = S.Struct({ payload: UnknownRecord, extra: S.Array(UnknownRecord) });
export const first = (records: ReadonlyArray<Readonly<Record<string, unknown>>>): Readonly<Record<string, unknown>> | undefined => records[0];
`
    );
  });

  it("inlines a single OpaqueUnknown use and adds the effect/Schema import when the file has none", () => {
    const text = `import { OpaqueUnknown } from ${ROOT_IMPORT};

export const Fields = { actual: OpaqueUnknown };
export type Raw = OpaqueUnknown;
`;
    const next = plannedText(planOpaque(text));
    assert.include(
      next,
      "export const Fields = { actual: S.Unknown.pipe(S.overrideToEquivalence(() => () => true)) };"
    );
    assert.include(next, "export type Raw = unknown;");
    assert.include(next, 'import * as S from "effect/Schema"');
    assert.notInclude(next, ROOT_IMPORT);
  });

  it("reuses a named Schema import from effect", () => {
    const text = `import { Schema } from "effect";
import { Defect } from ${OPAQUE_IMPORT};

export const cause = Defect();
`;
    assert.include(
      plannedText(planOpaque(text)),
      "export const cause = Schema.Defect().pipe(Schema.overrideToEquivalence(() => () => true));"
    );
  });

  it("reports uncalled Defect references as residue and keeps the import", () => {
    const text = `${schemaImport}import { Defect } from ${ROOT_IMPORT};

export const make = Defect;
`;
    const outcome = planOpaque(text);
    assert.deepStrictEqual(residueReasons(outcome), ["defect-not-called"]);
    assert.include(plannedText(outcome), `import { Defect } from ${ROOT_IMPORT};`);
  });

  it("never rewrites same-named members owned by other modules", () => {
    const text = `${schemaImport}import { Defect } from "./other.ts";

export const cause = Defect({ includeStack: true });
`;
    assert.strictEqual(planOpaque(text)._tag, "Unchanged");
  });
});
