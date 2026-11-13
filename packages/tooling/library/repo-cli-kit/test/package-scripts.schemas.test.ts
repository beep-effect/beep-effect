import {
  applyScaffoldRuleForTesting,
  buildServedCheck,
  CheckerEngineExemption,
  CheckerScriptName,
  checkerEngineExemptions,
  checkLeadsWithBuild,
  DECLARATION_ONLY_BUILD_COMMAND,
  DECLARATION_ONLY_BUILD_FLAG,
  implScriptDefaults,
  isDeclarationOnlyBuild,
  JavaScriptBuildOverride,
  javaScriptBuildOverrides,
  NonCanonicalChecker,
  OWN_SOURCE_CHECK_COMMAND,
  OwnSourceCheckOverride,
  ownSourceCheckOverrides,
  PackageKind,
  PackageScriptsReportFromWire,
  RetiredScriptName,
  retiredCheckSegments,
  retiredImplScripts,
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
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
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
    assertSome(HashMap.get(scripts, "beep:build"), "tsrs -p tsconfig.json --emitDeclarationOnly");
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
  it("generates a declaration-only build without Babel for every emitting kind", () => {
    expect(DECLARATION_ONLY_BUILD_COMMAND).toBe(`tsrs -p tsconfig.json ${DECLARATION_ONLY_BUILD_FLAG}`);
    const builds = A.filter(implScriptDefaults, (row) => row.name === "beep:build");
    expect(
      A.map(
        A.filter(builds, (row) => row.value === DECLARATION_ONLY_BUILD_COMMAND),
        (row) => row.kind
      )
    ).toEqual(["library", "tool", "ecosystem", "infra"]);
    expect(A.some(builds, (row) => pipe(row.value, Str.includes("babel")))).toBe(false);
    for (const kind of ["library", "tool", "ecosystem", "infra"] as const) {
      const scripts = scaffoldPackageScripts(kind, []);
      expect(scripts["beep:build"]).toBe(DECLARATION_ONLY_BUILD_COMMAND);
      expect(scripts).not.toHaveProperty("babel");
    }
  });
  it("retires the Babel build, the JavaScript build and the babel script for every managed kind", () => {
    expect(RetiredScriptName.literals).toEqual(["babel"]);
    expect(retiredImplScripts).toHaveLength(18);
    expect(A.some(retiredImplScripts, (row) => row.kind === "exempt")).toBe(false);
    expect(A.some(retiredImplScripts, (row) => pipe(row.replacement, Str.includes("babel")))).toBe(false);
    expect(A.dedupe(A.map(retiredImplScripts, (row) => row.value))).toEqual([
      "tsrs -p tsconfig.json && bun run babel",
      "tsrs -p tsconfig.json",
      "bun run codegen && tsrs -p tsconfig.json && bun run babel",
    ]);
    const override = { manifest: "packages/a/package.json", reason: "the worker image runs dist/main.js" };
    expect(A.map([override, { ...override, reason: "" }], S.is(JavaScriptBuildOverride))).toEqual([true, false]);
    expect(javaScriptBuildOverrides).toEqual([]);
  });
  it("serves a declaration-only check from its build and leaves every other check alone", () => {
    const served = `${DECLARATION_ONLY_BUILD_COMMAND} && bun run beep:check:tests`;
    expect(A.map(retiredCheckSegments, (row) => [row.segment, row.replacement])).toEqual([
      [OWN_SOURCE_CHECK_COMMAND, DECLARATION_ONLY_BUILD_COMMAND],
    ]);
    assertSome(
      buildServedCheck(`${OWN_SOURCE_CHECK_COMMAND} && bun run beep:check:tests`, DECLARATION_ONLY_BUILD_COMMAND),
      served
    );
    assertSome(
      buildServedCheck(DECLARATION_ONLY_BUILD_COMMAND)(OWN_SOURCE_CHECK_COMMAND),
      DECLARATION_ONLY_BUILD_COMMAND
    );
    assertSome(
      buildServedCheck(OWN_SOURCE_CHECK_COMMAND, `bun run codegen && ${DECLARATION_ONLY_BUILD_COMMAND}`),
      DECLARATION_ONLY_BUILD_COMMAND
    );
    // Flags of the first segment carry over, in order, ahead of the later segments.
    assertSome(
      buildServedCheck(
        `${OWN_SOURCE_CHECK_COMMAND} --checkerCostCache a.cache --pretty false && bun run beep:check:tests`,
        DECLARATION_ONLY_BUILD_COMMAND
      ),
      `${DECLARATION_ONLY_BUILD_COMMAND} --checkerCostCache a.cache --pretty false && bun run beep:check:tests`
    );
    // A longer config name, a later no-emit segment, and a build that is not declaration-only.
    assertNone(buildServedCheck(`${OWN_SOURCE_CHECK_COMMAND}c`, DECLARATION_ONLY_BUILD_COMMAND));
    assertNone(buildServedCheck(`bun run codegen && ${OWN_SOURCE_CHECK_COMMAND}`, DECLARATION_ONLY_BUILD_COMMAND));
    assertNone(buildServedCheck(OWN_SOURCE_CHECK_COMMAND, OWN_SOURCE_CHECK_COMMAND));
    assertNone(buildServedCheck(OWN_SOURCE_CHECK_COMMAND, `${DECLARATION_ONLY_BUILD_COMMAND} --listEmittedFiles`));
    expect(
      A.map(
        [DECLARATION_ONLY_BUILD_COMMAND, `bun run codegen && ${DECLARATION_ONLY_BUILD_COMMAND}`, "vite build", ""],
        isDeclarationOnlyBuild
      )
    ).toEqual([true, true, false, false]);
    expect(
      A.map(
        [
          served,
          `${DECLARATION_ONLY_BUILD_COMMAND} --checkerCostCache a.cache && bun run beep:check:tests`,
          `${DECLARATION_ONLY_BUILD_COMMAND}&&bun run beep:check:tests`,
          `${DECLARATION_ONLY_BUILD_COMMAND}Extra`,
          `${OWN_SOURCE_CHECK_COMMAND} && bun run beep:check:tests`,
          `bun run codegen && ${DECLARATION_ONLY_BUILD_COMMAND}`,
        ],
        checkLeadsWithBuild
      )
    ).toEqual([true, true, true, false, false, false]);
    for (const kind of ["library", "tool", "ecosystem", "infra"] as const)
      expect(scaffoldPackageScripts(kind, [])["beep:check"], kind).toBe(served);
    for (const kind of ["app", "lab"] as const)
      expect(scaffoldPackageScripts(kind, [])["beep:check"], kind).toBe(OWN_SOURCE_CHECK_COMMAND);
    expect(A.map(ownSourceCheckOverrides, (row) => row.manifest)).toEqual([
      "packages/ecosystem/effect-drizzle/package.json",
      "packages/foundation/modeling/markdown/package.json",
    ]);
    const override = { manifest: "packages/a/package.json", reason: "the check program adds scripts" };
    expect(A.map([override, { ...override, reason: "" }], S.is(OwnSourceCheckOverride))).toEqual([true, false]);
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
      const encodedApp = yield* encodeApp(block);
      expect(encodedApp).toEqual(input);
    })
  );
  it.effect(
    "rejects tier overlap and non-string script values with typed schema errors",
    Effect.fnUntraced(function* () {
      const pipe1 = yield* decodeBlock({
        kind: "app",
        tasks: HashMap.empty(),
        impls: HashMap.empty(),
        extras: HashMap.make(["build", "bad"]),
      }).pipe(Effect.isFailure);
      expect(pipe1).toBe(true);
      const pipe2 = yield* decodeUnknownApp({ build: 1 }).pipe(Effect.isFailure);
      expect(pipe2).toBe(true);
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
      const encodedReport = yield* encodeReport(report);
      expect(encodedReport).toEqual(wire);
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
      const encodedReport3 = yield* encodeReport(report);
      expect(encodedReport3).toEqual({ ...legacy, implDrift: {} });
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
