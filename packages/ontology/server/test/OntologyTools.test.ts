import { TermIri } from "@beep/identity/Term";
import { OntoViolation, RoleWithoutKind } from "@beep/ontology/Gufo";
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
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { RDFS_LABEL } from "@beep/rdf/Vocab/Rdfs";
import { SparqlSelectResult } from "@beep/semantic-web/services/sparql-query";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import type { OntologyToolServiceShape } from "@beep/ontology-use-cases/tools";

const decodeOntologyFilePath = S.decodeEffect(OntologyFilePath);

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
const toolLayerForRoot = (root: string) =>
  OntologyToolsLive.pipe(
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ ONTOLOGY_WORKSPACE_ROOT: root }))),
    Layer.provide(NodeServices.layer)
  );

const TestLayer = Layer.unwrap(
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const platformPath = yield* Path.Path;
    const root = yield* fileSystem.makeTempDirectoryScoped({ prefix: "beep-ontology-tools-" });
    yield* fileSystem.writeFileString(platformPath.join(root, "ontology.ttl"), fixtureSource);
    const configuration = ConfigProvider.layer(ConfigProvider.fromUnknown({ ONTOLOGY_WORKSPACE_ROOT: root }));
    return toolLayerForRoot(root).pipe(Layer.provideMerge(configuration));
  })
).pipe(Layer.provideMerge(NodeServices.layer));

const withToolkit = <A2, E>(
  run: (
    tools: OntologyToolServiceShape,
    path: OntologyFilePath,
    root: string
  ) => Effect.Effect<A2, E, FileSystem.FileSystem | Path.Path>
) =>
  Effect.fnUntraced(function* () {
    const tools = yield* OntologyToolService;
    const root = yield* Config.String("ONTOLOGY_WORKSPACE_ROOT");
    const path = yield* decodeOntologyFilePath("ontology.ttl");
    return yield* run(tools, path, root);
  });

const addSubclass = (local: string, supertype: string) =>
  ChangeOperation.make({
    kind: "addQuad",
    partition: "asserted",
    quad: makeQuad(
      makeNamedNode(`https://example.test/${local}`),
      makeNamedNode("http://www.w3.org/2000/01/rdf-schema#subClassOf"),
      makeNamedNode(`https://example.test/${supertype}`)
    ),
  });

const addName = (person: string, name: string) =>
  ChangeOperation.make({
    kind: "addQuad",
    partition: "asserted",
    quad: makeQuad(
      makeNamedNode(`https://example.test/${person}`),
      makeNamedNode("https://example.test/name"),
      makeLiteral(name)
    ),
  });

