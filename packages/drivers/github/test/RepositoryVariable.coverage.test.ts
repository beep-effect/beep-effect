import { GitHubError } from "@beep/github/GitHubError";
import { Repo } from "@beep/github/Repo";
import { RepositoryVariable, VariableInfo } from "@beep/github/RepositoryVariable";
import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure, assertFailure } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { harness, REPO } from "./support/harness.ts";

const DefectFields = S.Struct({ _tag: S.String, message: S.String });

describe("RepositoryVariable test-double behavior", () => {
  it.layer(Layer.mergeAll(RepositoryVariable.layerTest(), Repo.layer(REPO)), { timeout: "30 seconds" })((it) => {
    it.effect("unstubbed operations name the missing member; list dies only when executed", () =>
      Effect.gen(function* () {
        const service = RepositoryVariable.makeTest();
        assert.throws(
          () => service.set("REGION", "west"),
          "RepositoryVariable.makeTest: set() was called but not stubbed"
        );
        assert.throws(
          () => service.delete("REGION"),
          "RepositoryVariable.makeTest: delete() was called but not stubbed"
        );
        assert.throws(
          () => service.setForEnvironment("prod", "REGION", "west"),
          "RepositoryVariable.makeTest: setForEnvironment() was called but not stubbed"
        );
        assert.throws(
          () => service.listForEnvironment("prod"),
          "RepositoryVariable.makeTest: listForEnvironment() was called but not stubbed"
        );
        assert.throws(
          () => service.deleteForEnvironment("prod", "REGION"),
          "RepositoryVariable.makeTest: deleteForEnvironment() was called but not stubbed"
        );
        const exit = yield* Effect.exit(service.list);
        const cause = yield* exit.pipe(Exit.getCause, Effect.fromOption);
        assertExitFailure(exit, cause);
        const defect = yield* cause.pipe(Cause.findDefect, Effect.fromResult);
        assert.deepStrictEqual(yield* S.decodeUnknownEffect(DefectFields)(defect), {
          _tag: "UnstubbedMemberError",
          message: "RepositoryVariable.makeTest: list() was called but not stubbed — pass an override.",
        });
        const defaults = yield* RepositoryVariable;
        assert.throws(() => defaults.set("REGION", "west"), "RepositoryVariable.makeTest: set()");
      })
    );
  });
  const calls: Array<ReadonlyArray<string | number>> = [];
  it.layer(
    Layer.mergeAll(
      RepositoryVariable.layerTest({
        set: dual(2, (name: string, value: string) =>
          Effect.sync(() => {
            calls.push(["set", name, value]);
          })
        ),
        list: Effect.succeed([VariableInfo.make({ name: "REGION", value: "west" })]),
        delete: (name) =>
          Effect.sync(() => {
            calls.push(["delete", name]);
          }),
        setForEnvironment: dual(3, (environment: string, name: string, value: string) =>
          Effect.sync(() => {
            calls.push(["setForEnvironment", environment, name, value]);
          })
        ),
        listForEnvironment: (environment) =>
          Effect.sync(() => {
            calls.push(["listForEnvironment", environment]);
            return [VariableInfo.make({ name: "REGION", value: "west" })];
          }),
        deleteForEnvironment: dual(2, (environment: string, name: string) =>
          Effect.sync(() => {
            calls.push(["deleteForEnvironment", environment, name]);
          })
        ),
      }),
      Repo.layer(REPO)
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("the layer honors every override and forwards its arguments", () =>
      Effect.gen(function* () {
        const start = calls.length;
        const service = yield* RepositoryVariable;
        assert.strictEqual(yield* service.set("REGION", "west"), undefined);
        assert.deepStrictEqual(yield* service.list, [VariableInfo.make({ name: "REGION", value: "west" })]);
        assert.strictEqual(yield* service.delete("REGION"), undefined);
        assert.strictEqual(yield* service.setForEnvironment("prod", "REGION", "west"), undefined);
        assert.deepStrictEqual(yield* service.listForEnvironment("prod"), [
          VariableInfo.make({ name: "REGION", value: "west" }),
        ]);
        assert.strictEqual(yield* service.deleteForEnvironment("prod", "REGION"), undefined);
        assert.deepStrictEqual(calls.slice(start), [
          ["set", "REGION", "west"],
          ["delete", "REGION"],
          ["setForEnvironment", "prod", "REGION", "west"],
          ["listForEnvironment", "prod"],
          ["deleteForEnvironment", "prod", "REGION"],
        ]);
      })
    );
  });
});

for (const environment of [false, true]) {
  describe(`RepositoryVariable ${environment ? "environment" : "repository"} authorization failure`, () => {
    const { script, base } = harness([{ status: 403, body: { message: "Forbidden" } }]);
    it.layer(RepositoryVariable.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect("propagates a failed existence read and sends no write", () =>
        Effect.gen(function* () {
          const service = yield* RepositoryVariable;
          const outcome = yield* Effect.result(
            environment ? service.setForEnvironment("prod", "REGION", "west") : service.set("REGION", "west")
          );
          const error = yield* outcome.pipe(Effect.fromResult, Effect.flip);
          assertFailure(outcome, error);
          assert.isTrue(S.is(GitHubError)(error));
          assert.strictEqual(error.kind, "unauthorized");
          assert.strictEqual(script.count(), 1);
          assert.strictEqual(script.calls.at(-1)?.method, "GET");
          assert.strictEqual(
            script.calls.at(-1)?.path,
            environment
              ? "/repos/acme/widget/environments/prod/variables/REGION"
              : "/repos/acme/widget/actions/variables/REGION"
          );
        })
      );
    });
  });
}
