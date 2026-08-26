// @vitest-environment node

import { Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import * as BunServices from "@effect/platform-bun/BunServices";
import { sha256 } from "@noble/hashes/sha2.js";
import { ConfigProvider, Crypto, Effect, Encoding, Equal, Exit, FileSystem, HashSet, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";
import { Command } from "effect/unstable/cli";
import { describe, expect, it } from "vitest";
import { CanaryCommand } from "@/canary/Command";
import { canonicalJson } from "@/corpus/Canonical";
import { CorpusManifest, CorpusPaperId, ManifestDrift } from "@/corpus/Manifest";
import { CorpusManifestBuilder } from "@/corpus/ManifestBuilder";
import {
  F1Catalog,
  F1CatalogLive,
  F1Diff,
  F1Drift,
  F1Fixture,
  F1FixtureId,
  F1Index,
  F1IndexDecodeFailed,
  FixtureMediaType,
  isF1FixtureId,
} from "@/fixtures/F1";
import { RuntimeLayer } from "@/runtime/Layer";
import { generateF1Pdfs } from "../scripts/generate-f1-pdfs";

const ManifestFromJsonString = S.fromJsonString(CorpusManifest);
const ManifestToJsonString = S.fromJsonString(CorpusManifest, { space: 2 });
const F1IndexFromJsonString = S.fromJsonString(F1Index);

const runtimeFromEnv = (env: Record<string, string>) =>
  RuntimeLayer.pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env }))));

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const digestRows = (rows: ReadonlyArray<unknown>): Sha256Hex =>
  Sha256Hex.make(Encoding.encodeHex(sha256(new TextEncoder().encode(canonicalJson(rows)))));

const rejectsManifest = (input: unknown) =>
  S.decodeUnknownEffect(CorpusManifest)(input).pipe(Effect.exit, Effect.map(Exit.isFailure));

describe("W1 corpus manifest", () => {
  it("canonicalizes recursively without depending on object key insertion order", () => {
    const left = canonicalJson({ z: [{ b: 2, a: 1 }], a: { d: 4, c: 3 } });
    const right = canonicalJson({ a: { c: 3, d: 4 }, z: [{ a: 1, b: 2 }] });

    expect(left).toBe('{"a":{"c":3,"d":4},"z":[{"a":1,"b":2}]}');
    expect(right).toBe(left);
    expect(CorpusPaperId.make("057e356e94f8")).toBe("057e356e94f8");
  });

  it("round-trips the committed schema and rejects unsorted, duplicate, and wrong-hash rows", () =>
    Effect.runPromise(
      provideScopedLayer(BunServices.layer)(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const source = yield* fs.readFileString("fixtures/w1.manifest.json");
          const manifest = yield* S.decodeEffect(ManifestFromJsonString)(source);
          const encoded = yield* S.encodeEffect(CorpusManifest)(manifest);
          const decoded = yield* S.decodeEffect(CorpusManifest)(encoded);
          const first = A.getUnsafe(encoded.rows, 0);
          const second = A.getUnsafe(encoded.rows, 1);
          const tail = A.drop(encoded.rows, 2);
          const unsortedRows = A.make(second, first, ...tail);
          const duplicateRows = A.make(first, first, ...tail);

          expect(decoded).toEqual(manifest);
          expect(A.length(encoded.rows)).toBe(25);
          expect(
            yield* rejectsManifest({
              ...encoded,
              rows: unsortedRows,
              corpusHash: digestRows(unsortedRows),
            })
          ).toBe(true);
          expect(
            yield* rejectsManifest({
              ...encoded,
              rows: duplicateRows,
              corpusHash: digestRows(duplicateRows),
            })
          ).toBe(true);
          expect(
            yield* rejectsManifest({
              ...encoded,
              selection: {
                ...encoded.selection,
                onDisk: 24,
              },
            })
          ).toBe(true);
          expect(
            yield* rejectsManifest({
              ...encoded,
              corpusHash: Sha256Hex.make(Str.repeat(64)("0")),
            })
          ).toBe(true);
        })
      )
    ));

  it("reports the mutated paper id through both the service and Command.runWith", () =>
    Effect.runPromise(
      provideScopedLayer(BunServices.layer)(
        Effect.scoped(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const seedSource = yield* fs.readFileString("fixtures/w1.manifest.json");
            const seed = yield* S.decodeEffect(ManifestFromJsonString)(seedSource);
            const corpusRoot = yield* fs.makeTempDirectoryScoped({ prefix: "semantica-w1-" });
            yield* Effect.forEach(
              seed.rows,
              (row) =>
                fs.writeFile(
                  path.join(corpusRoot, row.relativePath),
                  new TextEncoder().encode(`synthetic test paper ${row.id}`)
                ),
              { concurrency: 4 }
            );

            const runtime = runtimeFromEnv({ SEMANTICA_CORPUS_ROOT: corpusRoot });
            const runtimeContext = yield* Layer.build(runtime);
            const builder = yield* CorpusManifestBuilder.pipe(Effect.provide(runtimeContext));
            const built = yield* builder.build;
            const manifestPath = path.join(corpusRoot, "w1.manifest.json");
            const manifestJson = yield* S.encodeEffect(ManifestToJsonString)(built);
            yield* fs.writeFileString(manifestPath, `${manifestJson}\n`);

            const mutatedId = A.getUnsafe(built.rows, 0).id;
            yield* fs.writeFile(path.join(corpusRoot, `${mutatedId}.pdf`), new TextEncoder().encode("mutated"));

            const drift = yield* builder.check(manifestPath).pipe(Effect.flip);
            expect(drift).toBeInstanceOf(ManifestDrift);
            if (drift._tag !== "ManifestDrift") {
              return yield* Effect.die(new Error("Expected ManifestDrift from the direct manifest check."));
            }
            expect(A.map(drift.diffs, (diff) => diff.id)).toContain(mutatedId);

            const runCanary = Command.runWith(CanaryCommand, { renderErrors: false, version: "0.0.0" });
            const commandError = yield* runCanary(["manifest", "check", "--manifest", manifestPath]).pipe(
              Effect.provide(runtimeContext),
              Effect.flip
            );
            expect(commandError).toBeInstanceOf(ManifestDrift);
          })
        )
      )
    ));
});

