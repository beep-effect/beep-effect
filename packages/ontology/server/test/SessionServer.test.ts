import { fileURLToPath } from "node:url";
import { $OntologyServerId } from "@beep/identity/packages";
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
  SaveOntologyFileCommand,
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
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import { Cause, ConfigProvider, Context, Effect, Exit, FileSystem, Layer, Path, pipe, Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as Eq from "effect/Equal";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import type { Dataset } from "@beep/rdf/Rdf";

const $I = $OntologyServerId.create("test/SessionServer");

const decodeOntologyFilePath = S.decodeEffect(OntologyFilePath);
const decodeSessionId = S.decodeEffect(SessionId);
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

const fixturePath = (relativePath: string): OntologyFilePath => OntologyFilePath.make(relativePath);

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
  {
    const acquireNativeFixture = Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fileSystem.makeTempDirectoryScoped({ prefix: "beep-ontology-prefix-round-trip-" });
      const source = yield* fileSystem.readFileString(path.join(fixturesRoot, "base-prefix/round-trip.ttl"));
      yield* fileSystem.writeFileString(path.join(root, "round-trip.ttl"), source);
      return { path, root, source };
    });
    class NativeFixture extends Context.Service<NativeFixture, Effect.Success<typeof acquireNativeFixture>>()(
      $I`NativeFixture0`
    ) {}
    const nativeFixtureLayer = Layer.effect(NativeFixture, acquireNativeFixture).pipe(
      Layer.provideMerge(NodeServices.layer)
    );
    it.layer(
      Layer.unwrap(
        Effect.map(NativeFixture, ({ root }) =>
          Layer.merge(ontologyServerTestLayerForRoot(root), CanonicalizationServiceLive)
        )
      ).pipe(Layer.provideMerge(nativeFixtureLayer)),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect(
        "preserves the empty base prefix through session open and save with a stable fingerprint",
        Effect.fnUntraced(function* () {
          const useCases = yield* SessionUseCases;
          const fileStore = yield* OntologyFileStore;
          const turtle = yield* TurtleCodec;
          const documentPath = yield* decodeOntologyFilePath("round-trip.ttl");
          const roundTripSessionId = yield* decodeSessionId("base-prefix-round-trip");
          const opened = yield* useCases.openFile(
            OpenOntologyFileCommand.make({ sessionId: roundTripSessionId, path: documentPath })
          );
          const before = yield* fingerprintDataset(opened.session.baseDataset);
          const saved = yield* useCases.saveFile(
            SaveOntologyFileCommand.make({ session: opened.session, path: documentPath })
          );
          const persisted = yield* fileStore.read(ReadOntologyFileRequest.make({ path: documentPath }));
          const reparsed = yield* turtle.parse(ParseTurtleRequest.make({ source: persisted.source }));
          const after = yield* fingerprintDataset(reparsed.dataset);
          const result = { after, before, opened, reparsed, saved };

          expect(result.opened.session.prefixes).toMatchObject({
            "": "https://example.test/base/",
            schema: "https://schema.org/",
          });
          expect(result.reparsed.prefixes).toMatchObject({
            "": "https://example.test/base/",
            schema: "https://schema.org/",
          });
          expect(result.saved.source).toContain("@prefix :");
          expect(result.saved.source).toContain("@prefix schema:");
          expect(result.after.fingerprint).toBe(result.before.fingerprint);
        })
      );
    });
  }

  it.layer(TestLayer, { timeout: "30 seconds" })((it) => {
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
      })
    );
  });

  it.layer(TestLayer, { timeout: "30 seconds" })((it) => {
    it.effect(
      "rejects derived graph partition changes before Turtle serialization",
      Effect.fnUntraced(function* () {
        const useCases = yield* SessionUseCases;
        const interopSessionId = yield* decodeSessionId("interop-derived-leakage");
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
      })
    );
  });

  {
    const acquireNativeFixture = Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fileSystem.makeTempDirectoryScoped({ prefix: "beep-ontology-root-" });
      const outside = yield* fileSystem.makeTempDirectoryScoped({ prefix: "beep-ontology-outside-" });
      const escapingPath = yield* decodeOntologyFilePath(path.join("..", path.basename(outside), "escape.ttl"));
      return { path, root, escapingPath };
    });
    class NativeFixture extends Context.Service<NativeFixture, Effect.Success<typeof acquireNativeFixture>>()(
      $I`NativeFixture1`
    ) {}
    const nativeFixtureLayer = Layer.effect(NativeFixture, acquireNativeFixture).pipe(
      Layer.provideMerge(NodeServices.layer)
    );
    it.layer(
      Layer.unwrap(Effect.map(NativeFixture, ({ root }) => ontologyServerTestLayerForRoot(root))).pipe(
        Layer.provideMerge(nativeFixtureLayer)
      ),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect(
        "rejects traversal paths before resolving them against the configured workspace root",
        Effect.fnUntraced(function* () {
          const { escapingPath } = yield* NativeFixture;
          const fileStore = yield* OntologyFileStore;
          const error = yield* fileStore.read(ReadOntologyFileRequest.make({ path: escapingPath })).pipe(Effect.flip);

          expect(error.reason).toBe("readFailed");
          expect(error.message).toContain("root-relative");
        })
      );
    });
  }

  {
    const acquireNativeFixture = Effect.gen(function* () {
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
      return { fileSystem, path, root, target, failingFileSystemLayer };
    });
    class NativeFixture extends Context.Service<NativeFixture, Effect.Success<typeof acquireNativeFixture>>()(
      $I`NativeFixture2`
    ) {}
    const nativeFixtureLayer = Layer.effect(NativeFixture, acquireNativeFixture).pipe(
      Layer.provideMerge(NodeServices.layer)
    );
    it.layer(
      Layer.unwrap(
        Effect.map(NativeFixture, ({ root, failingFileSystemLayer }) =>
          ontologyServerTestLayerForRootWithFileSystem(root, failingFileSystemLayer)
        )
      ).pipe(Layer.provideMerge(nativeFixtureLayer)),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect(
        "keeps the original Turtle file intact when atomic rename fails",
        Effect.fnUntraced(function* () {
          const { fileSystem, root, target } = yield* NativeFixture;
          const fileStore = yield* OntologyFileStore;
          const sessionPath = yield* decodeOntologyFilePath("session.ttl");
          const error = yield* fileStore
            .write(
              WriteOntologyFileRequest.make({
                path: sessionPath,
                source: "new turtle",
              })
            )
            .pipe(Effect.flip);
          const restored = yield* fileSystem.readFileString(target);
          const entries = yield* fileSystem.readDirectory(root);

          expect(error.reason).toBe("writeFailed");
          expect(restored).toBe("original turtle");
          expect(entries).toEqual(["session.ttl"]);
        })
      );
    });
  }
});

