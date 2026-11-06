/** Complete original processing snapshots and native integer source controls.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationCaseNameProcessConfiguration,
  CitationCaseNameProcessFailure,
  makeCitationCaseNameProcess,
} from "@beep/law-practice-server/internal/Citation/CaseNameProcess";
import { makeCitationMetadataStage } from "@beep/law-practice-server/internal/Citation/MetadataComposition";
import { parseCitationPythonInteger } from "@beep/law-practice-server/internal/Citation/PythonInteger";
import { makeCitationRegexInput } from "@beep/law-practice-server/internal/Citation/RegexInput";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Tuple from "effect/Tuple";
import {
  assertCitationMetadataEnclosingRefusal,
  assertCitationMetadataFailure,
  assertCitationMetadataRefusal,
  assertCitationWorkerCapturedDeadline,
  assertCitationWorkerClosedLifetime,
  assertCitationWorkerCompositionReleased,
  makeCitationMetadataFixture,
  readCitationOracleFixture,
  setupCitationMetadataRuntime,
} from "./CitationRegexWorker.fixtures.ts";
import { CitationNativeUnicodeHex } from "./CitationTokenSeed.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const $I = $LawPracticeServerId.create("test/CitationCaseNameProcess");
const Native = CitationNativeUnicodeHex;
const Value = S.NullOr(Native);
const Snapshot = S.Struct({
  metadata: S.Record(S.String, S.Union([S.Null, Native, S.Int])),
  year: S.NullOr(S.Int),
  fullSpanStart: S.NullOr(S.Int),
  span: S.Tuple([S.Int, S.Int]),
});
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-case-name-process/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    cases: S.Array(
      S.Struct({
        id: S.Natural,
        short: S.Boolean,
        index: S.Int,
        words: S.Array(Native),
        state: S.Struct({ candidateCaseName: Value, hasV: S.Boolean, startIndex: S.NullOr(S.Int), preCiteYear: Value }),
        before: Snapshot,
        after: Snapshot,
        error: S.NullOr(S.Literals(["TypeError", "ValueError"])),
        calls: S.Array(S.Unknown),
      })
    ).check(S.isBetweenLength(328, 328)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "All original built-in processing snapshots, errors and attempted regex-call counts.",
  })
);
const PatternCorpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-case-name-process-patterns/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    producerSha256: S.tag("784ea110559da55a914004cb1841c9a95d8c2720501a41ef4f4a67c8f4029a9d"),
    configuration: S.Struct({
      patterns: S.Struct({ splitV: Native, lowercase: Native }),
      bindings: CitationCaseNameProcessConfiguration.fields.bindings,
    }),
    integers: S.Array(
      S.Struct({
        id: S.Natural,
        source: Native,
        value: S.NullOr(S.BigIntFromString),
        error: S.NullOr(S.Literals(["ValueError"])),
      })
    ).check(S.isBetweenLength(61, 61)),
  })
).pipe(
  $I.annoteSchema("PatternCorpus", {
    description: "Independent original V0 profiles and exact CPython int values/errors at 4300 digits.",
  })
);
const CleanerCorpus = S.fromJsonString(
  S.Struct({
    configuration: S.Struct({
      patterns: S.Struct({ stopWords: Native, leadingIn: Native }),
      bindings: CitationCaseNameProcessConfiguration.fields.cleaner.fields.bindings,
    }),
  })
).pipe(
  $I.annoteSchema("CleanerCorpus", {
    description: "Independently sealed source cleanup patterns for composed name processing.",
  })
);
/** Read the original processing corpus and independently bound configuration.
 * @internal @category testing @since 0.0.0
 */