describe("ontology agent toolkit real-engine handlers", () => {
  it.layer(Layer.fresh(TestLayer), { timeout: "30 seconds" })((it) => {
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
          const provPath = yield* decodeOntologyFilePath("ontology.prov.ttl");
          const datasetPath = yield* decodeOntologyFilePath("ontology.dataset.ttl");
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
          pipe(search.truncated, assertTrue);
          expect(sparql.query.displayedResultCount).toBe(200);
          expect(sparql.query.effectiveLimit).toBe(200);
          pipe(sparql.query.limitInjected, assertTrue);
          pipe(validation.result.validation.conforms, assertFalse);
          expect(validation.result.repairs.length).toBeGreaterThan(0);
          expect(provenance.provPath).toBe("ontology.prov.ttl");
          expect(metadata.capabilities).toHaveLength(9);
          expect(metadata.casSemantics).toBe("semantic");
        })
      ),
      { timeout: 120_000 }
    );
  });

  it.layer(Layer.fresh(TestLayer), { timeout: "30 seconds" })((it) => {
    it.effect(
      "refuses to overwrite an unrelated existing Turtle file during provenance export",
      withToolkit((tools, path, root) =>
        Effect.gen(function* () {
          const fileSystem = yield* FileSystem.FileSystem;
          const platformPath = yield* Path.Path;
          const opened = yield* tools.openInspect(OpenInspectRequest.make({ path }));
          const unrelatedPath = yield* decodeOntologyFilePath("unrelated.ttl");
          const datasetPath = yield* decodeOntologyFilePath("ontology.dataset.ttl");
          const unrelatedSource = "@prefix ex: <https://unrelated.example/> .\nex:subject ex:predicate ex:object .\n";
          const unrelatedTarget = platformPath.join(root, unrelatedPath);
          yield* fileSystem.writeFileString(unrelatedTarget, unrelatedSource);

          const refusal = yield* Effect.flip(
            tools.exportProvenance(
              ExportProvenanceRequest.make({
                path,
                expectedFingerprint: opened.fingerprint,
                provPath: unrelatedPath,
                datasetPath,
              })
            )
          );
          const after = yield* fileSystem.readFileString(unrelatedTarget);

          expect(refusal._tag).toBe("OntologyToolExecutionError");
          expect(after).toBe(unrelatedSource);
        })
      ),
      { timeout: 120_000 }
    );
  });

  it.layer(Layer.fresh(TestLayer), { timeout: "30 seconds" })((it) => {
    it.effect(
      "refuses canonical provenance path aliases",
      withToolkit((tools, path, root) =>
        Effect.gen(function* () {
          const platformPath = yield* Path.Path;
          const opened = yield* tools.openInspect(OpenInspectRequest.make({ path }));
          const sourceAlias = yield* decodeOntologyFilePath("./ontology.ttl");
          const absoluteSourceAlias = yield* decodeOntologyFilePath(platformPath.join(root, "ontology.ttl"));
          const provPath = yield* decodeOntologyFilePath("prov.ttl");
          const datasetPath = yield* decodeOntologyFilePath("dataset.ttl");
          const datasetAlias = yield* decodeOntologyFilePath("./prov.ttl");

          const sourceRefusal = yield* Effect.flip(
            tools.exportProvenance(
              ExportProvenanceRequest.make({
                path,
                expectedFingerprint: opened.fingerprint,
                provPath: sourceAlias,
                datasetPath,
              })
            )
          );
          const absoluteSourceRefusal = yield* Effect.flip(
            tools.exportProvenance(
              ExportProvenanceRequest.make({
                path,
                expectedFingerprint: opened.fingerprint,
                provPath: absoluteSourceAlias,
                datasetPath,
              })
            )
          );
          const outputRefusal = yield* Effect.flip(
            tools.exportProvenance(
              ExportProvenanceRequest.make({
                path,
                expectedFingerprint: opened.fingerprint,
                provPath,
                datasetPath: datasetAlias,
              })
            )
          );

          expect(sourceRefusal._tag).toBe("OntologyToolExecutionError");
          expect(absoluteSourceRefusal._tag).toBe("OntologyToolExecutionError");
          expect(outputRefusal._tag).toBe("OntologyToolExecutionError");
        })
      ),
      { timeout: 120_000 }
    );
  });

  it.layer(Layer.fresh(TestLayer), { timeout: "30 seconds" })((it) => {
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

          const literal = yield* tools.sparqlQuery(
            OntologySparqlQueryRequest.make({
              path,
              profile: "select",
              query: "SELECT ?value WHERE { <https://example.test/item-0> <https://example.test/value> ?value }",
            })
          );
          expect(literal.query.result).toEqual(
            SparqlSelectResult.make({
              profile: "select",
              rows: [{ value: makeLiteral("0") }],
            })
          );
        })
      ),
      { timeout: 120_000 }
    );
  });

  it.layer(Layer.fresh(TestLayer), { timeout: "30 seconds" })((it) => {
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
          const afterStale = yield* tools.sparqlQuery(
            OntologySparqlQueryRequest.make({
              path,
              profile: "select",
              query: "SELECT ?p ?o WHERE { <https://example.test/bob> ?p ?o }",
            })
          );

          expect(first.delta.added).toHaveLength(1);
          expect(first.currentFingerprint).not.toBe(first.previousFingerprint);
          expect(stale._tag).toBe("OntologyCasConflict");
          if (stale._tag === "OntologyCasConflict") {
            expect(stale.currentFingerprint).toBe(first.currentFingerprint);
            pipe(stale.recoverable, assertTrue);
            expect(stale.guidance).toContain("Refetch");
          }
          expect(afterStale.query.result.profile).toBe("select");
          expect(afterStale.query.displayedResultCount).toBe(0);
        })
      ),
      { timeout: 120_000 }
    );
  });

  it.layer(Layer.fresh(TestLayer), { timeout: "30 seconds" })((it) => {
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
      ),
      { timeout: 120_000 }
    );
  });

  it.layer(Layer.fresh(TestLayer), { timeout: "30 seconds" })((it) => {
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

          pipe(repaired.proposal.verified, assertTrue);
          expect(repaired.change.delta.added.length + repaired.change.delta.removed.length).toBeGreaterThan(0);
          pipe(repaired.validation.validation.conforms, assertTrue);
        })
      ),
      { timeout: 120_000 }
    );
  });
});

