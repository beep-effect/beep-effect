import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { Repo, RepoRef } from "../../effected/github/Repo.ts";
import * as S from "effect/Schema";
import { DeploymentEnvironment } from "../../effected/github/DeploymentEnvironment.ts";

const UnstubbedError = S.TaggedStruct("UnstubbedError", { message: S.String });

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
        upsert: () => Effect.void,
        list: Effect.succeed([{ name: "prod" }]),
        delete: () => Effect.void,
      }),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("layer preserves all supplied overrides", () =>
        Effect.gen(function* () {
          const service = yield* DeploymentEnvironment;
          assert.strictEqual(yield* service.upsert("prod"), undefined);
          assert.deepStrictEqual(yield* service.list, [{ name: "prod" }]);
          assert.strictEqual(yield* service.delete("prod"), undefined);
        })
      );
    });
  });
});
