/** Original post-case observations and shared actual-runtime fixture installation.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { makeCitationPinCiteCleaner } from "@beep/law-practice-server/internal/Citation/MetadataStrings";
import {
  CitationPostCaseMetadataConfiguration,
  CitationPostCaseMetadataInput,
  makeCitationPostCaseMetadata,
} from "@beep/law-practice-server/internal/Citation/PostCaseMetadata";
import { CitationTextBudget, makeCitationTextBudget } from "@beep/law-practice-server/internal/Citation/TextBudget";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { Sha256HexFromBytes } from "@beep/schema";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  assertCitationMetadataEnclosingRefusal,
  assertCitationMetadataFixtureLifetime,
  assertCitationMetadataRefusal,
  assertCitationWorkerCompositionReleased,
  citationMetadataDeadlineText,
  makeCitationMetadataFixtureInstaller,
  setupCitationMetadataRuntime,
} from "./CitationRegexWorker.fixtures.ts";
import { CitationNativeUnicodeHex } from "./CitationTokenSeed.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const $I = $LawPracticeServerId.create("test/CitationPostCaseMetadata");
const Value = S.NullOr(CitationNativeUnicodeHex);
const Input = S.Struct({
  ...CitationPostCaseMetadataInput.fields,
  words: S.Array(S.Struct({ kind: CitationPostCaseMetadataInput.fields.words.value.fields.kind, data: Value })),
  pinCiteSpanEnd: S.NullOr(S.Int),
  court: Value,
});
const Metadata = S.Struct({
  pinCite: Value,
  extra: Value,
  parenthetical: Value,
  year: Value,
  month: Value,
  day: Value,
});
const Observed = S.Struct({
  fullSpanEnd: S.Int,
  year: S.NullOr(S.Int),
  pinCiteSpanEnd: S.NullOr(S.Int),
  court: S.NullOr(S.String),
  metadata: Metadata,
});
const Configuration = S.Struct({
  ...CitationPostCaseMetadataConfiguration.fields,
  pattern: CitationNativeUnicodeHex,
  yearPattern: CitationNativeUnicodeHex,
});
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-post-case-metadata/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    python: S.tag("3.11.15"),
    regex: S.tag("2023.12.25"),
    producerSha256: S.tag("d08b0e2c5f799b33891628bc62ce74860ba5377e0ae35854f694cf52444a3c88"),
    patternSha256: S.tag("173f538b2d3f8f2522eeb298388114e59bca173d00e03ac7f7b844f02c1be040"),
    configuration: Configuration,
    strips: S.Array(S.Struct({ source: Value, result: Value })).check(S.isBetweenLength(37, 37)),
    cases: S.Array(
      S.Struct({ id: S.Natural, smoke: S.Boolean, request: Input, observed: Observed, calls: S.Natural })
    ).check(S.isBetweenLength(184, 184)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Actual original helper outputs with prior-state and native point controls.",
  })
);
/** Read authenticated original helper configuration and state observations. */
export const readCitationPostCaseMetadataCorpus = Effect.fn("PostCaseMetadataTest.load")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const bytes = yield* fs.readFile(
    NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/post-case-metadata.json", import.meta.url))
  );
  const hash = yield* S.decodeEffect(Sha256HexFromBytes)(bytes);
  expect(hash).toBe("cbaab9900587e97522d7a442326ae4604cbed97bc655204cf919baa996d6b48a");
  return yield* S.decodeEffect(Corpus)(new TextDecoder().decode(bytes));
});
const install = makeCitationMetadataFixtureInstaller(makeCitationPostCaseMetadata)(
  readCitationPostCaseMetadataCorpus()
);
/** Full replay is hosted; smoke compares all field writes through both actual runtimes. */
export const replayCitationPostCaseMetadata = Effect.fn("PostCaseMetadataTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean
) {
  const setup = yield* install(kind, undefined, false, false, 8192);
  const rows = full ? setup.corpus.cases : A.filter(setup.corpus.cases, (row) => row.smoke);
  for (const row of rows) {
    const actual = yield* setup.stage.apply(row.request);
    const seed = { width: 1, bytes: new TextEncoder().encode("SEED") };
    const priorCourt = row.request.court === null ? null : new TextDecoder().decode(row.request.court.bytes);
    const observed = O.match(actual.patch, {
      onNone: () => ({
        fullSpanEnd: 777,
        year: row.request.year,
        pinCiteSpanEnd: row.request.pinCiteSpanEnd,
        court: priorCourt,
        metadata: { pinCite: seed, extra: seed, parenthetical: seed, year: seed, month: seed, day: seed },
      }),
      onSome: (patch) => ({
        fullSpanEnd: patch.fullSpanEnd,
        year: patch.year,
        pinCiteSpanEnd: O.getOrElse(patch.metadata.pinCiteSpanEnd, () => row.request.pinCiteSpanEnd),
        court: O.getOrElse(patch.metadata.court, () => priorCourt),
        metadata: {
          pinCite: patch.metadata.pinCite,
          extra: patch.metadata.extra,
          parenthetical: patch.metadata.parenthetical,
          year: patch.metadata.year,
          month: patch.metadata.month,
          day: patch.metadata.day,
        },
      }),
    });
    expect(observed, `source post-case ${row.id}`).toEqual(row.observed);
  }
  expect(rows).toHaveLength(full ? 184 : 16);
  const calls = A.reduce(rows, 0, (total, row) => total + row.calls);
  expect(calls).toBe(full ? 220 : 22);
  yield* assertCitationWorkerCompositionReleased(setup.operation, setup.admission, setup.observed.snapshot, calls);
});

