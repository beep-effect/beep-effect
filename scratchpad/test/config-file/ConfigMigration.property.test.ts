import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
import { ConfigMigrationError } from "../../effected/config-file/ConfigMigration.ts";

const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(name + ": decoding an encoded value succeeds and recovers the value", [Arbitrary.schema(schema)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assert.isTrue(S.toEquivalence(schema)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }), runs);
};

describe("ConfigMigration schema properties", () => {
  roundTrips("ConfigMigrationError", ConfigMigrationError);
});

import { ConfigMigration } from "../../effected/config-file/ConfigMigration.ts";
import { JsonCodec } from "../../effected/config-file/JsonCodec.ts";

const Latest = S.Struct({ version: S.Literal(2), payload: S.Json });
const migrating = ConfigMigration.make({ codec: JsonCodec, migrations: [{ version: 2, name: "upgrade", up: Effect.succeed }] });

it.effect.prop("migration codec round-trips current documents and normalization is idempotent", [Arbitrary.schema(Latest)], ([value]) =>
  Effect.gen(function* () {
    const encoded = yield* migrating.stringify(value);
    const decoded = yield* S.decodeUnknownEffect(Latest)(yield* migrating.parse(encoded));
    assert.isTrue(S.toEquivalence(Latest)(decoded, value));
    assert.strictEqual(yield* migrating.stringify(yield* migrating.parse(encoded)), encoded);
  }), runs);

it.effect.prop("upgrading old documents preserves their payload and is stable on reparse", [Arbitrary.schema(S.Json)], ([payload]) =>
  Effect.gen(function* () {
    const old = yield* JsonCodec.stringify({ version: 1, payload });
    const parsed = yield* migrating.parse(old);
    assert.deepStrictEqual(parsed, { version: 2, payload });
    const formatted = yield* migrating.stringify(parsed);
    assert.deepStrictEqual(yield* migrating.parse(formatted), parsed);
    assert.strictEqual(yield* migrating.stringify(yield* migrating.parse(formatted)), formatted);
  }), runs);
