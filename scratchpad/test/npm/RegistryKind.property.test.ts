import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { RegistryKind, registryHost, classifyRegistry, registryShortLabel, registryDisplayName } from "../../effected/npm/RegistryKind.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(`${name}: decode(encode(x)) preserves x and never fails`, [Arbitrary.schema(schema)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assertTrue(equivalent(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }), runs);
};

describe("RegistryKind property floor", () => {
  roundTrips("RegistryKind", RegistryKind);
});

it.effect.prop("host formatting is idempotent and labels agree with registry classification",
  [Arbitrary.schema(S.Literals(["registry.npmjs.org", "npm.pkg.github.com", "npm.jsr.io", "registry.example.test"]))],
  ([host]) => Effect.sync(() => {
    const url = `https://${host}/packages/`;
    assert.strictEqual(registryHost(registryHost(url)), registryHost(url));
    assert.strictEqual(classifyRegistry(registryHost(url)), classifyRegistry(url));
    assert.strictEqual(registryShortLabel(url), registryShortLabel(registryHost(url)));
    const shortLabel = registryShortLabel(url);
    assert.strictEqual(registryShortLabel(shortLabel), shortLabel);
    assert.strictEqual(registryDisplayName(url), registryDisplayName(registryHost(url)));
    const displayName = registryDisplayName(url);
    assert.strictEqual(registryDisplayName(displayName), displayName);
  }), runs);
