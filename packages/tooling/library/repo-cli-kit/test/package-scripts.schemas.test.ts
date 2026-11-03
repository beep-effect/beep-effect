import {
  applyScaffoldRuleForTesting,
  CheckerEngineExemption,
  CheckerScriptName,
  checkerEngineExemptions,
  implScriptDefaults,
  NonCanonicalChecker,
  PackageKind,
  PackageScriptsReportFromWire,
  ScriptsBlock,
  ScriptsRecord,
  scaffoldPackageScripts,
  scriptsBlockFromRecord,
  TaskScriptBinding,
  TaskScriptName,
  TaskScriptPresence,
  TaskScriptRule,
  taskScriptRules,
} from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import type { PackageScriptsReportWire } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas";

const appCodec = scriptsBlockFromRecord("app");
const decodeApp = S.decodeEffect(appCodec);
const decodeUnknownApp = S.decodeUnknownEffect(appCodec);
const encodeApp = S.encodeEffect(appCodec);
const decodeBlock = S.decodeUnknownEffect(ScriptsBlock);
const decodeRule = S.decodeEffect(TaskScriptRule);
const decodeReport = S.decodeEffect(PackageScriptsReportFromWire);
const encodeReport = S.encodeEffect(PackageScriptsReportFromWire);
const decodeAppResult = S.decodeResult(appCodec);
const encodeAppResult = S.encodeResult(appCodec);
const scriptsArbitrary = Arbitrary.schema(ScriptsRecord);

const presenceRows: ReadonlyArray<readonly [string, string]> = [
  ["build", "required required required required required required optional"],
  ["check", "required required required required required required optional"],
  ["lint", "required required required required required required optional"],
  ["test", "required required required required required required optional"],
  ["lint:fix", "required required optional required required required optional"],
  ["test:property", "optional optional absent optional absent absent optional"],
  ["test:integration", "optional absent required optional absent absent optional"],
  ["test:integration:parallel", "optional absent optional optional absent absent optional"],
  ["coverage", "required required required optional required required optional"],
  ["docgen", "required required required optional absent required optional"],
  ["package-test-typecheck", "required required required required required required optional"],
  ["codegen", "derived derived derived derived derived derived optional"],
  ["lint:deprecated-apis", "required required required required required required absent"],
  ["lint:jsdoc", "required required required required absent required absent"],
  ["lint:laws", "required required required required required required absent"],
  ["doctest", "derived derived derived derived derived absent absent"],
];

