/** Original cleanup outputs through existing observed native process owners.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationStopWordsConfiguration,
  makeCitationStopWords,
} from "@beep/law-practice-server/internal/Citation/StopWords";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import {
  assertCitationMetadataEnclosingRefusal,
  assertCitationMetadataFailure,
  assertCitationMetadataRefusal,
  assertCitationWorkerCapturedDeadline,
  assertCitationWorkerClosedLifetime,
  assertCitationWorkerCompositionReleased,
  makeCitationMetadataFixture,
  readCitationOracleFixture,
} from "./CitationRegexWorker.fixtures.ts";
import { CitationNativeUnicodeHex } from "./CitationTokenSeed.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const $I = $LawPracticeServerId.create("test/CitationStopWords");
const Configuration = S.Struct({
  ...CitationStopWordsConfiguration.fields,
  patterns: S.Struct({ stopWords: CitationNativeUnicodeHex, leadingIn: CitationNativeUnicodeHex }),
});
const PatternCorpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-stop-word-patterns/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    python: S.tag("3.11.15"),
    regex: S.tag("2023.12.25"),
    producerSha256: S.tag("1de3bcee927496802de42a41449d2f03ca9f3c993d3387c963bc3f0824108c80"),
    configuration: Configuration,
  })
).pipe(
  $I.annoteSchema("PatternCorpus", {
    description: "Independent original regex-V0 profiles and native fixed source patterns.",
  })
);
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-case-name-process/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    strips: S.Array(
      S.Struct({ id: S.Natural, source: CitationNativeUnicodeHex, result: CitationNativeUnicodeHex })
    ).check(S.isBetweenLength(178, 178)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Source cleanup outputs; the complete processing corpus is independently byte sealed.",
  })
);
const load = Effect.fn("StopWordsTest.load")(function* () {
  const read = readCitationOracleFixture;
  const config = yield* read(
    "stop-word-patterns",
    "98bdf393eb38077254b0a241767ef935ee4adaf04184c0d29b08565b1c5fa1ae"
  ).pipe(Effect.flatMap(S.decodeEffect(PatternCorpus)));
  const corpus = yield* read(
    "case-name-process",
    "027c7f42d55d4fe9ee6f000c98c6427d4931f45bf82675277f60864762b51505"
  ).pipe(Effect.flatMap(S.decodeEffect(Corpus)));
  return { configuration: config.configuration, corpus };
});
const install = makeCitationMetadataFixture({ load, make: makeCitationStopWords });
/** Smoke contains inline case, every semicolon shape, native surrogate controls and adjacency. */
export const replayCitationStopWords = Effect.fn("StopWordsTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean
) {
  const setup = yield* install(kind);
  const rows = A.filter(
    setup.corpus.strips,
    (row) => full || A.contains([0, 2, 6, 10, 11, 12, 13, 14, 16, 17, 19, 20, 21, 22], row.id)
  );
  for (const row of rows) expect((yield* setup.stage.clean(row.source)).text, `${kind}:${row.id}`).toEqual(row.result);
  expect(rows).toHaveLength(full ? 178 : 14);
  yield* assertCitationWorkerCompositionReleased(
    setup.operation,
    setup.admission,
    setup.observed.snapshot,
    rows.length * 3
  );
});
/** Refuse cumulative over-allocation and preserve configuration after caller mutation. */
export const assertCitationStopWordsBudget = Effect.fn("StopWordsTest.budget")(function* () {
  const setup = yield* install("bun", 81);
  const row = A.getUnsafe(setup.corpus.strips, 2);
  const accepted = yield* setup.stage.clean(row.source);
  expect(accepted.text).toEqual(row.result);
  expect(accepted.reservedUnits).toBe(81);
  setup.configuration.patterns.stopWords.bytes.fill(0);
  setup.configuration.patterns.leadingIn.bytes.fill(0);
  const repeated = yield* setup.stage.clean(row.source);
  expect(repeated).toEqual(accepted);
  yield* assertCitationWorkerCompositionReleased(setup.operation, setup.admission, setup.observed.snapshot, 6);
  const tight = yield* install("bun", 80);
  yield* assertCitationMetadataRefusal(
    tight.stage.clean(row.source),
    tight.operation,
    tight.admission,
    tight.observed.snapshot,
    3
  );
  const enclosing = yield* install("bun", 81, true);
  yield* assertCitationMetadataEnclosingRefusal(enclosing.stage.clean(row.source), enclosing.budget, 1, 77);
  yield* assertCitationWorkerCompositionReleased(
    enclosing.operation,
    enclosing.admission,
    enclosing.observed.snapshot,
    3
  );
});
/** Preserve closed parent lifetime, captured timer and closed invalid-input failure. */
export const assertCitationStopWordsLifetime = Effect.fn("StopWordsTest.lifetime")(function* () {
  const scope = yield* Scope.make();
  const closed = yield* install("bun").pipe(Effect.provideService(Scope.Scope, scope));
  for (const configuration of [
    null,
    {
      ...closed.configuration,
      patterns: { ...closed.configuration.patterns, stopWords: { width: 1, bytes: new Uint8Array([88]) } },
    },
  ]) {
    const rejected = yield* makeCitationStopWords(closed.limits, closed.runtime, configuration).pipe(
      Effect.provideContext(closed.provided),
      Effect.flip
    );
    expect(rejected).toMatchObject({ reason: "invalid-configuration" });
  }
  const row = A.getUnsafe(closed.corpus.strips, 2);
  yield* assertCitationWorkerClosedLifetime(scope, closed.stage.clean(row.source), closed.observed.snapshot);
  const timed = yield* install("bun", undefined, false, true);
  yield* assertCitationWorkerCapturedDeadline(
    timed.stage.clean({ width: 1, bytes: new Uint8Array(100000).fill(65) }),
    timed.timer.trigger
  );
  yield* assertCitationWorkerCompositionReleased(timed.operation, timed.admission, timed.observed.snapshot, 0);
  const invalid = yield* install("bun");
  yield* assertCitationMetadataFailure(invalid.stage.clean(null), {
    _tag: "CitationStopWordsFailure",
    reason: "invalid-input",
  });
  yield* assertCitationWorkerCompositionReleased(invalid.operation, invalid.admission, invalid.observed.snapshot, 0);
});