describe("Ontology file-store security boundary", () => {
  {
    const acquireNativeFixture = Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fileSystem.makeTempDirectoryScoped({ prefix: "beep-ontology-root-" });
      yield* fileSystem.writeFileString(path.join(root, "source.ttl"), "original turtle");
      return { fileSystem, path, root };
    });
    class NativeFixture extends Context.Service<NativeFixture, Effect.Success<typeof acquireNativeFixture>>()(
      $I`NativeFixture3`
    ) {}
    const nativeFixtureLayer = Layer.effect(NativeFixture, acquireNativeFixture).pipe(
      Layer.provideMerge(NodeServices.layer)
    );
    it.layer(
      Layer.unwrap(
        Effect.map(NativeFixture, ({ root }) =>
          ontologyFileStoreLayerForConfiguration({ ONTOLOGY_WORKSPACE_ROOT: root })
        )
      ).pipe(Layer.provideMerge(nativeFixtureLayer)),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect(
        "reads and atomically writes root-relative Turtle documents",
        Effect.fnUntraced(function* () {
          const { fileSystem, path, root } = yield* NativeFixture;
          const fileStore = yield* OntologyFileStore;
          const sourcePath = yield* decodeOntologyFilePath("source.ttl");
          const nestedPath = yield* decodeOntologyFilePath("nested/result.ttl");
          const read = yield* fileStore.read(ReadOntologyFileRequest.make({ path: sourcePath }));
          yield* fileStore.write(WriteOntologyFileRequest.make({ path: nestedPath, source: read.source }));
          const result = read;

          expect(result.source).toBe("original turtle");
          expect(yield* fileSystem.readFileString(path.join(root, "nested/result.ttl"))).toBe("original turtle");
          expect(yield* fileSystem.readDirectory(path.join(root, "nested"))).toEqual(["result.ttl"]);
        })
      );
    });
  }

  it.layer(NodeServices.layer, { timeout: "30 seconds" })((it) => {
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
          pipe(exit, Exit.isFailure, assertTrue);
          if (Exit.isFailure(exit)) {
            pipe(Cause.hasFails(exit.cause), assertTrue);
            pipe(Cause.hasDies(exit.cause), assertFalse);
          }
        }
      })
    );
  });

  {
    const acquireNativeFixture = Effect.gen(function* () {
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
      return { fileSystem, path, root, absoluteTarget, outsideCreation, candidates };
    });
    class NativeFixture extends Context.Service<NativeFixture, Effect.Success<typeof acquireNativeFixture>>()(
      $I`NativeFixture4`
    ) {}
    const nativeFixtureLayer = Layer.effect(NativeFixture, acquireNativeFixture).pipe(
      Layer.provideMerge(NodeServices.layer)
    );
    it.layer(
      Layer.unwrap(
        Effect.map(NativeFixture, ({ root }) =>
          ontologyFileStoreLayerForConfiguration({ ONTOLOGY_WORKSPACE_ROOT: root })
        )
      ).pipe(Layer.provideMerge(nativeFixtureLayer)),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect(
        "rejects absolute, traversal, and non-Turtle paths before read or write",
        Effect.fnUntraced(function* () {
          const { fileSystem, absoluteTarget, outsideCreation, candidates } = yield* NativeFixture;
          const fileStore = yield* OntologyFileStore;
          for (const candidate of candidates) {
            const candidatePath = yield* decodeOntologyFilePath(candidate);
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

          pipe(yield* fileSystem.exists(absoluteTarget), assertFalse);
          pipe(yield* fileSystem.exists(outsideCreation), assertFalse);
        })
      );
    });
  }

  {
    const acquireNativeFixture = Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fileSystem.makeTempDirectoryScoped({ prefix: "beep-ontology-root-" });
      const outside = yield* fileSystem.makeTempDirectoryScoped({ prefix: "beep-ontology-outside-" });
      const outsideVictim = path.join(outside, "victim.ttl");
      const linkPath = path.join(root, "linked.ttl");
      yield* fileSystem.writeFileString(outsideVictim, "outside remains unchanged");
      yield* fileSystem.symlink(outsideVictim, linkPath);
      return { fileSystem, path, root, outsideVictim, linkPath };
    });
    class NativeFixture extends Context.Service<NativeFixture, Effect.Success<typeof acquireNativeFixture>>()(
      $I`NativeFixture5`
    ) {}
    const nativeFixtureLayer = Layer.effect(NativeFixture, acquireNativeFixture).pipe(
      Layer.provideMerge(NodeServices.layer)
    );
    it.layer(
      Layer.unwrap(
        Effect.map(NativeFixture, ({ root }) =>
          ontologyFileStoreLayerForConfiguration({ ONTOLOGY_WORKSPACE_ROOT: root })
        )
      ).pipe(Layer.provideMerge(nativeFixtureLayer)),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect(
        "rejects read and write symlink escapes without changing the outside victim",
        Effect.fnUntraced(function* () {
          const { fileSystem, outsideVictim, linkPath } = yield* NativeFixture;
          const fileStore = yield* OntologyFileStore;
          const candidate = yield* decodeOntologyFilePath("linked.ttl");
          const readError = yield* fileStore.read(ReadOntologyFileRequest.make({ path: candidate })).pipe(Effect.flip);
          const writeError = yield* fileStore
            .write(WriteOntologyFileRequest.make({ path: candidate, source: "attacker-controlled turtle" }))
            .pipe(Effect.flip);
          expect(readError.reason).toBe("readFailed");
          expect(writeError.reason).toBe("writeFailed");
          expect(readError.message).toContain("escapes the allowed root");
          expect(writeError.message).toContain("escapes the allowed root");

          expect(yield* fileSystem.readFileString(outsideVictim)).toBe("outside remains unchanged");
          expect(yield* fileSystem.readLink(linkPath)).toBe(outsideVictim);
        })
      );
    });
  }

  {
    const acquireNativeFixture = Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fileSystem.makeTempDirectoryScoped({ prefix: "beep-ontology-root-" });
      const victim = path.join(root, "secret.txt");
      const alias = path.join(root, "alias.ttl");
      yield* fileSystem.writeFileString(victim, "non-Turtle victim remains unchanged");
      yield* fileSystem.symlink(victim, alias);
      return { fileSystem, path, root, victim, alias };
    });
    class NativeFixture extends Context.Service<NativeFixture, Effect.Success<typeof acquireNativeFixture>>()(
      $I`NativeFixture6`
    ) {}
    const nativeFixtureLayer = Layer.effect(NativeFixture, acquireNativeFixture).pipe(
      Layer.provideMerge(NodeServices.layer)
    );
    it.layer(
      Layer.unwrap(
        Effect.map(NativeFixture, ({ root }) =>
          ontologyFileStoreLayerForConfiguration({ ONTOLOGY_WORKSPACE_ROOT: root })
        )
      ).pipe(Layer.provideMerge(nativeFixtureLayer)),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect(
        "rejects a Turtle-named symlink to an in-root non-Turtle file without changing the victim",
        Effect.fnUntraced(function* () {
          const { fileSystem, victim, alias } = yield* NativeFixture;
          const fileStore = yield* OntologyFileStore;
          const candidate = yield* decodeOntologyFilePath("alias.ttl");
          const readError = yield* fileStore.read(ReadOntologyFileRequest.make({ path: candidate })).pipe(Effect.flip);
          const writeError = yield* fileStore
            .write(WriteOntologyFileRequest.make({ path: candidate, source: "attacker-controlled turtle" }))
            .pipe(Effect.flip);
          expect(readError.reason).toBe("readFailed");
          expect(writeError.reason).toBe("writeFailed");
          expect(readError.message).toContain("must resolve");
          expect(writeError.message).toContain("must resolve");

          expect(yield* fileSystem.readFileString(victim)).toBe("non-Turtle victim remains unchanged");
          expect(yield* fileSystem.readLink(alias)).toBe(victim);
        })
      );
    });
  }

  {
    const acquireNativeFixture = Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fileSystem.makeTempDirectoryScoped({ prefix: "beep-ontology-root-" });
      const victim = path.join(root, "secret\\name.ttl");
      const alias = path.join(root, "alias.ttl");
      return { fileSystem, path, root, victim, alias };
    });
    class NativeFixture extends Context.Service<NativeFixture, Effect.Success<typeof acquireNativeFixture>>()(
      $I`NativeFixture7`
    ) {}
    const nativeFixtureLayer = Layer.effect(NativeFixture, acquireNativeFixture).pipe(
      Layer.provideMerge(NodeServices.layer)
    );
    it.layer(
      Layer.unwrap(
        Effect.map(NativeFixture, ({ root }) =>
          ontologyFileStoreLayerForConfiguration({ ONTOLOGY_WORKSPACE_ROOT: root })
        )
      ).pipe(Layer.provideMerge(nativeFixtureLayer)),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect(
        "rejects a POSIX literal-backslash canonical target without changing the victim",
        Effect.fnUntraced(function* () {
          const { fileSystem, path, victim, alias } = yield* NativeFixture;
          if (!Eq.equals(path.sep, "/")) return;
          yield* fileSystem.writeFileString(victim, "literal-backslash victim remains unchanged");
          yield* fileSystem.symlink(victim, alias);
          const fileStore = yield* OntologyFileStore;
          const candidate = yield* decodeOntologyFilePath("alias.ttl");
          const readError = yield* fileStore.read(ReadOntologyFileRequest.make({ path: candidate })).pipe(Effect.flip);
          const writeError = yield* fileStore
            .write(WriteOntologyFileRequest.make({ path: candidate, source: "attacker-controlled turtle" }))
            .pipe(Effect.flip);
          expect(readError.reason).toBe("readFailed");
          expect(writeError.reason).toBe("writeFailed");
          expect(readError.message).toContain("must resolve");
          expect(writeError.message).toContain("must resolve");

          expect(yield* fileSystem.readFileString(victim)).toBe("literal-backslash victim remains unchanged");
          expect(yield* fileSystem.readLink(alias)).toBe(victim);
        })
      );
    });
  }

  {
    const acquireNativeFixture = Effect.gen(function* () {
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
      return { fileSystem, path, configuredRoot, movedRoot, outside, outsideVictim };
    });
    class NativeFixture extends Context.Service<NativeFixture, Effect.Success<typeof acquireNativeFixture>>()(
      $I`NativeFixture8`
    ) {}
    const nativeFixtureLayer = Layer.effect(NativeFixture, acquireNativeFixture).pipe(
      Layer.provideMerge(NodeServices.layer)
    );
    it.layer(
      Layer.unwrap(
        Effect.map(NativeFixture, ({ configuredRoot }) =>
          ontologyFileStoreLayerForConfiguration({ ONTOLOGY_WORKSPACE_ROOT: configuredRoot })
        )
      ).pipe(Layer.provideMerge(nativeFixtureLayer)),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect(
        "keeps the startup-canonicalized workspace root pinned after its configured path is swapped",
        Effect.fnUntraced(function* () {
          const { fileSystem, configuredRoot, movedRoot, outside, outsideVictim } = yield* NativeFixture;
          const fileStore = yield* OntologyFileStore;
          const candidate = yield* decodeOntologyFilePath("victim.ttl");
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

          expect(yield* fileSystem.readFileString(outsideVictim)).toBe("outside remains unchanged");
          expect(yield* fileSystem.readLink(configuredRoot)).toBe(outside);
        })
      );
    });
  }
});

