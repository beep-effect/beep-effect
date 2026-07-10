import { fileURLToPath } from "node:url";
import {
  applyChangeOperationsWithDelta,
  ChangeOperation,
  graphPartitionIri,
  SessionId,
} from "@beep/ontology-domain/aggregates/Session";
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
  WriteOntologyFileRequest,
} from "@beep/ontology-use-cases/aggregates/Session";
import { makeLiteral, makeNamedNode, makeQuad } from "@beep/rdf/Rdf";
import { OWL_CLASS } from "@beep/rdf/Vocab/Owl";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { CanonicalizationServiceLive } from "@beep/rdf-canonize/adapters/canonicalization";
import { CanonicalizationService, FingerprintDatasetRequest } from "@beep/semantic-web/services/canonicalization";
import { fcRuns } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, FileSystem, Layer, Path, Result } from "effect";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import type { Dataset } from "@beep/rdf/Rdf";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const TestLayer = Layer.mergeAll(
  OntologyServerTest.pipe(Layer.provide(NodeServices.layer)),
  CanonicalizationServiceLive
);

const ontologyServerTestLayerForRoot = (root: string) =>
  OntologyServerTest.pipe(
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ ONTOLOGY_WORKSPACE_ROOT: root }))),
    Layer.provide(NodeServices.layer)
  );

const ontologyServerTestLayerForRootWithFileSystem = (
  root: string,
  fileSystemLayer: Layer.Layer<FileSystem.FileSystem>
) =>
  OntologyServerTest.pipe(
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ ONTOLOGY_WORKSPACE_ROOT: root }))),
    Layer.provide(Layer.mergeAll(fileSystemLayer, NodePath.layer))
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
    "rejects derived graph partition changes before Turtle serialization",
    Effect.fnUntraced(function* () {
      const useCases = yield* SessionUseCases;
      const interopSessionId = yield* S.decodeUnknownEffect(SessionId)("interop-derived-leakage");
      const opened = yield* useCases.openFile(
        OpenOntologyFileCommand.make({
          sessionId: interopSessionId,
          path: fixturePath("real-world/prov-o-starting-point.ttl"),
        })
      );
      const inferredOnly = makeQuad(makeNamedNode("urn:beep:ontology:interop:inferred-only"), RDF_TYPE, {
        object: OWL_CLASS,
        graph: makeNamedNode(graphPartitionIri("inferred")),
      });
      const provenanceOnly = makeQuad(
        makeNamedNode("urn:beep:ontology:interop:provenance-only"),
        makeNamedNode("http://purl.org/dc/terms/description"),
        {
          object: makeLiteral("derived partition sentinel", XSD_STRING.value),
          graph: makeNamedNode(graphPartitionIri("provenance")),
        }
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

      const error = yield* useCases.serialize(SerializeOntologySessionCommand.make({ session })).pipe(Effect.flip);

      expect(error).toMatchObject({
        reason: "unsupportedPartition",
      });
    }, provideScopedLayer(TestLayer))
  );

  it.effect(
    "rejects ontology file paths that escape the configured workspace root",
    Effect.fnUntraced(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fileSystem.makeTempDirectoryScoped({ prefix: "beep-ontology-root-" });
      const outside = yield* fileSystem.makeTempDirectoryScoped({ prefix: "beep-ontology-outside-" });
      const escapingPath = S.decodeUnknownSync(OntologyFilePath)(path.join("..", path.basename(outside), "escape.ttl"));
      const error = yield* Effect.gen(function* () {
        const fileStore = yield* OntologyFileStore;
        return yield* fileStore.read(ReadOntologyFileRequest.make({ path: escapingPath })).pipe(Effect.flip);
      }).pipe(provideScopedLayer(ontologyServerTestLayerForRoot(root)));

      expect(error.reason).toBe("readFailed");
      expect(error.message).toContain("escapes the allowed root");
    }, provideScopedLayer(NodeServices.layer))
  );

  it.effect(
    "keeps the original Turtle file intact when atomic rename fails",
    Effect.fnUntraced(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fileSystem.makeTempDirectoryScoped({ prefix: "beep-ontology-root-" });
      const target = path.join(root, "session.ttl");
      yield* fileSystem.writeFileString(target, "original turtle");
      const failingRenameFileSystem = {
        ...fileSystem,
        rename: () =>
          Effect.fail(
            PlatformError.badArgument({
              description: "simulated rename failure",
              method: "rename",
              module: "FileSystem",
            })
          ),
      };
      const failingFileSystemLayer = Layer.succeed(FileSystem.FileSystem, failingRenameFileSystem);
      const error = yield* Effect.gen(function* () {
        const fileStore = yield* OntologyFileStore;
        return yield* fileStore
          .write(
            WriteOntologyFileRequest.make({
              path: S.decodeUnknownSync(OntologyFilePath)("session.ttl"),
              source: "new turtle",
            })
          )
          .pipe(Effect.flip);
      }).pipe(provideScopedLayer(ontologyServerTestLayerForRootWithFileSystem(root, failingFileSystemLayer)));
      const restored = yield* fileSystem.readFileString(target);
      const entries = yield* fileSystem.readDirectory(root);

      expect(error.reason).toBe("writeFailed");
      expect(restored).toBe("original turtle");
      expect(entries).toEqual(["session.ttl"]);
    }, provideScopedLayer(NodeServices.layer))
  );
});

const assertSchemaRoundTrip = <Schema extends S.Codec<unknown>>(schema: Schema): void => {
  const decode = S.decodeUnknownResult(schema);
  const encode = S.encodeResult(schema);
  const equivalent = S.toEquivalence(schema);

  fc.assert(
    fc.property(S.toArbitrary(schema), (value) => {
      const encoded = Result.getOrThrow(encode(value));
      const decoded = Result.getOrThrow(decode(encoded));

      expect(equivalent(decoded, value)).toBe(true);
    }),
    fcRuns(10)
  );
};

describe("Session server schema round-trips", () => {
  it("round-trips file-store and codec request schemas with schema-derived arbitraries", () => {
    assertSchemaRoundTrip(ReadOntologyFileRequest);
    assertSchemaRoundTrip(WriteOntologyFileRequest);
    assertSchemaRoundTrip(ParseTurtleRequest);
  });
});