export const readCitationCaseNameProcessCorpus = Effect.fn("CaseNameProcessTest.load")(function* () {
  const read = readCitationOracleFixture;
  const patterns = yield* read(
    "case-name-process-patterns",
    "3786b74826d9b3f3b88bf03d673da59f43abe4a54ee81f3615fe8871926d7a87"
  ).pipe(Effect.flatMap(S.decodeEffect(PatternCorpus)));
  const cleaner = yield* read(
    "stop-word-patterns",
    "98bdf393eb38077254b0a241767ef935ee4adaf04184c0d29b08565b1c5fa1ae"
  ).pipe(Effect.flatMap(S.decodeEffect(CleanerCorpus)));
  const corpus = yield* read(
    "case-name-process",
    "027c7f42d55d4fe9ee6f000c98c6427d4931f45bf82675277f60864762b51505"
  ).pipe(Effect.flatMap(S.decodeEffect(Corpus)));
  return { patterns, corpus, configuration: { ...patterns.configuration, cleaner: cleaner.configuration } };
});
const install = makeCitationMetadataFixture({
  load: readCitationCaseNameProcessCorpus,
  make: makeCitationCaseNameProcess,
});
type Row = (typeof Corpus.Type.cases)[number];
const request = (row: Row) => ({
  ...row.state,
  words: row.words,
  index: row.index,
  spanStart: row.before.span[0],
  short: row.short,
});
const assertRow = Effect.fn("CaseNameProcessTest.row")(function* (
  stage: Effect.Success<ReturnType<typeof install>>["stage"],
  row: Row
) {
  if (row.error !== null)
    return yield* assertCitationMetadataFailure(stage.apply(request(row)), {
      _tag: "CitationCaseNameProcessFailure",
      reason: row.error === "TypeError" ? "missing-candidate" : "invalid-year",
    });
  const result = yield* stage.apply(request(row));
  let metadata = row.before.metadata;
  for (const [key, value] of [
    Tuple.make("plaintiff", result.patch.plaintiff),
    Tuple.make("defendant", result.patch.defendant),
    Tuple.make("antecedent_guess", result.patch.antecedentGuess),
    Tuple.make("year", result.patch.year),
  ])
    if (O.isSome(value)) metadata = R.set(metadata, key, value.value);
  expect(metadata, `metadata:${row.id}`).toEqual(row.after.metadata);
  expect(O.getOrElse(result.patch.fullSpanStart, () => row.before.fullSpanStart)).toBe(row.after.fullSpanStart);
  const beforeYear = row.before.year === null ? null : BigInt(row.before.year);
  const afterYear = row.after.year === null ? null : BigInt(row.after.year);
  expect(O.getOrElse(result.patch.numericYear, () => beforeYear)).toBe(afterYear);
});
/** Compare source attribute presence and conditional writes, preserving empty Some values. */
export const replayCitationCaseNameProcess = Effect.fn("CaseNameProcessTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean
) {
  // Source parity is independent of host scheduling; the lifetime test below
  // explicitly triggers and verifies this same captured extraction deadline.
  const setup = yield* install(kind, undefined, false, true);
  const smoke = [13, 55, 137, 185, 197, 201, 239, 243, 251, 293, 301, 305, 313, 321];
  const rows = A.filter(setup.corpus.cases, (row) => full || row.error === "TypeError" || A.contains(smoke, row.id));
  for (const row of rows) yield* assertRow(setup.stage, row);
  expect(rows).toHaveLength(full ? 328 : 114);
  const calls = A.reduce(rows, 0, (sum, row) => sum + (row.error === "TypeError" ? 0 : row.calls.length));
  yield* assertCitationWorkerCompositionReleased(setup.operation, setup.admission, setup.observed.snapshot, calls);
});
/** Exact source int conversion includes large values, parser spaces and digit ceilings. */
export const assertCitationPythonIntegers = Effect.fn("CaseNameProcessTest.integers")(function* () {
  const { patterns } = yield* readCitationCaseNameProcessCorpus();
  const limits = (yield* defaultCitationEnginePolicy).limits;
  const input = yield* makeCitationRegexInput(limits);
  for (const row of patterns.integers) {
    const source = yield* input.prepareUnicode(row.source, () => Effect.void);
    const actual = yield* parseCitationPythonInteger(source.value);
    expect(actual, `int:${row.id}`).toEqual(O.fromNullOr(row.value));
  }
});
/** One enclosing permit/budget covers all nested cleaner work. */
export const assertCitationCaseNameProcessBudget = Effect.fn("CaseNameProcessTest.budget")(function* () {
  const setup = yield* install("bun", 54);
  const row = A.getUnsafe(setup.corpus.cases, 13);
  const accepted = yield* setup.stage.apply(request(row));
  expect(accepted.reservedUnits).toBe(54);
  const bounded = yield* makeCitationCaseNameProcess(
    { ...setup.limits, tokens: 1 },
    setup.runtime,
    setup.configuration
  ).pipe(Effect.provideContext(setup.provided));
  const tokens = yield* bounded.apply(request(row)).pipe(Effect.flip);
  expect(tokens).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "tokens" });
  setup.configuration.patterns.splitV.bytes.fill(0);
  setup.configuration.cleaner.patterns.stopWords.bytes.fill(0);
  const repeated = yield* setup.stage.apply(request(row));
  expect(repeated).toEqual(accepted);
  yield* assertCitationWorkerCompositionReleased(setup.operation, setup.admission, setup.observed.snapshot, 6);
  const tight = yield* install("bun", 53);
  yield* assertCitationMetadataRefusal(
    tight.stage.apply(request(row)),
    tight.operation,
    tight.admission,
    tight.observed.snapshot,
    3
  );
  const enclosing = yield* install("bun", 54, true);
  yield* assertCitationMetadataEnclosingRefusal(enclosing.stage.apply(request(row)), enclosing.budget, 1, 52);
  yield* assertCitationWorkerCompositionReleased(
    enclosing.operation,
    enclosing.admission,
    enclosing.observed.snapshot,
    3
  );
});
/** Captured lifetime/timer reject before a child; no nested admission deadlock. */
export const assertCitationCaseNameProcessLifetime = Effect.fn("CaseNameProcessTest.lifetime")(function* () {
  const scope = yield* Scope.make();
  const closed = yield* install("bun").pipe(Effect.provideService(Scope.Scope, scope));
  for (const configuration of [
    null,
    {
      ...closed.configuration,
      patterns: { ...closed.configuration.patterns, splitV: { width: 1, bytes: new Uint8Array([88]) } },
    },
  ]) {
    const rejected = yield* makeCitationCaseNameProcess(closed.limits, closed.runtime, configuration).pipe(
      Effect.provideContext(closed.provided),
      Effect.flip
    );
    expect(rejected).toMatchObject({ reason: "invalid-configuration" });
  }
  const row = A.getUnsafe(closed.corpus.cases, 13);
  const invalid = yield* closed.stage.apply({}).pipe(Effect.flip);
  expect(invalid).toMatchObject({ reason: "invalid-input" });
  yield* assertCitationWorkerClosedLifetime(scope, closed.stage.apply(request(row)), closed.observed.snapshot);
  const timed = yield* install("bun", undefined, false, true);
  yield* assertCitationWorkerCapturedDeadline(
    timed.stage.apply({ ...request(row), words: [{ width: 1, bytes: new Uint8Array(100000).fill(65) }] }),
    timed.timer.trigger
  );
  yield* assertCitationWorkerCompositionReleased(timed.operation, timed.admission, timed.observed.snapshot, 0);
});

