import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Base64 from "effect/encoding/Base64";
import { Repo } from "../../effected/github/Repo.ts";
import { RepositorySecret } from "../../effected/github/RepositorySecret.ts";
import { harness, REPO } from "./harness.ts";

const value = Redacted.make("secret-value");

describe("RepositorySecret test doubles", () => {
  it.layer(Layer.mergeAll(RepositorySecret.layerTest(), Repo.layer(REPO)), { timeout: "30 seconds" })((it) => {
    it.effect("every unstubbed member identifies the missing override", () => Effect.gen(function* () {
      const service = yield* RepositorySecret;
      const direct = RepositorySecret.makeTest();
      for (const stub of [service, direct]) {
        assert.throws(() => stub.set("TOKEN", value), "RepositorySecret.makeTest: set()");
        assert.throws(() => stub.list(), "RepositorySecret.makeTest: list()");
        assert.throws(() => stub.delete("TOKEN"), "RepositorySecret.makeTest: delete()");
        assert.throws(() => stub.setForEnvironment("prod", "TOKEN", value), "RepositorySecret.makeTest: setForEnvironment()");
        assert.throws(() => stub.listForEnvironment("prod"), "RepositorySecret.makeTest: listForEnvironment()");
        assert.throws(() => stub.deleteForEnvironment("prod", "TOKEN"), "RepositorySecret.makeTest: deleteForEnvironment()");
      }
    }));
  });
  const calls: Array<ReadonlyArray<unknown>> = [];
  it.layer(Layer.mergeAll(RepositorySecret.layerTest({
    set: (name, secret, scope) => Effect.sync(() => { calls.push(["set", name, secret, scope]); }),
    list: (scope) => Effect.sync(() => { calls.push(["list", scope]); return [{ name: "TOKEN" }]; }),
    delete: (name, scope) => Effect.sync(() => { calls.push(["delete", name, scope]); }),
    setForEnvironment: (environment, name, secret) => Effect.sync(() => { calls.push(["setForEnvironment", environment, name, secret]); }),
    listForEnvironment: (environment) => Effect.sync(() => { calls.push(["listForEnvironment", environment]); return [{ name: "ENV_TOKEN" }]; }),
    deleteForEnvironment: (environment, name) => Effect.sync(() => { calls.push(["deleteForEnvironment", environment, name]); }),
  }), Repo.layer(REPO)), { timeout: "30 seconds" })((it) => {
    it.effect("all overrides receive the original arguments and return their results", () => Effect.gen(function* () {
      const service = yield* RepositorySecret;
      const start = calls.length;
      assert.strictEqual(yield* service.set("TOKEN", value, "dependabot"), undefined);
      assert.deepStrictEqual(yield* service.list("codespaces"), [{ name: "TOKEN" }]);
      assert.strictEqual(yield* service.delete("TOKEN", "actions"), undefined);
      assert.strictEqual(yield* service.setForEnvironment("prod", "TOKEN", value), undefined);
      assert.deepStrictEqual(yield* service.listForEnvironment("prod"), [{ name: "ENV_TOKEN" }]);
      assert.strictEqual(yield* service.deleteForEnvironment("prod", "TOKEN"), undefined);
      assert.deepStrictEqual(calls.slice(start), [
        ["set", "TOKEN", value, "dependabot"], ["list", "codespaces"], ["delete", "TOKEN", "actions"],
        ["setForEnvironment", "prod", "TOKEN", value], ["listForEnvironment", "prod"], ["deleteForEnvironment", "prod", "TOKEN"],
      ]);
    }));
  });
});

describe("RepositorySecret default write scope", () => {
  const { script, base } = harness([
    { status: 200, body: { key: Base64.encode(new Uint8Array(32).fill(7)), key_id: "key-123" } },
    { status: 204 }, { status: 204 },
  ]);
  it.layer(RepositorySecret.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
    it.effect("omitted set and delete scopes use Actions and keep the repository coordinate", () => Effect.gen(function* () {
      const service = yield* RepositorySecret;
      assert.strictEqual(yield* service.set("TOKEN", value), undefined);
      assert.strictEqual(yield* service.delete("TOKEN"), undefined);
      assert.deepStrictEqual(script.calls.map((call) => [call.method, call.path]), [
        ["GET", "/repos/acme/widget/actions/secrets/public-key"],
        ["PUT", "/repos/acme/widget/actions/secrets/TOKEN"],
        ["DELETE", "/repos/acme/widget/actions/secrets/TOKEN"],
      ]);
    }));
  });
});
