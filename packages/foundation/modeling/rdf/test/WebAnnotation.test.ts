import {
  evidenceSelectorToWebAnnotationSelector,
  evidenceTargetToWebAnnotationTarget,
  WebAnnotationSelector,
  WebAnnotationSelectorFromEvidenceSelector,
  WebAnnotationTarget,
  WebAnnotationTargetFromEvidenceTarget,
  webAnnotationSelectorToEvidenceSelector,
  webAnnotationTargetToEvidenceTarget,
} from "@beep/rdf/Adapters/WebAnnotation";
import { EvidenceSelector, EvidenceTarget } from "@beep/rdf/Evidence";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as S from "effect/Schema";

const decodeEvidenceSelector = S.decodeEffect(EvidenceSelector);
const encodeEvidenceSelector = S.encodeEffect(EvidenceSelector);
const decodeWebAnnotationSelector = S.decodeEffect(WebAnnotationSelector);
const encodeWebAnnotationSelector = S.encodeEffect(WebAnnotationSelector);
const decodeSelectorCodec = S.decodeEffect(WebAnnotationSelectorFromEvidenceSelector);
const encodeSelectorCodec = S.encodeEffect(WebAnnotationSelectorFromEvidenceSelector);

const decodeEvidenceTarget = S.decodeEffect(EvidenceTarget);
const encodeEvidenceTarget = S.encodeEffect(EvidenceTarget);
const decodeWebAnnotationTarget = S.decodeEffect(WebAnnotationTarget);
const encodeWebAnnotationTarget = S.encodeEffect(WebAnnotationTarget);
const decodeTargetCodec = S.decodeEffect(WebAnnotationTargetFromEvidenceTarget);
const encodeTargetCodec = S.encodeEffect(WebAnnotationTargetFromEvidenceTarget);

const SOURCE = "https://example.org/document";

const selectorPairs: ReadonlyArray<{
  readonly name: string;
  readonly evidence: typeof EvidenceSelector.Encoded;
  readonly annotation: typeof WebAnnotationSelector.Encoded;
}> = [
  {
    name: "text-quote",
    evidence: { kind: "text-quote", exact: "quoted text", prefix: "before ", suffix: " after" },
    annotation: { type: "TextQuoteSelector", exact: "quoted text", prefix: "before ", suffix: " after" },
  },
  {
    name: "text-position",
    evidence: { kind: "text-position", start: 3, end: 14 },
    annotation: { type: "TextPositionSelector", start: 3, end: 14 },
  },
  {
    name: "fragment",
    evidence: { kind: "fragment", value: "section-1", conformsTo: "http://tools.ietf.org/rfc/rfc3986" },
    annotation: { type: "FragmentSelector", value: "section-1", conformsTo: "http://tools.ietf.org/rfc/rfc3986" },
  },
];

