import * as NodeURL from "node:url";
import { makeCitationPythonHash } from "@beep/law-practice-server/internal/Citation/PythonHash";
import { makeCitationPythonUnicode } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as Clock from "effect/Clock";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const Snapshot = S.Struct({
  width: S.Literals([1, 2, 4]),
  nativeHex: S.String,
  pythonLength: S.Natural,
  utf16Units: S.Natural,
  hash: S.BigIntFromString,
  javascriptRoundtrip: S.Boolean,
});
const CorpusJson = S.fromJsonString(
  S.Struct({
    cases: S.Array(S.Struct({ name: S.String, events: S.Array(S.Struct({ value: Snapshot })) })),
  })
);
const Hex = S.Uint8ArrayFromHex;
const ShortText = S.String.check(S.isMaxLength(256));

it.layer(Layer.merge(BunCrypto.layer, BunFileSystem.layer))("lossless Python Unicode views", (it) => {
  it.effect("retains every audited native layout and its source hash independently of the text projection", () =>
    Effect.gen(function* () {
      const citationResult1 = yield* FileSystem.FileSystem;
      const raw = yield* citationResult1.readFileString(
        NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/cleaner-unicode.json", import.meta.url))
      );
      const citationResult2 = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw));
      expect(citationResult2).toBe("0c314524ff16f1a8689b8aaf50d235a5c2439187f1e168c84b84d700160aead0");
      const corpus = yield* S.decodeEffect(CorpusJson)(raw);
      const limits = (yield* defaultCitationEnginePolicy).limits;
      const unicode = yield* makeCitationPythonUnicode(limits);
      const hash = yield* makeCitationPythonHash(limits);
      let snapshots = 0;
      let distinct = 0;
      for (const row of corpus.cases)
        for (const event of row.events) {
          const source = event.value;
          const bytes = yield* S.decodeEffect(Hex)(source.nativeHex);
          const value = yield* unicode.fromStorage({ width: source.width, bytes });
          expect(value.storage.width, row.name).toBe(source.width);
          expect(value.storage.bytes, row.name).toEqual(bytes);
          expect(value.pythonLength, row.name).toBe(source.pythonLength);
          expect(value.utf16Units, row.name).toBe(source.utf16Units);
          expect(Str.length(value.text), row.name).toBe(source.utf16Units);
          const citationResult3 = yield* hash.unicode(value.storage);
          expect(citationResult3, row.name).toBe(source.hash);
          const projected = yield* unicode.fromText(value.text);
          if (source.javascriptRoundtrip) expect(projected.storage, row.name).toEqual(value.storage);
          else {
            expect(projected.storage, row.name).not.toEqual(value.storage);
            distinct++;
          }
          snapshots++;
        }
      expect(corpus.cases).toHaveLength(2016);
      expect(snapshots).toBe(6412);
      expect(distinct).toBe(1208);
    })
  );

  it.effect.prop(
    "round-trips schema-derived JavaScript text through canonical native storage",
    [ShortText],
    Effect.fnUntraced(function* ([text]) {
      const citationResult4 = yield* defaultCitationEnginePolicy;
      const unicode = yield* makeCitationPythonUnicode(citationResult4.limits);
      const value = yield* unicode.fromText(text);
      const restored = yield* unicode.fromStorage(value.storage);
      expect(restored).toEqual(value);
      expect(restored.text).toBe(text);
    }),
    { arbitrary: fcRuns(50) }
  );

  it.effect("distinguishes adjacent surrogate source points, snapshots buffers and rejects malformed layouts", () =>
    Effect.gen(function* () {
      const limits = (yield* defaultCitationEnginePolicy).limits;
      const unicode = yield* makeCitationPythonUnicode(limits);
      const bytes = new Uint8Array([0x3d, 0xd8, 0x00, 0xde]);
      const source = yield* unicode.fromStorage({ width: 2, bytes });
      bytes[0] = 0;
      expect(source.storage.bytes[0]).toBe(0x3d);
      expect(source.text).toBe("😀");
      expect(source.pythonLength).toBe(2);
      const citationResult5 = yield* unicode.fromText(source.text);
      expect(citationResult5.pythonLength).toBe(1);
      for (const bad of [
        null,
        { width: 3, bytes },
        { width: 2, bytes: new Uint8Array([65]) },
        { width: 2, bytes: new Uint8Array([65, 0]) },
        { width: 4, bytes: new Uint8Array([0, 0, 17, 0]) },
        { width: 4, bytes: new Uint8Array() },
      ]) {
        const citationResult6 = yield* Effect.flip(unicode.fromStorage(bad));
        expect(citationResult6.reason).toBe("invalid-input");
      }
      const policy = { ...limits, producedTextUtf16: 1 };
      const tight = yield* makeCitationPythonUnicode(policy);
      policy.producedTextUtf16 = 16;
      const citationResult7 = yield* Effect.flip(tight.fromText("😀"));
      expect(citationResult7.reason).toBe("limit-exceeded");
      const tooWide = yield* Effect.flip(tight.fromStorage({ width: 4, bytes: new Uint8Array([0, 0xf6, 1, 0]) }));
      expect(tooWide.reason).toBe("limit-exceeded");
      const citationResult8 = yield* unicode.fromText("");
      expect(citationResult8.storage).toEqual({ width: 1, bytes: new Uint8Array() });
    })
  );
});

