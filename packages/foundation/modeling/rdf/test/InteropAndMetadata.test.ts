import * as WebAnnotationAdapters from "@beep/rdf/Adapters/WebAnnotation";
import * as EvidenceModule from "@beep/rdf/Evidence";
import { EvidenceAnchor } from "@beep/rdf/Evidence";
import * as JsonLdModule from "@beep/rdf/JsonLd";
import * as ProvModule from "@beep/rdf/Prov";
import { getSemanticSchemaMetadata } from "@beep/rdf/SemanticSchemaMetadata";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const decodeUnknownSync = <Schema extends S.ConstraintDecoder<unknown, never>>(schema: Schema) =>
  S.decodeUnknownSync(schema);

const auditModules = [
  {
    exclude: new Set(["JsonLdKeyword", "JsonLdPropertyValue", "JsonLdScalar"]),
    exports: JsonLdModule,
    name: "jsonld",
  },
  {
    exclude: new Set(["EvidenceSelector", "EvidenceSelectorKind"]),
    exports: EvidenceModule,
    name: "evidence",
  },
  {
    exclude: new Set(["ProvO", "ProvRecord"]),
    exports: ProvModule,
    name: "prov",
  },
  {
    exclude: new Set(["WebAnnotationSelector"]),
    exports: WebAnnotationAdapters,
    name: "adapters/web-annotation",
  },
] as const;

describe("Interop and Metadata", () => {
  it("round-trips EvidenceAnchor values through Web Annotation mappers", () => {
    const anchor = decodeUnknownSync(EvidenceAnchor)({
      id: "https://example.com/annotations/position-1",
      note: "Selected code span",
      target: {
        selector: {
          end: 8,
          kind: "text-position",
          start: 2,
        },
        source: "https://example.com/documents/1",
      },
    });

    const annotation = WebAnnotationAdapters.evidenceAnchorToWebAnnotation(anchor);
    expect(annotation.type).toBe("Annotation");
    expect(annotation.bodyValue).toEqual(anchor.note);
    expect(annotation.target.selector.type).toBe("TextPositionSelector");

    const roundTripped = WebAnnotationAdapters.webAnnotationToEvidenceAnchor(annotation);
    expect(roundTripped.note).toEqual(anchor.note);
    expect(roundTripped.target.source).toBe(anchor.target.source);
    expect(roundTripped.target.selector).toEqual(anchor.target.selector);
  });

  it("audits semantic schema metadata coverage for public schema families", () => {
    for (const moduleAudit of auditModules) {
      const schemaEntries = A.filter(
        Object.entries(moduleAudit.exports),
        ([name, value]) => /^[A-Z]/.test(name) && S.isSchema(value) && !moduleAudit.exclude.has(name)
      );

      expect(schemaEntries.length, moduleAudit.name).toBeGreaterThan(0);

      for (const [name, schema] of schemaEntries) {
        const metadata = getSemanticSchemaMetadata(schema);
        expect(O.isSome(metadata), `${moduleAudit.name}.${name}`).toBe(true);
        expect(
          O.map(metadata, (m) => m.canonicalName),
          `${moduleAudit.name}.${name}`
        ).toEqual(O.some(name));
      }
    }
  });
});