describe("@beep/rdf Web Annotation selector and target codecs", () => {
  for (const { name, evidence, annotation } of selectorPairs) {
    it.effect(`maps a ${name} selector in both directions`, () =>
      Effect.gen(function* () {
        const decodedFromEvidence = yield* decodeSelectorCodec(evidence);
        const decodedFromEvidenceEncoded = yield* encodeWebAnnotationSelector(decodedFromEvidence);
        expect(decodedFromEvidence.type).toBe(annotation.type);
        expect(decodedFromEvidenceEncoded).toEqual(annotation);

        const webSelector = yield* decodeWebAnnotationSelector(annotation);
        const encodedThroughCodec = yield* encodeSelectorCodec(webSelector);
        expect(encodedThroughCodec).toEqual(evidence);

        const evidenceSelector = yield* decodeEvidenceSelector(evidence);
        const mappedEncoded = yield* encodeWebAnnotationSelector(
          evidenceSelectorToWebAnnotationSelector(evidenceSelector)
        );
        expect(mappedEncoded).toEqual(annotation);

        const mappedBack = webAnnotationSelectorToEvidenceSelector(webSelector);
        const mappedBackEncoded = yield* encodeEvidenceSelector(mappedBack);
        expect(mappedBack.kind).toBe(evidence.kind);
        expect(mappedBackEncoded).toEqual(evidence);
      })
    );

    it.effect(`maps a ${name} target in both directions`, () =>
      Effect.gen(function* () {
        const evidenceTargetEncoded = { source: SOURCE, selector: evidence };
        const annotationTargetEncoded = { source: SOURCE, selector: annotation };

        const decodedFromEvidence = yield* decodeTargetCodec(evidenceTargetEncoded);
        const decodedFromEvidenceEncoded = yield* encodeWebAnnotationTarget(decodedFromEvidence);
        expect(decodedFromEvidenceEncoded).toEqual(annotationTargetEncoded);

        const webTarget = yield* decodeWebAnnotationTarget(annotationTargetEncoded);
        const encodedThroughCodec = yield* encodeTargetCodec(webTarget);
        expect(encodedThroughCodec).toEqual(evidenceTargetEncoded);

        const evidenceTarget = yield* decodeEvidenceTarget(evidenceTargetEncoded);
        const mappedEncoded = yield* encodeWebAnnotationTarget(evidenceTargetToWebAnnotationTarget(evidenceTarget));
        expect(mappedEncoded).toEqual(annotationTargetEncoded);

        const mappedBack = webAnnotationTargetToEvidenceTarget(webTarget);
        const mappedBackEncoded = yield* encodeEvidenceTarget(mappedBack);
        expect(mappedBack.selector.kind).toBe(evidence.kind);
        expect(mappedBackEncoded).toEqual(evidenceTargetEncoded);
      })
    );
  }

  it.effect("omits absent optional selector fields in both directions", () =>
    Effect.gen(function* () {
      const webSelector = yield* decodeWebAnnotationSelector({ type: "TextQuoteSelector", exact: "bare" });
      const encodedQuote = yield* encodeSelectorCodec(webSelector);
      expect(encodedQuote).toStrictEqual({ kind: "text-quote", exact: "bare" });

      const evidenceFragment = yield* decodeEvidenceSelector({ kind: "fragment", value: "bare" });
      const encodedFragment = yield* encodeWebAnnotationSelector(
        evidenceSelectorToWebAnnotationSelector(evidenceFragment)
      );
      expect(encodedFragment).toStrictEqual({ type: "FragmentSelector", value: "bare" });
    })
  );

  it.effect("rejects an encoded Web Annotation selector that violates the DTO schema", () =>
    Effect.gen(function* () {
      const invalid: ReadonlyArray<typeof WebAnnotationSelector.Encoded> = [
        { type: "TextQuoteSelector", exact: "" },
        { type: "TextPositionSelector", start: -1, end: 2 },
      ];
      const failures = yield* Effect.forEach(invalid, (input) => Effect.flip(decodeWebAnnotationSelector(input)), {
        concurrency: 1,
      });
      expect(A.map(failures, (failure) => failure._tag)).toEqual(["SchemaError", "SchemaError"]);
    })
  );

  it.prop(
    "returns every evidence selector unchanged after a trip through its Web Annotation DTO",
    [Arbitrary.schema(EvidenceSelector)],
    ([selector]) => {
      const roundTripped = webAnnotationSelectorToEvidenceSelector(evidenceSelectorToWebAnnotationSelector(selector));
      expect(Equal.equals(roundTripped, selector)).toBe(true);
    }
  );

  it.prop(
    "returns every evidence target unchanged after a trip through its Web Annotation DTO",
    [Arbitrary.schema(EvidenceTarget)],
    ([target]) => {
      const roundTripped = webAnnotationTargetToEvidenceTarget(evidenceTargetToWebAnnotationTarget(target));
      expect(Equal.equals(roundTripped, target)).toBe(true);
    }
  );
});