it.effect("captures the deadline and Clock without returning a partial projection", () =>
  Effect.gen(function* () {
    const original = yield* Clock.Clock;
    const entered = yield* Deferred.make<number>();
    const wake = yield* Deferred.make<void>();
    const deadline = Duration.seconds(1);
    const citationResult9 = yield* defaultCitationEnginePolicy;
    const unicode = yield* makeCitationPythonUnicode({
      ...citationResult9.limits,
      cleanDeadline: deadline,
    }).pipe(
      Effect.provideService(Clock.Clock, {
        ...original,
        sleep: (duration) =>
          Deferred.succeed(entered, Duration.toMillis(duration)).pipe(Effect.andThen(Deferred.await(wake))),
      })
    );
    expect(Reflect.set(deadline.value, "millis", 20_000)).toBe(true);
    const running = yield* unicode
      .fromText(Str.repeat(16_384)("A"))
      .pipe(Effect.provideService(Clock.Clock, { ...original, sleep: () => Effect.never }), Effect.forkChild);
    const citationResult10 = yield* Deferred.await(entered);
    expect(citationResult10).toBe(1000);
    yield* Deferred.succeed(wake, undefined);
    const failed = yield* Fiber.join(running).pipe(Effect.flip);
    expect(failed.reason).toBe("deadline-exceeded");
  })
);

it.effect("interrupts both representation scans without publishing a partial value", () =>
  Effect.gen(function* () {
    const original = yield* Clock.Clock;
    for (const kind of ["text", "storage"]) {
      const entered = yield* Deferred.make<void>();
      const citationResult11 = yield* defaultCitationEnginePolicy;
      const unicode = yield* makeCitationPythonUnicode(citationResult11.limits).pipe(
        Effect.provideService(Clock.Clock, {
          ...original,
          sleep: () => Deferred.succeed(entered, undefined).pipe(Effect.andThen(Effect.never)),
        })
      );
      const pending = yield* (
        kind === "text"
          ? unicode.fromText(Str.repeat(16_384)("A"))
          : unicode.fromStorage({ width: 1, bytes: new Uint8Array(16_384) })
      ).pipe(Effect.forkChild);
      yield* Deferred.await(entered);
      yield* Fiber.interrupt(pending);
      const citationResult12 = yield* Fiber.await(pending);
      expect(Exit.hasInterrupts(citationResult12)).toBe(true);
    }
  })
);

it.effect("rejects malformed policy with a closed failure before installing operations", () =>
  Effect.gen(function* () {
    for (const policy of [null, {}, { sourceUtf16: 0 }]) {
      const failure = yield* makeCitationPythonUnicode(policy).pipe(Effect.flip);
      expect(failure).toMatchObject({ reason: "invalid-input" });
      expect("cause" in failure).toBe(false);
    }
  })
);
