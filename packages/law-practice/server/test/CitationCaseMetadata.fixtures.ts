/** Original whole-model metadata transitions through the connected Effect stage.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEditionRef } from "@beep/law-practice-domain/values";
import {
  CitationCaseMetadataFields,
  makeCitationCaseMetadata,
} from "@beep/law-practice-server/internal/Citation/CaseMetadata";
import {
  CitationFrozenEditions,
  makeCitationFrozenEditions,
} from "@beep/law-practice-server/internal/Citation/FrozenEditions";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { readCitationCaseNameCorpus } from "./CitationCaseName.fixtures.ts";
import { loadCitationFrozenEditionFixtures } from "./CitationFrozenEditions.fixtures.ts";
import { readCitationHtmlCaseNameCorpus } from "./CitationHtmlCaseName.fixtures.ts";
import {
  installCitationHtmlGeometryFixture,
  prepareCitationOptionalHtmlGeometry,
} from "./CitationHtmlGeometryPreparation.fixtures.ts";
import { readCitationPostCaseMetadataCorpus } from "./CitationPostCaseMetadata.fixtures.ts";
import { readCitationPreCaseMetadataCorpus } from "./CitationPreCaseMetadata.fixtures.ts";
import {
  assertCitationWorkerCompositionReleased,
  readCitationOracleFixture,
  setupCitationMetadataRuntime,
} from "./CitationRegexWorker.fixtures.ts";
import { CitationCaseNameDocument, CitationNativeUnicodeHex } from "./CitationTokenSeed.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const $I = $LawPracticeServerId.create("test/CitationCaseMetadata");
const Native = CitationNativeUnicodeHex;
const Value = S.NullOr(Native);
const Metadata = S.Struct({
  plaintiff: Value,
  defendant: Value,
  antecedent_guess: Value,
  court: Value,
  pin_cite: Value,
  pin_cite_span_start: S.NullOr(S.Int),
  pin_cite_span_end: S.NullOr(S.Int),
  extra: Value,
  parenthetical: Value,
  year: Value,
  month: Value,
  day: Value,
  resolved_case_name: Value,
  resolved_case_name_short: Value,
});
const Snapshot = S.Struct({
  metadata: Metadata,
  year: S.NullOr(S.Int),
  fullSpanStart: S.NullOr(S.Int),
  fullSpanEnd: S.NullOr(S.Int),
  fullSpan: S.Tuple([S.Int, S.Int]),
  span: S.Tuple([S.Int, S.Int]),
  exact: S.Array(CitationEditionRef),
  variation: S.Array(CitationEditionRef),
  editionGuess: S.NullOr(CitationEditionRef),
});
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-case-metadata/v1"),
    snapshots: S.Array(Snapshot).check(S.isBetweenLength(150, 150)),
    documents: S.Array(S.Struct({ ...CitationCaseNameDocument.fields, hasMarkup: S.Boolean })).check(
      S.isBetweenLength(40, 40)
    ),
    cases: S.Array(
      S.Struct({
        id: S.Natural,
        document: S.Natural,
        initial: S.Natural,
        final: S.Natural,
        trace: S.Array(S.Struct({ phase: S.String, before: S.Natural, after: S.Natural })),
        regexCalls: S.Array(S.Struct({ phase: S.String, method: S.String, count: S.Int.check(S.isGreaterThan(0)) })),
      })
    ).check(S.isBetweenLength(80, 80)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description:
      "Complete before/after original full-case states, source phase transitions and lossless ordered regex call runs.",
  })
);
const metadataOf = (source: typeof Metadata.Type) =>
  CitationCaseMetadataFields.make({
    plaintiff: source.plaintiff,
    defendant: source.defendant,
    antecedentGuess: source.antecedent_guess,
    court: source.court,
    pinCite: source.pin_cite,
    pinCiteSpanStart: source.pin_cite_span_start,
    pinCiteSpanEnd: source.pin_cite_span_end,
    extra: source.extra,
    parenthetical: source.parenthetical,
    year: source.year,
    month: source.month,
    day: source.day,
    resolvedCaseName: source.resolved_case_name,
    resolvedCaseNameShort: source.resolved_case_name_short,
  });
/** Reuse authenticated case helper installation data in enclosing extraction. */
export const readCitationCaseMetadataConfiguration = Effect.fn("CaseMetadataTest.configuration")(function* () {
  const names = yield* readCitationCaseNameCorpus();
  const html = yield* readCitationHtmlCaseNameCorpus();
  const post = yield* readCitationPostCaseMetadataCorpus();
  const pre = yield* readCitationPreCaseMetadataCorpus();
  return {
    post: post.configuration,
    pre: pre.configuration,
    names: { plain: names.configuration, html: html.configuration },
  };
});
const install = Effect.fn("CaseMetadataTest.install")(function* (
  kind: CitationNativeRuntimeKind,
  maximum?: number,
  enclosing = false
) {
  const configuration = yield* readCitationCaseMetadataConfiguration();
  const corpus = yield* readCitationOracleFixture(
    "case-metadata",
    "a374a736cc27a3954165e0acfeca926a2adb92e7eacdbe6180794017afcd77a9"
  ).pipe(Effect.flatMap(S.decodeEffect(Corpus)));
  const { bundle } = yield* loadCitationFrozenEditionFixtures();
  const owner = yield* makeCitationFrozenEditions(bundle);
  const setup = yield* setupCitationMetadataRuntime(kind, maximum, enclosing, true, 8192);
  const instant = yield* Effect.fromOption(DateTime.make("2026-11-06T00:00:00Z"));
  const millis = DateTime.toEpochMillis(instant);
  const clock = {
    ...setup.timer.clock,
    currentTimeMillisUnsafe: () => millis,
    currentTimeMillis: Effect.succeed(millis),
    currentTimeNanosUnsafe: () => BigInt(millis) * BigInt(1000000),
    currentTimeNanos: Effect.succeed(BigInt(millis) * BigInt(1000000)),
  };
  const provided = setup.provided.pipe(Context.add(Clock.Clock, clock), Context.add(CitationFrozenEditions, owner));
  const prepare = yield* installCitationHtmlGeometryFixture(kind, { ...setup, provided });
  const stage = yield* makeCitationCaseMetadata(setup.limits, setup.runtime, configuration).pipe(
    Effect.provideContext(provided),
    DateTime.withCurrentZoneOffset(0)
  );
  return { corpus, setup, prepare, stage };
});
type Row = (typeof Corpus.Type.cases)[number];
const requestOf = Effect.fn("CaseMetadataTest.request")(function* (
  installed: Effect.Success<ReturnType<typeof install>>,
  row: Row
) {
  const { corpus, prepare } = installed;
  const document = A.getUnsafe(corpus.documents, row.document);
  const before = A.getUnsafe(corpus.snapshots, row.initial);
  const geometry = yield* prepareCitationOptionalHtmlGeometry(prepare, document, document.hasMarkup);
  return {
    ...before,
    metadata: metadataOf(before.metadata),
    prior: before.editionGuess,
    words: A.map(document.words, (word) => ({ ...word, kind: word.kind === "str" ? "Text" : word.kind })),
    index: document.index,
    spanStart: before.span[0],
    spanEnd: before.span[1],
    geometry,
  };
});
const assertRow = Effect.fn("CaseMetadataTest.row")(function* (
  installed: Effect.Success<ReturnType<typeof install>>,
  row: Row
) {
  const { corpus, stage } = installed;
  const document = A.getUnsafe(corpus.documents, row.document);
  const after = A.getUnsafe(corpus.snapshots, row.final);
  const request = yield* requestOf(installed, row);
  const invocation = stage.extract(request);
  const closed: Effect.Effect<Effect.Success<typeof invocation>, Effect.Error<typeof invocation>> = invocation;
  const result = yield* closed;
  expect(result.metadata, `metadata:${row.id}`).toEqual(metadataOf(after.metadata));
  expect(result.year === null ? null : BigInt(result.year)).toEqual(after.year === null ? null : BigInt(after.year));
  expect(result.fullSpanStart).toBe(after.fullSpanStart);
  expect(result.fullSpanEnd).toBe(after.fullSpanEnd);
  expect(result.editionGuess).toBe(after.editionGuess);
  expect(result.usedHtml).toBe(A.some(row.trace, (step) => step.phase === "HtmlName"));
  expect(result.usedPlain).toBe(A.some(row.trace, (step) => step.phase === "PlainName"));
  // The frozen court lookup replaces source court-normalization substitutions;
  // every regex in the other source paths executes through the owned worker.
  const regex = A.reduce(
    row.regexCalls,
    0,
    (total, call) => total + (call.phase === "Post" && call.method === "sub" ? 0 : call.count)
  );
  return regex + (document.hasMarkup ? 4 : 0);
});
/** Assert final original model fields after all five phase families, on both runtimes. */
export const replayCitationCaseMetadata = Effect.fn("CaseMetadataTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean
) {
  const installed = yield* install(kind);
  const rows = A.filter(installed.corpus.cases, (row) => full || A.contains([0, 6, 10, 18, 22, 48, 60, 66], row.id));
  let children = 0;
  for (const row of rows) children += yield* assertRow(installed, row);
  expect(rows).toHaveLength(full ? 80 : 8);
  yield* assertCitationWorkerCompositionReleased(
    installed.setup.operation,
    installed.setup.admission,
    installed.setup.observed.snapshot,
    children
  );
});

/** Refuse during final court production rather than give each metadata helper a fresh allowance. */
export const assertCitationCaseMetadataBudget = Effect.fn("CaseMetadataTest.sharedBudget")(function* () {
  const regular = yield* install("bun", undefined, true);
  const row = A.getUnsafe(regular.corpus.cases, 0);
  const request = yield* requestOf(regular, row);
  const accepted = yield* regular.stage.extract(request);
  const total = yield* regular.setup.budget.snapshot;
  expect(total).toBe(accepted.reservedUnits);
  yield* assertCitationWorkerCompositionReleased(
    regular.setup.operation,
    regular.setup.admission,
    regular.setup.observed.snapshot,
    18
  );
  const tight = yield* install("bun", total - 1, true);
  const tightRequest = yield* requestOf(tight, row);
  const refused = yield* tight.stage.extract(tightRequest).pipe(Effect.flip);
  expect(refused).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "producedTextUtf16" });
  const spent = yield* tight.setup.budget.snapshot;
  expect(spent).toBeGreaterThan(0);
  expect(spent).toBeLessThan(total);
  yield* assertCitationWorkerCompositionReleased(
    tight.setup.operation,
    tight.setup.admission,
    tight.setup.observed.snapshot,
    18
  );
});
