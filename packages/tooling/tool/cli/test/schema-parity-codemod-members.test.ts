import {
  intMembersRule,
  numberMembersRule,
  planSchemaParityCodemodFile,
  SchemaParityCodemodFileOutcome,
} from "@beep/repo-cli/test/Lint";
import { A } from "@beep/utils";
import { assert, describe, it } from "@effect/vitest";
import { Project, ts } from "ts-morph";
import type { SchemaParityCodemodRule } from "@beep/repo-cli/test/Lint";

const SCHEMA_SRC = "packages/foundation/modeling/schema/src";

// Pre-retirement `Int` and `Number` surfaces at their owner module paths: the
// rules resolve members by declaration module, so the stubs stand in for the
// real concepts.
const NUMBER_STUB = `export interface Schema<A, E = number> {
  readonly Type: A;
  readonly Encoded: E;
  make(input: number): A;
  annotateKey(annotations: object): this;
}
type Brand<K extends string> = { readonly [k in K]: K };
export declare const NonNegativeInt: Schema<number & Brand<"NonNegativeInt">> & {
  is(input: unknown): boolean;
  decodeUnknownOption(input: unknown): unknown;
};
export type NonNegativeInt = typeof NonNegativeInt.Type;
export declare const NonNegNum: Schema<number>;
export type NonNegNum = typeof NonNegNum.Type;
export declare const isPositive: { readonly filter: true };
export declare const FiniteFromString: Schema<number, string> & { decodeEffect(input: string): unknown };
export type FiniteFromString = typeof FiniteFromString.Type;
export declare namespace FiniteFromString {
  export type Encoded = typeof FiniteFromString.Encoded;
}
`;

const INT_STUB = `import type { Schema } from "./Number.ts";
type Brand<K extends string> = { readonly [k in K]: K };
export declare const Int: Schema<number & Brand<"Int">>;
export type Int = typeof Int.Type;
export declare const PosInt: Schema<number & Brand<"PosInt">> & { decodeEffect(input: unknown): unknown };
export type PosInt = typeof PosInt.Type;
export declare const NegInt: Schema<number & Brand<"NegInt">>;
export type NegInt = typeof NegInt.Type;
export { NonNegativeInt } from "./Number.ts";
`;

const INDEX_STUB = `export * from "./Int.ts";
export * from "./Number.ts";
`;

const compilerOptions = {
  strict: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  allowImportingTsExtensions: true,
  noEmit: true,
  baseUrl: "/repo",
  paths: {
    "@beep/schema": [`${SCHEMA_SRC}/index.ts`],
    "@beep/schema/*": [`${SCHEMA_SRC}/*.ts`],
  },
};

// Extra files are written to the in-memory file system: the rule discovers a
// package's local module by globbing it, not through the loaded program.
const makeProject = (extraFiles: ReadonlyArray<readonly [string, string]>): Project => {
  const project = new Project({ useInMemoryFileSystem: true, compilerOptions });
  project.createSourceFile(`/repo/${SCHEMA_SRC}/Number.ts`, NUMBER_STUB);
  project.createSourceFile(`/repo/${SCHEMA_SRC}/Int.ts`, INT_STUB);
  project.createSourceFile(`/repo/${SCHEMA_SRC}/index.ts`, INDEX_STUB);
  project.getFileSystem().writeFileSync("/repo/packages/example/package.json", "{}\n");
  A.forEach(extraFiles, ([filePath, text]) => project.getFileSystem().writeFileSync(`/repo/${filePath}`, text));
  return project;
};

type Fixture = {
  readonly text: string;
  readonly filePath?: string;
  readonly extraFiles?: ReadonlyArray<readonly [string, string]>;
  readonly rule: SchemaParityCodemodRule;
};

const planFixture = ({
  extraFiles = [],
  filePath = "packages/example/src/fixture.ts",
  rule,
  text,
}: Fixture): SchemaParityCodemodFileOutcome => {
  const project = makeProject(extraFiles);
  const sourceFile = project.createSourceFile(`/repo/${filePath}`, text);
  return planSchemaParityCodemodFile(sourceFile, [rule], filePath);
};

