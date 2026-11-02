import { GroundedExtraction } from "@beep/langextract/Extraction";
import { AnnotatedDocumentInput, toAnnotatedDocument } from "@beep/langextract/Handoff";
import { DocumentId } from "@beep/nlp/Core";
import { Contract, UnitInterval } from "@beep/nlp/Handoff";
import { it } from "@beep/test-runner";
import * as O from "@beep/utils/Option";
import { describe, expect } from "@effect/vitest";
import { assertSome, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";

describe("toAnnotatedDocument", () => {
  it("projects only source-aligned extractions into handoff entities", () => {
    const documentId = DocumentId.make("doc-1");
    const aligned = GroundedExtraction.cases.match_exact.make({
      confidence: O.some(UnitInterval.make(0.98)),
      label: "person",
      matchedText: "Ada Lovelace",
      span: Contract.Span.make({ end: S.Natural.make(12), start: S.Natural.make(0) }),
      text: "Ada Lovelace",
    });
    const unaligned = GroundedExtraction.cases.unaligned.make({
      label: "place",
      text: "Paris",
    });

    const document = toAnnotatedDocument(
      AnnotatedDocumentInput.make({
        documentId,
        extractions: [aligned, unaligned],
        generatedBy: "@beep/langextract:test",
        text: "Ada Lovelace wrote notes.",
        timestamp: 0,
      })
    );

    expect(A.length(document.chunks)).toBe(1);
    expect(A.length(document.entities)).toBe(1);
    assertSome(
      O.map(A.head(document.entities), (entity) => entity.canonicalName),
      "Ada Lovelace"
    );
  });

  it("emits one mention per aligned extraction carrying the aligned span into the document chunk", () => {
    const documentId = DocumentId.make("doc-1");
    const sourceText = "Ada Lovelace wrote notes.";
    const span = Contract.Span.make({ end: S.Natural.make(12), start: S.Natural.make(0) });
    const aligned = GroundedExtraction.cases.match_exact.make({
      label: "person",
      matchedText: "Ada Lovelace",
      span,
      text: "Ada Lovelace",
    });

    const document = toAnnotatedDocument(
      AnnotatedDocumentInput.make({
        documentId,
        extractions: [aligned, GroundedExtraction.cases.unaligned.make({ label: "place", text: "Paris" })],
        generatedBy: "@beep/langextract:test",
        text: sourceText,
        timestamp: 0,
      })
    );

    const mention = A.head(document.mentions);
    const entity = A.head(document.entities);
    const chunk = A.head(document.chunks);

    expect(document.version).toBe("nlp-ir/1.1");
    expect(A.length(document.mentions)).toBe(1);
    assertSome(
      O.map(mention, (m) => m.span),
      span
    );
    deepStrictEqual(
      O.map(mention, (m) => Str.slice(m.span.start, m.span.end)(sourceText)),
      O.map(mention, (m) => m.text)
    );
    deepStrictEqual(
      O.map(mention, (m) => m.id),
      O.flatMap(entity, (e) => A.head(e.mentions))
    );
    deepStrictEqual(
      O.map(mention, (m) => m.chunkId),
      O.map(chunk, (c) => c.id)
    );
  });
});
