/** Actual original caller decisions through shared HTML/plain operation ownership.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { makeCitationCaseNameSelection } from "@beep/law-practice-server/internal/Citation/CaseNameSelection";
import { makeCitationHtmlGeometryPreparation } from "@beep/law-practice-server/internal/Citation/HtmlGeometryPreparation";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { assertCitationCaseNamePatch, readCitationCaseNameCorpus } from "./CitationCaseName.fixtures.ts";
import { makeCitationDiffTestRuntime } from "./CitationDiffWorker.fixtures.ts";
import { readCitationHtmlCaseNameCorpus } from "./CitationHtmlCaseName.fixtures.ts";
import { readCitationHtmlDiscoveryCorpus } from "./CitationHtmlDiscovery.fixtures.ts";
import {
  assertCitationWorkerCompositionReleased,
  readCitationOracleFixture,
  setupCitationMetadataRuntime,
} from "./CitationRegexWorker.fixtures.ts";
import { CitationNativeUnicodeHex } from "./CitationTokenSeed.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const $I = $LawPracticeServerId.create("test/CitationCaseNameSelection");
const Native = CitationNativeUnicodeHex;
const Snapshot = S.Struct({
  metadata: S.Record(S.String, S.Union([S.Null, Native, S.Int])),
  year: S.NullOr(S.Int),
  fullSpanStart: S.NullOr(S.Int),
  fullSpanEnd: S.NullOr(S.Int),
  fullSpan: S.Tuple([S.Int, S.Int]),
  span: S.Tuple([S.Int, S.Int]),
});
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-case-name-selection/v1"),
    documents: S.Array(
      S.Struct({
        markup: Native,
        plain: Native,
        index: S.Int,
        words: S.Array(
          S.Struct({
            kind: S.String,
            data: Native,
            start: S.NullOr(S.Int),
            groups: S.Record(S.String, S.NullOr(Native)),
          })
        ),
      })
    ).check(S.isBetweenLength(68, 68)),
    cases: S.Array(
      S.Struct({
        id: S.Natural,
        document: S.Natural,
        mode: S.Literals(["Full", "Short"]),
        hasMarkup: S.Boolean,
        before: Snapshot,
        after: Snapshot,
        trace: S.Array(S.String),
        regexCalls: S.Array(S.String),
      })
    ).check(S.isBetweenLength(272, 272)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description:
      "Original full/short callers with complete before/after name-phase state and ordered helper observations.",
  })
);
const install = Effect.fn("CaseNameSelectionTest.install")(function* (kind: CitationNativeRuntimeKind) {
  const plain = yield* readCitationCaseNameCorpus();
  const html = yield* readCitationHtmlCaseNameCorpus();
  const discovery = yield* readCitationHtmlDiscoveryCorpus();
  const corpus = yield* readCitationOracleFixture(
    "case-name-selection",
    "20690a9a72d7206b50c8f039edd5fe531262d3bf079035c8fcb2367e6aadb29b"
  ).pipe(Effect.flatMap(S.decodeEffect(Corpus)));
  const setup = yield* setupCitationMetadataRuntime(kind, undefined, false, true, 8192);
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "citation-name-selection-diff-" });
  const diffRuntime = yield* makeCitationDiffTestRuntime(kind, directory);
  const prepare = yield* makeCitationHtmlGeometryPreparation(setup.limits, setup.runtime, {
    discovery: discovery.configuration,
    diffRuntime,
  }).pipe(Effect.provideContext(setup.provided));
  const stage = yield* makeCitationCaseNameSelection(setup.limits, setup.runtime, {
    plain: plain.configuration,
    html: html.configuration,
  }).pipe(Effect.provideContext(setup.provided));
  return { corpus, setup, prepare, stage };
});
/** Empty assignments and retained empty fields suppress fallback; plain-only calls still scan. */
export const replayCitationCaseNameSelection = Effect.fn("CaseNameSelectionTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean
) {
  const { corpus, setup, prepare, stage } = yield* install(kind);
  const rows = A.filter(corpus.cases, (row) => full || A.contains([0, 3, 7, 259, 267, 268, 269, 271], row.id));
  let children = 0;
  for (const row of rows) {
    const document = A.getUnsafe(corpus.documents, row.document);
    const geometry = row.hasMarkup
      ? yield* prepare
          .prepare({ plain: document.plain, markup: document.markup })
          .pipe(Effect.map((result) => O.some(result.geometry)))
      : O.none();
    const invocation = stage.extract({
      words: A.map(document.words, (word) => ({ ...word, kind: word.kind === "str" ? "Text" : word.kind })),
      index: document.index,
      spanStart: row.before.span[0],
      mode: row.mode,
      geometry,
      currentName: O.getOrElse(
        R.get(row.before.metadata, row.mode === "Short" ? "antecedent_guess" : "defendant"),
        () => null
      ),
    });
    const closed: Effect.Effect<Effect.Success<typeof invocation>, Effect.Error<typeof invocation>> = invocation;
    const result = yield* closed;
    yield* assertCitationCaseNamePatch(result, row, kind);
    expect(row.after.fullSpanEnd).toEqual(row.before.fullSpanEnd);
    expect(row.after.span).toEqual(row.before.span);
    expect(row.after.fullSpan).toEqual([
      row.after.fullSpanStart ?? row.after.span[0],
      row.after.fullSpanEnd ?? row.after.span[1],
    ]);
    expect(result.usedHtml).toBe(A.contains(row.trace, "html"));
    expect(result.usedPlain).toBe(A.contains(row.trace, "plain"));
    children += row.regexCalls.length + (row.hasMarkup ? 4 : 0);
  }
  expect(rows).toHaveLength(full ? 272 : 8);
  yield* assertCitationWorkerCompositionReleased(setup.operation, setup.admission, setup.observed.snapshot, children);
});
