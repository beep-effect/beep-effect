import { DelimiterRun, scanDelims } from "@beep/markdown/internal/inlines/emphasis";
import { assert, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { fakeScanner } from "./fakeScanner.ts";
import { describeConstructFloor, floorRuns } from "./propertyFloor.ts";

const Sample = S.Struct({
  marker: S.Literals(["*", "_", "**", "__", "***"]),
  content: S.Array(S.Literals(["a", "b", "é", "😀"])),
});
const sources = Arbitrary.schema(Sample).pipe(
  Arbitrary.map((sample) => `prefix ${sample.marker}x${A.join(sample.content, "")}y${sample.marker} suffix`)
);
describeConstructFloor({ name: "emphasis", sources });

it.effect.prop(
  "DelimiterRun decode(encode(x)) equals x and never fails",
  [Arbitrary.schema(DelimiterRun)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(DelimiterRun)(value);
      const decoded = yield* S.decodeEffect(DelimiterRun)(encoded);
      assertTrue(S.toEquivalence(DelimiterRun)(decoded, value));
      const value1 = yield* S.encodeEffect(DelimiterRun)(decoded);
      assert.deepStrictEqual(value1, encoded);
    }),
  floorRuns
);

it.effect.prop(
  "delimiter measurement is idempotent, restores the cursor, and preserves run length",
  [
    Arbitrary.schema(
      S.Struct({
        count: S.Int.check(S.isBetween({ minimum: 1, maximum: 40 })),
        marker: S.Literals(["*", "_"]),
        before: S.Literals(["", " ", "!", "😀"]),
        after: S.Literals(["a", "é", "😀"]),
      })
    ),
  ],
  ([sample]) =>
    Effect.sync(() => {
      const subject = `${sample.before}${Str.repeat(sample.count)(sample.marker)}${sample.after}`;
      const scanner = fakeScanner(subject);
      scanner.pos = sample.before.length;
      const once = scanDelims(scanner, sample.marker);
      assert.deepStrictEqual(scanDelims(sample.marker)(scanner), once);
      assert.strictEqual(scanner.pos, sample.before.length);
      assert.deepStrictEqual(
        once,
        O.some(
          DelimiterRun.make({
            numdelims: sample.count,
            canOpen: true,
            canClose: (sample.before === "!" || sample.before === "😀") && sample.after === "😀",
          })
        )
      );
    }),
  floorRuns
);
