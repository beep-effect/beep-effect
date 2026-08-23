import { Agent, Association, Entity, Generation, LifecycleTimes, ObjectRef, ProvBundle } from "@beep/rdf/Prov";
import { datasetToProvBundle, ProvRdfCodecOptions, provBundleToDataset } from "@beep/rdf/ProvRdf";
import {
  areDatasetsEquivalent,
  makeDataset,
  makeNamedNode,
  makeQuad,
  serializeQuad,
  sortDatasetQuads,
} from "@beep/rdf/Rdf";
import * as ProvVocabulary from "@beep/rdf/Vocab/Prov";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { XSD_DATE_TIME } from "@beep/rdf/Vocab/Xsd";
import { NonNegativeInt } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const RoundTripEntitySeed = S.Struct({
  index: NonNegativeInt,
  value: S.String,
});

const rawCoreBundle: unknown = {
  records: [
    {
      provType: "Entity",
      id: "entity:source",
      value: "source text",
      wasGeneratedBy: ["activity:extract"],
      generatedAtTime: "2026-08-17T12:00:00Z",
    },
    {
      provType: "Activity",
      id: "activity:extract",
      used: ["entity:source"],
      wasAssociatedWith: ["agent:extractor"],
      startedAtTime: "2026-08-17T11:59:00Z",
      endedAtTime: "2026-08-17T12:00:00Z",
    },
    { provType: "SoftwareAgent", id: "agent:extractor", name: "Extractor" },
    { activity: "activity:extract", entity: "entity:source", atTime: "2026-08-17T11:59:30Z" },
    { entity: "entity:source", activity: "activity:extract", atTime: "2026-08-17T12:00:00Z" },
    { activity: "activity:extract", agent: "agent:extractor", hadPlan: "plan:extract" },
    { entity: "entity:source", agent: "agent:extractor" },
    { generatedEntity: "entity:source", usedEntity: "entity:input" },
    { entity: "entity:source", source: "entity:input" },
  ],
};