const plannedText = (outcome: SchemaParityCodemodFileOutcome): string => {
  assert.strictEqual(outcome._tag, "Planned");
  return SchemaParityCodemodFileOutcome.guards.Planned(outcome) ? outcome.nextText : "";
};

const residueReasons = (outcome: SchemaParityCodemodFileOutcome): ReadonlyArray<string> =>
  SchemaParityCodemodFileOutcome.guards.Planned(outcome) ? A.map(outcome.plan.residue, (entry) => entry.reason) : [];

const LOCAL_MODULE = "packages/example/src/internal/PosInt.ts";
const LOCAL_MODULE_TEXT = `import * as S from "effect/Schema";
export const PosInt = S.Int.check(S.isGreaterThan(0));
export type PosInt = typeof PosInt.Type;
`;

describe("int-members rule", () => {
  it("rewrites Int to S.Int and its type positions to number", () => {
    const outcome = planFixture({
      rule: intMembersRule,
      text: `import { Int } from "@beep/schema/Int";\nimport * as S from "effect/Schema";\n\nexport const Count = S.Struct({ count: Int });\nexport const read = (value: Int): number => value;\n`,
    });
    assert.strictEqual(
      plannedText(outcome),
      `import * as S from "effect/Schema";\n\nexport const Count = S.Struct({ count: S.Int });\nexport const read = (value: number): number => value;\n`
    );
  });

  it("rewrites sign brands to their S.Int compositions", () => {
    const outcome = planFixture({
      rule: intMembersRule,
      text: `import * as S from "effect/Schema";\nimport { NegInt } from "@beep/schema";\n\nexport const Debt = NegInt.annotateKey({ description: "debt" });\n`,
    });
    assert.strictEqual(
      plannedText(outcome),
      `import * as S from "effect/Schema";\n\nexport const Debt = S.Int.check(S.isLessThan(0)).annotateKey({ description: "debt" });\n`
    );
  });

  it("imports PosInt from the package's local module in production files", () => {
    const outcome = planFixture({
      rule: intMembersRule,
      extraFiles: [[LOCAL_MODULE, LOCAL_MODULE_TEXT]],
      text: `import * as S from "effect/Schema";\nimport { PosInt, Sha } from "@beep/schema";\n\nexport const Limit = S.Struct({ max: PosInt });\nexport const one: PosInt = PosInt.make(1);\nexport const decoded = PosInt.decodeEffect(2);\n`,
    });
    const text = plannedText(outcome);
    assert.include(text, 'import { Sha } from "@beep/schema";');
    assert.include(text, 'import { PosInt } from "./internal/PosInt.ts";');
    assert.include(text, "export const Limit = S.Struct({ max: PosInt });\nexport const one: PosInt = PosInt.make(1);");
    assert.include(text, "export const decoded = S.decodeEffect(PosInt)(2);");
  });

  it("declares PosInt in test files, adding the Schema import it needs", () => {
    const outcome = planFixture({
      rule: intMembersRule,
      filePath: "packages/example/test/fixture.test.ts",
      extraFiles: [[LOCAL_MODULE, LOCAL_MODULE_TEXT]],
      text: `import { PosInt } from "@beep/schema/Int";\n\nexport const limit: PosInt = PosInt.make(3);\n`,
    });
    const text = plannedText(outcome);
    assert.include(
      text,
      "const PosInt = S.Int.check(S.isGreaterThan(0));\ntype PosInt = typeof PosInt.Type;\n\nexport const limit: PosInt = PosInt.make(3);"
    );
    assert.include(text, 'import * as S from "effect/Schema";');
    assert.notInclude(text, "@beep/schema");
  });

  it("turns type-only PosInt uses into number", () => {
    const outcome = planFixture({
      rule: intMembersRule,
      text: `import type { PosInt } from "@beep/schema";\n\nexport const read = (value: PosInt): number => value;\n`,
    });
    assert.strictEqual(plannedText(outcome), `\nexport const read = (value: number): number => value;\n`);
  });

  it("moves NonNegativeInt imported through @beep/schema/Int to @beep/schema/Number", () => {
    const outcome = planFixture({
      rule: intMembersRule,
      filePath: "packages/example/test/repoint.test.ts",
      text: `import * as S from "effect/Schema";\nimport { NonNegativeInt, PosInt } from "@beep/schema/Int";\n\nexport const pair = [NonNegativeInt.make(0), PosInt.make(1)];\n`,
    });
    assert.strictEqual(
      plannedText(outcome),
      `import * as S from "effect/Schema";\nimport { NonNegativeInt } from "@beep/schema/Number";\n\nconst PosInt = S.Int.check(S.isGreaterThan(0));\n\nexport const pair = [NonNegativeInt.make(0), PosInt.make(1)];\n`
    );
  });

  it("moves a relative NonNegativeInt import from Int.ts to Number.ts", () => {
    const outcome = planFixture({
      rule: intMembersRule,
      filePath: `${SCHEMA_SRC}/Sibling.ts`,
      text: `import { NonNegativeInt } from "./Int.ts";\n\nexport const Count = NonNegativeInt;\n`,
    });
    assert.strictEqual(
      plannedText(outcome),
      `import { NonNegativeInt } from "./Number.ts";\n\nexport const Count = NonNegativeInt;\n`
    );
  });

  it("reports PosInt as residue when a package holds more than one local module", () => {
    const outcome = planFixture({
      rule: intMembersRule,
      extraFiles: [
        [LOCAL_MODULE, LOCAL_MODULE_TEXT],
        ["packages/example/src/other/PosInt.ts", LOCAL_MODULE_TEXT],
      ],
      text: `import { PosInt } from "@beep/schema";\n\nexport const Limit = PosInt;\n`,
    });
    assert.deepStrictEqual(residueReasons(outcome), ["ambiguous-local-module"]);
  });

  it("rewrites PosInt JSDoc examples to an example-local schema", () => {
    const text = `/**
 * Build a limit.
 *
 * **Example** (Build a limit)
 *
 * \`\`\`ts
 * import { NonNegativeInt, PosInt } from "@beep/schema"
 *
 * const limit = PosInt.make(3)
 * \`\`\`
 */
export const limit = 3;
`;
    const outcome = planFixture({ rule: intMembersRule, text });
    assert.strictEqual(
      plannedText(outcome),
      `/**
 * Build a limit.
 *
 * **Example** (Build a limit)
 *
 * \`\`\`ts
 * import * as S from "effect/Schema"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const PosInt = S.Int.check(S.isGreaterThan(0))
 *
 * const limit = PosInt.make(3)
 * \`\`\`
 */
export const limit = 3;
`
    );
  });

  it("replaces an example's only PosInt import line with the Schema import and local schema", () => {
    const text = `/**
 * **Example** (Build a limit)
 *
 * \`\`\`ts
 * import { PosInt } from "@beep/schema/Int"
 * import { Effect } from "effect"
 *
 * const limit = Effect.succeed(PosInt.make(3))
 * \`\`\`
 */
export const limit = 3;
`;
    const outcome = planFixture({ rule: intMembersRule, text });
    assert.strictEqual(
      plannedText(outcome),
      `/**
 * **Example** (Build a limit)
 *
 * \`\`\`ts
 * import * as S from "effect/Schema"
 * import { Effect } from "effect"
 *
 * const PosInt = S.Int.check(S.isGreaterThan(0))
 *
 * const limit = Effect.succeed(PosInt.make(3))
 * \`\`\`
 */
export const limit = 3;
`
    );
  });

  it("leaves unrelated same-named bindings alone", () => {
    const outcome = planFixture({
      rule: intMembersRule,
      text: `const PosInt = { make: (n: number) => n };\nexport const one = PosInt.make(1);\n`,
    });
    assert.strictEqual(outcome._tag, "Unchanged");
  });
});

