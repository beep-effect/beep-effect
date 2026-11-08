import { ResolvedSourceText, SourceTextResolver } from "@beep/file-processing/SourceText";
import {
  CitationAnnotationAnnotator,
  CitationAnnotationCallbackFailure,
  CitationAnnotationCallbackResult,
} from "@beep/law-practice-server/internal/Citation/AnnotationCallback";
import { makeCitationPythonUnicode } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import {
  CitationAnnotationReplacement,
  CitationEngineAnnotationInput,
  CitationPythonUnicodeStorage,
} from "@beep/law-practice-use-cases/server";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { readCitationCanonicalAnnotations } from "./CitationCanonicalAnnotation.fixtures.ts";
import { installCitationDefaultConfigurationFixture } from "./CitationDefaultConfiguration.fixtures.ts";
import { buildCitationDefaultEngineFixture } from "./CitationEngineLayer.fixtures.ts";
import { citationFixtureSourceProof } from "./CitationOccurrenceProjection.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

// The original callback case observes ASCII lowercasing. Refuse broader inputs
// instead of claiming a general Python Unicode str.lower adapter.
const isAscii = (value: CitationPythonUnicodeStorage) =>
  value.width === 1 && A.every(A.fromIterable(value.bytes), (byte) => byte <= 127);
const lowerAscii = (byte: number) => (byte >= 65 && byte <= 90 ? byte + 32 : byte);
const lower = CitationAnnotationAnnotator.of({
  annotate: Effect.fn("CanonicalAnnotationTest.lower")(function* (before, span, after, work) {
    if (!A.every([before, span, after], isAscii))
      return yield* CitationAnnotationCallbackFailure.make({ reason: "invalid-result" });
    yield* work.reserve(before.bytes.length + span.bytes.length + after.bytes.length);
    const bytes = new Uint8Array(before.bytes.length + span.bytes.length + after.bytes.length);
    bytes.set(before.bytes);
    for (let index = 0; index < span.bytes.length; index++) {
      const byte = span.bytes[index];
      if (byte === undefined) return yield* CitationAnnotationCallbackFailure.make({ reason: "invalid-result" });
      bytes[before.bytes.length + index] = lowerAscii(byte);
    }
    bytes.set(after.bytes, before.bytes.length + span.bytes.length);
    return CitationAnnotationCallbackResult.cases.Text.make({
      text: CitationPythonUnicodeStorage.make({ width: 1, bytes }),
    });
  }),
});
it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true, concurrent: false })(
  "canonical assertion annotation stage",
  (it) => {
    for (const kind of ["bun", "node"] as const) {
      it.effect(
        `matches all canonical annotation assertions on ${kind}`,
        () =>
          Effect.gen(function* () {
            const rows = yield* readCitationCanonicalAnnotations();
            expect(rows).toHaveLength(23);
            expect(A.map(rows, (row) => row.ordinal)).toEqual(A.range(1, 23));
            expect(A.dedupe(A.map(rows, (row) => row.id))).toHaveLength(23);
            const installed = yield* installCitationDefaultConfigurationFixture(kind);
            const unicode = yield* makeCitationPythonUnicode(installed.setup.limits, "annotate");
            const sameSource = S.toEquivalence(SourceTextIdentity);
            let plain = yield* citationFixtureSourceProof("initial");
            let markup = plain;
            const resolver = SourceTextResolver.of({
              resolve: Effect.fn("CanonicalAnnotationTest.resolve")((request) =>
                Effect.sync(() => {
                  const proof = sameSource(request.identity, plain.source) ? plain : markup;
                  return ResolvedSourceText.make({ identity: proof.source, text: proof.sourceText });
                })
              ),
            });
            const normal = yield* buildCitationDefaultEngineFixture(installed, resolver);
            const callback = yield* buildCitationDefaultEngineFixture(installed, resolver).pipe(
              Effect.provideService(CitationAnnotationAnnotator, lower)
            );
            for (const row of rows) {
              plain = yield* citationFixtureSourceProof(row.input.document.fields.plain_text);
              markup = yield* citationFixtureSourceProof(row.input.source_text);
              const replacements = yield* Effect.forEach(
                row.input.annotations,
                Effect.fnUntraced(function* ([[start, end], before, after]) {
                  const first = yield* unicode.fromText(before);
                  const last = yield* unicode.fromText(after);
                  return CitationAnnotationReplacement.make({ start, end, before: first.storage, after: last.storage });
                })
              );
              const input = CitationEngineAnnotationInput.make({
                plain: { source: plain.source, sourceText: plain.sourceText },
                markup: { source: markup.source, sourceText: markup.sourceText },
                mode: O.getOrElse(O.fromUndefinedOr(row.input.annotate_kwargs.unbalanced_tags), () => "unchecked"),
                replacements,
              });
              const engine = row.input.annotate_kwargs.annotator === undefined ? normal.engine : callback.engine;
              const result = yield* engine.annotate(input);
              const expected = yield* unicode.fromText(row.expected);
              expect(result.text, row.id).toEqual(expected.storage);
            }
            const counts = yield* installed.setup.observed.snapshot;
            expect(counts.confirmed).toBe(counts.spawned);
          }),
        { timeout: 240000 }
      );
    }
  }
);
