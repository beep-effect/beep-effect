import * as NodeURL from "node:url";
import { CitationHtmlInputLayout, makeCitationHtmlInput } from "@beep/law-practice-server/internal/Citation/HtmlInput";
import { makeCitationHtmlWorker } from "@beep/law-practice-server/internal/Citation/HtmlWorker";
import {
  CitationHtmlWorkerJob,
  decodeCitationHtmlJob,
  encodeCitationHtmlJob,
  preflightCitationHtmlControlFrames,
  preflightCitationHtmlJob,
} from "@beep/law-practice-server/internal/Citation/HtmlWorkerProtocol";
import { makeCitationPythonUnicode } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import { citationBunTestExecutable } from "./CitationNativeSpawner.fixtures.ts";
import { loadCitationUnicodeHistories } from "./CitationUnicodePipeline.fixtures.ts";

it.layer(Layer.merge(BunServices.layer, BunCrypto.layer))("native HTML preparation and framing", (it) => {
  it.effect("preserves all native snapshots through exact preparation and closed worker frames", () =>
    Effect.gen(function* () {
      const corpus = yield* loadCitationUnicodeHistories();
      const limits = (yield* defaultCitationEnginePolicy).limits;
      const preparation = yield* makeCitationHtmlInput(limits);
      let snapshots = 0;
      yield* Effect.forEach(
        corpus.cases,
        Effect.fnUntraced(function* (row) {
          yield* Effect.forEach(
            row.events,
            Effect.fnUntraced(function* (event) {
              const value = event.value;
              const bytes = yield* S.decodeEffect(S.Uint8ArrayFromHex)(value.nativeHex);
              const expected =
                value.width === 1
                  ? A.some(value.codepoints, (point) => point > 127)
                    ? "ISO-8859-1"
                    : "UTF-8"
                  : value.width === 2
                    ? "UTF-16LE"
                    : "UTF-32LE";
              let preflights = 0;
              const prepared = yield* preparation.prepareUnicode({ width: value.width, bytes }, (layout) =>
                preflightCitationHtmlJob(layout, 100, limits.processMessageBytes).pipe(
                  Effect.tap(() =>
                    Effect.sync(() => {
                      expect(layout.encoding, row.name).toBe(expected);
                      expect(layout.byteLength, row.name).toBe(bytes.length);
                      preflights++;
                    })
                  ),
                  Effect.asVoid
                )
              );
              expect(preflights).toBe(1);
              expect(prepared.encoding, row.name).toBe(expected);
              expect(prepared.bytes, row.name).toEqual(bytes);
              expect(prepared.bytes).not.toBe(bytes);
              const frame = yield* encodeCitationHtmlJob(
                CitationHtmlWorkerJob.make({ ...prepared, outputUtf16: 100 }),
                limits.processMessageBytes
              );
              const restored = yield* decodeCitationHtmlJob(frame.subarray(0, frame.length - 1));
              expect(restored.encoding, row.name).toBe(expected);
              expect(restored.bytes, row.name).toEqual(bytes);
              expect(restored.fullHtml).toBe(prepared.fullHtml);
              snapshots++;
            }),
            { concurrency: 1, discard: true }
          );
        }),
        { concurrency: 1, discard: true }
      );
      expect(snapshots).toBe(6412);
    })
  );

  it.effect("classifies native wrappers, rejects declarations and snapshots the transport buffer", () =>
    Effect.gen(function* () {
      const limits = (yield* defaultCitationEnginePolicy).limits;
      const unicode = yield* makeCitationPythonUnicode(limits);
      const preparation = yield* makeCitationHtmlInput(limits);
      yield* Effect.forEach(
        ["\u0085<HTML><body>A</body></HTML>", "\u3000<!DOCTYPE html><html></html>"],
        Effect.fnUntraced(function* (text) {
          const value = yield* unicode.fromText(text);
          const citationResult1 = yield* preparation.prepareUnicode(value.storage, () => Effect.void);
          expect(citationResult1.fullHtml).toBe(true);
        }),
        { concurrency: 1, discard: true }
      );
      const declaration = yield* unicode.fromText("<?xml version='1.0' encoding='UTF-8'?><p>A</p>");
      let preflighted = false;
      const citationResult2 = yield* Effect.flip(
        preparation.prepareUnicode(declaration.storage, () =>
          Effect.sync(() => {
            preflighted = true;
          })
        )
      );
      expect(citationResult2).toMatchObject({ reason: "unicode-encoding-declaration" });
      expect(preflighted).toBe(false);
      const bytes = new Uint8Array([0x3d, 0xd8, 0, 0xde]);
      const prepared = yield* preparation.prepareUnicode({ width: 2, bytes }, () => Effect.void);
      bytes[0] = 0;
      expect(prepared.encoding).toBe("UTF-16LE");
      expect(prepared.bytes).toEqual(new Uint8Array([0x3d, 0xd8, 0, 0xde]));
      const citationResult3 = yield* preparation.prepareStage("😀", () => Effect.void);
      expect(citationResult3.encoding).toBe("UTF-32LE");
      yield* Effect.forEach(
        [
          { width: 2, bytes: new Uint8Array([65]) },
          { width: 2, bytes: new Uint8Array([65, 0]) },
          { width: 4, bytes: new Uint8Array([0, 0, 17, 0]) },
        ],
        Effect.fnUntraced(function* (input) {
          const citationResult4 = yield* Effect.flip(preparation.prepareUnicode(input, () => Effect.void));
          expect(citationResult4).toMatchObject({
            reason: "invalid-input",
          });
        }),
        { concurrency: 1, discard: true }
      );
    })
  );

  it.effect("rejects a native buffer detached during complete-frame preflight", () =>
    Effect.gen(function* () {
      const citationResult5 = yield* defaultCitationEnginePolicy;
      const preparation = yield* makeCitationHtmlInput(citationResult5.limits);
      const bytes = new Uint8Array([65]);
      const failure = yield* Effect.flip(
        preparation.prepareUnicode({ width: 1, bytes }, () =>
          Effect.sync(() => {
            structuredClone(bytes, { transfer: [bytes.buffer] });
          })
        )
      );
      expect(failure).toMatchObject({ reason: "invalid-input" });
      expect(bytes.byteLength).toBe(0);
    })
  );

  it.effect("rejects a complete native job before spawning and releases its admission permit", () =>
    Effect.gen(function* () {
      const base = (yield* defaultCitationEnginePolicy).limits;
      const bytes = new Uint8Array(A.makeBy(512, (index) => index % 2));
      const layout = CitationHtmlInputLayout.make({ encoding: "UTF-16LE", fullHtml: false, byteLength: bytes.length });
      const completeSize = yield* preflightCitationHtmlJob(layout, base.producedTextUtf16, base.processMessageBytes);
      const policy = { ...base, processMessageBytes: completeSize - 1 };
      yield* preflightCitationHtmlControlFrames(policy.processMessageBytes);
      const real = yield* ChildProcessSpawner;
      let spawned = 0;
      const executable = yield* citationBunTestExecutable;
      const worker = yield* makeCitationHtmlWorker(policy, {
        kind: "bun",
        executable,
        cwd: process.cwd(),
        workerFile: NodeURL.fileURLToPath(new URL("../src/internal/Citation/HtmlWorker.entry.ts", import.meta.url)),
      }).pipe(
        Effect.provideService(ChildProcessSpawner, {
          ...real,
          spawn: Effect.fn("NativeInputTest.forbidSpawn")(() =>
            Effect.sync(() => {
              spawned++;
            }).pipe(Effect.andThen(Effect.die("Preflight must reject before spawn.")))
          ),
        })
      );
      policy.processMessageBytes = 64_000;
      const citationResult6 = yield* Effect.flip(worker.cleanUnicode({ width: 2, bytes }));
      expect(citationResult6).toMatchObject({
        _tag: "CitationSafetyLimitExceeded",
        limit: "processMessageBytes",
      });
      expect(spawned).toBe(0);
      const citationResult7 = yield* worker.snapshot;
      expect(citationResult7).toEqual({ active: 0, queued: 0, processes: 0, quarantined: 0, closed: false });
    })
  );
});

