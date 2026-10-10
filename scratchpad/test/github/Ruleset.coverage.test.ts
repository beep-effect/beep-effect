import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertExitFailure } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { GitHubError } from "../../effected/github/GitHubError.ts";
import { Ruleset } from "../../effected/github/Ruleset.ts";
import { Repo } from "../../effected/github/Repo.ts";
import { harness, REPO } from "./harness.ts";

describe("Ruleset test-double behavior", () => {
  it.layer(Layer.mergeAll(Ruleset.layerTest(), Repo.layer(REPO)), { timeout: "30 seconds" })((it) => {
    it.effect("unstubbed operations name the missing member; list dies only when executed", () => Effect.gen(function* () {
      const service = Ruleset.makeTest();
      assert.throws(() => service.upsert({ name: "main", target: "branch", enforcement: "active" }), "Ruleset.makeTest: upsert() was called but not stubbed");
      assert.throws(() => service.delete(7), "Ruleset.makeTest: delete() was called but not stubbed");
      assert.throws(() => service.teamId("ops"), "Ruleset.makeTest: teamId() was called but not stubbed");
      assert.throws(() => service.roleId("admin"), "Ruleset.makeTest: roleId() was called but not stubbed");
      const exit = yield* Effect.exit(service.list);
      const cause = yield* exit.pipe(Exit.getCause, Effect.fromOption);
      assertExitFailure(exit, cause);
      const defect = yield* cause.pipe(Cause.findDefect, Effect.fromResult);
      assert.deepStrictEqual(yield* S.decodeUnknownEffect(S.Struct({ _tag: S.String, message: S.String }))(defect), {
        _tag: "UnstubbedError",
        message: "Ruleset.makeTest: list() was called but not stubbed — pass an override.",
      });
      const defaults = yield* Ruleset;
      assert.throws(() => defaults.upsert({ name: "main", target: "branch", enforcement: "active" }), "Ruleset.makeTest: upsert()");
    }));
  });
  const calls: Array<ReadonlyArray<string | number>> = [];
  it.layer(Layer.mergeAll(Ruleset.layerTest({
    upsert: (payload) => Effect.sync(() => { calls.push(["upsert", payload.name, payload.target, payload.enforcement]); }),
    list: Effect.succeed([{ id: 7, name: "main", source_type: "Repository" }]),
    delete: (id) => Effect.sync(() => { calls.push(["delete", id]); }),
    teamId: (slug) => Effect.sync(() => { calls.push(["teamId", slug]); return 42; }),
    roleId: (name) => Effect.sync(() => { calls.push(["roleId", name]); return 7; }),
  }), Repo.layer(REPO)), { timeout: "30 seconds" })((it) => {
    it.effect("the layer honors every override and forwards its arguments", () => Effect.gen(function* () {
      const start = calls.length;
      const service = yield* Ruleset;
      assert.strictEqual(yield* service.upsert({ name: "main", target: "branch", enforcement: "active" }), undefined);
      assert.deepStrictEqual(yield* service.list, [{ id: 7, name: "main", source_type: "Repository" }]);
      assert.strictEqual(yield* service.delete(7), undefined);
      assert.strictEqual(yield* service.teamId("ops"), 42);
      assert.strictEqual(yield* service.roleId("admin"), 7);
      assert.deepStrictEqual(calls.slice(start), [["upsert", "main", "branch", "active"], ["delete", 7], ["teamId", "ops"], ["roleId", "admin"]]);
    }));
  });
});

describe("Ruleset malformed role response", () => {
  const { script, base } = harness([{ status: 200, body: { roles: [{ name: "admin", id: "not-a-number" }] } }]);
  it.layer(Ruleset.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
    it.effect("rejects a matching role whose id is malformed instead of returning it", () => Effect.gen(function* () {
      const service = yield* Ruleset;
      assertFailure(yield* Effect.result(service.roleId("admin")), GitHubError.decode("Ruleset.roleId", "organization role id was not a number"));
      assert.strictEqual(script.calls.at(-1)?.path, "/orgs/acme/organization-roles");
      assert.strictEqual(script.calls.at(-1)?.method, "GET");
    }));
  });
});
