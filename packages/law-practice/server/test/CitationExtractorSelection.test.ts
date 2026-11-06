import { makeCitationExtractorSelection } from "@beep/law-practice-server/internal/Citation/ExtractorSelection";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "@effect/vitest";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import { loadCitationExtractorSelectionControls } from "./CitationExtractorSelection.fixtures.ts";
import { makeCitationNativeManualClock, makeCitationNativeSleepClock } from "./CitationNativeSpawner.fixtures.ts";

const native = (text: string) => ({ width: 1, bytes: new TextEncoder().encode(text) });

it.layer(Layer.merge(BunServices.layer, BunCrypto.layerDigest), { excludeTestServices: true })(
  "extractor selection",
  (it) => {
    it.effect("refuses malformed bindings and native points before selection", () =>
      Effect.gen(function* () {
        const limits = (yield* defaultCitationEnginePolicy).limits;
        const invalidPoint = { width: 4, bytes: new Uint8Array([0, 0, 17, 0]) };
        for (const bindings of [{}, [{ id: 0, flags: 0, strings: [invalidPoint] }]]) {
          const failed = yield* makeCitationExtractorSelection(limits, bindings).pipe(Effect.flip);
          expect(failed).toMatchObject({ reason: "invalid-bindings" });
        }
        const selector = yield* makeCitationExtractorSelection(limits, []);
        const invalidSource = yield* selector.select(invalidPoint).pipe(Effect.flip);
        expect(invalidSource).toMatchObject({ reason: "invalid-input" });
        const limited = yield* makeCitationExtractorSelection({ ...limits, patterns: 1 }, [
          { id: 0, flags: 0, strings: [] },
          { id: 1, flags: 0, strings: [] },
        ]).pipe(Effect.flip);
        expect(limited).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "patterns" });
      })
    );
    it.effect("matches source membership across prefixes, overlaps, casing and native surrogate distinctions", () =>
      Effect.gen(function* () {
        const corpus = yield* loadCitationExtractorSelectionControls();
        const citationResult1 = yield* defaultCitationEnginePolicy;
        const selector = yield* makeCitationExtractorSelection(citationResult1.limits, corpus.bindings);
        for (const row of corpus.cases) {
          const result = yield* selector.select(row.source);
          expect(result.indices, `case ${row.id}`).toEqual(row.selected);
          expect(result.insertions, `case ${row.id}`).toEqual(row.insertions);
          expect(result.matchedKeys).toBeLessThanOrEqual(20);
          // Two source scans, at most one extra prefix lookup per newly seen key;
          // lowercase may expand dotted I but these controls stay below 2x points.
          expect(result.prefixQueries).toBeLessThanOrEqual(
            (3 * row.source.bytes.length) / row.source.width + result.matchedKeys
          );
        }
      })
    );
    it.effect("rejects duplicate indices and retains unfiltered membership on empty input", () =>
      Effect.gen(function* () {
        const limits = (yield* defaultCitationEnginePolicy).limits;
        const binding = { id: 0, flags: 0, strings: [] };
        const citationResult2 = yield* makeCitationExtractorSelection(limits, [binding, binding]).pipe(Effect.flip);
        expect(citationResult2).toMatchObject({
          reason: "invalid-bindings",
        });
        const selector = yield* makeCitationExtractorSelection(limits, [binding]);
        const citationResult3 = yield* selector.select(native(""));
        expect(citationResult3).toEqual({
          indices: [0],
          insertions: [],
          prefixQueries: 0,
          matchedKeys: 0,
        });
      })
    );
    it.effect("snapshots installed native strings and checks metadata before copying", () =>
      Effect.gen(function* () {
        const limits = (yield* defaultCitationEnginePolicy).limits;
        const key = native("see");
        const binding = { id: 0, flags: 0, strings: [key] };
        const selector = yield* makeCitationExtractorSelection(limits, [binding]);
        key.bytes.fill(120);
        binding.id = 1;
        const citationResult4 = yield* selector.select(native("see"));
        expect(citationResult4.indices).toEqual([0]);
        const citationResult5 = yield* selector.select(native("xxx"));
        expect(citationResult5.indices).toEqual([]);
        const citationResult6 = yield* makeCitationExtractorSelection({ ...limits, patternUtf16: 2 }, [binding]).pipe(
          Effect.flip
        );
        expect(citationResult6).toMatchObject({
          _tag: "CitationSafetyLimitExceeded",
          limit: "patternUtf16",
        });
      })
    );
    it.effect("captures selection timing and cannot be disabled by the caller Clock", () =>
      Effect.gen(function* () {
        const timer = yield* makeCitationNativeManualClock(Duration.millis(997));
        const disabled = yield* makeCitationNativeSleepClock(() => Effect.never);
        const citationResult7 = yield* defaultCitationEnginePolicy;
        const selector = yield* makeCitationExtractorSelection(
          { ...citationResult7.limits, extractDeadline: Duration.millis(997) },
          [{ id: 0, flags: 0, strings: [native("a")] }]
        ).pipe(Effect.provideService(Clock.Clock, timer.clock));
        const pending = yield* selector
          .select({ width: 1, bytes: new Uint8Array(65_536).fill(97) })
          .pipe(Effect.provideService(Clock.Clock, disabled), Effect.forkChild);
        yield* timer.trigger;
        const citationResult8 = yield* Fiber.join(pending).pipe(Effect.flip);
        expect(citationResult8).toMatchObject({
          _tag: "CitationSafetyLimitExceeded",
          limit: "extractDeadline",
        });
      })
    );
  }
);

it.effect("rejects malformed policy with a closed failure before installing operations", () =>
  Effect.gen(function* () {
    for (const policy of [null, {}, { sourceUtf16: 0 }]) {
      const failure = yield* makeCitationExtractorSelection(policy, []).pipe(Effect.flip);
      expect(failure).toMatchObject({ reason: "invalid-policy" });
      expect("cause" in failure).toBe(false);
    }
  })
);
