import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import * as A from "effect/Array";
import { describe, expect, it } from "vitest";
import { provideScopedLayer } from "./harness.ts";
import { OXLINT_RULES, runOxlintRule, runOxlintRuleFix } from "./oxlint-harness.ts";
import { OXLINT_SOURCES } from "./oxlint-sources.ts";

const run = <A2, E>(program: Effect.Effect<A2, E, NodeServices.NodeServices>): Promise<A2> =>
  Effect.runPromise(program.pipe(provideScopedLayer(NodeServices.layer)));

describe("oxlint rules", () => {
  for (const rule of OXLINT_RULES) {
    const { invalid, valid } = OXLINT_SOURCES[rule];

    describe(rule, () => {
      invalid.forEach((testCase, index) => {
        it(`flags invalid case #${index} (${testCase.count} finding(s))`, () =>
          run(
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
          ));
      });

      valid.forEach((testCase, index) => {
        it(`ignores valid case #${index}`, () =>
          run(
            Effect.gen(function* () {
              const findings = yield* runOxlintRule(rule, testCase.source, testCase.filename, testCase.supportingFiles);
              expect(findings.length).toBe(0);
            })
          ));
      });
    });
  }
});