/** Exact preflight and captured configuration with one shared invocation owner. */
export const assertCitationPostCaseBudget = Effect.fn("PostCaseMetadataTest.budget")(function* () {
  const exact = yield* install("bun", 31, false, false, 8192);
  const row = A.getUnsafe(exact.corpus.cases, 15);
  const configuration = { ...exact.corpus.configuration };
  const captured = yield* makeCitationPostCaseMetadata(exact.limits, exact.runtime, configuration).pipe(
    Effect.provideContext(exact.provided)
  );
  const accepted = yield* captured.apply(row.request);
  expect(accepted.reservedUnits).toBe(31);
  configuration.pattern.bytes.fill(0);
  configuration.yearPattern.bytes.fill(0);
  configuration.courtTable = "corrupted caller table";
  const repeated = yield* captured.apply(row.request);
  expect(repeated).toEqual(accepted);
  const tight = yield* install("bun", 30, false, false, 8192);
  yield* assertCitationMetadataRefusal(
    tight.stage.apply(row.request),
    tight.operation,
    tight.admission,
    tight.observed.snapshot,
    1
  );
  const enclosing = yield* install("bun", 34, true, false, 8192);
  yield* assertCitationMetadataEnclosingRefusal(enclosing.stage.apply(row.request), enclosing.budget, 4, 33);
});
/** Parent lifetime and captured deadline prevent native worker creation. */
export const assertCitationPostCaseLifetime = Effect.fn("PostCaseMetadataTest.lifetime")(function* () {
  yield* assertCitationMetadataFixtureLifetime(
    install,
    15,
    [
      { kind: "CitationToken", data: { width: 1, bytes: new TextEncoder().encode("1 X 1") } },
      citationMetadataDeadlineText(),
    ],
    8192
  );
});

/** Frozen Python whitespace and literal-surrogate controls stay native. */
export const assertCitationPostCaseWhitespace = Effect.fn("PostCaseMetadataTest.whitespace")(function* () {
  const corpus = yield* readCitationPostCaseMetadataCorpus();
  const policy = yield* defaultCitationEnginePolicy;
  const strings = yield* makeCitationPinCiteCleaner(policy.limits);
  for (const row of corpus.strips) {
    const actual = yield* strings.stripWhitespace(row.source);
    expect(actual).toEqual(row.result);
  }
});

/** Installation rejects malformed policy/configuration and mismatched fixed patterns before spawning. */
export const assertCitationPostCaseMetadataConfiguration = Effect.fn("PostCaseMetadataTest.configuration")(
  function* () {
    const corpus = yield* readCitationPostCaseMetadataCorpus();
    const setup = yield* setupCitationMetadataRuntime("bun");
    const changedPattern = { width: 1, bytes: new TextEncoder().encode("altered fixed pattern") };
    for (const [policy, runtime, configuration] of [
      [{}, setup.runtime, corpus.configuration],
      [setup.limits, setup.runtime, {}],
      [setup.limits, {}, corpus.configuration],
      [setup.limits, setup.runtime, { ...corpus.configuration, pattern: changedPattern }],
    ]) {
      const failed = yield* makeCitationPostCaseMetadata(policy, runtime, configuration).pipe(
        Effect.provideContext(setup.provided),
        Effect.flip
      );
      expect(failed).toMatchObject({ reason: "invalid-configuration" });
    }
    const oversized = yield* makeCitationTextBudget({
      ...setup.limits,
      producedTextUtf16: setup.limits.producedTextUtf16 + 1,
    });
    const failed = yield* makeCitationPostCaseMetadata(setup.limits, setup.runtime, corpus.configuration).pipe(
      Effect.provideContext(Context.add(setup.provided, CitationTextBudget, oversized)),
      Effect.flip
    );
    expect(failed).toMatchObject({ _tag: "CitationCourtLookupFailure", reason: "invalid-policy" });
    const observed = yield* setup.observed.snapshot;
    expect(observed).toEqual({ spawned: 0, confirmed: 0 });
  }
);
