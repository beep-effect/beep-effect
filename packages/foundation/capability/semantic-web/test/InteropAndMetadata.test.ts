import * as WebAnnotationAdapters from "@beep/semantic-web/adapters/web-annotation";
import * as EvidenceModule from "@beep/semantic-web/evidence";
import { EvidenceAnchor } from "@beep/semantic-web/evidence";
import * as JsonLdModule from "@beep/semantic-web/jsonld";
import * as ProvModule from "@beep/semantic-web/prov";
import { getSemanticSchemaMetadata } from "@beep/semantic-web/semantic-schema-metadata";
import * as CanonicalizationServiceModule from "@beep/semantic-web/services/canonicalization";
import * as ShaclValidationServiceModule from "@beep/semantic-web/services/shacl-validation";
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
    exclude: new Set(["CanonicalizationAlgorithm"]),
    exports: CanonicalizationServiceModule,
    name: "services/canonicalization",
  },
  {
    exclude: new Set(["ShaclSeverity"]),
    exports: ShaclValidationServiceModule,
    name: "services/shacl-validation",
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