const gufoType = (local: string, classType: string) =>
  ChangeOperation.make({
    kind: "addQuad",
    partition: "asserted",
    quad: makeQuad(
      makeNamedNode(`https://example.test/${local}`),
      RDF_TYPE,
      makeNamedNode(`http://purl.org/nemo/gufo#${classType}`)
    ),
  });

const addLabel = (local: string, label: string) =>
  ChangeOperation.make({
    kind: "addQuad",
    partition: "asserted",
    quad: makeQuad(makeNamedNode(`https://example.test/${local}`), RDFS_LABEL, makeLiteral(label)),
  });

const addPerson = (local: string) =>
  ChangeOperation.make({
    kind: "addQuad",
    partition: "asserted",
    quad: makeQuad(
      makeNamedNode(`https://example.test/${local}`),
      RDF_TYPE,
      makeNamedNode("https://example.test/Person")
    ),
  });

const sameViolations = S.toEquivalence(S.Array(OntoViolation));

describe("ontology agent toolkit proposed-term lint", () => {
  it.layer(Layer.fresh(TestLayer), { timeout: "30 seconds" })((it) => {
    it.effect(
      "refuses a typed role without a kind and a SHACL-worsening batch, and saves an untyped batch",
      withToolkit((tools, path) =>
        Effect.gen(function* () {
          const opened = yield* tools.openInspect(OpenInspectRequest.make({ path }));
          const propose = (
            operations: A.NonEmptyReadonlyArray<ChangeOperation>,
            expectedFingerprint = opened.fingerprint
          ) =>
            tools.proposeChangeBatch(
              ProposeChangeBatchRequest.make({ path, expectedFingerprint, operations }),
              testActor
            );
          const role = yield* Effect.flip(propose([gufoType("Student", "Role")]));
          const worsened = yield* Effect.flip(propose([addPerson("bob")]));
          const unchanged = yield* tools.openInspect(OpenInspectRequest.make({ path }));
          const untyped = yield* propose([addLabel("Student", "Student")]);
          const kinded = yield* propose(
            [gufoType("Person", "Kind"), gufoType("Student", "Role"), addSubclass("Student", "Person")],
            untyped.currentFingerprint
          );

          expect(role._tag).toBe("OntologyProposedTermRefusal");
          expect(
            role._tag === "OntologyProposedTermRefusal" &&
              role.lint._tag === "GufoViolated" &&
              sameViolations(role.lint.violations, [
                RoleWithoutKind.make({ term: TermIri.make("https://example.test/Student") }),
              ])
          ).toBe(true);
          expect(worsened._tag).toBe("OntologyProposedTermRefusal");
          expect(
            worsened._tag === "OntologyProposedTermRefusal" && worsened.lint._tag === "ShaclWorsened"
              ? [worsened.lint.before, worsened.lint.after]
              : []
          ).toEqual([2, 4]);
          expect(unchanged.fingerprint).toBe(opened.fingerprint);
          expect(untyped.delta.added).toHaveLength(1);
          expect(kinded.delta.added).toHaveLength(3);
        })
      ),
      { timeout: 120_000 }
    );
  });
});
