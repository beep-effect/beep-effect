import { fileURLToPath } from "node:url";
import {
  applyChangeOperationsWithDelta,
  ChangeOperation,
  graphPartitionIri,
  SessionId,
} from "@beep/ontology-domain/aggregates/Session";
import { OntologyFileStoreLayer } from "@beep/ontology-server/aggregates/Session";
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
import { Cause, ConfigProvider, Effect, Exit, FileSystem, Layer, Path, Result } from "effect";
import * as Eq from "effect/Equal";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import type { Dataset } from "@beep/rdf/Rdf";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const fixturesRoot = fileURLToPath(new URL("./fixtures/", import.meta.url));

const TestLayer = Layer.mergeAll(
  OntologyServerTest.pipe(
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ ONTOLOGY_WORKSPACE_ROOT: fixturesRoot }))),
    Layer.provide(NodeServices.layer)
  ),
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

const ontologyFileStoreLayerForConfiguration = (configuration: Readonly<Record<string, string>>) =>
  OntologyFileStoreLayer.pipe(
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(configuration))),
    Layer.provide(NodeServices.layer)
  );

const fixturePath = (relativePath: string): OntologyFilePath => S.decodeUnknownSync(OntologyFilePath)(relativePath);

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
    "rejects traversal paths before resolving them against the configured workspace root",
    Effect.fnUntraced(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fileSystem.makeTempDirectoryScoped({ prefix: "beep-ontology-root-" });
      const outside = yield* fileSystem.makeTempDirectoryScoped({ prefix: "beep-ontology-outside-" });
      const escapingPath = yield* S.decodeUnknownEffect(OntologyFilePath)(
        path.join("..", path.basename(outside), "escape.ttl")
      );
      const error = yield* Effect.gen(function* () {
        const fileStore = yield* OntologyFileStore;
        return yield* fileStore.read(ReadOntologyFileRequest.make({ path: escapingPath })).pipe(Effect.flip);
      }).pipe(provideScopedLayer(ontologyServerTestLayerForRoot(root)));

      expect(error.reason).toBe("readFailed");
      expect(error.message).toContain("root-relative");
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
        const sessionPath = yield* S.decodeUnknownEffect(OntologyFilePath)("session.ttl");
        return yield* fileStore
          .write(
            WriteOntologyFileRequest.make({
              path: sessionPath,
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

describe("Ontology file-store security boundary", () => {
  it.effect(
    "reads and atomically writes root-relative Turtle documents",
    Effect.fnUntraced(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fileSystem.makeTempDirectoryScoped({ prefix: "beep-ontology-root-" });
      yield* fileSystem.writeFileString(path.join(root, "source.ttl"), "original turtle");

      const result = yield* Effect.gen(function* () {
        const fileStore = yield* OntologyFileStore;
        const sourcePath = yield* S.decodeUnknownEffect(OntologyFilePath)("source.ttl");
        const nestedPath = yield* S.decodeUnknownEffect(OntologyFilePath)("nested/result.ttl");
        const read = yield* fileStore.read(ReadOntologyFileRequest.make({ path: sourcePath }));
        yield* fileStore.write(WriteOntologyFileRequest.make({ path: nestedPath, source: read.source }));
        return read;
      }).pipe(provideScopedLayer(ontologyFileStoreLayerForConfiguration({ ONTOLOGY_WORKSPACE_ROOT: root })));

      expect(result.source).toBe("original turtle");
      expect(yield* fileSystem.readFileString(path.join(root, "nested/result.ttl"))).toBe("original turtle");
      expect(yield* fileSystem.readDirectory(path.join(root, "nested"))).toEqual(["result.ttl"]);
    }, provideScopedLayer(NodeServices.layer))
  );

  it.effect(
    "fails layer construction when workspace-root configuration is missing or invalid",
    Effect.fnUntraced(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const temporaryRoot = yield* fileSystem.makeTempDirectoryScoped({ prefix: "beep-ontology-root-" });
      const nonDirectoryRoot = path.join(temporaryRoot, "root.ttl");
      const missingRoot = path.join(temporaryRoot, "missing");
      yield* fileSystem.writeFileString(nonDirectoryRoot, "not a directory");

      const configurations: ReadonlyArray<Readonly<Record<string, string>>> = [
        {},
        { ONTOLOGY_WORKSPACE_ROOT: "" },
        { ONTOLOGY_WORKSPACE_ROOT: missingRoot },
        { ONTOLOGY_WORKSPACE_ROOT: nonDirectoryRoot },
      ];

      for (const configuration of configurations) {
        const exit = yield* Effect.exit(
          Effect.scoped(Layer.build(ontologyFileStoreLayerForConfiguration(configuration)))
        );
        expect(Exit.isFailure(exit)).toBe(true);
        if (Exit.isFailure(exit)) {
          expect(Cause.hasFails(exit.cause)).toBe(true);
          expect(Cause.hasDies(exit.cause)).toBe(false);
        }
      }
    }, provideScopedLayer(NodeServices.layer))
  );

  it.effect(
    "rejects absolute, traversal, and non-Turtle paths before read or write",
    Effect.fnUntraced(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fileSystem.makeTempDirectoryScoped({ prefix: "beep-ontology-root-" });
      const outside = yield* fileSystem.makeTempDirectoryScoped({ prefix: "beep-ontology-outside-" });
      const absoluteTarget = path.join(outside, "absolute.ttl");
      const outsideCreation = path.join(outside, "created");
      const candidates = [
        absoluteTarget,
        path.join("..", path.basename(outside), "created/nested.ttl"),
        "ontology.TTL",
        "ontology.txt",
        "nested\\ontology.ttl",
      ];

      yield* Effect.gen(function* () {
        const fileStore = yield* OntologyFileStore;

        for (const candidate of candidates) {
          const candidatePath = yield* S.decodeUnknownEffect(OntologyFilePath)(candidate);
          const readError = yield* fileStore
            .read(ReadOntologyFileRequest.make({ path: candidatePath }))
            .pipe(Effect.flip);
          const writeError = yield* fileStore
            .write(WriteOntologyFileRequest.make({ path: candidatePath, source: "outside write" }))
            .pipe(Effect.flip);

          expect(readError.reason).toBe("readFailed");
          expect(writeError.reason).toBe("writeFailed");
          expect(readError.message).toContain("root-relative");
          expect(writeError.message).toContain("root-relative");
        }
      }).pipe(provideScopedLayer(ontologyFileStoreLayerForConfiguration({ ONTOLOGY_WORKSPACE_ROOT: root })));

      expect(yield* fileSystem.exists(absoluteTarget)).toBe(false);
      expect(yield* fileSystem.exists(outsideCreation)).toBe(false);
    }, provideScopedLayer(NodeServices.layer))
  );

  it.effect(
    "rejects read and write symlink escapes without changing the outside victim",
    Effect.fnUntraced(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fileSystem.makeTempDirectoryScoped({ prefix: "beep-ontology-root-" });
      const outside = yield* fileSystem.makeTempDirectoryScoped({ prefix: "beep-ontology-outside-" });
      const outsideVictim = path.join(outside, "victim.ttl");
      const linkPath = path.join(root, "linked.ttl");
      yield* fileSystem.writeFileString(outsideVictim, "outside remains unchanged");
      yield* fileSystem.symlink(outsideVictim, linkPath);

      yield* Effect.gen(function* () {
        const fileStore = yield* OntologyFileStore;
        const candidate = yield* S.decodeUnknownEffect(OntologyFilePath)("linked.ttl");
        const readError = yield* fileStore.read(ReadOntologyFileRequest.make({ path: candidate })).pipe(Effect.flip);
        const writeError = yield* fileStore
          .write(WriteOntologyFileRequest.make({ path: candidate, source: "attacker-controlled turtle" }))
          .pipe(Effect.flip);

        expect(readError.reason).toBe("readFailed");
        expect(writeError.reason).toBe("writeFailed");
        expect(readError.message).toContain("escapes the allowed root");
        expect(writeError.message).toContain("escapes the allowed root");
      }).pipe(provideScopedLayer(ontologyFileStoreLayerForConfiguration({ ONTOLOGY_WORKSPACE_ROOT: root })));

      expect(yield* fileSystem.readFileString(outsideVictim)).toBe("outside remains unchanged");
      expect(yield* fileSystem.readLink(linkPath)).toBe(outsideVictim);
    }, provideScopedLayer(NodeServices.layer))
  );

  it.effect(
    "rejects a Turtle-named symlink to an in-root non-Turtle file without changing the victim",
    Effect.fnUntraced(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fileSystem.makeTempDirectoryScoped({ prefix: "beep-ontology-root-" });
      const victim = path.join(root, "secret.txt");
      const alias = path.join(root, "alias.ttl");
      yield* fileSystem.writeFileString(victim, "non-Turtle victim remains unchanged");
      yield* fileSystem.symlink(victim, alias);

      yield* Effect.gen(function* () {
        const fileStore = yield* OntologyFileStore;
        const candidate = yield* S.decodeUnknownEffect(OntologyFilePath)("alias.ttl");
        const readError = yield* fileStore.read(ReadOntologyFileRequest.make({ path: candidate })).pipe(Effect.flip);
        const writeError = yield* fileStore
          .write(WriteOntologyFileRequest.make({ path: candidate, source: "attacker-controlled turtle" }))
          .pipe(Effect.flip);

        expect(readError.reason).toBe("readFailed");
        expect(writeError.reason).toBe("writeFailed");
        expect(readError.message).toContain("must resolve");
        expect(writeError.message).toContain("must resolve");
      }).pipe(provideScopedLayer(ontologyFileStoreLayerForConfiguration({ ONTOLOGY_WORKSPACE_ROOT: root })));

      expect(yield* fileSystem.readFileString(victim)).toBe("non-Turtle victim remains unchanged");
      expect(yield* fileSystem.readLink(alias)).toBe(victim);
    }, provideScopedLayer(NodeServices.layer))
  );

  it.effect(
    "rejects a POSIX literal-backslash canonical target without changing the victim",
    Effect.fnUntraced(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;

      if (!Eq.equals(path.sep, "/")) {
        return;
      }

      const root = yield* fileSystem.makeTempDirectoryScoped({ prefix: "beep-ontology-root-" });
      const victim = path.join(root, "secret\\name.ttl");
      const alias = path.join(root, "alias.ttl");
      yield* fileSystem.writeFileString(victim, "literal-backslash victim remains unchanged");
      yield* fileSystem.symlink(victim, alias);

      yield* Effect.gen(function* () {
        const fileStore = yield* OntologyFileStore;
        const candidate = yield* S.decodeUnknownEffect(OntologyFilePath)("alias.ttl");
        const readError = yield* fileStore.read(ReadOntologyFileRequest.make({ path: candidate })).pipe(Effect.flip);
        const writeError = yield* fileStore
          .write(WriteOntologyFileRequest.make({ path: candidate, source: "attacker-controlled turtle" }))
          .pipe(Effect.flip);

        expect(readError.reason).toBe("readFailed");
        expect(writeError.reason).toBe("writeFailed");
        expect(readError.message).toContain("must resolve");
        expect(writeError.message).toContain("must resolve");
      }).pipe(provideScopedLayer(ontologyFileStoreLayerForConfiguration({ ONTOLOGY_WORKSPACE_ROOT: root })));

      expect(yield* fileSystem.readFileString(victim)).toBe("literal-backslash victim remains unchanged");
      expect(yield* fileSystem.readLink(alias)).toBe(victim);
    }, provideScopedLayer(NodeServices.layer))
  );

  it.effect(
    "keeps the startup-canonicalized workspace root pinned after its configured path is swapped",
    Effect.fnUntraced(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const sandbox = yield* fileSystem.makeTempDirectoryScoped({ prefix: "beep-ontology-root-swap-" });
      const configuredRoot = path.join(sandbox, "workspace");
      const movedRoot = path.join(sandbox, "workspace-moved");
      const outside = path.join(sandbox, "outside");
      const outsideVictim = path.join(outside, "victim.ttl");
      yield* fileSystem.makeDirectory(configuredRoot);
      yield* fileSystem.makeDirectory(outside);
      yield* fileSystem.writeFileString(outsideVictim, "outside remains unchanged");

      yield* Effect.gen(function* () {
        const fileStore = yield* OntologyFileStore;
        const candidate = yield* S.decodeUnknownEffect(OntologyFilePath)("victim.ttl");

        yield* fileSystem.rename(configuredRoot, movedRoot);
        yield* fileSystem.symlink(outside, configuredRoot);

        const readError = yield* fileStore.read(ReadOntologyFileRequest.make({ path: candidate })).pipe(Effect.flip);
        const writeError = yield* fileStore
          .write(WriteOntologyFileRequest.make({ path: candidate, source: "attacker-controlled turtle" }))
          .pipe(Effect.flip);

        expect(readError.reason).toBe("readFailed");
        expect(writeError.reason).toBe("writeFailed");
        expect(readError.message).toContain("escapes the allowed root");
        expect(writeError.message).toContain("escapes the allowed root");
      }).pipe(provideScopedLayer(ontologyFileStoreLayerForConfiguration({ ONTOLOGY_WORKSPACE_ROOT: configuredRoot })));

      expect(yield* fileSystem.readFileString(outsideVictim)).toBe("outside remains unchanged");
      expect(yield* fileSystem.readLink(configuredRoot)).toBe(outside);
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
