import plugin from "@beep/lint-rules/oxlint";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { Effect, Result } from "effect";
import * as A from "effect/Array";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
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

    expect(reports).toHaveLength(2);
    expect(Result.getOrThrow(decodeReportedNode(reports[0])).node).toBe(staticArray.callee);
    expect(Result.getOrThrow(decodeReportedNode(reports[1])).node).toBe(staticMember.callee);
  });

  for (const rule of OXLINT_RULES) {
    const { invalid, valid } = OXLINT_SOURCES[rule];

    describe(rule, () => {
      invalid.forEach((testCase, index) => {
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

      valid.forEach((testCase, index) => {
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
