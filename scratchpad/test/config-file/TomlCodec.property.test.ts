import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { TomlCodec } from "../../effected/config-file/TomlCodec.ts";

const runs = { arbitrary: fcRuns(100) };
// TOML documents are tables and cannot represent null. Include nested tables,
// scalar arrays and arrays of tables within its representable value domain.
const Integer = S.Int.check(S.isBetween({ minimum: -1_000_000, maximum: 1_000_000 }));
const Section = S.Struct({ label: S.String, count: Integer, enabled: S.Boolean });
const Document = S.Struct({
  title: S.String,
  count: Integer,
  enabled: S.Boolean,
  tags: S.Array(S.String),
  numbers: S.Array(Integer),
  section: Section,
  workers: S.Array(Section),
});
const equivalent = S.toEquivalence(Document);

describe("TomlCodec property floor", () => {
  it.effect.prop("decodes encoded TOML tables without failure and recovers all fields", [Arbitrary.schema(Document)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* TomlCodec.stringify(value);
      const decoded = yield* S.decodeUnknownEffect(Document)(yield* TomlCodec.parse(encoded));
      assert.isTrue(equivalent(decoded, value));
    }), runs);

  it.effect.prop("parse/stringify fidelity and normalization idempotence hold with TOML comments", [Arbitrary.schema(Document)], ([value]) =>
    Effect.gen(function* () {
      const input = `# leading comment\n${yield* TomlCodec.stringify(value)}\n# trailing comment\n`;
      const parsed = yield* TomlCodec.parse(input);
      const formatted = yield* TomlCodec.stringify(parsed);
      const reparsed = yield* TomlCodec.parse(formatted);
      assert.deepStrictEqual(reparsed, parsed);
      assert.strictEqual(yield* TomlCodec.stringify(reparsed), formatted);
      assert.isTrue(equivalent(yield* S.decodeUnknownEffect(Document)(reparsed), value));
    }), runs);
});
