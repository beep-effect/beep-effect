import {
  appendChange,
  applyChangeOperationsWithDelta,
  ChangeOperation,
  CreateSessionInput,
  createSession,
  deriveNamedGraphs,
  deriveSessionGraphPartitions,
  graphPartitionIri,
  isExcludedFromReasoning,
  SessionId,
} from "@beep/ontology-domain/aggregates/Session";
import { makeBlankNode, makeDataset, makeLiteral, makeNamedNode, makeQuad, serializeQuad } from "@beep/rdf/Rdf";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";

const sessionId = S.decodeUnknownSync(SessionId)("session-1");
const nameQuad = makeQuad(
  makeNamedNode("https://example.test/alice"),
  makeNamedNode("https://example.test/name"),
  makeLiteral("Alice", XSD_STRING.value)
);
const knowsQuad = makeQuad(
  makeNamedNode("https://example.test/alice"),
  makeNamedNode("https://example.test/knows"),
  makeNamedNode("https://example.test/bob")
);
const SHACL_NAMESPACE = "http://www.w3.org/ns/shacl#" as const;
const SH_NODE_SHAPE = makeNamedNode(`${SHACL_NAMESPACE}NodeShape`);
const SH_PROPERTY = makeNamedNode(`${SHACL_NAMESPACE}property`);
const SH_PATH = makeNamedNode(`${SHACL_NAMESPACE}path`);
const ontologyGraphQuad = makeQuad(
  makeNamedNode("https://example.test/alice"),
  makeNamedNode("https://example.test/knows"),
  {
    object: makeNamedNode("https://example.test/bob"),
    graph: makeNamedNode(graphPartitionIri("ontologies")),
  }
);

describe("Ontology Session aggregate", () => {
  it("derives asserted and authored partitions from base plus change log", () => {
    const session = appendChange(
      createSession(
        CreateSessionInput.make({
          id: sessionId,
          baseDataset: makeDataset([nameQuad]),
        })
      ),
      ChangeOperation.make({
        kind: "addQuad",
        partition: "ontologies",
        quad: ontologyGraphQuad,
      })
    );

    const partitions = deriveSessionGraphPartitions(session);

    expect(partitions.asserted.quads).toHaveLength(1);
    expect(partitions.ontologies.quads).toHaveLength(1);
    expect(partitions.inferred.quads).toHaveLength(0);
  });

  it("routes opened SHACL node and property shapes into the shapes partition", () => {
    const shape = makeNamedNode("urn:shape:alice-name");
    const property = makeBlankNode("alice-name-property");
    const path = makeNamedNode("https://example.test/name");
    const shapeQuads = [
      makeQuad(shape, RDF_TYPE, SH_NODE_SHAPE),
      makeQuad(shape, SH_PROPERTY, property),
      makeQuad(property, SH_PATH, path),
    ];
    const session = createSession(
      CreateSessionInput.make({
        id: sessionId,
        baseDataset: makeDataset([nameQuad, ...shapeQuads]),
      })
    );

    const partitions = deriveSessionGraphPartitions(session);

    expect(partitions.asserted.quads.map(serializeQuad)).toEqual([serializeQuad(nameQuad)]);
    expect(partitions.shapes.quads.map(serializeQuad)).toEqual(shapeQuads.map(serializeQuad));
  });

  it("applies remove operations without mutating other partitions", () => {
    const session = appendChange(
      createSession(
        CreateSessionInput.make({
          id: sessionId,
          baseDataset: makeDataset([nameQuad, knowsQuad]),
        })
      ),
      ChangeOperation.make({
        kind: "removeQuad",
        partition: "asserted",
        quad: knowsQuad,
      })
    );

    expect(deriveSessionGraphPartitions(session).asserted.quads).toHaveLength(1);
  });

  it("rejects change operations whose quad graph diverges from the partition", () => {
    expect(() =>
      ChangeOperation.make({
        kind: "addQuad",
        partition: "ontologies",
        quad: knowsQuad,
      })
    ).toThrow("Change operation quad graph must match the declared session partition");
    expect(() =>
      ChangeOperation.make({
        kind: "addQuad",
        partition: "asserted",
        quad: ontologyGraphQuad,
      })
    ).toThrow("Change operation quad graph must match the declared session partition");
  });

  it("keeps one shared reasoning-exclusion rule across named graphs", () => {
    const session = createSession(
      CreateSessionInput.make({
        id: sessionId,
        baseDataset: makeDataset([nameQuad]),
      })
    );
    const namedGraphs = deriveNamedGraphs(session);

    expect(isExcludedFromReasoning("asserted")).toBe(false);
    expect(isExcludedFromReasoning("ontologies")).toBe(false);
    expect(isExcludedFromReasoning("inferred")).toBe(true);
    expect(isExcludedFromReasoning("shapes")).toBe(true);
    expect(isExcludedFromReasoning("provenance")).toBe(true);
    expect(namedGraphs).toHaveLength(5);
  });

  it.effect(
    "returns real deltas for batch operations",
    Effect.fnUntraced(function* () {
      const session = createSession(
        CreateSessionInput.make({
          id: sessionId,
          baseDataset: makeDataset([nameQuad]),
        })
      );
      const applied = applyChangeOperationsWithDelta(session, [
        ChangeOperation.make({
          kind: "addQuad",
          partition: "asserted",
          quad: knowsQuad,
        }),
        ChangeOperation.make({
          kind: "removeQuad",
          partition: "asserted",
          quad: nameQuad,
        }),
      ]);

      expect(applied.delta.added).toHaveLength(1);
      expect(applied.delta.removed).toHaveLength(1);
      expect(deriveSessionGraphPartitions(applied.session).asserted.quads).toHaveLength(1);
      yield* Effect.void;
    })
  );
});
