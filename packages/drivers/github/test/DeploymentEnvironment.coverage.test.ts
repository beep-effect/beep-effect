import { DeploymentEnvironment, DeploymentEnvironmentInfo } from "@beep/github/DeploymentEnvironment";
import { Repo, RepoRef } from "@beep/github/Repo";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const UnstubbedError = S.TaggedStruct("UnstubbedMemberError", { message: S.String });

describe("DeploymentEnvironment test doubles", () => {
  it.layer(Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" })), { timeout: "30 seconds" })((it) => {
    it.effect("default methods identify the missing override", () =>
      Effect.gen(function* () {
        const service = DeploymentEnvironment.makeTest();
        assert.throws(
          () => service.upsert("prod"),
          /DeploymentEnvironment\.makeTest: upsert\(\) was called but not stubbed/
        );
        assert.throws(
          () => service.delete("prod"),
          /DeploymentEnvironment\.makeTest: delete\(\) was called but not stubbed/
        );
        const defect = yield* service.list.pipe(Effect.catchDefect(Effect.succeed));
        const error = yield* S.decodeUnknownEffect(UnstubbedError)(defect);
        assert.strictEqual(
          error.message,
          "DeploymentEnvironment.makeTest: list() was called but not stubbed — pass an override."
        );
      })
    );
    it.layer(DeploymentEnvironment.layerTest(), { timeout: "30 seconds" })((it) => {
      it.effect("default layer exposes the same fail-loud double", () =>
        Effect.gen(function* () {
          const service = yield* DeploymentEnvironment;
          assert.throws(() => service.upsert("prod"), /DeploymentEnvironment\.makeTest: upsert/);
        })
      );
    });
    it.layer(
      DeploymentEnvironment.layerTest({
        upsert: dual(
          (args) => P.isString(args[0]),
          (_name: string, _config?: Record<string, unknown>) => Effect.void
        ),
        list: Effect.succeed([DeploymentEnvironmentInfo.make({ name: "prod" })]),
        delete: () => Effect.void,
      }),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("layer preserves all supplied overrides", () =>
        Effect.gen(function* () {
          const service = yield* DeploymentEnvironment;
          assert.strictEqual(yield* service.upsert("prod"), undefined);
          assert.deepStrictEqual(yield* service.list, [DeploymentEnvironmentInfo.make({ name: "prod" })]);
          assert.strictEqual(yield* service.delete("prod"), undefined);
        })
      );
    });
  });
});
