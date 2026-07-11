import { ChangeOperation, OntologyChangeActor } from "@beep/ontology-domain/aggregates/Session";
import { OntologyToolsLive } from "@beep/ontology-server/tools";
import { OntologyFilePath } from "@beep/ontology-use-cases/aggregates/Session";
import {
  CapabilityMetadataRequest,
  ExportProvenanceRequest,
  OntologySearchRequest,
  OntologySparqlQueryRequest,
  OntologyToolService,
  OpenInspectRequest,
  ProposeChangeBatchRequest,
  RepairOntologyRequest,
  SnapshotDescribeRequest,
  ValidateOntologyRequest,
} from "@beep/ontology-use-cases/tools";
import { makeLiteral, makeNamedNode, makeQuad } from "@beep/rdf/Rdf";
import { XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import type { OntologyToolServiceShape } from "@beep/ontology-use-cases/tools";

const fixtureResources = A.join(
  A.makeBy(205, (index) => `ex:item-${index} ex:value "${index}" .`),
  "\n"
);

const fixtureSource = `@prefix ex: <https://example.test/> .
@prefix sh: <http://www.w3.org/ns/shacl#> .

ex:PersonShape a sh:NodeShape ;
  sh:targetClass ex:Person ;
  sh:property [
    sh:path ex:name ;
    sh:minCount 1 ;
    sh:hasValue "Unknown"
  ] .

ex:alice a ex:Person .
${fixtureResources}
`;

const testActor = OntologyChangeActor.make("urn:beep:test:ontology-tool-actor");

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const toolLayerForRoot = (root: string) =>
  OntologyToolsLive.pipe(
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ ONTOLOGY_WORKSPACE_ROOT: root }))),
    Layer.provide(NodeServices.layer)
  );

const withToolkit = <A2, E>(run: (tools: OntologyToolServiceShape, path: OntologyFilePath) => Effect.Effect<A2, E>) =>
  Effect.fnUntraced(function* () {
    return yield* Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const platformPath = yield* Path.Path;
      const root = yield* fileSystem.makeTempDirectoryScoped({ prefix: "beep-ontology-tools-" });
      yield* fileSystem.writeFileString(platformPath.join(root, "ontology.ttl"), fixtureSource);
      const path = yield* S.decodeUnknownEffect(OntologyFilePath)("ontology.ttl");
      return yield* Effect.gen(function* () {
        const tools = yield* OntologyToolService;
        return yield* run(tools, path);
      }).pipe(provideScopedLayer(toolLayerForRoot(root)));
    }).pipe(provideScopedLayer(NodeServices.layer));
  });

const addName = (person: string, name: string) =>
  ChangeOperation.make({
    kind: "addQuad",
    partition: "asserted",
    quad: makeQuad(
      makeNamedNode(`https://example.test/${person}`),
      makeNamedNode("https://example.test/name"),
      makeLiteral(name, XSD_STRING.value)
    ),
  });

