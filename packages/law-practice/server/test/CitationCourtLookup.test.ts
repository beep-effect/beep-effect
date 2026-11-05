import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { makeCitationCourtLookup } from "@beep/law-practice-server/internal/Citation/CourtLookup";
import { makeCitationPythonUnicode } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import { CitationTextBudget, makeCitationTextBudget } from "@beep/law-practice-server/internal/Citation/TextBudget";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { makeCitationNativeManualClock, makeCitationNativeSleepClock } from "./CitationNativeSpawner.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const $I = $LawPracticeServerId.create("test/CitationCourtLookup");
const Header = {
  oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
  oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
  producerSha256: S.tag("27aa1067f11cf79ef74b7f7b0001707aee41ffb4f92440d72e4e9854e9a134a4"),
  python: S.tag("3.11.15"),
  regex: S.tag("2023.12.25"),
  courtsDb: S.tag("0.10.22"),
};
const Table = S.fromJsonString(
  S.Struct({ ...Header, schemaVersion: S.tag("citation-court-table/v1"), payload: S.String })
);
const Words = S.fromJsonString(
  S.Struct({
    ...Header,
    schemaVersion: S.tag("citation-court-words/v1"),
    payloadSha256: S.String,
    payload: S.fromJsonString(
      S.Array(S.Tuple([S.Literals([1, 2, 4]), S.Uint8ArrayFromHex])).check(S.isBetweenLength(16306, 16306))
    ),
  })
);
const Corpus = S.fromJsonString(
  S.Struct({
    ...Header,
    schemaVersion: S.tag("citation-court-lookup/v1"),
    wordsPayloadSha256: S.String,
    originalCourtRows: S.tag(2798),
    prefixRows: S.tag(14325),
    controlStart: S.tag(17123),
    keys: S.fromJsonString(S.Array(S.String).check(S.isBetweenLength(14338, 14338))),
    cases: S.fromJsonString(
      S.Array(S.Tuple([S.Natural, S.Natural, S.NullOr(S.String)])).check(S.isBetweenLength(17156, 17156))
    ),
    scalarLaw: S.Struct({
      scanned: S.tag(1114112),
      wordPoints: S.tag(140234),
      loweredPoints: S.tag(140235),
      digest: S.tag("5406900a24bf9d0004b82c95f4e452f1e3d3b242381b58d21b9ee18037de3abf"),
    }),
  })
).pipe(
  $I.annoteSchema("Corpus", { description: "Every original court string/prefix and native Unicode source control." })
);
const fixtureHashes = {
  "court-table": "2a0ee8d810577297440ff5a52da8b479a265953262ea1fb479005ef95ae6054c",
  "court-words": "8b354b13a3d6314568a76c7689690dd9ae547072897cb452825dcf639ca7fc4e",
  "court-lookup": "fcd99932bfab35fc94de74ecb9c8a335a8700bf0d0da57f835f5ef0054bc75db",
};
const readFixture = Effect.fn("CourtLookupTest.readFixture")(function* <A, I>(
  name: keyof typeof fixtureHashes,
  schema: S.Codec<A, I>
) {
  const fs = yield* FileSystem.FileSystem;
  const bytes = yield* fs.readFile(
    NodeURL.fileURLToPath(new URL(`../../use-cases/test/fixtures/eyecite/${name}.json`, import.meta.url))
  );
  const hash = yield* S.decodeEffect(Sha256HexFromBytes)(bytes);
  expect(hash).toBe(fixtureHashes[name]);
  return yield* S.decodeUnknownEffect(schema)(new TextDecoder().decode(bytes));
});
const install = Effect.fn("CourtLookupTest.install")(function* (maximum?: number) {
  const policy = yield* defaultCitationEnginePolicy;
  const limits = maximum === undefined ? policy.limits : { ...policy.limits, producedTextUtf16: maximum };
  const table = yield* readFixture("court-table", Table);
  const parser = yield* makeCitationCourtLookup(limits, table.payload);
  return { ...parser, limits, table };
});
const native = (text: string) => ({ width: 1, bytes: new TextEncoder().encode(text) });

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("source court lookup", (it) => {
  it.effect(
    "matches every frozen exact/prefix observation and native normalization",
    () =>
      Effect.gen(function* () {
        const corpus = yield* readFixture("court-lookup", Corpus);
        const words = yield* readFixture("court-words", Words);
        expect(words.payloadSha256).toBe(corpus.wordsPayloadSha256);
        const parser = yield* install();
        const unicode = yield* makeCitationPythonUnicode(parser.limits);
        for (const [wordIndex, keyIndex, court] of corpus.cases) {
          const key = A.getUnsafe(corpus.keys, keyIndex);
          expect(parser.lookupNormalized(key)).toEqual(O.fromNullishOr(court));
          const [width, bytes] = A.getUnsafe(words.payload, wordIndex);
          const actual = yield* parser.lookup({ width, bytes });
          const expected = yield* unicode.fromText(key);
          expect(actual.normalized).toEqual(expected.storage);
          expect(actual.court).toEqual(O.fromNullishOr(court));
        }
      }),
    { timeout: 120000 }
  );
  it.effect("authenticates source order and rejects a same-length table mutation", () =>
    Effect.gen(function* () {
      const { limits, table } = yield* install();
      const refused = yield* makeCitationCourtLookup(limits, Str.replace("alacirct", "xlacirct")(table.payload)).pipe(
        Effect.flip
      );
      expect(refused).toMatchObject({ _tag: "CitationCourtLookupFailure", reason: "invalid-table" });
    })
  );
  it.effect("reserves exact native copies before allocation and shares an enclosing owner", () =>
    Effect.gen(function* () {
      const exact = yield* install(12);
      const accepted = yield* exact.lookup(native("S.C."));
      expect(accepted.reservedUnits).toBe(12);
      const tight = yield* install(11);
      const refused = yield* tight.lookup(native("S.C.")).pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "producedTextUtf16" });
      const budget = yield* makeCitationTextBudget(exact.limits);
      yield* budget.reserve(1);
      const composed = yield* install(12).pipe(Effect.provideService(CitationTextBudget, budget));
      const composedRefused = yield* composed.lookup(native("S.C.")).pipe(Effect.flip);
      expect(composedRefused).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "producedTextUtf16" });
      const reserved = yield* budget.snapshot;
      expect(reserved).toBe(11);
    })
  );
  it.effect("retains captured Clock despite caller replacement and returns no partial output", () =>
    Effect.gen(function* () {
      const { limits, table } = yield* install();
      const deadline = Duration.millis(997);
      const timer = yield* makeCitationNativeManualClock(deadline);
      const disabled = yield* makeCitationNativeSleepClock(() => Effect.never);
      const parser = yield* makeCitationCourtLookup({ ...limits, extractDeadline: deadline }, table.payload).pipe(
        Effect.provideService(Clock.Clock, timer.clock)
      );
      const pending = yield* parser
        .lookup({ width: 1, bytes: new Uint8Array(65536).fill(65) })
        .pipe(Effect.provideService(Clock.Clock, disabled), Effect.forkChild);
      yield* timer.trigger;
      const refused = yield* Fiber.join(pending).pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "extractDeadline" });
    })
  );
  it.effect("rejects malformed native storage and the captured raw source ceiling", () =>
    Effect.gen(function* () {
      const { limits, table } = yield* install();
      const captured = { ...limits, sourceUtf16: 3 };
      const parser = yield* makeCitationCourtLookup(captured, table.payload);
      captured.sourceUtf16 = 100;
      const sourceRefused = yield* parser.lookup(native("S.C.")).pipe(Effect.flip);
      expect(sourceRefused).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "sourceUtf16" });
      const malformed = yield* parser.lookup({ width: 2, bytes: new Uint8Array([1]) }).pipe(Effect.flip);
      expect(malformed).toMatchObject({ _tag: "CitationPythonUnicodeFailure", reason: "invalid-input" });
      const expanded = yield* install(7);
      const accepted = yield* expanded.lookup({ width: 2, bytes: new Uint8Array([0x30, 1]) });
      expect(accepted.reservedUnits).toBe(7);
      expect(accepted.normalized).toEqual({ width: 2, bytes: new Uint8Array([0x69, 0, 7, 3]) });
      const tight = yield* install(6);
      const expansionRefused = yield* tight.lookup({ width: 2, bytes: new Uint8Array([0x30, 1]) }).pipe(Effect.flip);
      expect(expansionRefused).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "producedTextUtf16" });
    })
  );
});
