/** Shared public-engine replay plumbing for original eyecite inputs.
 * @internal @packageDocumentation @since 0.0.0
 */
import { ResolvedSourceText, SourceTextResolver } from "@beep/file-processing/SourceText";
import { CitationEngineSourcePairInput } from "@beep/law-practice-use-cases/server";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import { compareCitationCanonicalModel } from "./CitationCanonicalModel.fixtures.ts";
import { installCitationDefaultConfigurationFixture } from "./CitationDefaultConfiguration.fixtures.ts";
import { buildCitationDefaultEngineFixture } from "./CitationEngineLayer.fixtures.ts";
import { assertCitationMentionRanges, citationFixtureSourceProof } from "./CitationOccurrenceProjection.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const Span = S.Tuple([S.Int, S.Int]);
const Ranges = S.Struct({ span: Span, fullSpan: Span, spanWithPincite: Span });

/** Build actual default owners and compare independently captured model observations.
 * @internal @category testing @since 0.0.0
 */
export const makeCitationCanonicalExtractionReplay = Effect.fn("CanonicalExtractionReplay.make")(function* (
  kind: CitationNativeRuntimeKind
) {
  const installed = yield* installCitationDefaultConfigurationFixture(kind);
  const initial = yield* citationFixtureSourceProof("initial");
  const current = yield* Ref.make(initial);
  const resolver = SourceTextResolver.of({
    resolve: Effect.fn("CanonicalExtractionReplay.source")(() =>
      Ref.get(current).pipe(
        Effect.map((proof) => ResolvedSourceText.make({ identity: proof.source, text: proof.sourceText }))
      )
    ),
  });
  const { engine } = yield* buildCitationDefaultEngineFixture(installed, resolver);
  const extract = Effect.fn("CanonicalExtractionReplay.extract")(function* (
    sourceText: string,
    mode: "plain" | "html",
    expected: ReadonlyArray<unknown>,
    id: string
  ) {
    const proof = yield* citationFixtureSourceProof(sourceText);
    yield* Ref.set(current, proof);
    const source = { source: proof.source, sourceText: proof.sourceText };
    const result = yield* engine.extract(
      CitationEngineSourcePairInput.make({
        plain: mode === "plain" ? source : null,
        markup: mode === "html" ? source : null,
        cleanSteps: mode === "html" ? ["html", "all_whitespace"] : [],
        removeAmbiguous: false,
        container: "list",
      })
    );
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
  const assertRetired = installed.setup.observed.snapshot.pipe(
    Effect.map((counts) => {
      expect(counts.confirmed).toBe(counts.spawned);
    })
  );
  return { extract, assertRetired };
});
