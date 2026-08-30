import { Sha256HexFromBytes } from "@beep/schema/Sha256";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { BunServices } from "@effect/platform-bun";
import { assert, it } from "@effect/vitest";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { ReflectionKind } from "typedoc";
import { loadApiReferenceDataset } from "../../beep-docs/api-reference/ApiReferenceDataset.ts";
import { loadReflection, ReflectionOptions } from "../../beep-docs/api-reference/Reflection.ts";
import {
  ApiReferenceDatasetManifest,
  ApiReferencePackageManifest,
  TypeDocProjectReflection,
  TypeDocProjectReflectionFromJsonString,
} from "../../beep-docs/domain/ApiReference.ts";

const utf8 = new TextEncoder();

const encodeDatasetManifest = S.encodeEffect(S.fromJsonString(ApiReferenceDatasetManifest));
const encodePackageManifest = S.encodeEffect(S.fromJsonString(ApiReferencePackageManifest));
const encodeReflection = S.encodeEffect(TypeDocProjectReflectionFromJsonString);
const decodePackageManifest = S.decodeUnknownEffect(ApiReferencePackageManifest);
const decodeDatasetManifest = S.decodeUnknownEffect(ApiReferenceDatasetManifest);

const reflectionFor = (name: string) =>
  S.decodeUnknownSync(TypeDocProjectReflection)({
    schemaVersion: "2.0",
    variant: "project",
    id: 1,
    name,
    kind: ReflectionKind.Project,
    flags: {},
  });

class Fixture extends S.Class<Fixture>("Fixture")({
  tamperIndexDigest: S.Boolean.pipe(SchemaUtils.withConstantDefault<boolean>(false)),
  httpClientBarrel: S.String.pipe(SchemaUtils.withConstantDefault<string>(".")),
  packageManifestPath: S.String.pipe(SchemaUtils.withConstantDefault<string>("platform/manifest.json")),
  collidingPackage: S.Boolean.pipe(SchemaUtils.withConstantDefault<boolean>(false)),
}) {}

const writeDataset = Effect.fnUntraced(function* (fixture: Fixture) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const base = yield* fs.makeTempDirectoryScoped();
  const packageDirectory = path.join(base, "v4", "platform");
  yield* fs.makeDirectory(packageDirectory, { recursive: true });

  const indexJson = yield* encodeReflection(reflectionFor("@effect/platform"));
  const httpClientJson = yield* encodeReflection(reflectionFor("@effect/platform/HttpClient"));
  const indexDigest = yield* Sha256HexFromBytes.decodeEffect(utf8.encode(indexJson));
  const httpClientDigest = yield* Sha256HexFromBytes.decodeEffect(utf8.encode(httpClientJson));
  yield* fs.writeFileString(path.join(packageDirectory, "index.json"), indexJson);
  yield* fs.writeFileString(path.join(packageDirectory, "HttpClient.json"), httpClientJson);

  const packageManifest = yield* decodePackageManifest({
    schemaVersion: 3,
    channel: "v4",
    name: "@effect/platform",
    version: "1.0.0",
    revision: "rev-1",
    description: "Platform services.",
    npmUrl: "https://www.npmjs.com/package/@effect/platform",
    sourceUrl: "https://github.com/Effect-TS/effect",
    barrels: [{ export: ".", source: "src/index.ts" }],
    modules: [
      {
        export: ".",
        source: "src/index.ts",
        json: "index.json",
        sha256: fixture.tamperIndexDigest ? "0".repeat(64) : indexDigest,
      },
      {
        export: "./HttpClient",
        source: "src/HttpClient.ts",
        json: "HttpClient.json",
        sha256: httpClientDigest,
        barrel: fixture.httpClientBarrel,
      },
    ],
  });
  yield* fs.writeFileString(path.join(packageDirectory, "manifest.json"), yield* encodePackageManifest(packageManifest));

  const collidingDirectory = path.join(base, "v4", "platform-unscoped");
  yield* fs.makeDirectory(collidingDirectory, { recursive: true });
  const collidingManifest = yield* decodePackageManifest({
    schemaVersion: 3,
    channel: "v4",
    name: "platform",
    version: "0.1.0",
    revision: "rev-1",
    description: "An unscoped package whose slug collides with @effect/platform.",
    npmUrl: "https://www.npmjs.com/package/platform",
    sourceUrl: "https://github.com/example/platform",
    barrels: [],
    modules: [],
  });
  yield* fs.writeFileString(
    path.join(collidingDirectory, "manifest.json"),
    yield* encodePackageManifest(collidingManifest)
  );

  const datasetManifest = yield* decodeDatasetManifest({
    datasetSchemaVersion: 1,
    channel: "v4",
    typedocVersion: "0.28.20",
    typedocSchemaVersion: "2.0",
    revision: "rev-1",
    packages: [
      { name: "@effect/platform", version: "1.0.0", manifest: fixture.packageManifestPath },
      ...(fixture.collidingPackage
        ? [{ name: "platform", version: "0.1.0", manifest: "platform-unscoped/manifest.json" }]
        : []),
    ],
  });
  yield* fs.writeFileString(path.join(base, "v4", "manifest.json"), yield* encodeDatasetManifest(datasetManifest));
  yield* fs.writeFileString(path.join(base, "not-a-channel.txt"), "");
  return base;
});

