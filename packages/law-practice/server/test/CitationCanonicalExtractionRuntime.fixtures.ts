/** Shared public-engine replay plumbing for original eyecite inputs.
 * @internal @packageDocumentation @since 0.0.0
 */
import { ResolvedSourceText, SourceTextResolver } from "@beep/file-processing/SourceText";
import { CitationAnnotationAnnotator } from "@beep/law-practice-server/internal/Citation/AnnotationCallback";
import { makeCitationPythonUnicode } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import {
  CitationAnnotationReplacement,
  CitationEngineAnnotationInput,
  CitationEngineSourcePairInput,
} from "@beep/law-practice-use-cases/server";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { compareCitationCanonicalModel } from "./CitationCanonicalModel.fixtures.ts";
import { installCitationDefaultConfigurationFixture } from "./CitationDefaultConfiguration.fixtures.ts";
import { buildCitationDefaultEngineFixture } from "./CitationEngineLayer.fixtures.ts";
import { assertCitationMentionRanges, citationFixtureSourceProof } from "./CitationOccurrenceProjection.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import type {
  CitationAnnotationMode,
  CitationEngineExtractionResult,
  CitationEngineLimits,
} from "@beep/law-practice-use-cases/server";

const Span = S.Tuple([S.Int, S.Int]);
const Ranges = S.Struct({ span: Span, fullSpan: Span, spanWithPincite: Span });

/** Build actual default owners and compare independently captured model observations.
 * @internal @category testing @since 0.0.0
 */
export const makeCitationCanonicalExtractionReplay = Effect.fn("CanonicalExtractionReplay.make")(function* (
  kind: CitationNativeRuntimeKind,
  annotator?: (limits: CitationEngineLimits) => CitationAnnotationAnnotator["Service"]
) {
  const installed = yield* installCitationDefaultConfigurationFixture(kind);
  const initial = yield* citationFixtureSourceProof("initial");
  const current = yield* Ref.make<ReadonlyArray<typeof initial>>([initial]);
  const resolver = SourceTextResolver.of({
    resolve: Effect.fn("CanonicalExtractionReplay.source")(function* (request) {
      const sources = yield* Ref.get(current);
      const proof = yield* Effect.fromOption(
        A.findFirst(sources, (source) => source.source.textDigest === request.identity.textDigest)
      ).pipe(Effect.orDie);
      return ResolvedSourceText.make({ identity: proof.source, text: proof.sourceText });
    }),
  });
  const build = buildCitationDefaultEngineFixture(installed, resolver);
  const { engine } = yield* annotator === undefined
    ? build
    : build.pipe(Effect.provideService(CitationAnnotationAnnotator, annotator(installed.setup.limits)));
  const extract = Effect.fn("CanonicalExtractionReplay.extract")(function* (
    sourceText: string,
    mode: "plain" | "html",
    expected: ReadonlyArray<unknown>,
    id: string,
    cleanSteps?: CitationEngineSourcePairInput["cleanSteps"]
  ) {
    const proof = yield* citationFixtureSourceProof(sourceText);
    yield* Ref.set(current, [proof]);
    const source = { source: proof.source, sourceText: proof.sourceText };
    const result = yield* engine.extract(
      CitationEngineSourcePairInput.make({
        plain: mode === "plain" ? source : null,
        markup: mode === "html" ? source : null,
        cleanSteps: cleanSteps === undefined ? (mode === "html" ? ["html", "all_whitespace"] : []) : cleanSteps,
        removeAmbiguous: false,
        container: "list",
      })
    );
    yield* Ref.update(current, (sources) => A.append(sources, result.source.source));
    expect(result.citations, id).toHaveLength(expected.length);
    expect(result.document.mentions, id).toHaveLength(expected.length);
    for (const [index, original] of expected.entries()) {
      yield* compareCitationCanonicalModel(A.getUnsafe(result.citations, index), original, id);
      const ranges = yield* S.decodeUnknownEffect(Ranges)(original);
      yield* assertCitationMentionRanges(
        result.source.source.sourceText,
        A.getUnsafe(result.document.mentions, index),
        ranges
      );
    }
    expect(result.diagnostics.unverified, id).toEqual([]);
    expect(result.diagnostics.unverifiedComponents, id).toEqual([]);
    return result;
  });
  const annotate = Effect.fn("CanonicalExtractionReplay.annotate")(function* (
    extracted: CitationEngineExtractionResult,
    parts: ReadonlyArray<readonly [string, string]>,
    mode: CitationAnnotationMode
  ) {
    expect(parts).toHaveLength(extracted.document.mentions.length);
    const available = yield* Ref.get(current);
    const parent = yield* Effect.fromOption(A.get(available, 0)).pipe(Effect.orDie);
    expect(parent.source).toEqual(extracted.source.parent);
    const unicode = yield* makeCitationPythonUnicode(installed.setup.limits, "annotate");
    const tuples = A.map(extracted.document.mentions, (mention, index) => {
      const anchor = mention.anchor.anchor;
      const text = extracted.source.source.sourceText;
      const start = A.fromIterable(Str.slice(0, anchor.startChar)(text)).length;
      const end = A.fromIterable(Str.slice(0, anchor.endChar)(text)).length;
      const [before, after] = A.getUnsafe(parts, index);
      return Tuple.make(Tuple.make(start, end), before, after);
    });
    const replacements = yield* Effect.forEach(
      tuples,
      Effect.fnUntraced(function* ([range, beforeText, afterText]) {
        const before = yield* unicode.fromText(beforeText);
        const after = yield* unicode.fromText(afterText);
        return CitationAnnotationReplacement.make({
          start: range[0],
          end: range[1],
          before: before.storage,
          after: after.storage,
        });
      })
    );
    const result = yield* engine.annotate(
      CitationEngineAnnotationInput.make({
        plain: { source: extracted.source.source.source, sourceText: extracted.source.source.sourceText },
        markup: { source: parent.source, sourceText: parent.sourceText },
        replacements,
        mode,
        useDmp: true,
      })
    );
    return { result, tuples };
  });
  const assertRetired = installed.setup.observed.snapshot.pipe(
    Effect.map((counts) => {
      expect(counts.confirmed).toBe(counts.spawned);
    })
  );
  return { extract, annotate, assertRetired, limits: installed.setup.limits };
});
