import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import {
  CitationRegexPatternDescriptor,
  CitationRegexPatternProfile,
} from "@beep/law-practice-server/internal/Citation/RegexDescriptors";
import { CitationRegexEngine } from "@beep/law-practice-server/internal/Citation/RegexEngine";
import { makeCitationRegexPointSets } from "@beep/law-practice-server/internal/Citation/RegexPointSets";
import {
  CitationRegexWorkerStartup,
  decodeCitationRegexStartup,
  encodeCitationRegexStartup,
} from "@beep/law-practice-server/internal/Citation/RegexWorkerRpc";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";
import { setupCitationRegexWorker } from "./CitationRegexWorker.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const $I = $LawPracticeServerId.create("test/CitationRegexEngine");
const Native = S.Struct({ width: S.Literals([1, 2, 4]), bytes: S.Uint8ArrayFromHex });
const Ranges = S.Tuple([S.Natural, S.Natural]).pipe(S.Array);
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-regex-engine-characters/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    python: S.tag("3.11.15"),
    regex: S.tag("2023.12.25"),
    engine: S.tag("python-regex-v0"),
    producerSha256: S.tag("718ee492ff49aad339482d3c370f22c7dcca1371596cd1dacd0fd1f8223b997e"),
    intervals: S.Struct({ digitClass: Ranges, spaceClass: Ranges, wordClass: Ranges, verboseSpaceClass: Ranges }),
    candidates: S.Array(S.Natural).check(S.isBetweenLength(132, 132)),
    asciiRangeCount: S.Literal(8256),
    asciiRangeStride: S.Literal(17),
    asciiRangeMasks: S.Uint8ArrayFromBase64.check(S.isBetweenLength(140352, 140352)),
    workerCases: S.Array(
      S.Struct({
        pattern: Native,
        source: Native,
        flags: S.Literals([0, 2]),
        patternSha256: Sha256Hex,
        profile: CitationRegexPatternProfile,
        expected: S.Record(CitationRegexEngine, Ranges),
      })
    ).check(S.isBetweenLength(5, 5)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Pinned regex engine point predicates, ASCII range oracle and discriminating native worker controls.",
  })
);
const load = Effect.fn("EngineTest.load")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const digest = yield* Digest.Digest;
  const bytes = yield* fs.readFile(
    NodeURL.fileURLToPath(
      new URL("../../use-cases/test/fixtures/eyecite/regex-engine-characters.json", import.meta.url)
    )
  );
  const hash = yield* digest.digestHex(Digest.sha256, bytes);
  expect(hash).toBe("277930887d3a604f8befe7f1e19c26d69aaca1459a648b5a48b187c941fcec1f");
  return yield* S.decodeEffect(Corpus)(new TextDecoder().decode(bytes));
});
const endpoints = (ranges: ReadonlyArray<{ readonly start: number; readonly end: number }>) =>
  A.map(ranges, (row) => [row.start, row.end]);
