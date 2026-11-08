/** Original canonical extraction inputs and independently constructed expectations.
 * @internal @packageDocumentation @since 0.0.0
 */

import { ResolvedSourceText, SourceTextResolver } from "@beep/file-processing/SourceText";
import { Citation } from "@beep/law-practice-domain/values";
import { CitationEngineSourcePairInput } from "@beep/law-practice-use-cases/server";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import {
  makeCitationCanonicalAttributeAssertion,
  projectCitationCanonicalExpectedMetadata,
  readCitationCanonicalAttributeLinks,
} from "./CitationCanonicalAttributes.fixtures.ts";
import { installCitationDefaultConfigurationFixture } from "./CitationDefaultConfiguration.fixtures.ts";
import { buildCitationDefaultEngineFixture } from "./CitationEngineLayer.fixtures.ts";
import { assertCitationMentionRanges, citationFixtureSourceProof } from "./CitationOccurrenceProjection.fixtures.ts";
import { readCitationOracleFixture } from "./CitationRegexWorker.fixtures.ts";
import { projectCitationSemanticMetadata } from "./CitationSemanticExtraction.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const Expected = S.Struct({
  citationType: S.Literals([
    "FullCaseCitation",
    "ShortCaseCitation",
    "IdCitation",
    "SupraCitation",
    "ReferenceCitation",
    "UnknownCitation",
    "FullLawCitation",
    "FullJournalCitation",
  ]),
  fields: S.Struct({
    groups: S.Record(S.String, S.NullOr(S.String)),
    metadata: S.Struct({ fields: S.Record(S.String, S.NullOr(S.String)) }),
  }),
});
const Capture = S.fromJsonString(
  S.Struct({
    events: S.Array(S.Struct({ id: S.String, test: S.String, payload: S.String })),
  })
);
const Header = S.fromJsonString(S.Struct({ context: S.Struct({ values: S.JsonObject }) }));
const CountOperand = S.Struct({
  kind: S.tag("value"),
  value: S.Array(S.Struct({ pythonType: S.String })),
});
const CountAssertion = S.fromJsonString(
  S.Struct({
    passed: S.tag(true),
    relation: S.Struct({ kind: S.tag("comparison"), equal: S.tag(true) }),
    operands: S.Tuple([CountOperand, CountOperand, S.Struct({ kind: S.tag("value"), value: S.String })]),
  })
);

const Input = S.Struct({
  q: S.String,
  kwargs: S.Struct({
    plain_text: S.optionalKey(S.String),
    markup_text: S.optionalKey(S.String),
    remove_ambiguous: S.optionalKey(S.Boolean),
    clean_steps: S.Literals(["html", "inline_whitespace", "all_whitespace"]).pipe(S.Array, S.optionalKey),
  }),
  tokenizer: S.Struct({ tokenizer: S.tag("Tokenizer") }),
  cites_found: S.Array(
    S.Struct({
      span: S.Tuple([S.Int, S.Int]),
      fullSpan: S.Tuple([S.Int, S.Int]),
      spanWithPincite: S.Tuple([S.Int, S.Int]),
    })
  ),
  expected_cites: S.Array(Expected),
});
const kinds = R.fromEntries([
  ["FullCaseCitation", "case"],
  ["ShortCaseCitation", "shortFormCase"],
  ["IdCitation", "id"],
  ["SupraCitation", "supra"],
  ["ReferenceCitation", "reference"],
  ["UnknownCitation", "unknown"],
  ["FullLawCitation", "law"],
  ["FullJournalCitation", "journal"],
]);
const assertCitation = Effect.fn("CanonicalExtractionTest.compare")(function* (
  citation: Citation,
  original: typeof Expected.Type,
  id: string
) {
  const encoded = yield* S.encodeEffect(Citation)(citation);
  expect(encoded.type, id).toBe(kinds[original.citationType]);
  expect(encoded.components, id).toEqual(original.fields.groups);
  const actual = yield* projectCitationSemanticMetadata(citation);
  expect(actual, id).toEqual(projectCitationCanonicalExpectedMetadata(original.fields.metadata.fields));
});
const families = {
  case: { method: "test_find_citations", count: 130 },
  law: { method: "test_find_law_citations", count: 10 },
  journal: { method: "test_find_journal_citations", count: 6 },
  tax: { method: "test_find_tc_citations", count: 4 },
  ambiguous: { method: "test_disambiguate_citations", count: 11 },
  markup: { method: "test_markup_plaintiff_and_antecedent_guesses", count: 32 },
} as const;
/** Select original builtin count assertions, retaining one row per invocation.
 * The parallel attribute assertions and other tokenizer implementations remain
 * separate obligations. No expected output is obtained from the target.
 * @internal @category testing @since 0.0.0
 */
