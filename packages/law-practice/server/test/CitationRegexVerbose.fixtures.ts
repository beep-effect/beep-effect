import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationRegexPatternProfile } from "@beep/law-practice-server/internal/Citation/RegexDescriptors";
import { CitationRegexEngine, CitationRegexSourceFlags } from "@beep/law-practice-server/internal/Citation/RegexEngine";
import { makeCitationRegexProgram } from "@beep/law-practice-server/internal/Citation/RegexProgram";
import { CitationRegexMatchMode } from "@beep/law-practice-server/internal/Citation/RegexWorkerProtocol";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { LiteralKit, Sha256HexFromBytes } from "@beep/schema";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";
import { assertCitationRegexRuntimeReleased, setupCitationRegexWorker } from "./CitationRegexWorker.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const $I = $LawPracticeServerId.create("test/CitationRegexVerbose");
const Native = S.Struct({ width: S.Literals([1, 2, 4]), bytes: S.Uint8ArrayFromHex });
const Matches = S.Tuple([S.Int, S.Int]).pipe(S.Array, S.Array);
const Kind = LiteralKit(["source-error", "parser-only", "single-match", "unqualified"]);
const Outcome = S.Struct({
  kind: Kind,
  profile: S.NullOr(CitationRegexPatternProfile),
  cases: S.Array(S.Struct({ source: Native, modes: S.Record(CitationRegexMatchMode, Matches) })),
});
/** Shared source-bound pattern/profile observations for actual-worker probes. */
export const CitationRegexProbePattern = S.Struct({
  id: S.Natural,
  pattern: Native,
  flags: CitationRegexSourceFlags,
  smoke: S.Boolean,
  patternSha256: S.String,
  engines: S.Record(CitationRegexEngine, Outcome),
}).pipe(
  $I.annoteSchema("CitationRegexProbePattern", {
    description: "Native pattern identity, source flags and original profile/capture observations.",
  })
);
export type CitationRegexProbePattern = typeof CitationRegexProbePattern.Type;
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-regex-verbose/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    python: S.tag("3.11.15"),
    regex: S.tag("2023.12.25"),
    producerSha256: S.tag("c86c958858149b6b74f8b8b594e72123e65da2b1a71eeaac1ab8a806452834a1"),
    patterns: S.Array(CitationRegexProbePattern).check(S.isBetweenLength(47, 47)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description:
      "Actual pinned verbose grammar/profile and matching observations; errors and unfinished profiles remain explicit.",
  })
);
const loadCitationRegexVerbose = Effect.fn("VerboseTest.load")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const bytes = yield* fs.readFile(
    NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/regex-verbose.json", import.meta.url))
  );
  const hash = yield* S.decodeEffect(Sha256HexFromBytes)(bytes);
  expect(hash).toBe("58ca7328f4c5db3d1a2d237ea047f05afe457076d88333e79397bc5e24fa47b9");
  return yield* S.decodeEffect(Corpus)(new TextDecoder().decode(bytes));
});
/** Compare original-source success/error/profile facts without native execution. */
export const assertCitationRegexProgramProfiles = Effect.fn("RegexProgramTest.profiles")(function* (
  patterns: ReadonlyArray<CitationRegexProbePattern>,
  patternMaximum?: number
) {
  const defaults = (yield* defaultCitationEnginePolicy).limits;
  const limits = { ...defaults, patternUtf16: patternMaximum ?? defaults.patternUtf16 };
  for (const engine of CitationRegexEngine.literals) {
    const compiler = yield* makeCitationRegexProgram(limits, engine);
    for (const row of patterns) {
      const expected = row.engines[engine];
      if (expected.profile === null) {
        const error = yield* compiler.compile(row.pattern, row.flags).pipe(Effect.flip);
        expect(error).toMatchObject({ reason: "unsupported-syntax" });
      } else {
        const program = yield* compiler.compile(row.pattern, row.flags);
        expect(
          {
            groups: program.groups,
            names: program.names,
            minimumWidthFloor: program.minimumWidthFloor,
            repeatedCaptures: program.repeatedCaptures,
            nullableMultiRepeat: program.nullableMultiRepeat,
          },
          `${engine}:${row.id}`
        ).toEqual(expected.profile);
      }
    }
  }
});
/** Compare every original verbose source profile and closed rejection. */
export const assertCitationVerboseProfiles = Effect.fn("VerboseTest.profiles")(function* () {
  const corpus = yield* loadCitationRegexVerbose();
  yield* assertCitationRegexProgramProfiles(corpus.patterns);
});
type Setup = Effect.Success<ReturnType<typeof setupCitationRegexWorker>>;
/** Compare complete source capture spans using an existing observed worker. */
const assertCitationRegexProgramCase = Effect.fn("RegexProgramTest.case")(function* (
  setup: Setup,
  row: CitationRegexProbePattern,
  expected: typeof Outcome.Type,
  source: (typeof Outcome.Type.cases)[number]
) {
  const profile = yield* Effect.fromNullishOr(expected.profile);
  const modes =
    profile.minimumWidthFloor === 0
      ? A.filter(CitationRegexMatchMode.literals, (mode) => mode !== "finditer")
      : CitationRegexMatchMode.literals;
  for (const mode of modes) {
    const spans = source.modes[mode];
    const result = yield* setup.worker.evaluate(row.pattern, source.source, row.flags, spans.length, mode);
    expect(result.result.matches).toBe(spans.length);
    yield* Effect.forEach(spans, (captures, match) =>
      Effect.forEach(
        captures,
        Effect.fn("VerboseTest.capture")(function* ([start, end], group) {
          const actual = yield* result.result.capture(match, group);
          expect(actual).toEqual(start < 0 ? { _tag: "Unmatched" } : { _tag: "Range", start, end });
        })
      )
    );
  }
  return modes.length;
});
/** Replay one pattern's selected source observations with shared capture checks. */
export const replayCitationRegexProgramRow = Effect.fn("RegexProgramTest.row")(function* (
  setup: Setup,
  row: CitationRegexProbePattern,
  expected: typeof Outcome.Type,
  full: boolean
) {
  const counts = yield* Effect.forEach(full ? expected.cases : A.take(expected.cases, 1), (source) =>
    assertCitationRegexProgramCase(setup, row, expected, source)
  );
  return A.reduce(counts, 0, (total, count) => total + count);
});
const replayEngine = Effect.fn("VerboseTest.engine")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean,
  corpus: typeof Corpus.Type,
  engine: typeof CitationRegexEngine.Type
) {
  const rows = A.filter(corpus.patterns, (row) => row.engines[engine].kind === "single-match" && (full || row.smoke));
  const wanted = CitationRegexEngine.match(engine, {
    "python-re": () => ({ rows: full ? 33 : 5, calls: full ? 190 : 15 }),
    "python-regex-v0": () => ({ rows: full ? 38 : 8, calls: full ? 216 : 23 }),
  });
  expect(rows).toHaveLength(wanted.rows);
  const bindings = A.map(rows, (row) => ({
    patternSha256: row.patternSha256,
    flags: row.flags,
    profile: row.engines[engine].profile,
  }));
  const fuzzy = yield* Effect.fromOption(
    A.findFirst(corpus.patterns, (row) => row.engines["python-regex-v0"].kind === "unqualified")
  );
  const additional =
    engine === "python-regex-v0"
      ? [{ patternSha256: fuzzy.patternSha256, flags: fuzzy.flags, profile: fuzzy.engines["python-re"].profile }]
      : [];
  const setup = yield* setupCitationRegexWorker([...bindings, ...additional], kind, engine);
  const counts = yield* Effect.forEach(rows, (row) =>
    replayCitationRegexProgramRow(setup, row, row.engines[engine], full)
  );
  const count = A.reduce(counts, 0, (total, n) => total + n);
  expect(count).toBe(wanted.calls);
  if (engine === "python-regex-v0") {
    const source = yield* Effect.fromOption(A.head(fuzzy.engines[engine].cases));
    const rejected = yield* setup.worker
      .evaluate(fuzzy.pattern, source.source, fuzzy.flags, 1, "search")
      .pipe(Effect.flip);
    expect(rejected).toMatchObject({ reason: "unsupported-syntax" });
  }
  const observed = yield* setup.observed.snapshot;
  expect(observed).toEqual({ spawned: wanted.calls, confirmed: wanted.calls });
  const admission = yield* setup.admission.snapshot;
  expect(admission).toMatchObject({ active: 0, regexActive: 0, quarantined: 0 });
});
/** Actual isolated workers, with complete replay deferred to hosted integration. */
export const replayCitationRegexVerbose = Effect.fn("VerboseTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean
) {
  const corpus = yield* loadCitationRegexVerbose();
  yield* Effect.forEach(CitationRegexEngine.literals, (engine) => replayEngine(kind, full, corpus, engine));
});

