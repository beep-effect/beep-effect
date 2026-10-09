import { assert, describe, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as Result from "effect/Result";
import { HttpClient, HttpClientResponse } from "effect/http";
import { DEFAULT_REGISTRY, NpmRegistry, RegistryReadError } from "../../effected/npm/NpmRegistry.ts";

it.effect("registry error messages identify transport, decoding and status failures", () => Effect.sync(() => {
  const base = { package: "pkg", registry: DEFAULT_REGISTRY };
  assert.strictEqual(RegistryReadError.make({ ...base, kind: "transport" }).message,
    `Could not reach the registry for pkg on ${DEFAULT_REGISTRY}`);
  assert.strictEqual(RegistryReadError.make({ ...base, kind: "decode" }).message,
    `Registry read for pkg on ${DEFAULT_REGISTRY} returned an unreadable body`);
  assert.strictEqual(RegistryReadError.make({ ...base, kind: "status", status: 503 }).message,
    `Registry read for pkg on ${DEFAULT_REGISTRY} failed with status 503`);
  assert.strictEqual(RegistryReadError.make({ ...base, kind: "status" }).message,
    `Registry read for pkg on ${DEFAULT_REGISTRY} failed with status unknown`);
}));

const client = (body: unknown, status = 200) => Layer.succeed(HttpClient.HttpClient,
  HttpClient.make((request) => Effect.succeed(HttpClientResponse.fromWeb(request, new Response(
    Result.getOrThrow(S.encodeResult(S.fromJsonString(S.Unknown))(body)), { status })))));

for (const body of [{}, { time: { bad: "not a date" } }]) {
  it.layer(NpmRegistry.layer.pipe(Layer.provide(client(body))), { timeout: "30 seconds" })((it) => {
    it.effect("missing packument maps and invalid publication dates yield empty results", () => Effect.gen(function* () {
      const registry = yield* NpmRegistry;
      assert.deepStrictEqual(yield* registry.versions("pkg", { registry: `${DEFAULT_REGISTRY}/` }), []);
      assert.deepStrictEqual(yield* registry.distTags("pkg"), {});
      assert.deepStrictEqual(yield* registry.publishTimes("pkg"), []);
      assertNone(yield* registry.version("pkg", "1.0.0", { registry: "https://npm.pkg.github.com" }));
    }));
  });
}

describe("empty seeded registry", () => {
  it.layer(NpmRegistry.layerSeeded({ registries: {} }), { timeout: "30 seconds" })((it) => {
    it.effect("all collection reads of an absent package are empty", () => Effect.gen(function* () {
      const registry = yield* NpmRegistry;
      assertNone(yield* registry.version("absent", "1"));
      assert.deepStrictEqual(yield* registry.versions("absent"), []);
      assert.deepStrictEqual(yield* registry.publishTimes("absent"), []);
      assert.deepStrictEqual(yield* registry.distTags("absent"), {});
    }));
  });
});
it.effect("seeded missing tags and invalid dates do not fabricate registry facts", () => Effect.gen(function* () {
  const registry = NpmRegistry.makeSeeded({ registries: {
    [DEFAULT_REGISTRY]: { pkg: { "1": {}, "2": { publishedAt: "invalid" } } },
  }, distTags: {} });
  assert.deepStrictEqual(yield* registry.distTags("pkg"), {});
  assert.deepStrictEqual(yield* registry.publishTimes("pkg"), []);
}));

it.layer(NpmRegistry.layer.pipe(Layer.provide(client({}, 404))), { timeout: "30 seconds" })((it) => {
  it.effect("a missing live packument yields no version, no tags and no publish times", () => Effect.gen(function* () {
    const registry = yield* NpmRegistry;
    assertNone(yield* registry.version("pkg", "1", { registry: "https://npm.pkg.github.com" }));
    assert.deepStrictEqual(yield* registry.distTags("pkg"), {});
    assert.deepStrictEqual(yield* registry.publishTimes("pkg"), []);
  }));
});
