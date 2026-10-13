import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { Repo } from "../../effected/github/Repo.ts";
import { RepositorySecurity } from "../../effected/github/RepositorySecurity.ts";
import { REPO } from "./harness.ts";

const DefectFields = S.Struct({ _tag: S.String, message: S.String });

describe("RepositorySecurity test doubles", () => {
  it.layer(Layer.mergeAll(RepositorySecurity.layerTest(), Repo.layer(REPO)), { timeout: "30 seconds" })((it) => {
    it.effect("unstubbed setters throw and reads defer defects until execution", () => Effect.gen(function* () {
      const layered = yield* RepositorySecurity;
      const direct = RepositorySecurity.makeTest();
      for (const service of [layered, direct]) {
        assert.throws(() => service.setVulnerabilityAlerts(true), "RepositorySecurity.makeTest: setVulnerabilityAlerts()");
        assert.throws(() => service.setAutomatedSecurityFixes(false), "RepositorySecurity.makeTest: setAutomatedSecurityFixes()");
        assert.throws(() => service.setPrivateVulnerabilityReporting(true), "RepositorySecurity.makeTest: setPrivateVulnerabilityReporting()");
        for (const member of ["vulnerabilityAlerts", "automatedSecurityFixes", "privateVulnerabilityReporting"] as const) {
          const exit = yield* Effect.exit(service[member]);
          const cause = yield* exit.pipe(Exit.getCause, Effect.fromOption);
          assertExitFailure(exit, cause);
          const defect = yield* cause.pipe(Cause.findDefect, Effect.fromResult);
          assert.deepStrictEqual(yield* S.decodeUnknownEffect(DefectFields)(defect), {
            _tag: "UnstubbedError",
            message: `RepositorySecurity.makeTest: ${member}() was called but not stubbed — pass an override.`,
          });
        }
      }
    }));
  });
  const calls: Array<readonly [string, boolean]> = [];
  it.layer(Layer.mergeAll(RepositorySecurity.layerTest({
    vulnerabilityAlerts: Effect.succeed(true),
    automatedSecurityFixes: Effect.succeed(false),
    privateVulnerabilityReporting: Effect.succeed(true),
    setVulnerabilityAlerts: (enabled) => Effect.sync(() => { calls.push(["alerts", enabled]); }),
    setAutomatedSecurityFixes: (enabled) => Effect.sync(() => { calls.push(["fixes", enabled]); }),
    setPrivateVulnerabilityReporting: (enabled) => Effect.sync(() => { calls.push(["reporting", enabled]); }),
  }), Repo.layer(REPO)), { timeout: "30 seconds" })((it) => {
    it.effect("all six overrides keep their values and setter arguments", () => Effect.gen(function* () {
      const service = yield* RepositorySecurity;
      const start = calls.length;
      assert.strictEqual(yield* service.vulnerabilityAlerts, true);
      assert.strictEqual(yield* service.automatedSecurityFixes, false);
      assert.strictEqual(yield* service.privateVulnerabilityReporting, true);
      assert.strictEqual(yield* service.setVulnerabilityAlerts(false), undefined);
      assert.strictEqual(yield* service.setAutomatedSecurityFixes(true), undefined);
      assert.strictEqual(yield* service.setPrivateVulnerabilityReporting(false), undefined);
      assert.deepStrictEqual(calls.slice(start), [["alerts", false], ["fixes", true], ["reporting", false]]);
    }));
  });
});
