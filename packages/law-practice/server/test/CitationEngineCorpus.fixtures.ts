/** Public-engine replay of the pinned original extraction corpus.
 * @internal @packageDocumentation @since 0.0.0
 */
import { ResolvedSourceText, SourceTextResolver, SourceTextResolverError } from "@beep/file-processing/SourceText";
import { makeCitationPythonUnicode } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import { CitationEngineSourcePairInput } from "@beep/law-practice-use-cases/server";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import { installCitationDefaultConfigurationFixture } from "./CitationDefaultConfiguration.fixtures.ts";
import { buildCitationDefaultEngineFixture } from "./CitationEngineLayer.fixtures.ts";
import { assertCitationMentionRanges, citationFixtureSourceProof } from "./CitationOccurrenceProjection.fixtures.ts";
import { assertCitationWorkerCompositionObserved } from "./CitationRegexWorker.fixtures.ts";
import { assertCitationSemanticDocument } from "./CitationSemanticExtraction.fixtures.ts";
import { makeCitationVocabularyAssertion } from "./CitationSemanticVocabulary.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import type { VerifiedSourceText } from "@beep/provenance/VerifiedTextAnchor";

const sameSource = S.toEquivalence(SourceTextIdentity);
/** Odd corpus ids whose only difference from the preceding even row is `removeAmbiguous: true`
 * with an identical expected document. The full replays skip them (deletion addendum G8,
 * 2026-11-09); ids 5, 25 and 33 stay because their expected documents differ from their twins.
 * @internal @category testing @since 0.0.0
 */
export const citationEngineCorpusAmbiguousTwins: ReadonlyArray<number> = [
  1, 3, 7, 9, 11, 13, 15, 17, 19, 21, 23, 27, 29, 31,
];
/** Full and focused modes construct production owners through the default public
 * Layer and install every production pattern/helper. Only the
 * replay document set differs. Compare source kinds/components, represented
 * metadata, candidate/selected editions, plain text and canonical spans
 * independently; document resolution is not claimed here as an
 * independent oracle comparison merely because it completes successfully.
 * @internal @category testing @since 0.0.0
 */
export const replayCitationEngineCorpus = Effect.fn("EngineCorpusTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean
) {
  const installed = yield* installCitationDefaultConfigurationFixture(kind);
  const { setup, corpus, provided } = installed;
  const assertVocabulary = yield* makeCitationVocabularyAssertion();
  const registered = yield* Ref.make<ReadonlyArray<VerifiedSourceText>>([]);
  const resolver = SourceTextResolver.of({
    resolve: Effect.fn("EngineCorpusTest.resolve")(function* (request) {
      const state = yield* operation.snapshot;
      expect(state).toMatchObject({ active: 1, queued: 0 });
      const sources = yield* Ref.get(registered);
      const proof = yield* Effect.fromOption(
        A.findFirst(sources, (source) => sameSource(source.source, request.identity)),
        () => SourceTextResolverError.new("source-unavailable", "unregistered original fixture source")
      );
      return ResolvedSourceText.make({ identity: proof.source, text: proof.sourceText });
    }),
  });
  const { engine, operation, admission } = yield* buildCitationDefaultEngineFixture(installed, resolver);
  const unicode = yield* makeCitationPythonUnicode(setup.limits).pipe(Effect.provideContext(provided));
  const register = Effect.fn("EngineCorpusTest.register")(function* (text: string) {
    const proof = yield* citationFixtureSourceProof(text);
    yield* Ref.update(registered, A.append(proof));
    return { source: proof.source, sourceText: proof.sourceText };
  });
  const shortcutSource = yield* register("eyecite");
  const shortcutInput = yield* S.decodeEffect(CitationEngineSourcePairInput)({ plain: shortcutSource });
  const shortcut = yield* engine.extract(shortcutInput);
  expect(shortcut.citations).toHaveLength(1);
  expect(shortcut.diagnostics.unverified).toHaveLength(1);
  expect(shortcut.document.mentions).toEqual([]);
  expect(shortcut.report.extraction?.tokenizer).toBe(null);
  const before = yield* setup.observed.snapshot;
  expect(before).toEqual({ spawned: 0, confirmed: 0 });
  const rows = A.filter(corpus.cases, (row) =>
    full ? !A.contains(citationEngineCorpusAmbiguousTwins, row.id) : A.contains([4, 14, 18, 20, 22, 26, 32], row.id)
  );
  let families = HashSet.empty<string>();
  const replayRow = Effect.fn("EngineCorpusTest.replayRow")(function* (row: (typeof corpus.cases)[number]) {
    const plain = yield* unicode.fromStorage(row.plain);
    const markup = yield* unicode.fromStorage(row.markup);
    const hasMarkup = row.markup.bytes.length > 0;
    const source = yield* register(hasMarkup ? markup.text : plain.text);
    const input = yield* S.decodeEffect(CitationEngineSourcePairInput)({
      plain: hasMarkup ? null : source,
      markup: hasMarkup ? source : null,
      cleanSteps: hasMarkup ? ["html"] : [],
      removeAmbiguous: row.removeAmbiguous,
    });
    const result = yield* engine.extract(input);
    yield* assertCitationSemanticDocument(unicode, result.citations, row.expected, corpus.bindings);
    yield* assertVocabulary(unicode, result.citations, row.expected);
    expect(result.source.source.sourceText, `source case ${row.id}`).toBe(plain.text);
    expect(result.diagnostics.unverified, `source case ${row.id}`).toEqual([]);
    expect(result.diagnostics.unverifiedComponents, `source case ${row.id}`).toEqual([]);
    expect(result.document.mentions).toHaveLength(row.expected.length);
    expect(result.document.resolutions).toHaveLength(result.document.mentions.length);
    for (const [mention, original] of A.zip(result.document.mentions, row.expected)) {
      families = HashSet.add(families, original.kind);
      yield* assertCitationMentionRanges(result.source.source.sourceText, mention, original);
    }
    expect(result.report.extraction?.semanticCitations).toBe(row.expected.length);
    expect(result.report.extraction?.verifiedMentions).toBe(row.expected.length);
  });
  for (const row of rows) yield* replayRow(row);
  expect(rows).toHaveLength(full ? 22 : 7);
  expect(HashSet.size(families)).toBe(8);
  yield* assertCitationWorkerCompositionObserved(operation, admission, setup.observed.snapshot);
});