export const readCitationCanonicalExtractions = Effect.fn("CanonicalExtractionTest.read")(function* (
  family: keyof typeof families = "case"
) {
  const raw = yield* readCitationOracleFixture(
    "assertion-cases",
    "c7ea12ec5ba0d66257affc4c6e54e8b2fa2ffdd0d79f41c1b701000e0edaf33f"
  );
  const capture = yield* S.decodeEffect(Capture)(raw);
  const selected = A.filter(
    capture.events,
    (row) => row.test === `tests.test_FindTest.FindTest.${families[family].method}`
  );
  const attributeLinks = yield* readCitationCanonicalAttributeLinks(selected);
  const rows = [];
  for (const row of selected) {
    const header = yield* S.decodeEffect(Header)(row.payload);
    if (!S.is(Input)(header.context.values)) continue;
    const input = yield* S.decodeEffect(Input)(header.context.values);
    const assertion = yield* S.decodeEffect(CountAssertion)(row.payload);
    const expectedTypes = A.map(assertion.operands[1].value, (value) => value.pythonType);
    expect(expectedTypes, row.id).toEqual(A.map(input.expected_cites, (cite) => `eyecite.models.${cite.citationType}`));
    expect(
      A.map(assertion.operands[0].value, (value) => value.pythonType),
      row.id
    ).toEqual(expectedTypes);
    const attributes = yield* Effect.fromOption(HashMap.get(attributeLinks, row.id));
    expect(attributes, row.id).toHaveLength(input.expected_cites.length);
    rows.push({ id: row.id, input, attributes });
  }
  expect(rows).toHaveLength(families[family].count);
  return rows;
});
/** Replay original raw text and cleaning selections through production assembly.
 * Shards bound individual test duration without removing any full-corpus input.
 * @internal @category testing @since 0.0.0
 */
export const replayCitationCanonicalExtraction = Effect.fn("CanonicalExtractionTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  shard: number,
  size: number,
  family: keyof typeof families = "case"
) {
  const rows = yield* readCitationCanonicalExtractions(family);
  const selected = rows.slice(shard * size, (shard + 1) * size);
  expect(selected.length).toBeGreaterThan(0);
  const installed = yield* installCitationDefaultConfigurationFixture(kind);
  let proof = yield* citationFixtureSourceProof("initial");
  const resolver = SourceTextResolver.of({
    resolve: Effect.fn("CanonicalExtractionTest.resolve")(() =>
      Effect.succeed(ResolvedSourceText.make({ identity: proof.source, text: proof.sourceText }))
    ),
  });
  const { engine } = yield* buildCitationDefaultEngineFixture(installed, resolver);
  const assertAttributes = yield* makeCitationCanonicalAttributeAssertion(installed);
  const replayRow = Effect.fn("CanonicalExtractionTest.replayRow")(function* (row: (typeof rows)[number]) {
    proof = yield* citationFixtureSourceProof(row.input.q);
    const source = { source: proof.source, sourceText: proof.sourceText };
    const html = row.input.kwargs.markup_text !== undefined;
    const input = CitationEngineSourcePairInput.make({
      plain: html ? null : source,
      markup: html ? source : null,
      cleanSteps: row.input.kwargs.clean_steps ?? [],
      removeAmbiguous: row.input.kwargs.remove_ambiguous ?? false,
      container: "list",
    });
    const result = yield* engine.extract(input);
    expect(result.citations, row.id).toHaveLength(row.input.expected_cites.length);
    for (const [actual, expected] of A.zip(result.citations, row.input.expected_cites))
      yield* assertCitation(actual, expected, row.id);
    for (const [actual, attribute] of A.zip(result.citations, row.attributes))
      yield* assertAttributes(actual, attribute);
    expect(result.document.mentions, row.id).toHaveLength(row.input.cites_found.length);
    for (const [mention, original] of A.zip(result.document.mentions, row.input.cites_found))
      yield* assertCitationMentionRanges(result.source.source.sourceText, mention, original);
    expect(result.diagnostics.unverified, row.id).toEqual([]);
    expect(result.diagnostics.unverifiedComponents, row.id).toEqual([]);
  });
  for (const row of selected) yield* replayRow(row);
  const counts = yield* installed.setup.observed.snapshot;
  expect(counts.confirmed).toBe(counts.spawned);
});

const canonicalFamilyGroups = [
  ["law", 10],
  ["journal", 6],
  ["tax", 4],
  ["ambiguous", 11],
  ["markup", 32],
] as const;
const canonicalShard = (
  title: string,
  replay: (kind: CitationNativeRuntimeKind) => ReturnType<typeof replayCitationCanonicalExtraction>
) => ({ title, replay });
/**
 * Every canonical replay shard, titled without its runtime. The integration
 * suites register one runtime per file so vitest's two workers replay bun and
 * node side by side instead of serializing both behind one file's
 * `maxConcurrency` cap.
 * @internal @category testing @since 0.0.0
 */
export const citationCanonicalExtractionShards = [
  ...A.makeBy(13, (shard) =>
    canonicalShard(`replays original documents ${shard * 10 + 1}-${shard * 10 + 10}`, (kind) =>
      replayCitationCanonicalExtraction(kind, shard, 10)
    )
  ),
  ...A.flatMap(canonicalFamilyGroups, ([family, count]) =>
    A.makeBy(Math.ceil(count / 10), (shard) =>
      canonicalShard(`replays original ${family} inputs in group ${shard}`, (kind) =>
        replayCitationCanonicalExtraction(kind, shard, 10, family)
      )
    )
  ),
];
