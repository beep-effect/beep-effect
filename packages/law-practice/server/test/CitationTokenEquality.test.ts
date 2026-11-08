import { makeCitationTokenObjects } from "@beep/law-practice-server/internal/Citation/TokenObjects";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import { deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import { readCitationTokenEquality } from "./CitationTokenEquality.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("builtin retained token equality", (it) => {
  it.effect(
    "matches all 1454 original class, field, Unicode and frozen edition comparisons",
    () =>
      Effect.gen(function* () {
        const corpus = yield* readCitationTokenEquality();
        const { limits } = yield* defaultCitationEnginePolicy;
        expect(R.keys(corpus.comparisonFields)).toHaveLength(9);
        expect(corpus.comparisonFields.Token).toEqual(["data", "start", "end"]);
        expect(corpus.comparisonFields.CitationToken).toEqual([
          "data",
          "start",
          "end",
          "exact_editions",
          "variation_editions",
          "short",
        ]);
        for (const batch of A.chunksOf(corpus.cases, 64)) {
          const objects = yield* makeCitationTokenObjects(limits, corpus.editionBindings);
          for (const row of batch) {
            const left = yield* objects.create(row.left);
            const right = yield* objects.create(row.right);
            const forward = yield* objects.equal(left, right);
            const reverse = yield* objects.equal(right, left);
            expect(forward, row.label).toBe(row.equal);
            expect(reverse, row.label).toBe(row.equal);
          }
        }
      }),
    { timeout: 60000 }
  );
  it.effect("observes current owned state after actual merge without changing equality into merge compatibility", () =>
    Effect.gen(function* () {
      const corpus = yield* readCitationTokenEquality();
      const { limits } = yield* defaultCitationEnginePolicy;
      for (const row of corpus.histories) {
        const objects = yield* makeCitationTokenObjects(limits, corpus.editionBindings);
        const left = yield* objects.create(row.left);
        const right = yield* objects.create(row.right);
        const before = yield* objects.equal(left, right);
        expect(before).toBe(row.before);
        if (row.outcome === "error") {
          const error = yield* objects.merge(left, right).pipe(Effect.flip);
          expect(error).toMatchObject({ reason: "host-failed" });
        } else {
          const merged = yield* objects.merge(left, right);
          deepStrictEqual(merged, row.outcome === "left" ? O.some(left) : O.none());
        }
        const after = yield* objects.equal(left, right);
        expect(after).toBe(row.after);
        const self = yield* objects.equal(left, left);
        expect(self).toBe(true);
        const missing = yield* objects.equal(left, 999).pipe(Effect.flip);
        expect(missing).toMatchObject({ reason: "host-failed" });
      }
    })
  );
});
