import { Repo } from "@beep/github/Repo";
import { RepositorySecret, SecretInfo } from "@beep/github/RepositorySecret";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as P from "effect/Predicate";
import * as Redacted from "effect/Redacted";
import { harness, REPO } from "./support/harness.ts";
import type { SecretScope } from "@beep/github/RepositorySecret";

const value = Redacted.make("secret-value");

describe("RepositorySecret test doubles", () => {
  it.layer(Layer.mergeAll(RepositorySecret.layerTest(), Repo.layer(REPO)), { timeout: "30 seconds" })((it) => {
    it.effect("every unstubbed member identifies the missing override", () =>
      Effect.gen(function* () {
        const service = yield* RepositorySecret;
        const direct = RepositorySecret.makeTest();
        for (const stub of [service, direct]) {
          assert.throws(() => stub.set("TOKEN", value), "RepositorySecret.makeTest: set()");
          assert.throws(() => stub.list(), "RepositorySecret.makeTest: list()");
          assert.throws(() => stub.delete("TOKEN"), "RepositorySecret.makeTest: delete()");
          assert.throws(
            () => stub.setForEnvironment("prod", "TOKEN", value),
            "RepositorySecret.makeTest: setForEnvironment()"
          );
          assert.throws(() => stub.listForEnvironment("prod"), "RepositorySecret.makeTest: listForEnvironment()");
          assert.throws(
            () => stub.deleteForEnvironment("prod", "TOKEN"),
            "RepositorySecret.makeTest: deleteForEnvironment()"
          );
        }
      })
    );
  });
  const calls: Array<ReadonlyArray<unknown>> = [];
  it.layer(
    Layer.mergeAll(
      RepositorySecret.layerTest({
        set: dual(
          (args) => P.isString(args[0]),
          (name: string, secret: Redacted.Redacted<string>, scope?: SecretScope) =>
            Effect.sync(() => {
              calls.push(["set", name, secret, scope]);
            })
        ),
        list: (scope) =>
          Effect.sync(() => {
            calls.push(["list", scope]);
            return [SecretInfo.make({ name: "TOKEN" })];
          }),
        delete: (name, scope) =>
          Effect.sync(() => {
            calls.push(["delete", name, scope]);
          }),
        setForEnvironment: dual(3, (environment: string, name: string, secret: Redacted.Redacted<string>) =>
          Effect.sync(() => {
            calls.push(["setForEnvironment", environment, name, secret]);
          })
        ),
        listForEnvironment: (environment) =>
          Effect.sync(() => {
            calls.push(["listForEnvironment", environment]);
            return [SecretInfo.make({ name: "ENV_TOKEN" })];
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
    it.effect("all overrides receive the original arguments and return their results", () =>
      Effect.gen(function* () {
        const service = yield* RepositorySecret;
        const start = calls.length;
        const set1 = yield* service.set("TOKEN", value, "dependabot");
        assert.strictEqual(set1, undefined);
        const list2 = yield* service.list("codespaces");
        assert.deepStrictEqual(list2, [SecretInfo.make({ name: "TOKEN" })]);
        const delete3 = yield* service.delete("TOKEN", "actions");
        assert.strictEqual(delete3, undefined);
        const setForEnvironment4 = yield* service.setForEnvironment("prod", "TOKEN", value);
        assert.strictEqual(setForEnvironment4, undefined);
        const listForEnvironment5 = yield* service.listForEnvironment("prod");
        assert.deepStrictEqual(listForEnvironment5, [SecretInfo.make({ name: "ENV_TOKEN" })]);
        const deleteForEnvironment6 = yield* service.deleteForEnvironment("prod", "TOKEN");
        assert.strictEqual(deleteForEnvironment6, undefined);
        assert.deepStrictEqual(calls.slice(start), [
          ["set", "TOKEN", value, "dependabot"],
          ["list", "codespaces"],
          ["delete", "TOKEN", "actions"],
          ["setForEnvironment", "prod", "TOKEN", value],
          ["listForEnvironment", "prod"],
          ["deleteForEnvironment", "prod", "TOKEN"],
        ]);
      })
    );
  });
});

describe("RepositorySecret default write scope", () => {
  const { script, base } = harness([
    { status: 200, body: { key: Base64.encode(new Uint8Array(32).fill(7)), key_id: "key-123" } },
    { status: 204 },
    { status: 204 },
  ]);
  it.layer(RepositorySecret.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
    it.effect("omitted set and delete scopes use Actions and keep the repository coordinate", () =>
      Effect.gen(function* () {
        const service = yield* RepositorySecret;
        const set7 = yield* service.set("TOKEN", value);
        assert.strictEqual(set7, undefined);
        const delete8 = yield* service.delete("TOKEN");
        assert.strictEqual(delete8, undefined);
        assert.deepStrictEqual(
          A.map(script.calls, (call) => [call.method, call.path]),
          [
            ["GET", "/repos/acme/widget/actions/secrets/public-key"],
            ["PUT", "/repos/acme/widget/actions/secrets/TOKEN"],
            ["DELETE", "/repos/acme/widget/actions/secrets/TOKEN"],
          ]
        );
      })
    );
  });
});