describe("canonical package scripts schemas", () => {
  it("preserves optional implementation calls and their declared defaults", () => {
    const rule = TaskScriptRule.make({
      kind: "library",
      name: "build",
      presence: TaskScriptPresence.cases.optional.make({}),
      binding: TaskScriptBinding.cases.indirection.make({ impl: "beep:build", ifPresent: true }),
    });
    const scripts = applyScaffoldRuleForTesting(HashMap.empty(), rule);
    assertSome(HashMap.get(scripts, "build"), "bun run --if-present beep:build");
    assertSome(HashMap.get(scripts, "beep:build"), "tsrs -p tsconfig.json && bun run babel");
  });
  it("keeps caller scripts and indirections when a kind has no implementation default", () => {
    const rule = TaskScriptRule.make({
      kind: "exempt",
      name: "build",
      presence: TaskScriptPresence.cases.optional.make({}),
      binding: TaskScriptBinding.cases.indirection.make({ impl: "beep:build", ifPresent: false }),
    });
    const scripts = applyScaffoldRuleForTesting(HashMap.make(["dev", "vite"]), rule);
    assertSome(HashMap.get(scripts, "dev"), "vite");
    assertSome(HashMap.get(scripts, "build"), "bun run beep:build");
    expect(HashMap.has(scripts, "beep:build")).toBe(false);
    expect(HashMap.size(scripts)).toBe(2);
  });
  it("does not restore removed audit aliases or unused tool implementations", () => {
    const tool = scaffoldPackageScripts("tool", ["test:integration"]);
    expect(tool).not.toHaveProperty("audit");
    expect(tool).not.toHaveProperty("beep:audit");
    expect(tool).not.toHaveProperty("test:integration");
    expect(tool).not.toHaveProperty("beep:test:integration");
    const library = scaffoldPackageScripts("library", ["test:integration"]);
    expect(library["test:integration"]).toBe("bun run beep:test:integration");
    expect(library["beep:test:integration"]).toBe("bunx --bun vitest run test/integration --passWithNoTests");
  });
  it("leaves exempt task ownership with the caller even when every task is selected", () => {
    expect(scaffoldPackageScripts("exempt", TaskScriptName.literals)).toEqual({});
  });
  it.prop(
    "round trips schema-derived script records",
    { input: scriptsArbitrary },
    ({ input }) => {
      const block = Result.getOrThrow(decodeAppResult(input));
      expect(Result.getOrThrow(encodeAppResult(block))).toEqual(input);
    },
    { arbitrary: fcRuns(100) }
  );
  it.effect(
    "round trips implementation text and extras without interpretation",
    Effect.fnUntraced(function* () {
      const input = { build: "bun run beep:build", "beep:build": "custom $BUILD", dev: "vite", "beep:custom": "owned" };
      const block = yield* decodeApp(input);
      assertSome(HashMap.get(block.tasks, "build"), "bun run beep:build");
      expect(HashMap.size(block.impls)).toBe(1);
      expect(HashMap.size(block.extras)).toBe(2);
      expect(yield* encodeApp(block)).toEqual(input);
    })
  );
  it.effect(
    "rejects tier overlap and non-string script values with typed schema errors",
    Effect.fnUntraced(function* () {
      expect(
        yield* decodeBlock({
          kind: "app",
          tasks: HashMap.empty(),
          impls: HashMap.empty(),
          extras: HashMap.make(["build", "bad"]),
        }).pipe(Effect.isFailure)
      ).toBe(true);
      expect(yield* decodeUnknownApp({ build: 1 }).pipe(Effect.isFailure)).toBe(true);
    })
  );
  it.effect(
    "decodes every rule row and matches the ratified presence matrix literally",
    Effect.fnUntraced(function* () {
      expect(taskScriptRules).toHaveLength(112);
      yield* Effect.forEach(taskScriptRules, (rule) => decodeRule(rule));
      for (const [name, expected] of presenceRows) {
        const actual = A.map(PackageKind.literals, (kind) =>
          A.findFirst(taskScriptRules, (row) => row.kind === kind && row.name === name)
        );
        expect(
          A.join(
            A.map(actual, (row) => (row._tag === "Some" ? row.value.presence._tag : "missing")),
            " "
          )
        ).toBe(expected);
      }
      expect(TaskScriptName.literals).toHaveLength(16);
      expect(implScriptDefaults).toHaveLength(50);
    })
  );
  it.effect(
    "round trips report JSON data through the collection view",
    Effect.fnUntraced(function* () {
      const wire: typeof PackageScriptsReportWire.Encoded = {
        schemaVersion: "package-scripts-report/v1",
        rules: "package-scripts-rules/v1",
        manifests: 2,
        drift: { "apps/a/package.json": [{ _tag: "missing-task", name: "lint:laws" }] },
        implDrift: {
          "apps/a/package.json": [
            { name: "beep:check", actual: "custom check", expected: "tsrs -p tsconfig.check.json" },
          ],
        },
        written: ["apps/a/package.json"],
      };
      const report = yield* decodeReport(wire);
      expect(HashSet.has(report.written, "apps/a/package.json")).toBe(true);
      expect(yield* encodeReport(report)).toEqual(wire);
    })
  );
  it.effect(
    "decodes a v1 report written before implDrift existed",
    Effect.fnUntraced(function* () {
      const legacy = {
        schemaVersion: "package-scripts-report/v1",
        rules: "package-scripts-rules/v1",
        manifests: 1,
        drift: {},
        written: [],
      } as const;
      const report = yield* decodeReport(legacy);
      expect(HashMap.size(report.implDrift)).toBe(0);
      expect(yield* encodeReport(report)).toEqual({ ...legacy, implDrift: {} });
    })
  );
  it("models checker scripts, non-canonical checkers and reviewed exemptions", () => {
    const isCheckerScript = S.is(CheckerScriptName);
    expect(A.map(["beep:build", "beep:check", "beep:check:tests", "beep:check:a:b"], isCheckerScript)).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(A.map(["beep:build:x", "beep:checks", "check", "beep:lint"], isCheckerScript)).toEqual([
      false,
      false,
      false,
      false,
    ]);
    expect(NonCanonicalChecker.literals).toEqual(["tsgo", "tsc"]);
    const row = { manifest: "packages/a/package.json", script: "beep:check", engine: "tsgo", reason: "tsrs defect" };
    const rows = [row, { ...row, engine: "tsrs" }, { ...row, reason: "" }, { ...row, script: "beep:lint" }];
    expect(A.map(rows, S.is(CheckerEngineExemption))).toEqual([true, false, false, false]);
    expect(checkerEngineExemptions).toEqual([]);
  });
});
