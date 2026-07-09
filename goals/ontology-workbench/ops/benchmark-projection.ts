import {
  buildOntologyGraphProjection,
  defaultOntologyGraphProjectionOptions,
  OntologyGraphProjectionOptions,
  OntologyMetrics,
  OntologyRelationshipSummary,
  OntologyResourceSummary,
  OntologySnapshot,
} from "@beep/ontology-use-cases/aggregates/Session";

const RDFS_SUB_CLASS_OF = "http://www.w3.org/2000/01/rdf-schema#subClassOf";

const parentIri = (index: number): string => `https://example.test/bench#Class${Math.floor((index - 1) / 2)}`;
const classIri = (index: number): string => `https://example.test/bench#Class${index}`;

const makeSnapshot = (size: number): OntologySnapshot => {
  const resources: Array<OntologyResourceSummary> = [];
  const relationships: Array<OntologyRelationshipSummary> = [];
  let index = 0;

  while (index < size) {
    resources.push(
      OntologyResourceSummary.make({
        iri: classIri(index),
        label: `Class ${index}`,
        kind: "class",
        classification: "tbox",
        types: [],
        parentIris: index === 0 ? [] : [parentIri(index)],
        sourcePartitions: ["asserted"],
      })
    );

    if (index > 0) {
      relationships.push(
        OntologyRelationshipSummary.make({
          sourceIri: classIri(index),
          predicateIri: RDFS_SUB_CLASS_OF,
          objectIri: parentIri(index),
          label: "subClassOf",
          sourcePartitions: ["asserted"],
        })
      );
    }

    index += 1;
  }

  return OntologySnapshot.make({
    sessionId: `benchmark-${size}`,
    resources,
    hierarchy: [],
    relationships,
    metrics: OntologyMetrics.make({
      quadCount: relationships.length,
      resourceCount: resources.length,
      classCount: resources.length,
      propertyCount: 0,
      individualCount: 0,
      tboxCount: resources.length,
      aboxCount: 0,
    }),
  });
};

const options = OntologyGraphProjectionOptions.make({
  ...defaultOntologyGraphProjectionOptions(),
  foldLevel: "L3",
  structuralFoldThreshold: 24,
  autoClusterThreshold: 2_500,
  communityBucketSize: 250,
});

const writeLine = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

writeLine("| Elements | Projection ms | Projected nodes | Projected edges | Folded resources | Clusters |");
writeLine("| ---: | ---: | ---: | ---: | ---: | ---: |");

for (const size of [1_000, 10_000, 100_000]) {
  const snapshot = makeSnapshot(size);
  const startedAt = performance.now();
  const projection = buildOntologyGraphProjection(snapshot, options);
  const elapsed = performance.now() - startedAt;

  writeLine(
    `| ${size} | ${elapsed.toFixed(2)} | ${projection.nodeCount} | ${projection.edgeCount} | ${projection.stats.foldedResourceCount} | ${projection.clusters.length} |`
  );
}
