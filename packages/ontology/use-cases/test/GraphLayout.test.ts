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
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const EX = "https://example.test/";

// A dozen classes: the size a real ontology actually is, and the size at which the
// old 512-column grid degenerated completely.
const classes = A.makeBy(12, (index) => `${EX}Class${index}`);

const session = createSession(
  CreateSessionInput.make({
    id: S.decodeSync(SessionId)("session-1"),
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
    // The seed layout was a 512-column grid, so `row = floor(index / 512)` was zero
    // for every node in any ontology smaller than 512 — a single row, every y within
    // a few units of every other, x smeared across ±768. It drew as a horizontal line
    // of overlapping dots. A collinear start is also the one arrangement a force
    // simulation cannot escape: repulsion between points on a line only pushes them
    // further along it, so it never opened up.
    const projection = buildOntologyGraphProjection(buildOntologySnapshot(session), options);

    expect(projection.nodeCount).toBe(12);

    const xs = A.map(projection.nodes, (node) => node.x);
    const ys = A.map(projection.nodes, (node) => node.y);

    // The vertical extent has to be a real fraction of the horizontal one. Under the
    // grid it was a rounding error: y stayed within ±6 while x ran to ±768.
    expect(spread(ys)).toBeGreaterThan(spread(xs) / 4);
  });

  it("places the same ontology the same way twice", () => {
    // Deterministic: the same document must not reshuffle itself between openings.
    const first = buildOntologyGraphProjection(buildOntologySnapshot(session), options);
    const second = buildOntologyGraphProjection(buildOntologySnapshot(session), options);

    expect(A.map(first.nodes, (node) => [node.x, node.y])).toStrictEqual(
      A.map(second.nodes, (node) => [node.x, node.y])
    );
  });
});
