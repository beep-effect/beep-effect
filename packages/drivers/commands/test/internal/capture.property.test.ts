import { collectBounded, OutputTooLarge } from "@beep/commands/internal/capture";
import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";

const runs = { arbitrary: fcRuns(100) };
const encoder = new TextEncoder();

// Single-byte chunks put boundaries inside every multibyte UTF-8 character.
const byteChunks = (bytes: Uint8Array): ReadonlyArray<Uint8Array> =>
  A.map(A.fromIterable(bytes), (byte) => Uint8Array.of(byte));

describe("capture property floor", () => {
  it.effect.prop(
    "OutputTooLarge: encode/decode preserves the limit and decoding never fails",
    [Arbitrary.schema(OutputTooLarge)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(OutputTooLarge)(value);
        const decoded = yield* S.decodeEffect(OutputTooLarge)(encoded);
        assertTrue(S.toEquivalence(OutputTooLarge)(decoded, value));
        const value1 = yield* S.encodeEffect(OutputTooLarge)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );

  it.effect.prop(
    "bounded decoding preserves UTF-8 fidelity across byte boundaries and BOM-framed re-encoding",
    [Arbitrary.schema(S.String)],
    ([text]) =>
      Effect.gen(function* () {
        const bytes = encoder.encode(text);
        // TextEncoder replaces unpaired surrogates; TextDecoder consumes a leading BOM.
        const expected = new TextDecoder().decode(bytes);
        const parsed = yield* collectBounded(Stream.fromIterable(byteChunks(bytes)), bytes.length);
        assert.strictEqual(parsed, expected);
        // Restore the consumed transport BOM so a payload BOM stays payload.
        const rendered = encoder.encode(`\uFEFF${parsed}`);
        const reparsed = yield* collectBounded(Stream.make(rendered), rendered.length);
        assert.strictEqual(reparsed, parsed);
        const value2 = yield* collectBounded(rendered.length)(Stream.make(rendered));
        assert.strictEqual(value2, parsed);
      }),
    runs
  );

  it.effect.prop(
    "cumulative raw byte budgets fail on the first excess byte without pulling the tail",
    [S.Int.check(S.isBetween({ minimum: 0, maximum: 255 })).pipe(S.Array, Arbitrary.schema)],
    ([prefix]) =>
      Effect.gen(function* () {
        const pulled = yield* Ref.make(0);
        const chunks = [...A.map(prefix, (byte) => Uint8Array.of(byte)), Uint8Array.of(65), Uint8Array.of(66)];
        const stream = Stream.fromIterable(chunks).pipe(
          Stream.mapEffect((chunk) =>
            Effect.as(
              Ref.update(pulled, (count) => count + 1),
              chunk
            )
          )
        );
        const error = yield* Effect.flip(collectBounded(stream, prefix.length));
        assert.instanceOf(error, OutputTooLarge);
        assert.deepStrictEqual(error, OutputTooLarge.make({ limit: prefix.length }));
        const got = yield* Ref.get(pulled);
        assert.strictEqual(got, prefix.length + 1);
      }),
    runs
  );

  it.effect.prop(
    "empty chunks preserve text and do not spend any byte budget",
    [Arbitrary.schema(S.String)],
    ([text]) =>
      Effect.gen(function* () {
        const bytes = encoder.encode(text);
        const chunks = [new Uint8Array(), ...byteChunks(bytes), new Uint8Array()];
        const collectBounded3 = yield* collectBounded(Stream.fromIterable(chunks), bytes.length);
        assert.strictEqual(collectBounded3, new TextDecoder().decode(bytes));
      }),
    runs
  );
});
