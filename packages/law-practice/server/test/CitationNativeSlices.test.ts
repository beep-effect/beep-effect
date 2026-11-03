import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationPythonSliceLayout } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import { makeCitationRegexInput } from "@beep/law-practice-server/internal/Citation/RegexInput";
import { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as Clock from "effect/Clock";
import * as Digest from "effect/crypto/Digest";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { makeCitationNativeManualClock, makeCitationNativeSleepClock } from "./CitationNativeSpawner.fixtures.ts";

const $I = $LawPracticeServerId.create("test/CitationNativeSlices");
const Native = S.Struct({ width: S.Literals([1, 2, 4]), bytes: S.Uint8ArrayFromHex });
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-native-slices/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    python: S.tag("3.11.15"),
    producerSha256: S.tag("36f005738a602418c5cf782154f523d5e10e07bcceb79fe265e3929d0d875895"),
    rangeSourceSha256: S.tag("f50330d18ec0566fb7ebd04add831da401ade8f054a5aef0ffc88c321721508a"),
    cases: S.Array(
      S.Struct({
        id: S.Natural,
        source: Native,
        start: S.Natural,
        end: S.Natural,
        expected: Native,
        layout: S.toType(CitationPythonSliceLayout),
      })
    ).check(S.isBetweenLength(137, 137)),
  })
).pipe($I.annoteSchema("Corpus", { description: "Pinned Python compact substring words and preallocation layouts." }));
const allow = Effect.fn("SliceTest.allow")(() => Effect.void);
it.layer(Layer.merge(BunFileSystem.layer, BunCrypto.layerDigest), { excludeTestServices: true })(
  "native substrings",
  (it) => {
    it.effect("matches every source substring and exact layout before returning independent bytes", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const digest = yield* Digest.Digest;
        const bytes = yield* fs.readFile(
          NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/native-slices.json", import.meta.url))
        );
        expect(yield* digest.digestHex(Digest.sha256, bytes)).toBe(
          "8c2e33785c8f38fd84875570f6e293c4e573384926e9bc7ba58b1ce8baccdec3"
        );
        const controls = yield* S.decodeEffect(Corpus)(new TextDecoder().decode(bytes));
        const input = yield* makeCitationRegexInput((yield* defaultCitationEnginePolicy).limits);
        for (const row of controls.cases) {
          const source = yield* input.prepareUnicode(row.source, allow);
          let calls = 0;
          const result = yield* source.slice(
            row,
            Effect.fn("SliceTest.checkLayout")((layout) =>
              Effect.sync(() => {
                calls++;
                expect(layout).toEqual(row.layout);
              })
            )
          );
          expect(calls).toBe(1);
          expect(result, `case ${row.id}`).toEqual(row.expected);
          result.bytes.fill(255);
          expect(yield* source.slice(row, allow)).toEqual(row.expected);
        }
      })
    );
    it.effect("rejects invalid bounds and preserves an allocation refusal without yielding a payload", () =>
      Effect.gen(function* () {
        const input = yield* makeCitationRegexInput((yield* defaultCitationEnginePolicy).limits);
        const source = yield* input.prepareText("abc", allow);
        const denied = CitationSafetyLimitExceeded.make({ operation: "extract", limit: "producedTextUtf16" });
        let calls = 0;
        const refuse = Effect.fn("SliceTest.refuse")(() =>
          Effect.sync(() => {
            calls++;
          }).pipe(Effect.andThen(Effect.fail(denied)))
        );
        for (const range of [
          { start: -1, end: 0 },
          { start: 0, end: 4 },
          { start: 2, end: 1 },
        ]) {
          expect(yield* source.slice(range, refuse).pipe(Effect.flip)).toMatchObject({ reason: "invalid-range" });
        }
        expect(calls).toBe(0);
        expect(yield* source.slice({ start: 0, end: 3 }, refuse).pipe(Effect.flip)).toBe(denied);
        expect(calls).toBe(1);
        expect((yield* source.slice({ start: 1, end: 2 }, allow)).bytes).toEqual(new Uint8Array([98]));
      })
    );
    it.effect(
      "retains the captured deadline while allocation approval is suspended under a disabled caller Clock",
      () =>
        Effect.gen(function* () {
          const timer = yield* makeCitationNativeManualClock(Duration.millis(997));
          const disabled = yield* makeCitationNativeSleepClock(() => Effect.never);
          const entered = yield* Deferred.make<void>();
          const input = yield* makeCitationRegexInput({
            ...(yield* defaultCitationEnginePolicy).limits,
            extractDeadline: Duration.millis(997),
          }).pipe(Effect.provideService(Clock.Clock, timer.clock));
          const source = yield* input.prepareText("abc", allow);
          const pending = yield* source
            .slice(
              { start: 0, end: 3 },
              Effect.fn("SliceTest.waitApproval")(() =>
                Deferred.succeed(entered, undefined).pipe(Effect.andThen(Effect.never))
              )
            )
            .pipe(Effect.provideService(Clock.Clock, disabled), Effect.forkChild);
          yield* Deferred.await(entered);
          yield* timer.trigger;
          expect(yield* Fiber.join(pending).pipe(Effect.flip)).toMatchObject({ limit: "extractDeadline" });
        })
    );
  }
);
