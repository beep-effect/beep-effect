import { CreateSessionInput, createSession, SessionId } from "@beep/ontology-domain/aggregates/Session";
import {
  buildOntologyGraphProjection,
  buildOntologySnapshot,
  defaultOntologyGraphProjectionOptions,
  OntologyGraphProjectionOptions,
} from "@beep/ontology-use-cases/aggregates/Session";
import { makeDataset, makeNamedNode, makeQuad } from "@beep/rdf/Rdf";
import { OWL_CLASS } from "@beep/rdf/Vocab/Owl";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as O from "effect/Option";

const EX = "https://example.test/";

const classes = A.makeBy(12, (index) => `${EX}Class${index}`);

const session = createSession(
  CreateSessionInput.make({
    id: SessionId.make("session-1"),
    baseDataset: makeDataset(A.map(classes, (iri) => makeQuad(makeNamedNode(iri), RDF_TYPE, OWL_CLASS))),
  })
);

const options = OntologyGraphProjectionOptions.make({
  ...defaultOntologyGraphProjectionOptions(),
  focusIri: O.none(),
});

const spread = (values: ReadonlyArray<number>): number =>
  A.reduce(values, 0, (max, value) => Math.max(max, Math.abs(value)));

describe("ontology graph seed layout", () => {
  it("spreads nodes in two dimensions, not along a line", () => {
    const projection = buildOntologyGraphProjection(buildOntologySnapshot(session), options);

    expect(projection.nodeCount).toBe(12);

    const xs = A.map(projection.nodes, (node) => node.x);
    const ys = A.map(projection.nodes, (node) => node.y);

    expect(
      spread(ys),
      "a collinear seed is the one start the force simulation cannot escape, so y must span a real fraction of x"
    ).toBeGreaterThan(spread(xs) / 4);
  });

  it("places the same ontology the same way twice", () => {
    const first = buildOntologyGraphProjection(buildOntologySnapshot(session), options);
    const second = buildOntologyGraphProjection(buildOntologySnapshot(session), options);

    expect(
      A.map(first.nodes, (node) => [node.x, node.y]),
      "the same document must not reshuffle itself between openings"
    ).toStrictEqual(A.map(second.nodes, (node) => [node.x, node.y]));
  });
});
