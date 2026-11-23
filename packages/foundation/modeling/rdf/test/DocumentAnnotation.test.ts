import {
  DOCUMENT_ANNOTATION_CONTEXT,
  DocumentAnnotation,
  DocumentAnnotationBody,
} from "@beep/rdf/Adapters/DocumentAnnotation";
import { CITO_CITES_AS_EVIDENCE } from "@beep/rdf/Vocab/Cito";
import { DEO_INTRODUCTION } from "@beep/rdf/Vocab/Deo";
import { DOCO_TITLE } from "@beep/rdf/Vocab/Doco";
import { FABIO_REPORT } from "@beep/rdf/Vocab/Fabio";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const annotationWire = (fragment: string) => ({
  "@context": DOCUMENT_ANNOTATION_CONTEXT,
  id: "https://example.org/annotation/1",
  type: "Annotation",
  target: {
    type: "SpecificResource",
    source: "https://example.org/revision/1",
    selector: { type: "FragmentSelector", value: fragment },
  },
  body: {
    type: [DOCO_TITLE.value, FABIO_REPORT.value],
    discourseType: DEO_INTRODUCTION.value,
    pattern: "block",
    citation: {
      type: "rdf:Statement",
      subject: "https://example.org/revision/1",
      predicate: CITO_CITES_AS_EVIDENCE.value,
      object: "https://example.org/source",
    },
    wasAttributedTo: "https://example.org/agent/1",
    wasGeneratedBy: "https://example.org/activity/1",
  },
});

describe("SPAR document annotation profile", () => {
  it.effect("round-trips a node-target annotation whose selector value is the fragment string", () =>
    Effect.gen(function* () {
      const annotation = yield* S.decodeUnknownEffect(DocumentAnnotation)(annotationWire("md-v1/b/2"));
      const encoded = yield* S.encodeEffect(DocumentAnnotation)(annotation);
      expect(encoded.type).toBe("Annotation");
      expect(encoded.target.selector.value).toBe("md-v1/b/2");
      expect(encoded.target.type).toBe("SpecificResource");
      expect(encoded["@context"]?.[0]).toBe("http://www.w3.org/ns/anno.jsonld");
      expect(encoded.body.citation?.predicate).toBe("http://purl.org/spar/cito/citesAsEvidence");
      const decoded = yield* S.decodeEffect(DocumentAnnotation)(encoded);
      expect(S.toEquivalence(DocumentAnnotation)(annotation, decoded)).toBe(true);
    })
  );

  it.effect("allows two instance refinements of the same multi-pattern Title", () =>
    Effect.gen(function* () {
      for (const pattern of ["field", "block"]) {
        const body = yield* S.decodeUnknownEffect(DocumentAnnotationBody)({
          type: [DOCO_TITLE.value, FABIO_REPORT.value],
          pattern,
        });
        const encoded = yield* S.encodeEffect(DocumentAnnotationBody)(body);
        expect(encoded.pattern).toBe(pattern);
      }
    })
  );

  it.effect("rejects an empty fragment and an uncurated citation predicate", () =>
    Effect.gen(function* () {
      const badCitation = annotationWire("md-v1/b/0");
      const rejectedCitation = yield* S.decodeUnknownEffect(DocumentAnnotation)({
        ...badCitation,
        body: {
          ...badCitation.body,
          citation: { ...badCitation.body.citation, predicate: "http://purl.org/spar/cito/unknown" },
        },
      }).pipe(Effect.exit);
      expect(rejectedCitation._tag).toBe("Failure");
      const empty = yield* S.decodeUnknownEffect(DocumentAnnotation)(annotationWire("")).pipe(Effect.exit);
      expect(empty._tag).toBe("Failure");
    })
  );
});
