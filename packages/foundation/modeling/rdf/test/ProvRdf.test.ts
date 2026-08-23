import {
  Agent,
  Association,
  Entity,
  Generation,
  LifecycleTimes,
  ObjectRef,
  ProvBundle,
  SoftwareAgent,
  Usage,
} from "@beep/rdf/Prov";
import { datasetToProvBundle, ProvRdfCodecOptions, provBundleToDataset } from "@beep/rdf/ProvRdf";
import {
  areDatasetsEquivalent,
  makeBlankNode,
  makeDataset,
  makeLiteral,
  makeNamedNode,
  makeQuad,
  serializeQuad,
  sortDatasetQuads,
} from "@beep/rdf/Rdf";
import * as ProvVocabulary from "@beep/rdf/Vocab/Prov";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { RDFS_LABEL } from "@beep/rdf/Vocab/Rdfs";
import { XSD_DATE_TIME, XSD_DOUBLE, XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { NonNegativeInt } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import type { Literal } from "@beep/rdf/Rdf";

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
    { provType: "Usage", activity: "activity:extract", entity: "entity:source", atTime: "2026-08-17T11:59:30Z" },
    {
      provType: "Generation",
      entity: "entity:source",
      activity: "activity:extract",
      atTime: "2026-08-17T12:00:00Z",
    },
    { provType: "Association", activity: "activity:extract", agent: "agent:extractor", hadPlan: "plan:extract" },
    { provType: "Attribution", entity: "entity:source", agent: "agent:extractor" },
    { provType: "Derivation", generatedEntity: "entity:source", usedEntity: "entity:input" },
    { provType: "PrimarySource", entity: "entity:source", source: "entity:input" },
  ],
};

