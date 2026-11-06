import { makeCitationRegexInput } from "@beep/law-practice-server/internal/Citation/RegexInput";
import {
  CitationRegexCapturedRange,
  makeCitationRegexResult,
} from "@beep/law-practice-server/internal/Citation/RegexResult";
import { CitationRegexWorkerFailure } from "@beep/law-practice-server/internal/Citation/RegexWorkerProtocol";
import {
  CitationTokenCaptureRuntime,
  makeCitationTokenCapture,
} from "@beep/law-practice-server/internal/Citation/TokenCapture";
import { makeCitationTokenObjects } from "@beep/law-practice-server/internal/Citation/TokenObjects";
import { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as R from "effect/Record";
import { loadCitationTokenObjectsControls } from "./CitationTokenObjects.fixtures.ts";
import type { CitationTokenCaptureObservation } from "./CitationTokenObjects.fixtures.ts";

const allow = Effect.fn("CaptureTest.allow")(() => Effect.void);
const prepare = Effect.fn("CaptureTest.prepareFrame")(function* (row: typeof CitationTokenCaptureObservation.Type) {
  const limits = (yield* defaultCitationEnginePolicy).limits;
  const input = yield* makeCitationRegexInput(limits);
  const source = yield* input.prepareUnicode(row.source, allow);
  const codec = yield* makeCitationRegexResult(limits, row.bindings.groups, source.layout.pythonLength);
  let pulls = 0;
  const frame = yield* codec.collect(
    Effect.sync(() =>
      ++pulls === 1 ? O.some(A.map(row.captures, (range) => (range === null ? undefined : range))) : O.none()
    )
  );
  return { source, result: yield* codec.decode(frame) };
});
it.layer(Layer.merge(BunFileSystem.layer, BunCrypto.layerDigest), { excludeTestServices: true })(
  "native capture construction",
  (it) => {
    it.effect("constructs every source token directly from decoded frame spans and preserves named ordinal order", () =>
      Effect.gen(function* () {
        const controls = yield* loadCitationTokenObjectsControls();
        const limits = (yield* defaultCitationEnginePolicy).limits;
        for (const row of controls.constructors) {
          const objects = yield* makeCitationTokenObjects(limits, controls.editionBindings);
          const operands = yield* prepare(row);
          const binding = yield* makeCitationTokenCapture(limits, row.bindings).pipe(
            Effect.provideService(
              CitationTokenCaptureRuntime,
              CitationTokenCaptureRuntime.of({ ...operands, construct: objects.constructFrom, beforeAllocate: allow })
            )
          );
          const id = yield* binding.build(0, { kind: row.input.kind, offset: row.offset });
          const snapshot = yield* objects.snapshot(id);
          expect(snapshot, `case ${row.id}`).toEqual(row.expected);
          expect(R.keys(snapshot.groups)).toEqual(row.groupOrder);
        }
        for (const row of controls.extras) {
          const objects = yield* makeCitationTokenObjects(limits, controls.editionBindings);
          const operands = yield* prepare(row);
          const binding = yield* makeCitationTokenCapture(limits, row.bindings).pipe(
            Effect.provideService(
              CitationTokenCaptureRuntime,
              CitationTokenCaptureRuntime.of({ ...operands, construct: objects.constructFrom, beforeAllocate: allow })
            )
          );
          const citationResult1 = yield* binding.build(0, row.recipe);
          const citationResult2 = yield* objects.snapshot(citationResult1);
          expect(citationResult2).toEqual(row.expected);
        }
        for (const row of controls.errors) {
          const objects = yield* makeCitationTokenObjects(limits, controls.editionBindings);
          const operands = yield* prepare(row);
          const binding = yield* makeCitationTokenCapture(limits, row.bindings).pipe(
            Effect.provideService(
              CitationTokenCaptureRuntime,
              CitationTokenCaptureRuntime.of({ ...operands, construct: objects.constructFrom, beforeAllocate: allow })
            )
          );
          const citationResult3 = yield* binding.build(0, row.recipe).pipe(Effect.flip);
          expect(citationResult3).toMatchObject({ reason: row.reason });
          const citationResult4 = yield* objects.snapshot(0).pipe(Effect.flip);
          expect(citationResult4).toMatchObject({ reason: "host-failed" });
        }
      })
    );
    it.effect("rejects malformed capture requests and damaged transport frames before storing a token", () =>
      Effect.gen(function* () {
        const controls = yield* loadCitationTokenObjectsControls();
        const row = A.getUnsafe(controls.constructors, 0);
        const limits = (yield* defaultCitationEnginePolicy).limits;
        const objects = yield* makeCitationTokenObjects(limits, controls.editionBindings);
        const operands = yield* prepare(row);
        const runtime = CitationTokenCaptureRuntime.of({
          ...operands,
          construct: objects.constructFrom,
          beforeAllocate: allow,
        });
        const invalidPolicy = yield* makeCitationTokenCapture(null, row.bindings).pipe(
          Effect.provideService(CitationTokenCaptureRuntime, runtime),
          Effect.flip
        );
        expect(invalidPolicy).toMatchObject({ reason: "invalid-input" });
        const invalidMetadata = yield* makeCitationTokenCapture(limits, row.bindings).pipe(
          Effect.provideService(CitationTokenCaptureRuntime, {
            ...runtime,
            result: { ...runtime.result, matches: -1 },
          }),
          Effect.flip
        );
        expect(invalidMetadata).toMatchObject({ reason: "invalid-bindings" });
        const capture = yield* makeCitationTokenCapture(limits, row.bindings).pipe(
          Effect.provideService(CitationTokenCaptureRuntime, runtime)
        );
        const invalidMatch = yield* capture.build(-1, { kind: "Token" }).pipe(Effect.flip);
        expect(invalidMatch).toMatchObject({ reason: "invalid-input" });
        const invalidRecipe = yield* capture.build(0, null).pipe(Effect.flip);
        expect(invalidRecipe).toMatchObject({ reason: "invalid-input" });
        const corrupt = CitationTokenCaptureRuntime.of({
          ...runtime,
          result: {
            ...runtime.result,
            capture: () => Effect.fail(CitationRegexWorkerFailure.make({ reason: "invalid-frame" })),
          },
        });
        const broken = yield* makeCitationTokenCapture(limits, row.bindings).pipe(
          Effect.provideService(CitationTokenCaptureRuntime, corrupt)
        );
        const invalidFrame = yield* broken.build(0, { kind: "Token" }).pipe(Effect.flip);
        expect(invalidFrame).toMatchObject({ reason: "invalid-frame" });
        const outOfBounds = yield* makeCitationTokenCapture(limits, row.bindings).pipe(
          Effect.provideService(CitationTokenCaptureRuntime, {
            ...runtime,
            result: {
              ...runtime.result,
              capture: () => Effect.succeed(CitationRegexCapturedRange.make({ start: 999999, end: 1000000 })),
            },
          })
        );
        const invalidRange = yield* outOfBounds.build(0, { kind: "Token" }).pipe(Effect.flip);
        expect(invalidRange).toMatchObject({ reason: "invalid-frame" });
        const absent = yield* objects.snapshot(0).pipe(Effect.flip);
        expect(absent).toMatchObject({ reason: "host-failed" });
      })
    );
    it.effect("preflights every native field against stable store capacity and propagates external refusal", () =>
      Effect.gen(function* () {
        const controls = yield* loadCitationTokenObjectsControls();
        const row = A.getUnsafe(controls.constructors, 0);
        const operands = yield* prepare(row);
        const limits = { ...(yield* defaultCitationEnginePolicy).limits, producedTextUtf16: 1 };
        const objects = yield* makeCitationTokenObjects(limits, controls.editionBindings);
        let approvals = 0;
        const approve = Effect.fn("CaptureTest.approve")(() =>
          Effect.sync(() => {
            approvals++;
          })
        );
        const runtime = CitationTokenCaptureRuntime.of({
          ...operands,
          construct: objects.constructFrom,
          beforeAllocate: approve,
        });
        const binding = yield* makeCitationTokenCapture(limits, row.bindings).pipe(
          Effect.provideService(CitationTokenCaptureRuntime, runtime)
        );
        const citationResult5 = yield* binding.build(0, { kind: "Token" }).pipe(Effect.flip);
        expect(citationResult5).toMatchObject({
          limit: "producedTextUtf16",
        });
        expect(approvals).toBe(1);
        const citationResult6 = yield* objects.snapshot(0).pipe(Effect.flip);
        expect(citationResult6).toMatchObject({ reason: "host-failed" });
        const denied = CitationSafetyLimitExceeded.make({ operation: "extract", limit: "producedTextUtf16" });
        const refuse = Effect.fn("CaptureTest.refuse")(() => Effect.fail(denied));
        const larger = { ...limits, producedTextUtf16: 100 };
        const permitted = yield* makeCitationTokenObjects(larger, controls.editionBindings);
        const rejected = yield* makeCitationTokenCapture(larger, row.bindings).pipe(
          Effect.provideService(
            CitationTokenCaptureRuntime,
            CitationTokenCaptureRuntime.of({ ...operands, construct: permitted.constructFrom, beforeAllocate: refuse })
          )
        );
        const citationResult7 = yield* rejected.build(0, { kind: "Token" }).pipe(Effect.flip);
        expect(citationResult7).toBe(denied);
        const single = yield* makeCitationTokenObjects({ ...larger, candidates: 1 }, controls.editionBindings);
        approvals = 0;
        const parallel = yield* makeCitationTokenCapture(larger, row.bindings).pipe(
          Effect.provideService(
            CitationTokenCaptureRuntime,
            CitationTokenCaptureRuntime.of({ ...operands, construct: single.constructFrom, beforeAllocate: approve })
          )
        );
        const [passes, failures] = yield* Effect.partition([0, 1], () => parallel.build(0, { kind: "Token" }), {
          concurrency: 2,
        });
        expect(passes).toEqual([0]);
        expect(failures).toHaveLength(1);
        expect(A.getUnsafe(failures, 0)).toMatchObject({ limit: "candidates" });
        expect(approvals).toBe(2);
        const citationResult8 = yield* makeCitationTokenCapture(limits, { groups: 1, names: { a: 1, b: 1 } }).pipe(
          Effect.provideService(CitationTokenCaptureRuntime, runtime),
          Effect.flip
        );
        expect(citationResult8).toMatchObject({ reason: "invalid-bindings" });
      })
    );
  }
);
