import plugin from "@beep/lint-rules/oxlint";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { jsonReportParser, validateLinterProcess } from "./codec.ts";
import { OXLINT_RULES, runOxlintRule, runOxlintRuleFix } from "./oxlint-harness.ts";
import { OXLINT_SOURCES } from "./oxlint-sources.ts";

const ReportedNode = S.Struct({ node: S.Unknown });
const decodeReportedNode = S.decodeUnknownResult(ReportedNode);

describe("oxlint rules", () => {
  it("runs the global process rule in-process", () => {
    const reports: Array<unknown> = [];
    const rule = plugin.rules["no-global-process-runtime"];
    if (P.isUndefined(rule) || !("createOnce" in rule)) {
      throw new Error("Expected the global process rule to use createOnce");
    }
    const visitors = rule.createOnce({
      cwd: process.cwd(),
      filename: "fixture.ts",
      report: (finding: unknown) => reports.push(finding),
    } as never);

    visitors.before?.();
    visitors.MemberExpression?.({
      computed: false,
      object: {
        computed: false,
        object: { name: "globalThis", type: "Identifier" },
        optional: false,
        property: { name: "process", type: "Identifier" },
        type: "MemberExpression",
      },
      optional: false,
      property: { name: "platform", type: "Identifier" },
      type: "MemberExpression",
    } as never);

    expect(reports).toHaveLength(1);
  });

  it("classifies static and runtime schema compiler inputs in-process", () => {
    const reports: Array<unknown> = [];
    const rule = plugin.rules["no-inline-schema-compile"];
    if (P.isUndefined(rule) || !("createOnce" in rule)) {
      throw new Error("Expected the inline schema compile rule to use createOnce");
    }
    const visitors = rule.createOnce({
      cwd: process.cwd(),
      filename: "fixture.ts",
      report: (finding: unknown) => reports.push(finding),
    } as never);
    const identifier = (name: string) => ({ name, type: "Identifier" });
    const member = (object: unknown, property: string) => ({
      computed: false,
      object,
      optional: false,
      property: identifier(property),
      type: "MemberExpression",
    });
    const call = (callee: unknown, args: ReadonlyArray<unknown>) => ({
      arguments: args,
      callee,
      optional: false,
      type: "CallExpression",
    });
    const schemaCall = (method: string, args: ReadonlyArray<unknown>) => call(member(identifier("S"), method), args);

    visitors.before!();
    visitors.ImportDeclaration!({
      importKind: "value",
      source: { type: "Literal", value: "effect/Schema" },
      specifiers: [{ local: identifier("S"), type: "ImportNamespaceSpecifier" }],
      type: "ImportDeclaration",
    } as never);
    visitors.Program!({
      body: [
        {
          declarations: [{ id: identifier("Model"), init: null, type: "VariableDeclarator" }],
          kind: "const",
          type: "VariableDeclaration",
        },
        {
          importKind: "value",
          source: { type: "Literal", value: "./models" },
          specifiers: [{ local: identifier("Models"), type: "ImportNamespaceSpecifier" }],
          type: "ImportDeclaration",
        },
      ],
      sourceType: "module",
      type: "Program",
    } as never);
    visitors.FunctionDeclaration!({} as never);
    const staticArray = schemaCall("decodeSync", [schemaCall("Array", [identifier("Model")])]);
    const staticMember = schemaCall("decodeSync", [member(identifier("Models"), "User")]);
    const runtimeArray = schemaCall("decodeSync", [schemaCall("Array", [identifier("rowSchema")])]);
    const runtimeMember = schemaCall("decodeSync", [member(identifier("input"), "schema")]);
    visitors.CallExpression!(staticArray as never);
    visitors.CallExpression!(staticMember as never);
    visitors.CallExpression!(runtimeArray as never);
    visitors.CallExpression!(runtimeMember as never);
    visitors["FunctionDeclaration:exit"]!({} as never);

    expect(reports).toHaveLength(1);
    expect(Result.getOrThrow(decodeReportedNode(reports[0])).node).toBe(staticArray.callee);
  });

  for (const rule of OXLINT_RULES) {
    const { invalid, valid } = OXLINT_SOURCES[rule];

    describe(rule, () => {
      A.forEach(invalid, (testCase, index) => {
        it.layer(NodeServices.layer, { timeout: "10 seconds" })((it) =>
          it.effect(`flags invalid case #${index} (${testCase.count} finding(s))`, () =>
            Effect.gen(function* () {
              const findings = yield* runOxlintRule(rule, testCase.source, testCase.filename, testCase.supportingFiles);
              expect(findings.length).toBe(testCase.count);
              expect(A.every(findings, (finding) => finding.ruleId === rule)).toBe(true);

              if (testCase.fixedSource !== undefined) {
                const fixedSource = yield* runOxlintRuleFix(
                  rule,
                  testCase.source,
                  testCase.filename,
                  testCase.supportingFiles
                );
                expect(fixedSource).toBe(`${testCase.fixedSource}\n`);
              }
            })
          )
        );
      });

      A.forEach(valid, (testCase, index) => {
        it.layer(NodeServices.layer, { timeout: "10 seconds" })((it) =>
          it.effect(`ignores valid case #${index}`, () =>
            Effect.gen(function* () {
              const findings = yield* runOxlintRule(rule, testCase.source, testCase.filename, testCase.supportingFiles);
              expect(findings.length).toBe(0);
            })
          )
        );
      });
    });
  }
});

