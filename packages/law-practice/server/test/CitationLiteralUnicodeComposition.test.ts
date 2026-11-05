import {
  CitationCleanerRuntime,
  makeCitationCleanerPipeline,
} from "@beep/law-practice-server/internal/Citation/CleanerPipeline";
import {
  CitationPythonUnicodeStorage,
  makeCitationPythonHash,
} from "@beep/law-practice-server/internal/Citation/PythonHash";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import {
  makeCitationUnicodePipelineHarness as harness,
  loadCitationUnicodeHistories,
} from "./CitationUnicodePipeline.fixtures.ts";

const BudgetCase = S.Struct({
  budget: S.Natural.check(S.isBetween({ minimum: 1, maximum: 8 })),
  repetitions: S.Natural.check(S.isBetween({ minimum: 1, maximum: 5 })),
});

it.layer(Layer.merge(BunServices.layer, BunCrypto.layer))("lossless literal composition", (it) => {
  it.effect("preserves source points when raw-text cleaning joins two surrogate values", () =>
    Effect.gen(function* () {
      const owned = yield* harness(false);
      owned.selectText(["underscores"]);
      const result = yield* owned.pipeline.run({ text: "\ud83d__\ude00", plan: "raw-text-history" });
      const citationResult1 = yield* owned.values.getUnicode(result.value);
      const value = yield* Effect.fromOption(citationResult1);
      expect(value.text).toBe("😀");
      expect(value.pythonLength).toBe(2);
      expect(value.storage).toEqual({ width: 2, bytes: new Uint8Array([0x3d, 0xd8, 0, 0xde]) });
      const citationResult2 = yield* defaultCitationEnginePolicy;
      const hash = yield* makeCitationPythonHash(citationResult2.limits);
      const citationResult3 = yield* hash.unicode(value.storage);
      expect(citationResult3).toBe(BigInt("7910225535238332317"));
      const citationResult4 = yield* hash.text(value.text);
      expect(citationResult4).toBe(BigInt("-3536540696076613844"));
      expect(result.producedTextUtf16).toBe(2);
    })
  );
  it.effect.prop(
    "enforces schema-derived cumulative budgets and closes the real ledger",
    [BudgetCase],
    Effect.fnUntraced(function* ([input]) {
      const owned = yield* harness(false);
      owned.select(
        CitationPythonUnicodeStorage.make({ width: 2, bytes: new Uint8Array([0x3d, 0xd8, 95, 0, 95, 0, 0, 0xde]) }),
        A.makeBy(input.repetitions, () => "underscores")
      );
      const citationResult5 = yield* defaultCitationEnginePolicy;
      const pipeline = yield* makeCitationCleanerPipeline({
        ...citationResult5.limits,
        producedTextUtf16: input.budget,
      }).pipe(Effect.provideService(CitationCleanerRuntime, owned.runtime));
      const affordable = (input.budget - (input.budget % 2)) / 2;
      if (input.budget >= input.repetitions * 2) {
        const citationResult6 = yield* pipeline.run({ text: "", plan: "source-native-history" });
        expect(citationResult6.producedTextUtf16).toBe(input.repetitions * 2);
        const citationResult7 = yield* owned.references;
        expect(citationResult7).toHaveLength(input.repetitions + 1);
      } else {
        const citationResult8 = yield* Effect.flip(pipeline.run({ text: "", plan: "source-native-history" }));
        expect(citationResult8).toMatchObject({
          _tag: "CitationSafetyLimitExceeded",
          limit: "producedTextUtf16",
        });
        const citationResult9 = yield* owned.references;
        expect(citationResult9).toHaveLength(affordable + 1);
      }
      const citationResult10 = yield* owned.lastWork;
      const work = yield* Effect.fromOption(citationResult10);
      const snapshot = yield* work.snapshot;
      expect(snapshot.closed).toBe(true);
      // A failed stage may have reserved a prefix, but cannot publish a value.
      // The bound does not depend on how a producer partitions its slices.
      expect(snapshot.producedTextUtf16).toBeLessThanOrEqual(input.budget);
      expect(snapshot.producedTextUtf16).toBeGreaterThanOrEqual(Math.min(affordable, input.repetitions) * 2);
    }),
    { arbitrary: fcRuns(25) }
  );
  it.effect("matches every non-HTML source history through builtin dispatch and the real reservation ledger", () =>
    Effect.gen(function* () {
      const corpus = yield* loadCitationUnicodeHistories();
      const owned = yield* harness(false);
      const citationResult11 = yield* defaultCitationEnginePolicy;
      const hash = yield* makeCitationPythonHash(citationResult11.limits);
      let histories = 0;
      let snapshots = 0;
      let transitions = 0;
      yield* Effect.forEach(
        corpus.cases,
        Effect.fnUntraced(function* (row) {
          if (A.contains(row.steps, "html")) return;
          const first = A.getUnsafe(row.events, 0).value;
          const citationResult12 = yield* S.decodeEffect(S.Uint8ArrayFromHex)(first.nativeHex);
          owned.select(
            CitationPythonUnicodeStorage.make({
              width: first.width,
              bytes: citationResult12,
            }),
            row.steps
          );
          const result = yield* owned.pipeline.run({ text: "", plan: "source-native-history" });
          const refs = yield* owned.references;
          expect(refs, row.name).toHaveLength(row.events.length);
          for (let index = 0; index < refs.length; index++) {
            const ref = A.getUnsafe(refs, index);
            const expected = A.getUnsafe(row.events, index);
            const citationResult13 = yield* owned.values.getUnicode(ref);
            const value = yield* Effect.fromOption(citationResult13);
            expect(value.storage.width, row.name).toBe(expected.value.width);
            const citationResult14 = yield* S.decodeEffect(S.Uint8ArrayFromHex)(expected.value.nativeHex);
            expect(value.storage.bytes, row.name).toEqual(citationResult14);
            expect(value.pythonLength, row.name).toBe(expected.value.pythonLength);
            expect(value.utf16Units, row.name).toBe(expected.value.utf16Units);
            const citationResult15 = yield* hash.unicode(value.storage);
            expect(citationResult15, row.name).toBe(expected.value.hash);
            let sameAs = A.empty<number>();
            for (let prior = 0; prior < index; prior++)
              if (yield* owned.values.same(A.getUnsafe(refs, prior), ref)) sameAs = A.append(sameAs, prior);
            expect(sameAs, row.name).toEqual(expected.sameAs);
            snapshots++;
          }
          expect(result.producedTextUtf16, row.name).toBe(
            row.steps.length === 0
              ? first.utf16Units
              : A.reduce(A.drop(row.events, 1), 0, (sum, event) => sum + event.value.utf16Units)
          );
          histories++;
          transitions += row.steps.length;
        }),
        { concurrency: 1, discard: true }
      );
      expect(histories).toBe(1068);
      expect(snapshots).toBe(3852);
      expect(transitions).toBe(2784);
    })
  );

  it.effect("fails a shared budget before publishing the next literal result", () =>
    Effect.gen(function* () {
      const owned = yield* harness(false);
      owned.select(
        CitationPythonUnicodeStorage.make({ width: 2, bytes: new Uint8Array([0x3d, 0xd8, 95, 0, 95, 0, 0, 0xde]) }),
        ["underscores", "underscores"]
      );
      const citationResult16 = yield* defaultCitationEnginePolicy;
      const pipeline = yield* makeCitationCleanerPipeline({
        ...citationResult16.limits,
        producedTextUtf16: 2,
      }).pipe(Effect.provideService(CitationCleanerRuntime, owned.runtime));
      const citationResult17 = yield* Effect.flip(pipeline.run({ text: "", plan: "source-native-history" }));
      expect(citationResult17).toMatchObject({
        _tag: "CitationSafetyLimitExceeded",
        limit: "producedTextUtf16",
      });
      const citationResult18 = yield* owned.references;
      expect(citationResult18).toHaveLength(2);
      const citationResult19 = yield* owned.lastWork;
      const work = yield* Effect.fromOption(citationResult19);
      const citationResult20 = yield* work.snapshot;
      expect(citationResult20).toEqual({ producedTextUtf16: 2, closed: true });
    })
  );
});
