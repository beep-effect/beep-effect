import { makeCitationPythonRepr } from "@beep/law-practice-server/internal/Citation/PythonRepr";
import { makeCitationTextBudget } from "@beep/law-practice-server/internal/Citation/TextBudget";
import { CitationTextBudget } from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect } from "@effect/vitest";
import * as Clock from "effect/Clock";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import {
  authenticateCitationRenderingProducer,
  readCitationNativeRenderingAsset,
} from "./CitationNativeRendering.fixtures.ts";
import { makeCitationNativeSleepClock } from "./CitationNativeSpawner.fixtures.ts";
import { readCitationOracleFixture } from "./CitationRegexWorker.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const Native = S.Struct({ width: S.Literals([1, 2, 4]), hex: S.Uint8ArrayFromHex });
const Corpus = S.Struct({
  license: S.tag("PSF-2.0"),
  python: S.tag("3.11.15"),
  unicode: S.tag("14.0.0"),
  producerSha256: S.String,
  tableSha256: S.tag("7cadfc9b8203c031be8f1460ce19e4f10b1e5d04f65a5041a62ca6afd9cf0719"),
  cases: S.Array(S.Struct({ input: Native, output: Native })).check(S.isBetweenLength(3113, 3113)),
}).pipe(S.fromJsonString);
const table = readCitationNativeRenderingAsset("python-printability");

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true })(
  "native Python string repr",
  (it) => {
    it.effect(
      "matches all 3113 independent CPython cases across printability boundaries and native surrogate points",
      () =>
        Effect.gen(function* () {
          const policy = yield* defaultCitationEnginePolicy;
          const raw = yield* table;
          const repr = yield* makeCitationPythonRepr(policy.limits, raw);
          const corpusText = yield* readCitationOracleFixture(
            "python-repr-cases",
            "078f625b97d636e72ce566a836db5e1e3726b4222ef71edb79b57faa53e88ed5"
          );
          const corpus = yield* S.decodeEffect(Corpus)(corpusText);
          yield* authenticateCitationRenderingProducer("probe-python-repr.py", corpus.producerSha256);
          for (const [i, row] of corpus.cases.entries()) {
            const actual = yield* repr.text({ width: row.input.width, bytes: row.input.hex });
            expect(actual, `native repr case ${i}`).toEqual({ width: row.output.width, bytes: row.output.hex });
          }
        }),
      { timeout: 60000 }
    );
    it.effect(
      "rejects corrupt tables and invalid native layouts, and refuses expansion before returning partial output",
      () =>
        Effect.gen(function* () {
          const policy = yield* defaultCitationEnginePolicy;
          const raw = yield* table;
          for (const corrupt of [null, "{}", `${raw} `]) {
            const error = yield* makeCitationPythonRepr(policy.limits, corrupt).pipe(Effect.flip);
            expect(error).toMatchObject({ reason: "invalid-table" });
            expect("cause" in error).toBe(false);
          }
          const repr = yield* makeCitationPythonRepr(policy.limits, raw);
          for (const input of [
            { width: 3, bytes: new Uint8Array() },
            { width: 2, bytes: new Uint8Array([65]) },
            { width: 4, bytes: new Uint8Array([0, 0, 17, 0]) },
          ]) {
            const error = yield* repr.text(input).pipe(Effect.flip);
            expect(error).toMatchObject({ reason: "invalid-input" });
          }
          const small = yield* makeCitationPythonRepr({ ...policy.limits, producedTextUtf16: 8 }, raw);
          const refused = yield* small.text({ width: 1, bytes: new Uint8Array([0, 0, 0]) }).pipe(Effect.flip);
          expect(refused).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "producedTextUtf16" });
          const recovered = yield* small.text({ width: 1, bytes: new Uint8Array() });
          expect(recovered).toEqual({ width: 1, bytes: new Uint8Array([39, 39]) });
        })
    );
    it.effect("refuses an invalid policy or oversized budget and keeps long text whole across chunks", () =>
      Effect.gen(function* () {
        const policy = yield* defaultCitationEnginePolicy;
        const raw = yield* table;
        const refused = yield* makeCitationPythonRepr({}, raw).pipe(Effect.flip);
        expect(refused).toMatchObject({ reason: "invalid-policy" });
        const repr = yield* makeCitationPythonRepr(policy.limits, raw);
        // Longer than one assembly chunk (1024) and one cooperative yield interval (4096).
        const bytes = new Uint8Array(5000).fill(97);
        const output = yield* repr.text({ width: 1, bytes });
        expect(new TextDecoder().decode(output.bytes)).toBe(`'${new TextDecoder().decode(bytes)}'`);
        const larger = yield* makeCitationTextBudget(policy.limits);
        const oversized = yield* makeCitationPythonRepr({ ...policy.limits, producedTextUtf16: 1 }, raw).pipe(
          Effect.provideService(CitationTextBudget, larger),
          Effect.flip
        );
        expect(oversized).toMatchObject({ reason: "invalid-policy" });
      })
    );
    it.effect("retains the captured shared text budget when the caller supplies a replacement", () =>
      Effect.gen(function* () {
        const policy = yield* defaultCitationEnginePolicy;
        const raw = yield* table;
        const limits = { ...policy.limits, producedTextUtf16: 12 };
        const captured = yield* makeCitationTextBudget(limits);
        const replacement = yield* makeCitationTextBudget(limits);
        const repr = yield* makeCitationPythonRepr(limits, raw).pipe(
          Effect.provideService(CitationTextBudget, captured)
        );
        yield* repr.text({ width: 1, bytes: new Uint8Array([65]) });
        const refused = yield* repr
          .text({ width: 1, bytes: new Uint8Array() })
          .pipe(Effect.provideService(CitationTextBudget, replacement), Effect.flip);
        expect(refused).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "producedTextUtf16" });
        const usedReplacement = yield* replacement.snapshot;
        expect(usedReplacement).toBe(0);
      })
    );
    it.effect("retains the installed clock and interrupts cooperative repr without returning partial text", () =>
      Effect.gen(function* () {
        const entered = yield* Deferred.make<number>();
        const wake = yield* Deferred.make<void>();
        const policy = yield* defaultCitationEnginePolicy;
        const raw = yield* table;
        const controlled = yield* makeCitationNativeSleepClock((duration) =>
          Deferred.succeed(entered, Duration.toMillis(duration)).pipe(Effect.andThen(Deferred.await(wake)))
        );
        const replacement = yield* makeCitationNativeSleepClock(() => Effect.never);
        const repr = yield* makeCitationPythonRepr(
          { ...policy.limits, extractDeadline: Duration.seconds(1) },
          raw
        ).pipe(Effect.provideService(Clock.Clock, controlled));
        const running = yield* repr
          .text({ width: 1, bytes: new Uint8Array(200000) })
          .pipe(Effect.provideService(Clock.Clock, replacement), Effect.forkChild);
        const requested = yield* Deferred.await(entered);
        expect(requested).toBe(1000);
        yield* Deferred.succeed(wake, undefined);
        const error = yield* Fiber.join(running).pipe(Effect.flip);
        expect(error).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "extractDeadline" });
      })
    );
  }
);
