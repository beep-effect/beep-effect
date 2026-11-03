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
    it.effect("matches source membership across prefixes, overlaps, casing and native surrogate distinctions", () =>
      Effect.gen(function* () {
        const corpus = yield* loadCitationExtractorSelectionControls();
        const selector = yield* makeCitationExtractorSelection(
          (yield* defaultCitationEnginePolicy).limits,
          corpus.bindings
        );
        for (const row of corpus.cases) {
          const result = yield* selector.select(row.source);
          expect(result.indices, `case ${row.id}`).toEqual(row.selected);
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
        expect(yield* makeCitationExtractorSelection(limits, [binding, binding]).pipe(Effect.flip)).toMatchObject({
          reason: "invalid-bindings",
        });
        const selector = yield* makeCitationExtractorSelection(limits, [binding]);
        expect(yield* selector.select(native(""))).toEqual({ indices: [0], prefixQueries: 0, matchedKeys: 0 });
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
        expect((yield* selector.select(native("see"))).indices).toEqual([0]);
        expect((yield* selector.select(native("xxx"))).indices).toEqual([]);
        expect(
          yield* makeCitationExtractorSelection({ ...limits, patternUtf16: 2 }, [binding]).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "CitationSafetyLimitExceeded",
          limit: "patternUtf16",
        });
      })
    );
    it.effect("captures selection timing and cannot be disabled by the caller Clock", () =>
      Effect.gen(function* () {
        const timer = yield* makeCitationNativeManualClock(Duration.millis(997));
        const disabled = yield* makeCitationNativeSleepClock(() => Effect.never);
        const selector = yield* makeCitationExtractorSelection(
          { ...(yield* defaultCitationEnginePolicy).limits, extractDeadline: Duration.millis(997) },
          [{ id: 0, flags: 0, strings: [native("a")] }]
        ).pipe(Effect.provideService(Clock.Clock, timer.clock));
        const pending = yield* selector
          .select({ width: 1, bytes: new Uint8Array(65_536).fill(97) })
          .pipe(Effect.provideService(Clock.Clock, disabled), Effect.forkChild);
        yield* timer.trigger;
        expect(yield* Fiber.join(pending).pipe(Effect.flip)).toMatchObject({
          _tag: "CitationSafetyLimitExceeded",
          limit: "extractDeadline",
        });
      })
    );
  }
);
