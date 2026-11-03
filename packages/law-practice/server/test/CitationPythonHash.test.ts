import * as NodeURL from "node:url";
import { makeCitationPythonHash } from "@beep/law-practice-server/internal/Citation/PythonHash";
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
const CorpusJson = S.fromJsonString(S.Struct({ cases: S.Array(Row) }));

it.layer(Layer.merge(BunCrypto.layer, BunFileSystem.layer))("frozen Python primitive hashing", (it) => {
  it.effect("matches every full byte/Unicode vector and preserves explicit surrogate storage", () =>
    Effect.gen(function* () {
      const citationResult1 = yield* FileSystem.FileSystem;
      const raw = yield* citationResult1.readFileString(
        NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/python-hashes.json", import.meta.url))
      );
      const citationResult2 = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw));
      expect(citationResult2).toBe("844816162ce40d63b3e21a447bb4d1aa2c2310157a959c8c5c0f4ae8d86b0c89");
      const corpus = yield* S.decodeEffect(CorpusJson)(raw);
      expect(corpus.cases).toHaveLength(1056);
      const citationResult3 = yield* defaultCitationEnginePolicy;
      const hash = yield* makeCitationPythonHash(citationResult3.limits);
      let binary = 0;
      let unicode = 0;
      let direct = 0;
      let explicit = 0;
      for (const row of corpus.cases) {
        const bytes = yield* S.decodeEffect(S.Uint8ArrayFromHex)(row.hex);
        const citationResult4 = yield* hash.bytes(bytes);
        expect(citationResult4, row.name).toBe(row.hash);
        if (row.kind === "bytes") {
          binary++;
          continue;
        }
        const citationResult5 = yield* hash.unicode({ width: row.width, bytes });
        expect(citationResult5, row.name).toBe(row.hash);
        unicode++;
        if (row.javascriptRoundtrip) {
          const citationResult6 = yield* hash.text(row.value);
          expect(citationResult6, row.name).toBe(row.hash);
          direct++;
        } else {
          // JavaScript text merges a paired surrogate representation into a
          // scalar; explicit native storage is the faithful source path.
          const citationResult7 = yield* hash.text(row.value);
          expect(citationResult7, row.name).not.toBe(row.hash);
          explicit++;
        }
      }
      expect({ binary, unicode, direct, explicit }).toEqual({ binary: 526, unicode: 530, direct: 528, explicit: 2 });
      const citationResult8 = yield* hash.text("html");
      expect(citationResult8).toBe(-BigInt("4559037671519806539"));
    })
  );
  it.effect("rejects malformed and noncanonical native storage without coercing text", () =>
    Effect.gen(function* () {
      const citationResult9 = yield* defaultCitationEnginePolicy;
      const hash = yield* makeCitationPythonHash(citationResult9.limits);
      let hooks = 0;
      const text = {
        toString: () => {
          hooks++;
          throw new Error("coercion");
        },
      };
      for (const input of [text, null, 7, Str.repeat(8_000_001)("A")]) {
        const citationResult10 = yield* Effect.flip(hash.text(input));
        expect(citationResult10).toMatchObject({ reason: "invalid-input" });
      }
      expect(hooks).toBe(0);
      for (const input of [null, "bytes", new Uint8Array(32_000_001)]) {
        const citationResult11 = yield* Effect.flip(hash.bytes(input));
        expect(citationResult11).toMatchObject({ reason: "invalid-input" });
      }
      for (const input of [
        { width: 3, bytes: new Uint8Array() },
        { width: 2, bytes: new Uint8Array([65]) },
        { width: 2, bytes: new Uint8Array([65, 0]) },
        { width: 4, bytes: new Uint8Array([0, 1, 0, 0]) },
        { width: 4, bytes: new Uint8Array([0, 0, 17, 0]) },
        { width: 2, bytes: new Uint8Array() },
      ]) {
        const citationResult16 = yield* Effect.flip(hash.unicode(input));
        expect(citationResult16).toMatchObject({ reason: "invalid-input" });
      }
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
    const citationResult12 = yield* defaultCitationEnginePolicy;
    const hash = yield* makeCitationPythonHash({
      ...citationResult12.limits,
      cleanDeadline: deadline,
    }).pipe(Effect.provideService(Clock.Clock, controlled));
    expect(Reflect.set(deadline.value, "millis", 20_000)).toBe(true);
    const run = yield* hash
      .text(Str.repeat(8_000_000)("A"))
      .pipe(Effect.provideService(Clock.Clock, { ...original, sleep: () => Effect.never }), Effect.forkChild);
    const citationResult13 = yield* Deferred.await(entered);
    expect(citationResult13).toBe(1000);
    yield* Deferred.succeed(wake, undefined);
    const failure = yield* Fiber.join(run).pipe(Effect.flip);
    expect(failure).toMatchObject({ _tag: "CitationPythonHashFailure", reason: "deadline-exceeded" });
    const cancelEntered = yield* Deferred.make<void>();
    const citationResult14 = yield* defaultCitationEnginePolicy;
    const cancellable = yield* makeCitationPythonHash(citationResult14.limits).pipe(
      Effect.provideService(Clock.Clock, {
        ...original,
        sleep: () => Deferred.succeed(cancelEntered, undefined).pipe(Effect.andThen(Effect.never)),
      })
    );
    const cancelled = yield* cancellable.bytes(new Uint8Array(32_000_000)).pipe(Effect.forkChild);
    yield* Deferred.await(cancelEntered);
    yield* Fiber.interrupt(cancelled);
    const citationResult15 = yield* Fiber.await(cancelled);
    expect(Exit.hasInterrupts(citationResult15)).toBe(true);
  })
);