it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("pinned source regex engines", (it) => {
  it.effect(
    "matches every class interval and every ASCII ignore-case range",
    () =>
      Effect.gen(function* () {
        const corpus = yield* load();
        const sets = yield* makeCitationRegexPointSets("python-regex-v0");
        expect(endpoints(sets.digit)).toEqual(corpus.intervals.digitClass);
        expect(endpoints(sets.space)).toEqual(corpus.intervals.spaceClass);
        expect(endpoints(sets.word)).toEqual(corpus.intervals.wordClass);
        expect(endpoints(sets.verboseSpace)).toEqual(corpus.intervals.verboseSpaceClass);
        const output = new Uint8Array(corpus.asciiRangeMasks.length);
        const view = new DataView(output.buffer);
        let cursor = 0;
        let cardinality = 0;
        for (let start = 0; start < 128; start++) {
          for (let end = start; end < 128; end++) {
            const ranges = yield* sets.literal(start, end, true);
            cardinality += A.reduce(ranges, 0, (total, row) => total + row.end - row.start + 1);
            A.forEach(corpus.candidates, (point, index) => {
              if (!A.some(ranges, (row) => row.start <= point && point <= row.end)) return;
              const offset = cursor + Math.floor(index / 8);
              view.setUint8(offset, view.getUint8(offset) | (1 << (index % 8)));
            });
            cursor += corpus.asciiRangeStride;
          }
        }
        expect(cursor).toBe(output.length);
        expect(output).toEqual(corpus.asciiRangeMasks);
        const bits = A.range(0, 7);
        const expected = A.reduce(
          A.fromIterable(corpus.asciiRangeMasks),
          0,
          (total, byte) => total + A.filter(bits, (bit) => (byte & (1 << bit)) !== 0).length
        );
        expect(cardinality).toBe(expected);
        const ordinary = yield* makeCitationRegexPointSets();
        expect(ordinary.engine).toBe("python-re");
        expect(endpoints(ordinary.verboseSpace)).toEqual([
          [9, 13],
          [32, 32],
        ]);
        const invalid = yield* makeCitationRegexPointSets("unknown").pipe(Effect.flip);
        expect(invalid).toMatchObject({ reason: "unsupported-syntax" });
      }),
    { timeout: 60000 }
  );
  it.effect("requires an explicit known child engine and round-trips either selected identity", () =>
    Effect.gen(function* () {
      const corpus = yield* load();
      const row = yield* Effect.fromOption(A.head(corpus.workerCases));
      const descriptor = CitationRegexPatternDescriptor.make({
        patternSha256: row.patternSha256,
        flags: row.flags,
        profile: row.profile,
      });
      const limits = (yield* defaultCitationEnginePolicy).limits;
      const envelope = S.fromJsonString(
        S.Struct({ engine: S.optionalKey(S.String), limits: S.Unknown, descriptor: S.Unknown })
      );
      for (const engine of CitationRegexEngine.literals) {
        const encoded = yield* encodeCitationRegexStartup(
          CitationRegexWorkerStartup.make({ limits, descriptor, engine })
        );
        const decoded = yield* decodeCitationRegexStartup([encoded]);
        expect(decoded.engine).toBe(engine);
        const payload = yield* S.decodeEffect(envelope)(encoded);
        for (const invalid of [
          { limits: payload.limits, descriptor: payload.descriptor },
          { ...payload, engine: "unknown" },
        ]) {
          const malformed = yield* S.encodeEffect(envelope)(invalid);
          const failed = yield* decodeCitationRegexStartup([malformed]).pipe(Effect.flip);
          expect(failed).toMatchObject({ reason: "invalid-runtime" });
        }
      }
    })
  );
  for (const kind of CitationNativeRuntimeKind.literals) {
    it.effect(
      `keeps engine character and folding identity through actual ${kind} children`,
      () =>
        Effect.gen(function* () {
          const corpus = yield* load();
          const bindings = A.map(corpus.workerCases, ({ patternSha256, flags, profile }) => ({
            patternSha256,
            flags,
            profile,
          }));
          for (const engine of CitationRegexEngine.literals) {
            const setup = yield* setupCitationRegexWorker(bindings, kind, engine);
            for (const row of corpus.workerCases) {
              const expected = row.expected[engine];
              const result = yield* setup.worker.evaluate(
                row.pattern,
                row.source,
                row.flags,
                expected.length,
                "search"
              );
              expect(result.result.matches).toBe(expected.length);
              yield* Effect.forEach(
                expected,
                Effect.fn("EngineTest.checkCapture")(function* ([start, end], index) {
                  const actual = yield* result.result.capture(index, 0);
                  expect(actual).toEqual({ _tag: "Range", start, end });
                })
              );
            }
            const snapshot = yield* setup.observed.snapshot;
            expect(snapshot).toEqual({ spawned: 5, confirmed: 5 });
            const admission = yield* setup.admission.snapshot;
            expect(admission).toMatchObject({ active: 0, regexActive: 0, quarantined: 0 });
          }
        }),
      { timeout: 60000 }
    );
  }
});
