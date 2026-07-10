import {
  appendChange,
  ChangeOperation,
  CreateSessionInput,
  createSession,
  deriveNamedGraphs,
  deriveSessionGraphPartitions,
  isExcludedFromReasoning,
  SessionId,
} from "@beep/ontology-domain/aggregates/Session";
import { makeDataset, makeLiteral, makeNamedNode, makeQuad } from "@beep/rdf/Rdf";
import { XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { describe, expect, it } from "@effect/vitest";
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
        quad: knowsQuad,
      })
    );

    const partitions = deriveSessionGraphPartitions(session);

    expect(partitions.asserted.quads).toHaveLength(1);
    expect(partitions.ontologies.quads).toHaveLength(1);
    expect(partitions.inferred.quads).toHaveLength(0);
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
});
