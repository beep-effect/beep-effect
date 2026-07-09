import { fileURLToPath } from "node:url";
import { applyChangeOperationsWithDelta, ChangeOperation, SessionId } from "@beep/ontology-domain/aggregates/Session";
import { OntologyServerTest } from "@beep/ontology-server/test";
import {
  OntologyFilePath,
  OntologyFileStore,
  OpenOntologyFileCommand,
  ParseTurtleRequest,
  ReadOntologyFileRequest,
  SerializeOntologySessionCommand,
  SerializeTurtleRequest,
  SessionUseCases,
  TurtleCodec,
} from "@beep/ontology-use-cases/aggregates/Session";
import { makeLiteral, makeNamedNode, makeQuad, serializeQuad } from "@beep/rdf/Rdf";
import { OWL_CLASS } from "@beep/rdf/Vocab/Owl";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { CanonicalizationServiceLive } from "@beep/rdf-canonize/adapters/canonicalization";
import { CanonicalizationService, FingerprintDatasetRequest } from "@beep/semantic-web/services/canonicalization";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as S from "effect/Schema";
import type { Dataset } from "@beep/rdf/Rdf";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const TestLayer = Layer.mergeAll(
  OntologyServerTest.pipe(Layer.provide(NodeServices.layer)),
  CanonicalizationServiceLive
);

const fixturePath = (relativePath: string): OntologyFilePath =>
  S.decodeUnknownSync(OntologyFilePath)(fileURLToPath(new URL(`./fixtures/${relativePath}`, import.meta.url)));

const turtleFixtures = [
  "foaf-social-network/graph.ttl",
  "ontoauthor-mat/t1-subsumption/reference.ttl",
  "ontoauthor-mat/t1-subsumption/shapes.ttl",
  "ontoauthor-mat/t2-existential/reference.ttl",
  "ontoauthor-mat/t2-existential/shapes.ttl",
  "ontoauthor-mat/t3-universal/reference.ttl",
  "ontoauthor-mat/t3-universal/shapes.ttl",
  "ontoauthor-mat/t4-disjointness/reference.ttl",
  "ontoauthor-mat/t4-disjointness/shapes.ttl",
  "ontoauthor-mat/t5-sameas/reference.ttl",
  "ontoauthor-mat/t5-sameas/shapes.ttl",
  "ontoauthor-mat/t6-unsatisfiability/reference.ttl",
  "ontoauthor-mat/t6-unsatisfiability/shapes.ttl",
  "real-world/prov-o-starting-point.ttl",
] as const;

const fingerprintDataset = Effect.fn("fingerprintDataset")(function* (dataset: Dataset) {
  const canonicalization = yield* CanonicalizationService;
  return yield* canonicalization.fingerprint(
    FingerprintDatasetRequest.make({
      algorithm: "rdfc-1.0",
      dataset,
    })
  );
});

const roundTripFixture = Effect.fn("roundTripFixture")(function* (path: OntologyFilePath) {
  const fileStore = yield* OntologyFileStore;
  const turtle = yield* TurtleCodec;
  const file = yield* fileStore.read(ReadOntologyFileRequest.make({ path }));
  const parsed = yield* turtle.parse(ParseTurtleRequest.make({ source: file.source }));
  const before = yield* fingerprintDataset(parsed.dataset);
  const serialized = yield* turtle.serialize(
    SerializeTurtleRequest.make({
      dataset: parsed.dataset,
      prefixes: parsed.prefixes,
    })
  );
  const reparsed = yield* turtle.parse(ParseTurtleRequest.make({ source: serialized.source }));
  const after = yield* fingerprintDataset(reparsed.dataset);

  return {
    after,
    before,
    prefixes: parsed.prefixes,
    quadCount: parsed.dataset.quads.length,
    serializedSource: serialized.source,
  };
});

describe("Ontology server Turtle round-trip", () => {
  it.effect(
    "round-trips fixture ontologies by canonical fingerprint with preserved prefixes",
    Effect.fnUntraced(function* () {
      for (const relativePath of turtleFixtures) {
        const result = yield* roundTripFixture(fixturePath(relativePath));
        const prefixLabels = Object.keys(result.prefixes);

        expect(result.quadCount).toBeGreaterThan(0);
        expect(result.after.fingerprint).toBe(result.before.fingerprint);
        for (const prefix of prefixLabels) {
          expect(result.serializedSource).toContain(`@prefix ${prefix}:`);
        }
      }
    }, provideScopedLayer(TestLayer))
  );

  it.effect(
    "open-to-serialize excludes derived graph partitions from primary Turtle",
    Effect.fnUntraced(function* () {
      const useCases = yield* SessionUseCases;
      const turtle = yield* TurtleCodec;
      const interopSessionId = yield* S.decodeUnknownEffect(SessionId)("interop-derived-leakage");
      const opened = yield* useCases.openFile(
        OpenOntologyFileCommand.make({
          sessionId: interopSessionId,
          path: fixturePath("real-world/prov-o-starting-point.ttl"),
        })
      );
      const inferredOnly = makeQuad(makeNamedNode("urn:beep:ontology:interop:inferred-only"), RDF_TYPE, OWL_CLASS);
      const provenanceOnly = makeQuad(
        makeNamedNode("urn:beep:ontology:interop:provenance-only"),
        makeNamedNode("http://purl.org/dc/terms/description"),
        makeLiteral("derived partition sentinel", XSD_STRING.value)
      );
      const session = applyChangeOperationsWithDelta(opened.session, [
        ChangeOperation.make({
          kind: "addQuad",
          partition: "inferred",
          quad: inferredOnly,
        }),
        ChangeOperation.make({
          kind: "addQuad",
          partition: "provenance",
          quad: provenanceOnly,
        }),
      ]).session;

      const serialized = yield* useCases.serialize(SerializeOntologySessionCommand.make({ session }));
      const reparsed = yield* turtle.parse(ParseTurtleRequest.make({ source: serialized.source }));
      const reparsedQuads = reparsed.dataset.quads.map(serializeQuad);

      expect(serialized.source).not.toContain("inferred-only");
      expect(serialized.source).not.toContain("provenance-only");
      expect(reparsedQuads).not.toContain(serializeQuad(inferredOnly));
      expect(reparsedQuads).not.toContain(serializeQuad(provenanceOnly));
    }, provideScopedLayer(TestLayer))
  );
});
