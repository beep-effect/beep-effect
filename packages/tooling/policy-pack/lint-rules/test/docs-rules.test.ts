import { DocsRuleId, DocsRuleSet } from "@beep/lint-rules/oxlint-docs";
import { it } from "@beep/test-runner";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { runOxlintRule } from "./oxlint-harness.ts";

const valid =
  "/** Build a normalized result.\n * @param value - Input value to normalize.\n * @returns Normalized value.\n * @category utilities\n */\nexport function normalize(value: string): string { return value; }";
const cases: ReadonlyArray<{ readonly args: readonly [DocsRuleId, string, string?]; readonly count: number }> = [
  { args: ["require-jsdoc", "export class Store { constructor() {} private hide() {} read() {} }"], count: 2 },
  { args: ["require-jsdoc", "function internal() {} export { internal };"], count: 1 },
  { args: ["require-jsdoc", "function hidden() {}"], count: 0 },
  { args: ["require-jsdoc", valid], count: 0 },
  { args: ["require-jsdoc", "export type Value = string; export interface Row {} export const id = 1;"], count: 3 },
  { args: ["informative-docs", "/** The user id. */\nexport const userId = 1;"], count: 1 },
  {
    args: [
      "informative-docs",
      "/** Computes user identity.\n * @param userId User id.\n */\nfunction identity(userId: string) {}",
    ],
    count: 1,
  },
  { args: ["informative-docs", valid], count: 0 },
  {
    args: [
      "no-blank-block-descriptions",
      "/**\n *\n * Computes a value.\n * @category utilities\n */\nexport const compute = 1;",
    ],
    count: 1,
  },
  { args: ["no-blank-block-descriptions", valid], count: 0 },
  {
    args: [
      "check-tag-names",
      "/** Compute a value.\n * @invented nonsense\n * @return Result\n */\nexport const value = 1;",
    ],
    count: 2,
  },
  {
    args: [
      "check-tag-names",
      "/** Compute a value.\n * @effects cache\n * @domain values\n * @since 0.1.0\n */\nexport const value = 1;",
    ],
    count: 0,
  },
  {
    args: [
      "check-param-names",
      "/** Normalize input.\n * @param wrong - Input value.\n */\nexport function normalize(value: string) {}",
    ],
    count: 1,
  },
  {
    args: [
      "check-param-names",
      "/** Normalize input.\n * @param value - Input value.\n * @param value - Duplicate.\n */\nexport function normalize(value: string) {}",
    ],
    count: 1,
  },
  {
    args: [
      "check-param-names",
      "/** Normalize input.\n * @param bag - Input object.\n */\nexport function normalize({ value }: { value: string }) {}",
    ],
    count: 0,
  },
  { args: ["check-param-names", valid], count: 0 },
  { args: ["require-category-tag", "/** Build a value. */\nexport const build = 1;"], count: 1 },
  { args: ["require-category-tag", "/** Build a value. */\nexport default function build() {}"], count: 1 },
  { args: ["require-category-tag", valid], count: 0 },
  { args: ["tsdoc-syntax", "/** Build a value.\n * @unknownTag nonsense\n */\nexport const value = 1;"], count: 1 },
  { args: ["tsdoc-syntax", valid], count: 0 },
  {
    args: ["tsdoc-syntax", "/** Build a value.\n * @domain values\n * @provides value\n */\nexport const value = 1;"],
    count: 0,
  },
  { args: ["require-param", "/** Normalize input. */\nfunction normalize(value: string) {}"], count: 1 },
  {
    args: [
      "require-param-description",
      "/** Normalize input.\n * @param value\n */\nfunction normalize(value: string) {}",
    ],
    count: 1,
  },
  {
    args: ["require-returns", "/** Normalize input. */\nfunction normalize(value: string): string { return value; }"],
    count: 1,
  },
  {
    args: [
      "check-tag-names",
      "/** Compute a value.\n * @defaultValue 1\n * @since 0.1.0\n */\nexport const value = 1;",
    ],
    count: 0,
  },
  {
    args: ["require-returns", "/** Normalize input. */\nfunction normalize(value) { return(value); }"],
    count: 1,
  },
  {
    args: [
      "require-returns",
      "/** Normalize input. */\nfunction normalize(value) { if (value) return;\n  log(value); }",
    ],
    count: 0,
  },
  {
    args: [
      "require-returns-description",
      "/** Normalize input.\n * @returns\n */\nfunction normalize(): string { return ''; }",
    ],
    count: 1,
  },
  { args: ["require-description", "/** @category utilities */\nexport function value() {}"], count: 1 },
  {
    args: [
      "require-description",
      '/** @category models */\nexport const Port = S.Number.pipe($I.annoteSchema("Port", { description: "A TCP port." }));\n/** @category models */\nexport type Port = typeof Port.Type;\nexport declare namespace Port {\n  /** @category models */\n  export type Encoded = number;\n}',
    ],
    count: 0,
  },
  {
    args: [
      "require-description",
      '/** @category models */\nexport class Job extends S.Class<Job>($I`Job`)({}, $I.annote("models/Job", { description: "A queued job." })) {}',
    ],
    count: 0,
  },
  {
    args: [
      "require-description",
      '/** @category models */\nexport const Port = S.Number.pipe($I.annoteSchema("Host", { description: "A host." }));\n/** @category models */\nexport type Port = typeof Port.Type;',
    ],
    count: 1,
  },
  {
    args: [
      "require-description",
      '/** @category models */\nexport const Port = S.Number.pipe($I.annoteSchema("Port", { title: "Port" }));\n/** @category models */\nexport type Port = typeof Port.Type;',
    ],
    count: 1,
  },
  { args: ["match-description", "/** Value. */\nfunction value() {}"], count: 1 },
  { args: ["require-file-overview", "export const value = 1;", "src/index.ts"], count: 1 },
  {
    args: [
      "check-param-names",
      "/** Normalize input.\n * @param bag.value - Nested field.\n * @param bag - Input bag.\n */\nfunction normalize(bag: object) {}",
    ],
    count: 1,
  },
  {
    args: [
      "check-param-names",
      "/** Service contract. */\ninterface Store {\n/** Load a value.\n * @param wrong - Input key.\n */\nload(key: string): string;\n}",
    ],
    count: 1,
  },
  { args: ["require-jsdoc", "/**bad*/\nexport function bad() {}"], count: 1 },
  { args: ["require-jsdoc", "/** Build a result. */\n\nexport function bad() {}"], count: 1 },
  {
    args: [
      "require-jsdoc",
      "/** Build a result. */\nexport function build(value: string): string;\nexport function build(value: string) { return value; }",
    ],
    count: 0,
  },
  { args: ["require-jsdoc", "function hidden() {} export { hidden } from './other';"], count: 0 },
  { args: ["require-jsdoc", "/** Build a result. */ /* ordinary comment */\nexport function bad() {}"], count: 1 },
  {
    args: [
      "require-jsdoc",
      "/** Build a result. */\nfunction value() {} export { value }; function hiddenOwner() { function value() {} }",
    ],
    count: 0,
  },
  { args: ["require-jsdoc", "/** Build a result container. */\nexport const Store = class { read() {} };"], count: 1 },
];
const filesystem = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);
describe("documentation rules through oxlint", { concurrent: false }, () => {
  it("models finite identifiers and rejects invalid rule-set input", () => {
    expect(S.is(DocsRuleId)("check-param-names")).toBe(true);
    expect(S.is(DocsRuleId)("unknown-rule")).toBe(false);
    S.decodeUnknownResult(DocsRuleSet)({ rules: { "require-jsdoc": "invalid" } }).pipe(Result.isFailure, assertTrue);
  });
  it.layer(filesystem, { timeout: "20 seconds" })((it) => {
    for (const [index, fixture] of A.map(cases, (fixture, index): readonly [number, (typeof cases)[number]] => [
      index,
      fixture,
    ])) {
      it.effect(`${fixture.args[0]} fixture ${index}: ${fixture.count} findings`, () =>
        Effect.gen(function* () {
          const findings = yield* runOxlintRule(...fixture.args);
          expect(findings).toHaveLength(fixture.count);
        })
      );
    }
  });
});