/** Reuse one existing observed worker for source grammar families, including
 * closed parser-only execution refusals and independently acknowledged exits.
 * @internal @category testing @since 0.0.0
 */
export const replayCitationRegexProgramEngine = Effect.fn("RegexProgramTest.engine")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean,
  patterns: ReadonlyArray<CitationRegexProbePattern>,
  engine: typeof CitationRegexEngine.Type,
  patternMaximum?: number
) {
  const known = A.filter(patterns, (row) => row.engines[engine].profile !== null);
  const rows = A.filter(known, (row) => row.engines[engine].kind === "single-match" && (full || row.smoke));
  const bindings = A.map(known, (row) => ({
    patternSha256: row.patternSha256,
    flags: row.flags,
    profile: row.engines[engine].profile,
  }));
  const setup = yield* setupCitationRegexWorker(bindings, kind, engine, patternMaximum);
  let admitted = 0;
  for (const row of rows) admitted += yield* replayCitationRegexProgramRow(setup, row, row.engines[engine], full);
  let refused = 0;
  for (const row of A.filter(known, (row) => row.engines[engine].kind === "parser-only")) {
    const source = yield* Effect.fromOption(A.head(row.engines[engine].cases));
    const failure = yield* setup.worker.evaluate(row.pattern, source.source, row.flags, 1, "search").pipe(Effect.flip);
    expect(failure).toMatchObject({ reason: "unsupported-profile" });
    refused++;
  }
  yield* assertCitationRegexRuntimeReleased(setup.admission, setup.observed.snapshot, admitted + refused);
  return { admitted, refused };
});
