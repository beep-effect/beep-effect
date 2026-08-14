import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { BoundedShaclValidationServiceLive } from "../../../packages/epistemic/server/src/ShaclValidation/BoundedShaclValidator.layer.ts";
import {
  ShaclNodeShape,
  ShaclValidationRequest,
  ShaclValidationService,
} from "../../../packages/foundation/capability/semantic-web/src/services/shacl-validation.ts";
import { BoundedEvidenceProjection } from "../../../packages/foundation/modeling/rdf/src/Evidence.ts";
import { ProvBundle } from "../../../packages/foundation/modeling/rdf/src/Prov.ts";
import { Dataset } from "../../../packages/foundation/modeling/rdf/src/Rdf.ts";

const outputsUrl = new URL("../history/outputs/", import.meta.url);
const readJson = async (fileName: string) => Bun.file(new URL(fileName, outputsUrl)).json();

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, stableValue((value as Record<string, unknown>)[key])])
    );
  }

  return value;
};

const stableStringify = (value: unknown) => JSON.stringify(stableValue(value), null, 2);

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const requiredClassIds = [
  "documentation-standard",
  "documentation-tag",
  "documentation-rule",
  "documentation-requirement",
  "documentation-prohibition",
  "documentation-artifact",
  "documentation-symbol-kind",
  "ast-applicable-kind",
  "docgen-entity-kind",
  "ast-derivability-level",
  "tag-parameter-shape",
  "source-authority",
];

const requiredObjectPropertyIds = [
  "defined-by-standard",
  "applies-to-kind",
  "normalizes-to-symbol-kind",
  "has-ast-derivability",
  "has-parameter-shape",
  "related-tag",
  "governed-by-rule",
  "derived-from-source",
  "validated-by-tool",
  "produces-artifact-kind",
];

const requiredDatatypePropertyIds = [
  "syntax-template",
  "accepts-type",
  "accepts-name",
  "accepts-description",
  "deprecation-state",
  "descriptive-notes",
  "stable-provenance-id",
];

const run = async () => {
  const ontology = (await readJson("beep-effect-documentation-ontology.json")) as Record<string, unknown>;
  const scaffold = (await readJson("beep-effect-documentation-tag-scaffold.json")) as Record<string, unknown>;
  const rawDataset = await readJson("beep-effect-documentation-seed.dataset.json");
  const rawProvenance = await readJson("beep-effect-documentation-seed.provenance.json");
  const rawEvidence = await readJson("beep-effect-documentation-seed.evidence.json");
  const rawShapes = await readJson("beep-effect-documentation-shapes.json");

  assert(
    typeof ontology === "object" &&
      ontology !== null &&
      "metadata" in ontology &&
      "classes" in ontology &&
      "objectProperties" in ontology &&
      "datatypeProperties" in ontology,
    "Ontology JSON must expose metadata, classes, objectProperties, and datatypeProperties."
  );

  const classes = ontology.classes as Record<string, unknown>;
  const objectProperties = ontology.objectProperties as Record<string, unknown>;
  const datatypeProperties = ontology.datatypeProperties as Record<string, unknown>;

  requiredClassIds.forEach((classId) => assert(classId in classes, `Missing ontology class ${classId}.`));
  requiredObjectPropertyIds.forEach((propertyId) =>
    assert(propertyId in objectProperties, `Missing ontology object property ${propertyId}.`)
  );
  requiredDatatypePropertyIds.forEach((propertyId) =>
    assert(propertyId in datatypeProperties, `Missing ontology datatype property ${propertyId}.`)
  );

  const dataset = S.decodeUnknownSync(Dataset)(rawDataset);
  const provenance = S.decodeUnknownSync(ProvBundle)(rawProvenance);
  const evidence = S.decodeUnknownSync(BoundedEvidenceProjection)(rawEvidence);
  const shapes = S.decodeUnknownSync(S.Array(ShaclNodeShape))(rawShapes);

  const shaclResult = await Effect.runPromise(
    Effect.gen(function* () {
      const service = yield* ShaclValidationService;
      return yield* service.validate(
        S.decodeUnknownSync(ShaclValidationRequest)({
          dataset: rawDataset,
          shapes: rawShapes,
          maxResults: 20,
        })
      );
    }).pipe(Effect.provide(BoundedShaclValidationServiceLive))
  );

  assert(
    shaclResult.conforms,
    `Seed dataset does not conform to structural SHACL shapes: ${stableStringify(shaclResult)}`
  );

  const scaffoldCounts = (scaffold.counts as Record<string, number | string | boolean | null | undefined>) ?? {};
  assert(
    scaffoldCounts.jsDocTags === 113,
    `Expected 113 mechanically scaffolded tags, received ${String(scaffoldCounts.jsDocTags)}.`
  );
  assert(provenance.records.length >= 6, "Expected a non-trivial provenance bundle.");
  assert(evidence.anchors.length >= 3, "Expected at least three evidence anchors.");

  const report = {
    generatedAt: new Date().toISOString(),
    ontology: {
      classCount: Object.keys(classes).length,
      objectPropertyCount: Object.keys(objectProperties).length,
      datatypePropertyCount: Object.keys(datatypeProperties).length,
      requiredClassesVerified: requiredClassIds,
      requiredObjectPropertiesVerified: requiredObjectPropertyIds,
      requiredDatatypePropertiesVerified: requiredDatatypePropertyIds,
    },
    scaffold: {
      jsDocTags: scaffoldCounts.jsDocTags,
      documentationStandards: scaffoldCounts.documentationStandards,
      applicableKinds: scaffoldCounts.applicableKinds,
      docgenKinds: scaffoldCounts.docgenKinds,
      repoSymbolKinds: scaffoldCounts.repoSymbolKinds,
      governingRules: scaffoldCounts.governingRules,
    },
    localValidation: {
      datasetQuads: dataset.quads.length,
      provenanceRecords: provenance.records.length,
      evidenceAnchors: evidence.anchors.length,
      shaclConforms: shaclResult.conforms,
      shaclViolationCount: shaclResult.violations.length,
    },
  };

  await Bun.write(new URL("verification-report.json", outputsUrl), `${stableStringify(report)}\n`);

  console.log(
    [
      "Verified TrustGraph documentation ontology artifacts.",
      `- ontology classes: ${report.ontology.classCount}`,
      `- object properties: ${report.ontology.objectPropertyCount}`,
      `- datatype properties: ${report.ontology.datatypePropertyCount}`,
      `- dataset quads: ${report.localValidation.datasetQuads}`,
      `- provenance records: ${report.localValidation.provenanceRecords}`,
      `- evidence anchors: ${report.localValidation.evidenceAnchors}`,
      `- SHACL conforms: ${report.localValidation.shaclConforms}`,
      `- report: ${fileURLToPath(new URL("verification-report.json", outputsUrl))}`,
    ].join("\n")
  );
};

await run();