describe("F1 fixtures", () => {
  it("generates only media types accepted by the source schema", () => {
    fc.assert(
      fc.property(S.toArbitrary(FixtureMediaType)(fc), (mediaType) => S.is(FixtureMediaType)(mediaType)),
      { numRuns: 12 }
    );
  });

  it("exposes schema-backed guards and typed catalog failures", () => {
    const id = F1FixtureId.make("html-article");
    const diff = F1Diff.cases["missing-file"].make({ id, relativePath: "documents/html-article.html" });
    const drift = F1Drift.make({
      message: "F1 fixture drift detected.",
      indexPath: "fixtures/f1/index.json",
      diffs: [diff],
    });
    const decodeFailure = F1IndexDecodeFailed.make({
      message: "The committed F1 index is invalid.",
      indexPath: "fixtures/f1/index.json",
    });

    expect(isF1FixtureId(id)).toBe(true);
    expect(drift._tag).toBe("F1Drift");
    expect(decodeFailure._tag).toBe("F1IndexDecodeFailed");
  });

  it("rejects paths outside the direct F1 documents root in fixtures and indexes", () =>
    Effect.runPromise(
      provideScopedLayer(BunServices.layer)(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const source = yield* fs.readFileString("fixtures/f1/index.json");
          const index = yield* S.decodeEffect(F1IndexFromJsonString)(source);
          const encoded = yield* S.encodeEffect(F1Index)(index);
          const first = A.getUnsafe(encoded.fixtures, 0);
          const tail = A.drop(encoded.fixtures, 1);
          const invalidRelativePaths = A.make(
            "/documents/md-structure.md",
            "documents/..",
            "documents/../md-structure.md",
            "documents/md\\structure.md",
            "documents/nested/md-structure.md"
          );

          yield* Effect.forEach(
            invalidRelativePaths,
            Effect.fnUntraced(function* (relativePath) {
              const invalidFixture = { ...first, relativePath };
              const fixtureRejected = yield* S.decodeEffect(F1Fixture)(invalidFixture).pipe(
                Effect.exit,
                Effect.map(Exit.isFailure)
              );
              const indexRejected = yield* S.decodeEffect(F1Index)({
                ...encoded,
                fixtures: A.make(invalidFixture, ...tail),
              }).pipe(Effect.exit, Effect.map(Exit.isFailure));

              expect(fixtureRejected).toBe(true);
              expect(indexRejected).toBe(true);
            })
          );
        })
      )
    ));

  it("preserves every fixture id when duplicate relative paths drift", () =>
    Effect.runPromise(
      provideScopedLayer(BunServices.layer)(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const source = yield* fs.readFileString("fixtures/f1/index.json");
          const index = yield* S.decodeEffect(F1IndexFromJsonString)(source);
          const encoded = yield* S.encodeEffect(F1Index)(index);
          const first = A.getUnsafe(encoded.fixtures, 0);
          const second = A.getUnsafe(encoded.fixtures, 1);
          const duplicatePathFixtures = A.make(
            first,
            { ...second, relativePath: first.relativePath },
            ...A.drop(encoded.fixtures, 2)
          );
          const duplicatePathIndex = yield* S.decodeEffect(F1Index)({
            ...encoded,
            fixtures: duplicatePathFixtures,
          });
          const duplicatePathSource = yield* S.encodeEffect(F1IndexFromJsonString)(duplicatePathIndex);
          const testFileSystem = FileSystem.makeNoop({
            readFileString: () => Effect.succeed(duplicatePathSource),
          });
          const catalogLayer = F1CatalogLive.pipe(
            Layer.provide(
              Layer.merge(Layer.succeed(FileSystem.FileSystem, testFileSystem), Layer.succeed(Path.Path, path))
            )
          );
          const drift = yield* provideScopedLayer(catalogLayer)(
            F1Catalog.pipe(
              Effect.flatMap((catalog) => catalog.load),
              Effect.flip
            )
          );

          expect(drift).toBeInstanceOf(F1Drift);
          if (drift._tag === "F1Drift") {
            const collidingDiffs = A.filter(drift.diffs, (diff) =>
              Str.Equivalence(diff.relativePath, first.relativePath)
            );
            const collidingIds = HashSet.fromIterable(A.map(collidingDiffs, (diff) => diff.id));

            expect(A.length(collidingDiffs)).toBe(2);
            expect(Equal.equals(collidingIds, HashSet.make(first.id, second.id))).toBe(true);
          }
        })
      )
    ));

  it("decodes the committed index and verifies every fixture hash and byte length", () =>
    Effect.runPromise(
      provideScopedLayer(runtimeFromEnv({}))(
        Effect.gen(function* () {
          const catalog = yield* F1Catalog;
          const index = yield* catalog.load;

          expect(index.schemaVersion).toBe("f1-index/v1");
          expect(A.length(index.fixtures)).toBe(9);
        })
      )
    ));

  it("reproduces every committed PDF byte-for-byte in two independent directories", () =>
    Effect.runPromise(
      provideScopedLayer(BunServices.layer)(
        Effect.scoped(
          Effect.gen(function* () {
            const crypto = yield* Crypto.Crypto;
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const firstDirectory = yield* fs.makeTempDirectoryScoped({ prefix: "semantica-f1-pdf-first-" });
            const secondDirectory = yield* fs.makeTempDirectoryScoped({ prefix: "semantica-f1-pdf-second-" });
            const names = A.make("pdf-two-column.pdf", "pdf-multipage.pdf", "pdf-truncated.pdf");
            const hashBytes = Effect.fnUntraced(function* (bytes: Uint8Array) {
              return yield* Sha256HexFromBytes.decodeEffect(bytes).pipe(
                Effect.provideService(Crypto.Crypto, crypto),
                Effect.orDie
              );
            });

            yield* generateF1Pdfs(firstDirectory);
            yield* generateF1Pdfs(secondDirectory);
            yield* Effect.forEach(
              names,
              Effect.fnUntraced(function* (name) {
                const committed = yield* fs.readFile(path.join("fixtures/f1/documents", name));
                const first = yield* fs.readFile(path.join(firstDirectory, name));
                const second = yield* fs.readFile(path.join(secondDirectory, name));
                const committedHash = yield* hashBytes(committed);

                expect(yield* hashBytes(first)).toBe(committedHash);
                expect(yield* hashBytes(second)).toBe(committedHash);
              })
            );
            const truncated = yield* fs.readFile(path.join("fixtures/f1/documents", "pdf-truncated.pdf"));
            expect(Str.includes("xref")(new TextDecoder().decode(truncated))).toBe(false);
          })
        )
      )
    ));
});
