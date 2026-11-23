import {
  Activity,
  Agent,
  Association,
  Attribution,
  Derivation,
  Entity,
  Generation,
  LifecycleTimes,
  ObjectRef,
  PrimarySource,
  ProvBundle,
  SoftwareAgent,
  Usage,
} from "@beep/rdf/Prov";
import { datasetToProvBundle, ProvRdfCodecOptions, provBundleToDataset } from "@beep/rdf/ProvRdf";
import { Literal, makeBlankNode, makeDataset, makeLiteral, makeNamedNode, makeQuad } from "@beep/rdf/Rdf";
import * as ProvVocabulary from "@beep/rdf/Vocab/Prov";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { RDFS_LABEL } from "@beep/rdf/Vocab/Rdfs";
import { XSD_DATE_TIME, XSD_DOUBLE } from "@beep/rdf/Vocab/Xsd";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertFailure, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { mapResultFailureTag } from "./helpers/FailureTags.ts";

const decodeProvBundleResult = S.decodeResult(ProvBundle);
const recordSet = (bundle: ProvBundle) => HashSet.fromIterable(bundle.records);
const isAgent = S.is(Agent);
const isAssociation = S.is(Association);
const isGeneration = S.is(Generation);
const isUsage = S.is(Usage);

const RoundTripEntitySeed = S.Struct({
  index: S.Natural,
  value: S.String,
});
const SupportedCoreSeed = S.Struct({
  index: S.Natural,
  value: Entity.fields.value,
  name: Agent.fields.name,
  atTime: Usage.fields.atTime,
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
    assertFailure(
      mapResultFailureTag(
        ProvBundle.decodeUnknownResult({
          records: [{ activity: "activity:extract", entity: "entity:source" }],
        })
      ),
      "SchemaError"
    );

    const decoded = ProvBundle.decodeUnknownResult({
      records: [
        { provType: "Usage", activity: "activity:extract", entity: "entity:source" },
        { provType: "Generation", entity: "entity:source", activity: "activity:extract" },
      ],
    });

    pipe(decoded, Result.isSuccess, assertTrue);
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

      pipe(
        HashSet.every(
          dataset.quads,
          (quad) => quad.graph.termType === "NamedNode" && quad.graph.value === auditGraph.value
        ),
        assertTrue
      );
      expect(decoded.records).toHaveLength(bundle.records.length);
      pipe(Equal.equals(reencoded, dataset), assertTrue);
      pipe(
        HashSet.some(dataset.quads, (quad) => quad.predicate.value === ProvVocabulary.PROV_QUALIFIED_USAGE.value),
        assertTrue
      );
      pipe(
        HashSet.some(dataset.quads, (quad) => quad.predicate.value === ProvVocabulary.PROV_USED.value),
        assertTrue
      );
    })
  );

  it.effect(
    "keeps local object references reversible",
    Effect.fnUntraced(function* () {
      const bundle = yield* Effect.fromResult(ProvBundle.decodeUnknownResult(rawCoreBundle));
      const dataset = yield* Effect.fromResult(provBundleToDataset(bundle));
      const decoded = yield* Effect.fromResult(datasetToProvBundle(dataset));
      const encodedAgain = yield* Effect.fromResult(provBundleToDataset(decoded));

      pipe(Equal.equals(dataset, encodedAgain), assertTrue);
    })
  );

  const encodableBundle = Arbitrary.schema(RoundTripEntitySeed).pipe(
    Arbitrary.map(({ index, value }) =>
      ProvBundle.make({
        records: [
          Entity.make({
            id: ObjectRef.makeOption(`urn:beep:prov-property:${index}`),
            value: O.some(value),
          }),
        ],
      })
    )
  );
  it.prop(
    "round-trips schema-derived supported PROV records without RDF loss",
    [encodableBundle],
    ([bundle]) =>
      Result.match(provBundleToDataset(bundle), {
        onFailure: () => false,
        onSuccess: (dataset) =>
          Result.match(datasetToProvBundle(dataset), {
            onFailure: () => false,
            onSuccess: (decoded) =>
              Result.match(provBundleToDataset(decoded), {
                onFailure: () => false,
                onSuccess: (reencoded) =>
                  Result.match(datasetToProvBundle(reencoded), {
                    onFailure: () => false,
                    onSuccess: (redecoded) => Equal.equals(recordSet(redecoded), recordSet(decoded)),
                  }),
              }),
          }),
      }),
    { arbitrary: fcRuns(100) }
  );

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
            id: ObjectRef.makeOption("urn:example:derived"),
            wasQuotedFrom: O.some([ObjectRef.make("urn:example:quotation-source")]),
            wasRevisionOf: O.some([ObjectRef.make("urn:example:revision-source")]),
          }),
          Agent.make({ id: ObjectRef.makeOption("agent:reviewer"), name: O.none() }),
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

      const redecoded = yield* Effect.fromResult(datasetToProvBundle(reencoded));
      pipe(Equal.equals(recordSet(redecoded), recordSet(decoded)), assertTrue);
      pipe(A.some(decoded.records, isAgent), assertTrue);
      pipe(A.some(decoded.records, isGeneration), assertTrue);
      pipe(A.some(decoded.records, isAssociation), assertTrue);
    })
  );

  it.effect(
    "rejects extension records instead of dropping them",
    Effect.fnUntraced(function* () {
      const bundle = yield* Effect.fromResult(
        decodeProvBundleResult({ records: [{ provType: "Plan", id: "plan:unsupported" }] })
      );
      const result = provBundleToDataset(bundle);

      assertFailure(mapResultFailureTag(result), "ProvRdfCodecError");
      expect(Result.match(result, { onFailure: (error) => error._tag, onSuccess: () => "" })).toBe("ProvRdfCodecError");
    })
  );

  it("rejects lifecycle adjuncts instead of projecting them incompletely", () => {
    const result = provBundleToDataset(ProvBundle.make({ records: [], lifecycle: LifecycleTimes.makeOption({}) }));

    assertFailure(mapResultFailureTag(result), "ProvRdfCodecError");
  });

  it("rejects duplicate record subjects before RDF projection", () => {
    const id = ObjectRef.makeOption("urn:example:duplicate");
    const bundle = ProvBundle.make({
      records: [Entity.make({ id, value: O.some("first") }), Entity.make({ id, value: O.some("second") })],
    });

    assertFailure(mapResultFailureTag(provBundleToDataset(bundle)), "ProvRdfCodecError");
  });

  it("rejects duplicate record subjects even when their PROV types differ", () => {
    const id = ObjectRef.makeOption("urn:example:multi-type-agent");
    const bundle = ProvBundle.make({
      records: [Agent.make({ id, name: O.some("Person") }), SoftwareAgent.make({ id, name: O.some("Software") })],
    });

    assertFailure(mapResultFailureTag(provBundleToDataset(bundle)), "ProvRdfCodecError");
  });

  it("rejects a named node used where prov:value requires a literal", () => {
    const subject = makeNamedNode("urn:example:external-entity");
    const dataset = makeDataset([
      makeQuad(subject, RDF_TYPE, ProvVocabulary.PROV_ENTITY),
      makeQuad(subject, ProvVocabulary.PROV_VALUE, makeNamedNode("urn:example:not-a-literal")),
    ]);

    assertFailure(mapResultFailureTag(datasetToProvBundle(dataset)), "ProvRdfCodecError");
  });

  it("rejects malformed, unsupported, and language-tagged prov:value literals", () => {
    const subject = makeNamedNode("urn:example:invalid-scalars");
    const datasetWithValue = (value: Literal) =>
      makeDataset([
        makeQuad(subject, RDF_TYPE, ProvVocabulary.PROV_ENTITY),
        makeQuad(subject, ProvVocabulary.PROV_VALUE, value),
      ]);

    assertFailure(
      mapResultFailureTag(datasetToProvBundle(datasetWithValue(Literal.typed("not-a-number", XSD_DOUBLE.value)))),
      "ProvRdfCodecError"
    );
    assertFailure(
      mapResultFailureTag(datasetToProvBundle(datasetWithValue(Literal.typed("2026-08-17", XSD_DATE_TIME.value)))),
      "ProvRdfCodecError"
    );
    assertFailure(
      mapResultFailureTag(datasetToProvBundle(datasetWithValue(Literal.langTagged("bonjour", "fr")))),
      "ProvRdfCodecError"
    );
  });

  it("rejects a named node used where a PROV timestamp requires a literal", () => {
    const subject = makeNamedNode("urn:example:external-timestamped-entity");
    const dataset = makeDataset([
      makeQuad(subject, RDF_TYPE, ProvVocabulary.PROV_ENTITY),
      makeQuad(subject, ProvVocabulary.PROV_GENERATED_AT_TIME, makeNamedNode("urn:example:not-a-timestamp")),
    ]);

    assertFailure(mapResultFailureTag(datasetToProvBundle(dataset)), "ProvRdfCodecError");
  });

  it.effect(
    "preserves external named-node record identifiers",
    Effect.fnUntraced(function* () {
      const subject = makeNamedNode("urn:example:external-entity");
      const dataset = makeDataset([makeQuad(subject, RDF_TYPE, ProvVocabulary.PROV_ENTITY)]);
      const decoded = yield* Effect.fromResult(datasetToProvBundle(dataset));
      const reencoded = yield* Effect.fromResult(provBundleToDataset(decoded));

      pipe(Equal.equals(dataset, reencoded), assertTrue);
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
        records: [Entity.make({ id: ObjectRef.makeOption("urn:beep:rdf:prov:record:123") })],
      });
      const localBundle = ProvBundle.make({
        records: [Entity.make({ id: ObjectRef.makeOption("local-entity") })],
      });
      const encodedReserved = yield* Effect.fromResult(provBundleToDataset(reservedBundle));
      const decodedReserved = yield* Effect.fromResult(datasetToProvBundle(encodedReserved));
      const encodedLocal = yield* Effect.fromResult(provBundleToDataset(localBundle));
      const decodedLocal = yield* Effect.fromResult(datasetToProvBundle(encodedLocal));

      pipe(Equal.equals(externalDataset, reencodedExternal), assertTrue);
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

    assertFailure(
      mapResultFailureTag(datasetToProvBundle(datasetWithReference("urn:beep:rdf:prov:ref:*"))),
      "ProvRdfCodecError"
    );
    assertFailure(
      mapResultFailureTag(datasetToProvBundle(datasetWithReference("urn:beep:rdf:prov:ref:aGFzIHdoaXRlc3BhY2U"))),
      "ProvRdfCodecError"
    );
  });

  it("rejects a literal used where a PROV reference requires a named node", () => {
    const subject = makeNamedNode("urn:example:derived-entity");
    const dataset = makeDataset([
      makeQuad(subject, RDF_TYPE, ProvVocabulary.PROV_ENTITY),
      makeQuad(subject, ProvVocabulary.PROV_WAS_DERIVED_FROM, makeLiteral("not-a-reference")),
    ]);

    assertFailure(mapResultFailureTag(datasetToProvBundle(dataset)), "ProvRdfCodecError");
  });

  it("rejects a named node used where rdfs:label requires a literal", () => {
    const subject = makeNamedNode("urn:example:external-agent");
    const dataset = makeDataset([
      makeQuad(subject, RDF_TYPE, ProvVocabulary.PROV_AGENT),
      makeQuad(subject, RDFS_LABEL, makeNamedNode("urn:example:not-a-label")),
    ]);

    assertFailure(mapResultFailureTag(datasetToProvBundle(dataset)), "ProvRdfCodecError");
  });

  it("rejects non-canonical timestamp and label literal shapes", () => {
    const entity = makeNamedNode("urn:example:timestamped-entity");
    const agent = makeNamedNode("urn:example:language-agent");
    const wrongDatatype = makeDataset([
      makeQuad(entity, RDF_TYPE, ProvVocabulary.PROV_ENTITY),
      makeQuad(entity, ProvVocabulary.PROV_GENERATED_AT_TIME, makeLiteral("2026-08-17T12:00:00Z")),
    ]);
    const invalidLexicalForm = makeDataset([
      makeQuad(entity, RDF_TYPE, ProvVocabulary.PROV_ENTITY),
      makeQuad(entity, ProvVocabulary.PROV_GENERATED_AT_TIME, Literal.typed("2026-08-17", XSD_DATE_TIME.value)),
    ]);
    const languageLabel = makeDataset([
      makeQuad(agent, RDF_TYPE, ProvVocabulary.PROV_AGENT),
      makeQuad(agent, RDFS_LABEL, Literal.langTagged("Agent", "en")),
    ]);

    assertFailure(mapResultFailureTag(datasetToProvBundle(wrongDatatype)), "ProvRdfCodecError");
    assertFailure(mapResultFailureTag(datasetToProvBundle(invalidLexicalForm)), "ProvRdfCodecError");
    assertFailure(mapResultFailureTag(datasetToProvBundle(languageLabel)), "ProvRdfCodecError");
  });

  it("rejects duplicate singular properties and blank-node record subjects", () => {
    const subject = makeNamedNode("urn:example:duplicate-value-entity");
    const duplicateValue = makeDataset([
      makeQuad(subject, RDF_TYPE, ProvVocabulary.PROV_ENTITY),
      makeQuad(subject, ProvVocabulary.PROV_VALUE, makeLiteral("first")),
      makeQuad(subject, ProvVocabulary.PROV_VALUE, makeLiteral("second")),
    ]);
    const blankSubject = makeBlankNode("anonymous-entity");
    const blankRecord = makeDataset([makeQuad(blankSubject, RDF_TYPE, ProvVocabulary.PROV_ENTITY)]);

    assertFailure(mapResultFailureTag(datasetToProvBundle(duplicateValue)), "ProvRdfCodecError");
    assertFailure(mapResultFailureTag(datasetToProvBundle(blankRecord)), "ProvRdfCodecError");
  });

  it("rejects unsupported PROV record types", () => {
    const subject = makeNamedNode("urn:example:unsupported-plan");
    const dataset = makeDataset([makeQuad(subject, RDF_TYPE, makeNamedNode(`${ProvVocabulary.PROV_NAMESPACE}Plan`))]);

    assertFailure(mapResultFailureTag(datasetToProvBundle(dataset)), "ProvRdfCodecError");
  });

  it("rejects multiple supported PROV types that share one RDF subject", () => {
    const subject = makeNamedNode("urn:example:multi-type-subject");
    const dataset = makeDataset([
      makeQuad(subject, RDF_TYPE, ProvVocabulary.PROV_AGENT),
      makeQuad(subject, RDF_TYPE, ProvVocabulary.PROV_SOFTWARE_AGENT),
    ]);

    assertFailure(mapResultFailureTag(datasetToProvBundle(dataset)), "ProvRdfCodecError");
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

    assertFailure(mapResultFailureTag(datasetToProvBundle(dataset)), "ProvRdfCodecError");
  });

  it("rejects a qualified relation without its required parent and target", () => {
    const relation = makeNamedNode("urn:example:incomplete-usage");
    const dataset = makeDataset([makeQuad(relation, RDF_TYPE, ProvVocabulary.PROV_USAGE)]);

    assertFailure(mapResultFailureTag(datasetToProvBundle(dataset)), "ProvRdfCodecError");
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
      pipe(A.some(decoded.records, isUsage), assertTrue);
    })
  );
});
it.prop(
  "round-trips constructive supported PROV records and qualified relations without RDF loss",
  [
    Arbitrary.schema(SupportedCoreSeed).pipe(
      Arbitrary.map(({ index, value, name, atTime }) => {
        const entity = ObjectRef.make(`urn:beep:prov-core:${index}:entity`);
        const source = ObjectRef.make(`urn:beep:prov-core:${index}:source`);
        const activity = ObjectRef.make(`urn:beep:prov-core:${index}:activity`);
        const agent = ObjectRef.make(`urn:beep:prov-core:${index}:agent`);
        const software = ObjectRef.make(`urn:beep:prov-core:${index}:software`);

        return ProvBundle.make({
          records: [
            Entity.make({
              id: O.some(entity),
              value,
              wasGeneratedBy: O.some([activity]),
              wasAttributedTo: O.some([agent]),
              wasDerivedFrom: O.some([source]),
              hadPrimarySource: O.some([source]),
            }),
            Entity.make({ id: O.some(source) }),
            Activity.make({
              id: O.some(activity),
              used: O.some([source]),
              wasAssociatedWith: O.some([agent, software]),
            }),
            Agent.make({ id: O.some(agent), name }),
            SoftwareAgent.make({ id: O.some(software), name }),
            Usage.make({ activity, entity: source, atTime }),
            Generation.make({ entity, activity, atTime }),
            Association.make({ activity, agent }),
            Attribution.make({ entity, agent }),
            Derivation.make({ generatedEntity: entity, usedEntity: source }),
            PrimarySource.make({ entity, source }),
          ],
        });
      })
    ),
  ],
  ([bundle]) =>
    Result.match(provBundleToDataset(bundle), {
      onFailure: () => false,
      onSuccess: (dataset) =>
        Result.match(datasetToProvBundle(dataset), {
          onFailure: () => false,
          onSuccess: (decoded) =>
            Result.match(provBundleToDataset(decoded), {
              onFailure: () => false,
              onSuccess: (reencoded) =>
                Result.match(datasetToProvBundle(reencoded), {
                  onFailure: () => false,
                  onSuccess: (redecoded) => Equal.equals(recordSet(redecoded), recordSet(decoded)),
                }),
            }),
        }),
    }),
  { arbitrary: fcRuns(100) }
);