describe("ontology agent toolkit real-engine handlers", () => {
  it.effect(
    "runs open, snapshot, search, SPARQL, validation, provenance, and capability metadata",
    withToolkit((tools, path) =>
      Effect.gen(function* () {
        const opened = yield* tools.openInspect(OpenInspectRequest.make({ path }));
        const snapshot = yield* tools.snapshotDescribe(SnapshotDescribeRequest.make({ path }));
        const search = yield* tools.search(OntologySearchRequest.make({ path, query: "" }));
        const sparql = yield* tools.sparqlQuery(
          OntologySparqlQueryRequest.make({
            path,
            profile: "select",
            query: "SELECT ?s WHERE { ?s ?p ?o }",
          })
        );
        const validation = yield* tools.validate(ValidateOntologyRequest.make({ path }));
        const provPath = yield* S.decodeUnknownEffect(OntologyFilePath)("ontology.prov.ttl");
        const datasetPath = yield* S.decodeUnknownEffect(OntologyFilePath)("ontology.dataset.ttl");
        const provenance = yield* tools.exportProvenance(
          ExportProvenanceRequest.make({
            path,
            expectedFingerprint: opened.fingerprint,
            provPath,
            datasetPath,
          })
        );
        const metadata = yield* tools.capabilityMetadata(CapabilityMetadataRequest.make({}));

        expect(opened.quadCount).toBeGreaterThan(0);
        expect(snapshot.fingerprint).toBe(opened.fingerprint);
        expect(snapshot.snapshot.resources.length).toBeGreaterThan(0);
        expect(search.results).toHaveLength(100);
        expect(search.truncated).toBe(true);
        expect(sparql.query.displayedResultCount).toBe(200);
        expect(sparql.query.effectiveLimit).toBe(200);
        expect(sparql.query.limitInjected).toBe(true);
        expect(validation.result.validation.conforms).toBe(false);
        expect(validation.result.repairs.length).toBeGreaterThan(0);
        expect(provenance.provPath).toBe("ontology.prov.ttl");
        expect(metadata.capabilities).toHaveLength(9);
        expect(metadata.casSemantics).toBe("semantic");
      })
    )
  );

  it.effect(
    "returns plain literals from a real-engine SELECT through the ontology tool path",
    withToolkit((tools, path) =>
      Effect.gen(function* () {
        const sparql = yield* tools.sparqlQuery(
          OntologySparqlQueryRequest.make({
            path,
            profile: "select",
            query: "SELECT ?s ?p ?o WHERE { ?s ?p ?o }",
          })
        );

        expect(sparql.query.displayedResultCount).toBe(200);
        expect(sparql.query.result.profile).toBe("select");
      })
    )
  );

  it.effect(
    "CAS-saves real deltas and rejects a stale semantic fingerprint recoverably",
    withToolkit((tools, path) =>
      Effect.gen(function* () {
        const opened = yield* tools.openInspect(OpenInspectRequest.make({ path }));
        const first = yield* tools.proposeChangeBatch(
          ProposeChangeBatchRequest.make({
            path,
            expectedFingerprint: opened.fingerprint,
            operations: [addName("alice", "Alice")],
          }),
          testActor
        );
        const stale = yield* Effect.flip(
          tools.proposeChangeBatch(
            ProposeChangeBatchRequest.make({
              path,
              expectedFingerprint: opened.fingerprint,
              operations: [addName("bob", "Robert")],
            }),
            testActor
          )
        );

        expect(first.delta.added).toHaveLength(1);
        expect(first.currentFingerprint).not.toBe(first.previousFingerprint);
        expect(stale._tag).toBe("OntologyCasConflict");
        if (stale._tag === "OntologyCasConflict") {
          expect(stale.currentFingerprint).toBe(first.currentFingerprint);
          expect(stale.recoverable).toBe(true);
          expect(stale.guidance).toContain("Refetch");
        }
      })
    )
  );

  it.effect(
    "enforces the operation budget and reasoner drift cap before engine work",
    withToolkit((tools, path) =>
      Effect.gen(function* () {
        const opened = yield* tools.openInspect(OpenInspectRequest.make({ path }));
        const budgetOperations = A.makeBy(257, (index) => addName(`budget-${index}`, `Name ${index}`));
        const driftOperations = A.makeBy(65, (index) => addName(`drift-${index}`, `Name ${index}`));
        const budget = yield* Effect.flip(
          tools.proposeChangeBatch(
            ProposeChangeBatchRequest.make({
              path,
              expectedFingerprint: opened.fingerprint,
              operations: budgetOperations,
            }),
            testActor
          )
        );
        const drift = yield* Effect.flip(
          tools.proposeChangeBatch(
            ProposeChangeBatchRequest.make({
              path,
              expectedFingerprint: opened.fingerprint,
              operations: driftOperations,
            }),
            testActor
          )
        );

        expect(budget._tag).toBe("OntologyBudgetRefusal");
        expect(drift._tag).toBe("OntologyReasonerDriftRefusal");
      })
    )
  );

  it.effect(
    "applies a P0-registry verified repair and revalidates through real SHACL",
    withToolkit((tools, path) =>
      Effect.gen(function* () {
        const opened = yield* tools.openInspect(OpenInspectRequest.make({ path }));
        const before = yield* tools.validate(ValidateOntologyRequest.make({ path }));
        const proposal = yield* Effect.fromOption(A.head(before.result.repairs));
        const repaired = yield* tools.repair(
          RepairOntologyRequest.make({
            path,
            expectedFingerprint: opened.fingerprint,
            proposalId: proposal.id,
          }),
          testActor
        );

        expect(repaired.proposal.verified).toBe(true);
        expect(repaired.change.delta.added.length + repaired.change.delta.removed.length).toBeGreaterThan(0);
        expect(repaired.validation.validation.conforms).toBe(true);
      })
    )
  );
});