describe("ProvRdf", () => {
  it("exports the PROV-O terms required by the core codec", () => {
    expect([
      ProvVocabulary.PROV_SOFTWARE_AGENT.value,
      ProvVocabulary.PROV_USAGE.value,
      ProvVocabulary.PROV_GENERATION.value,
      ProvVocabulary.PROV_ASSOCIATION.value,
      ProvVocabulary.PROV_ATTRIBUTION.value,
      ProvVocabulary.PROV_DERIVATION.value,
      ProvVocabulary.PROV_PRIMARY_SOURCE.value,
      ProvVocabulary.PROV_QUALIFIED_USAGE.value,
      ProvVocabulary.PROV_QUALIFIED_GENERATION.value,
      ProvVocabulary.PROV_QUALIFIED_ASSOCIATION.value,
      ProvVocabulary.PROV_QUALIFIED_ATTRIBUTION.value,
      ProvVocabulary.PROV_QUALIFIED_DERIVATION.value,
      ProvVocabulary.PROV_QUALIFIED_PRIMARY_SOURCE.value,
      ProvVocabulary.PROV_ENTITY_PROPERTY.value,
      ProvVocabulary.PROV_ACTIVITY_PROPERTY.value,
      ProvVocabulary.PROV_AGENT_PROPERTY.value,
    ]).toEqual([
      "http://www.w3.org/ns/prov#SoftwareAgent",
      "http://www.w3.org/ns/prov#Usage",
      "http://www.w3.org/ns/prov#Generation",
      "http://www.w3.org/ns/prov#Association",
      "http://www.w3.org/ns/prov#Attribution",
      "http://www.w3.org/ns/prov#Derivation",
      "http://www.w3.org/ns/prov#PrimarySource",
      "http://www.w3.org/ns/prov#qualifiedUsage",
      "http://www.w3.org/ns/prov#qualifiedGeneration",
      "http://www.w3.org/ns/prov#qualifiedAssociation",
      "http://www.w3.org/ns/prov#qualifiedAttribution",
      "http://www.w3.org/ns/prov#qualifiedDerivation",
      "http://www.w3.org/ns/prov#qualifiedPrimarySource",
      "http://www.w3.org/ns/prov#entity",
      "http://www.w3.org/ns/prov#activity",
      "http://www.w3.org/ns/prov#agent",
    ]);
    expect(XSD_DATE_TIME.value).toBe("http://www.w3.org/2001/XMLSchema#dateTime");
  });

  it.effect(
    "round-trips the supported core through a named audit graph",
    Effect.fnUntraced(function* () {
      const bundle = yield* Effect.fromResult(S.decodeUnknownResult(ProvBundle)(rawCoreBundle));
      const auditGraph = makeNamedNode("urn:example:audit");
      const options = ProvRdfCodecOptions.make({ graph: O.some(auditGraph) });
      const dataset = yield* Effect.fromResult(provBundleToDataset(bundle, options));
      const decoded = yield* Effect.fromResult(datasetToProvBundle(dataset, options));
      const reencoded = yield* Effect.fromResult(provBundleToDataset(decoded, options));

      expect(
        A.every(dataset.quads, (quad) => quad.graph.termType === "NamedNode" && quad.graph.value === auditGraph.value)
      ).toBe(true);
      expect(decoded.records).toHaveLength(bundle.records.length);
      expect(A.map(sortDatasetQuads(reencoded), serializeQuad)).toEqual(
        A.map(sortDatasetQuads(dataset), serializeQuad)
      );
      expect(A.some(dataset.quads, (quad) => quad.predicate.value === ProvVocabulary.PROV_QUALIFIED_USAGE.value)).toBe(
        true
      );
      expect(A.some(dataset.quads, (quad) => quad.predicate.value === ProvVocabulary.PROV_USED.value)).toBe(true);
    })
  );

  it.effect(
    "keeps local object references reversible",
    Effect.fnUntraced(function* () {
      const bundle = yield* Effect.fromResult(S.decodeUnknownResult(ProvBundle)(rawCoreBundle));
      const dataset = yield* Effect.fromResult(provBundleToDataset(bundle));
      const decoded = yield* Effect.fromResult(datasetToProvBundle(dataset));
      const encodedAgain = yield* Effect.fromResult(provBundleToDataset(decoded));

      expect(areDatasetsEquivalent(dataset, encodedAgain)).toBe(true);
    })
  );

  it("round-trips schema-derived supported PROV records without RDF loss", () => {
    const encodableBundle = S.toArbitrary(RoundTripEntitySeed)(fc).map(({ index, value }) =>
      ProvBundle.make({
        records: [
          Entity.make({
            id: O.some(ObjectRef.make(`urn:beep:prov-property:${index}`)),
            value: O.some(value),
          }),
        ],
      })
    );
    fc.assert(
      fc.property(encodableBundle, (bundle) =>
        Result.match(provBundleToDataset(bundle), {
          onFailure: () => false,
          onSuccess: (dataset) =>
            Result.match(datasetToProvBundle(dataset), {
              onFailure: () => false,
              onSuccess: (decoded) =>
                Result.match(provBundleToDataset(decoded), {
                  onFailure: () => false,
                  onSuccess: (reencoded) => areDatasetsEquivalent(dataset, reencoded),
                }),
            }),
        })
      ),
      { numRuns: 100 }
    );
  });

  it.effect(
    "preserves scalar and qualified-relation variants across the RDF boundary",
    Effect.fnUntraced(function* () {
      const bundle = ProvBundle.make({
        records: [
          Entity.make({ value: O.some(12.5) }),
          Entity.make({ value: O.some(true) }),
          Entity.make({ value: O.some(false) }),
          Entity.make({}),
          Agent.make({ id: O.some(ObjectRef.make("agent:reviewer")), name: O.none() }),
          Generation.make({
            entity: ObjectRef.make("entity:artifact"),
            activity: ObjectRef.make("activity:build"),
            atTime: O.none(),
          }),
          Association.make({
            activity: ObjectRef.make("activity:build"),
            agent: ObjectRef.make("agent:reviewer"),
            hadPlan: O.none(),
          }),
        ],
      });

      const dataset = yield* Effect.fromResult(provBundleToDataset(bundle));
      const decoded = yield* Effect.fromResult(datasetToProvBundle(dataset));
      const reencoded = yield* Effect.fromResult(provBundleToDataset(decoded));

      expect(areDatasetsEquivalent(dataset, reencoded)).toBe(true);
      expect(A.some(decoded.records, S.is(Agent))).toBe(true);
      expect(A.some(decoded.records, S.is(Generation))).toBe(true);
      expect(A.some(decoded.records, S.is(Association))).toBe(true);
    })
  );

  it.effect(
    "rejects extension records instead of dropping them",
    Effect.fnUntraced(function* () {
      const bundle = yield* Effect.fromResult(
        S.decodeResult(ProvBundle)({ records: [{ provType: "Plan", id: "plan:unsupported" }] })
      );
      const result = provBundleToDataset(bundle);

      expect(Result.isFailure(result)).toBe(true);
      expect(Result.match(result, { onFailure: (error) => error._tag, onSuccess: () => "" })).toBe("ProvRdfCodecError");
    })
  );

  it("rejects lifecycle adjuncts instead of projecting them incompletely", () => {
    const result = provBundleToDataset(ProvBundle.make({ records: [], lifecycle: O.some(LifecycleTimes.make({})) }));

    expect(Result.isFailure(result)).toBe(true);
  });

  it("rejects a named node used where prov:value requires a literal", () => {
    const subject = makeNamedNode("urn:example:external-entity");
    const dataset = makeDataset([
      makeQuad(subject, RDF_TYPE, ProvVocabulary.PROV_ENTITY),
      makeQuad(subject, ProvVocabulary.PROV_VALUE, makeNamedNode("urn:example:not-a-literal")),
    ]);

    expect(Result.isFailure(datasetToProvBundle(dataset))).toBe(true);
  });

  it("rejects a named node used where a PROV timestamp requires a literal", () => {
    const subject = makeNamedNode("urn:example:external-timestamped-entity");
    const dataset = makeDataset([
      makeQuad(subject, RDF_TYPE, ProvVocabulary.PROV_ENTITY),
      makeQuad(subject, ProvVocabulary.PROV_GENERATED_AT_TIME, makeNamedNode("urn:example:not-a-timestamp")),
    ]);

    expect(Result.isFailure(datasetToProvBundle(dataset))).toBe(true);
  });
});
