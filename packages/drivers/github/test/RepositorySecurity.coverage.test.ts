import { Repo } from "@beep/github/Repo";
import { RepositorySecurity } from "@beep/github/RepositorySecurity";
import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { REPO } from "./support/harness.ts";

const DefectFields = S.Struct({ _tag: S.String, message: S.String });

describe("RepositorySecurity test doubles", () => {
  it.layer(Layer.mergeAll(RepositorySecurity.layerTest(), Repo.layer(REPO)), { timeout: "30 seconds" })((it) => {
    it.effect("unstubbed setters throw and reads defer defects until execution", () =>
      Effect.gen(function* () {
        const layered = yield* RepositorySecurity;
        const direct = RepositorySecurity.makeTest();
        for (const service of [layered, direct]) {
          assert.throws(
            () => service.setVulnerabilityAlerts(true),
            "RepositorySecurity.makeTest: setVulnerabilityAlerts()"
          );
          assert.throws(
            () => service.setAutomatedSecurityFixes(false),
            "RepositorySecurity.makeTest: setAutomatedSecurityFixes()"
          );
          assert.throws(
            () => service.setPrivateVulnerabilityReporting(true),
            "RepositorySecurity.makeTest: setPrivateVulnerabilityReporting()"
          );
          for (const member of [
            "vulnerabilityAlerts",
            "automatedSecurityFixes",
            "privateVulnerabilityReporting",
          ] as const) {
            const exit = yield* Effect.exit(service[member]);
            const cause = yield* exit.pipe(Exit.getCause, Effect.fromOption);
            assertExitFailure(exit, cause);
            const defect = yield* cause.pipe(Cause.findDefect, Effect.fromResult);
            const value = yield* S.decodeUnknownEffect(DefectFields)(defect);
            assert.deepStrictEqual(value, {
              _tag: "UnstubbedMemberError",
              message: `RepositorySecurity.makeTest: ${member}() was called but not stubbed — pass an override.`,
            });
          }
        }
      })
    );
  });
  const calls: Array<readonly [string, boolean]> = [];
  it.layer(
    Layer.mergeAll(
      RepositorySecurity.layerTest({
        vulnerabilityAlerts: Effect.succeed(true),
        automatedSecurityFixes: Effect.succeed(false),
        privateVulnerabilityReporting: Effect.succeed(true),
        setVulnerabilityAlerts: (enabled) =>
          Effect.sync(() => {
            calls.push(["alerts", enabled]);
          }),
        setAutomatedSecurityFixes: (enabled) =>
          Effect.sync(() => {
            calls.push(["fixes", enabled]);
          }),
        setPrivateVulnerabilityReporting: (enabled) =>
          Effect.sync(() => {
            calls.push(["reporting", enabled]);
          }),
      }),
      Repo.layer(REPO)
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("all six overrides keep their values and setter arguments", () =>
      Effect.gen(function* () {
        const service = yield* RepositorySecurity;
        const start = calls.length;
        const vulnerabilityAlerts1 = yield* service.vulnerabilityAlerts;
        assert.strictEqual(vulnerabilityAlerts1, true);
        const automatedSecurityFixes2 = yield* service.automatedSecurityFixes;
        assert.strictEqual(automatedSecurityFixes2, false);
        const privateVulnerabilityReporting3 = yield* service.privateVulnerabilityReporting;
        assert.strictEqual(privateVulnerabilityReporting3, true);
        const setVulnerabilityAlerts4 = yield* service.setVulnerabilityAlerts(false);
        assert.strictEqual(setVulnerabilityAlerts4, undefined);
        const setAutomatedSecurityFixes5 = yield* service.setAutomatedSecurityFixes(true);
        assert.strictEqual(setAutomatedSecurityFixes5, undefined);
        const setPrivateVulnerabilityReporting6 = yield* service.setPrivateVulnerabilityReporting(false);
        assert.strictEqual(setPrivateVulnerabilityReporting6, undefined);
        assert.deepStrictEqual(calls.slice(start), [
          ["alerts", false],
          ["fixes", true],
          ["reporting", false],
        ]);
      })
    );
  });
});