describe("number-members rule", () => {
  it("rewrites NonNegativeInt to S.Natural across value, type and static positions", () => {
    const outcome = planFixture({
      rule: numberMembersRule,
      text: `import * as S from "effect/Schema";\nimport { NonNegativeInt, Sha } from "@beep/schema";\n\nexport const Count = S.Struct({ count: NonNegativeInt });\nexport const zero: NonNegativeInt = NonNegativeInt.make(0);\nexport const ok = NonNegativeInt.is(1);\nexport const maybe = NonNegativeInt.decodeUnknownOption(2);\nexport type Decoded = typeof NonNegativeInt.Type;\nexport const shorthand = { NonNegativeInt };\n`,
    });
    assert.strictEqual(
      plannedText(outcome),
      `import * as S from "effect/Schema";\nimport { Sha } from "@beep/schema";\n\nexport const Count = S.Struct({ count: S.Natural });\nexport const zero: number = S.Natural.make(0);\nexport const ok = S.is(S.Natural)(1);\nexport const maybe = S.decodeUnknownOption(S.Natural)(2);\nexport type Decoded = number;\nexport const shorthand = { NonNegativeInt: S.Natural };\n`
    );
  });

  it("adds the Schema namespace import when the file has none", () => {
    const outcome = planFixture({
      rule: numberMembersRule,
      text: `import { isPositive } from "@beep/schema/Number";\n\nexport const check = isPositive;\n`,
    });
    const text = plannedText(outcome);
    assert.include(text, 'import * as S from "effect/Schema";');
    assert.include(text, "export const check = S.isGreaterThan(0);");
    assert.notInclude(text, "@beep/schema");
  });

  it("maps FiniteFromString statics and its encoded type", () => {
    const outcome = planFixture({
      rule: numberMembersRule,
      text: `import * as S from "effect/Schema";\nimport { FiniteFromString } from "@beep/schema";\n\nexport const decoded = FiniteFromString.decodeEffect("1");\nexport type Wire = FiniteFromString.Encoded;\n`,
    });
    assert.strictEqual(
      plannedText(outcome),
      `import * as S from "effect/Schema";\n\nexport const decoded = S.decodeEffect(S.FiniteFromString)("1");\nexport type Wire = string;\n`
    );
  });

  it("keeps the import and reports a typeof over a composition", () => {
    const text = `import * as S from "effect/Schema";\nimport { NonNegNum } from "@beep/schema";\n\nexport type Value = typeof NonNegNum;\n`;
    const outcome = planFixture({ rule: numberMembersRule, text });
    assert.strictEqual(plannedText(outcome), text);
    assert.deepStrictEqual(residueReasons(outcome), ["typeof-composition"]);
  });

  it("does not rewrite a shadowing local binding", () => {
    const outcome = planFixture({
      rule: numberMembersRule,
      text: `import * as S from "effect/Schema";\nimport { NonNegativeInt } from "@beep/schema";\n\nexport const outer = NonNegativeInt;\nexport const inner = (NonNegativeInt: number) => NonNegativeInt + 1;\n`,
    });
    assert.strictEqual(
      plannedText(outcome),
      `import * as S from "effect/Schema";\n\nexport const outer = S.Natural;\nexport const inner = (NonNegativeInt: number) => NonNegativeInt + 1;\n`
    );
  });

  it("reports a Schema binding conflict instead of capturing a shadowing S", () => {
    const text = `import { NonNegativeInt } from "@beep/schema";\n\nexport const read = (S: number) => NonNegativeInt.make(S);\n`;
    const outcome = planFixture({ rule: numberMembersRule, text });
    assert.deepStrictEqual(residueReasons(outcome), ["Schema-binding-conflict"]);
    assert.strictEqual(plannedText(outcome), text);
  });

  it("rewrites NonNegativeInt JSDoc examples", () => {
    const text = `/**
 * **Example** (Count items)
 *
 * \`\`\`ts
 * import * as S from "effect/Schema"
 * import { NonNegativeInt } from "@beep/schema/Number"
 *
 * const count: NonNegativeInt = NonNegativeInt.make(0)
 * \`\`\`
 */
export const count = 0;
`;
    const outcome = planFixture({ rule: numberMembersRule, text });
    assert.strictEqual(
      plannedText(outcome),
      `/**
 * **Example** (Count items)
 *
 * \`\`\`ts
 * import * as S from "effect/Schema"
 *
 * const count: number = S.Natural.make(0)
 * \`\`\`
 */
export const count = 0;
`
    );
  });
});
