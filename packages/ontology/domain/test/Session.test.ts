import {
  appendChange,
  appendChanges,
  applyChangeOperationsWithDelta,
  ChangeOperation,
  CreateSessionInput,
  createSession,
  deriveNamedGraphs,
  deriveSessionGraphPartitions,
  GraphPartition,
  graphPartitionIri,
  isExcludedFromReasoning,
  SessionId,
} from "@beep/ontology-domain/aggregates/Session";
import {
  MakeQuadOptionsInput,
  makeBlankNode,
  makeDataset,
  makeLiteral,
  makeNamedNode,
  makeQuad,
  serializeQuad,
} from "@beep/rdf/Rdf";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { SH_NODE, SH_NODE_SHAPE, SH_PATH, SH_PROPERTY } from "@beep/rdf/Vocab/Shacl";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as SchemaIssue from "effect/SchemaIssue";
import type { Quad } from "@beep/rdf/Rdf";

const quadLines = (quads: Iterable<Quad>): ReadonlyArray<string> =>
  A.sort(A.map(A.fromIterable(quads), serializeQuad), Order.String);

const sessionId = SessionId.make("session-1");
const nameQuad = makeQuad(
  makeNamedNode("https://example.test/alice"),
  makeNamedNode("https://example.test/name"),
  makeLiteral("Alice")
);
const knowsQuad = makeQuad(
  makeNamedNode("https://example.test/alice"),
  makeNamedNode("https://example.test/knows"),
  makeNamedNode("https://example.test/bob")
);
const ontologyGraphQuad = makeQuad(
  makeNamedNode("https://example.test/alice"),
  makeNamedNode("https://example.test/knows"),
  MakeQuadOptionsInput.make({
    object: makeNamedNode("https://example.test/bob"),
    graph: makeNamedNode(graphPartitionIri("ontologies")),
  })
);

const expectSchemaMakeToFail = (run: () => unknown, messagePart: string): void => {
  const formatIssue = SchemaIssue.makeFormatterDefault();
  try {
    run();
  } catch (error) {
    if (P.hasProperty(error, "cause") && SchemaIssue.isIssue(error.cause)) {
      expect(formatIssue(error.cause)).toContain(messagePart);
      return;
    }
    throw error;
  }
  expect.unreachable("expected schema construction to throw");
};

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

    expect(HashSet.size(partitions.asserted.quads)).toBe(1);
    expect(HashSet.size(partitions.ontologies.quads)).toBe(1);
    expect(HashSet.size(partitions.inferred.quads)).toBe(0);
  });

  it("routes opened SHACL node and property shapes into the shapes partition", () => {
    const shape = makeNamedNode("urn:shape:alice-name");
    const property = makeBlankNode("alice-name-property");
    const nestedShape = makeBlankNode("alice-name-nested-shape");
    const nestedProperty = makeBlankNode("alice-name-nested-property");
    const path = makeNamedNode("https://example.test/name");
    const shapeQuads = [
      makeQuad(shape, RDF_TYPE, SH_NODE_SHAPE),
      makeQuad(shape, SH_PROPERTY, property),
      makeQuad(property, SH_PATH, path),
      makeQuad(property, SH_NODE, nestedShape),
      makeQuad(nestedShape, SH_PROPERTY, nestedProperty),
      makeQuad(nestedProperty, SH_PATH, path),
    ];
    const session = createSession(
      CreateSessionInput.make({
        id: sessionId,
        baseDataset: makeDataset([nameQuad, ...shapeQuads]),
      })
    );

    const partitions = deriveSessionGraphPartitions(session);

    expect(quadLines(partitions.asserted.quads)).toEqual([serializeQuad(nameQuad)]);
    expect(quadLines(partitions.shapes.quads)).toEqual(quadLines(shapeQuads));
  });

  it("applies remove operations without mutating other partitions", () => {
    const untouched = A.filter(GraphPartition.literals, (partition) => partition !== "asserted");
    const seeded = appendChanges(
      createSession(CreateSessionInput.make({ id: sessionId, baseDataset: makeDataset([nameQuad, knowsQuad]) })),
      A.map(untouched, (partition) =>
        ChangeOperation.make({
          kind: "addQuad",
          partition,
          quad: makeQuad(
            makeNamedNode(`https://example.test/${partition}`),
            RDF_TYPE,
            MakeQuadOptionsInput.make({
              object: makeNamedNode("https://example.test/Untouched"),
              graph: makeNamedNode(graphPartitionIri(partition)),
            })
          ),
        })
      )
    );
    const before = deriveSessionGraphPartitions(seeded);
    for (const partition of untouched) expect(HashSet.size(before[partition].quads)).toBe(1);
    const session = appendChange(
      seeded,
      ChangeOperation.make({
        kind: "removeQuad",
        partition: "asserted",
        quad: knowsQuad,
      })
    );
    const after = deriveSessionGraphPartitions(session);
    expect(HashSet.size(deriveSessionGraphPartitions(session).asserted.quads)).toBe(1);
    expect(quadLines(after.asserted.quads)).toEqual([serializeQuad(nameQuad)]);
    for (const partition of untouched) {
      expect(quadLines(after[partition].quads)).toEqual(quadLines(before[partition].quads));
    }
  });

  it("accepts default-graph quads for non-asserted partitions", () => {
    const change = ChangeOperation.make({
      kind: "addQuad",
      partition: "shapes",
      quad: knowsQuad,
    });

    expect(change.partition).toBe("shapes");
  });

  it("rejects change operations whose named quad graph diverges from the partition", () => {
    expectSchemaMakeToFail(
      () =>
        ChangeOperation.make({
          kind: "addQuad",
          partition: "asserted",
          quad: ontologyGraphQuad,
        }),
      "Change operation quad graph must match the declared session partition"
    );
  });

  it("keeps one shared reasoning-exclusion rule across named graphs", () => {
    const session = createSession(
      CreateSessionInput.make({
        id: sessionId,
        baseDataset: makeDataset([nameQuad]),
      })
    );
    const namedGraphs = deriveNamedGraphs(session);

    pipe(isExcludedFromReasoning("asserted"), assertFalse);
    pipe(isExcludedFromReasoning("ontologies"), assertFalse);
    pipe(isExcludedFromReasoning("inferred"), assertTrue);
    pipe(isExcludedFromReasoning("shapes"), assertTrue);
    pipe(isExcludedFromReasoning("provenance"), assertTrue);
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
      expect(HashSet.size(deriveSessionGraphPartitions(applied.session).asserted.quads)).toBe(1);
      expect(A.map(applied.delta.added, serializeQuad)).toEqual([serializeQuad(knowsQuad)]);
      expect(A.map(applied.delta.removed, serializeQuad)).toEqual([serializeQuad(nameQuad)]);
      expect(quadLines(deriveSessionGraphPartitions(applied.session).asserted.quads)).toEqual([
        serializeQuad(knowsQuad),
      ]);
      yield* Effect.void;
    })
  );
});