const repoRoot = decodeURIComponent(new URL("../../../../../", import.meta.url).pathname);
const canary = "scratchpad/effected/.canary/LawsCanary.ts";
const admitted = ["src/Ordinary.ts", "scratchpad/effected/example/Ordinary.ts", canary];
const ignored = [
  "scratchpad/effected/example/dist/Output.ts",
  "scratchpad/effected/example/build/Output.ts",
  "scratchpad/effected/example/.next/Output.ts",
  "scratchpad/effected/example/.turbo/Output.ts",
  "scratchpad/effected/example/coverage/Output.ts",
  "scratchpad/effected/example/generated/Output.ts",
  "scratchpad/effected/example/Output.gen.ts",
  "src/dist/Output.ts",
  "src/build/Output.ts",
  "src/.turbo/Output.ts",
  "src/generated/Output.ts",
  "src/Output.gen.ts",
  "docs/generated/Output.ts",
  ".repos/Output.ts",
  ".codex/Output.ts",
  ".claude/Output.ts",
  "src/scripts/Output.ts",
  "goals/Output.ts",
  "explorations/Output.ts",
];

// Only the CLI fields asserted below cross this test boundary.
const Report = S.Struct({ diagnostics: S.Array(S.Struct({ filename: S.String, code: S.String })) });
const parseReport = jsonReportParser(Report);
const fixtureSource =
  'import * as S from "effect/Schema";\nexport const check = (value: unknown) => S.is(S.Array(S.String))(value);\n';

const run = Effect.fn("effectedProfile.run")(function* (cwd: string, config: string, targets: ReadonlyArray<string>) {
  const result = yield* Effect.sync(() =>
    Bun.spawnSync(
      [
        `${repoRoot}/node_modules/.bin/oxlint`,
        "--quiet",
        "--disable-nested-config",
        "--format=json",
        "--config",
        config,
        ...targets,
      ],
      { cwd, stdout: "pipe", stderr: "pipe" }
    )
  );
  yield* validateLinterProcess(result);
  const report = yield* parseReport(result.stdout.toString());
  return { exitCode: result.exitCode, diagnostics: report.diagnostics };
});

const makeEffectedFixture = Effect.fn("effectedProfile.makeFixture")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ directory: repoRoot, prefix: ".effected-profile-" });
  const config = yield* fs.readFileString(path.join(repoRoot, ".oxlintrc.json"));
  yield* fs.writeFileString(
    path.join(root, ".oxlintrc.json"),
    Str.replace(
      "./packages/tooling/policy-pack/lint-rules/src/rules/index.ts",
      `${repoRoot}/packages/tooling/policy-pack/lint-rules/src/rules/index.ts`
    )(config)
  );
  yield* fs.copyFile(path.join(repoRoot, ".oxlintrc.effected.json"), path.join(root, ".oxlintrc.effected.json"));
  yield* Effect.forEach(
    [...admitted, ...ignored],
    Effect.fnUntraced(function* (file) {
      const target = path.join(root, file);
      yield* fs.makeDirectory(path.dirname(target), { recursive: true });
      yield* fs.writeFileString(target, fixtureSource);
    })
  );
  return root;
});

describe("Effected oxlint profile", () => {
  it.layer(NodeServices.layer, { timeout: "10 seconds" })((it) =>
    it.effect("preserves root exclusions while admitting ordinary source and the explicit canary", () =>
      Effect.gen(function* () {
        const root = yield* makeEffectedFixture();
        const targets = [
          "src",
          "scratchpad/effected/example",
          canary,
          "docs",
          ".repos",
          ".codex",
          ".claude",
          "goals",
          "explorations",
        ];
        const baseline = yield* run(root, ".oxlintrc.json", targets);
        expect(baseline.exitCode).toBe(1);
        expect(baseline.diagnostics).toEqual([{ filename: "src/Ordinary.ts", code: "beep(no-inline-schema-compile)" }]);
        const result = yield* run(root, ".oxlintrc.effected.json", targets);
        expect(result.exitCode).toBe(1);
        expect(A.map(result.diagnostics, (diagnostic) => diagnostic.code)).toEqual(
          A.replicate("beep(no-inline-schema-compile)", admitted.length)
        );
        expect(
          A.sort(
            A.map(result.diagnostics, (diagnostic) => diagnostic.filename),
            Order.String
          )
        ).toEqual(A.sort(admitted, Order.String));
      })
    )
  );

  it.effect("independently rejects the repository law canary with inherited plugin rules", () =>
    Effect.gen(function* () {
      const result = yield* run(repoRoot, ".oxlintrc.effected.json", [canary]);
      expect(result.exitCode).toBe(1);
      expect(result.diagnostics).toContainEqual({ filename: canary, code: "beep(no-inline-schema-compile)" });
    })
  );
});
