import * as WebAnnotationAdapters from "@beep/rdf/Adapters/WebAnnotation";
import * as JsonLdModule from "@beep/rdf/JsonLd";
import * as ProvModule from "@beep/rdf/Prov";
import { getSemanticSchemaMetadata } from "@beep/rdf/SemanticSchemaMetadata";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { assertTrue, deepStrictEqual } from "@effect/vitest/utils";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const auditModules = [
  {
    exclude: new Set(["JsonLdKeyword", "JsonLdPropertyValue", "JsonLdScalar"]),
    exports: JsonLdModule,
    name: "jsonld",
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
  it("audits semantic schema metadata coverage for public schema families", () => {
    for (const moduleAudit of auditModules) {
      const moduleExports: Readonly<Record<string, unknown>> = moduleAudit.exports;
      const schemaEntries = A.filter(
        R.toEntries(moduleExports),
        (entry): entry is [string, S.Top] =>
          /^[A-Z]/.test(entry[0]) && S.isSchema(entry[1]) && !moduleAudit.exclude.has(entry[0])
      );

      expect(schemaEntries.length, moduleAudit.name).toBeGreaterThan(0);

      for (const [name, schema] of schemaEntries) {
        const metadata = getSemanticSchemaMetadata(schema);
        assertTrue(O.isSome(metadata), `${moduleAudit.name}.${name}`);
        deepStrictEqual(
          O.map(metadata, (m) => m.canonicalName),
          O.some(name),
          `${moduleAudit.name}.${name}`
        );
      }
    }
  });
});