/** The enclosing stage deadline interrupts work without a nested timed helper. */
export const assertCitationMetadataStageDeadline = Effect.fn("CaseNameProcessTest.stageDeadline")(function* () {
  const setup = yield* setupCitationMetadataRuntime("bun", undefined, false, true);
  const started = yield* Deferred.make<void>();
  const released = yield* Ref.make(false);
  const prepare: () => Effect.Effect<never, never, Scope.Scope> = Effect.fn("CaseNameProcessTest.blockStage")(
    function* () {
      yield* Effect.addFinalizer(() => Ref.set(released, true));
      yield* Deferred.succeed(started, undefined);
      return yield* Effect.never;
    }
  );
  const make = makeCitationMetadataStage({
    method: "apply",
    schema: S.Void,
    invalid: () => CitationCaseNameProcessFailure.make({ reason: "invalid-configuration" }),
    own: () => Effect.void,
    prepare,
    project: identity,
  });
  const stage = yield* make(setup.limits, setup.runtime, undefined).pipe(Effect.provideContext(setup.provided));
  yield* assertCitationWorkerCapturedDeadline(
    stage.apply(undefined),
    Deferred.await(started).pipe(Effect.andThen(setup.timer.trigger))
  );
  const didRelease = yield* Ref.get(released);
  expect(didRelease).toBe(true);
  yield* assertCitationWorkerCompositionReleased(setup.operation, setup.admission, setup.observed.snapshot, 0);
});
