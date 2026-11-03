import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const runs = { arbitrary: fcRuns(100) };

import { ConfigMigrationError } from "@beep/config-file/ConfigMigration";

const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(
    `${name}: decoding an encoded value succeeds and recovers the value`,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeEffect(schema)(encoded);
        assert.isTrue(S.toEquivalence(schema)(decoded, value));
        const value1 = yield* S.encodeEffect(schema)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
};

describe("ConfigMigration schema properties", () => {
  roundTrips("ConfigMigrationError", ConfigMigrationError);
});

import { ConfigMigration } from "@beep/config-file/ConfigMigration";
import { JsonCodec } from "@beep/config-file/JsonCodec";

const Latest = S.Struct({ version: S.tag(2), payload: S.Json });
const Previous = S.Struct({ version: S.tag(1), payload: S.Json });
const migrating = ConfigMigration.make({
  codec: JsonCodec,
  migrations: [{ version: 2, name: "upgrade", up: Effect.succeed }],
});

it.effect.prop(
  "migration codec round-trips current documents and normalization is idempotent",
  [Arbitrary.schema(Latest)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* migrating.stringify(value);
      const argument = S.decodeUnknownEffect(Latest);
      const parsed1 = yield* migrating.parse(encoded);
      const decoded = yield* argument(parsed1);
      assert.isTrue(S.toEquivalence(Latest)(decoded, value));
      const parsed7 = yield* migrating.parse(encoded);
      const stringify2 = yield* migrating.stringify(parsed7);
      assert.strictEqual(stringify2, encoded);
    }),
  runs
);

it.effect.prop(
  "upgrading old documents preserves their payload and is stable on reparse",
  [Arbitrary.schema(S.Json)],
  ([payload]) =>
    Effect.gen(function* () {
      const old = yield* JsonCodec.stringify({ version: 1, payload });
      // Migration preserves the decoded document; JSON encoding normalizes -0 to 0.
      const argument1 = S.decodeUnknownEffect(Previous);
      const parsed2 = yield* JsonCodec.parse(old);
      const previous = yield* argument1(parsed2);
      const parsed = yield* migrating.parse(old);
      assert.deepStrictEqual(parsed, { version: 2, payload: previous.payload });
      const formatted = yield* migrating.stringify(parsed);
      const parsed3 = yield* migrating.parse(formatted);
      assert.deepStrictEqual(parsed3, parsed);
      const parsed8 = yield* migrating.parse(formatted);
      const stringify4 = yield* migrating.stringify(parsed8);
      assert.strictEqual(stringify4, formatted);
    }),
  runs
);

it.effect("upgrading preserves JSON-normalized negative zero in nested payloads", () =>
  Effect.gen(function* () {
    const old = yield* JsonCodec.stringify({ version: 1, payload: { scalar: -0, values: [-0] } });
    const parsed = yield* migrating.parse(old);
    assert.deepStrictEqual(parsed, { version: 2, payload: { scalar: 0, values: [0] } });
    const formatted = yield* migrating.stringify(parsed);
    const parsed5 = yield* migrating.parse(formatted);
    assert.deepStrictEqual(parsed5, parsed);
    const parsed9 = yield* migrating.parse(formatted);
    const stringify6 = yield* migrating.stringify(parsed9);
    assert.strictEqual(stringify6, formatted);
  })
);

it.effect("the failing step is carried on `migration`, so `name` and `String(error)` keep the error type", () =>
  Effect.gen(function* () {
    // Conformance shift (W3-e, D-24 precedent): the lab payload field `name`
    // shadowed `Error.name`, so logs printed the step name instead of the type.
    const error = ConfigMigrationError.make({ version: 2, migration: "add-b", phase: "apply", cause: "failure" });
    assert.strictEqual(error.migration, "add-b");
    assert.notStrictEqual(error.name, "add-b");
    assert.isFalse(Str.startsWith("add-b")(String(error)));
    const encoded = yield* S.encodeEffect(ConfigMigrationError)(error);
    assert.deepStrictEqual(A.sort(R.keys(encoded), Order.String), ["_tag", "cause", "migration", "phase", "version"]);
  })
);
