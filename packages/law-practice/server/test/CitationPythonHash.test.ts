import { fileURLToPath } from "node:url";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
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
import { makeCitationPythonHash } from "../src/internal/Citation/PythonHash.ts";

const Row = S.Union([
  S.Struct({ kind: S.tag("bytes"), name: S.String, hex: S.String, hash: S.BigIntFromString }),
  S.Struct({
    kind: S.tag("unicode"),
    name: S.String,
    hex: S.String,
    hash: S.BigIntFromString,
    width: S.Literals([1, 2, 4]),
    value: S.String,
    codepoints: S.Array(S.Natural),
    javascriptRoundtrip: S.Boolean,
  }),
]).pipe(S.toTaggedUnion("kind"));
it.layer(Layer.merge(BunCrypto.layer, BunFileSystem.layer))("frozen Python primitive hashing", (it) => {
  it.effect("matches every full byte/Unicode vector and preserves explicit surrogate storage", () =>
    Effect.gen(function* () {
      const raw = yield* (yield* FileSystem.FileSystem).readFileString(
        fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/python-hashes.json", import.meta.url))
      );
      expect(yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw))).toBe(
        "844816162ce40d63b3e21a447bb4d1aa2c2310157a959c8c5c0f4ae8d86b0c89"
      );
      const corpus = yield* S.decodeEffect(S.fromJsonString(S.Struct({ cases: S.Array(Row) })))(raw);
      expect(corpus.cases).toHaveLength(1056);
      const hash = yield* makeCitationPythonHash((yield* defaultCitationEnginePolicy).limits);
      let binary = 0;
      let unicode = 0;
      let direct = 0;
      let explicit = 0;
      for (const row of corpus.cases) {
        const bytes = yield* S.decodeEffect(S.Uint8ArrayFromHex)(row.hex);
        expect(yield* hash.bytes(bytes), row.name).toBe(row.hash);
        if (row.kind === "bytes") {
          binary++;
          continue;
        }
        expect(yield* hash.unicode({ width: row.width, bytes }), row.name).toBe(row.hash);
        unicode++;
        if (row.javascriptRoundtrip) {
          expect(yield* hash.text(row.value), row.name).toBe(row.hash);
          direct++;
        } else {
          // JavaScript text merges a paired surrogate representation into a
          // scalar; explicit native storage is the faithful source path.
          expect(yield* hash.text(row.value), row.name).not.toBe(row.hash);
          explicit++;
        }
      }
      expect({ binary, unicode, direct, explicit }).toEqual({ binary: 526, unicode: 530, direct: 528, explicit: 2 });
      expect(yield* hash.text("html")).toBe(-BigInt("4559037671519806539"));
    })
  );
  it.effect("rejects malformed and noncanonical native storage without coercing text", () =>
    Effect.gen(function* () {
      const hash = yield* makeCitationPythonHash((yield* defaultCitationEnginePolicy).limits);
      let hooks = 0;
      const text = {
        toString: () => {
          hooks++;
          throw new Error("coercion");
        },
      };
      for (const input of [text, null, 7, Str.repeat(8_000_001)("A")]) {
        expect(yield* Effect.flip(hash.text(input))).toMatchObject({ reason: "invalid-input" });
      }
      expect(hooks).toBe(0);
      for (const input of [null, "bytes", new Uint8Array(32_000_001)]) {
        expect(yield* Effect.flip(hash.bytes(input))).toMatchObject({ reason: "invalid-input" });
      }
      for (const input of [
        { width: 3, bytes: new Uint8Array() },
        { width: 2, bytes: new Uint8Array([65]) },
        { width: 2, bytes: new Uint8Array([65, 0]) },
        { width: 4, bytes: new Uint8Array([0, 1, 0, 0]) },
        { width: 4, bytes: new Uint8Array([0, 0, 17, 0]) },
        { width: 2, bytes: new Uint8Array() },
      ])
        expect(yield* Effect.flip(hash.unicode(input))).toMatchObject({ reason: "invalid-input" });
    })
  );
});
it.effect("captures policy/clock, interrupts a cooperative scan and returns no partial hash", () =>
  Effect.gen(function* () {
    const original = yield* Clock.Clock;
    const entered = yield* Deferred.make<number>();
    const wake = yield* Deferred.make<void>();
    const controlled: Clock.Clock = {
      ...original,
      sleep: (duration) =>
        Deferred.succeed(entered, Duration.toMillis(duration)).pipe(Effect.andThen(Deferred.await(wake))),
    };
    const deadline = Duration.seconds(1);
    const hash = yield* makeCitationPythonHash({
      ...(yield* defaultCitationEnginePolicy).limits,
      cleanDeadline: deadline,
    }).pipe(Effect.provideService(Clock.Clock, controlled));
    expect(Reflect.set(deadline.value, "millis", 20_000)).toBe(true);
    const run = yield* hash
      .text(Str.repeat(8_000_000)("A"))
      .pipe(Effect.provideService(Clock.Clock, { ...original, sleep: () => Effect.never }), Effect.forkChild);
    expect(yield* Deferred.await(entered)).toBe(1000);
    yield* Deferred.succeed(wake, undefined);
    const failure = yield* Fiber.join(run).pipe(Effect.flip);
    expect(failure).toMatchObject({ _tag: "CitationPythonHashFailure", reason: "deadline-exceeded" });
    const cancelEntered = yield* Deferred.make<void>();
    const cancellable = yield* makeCitationPythonHash((yield* defaultCitationEnginePolicy).limits).pipe(
      Effect.provideService(Clock.Clock, {
        ...original,
        sleep: () => Deferred.succeed(cancelEntered, undefined).pipe(Effect.andThen(Effect.never)),
      })
    );
    const cancelled = yield* cancellable.bytes(new Uint8Array(32_000_000)).pipe(Effect.forkChild);
    yield* Deferred.await(cancelEntered);
    yield* Fiber.interrupt(cancelled);
    expect(Exit.hasInterrupts(yield* Fiber.await(cancelled))).toBe(true);
  })
);
