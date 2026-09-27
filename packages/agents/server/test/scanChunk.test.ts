import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
/**
 * Property test: the incremental block extractor must produce exactly the
 * envelope's elements regardless of how the structured-output text is chunked,
 * including strings containing braces, brackets, quotes, and escapes.
 */

import { initialScanState, scanChunk } from "@beep/agents-server/AssistantTurn";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import type { ScanState } from "@beep/agents-server/AssistantTurn";

const json = S.fromJsonString(S.Unknown);

const scanAll = (text: string, cuts: ReadonlyArray<number>): Array<string> => {
  const out: Array<string> = [];
  let state: ScanState = initialScanState;
  let position = 0;
  for (const cut of [...cuts, text.length]) {
    const end = Math.min(Math.max(cut, position), text.length);
    const [next, completed] = scanChunk(state, text.slice(position, end));
    state = next;
    out.push(...completed);
    position = end;
  }
  return out;
};

const nastyString = S.Literals(["a", "{", "}", "[", "]", '"', "\\", "\n", "🙂", ":"]).pipe(
  S.Array,
  Arbitrary.schema,
  Arbitrary.map(A.join(""))
);
const block = Arbitrary.all({
  type: Arbitrary.schema(S.Literals(["paragraph", "code", "mermaid", "table", "youtube"])),
  text: nastyString,
  nested: Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 0, maximum: 2 }))).pipe(
    Arbitrary.flatMap((count) => Arbitrary.all(A.replicate(Arbitrary.all({ text: nastyString }), count)))
  ),
});

describe("scanChunk", () => {
  it.effect.prop(
    "any envelope x any chunking yields exactly the elements",
    {
      blocks: Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 0, maximum: 5 }))).pipe(
        Arbitrary.flatMap((count) => Arbitrary.all(A.replicate(block, count)))
      ),
      rawCuts: Arbitrary.schema(
        S.Array(S.Int.check(S.isBetween({ minimum: 0, maximum: 2000 }))).check(S.isMaxLength(30))
      ),
    },
    ({ blocks, rawCuts }) =>
      Effect.gen(function* () {
        const envelope = yield* S.encodeEffect(json)({ blocks });
        const cuts = [...rawCuts].sort((a, b) => a - b);
        const slices = scanAll(envelope, cuts);
        expect(slices.length).toBe(blocks.length);
        yield* Effect.forEach(
          slices,
          (slice, index) =>
            S.decodeEffect(json)(slice).pipe(
              Effect.tap((value) =>
                Effect.sync(() => {
                  expect(value).toEqual(blocks[index]);
                })
              )
            ),
          { concurrency: 1 }
        );
      }),
    { arbitrary: fcRuns(200) }
  );

  it("single-character chunking", () => {
    const blocks = [{ type: "code", code: 'if (a["}{"]) { return "\\"]}" }' }];
    const envelope = Result.getOrThrow(S.encodeResult(json)({ blocks }));
    const slices = scanAll(
      envelope,
      Array.from({ length: envelope.length }, (_, i) => i)
    );
    expect(slices.map((s) => Result.getOrThrow(S.decodeResult(json)(s)))).toEqual(blocks);
  });
});