it.effect("captures preparation timing without publishing a partial payload", () =>
  Effect.gen(function* () {
    const original = yield* Clock.Clock;
    const entered = yield* Deferred.make<number>();
    const wake = yield* Deferred.make<void>();
    const deadline = Duration.millis(500);
    const citationResult8 = yield* defaultCitationEnginePolicy;
    const preparation = yield* makeCitationHtmlInput({
      ...citationResult8.limits,
      cleanDeadline: deadline,
    }).pipe(
      Effect.provideService(Clock.Clock, {
        ...original,
        sleep: (duration) =>
          Deferred.succeed(entered, Duration.toMillis(duration)).pipe(Effect.andThen(Deferred.await(wake))),
      })
    );
    expect(Reflect.set(deadline.value, "millis", 20_000)).toBe(true);
    const pending = yield* preparation
      .prepareUnicode({ width: 1, bytes: new Uint8Array(16_384) }, () => Effect.void)
      .pipe(Effect.provideService(Clock.Clock, { ...original, sleep: () => Effect.never }), Effect.forkChild);
    const citationResult9 = yield* Deferred.await(entered);
    expect(citationResult9).toBe(500);
    yield* Deferred.succeed(wake, undefined);
    const failure = yield* Fiber.join(pending).pipe(Effect.flip);
    expect(failure).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "cleanDeadline" });
  })
);