it.layer(BunServices.layer)("ApiReferenceDataset + Reflection", (it) => {
  it.effect(
    "loads every module entry and verifies reflections end to end",
    Effect.fnUntraced(function* () {
      const base = yield* writeDataset(Fixture.make({}));
      const entries = yield* loadApiReferenceDataset(base);
      assert.deepEqual(
        A.map(entries, (entry) => entry.id),
        ["v4/platform/index", "v4/platform/HttpClient"]
      );
      const httpClient = O.getOrThrow(A.get(entries, 1));
      assert.equal(httpClient.data.reflectionPath, "v4/platform/HttpClient.json");
      assert.deepEqual(httpClient.data.barrelPath, O.some("index"));
      assert.equal(httpClient.data.packageModuleCount, 2);
      assert.equal(httpClient.data.packageNpmUrl.hostname, "www.npmjs.com");

      const reflection = yield* loadReflection(httpClient.data, ReflectionOptions.make({ baseDirectory: base }));
      assert.equal(reflection.name, "@effect/platform/HttpClient");
    }, Effect.scoped)
  );

  it.effect(
    "fails with ReflectionDigestMismatch when the recorded digest is wrong",
    Effect.fnUntraced(function* () {
      const base = yield* writeDataset(Fixture.make({ tamperIndexDigest: true }));
      const entries = yield* loadApiReferenceDataset(base);
      const index = O.getOrThrow(A.head(entries));
      const failure = yield* loadReflection(index.data, ReflectionOptions.make({ baseDirectory: base })).pipe(
        Effect.flip
      );
      assert.equal(failure._tag, "ReflectionDigestMismatch");
    }, Effect.scoped)
  );

  it.effect(
    "fails with PathEscapesDataset when a manifest path leaves the channel directory",
    Effect.fnUntraced(function* () {
      const base = yield* writeDataset(Fixture.make({ packageManifestPath: "../outside/manifest.json" }));
      const failure = yield* loadApiReferenceDataset(base).pipe(Effect.flip);
      assert.equal(failure._tag, "PathEscapesDataset");
    }, Effect.scoped)
  );

  it.effect(
    "fails with UnknownBarrel when a module names an undeclared barrel",
    Effect.fnUntraced(function* () {
      const base = yield* writeDataset(Fixture.make({ httpClientBarrel: "./missing" }));
      const failure = yield* loadApiReferenceDataset(base).pipe(Effect.flip);
      assert.equal(failure._tag, "UnknownBarrel");
    }, Effect.scoped)
  );

  it.effect(
    "fails with PackageSlugCollision when two package names share a slug",
    Effect.fnUntraced(function* () {
      const base = yield* writeDataset(Fixture.make({ collidingPackage: true }));
      const failure = yield* loadApiReferenceDataset(base).pipe(Effect.flip);
      assert.equal(failure._tag, "PackageSlugCollision");
    }, Effect.scoped)
  );

  it.effect(
    "returns no entries for a missing dataset directory",
    Effect.fnUntraced(function* () {
      const path = yield* Path.Path;
      const entries = yield* loadApiReferenceDataset(path.join("/", "definitely", "missing", "api-reference"));
      assert.deepEqual(entries, []);
    })
  );
});
