/** Primary occurrence evidence over actual raw-to-semantic extraction results.
 * @internal @packageDocumentation @since 0.0.0
 */
import { makeCitationOccurrenceProjection } from "@beep/law-practice-server/internal/Citation/OccurrenceProjection";
import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import {
  VerifiedSourceText,
  VerifySourceTextIdentityInput,
  verifySourceTextIdentity,
} from "@beep/provenance/VerifiedTextAnchor";
import { PosixPath, Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import type { CitationExtractionLoopModel } from "@beep/law-practice-server/internal/Citation/ExtractionLoop";
import type { makeCitationPythonUnicode } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import type { CitationSemanticExtractionResult } from "@beep/law-practice-server/internal/Citation/SemanticExtraction";
import type { installCitationDocumentExtractionFixture } from "./CitationDocumentExtraction.fixtures.ts";

type Installed = Effect.Success<ReturnType<typeof installCitationDocumentExtractionFixture>>;
type SourceRow = Installed["corpus"]["cases"][number];
const artifact = Sha256Hex.make(Str.repeat(64)("a"));
const otherArtifact = Sha256Hex.make(Str.repeat(64)("b"));
const sourceProof = Effect.fnUntraced(function* (text: string) {
  const hash = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(text));
  const digest = SourceTextDigest.make(`sha256:${hash}`);
  const source = SourceTextIdentity.make({
    scopeRef: "citation-test:document",
    sourceRef: "citation-test:tokenizer-text",
    locator: PosixPath.make("tokenizer.txt"),
    sourceDigest: digest,
    textDigest: digest,
    extractor: SourceTextExtractor.make({ name: "citation-test-tokenizer-text", version: "1" }),
    normalizationVersion: "1",
  });
  return yield* verifySourceTextIdentity(
    VerifySourceTextIdentityInput.make({ expectedSource: source, source, sourceText: text })
  );
});
const assertNativeRange = (
  source: string,
  span: readonly [number, number],
  actual: { readonly startChar: number; readonly endChar: number; readonly quote: string }
) => {
  const points = A.fromIterable(source);
  const startChar = Str.length(A.join(A.take(points, span[0]), ""));
  const endChar = Str.length(A.join(A.take(points, span[1]), ""));
  expect(actual).toEqual({ startChar, endChar, quote: Str.slice(startChar, endChar)(source) });
};
// A source model has two validated views. Controls update both views using
// explicit original IDs from the sealed corpus, without inferring retained IDs.
const replaceModelAt = Effect.fnUntraced(function* (
  result: CitationSemanticExtractionResult,
  position: number,
  modelId: number,
  transform: (model: CitationExtractionLoopModel) => unknown
) {
  if (result.raw.outcome._tag !== "Document") return yield* Effect.die("expected original Document branch");
  const document = result.raw.outcome.result;
  const loop = document.extraction.extraction;
  const entry = A.getUnsafe(loop.citations, position);
  const changed = { ...entry, model: transform(entry.model) };
  return {
    ...result,
    raw: {
      ...result.raw,
      outcome: {
        ...result.raw.outcome,
        result: {
          ...document,
          extraction: {
            ...document.extraction,
            extraction: {
              ...loop,
              models: A.map(loop.models, (original, id) => (id === modelId ? changed : original)),
              citations: A.map(loop.citations, (original, index) => (index === position ? changed : original)),
            },
          },
        },
      },
    },
  };
});
/** Reuse captured runtime services; source proofs come only from the public verifier. */
export const makeCitationOccurrenceTestAdapter = Effect.fn("OccurrenceProjectionTest.install")(function* (
  setup: Installed["setup"],
  provided: Installed["provided"]
) {
  const install = (limits = setup.limits, engineArtifact = artifact) =>
    makeCitationOccurrenceProjection(limits, setup.runtime, { engineArtifact }).pipe(Effect.provideContext(provided));
  const stage = yield* install();
  const verify = Effect.fn("OccurrenceProjectionTest.verify")(function* (
    unicode: Effect.Success<ReturnType<typeof makeCitationPythonUnicode>>,
    result: CitationSemanticExtractionResult,
    expected: SourceRow
  ) {
    if (result.raw.outcome._tag !== "Document") return yield* Effect.die("expected original Document branch");
    const source = yield* unicode.fromStorage(result.raw.outcome.result.extraction.tokenizer.source);
    const proof = yield* sourceProof(source.text);
    expect(S.is(VerifiedSourceText)(proof)).toBe(true);
    const invocation = stage.project({ source: proof, result });
    const closed: Effect.Effect<Effect.Success<typeof invocation>, Effect.Error<typeof invocation>> = invocation;
    const actual = yield* closed;
    expect(actual.unverified).toEqual([]);
    expect(actual.unverifiedComponents).toEqual([]);
    expect(actual.unboundWarnings).toEqual([]);
    expect(actual.mentions).toHaveLength(expected.expected.length);
    for (const [mention, row] of A.zip(actual.mentions, expected.expected)) {
      assertNativeRange(source.text, row.span, mention.anchor.anchor);
      const fullSpan = O.getOrThrow(A.findFirst(mention.components, (component) => component.name === "fullSpan"));
      assertNativeRange(source.text, row.fullSpan, fullSpan.anchor.anchor);
      expect(mention.engineArtifact).toBe(artifact);
    }
    for (const [mention, index] of A.map(actual.mentions, (mention, index) => Tuple.make(mention, index))) {
      const modelId = A.getUnsafe(expected.returned, index);
      const events = A.filter(expected.warnings, (pair) => pair[1] === modelId);
      const previous = A.map(events, ([id]) => {
        const position = O.getOrThrow(A.findFirstIndex(expected.returned, (returned) => returned === id));
        return A.getUnsafe(actual.mentions, position).id;
      });
      expect(A.map(mention.warnings, (warning) => warning.previousMentionId)).toEqual(previous);
    }
    const replay = yield* stage.project({ source: proof, result });
    expect(A.map(replay.mentions, (mention) => mention.id)).toEqual(A.map(actual.mentions, (mention) => mention.id));
    if (expected.id === 4) {
      const replaced = yield* install(setup.limits, otherArtifact);
      const changed = yield* replaced.project({ source: proof, result });
      expect(A.map(changed.mentions, (mention) => mention.id)).not.toEqual(
        A.map(actual.mentions, (mention) => mention.id)
      );
      const limited = yield* install({ ...setup.limits, mentions: 1 });
      const countFailure = yield* limited.project({ source: proof, result }).pipe(Effect.flip);
      expect(countFailure).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "mentions" });
      const expectedUnits =
        Str.length(source.text) +
        A.reduce(
          actual.mentions,
          0,
          (units, mention) =>
            units +
            Str.length(mention.anchor.anchor.quote) +
            A.reduce(
              mention.components,
              0,
              (sum, component) =>
                sum + (component.anchor === mention.anchor ? 0 : Str.length(component.anchor.anchor.quote))
            )
        );
      expect(actual.reservedUnits).toBe(expectedUnits);
      const oneShort = yield* install({ ...setup.limits, producedTextUtf16: expectedUnits - 1 });
      const allocationFailure = yield* oneShort.project({ source: proof, result }).pipe(Effect.flip);
      expect(allocationFailure).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "producedTextUtf16" });
      const firstId = A.getUnsafe(expected.returned, 0);
      const invalidSpan = yield* replaceModelAt(result, 0, firstId, (model) => ({
        ...model,
        token: { ...model.token, start: -1 },
      }));
      const retained = yield* stage.project({ source: proof, result: invalidSpan });
      expect(retained.mentions).toHaveLength(1);
      expect(retained.unverified).toHaveLength(1);
      expect(A.getUnsafe(retained.unverified, 0)).toMatchObject({ index: 0, reason: "invalid-span" });
      const badComponents = yield* replaceModelAt(result, 0, firstId, (model) =>
        "outcome" in model ? { ...model, outcome: { ...model.outcome, fullSpanStart: -1 } } : model
      );
      const incomplete = yield* stage.project({ source: proof, result: badComponents });
      expect(incomplete.mentions).toHaveLength(2);
      expect(incomplete.unverifiedComponents).toEqual([{ index: 0, name: "fullSpan", reason: "invalid-span" }]);
      const mismatch = yield* sourceProof(`${source.text} altered`);
      const failed = yield* stage.project({ source: mismatch, result }).pipe(Effect.flip);
      expect(failed).toMatchObject({ reason: "source-mismatch" });
      const forged = yield* stage
        .project({ source: { source: proof.source, sourceText: source.text }, result })
        .pipe(Effect.flip);
      expect(forged).toMatchObject({ reason: "invalid-input" });
      const alias = {
        ...result,
        raw: {
          ...result.raw,
          outcome: {
            ...result.raw.outcome,
            result: {
              ...result.raw.outcome.result,
              extraction: {
                ...result.raw.outcome.result.extraction,
                tokenizer: {
                  ...result.raw.outcome.result.extraction.tokenizer,
                  source: { width: 2, bytes: new Uint8Array([0x3d, 0xd8, 0, 0xde]) },
                },
              },
            },
          },
        },
      };
      const emoji = yield* sourceProof("😀");
      const unverified = yield* stage.project({ source: emoji, result: alias });
      expect(unverified.mentions).toEqual([]);
      expect(A.map(unverified.unverified, (row) => row.reason)).toEqual(["native-point-layout", "native-point-layout"]);
    }
    if (expected.id === 14) {
      const invalid = yield* replaceModelAt(result, 0, A.getUnsafe(expected.returned, 0), (model) => ({
        ...model,
        token: { ...model.token, start: -1 },
      }));
      const retained = yield* stage.project({ source: proof, result: invalid });
      expect(retained.mentions).toHaveLength(1);
      expect(A.getUnsafe(retained.mentions, 0).warnings).toEqual([]);
      expect(retained.unboundWarnings).toEqual([
        { previousModel: 0, currentModel: 1, reason: "unavailable-occurrence" },
      ]);
    }
  });
  const shortcut = Effect.fn("OccurrenceProjectionTest.shortcut")(function* (result: CitationSemanticExtractionResult) {
    const source = yield* sourceProof("eyecite");
    const actual = yield* stage.project({ source, result });
    expect(actual.mentions).toEqual([]);
    expect(actual.unverified).toHaveLength(1);
    expect(A.getUnsafe(actual.unverified, 0)).toMatchObject({ index: 0, reason: "shortcut" });
  });
  return { verify, shortcut };
});