const assertSchemaRoundTrip = <Schema extends S.Codec<unknown>>(schema: Schema, value: Schema["Type"]): void => {
  const decode = S.decodeUnknownResult(schema);
  const encode = S.encodeResult(schema);
  const equivalent = S.toEquivalence(schema);
  const encoded = Result.getOrThrow(encode(value));
  const decoded = Result.getOrThrow(decode(encoded));
  pipe(equivalent(decoded, value), assertTrue);
};

describe("Session server schema round-trips", () => {
  it.prop(
    "round-trips file-store and codec request schemas with schema-derived arbitraries",
    [Arbitrary.schema(ReadOntologyFileRequest)],
    ([value]) => assertSchemaRoundTrip(ReadOntologyFileRequest, value),
    { arbitrary: fcRuns(10) }
  );
  it.prop(
    "round-trips file-store and codec request schemas with schema-derived arbitraries (WriteOntologyFileRequest)",
    [Arbitrary.schema(WriteOntologyFileRequest)],
    ([value]) => assertSchemaRoundTrip(WriteOntologyFileRequest, value),
    { arbitrary: fcRuns(10) }
  );
  it.prop(
    "round-trips file-store and codec request schemas with schema-derived arbitraries (ParseTurtleRequest)",
    [Arbitrary.schema(ParseTurtleRequest)],
    ([value]) => assertSchemaRoundTrip(ParseTurtleRequest, value),
    { arbitrary: fcRuns(10) }
  );
});