describe("ProvRdf", () => {
  it("requires relation discriminators when decoding a provenance bundle", () => {
    expect(
      Result.isFailure(
        ProvBundle.decodeUnknownResult({
          records: [{ activity: "activity:extract", entity: "entity:source" }],
        })
      )
    ).toBe(true);

    const decoded = ProvBundle.decodeUnknownResult({
      records: [
        { provType: "Usage", activity: "activity:extract", entity: "entity:source" },
        { provType: "Generation", entity: "entity:source", activity: "activity:extract" },
      ],
    });

    expect(Result.isSuccess(decoded)).toBe(true);
    expect(
      Result.match(decoded, {
        onFailure: () => [],
        onSuccess: (bundle) => A.map(bundle.records, (record) => record.provType),
      })
    ).toEqual(["Usage", "Generation"]);
  });

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
      const bundle = yield* Effect.fromResult(ProvBundle.decodeUnknownResult(rawCoreBundle));
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
      const bundle = yield* Effect.fromResult(ProvBundle.decodeUnknownResult(rawCoreBundle));
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
          Entity.make({
            id: O.some(ObjectRef.make("urn:example:derived")),
            wasQuotedFrom: O.some([ObjectRef.make("urn:example:quotation-source")]),
            wasRevisionOf: O.some([ObjectRef.make("urn:example:revision-source")]),
          }),
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

  it("rejects duplicate record subjects before RDF projection", () => {
    const id = O.some(ObjectRef.make("urn:example:duplicate"));
    const bundle = ProvBundle.make({
      records: [Entity.make({ id, value: O.some("first") }), Entity.make({ id, value: O.some("second") })],
    });

    expect(Result.isFailure(provBundleToDataset(bundle))).toBe(true);
  });

  it("rejects duplicate record subjects even when their PROV types differ", () => {
    const id = O.some(ObjectRef.make("urn:example:multi-type-agent"));
    const bundle = ProvBundle.make({
      records: [Agent.make({ id, name: O.some("Person") }), SoftwareAgent.make({ id, name: O.some("Software") })],
    });

    expect(Result.isFailure(provBundleToDataset(bundle))).toBe(true);
  });

  it("rejects a named node used where prov:value requires a literal", () => {
    const subject = makeNamedNode("urn:example:external-entity");
    const dataset = makeDataset([
      makeQuad(subject, RDF_TYPE, ProvVocabulary.PROV_ENTITY),
      makeQuad(subject, ProvVocabulary.PROV_VALUE, makeNamedNode("urn:example:not-a-literal")),
    ]);

    expect(Result.isFailure(datasetToProvBundle(dataset))).toBe(true);
  });

  it("rejects malformed, unsupported, and language-tagged prov:value literals", () => {
    const subject = makeNamedNode("urn:example:invalid-scalars");
    const datasetWithValue = (value: Literal) =>
      makeDataset([
        makeQuad(subject, RDF_TYPE, ProvVocabulary.PROV_ENTITY),
        makeQuad(subject, ProvVocabulary.PROV_VALUE, value),
      ]);

    expect(Result.isFailure(datasetToProvBundle(datasetWithValue(makeLiteral("not-a-number", XSD_DOUBLE.value))))).toBe(
      true
    );
    expect(
      Result.isFailure(datasetToProvBundle(datasetWithValue(makeLiteral("2026-08-17", XSD_DATE_TIME.value))))
    ).toBe(true);
    expect(
      Result.isFailure(
        datasetToProvBundle(datasetWithValue(makeLiteral("bonjour", XSD_STRING.value, { language: "fr" })))
      )
    ).toBe(true);
  });

  it("rejects a named node used where a PROV timestamp requires a literal", () => {
    const subject = makeNamedNode("urn:example:external-timestamped-entity");
    const dataset = makeDataset([
      makeQuad(subject, RDF_TYPE, ProvVocabulary.PROV_ENTITY),
      makeQuad(subject, ProvVocabulary.PROV_GENERATED_AT_TIME, makeNamedNode("urn:example:not-a-timestamp")),
    ]);

    expect(Result.isFailure(datasetToProvBundle(dataset))).toBe(true);
  });

  it.effect(
    "preserves external named-node record identifiers",
    Effect.fnUntraced(function* () {
      const subject = makeNamedNode("urn:example:external-entity");
      const dataset = makeDataset([makeQuad(subject, RDF_TYPE, ProvVocabulary.PROV_ENTITY)]);
      const decoded = yield* Effect.fromResult(datasetToProvBundle(dataset));
      const reencoded = yield* Effect.fromResult(provBundleToDataset(decoded));

      expect(areDatasetsEquivalent(dataset, reencoded)).toBe(true);
    })
  );

  it.effect(
    "preserves external named-node references and escapes reserved internal identifiers",
    Effect.fnUntraced(function* () {
      const subject = makeNamedNode("urn:example:external-entity");
      const source = makeNamedNode("urn:example:source-entity");
      const externalDataset = makeDataset([
        makeQuad(subject, RDF_TYPE, ProvVocabulary.PROV_ENTITY),
        makeQuad(subject, ProvVocabulary.PROV_WAS_DERIVED_FROM, source),
      ]);
      const decodedExternal = yield* Effect.fromResult(datasetToProvBundle(externalDataset));
      const reencodedExternal = yield* Effect.fromResult(provBundleToDataset(decodedExternal));
      const reservedBundle = ProvBundle.make({
        records: [Entity.make({ id: O.some(ObjectRef.make("urn:beep:rdf:prov:record:123")) })],
      });
      const localBundle = ProvBundle.make({
        records: [Entity.make({ id: O.some(ObjectRef.make("local-entity")) })],
      });
      const encodedReserved = yield* Effect.fromResult(provBundleToDataset(reservedBundle));
      const decodedReserved = yield* Effect.fromResult(datasetToProvBundle(encodedReserved));
      const encodedLocal = yield* Effect.fromResult(provBundleToDataset(localBundle));
      const decodedLocal = yield* Effect.fromResult(datasetToProvBundle(encodedLocal));

      expect(areDatasetsEquivalent(externalDataset, reencodedExternal)).toBe(true);
      expect(decodedReserved.records).toEqual(reservedBundle.records);
      expect(decodedLocal.records).toEqual(localBundle.records);
    })
  );

  it("rejects malformed and invalid encoded object references", () => {
    const subject = makeNamedNode("urn:example:encoded-reference-errors");
    const datasetWithReference = (value: string) =>
      makeDataset([
        makeQuad(subject, RDF_TYPE, ProvVocabulary.PROV_ENTITY),
        makeQuad(subject, ProvVocabulary.PROV_WAS_DERIVED_FROM, makeNamedNode(value)),
      ]);

    expect(Result.isFailure(datasetToProvBundle(datasetWithReference("urn:beep:rdf:prov:ref:*")))).toBe(true);
    expect(
      Result.isFailure(datasetToProvBundle(datasetWithReference("urn:beep:rdf:prov:ref:aGFzIHdoaXRlc3BhY2U")))
    ).toBe(true);
  });

  it("rejects a literal used where a PROV reference requires a named node", () => {
    const subject = makeNamedNode("urn:example:derived-entity");
    const dataset = makeDataset([
      makeQuad(subject, RDF_TYPE, ProvVocabulary.PROV_ENTITY),
      makeQuad(subject, ProvVocabulary.PROV_WAS_DERIVED_FROM, makeLiteral("not-a-reference", XSD_STRING.value)),
    ]);

    expect(Result.isFailure(datasetToProvBundle(dataset))).toBe(true);
  });

  it("rejects a named node used where rdfs:label requires a literal", () => {
    const subject = makeNamedNode("urn:example:external-agent");
    const dataset = makeDataset([
      makeQuad(subject, RDF_TYPE, ProvVocabulary.PROV_AGENT),
      makeQuad(subject, RDFS_LABEL, makeNamedNode("urn:example:not-a-label")),
    ]);

    expect(Result.isFailure(datasetToProvBundle(dataset))).toBe(true);
  });

  it("rejects non-canonical timestamp and label literal shapes", () => {
    const entity = makeNamedNode("urn:example:timestamped-entity");
    const agent = makeNamedNode("urn:example:language-agent");
    const wrongDatatype = makeDataset([
      makeQuad(entity, RDF_TYPE, ProvVocabulary.PROV_ENTITY),
      makeQuad(entity, ProvVocabulary.PROV_GENERATED_AT_TIME, makeLiteral("2026-08-17T12:00:00Z", XSD_STRING.value)),
    ]);
    const invalidLexicalForm = makeDataset([
      makeQuad(entity, RDF_TYPE, ProvVocabulary.PROV_ENTITY),
      makeQuad(entity, ProvVocabulary.PROV_GENERATED_AT_TIME, makeLiteral("2026-08-17", XSD_DATE_TIME.value)),
    ]);
    const languageLabel = makeDataset([
      makeQuad(agent, RDF_TYPE, ProvVocabulary.PROV_AGENT),
      makeQuad(agent, RDFS_LABEL, makeLiteral("Agent", XSD_STRING.value, { language: "en" })),
    ]);

    expect(Result.isFailure(datasetToProvBundle(wrongDatatype))).toBe(true);
    expect(Result.isFailure(datasetToProvBundle(invalidLexicalForm))).toBe(true);
    expect(Result.isFailure(datasetToProvBundle(languageLabel))).toBe(true);
  });

  it("rejects duplicate singular properties and blank-node record subjects", () => {
    const subject = makeNamedNode("urn:example:duplicate-value-entity");
    const duplicateValue = makeDataset([
      makeQuad(subject, RDF_TYPE, ProvVocabulary.PROV_ENTITY),
      makeQuad(subject, ProvVocabulary.PROV_VALUE, makeLiteral("first", XSD_STRING.value)),
      makeQuad(subject, ProvVocabulary.PROV_VALUE, makeLiteral("second", XSD_STRING.value)),
    ]);
    const blankSubject = makeBlankNode("anonymous-entity");
    const blankRecord = makeDataset([makeQuad(blankSubject, RDF_TYPE, ProvVocabulary.PROV_ENTITY)]);

    expect(Result.isFailure(datasetToProvBundle(duplicateValue))).toBe(true);
    expect(Result.isFailure(datasetToProvBundle(blankRecord))).toBe(true);
  });

  it("rejects unsupported PROV record types", () => {
    const subject = makeNamedNode("urn:example:unsupported-plan");
    const dataset = makeDataset([makeQuad(subject, RDF_TYPE, makeNamedNode(`${ProvVocabulary.PROV_NAMESPACE}Plan`))]);

    expect(Result.isFailure(datasetToProvBundle(dataset))).toBe(true);
  });

  it("rejects multiple supported PROV types that share one RDF subject", () => {
    const subject = makeNamedNode("urn:example:multi-type-subject");
    const dataset = makeDataset([
      makeQuad(subject, RDF_TYPE, ProvVocabulary.PROV_AGENT),
      makeQuad(subject, RDF_TYPE, ProvVocabulary.PROV_SOFTWARE_AGENT),
    ]);

    expect(Result.isFailure(datasetToProvBundle(dataset))).toBe(true);
  });

  it("rejects a qualified relation whose direct shortcut contradicts its target", () => {
    const activity = makeNamedNode("urn:example:activity");
    const relation = makeNamedNode("urn:example:usage");
    const qualifiedEntity = makeNamedNode("urn:example:qualified-entity");
    const directEntity = makeNamedNode("urn:example:direct-entity");
    const dataset = makeDataset([
      makeQuad(relation, RDF_TYPE, ProvVocabulary.PROV_USAGE),
      makeQuad(activity, ProvVocabulary.PROV_QUALIFIED_USAGE, relation),
      makeQuad(relation, ProvVocabulary.PROV_ENTITY_PROPERTY, qualifiedEntity),
      makeQuad(activity, ProvVocabulary.PROV_USED, directEntity),
    ]);

    expect(Result.isFailure(datasetToProvBundle(dataset))).toBe(true);
  });

  it("rejects a qualified relation without its required parent and target", () => {
    const relation = makeNamedNode("urn:example:incomplete-usage");
    const dataset = makeDataset([makeQuad(relation, RDF_TYPE, ProvVocabulary.PROV_USAGE)]);

    expect(Result.isFailure(datasetToProvBundle(dataset))).toBe(true);
  });

  it.effect(
    "accepts a matching qualified target among multiple direct relations",
    Effect.fnUntraced(function* () {
      const activity = makeNamedNode("urn:example:multi-target-activity");
      const relation = makeNamedNode("urn:example:multi-target-usage");
      const qualifiedEntity = makeNamedNode("urn:example:qualified-entity");
      const otherEntity = makeNamedNode("urn:example:other-entity");
      const dataset = makeDataset([
        makeQuad(activity, RDF_TYPE, ProvVocabulary.PROV_ACTIVITY),
        makeQuad(relation, RDF_TYPE, ProvVocabulary.PROV_USAGE),
        makeQuad(activity, ProvVocabulary.PROV_QUALIFIED_USAGE, relation),
        makeQuad(relation, ProvVocabulary.PROV_ENTITY_PROPERTY, qualifiedEntity),
        makeQuad(activity, ProvVocabulary.PROV_USED, qualifiedEntity),
        makeQuad(activity, ProvVocabulary.PROV_USED, otherEntity),
      ]);
      const decoded = yield* Effect.fromResult(datasetToProvBundle(dataset));

      expect(decoded.records).toHaveLength(2);
    })
  );

  it.effect(
    "accepts a qualified relation without an optional direct shortcut",
    Effect.fnUntraced(function* () {
      const activity = makeNamedNode("urn:example:qualified-only-activity");
      const relation = makeNamedNode("urn:example:qualified-only-usage");
      const entity = makeNamedNode("urn:example:qualified-only-entity");
      const dataset = makeDataset([
        makeQuad(relation, RDF_TYPE, ProvVocabulary.PROV_USAGE),
        makeQuad(activity, ProvVocabulary.PROV_QUALIFIED_USAGE, relation),
        makeQuad(relation, ProvVocabulary.PROV_ENTITY_PROPERTY, entity),
      ]);
      const decoded = yield* Effect.fromResult(datasetToProvBundle(dataset));

      expect(decoded.records).toHaveLength(1);
      expect(A.some(decoded.records, S.is(Usage))).toBe(true);
    })
  );
});
