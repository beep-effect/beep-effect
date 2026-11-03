import {
  PracticeKgBundleManifest,
  PracticeKgCounts,
  PracticeKgSchemaVersions,
  PracticeKgSourceRuns,
} from "@beep/law-practice-server";
import {
  loadPracticeKgBundleContext,
  makePracticeKgSelfCheckRefusal,
  PracticeKgHostError,
  runPracticeKgSelfCheck,
} from "@beep/law-practice-server/PracticeKgHost";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { it } from "@beep/test-runner";
import * as BunPath from "@effect/platform-bun/BunPath";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";

const TestServices = Layer.mergeAll(MemoryFileSystem.layer, BunPath.layer);
const encodeManifest = S.encodeUnknownEffect(S.fromJsonString(PracticeKgBundleManifest));

const manifest = PracticeKgBundleManifest.make({
  builtAt: "2026-08-13T00:00:00.000Z",
  bundleVersion: "2026.08.1",
  corpusRootExpected: true,
  corpusSnapshotAt: "2026-08-12T00:00:00.000Z",
  counts: PracticeKgCounts.make({
    documents: S.Natural.make(2),
    edges: S.Natural.make(3),
    emails: S.Natural.make(1),
    nodes: S.Natural.make(4),
  }),
  schemaVersion: PracticeKgSchemaVersions.make({ duckdb: "4", pglite: "4" }),
  sourceRuns: PracticeKgSourceRuns.make({
    base: "included",
    includedRuns: ["2026-10-working-files"],
    refresh202607: "excluded",
  }),
});

describe("@beep/law-practice-server PracticeKgHost bundle loading", () => {
  it.layer(Layer.fresh(TestServices), { timeout: "10 seconds" })((it) => {
    it.effect(
      "loads a portable bundle manifest and preserves an optional corpus root",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const bundleDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-practice-kg-host-" });
        const corpusRoot = path.join(bundleDir, "corpus");
        const argument = path.join(bundleDir, "bundle.manifest.json");
        const encodedManifest = yield* encodeManifest(manifest);
        yield* fs.writeFileString(argument, encodedManifest);

        const context = yield* loadPracticeKgBundleContext(bundleDir, corpusRoot);

        expect(context.bundleDir).toBe(bundleDir);
        expect(context.manifest).toEqual(manifest);
        expect(context.corpusRoot).toBe(corpusRoot);
      })
    );

    it.effect(
      "omits the corpus root when the caller does not provide one",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const bundleDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-practice-kg-host-" });
        const argument1 = path.join(bundleDir, "bundle.manifest.json");
        const encodedManifest1 = yield* encodeManifest(manifest);
        yield* fs.writeFileString(argument1, encodedManifest1);

        const context = yield* loadPracticeKgBundleContext(bundleDir);

        expect(context.corpusRoot).toBeUndefined();
      })
    );

    it.effect(
      "refuses a bundle built for an older graph store format by naming both formats",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const bundleDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-practice-kg-host-" });
        yield* fs.writeFileString(
          path.join(bundleDir, "bundle.manifest.json"),
          '{"builtAt":"2026-07-03T19:02:49.365Z","bundleVersion":"2026-07-27-01","corpusRootExpected":true,"counts":{"documents":1,"edges":1,"emails":1,"nodes":1},"schemaVersion":{"duckdb":"1","pglite":"1"},"sourceRuns":{"base":"included","refresh202607":"excluded"}}'
        );

        const error = yield* Effect.flip(loadPracticeKgBundleContext(bundleDir));

        expect(error.message).toContain("store format pglite 1 / duckdb 1");
        expect(error.message).toContain("reads pglite 4 / duckdb 4");
      })
    );

    it.effect(
      "refuses the previous store format, which has no client names, by naming both formats",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const bundleDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-practice-kg-host-" });
        yield* fs.writeFileString(
          path.join(bundleDir, "bundle.manifest.json"),
          '{"builtAt":"2026-10-06T00:00:00.000Z","bundleVersion":"2026-10-06-01","corpusRootExpected":true,"corpusSnapshotAt":"2026-10-05T00:00:00.000Z","counts":{"documents":1,"edges":1,"emails":1,"nodes":1},"schemaVersion":{"duckdb":"2","pglite":"2"},"sourceRuns":{"base":"included","refresh202607":"excluded"}}'
        );

        const error = yield* Effect.flip(loadPracticeKgBundleContext(bundleDir));

        expect(error.message).toContain("store format pglite 2 / duckdb 2");
        expect(error.message).toContain("reads pglite 4 / duckdb 4");
      })
    );

    it.effect(
      "refuses store format 3, which has no correspondent tables, by naming both formats",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const bundleDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-practice-kg-host-" });
        yield* fs.writeFileString(
          path.join(bundleDir, "bundle.manifest.json"),
          '{"builtAt":"2026-10-06T00:00:00.000Z","bundleVersion":"2026-10-06-03","corpusRootExpected":true,"corpusSnapshotAt":"2026-10-05T00:00:00.000Z","counts":{"documents":1,"edges":1,"emails":1,"nodes":1},"schemaVersion":{"duckdb":"3","pglite":"3"},"sourceRuns":{"base":"included","includedRuns":[],"refresh202607":"excluded"}}'
        );

        const error = yield* Effect.flip(loadPracticeKgBundleContext(bundleDir));

        expect(error.message).toContain("store format pglite 3 / duckdb 3");
        expect(error.message).toContain("reads pglite 4 / duckdb 4");
      })
    );

    it.effect(
      "maps missing and invalid manifests to sanitized typed host errors",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const bundleDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-practice-kg-host-" });
        const missing = yield* Effect.flip(loadPracticeKgBundleContext(bundleDir));

        yield* fs.writeFileString(path.join(bundleDir, "bundle.manifest.json"), "not-json");
        const invalid = yield* Effect.flip(loadPracticeKgBundleContext(bundleDir));

        expect(missing).toBeInstanceOf(PracticeKgHostError);
        expect(missing.message).toContain("Failed reading practice KG bundle manifest");
        expect(invalid).toBeInstanceOf(PracticeKgHostError);
        expect(invalid.message).toContain("bundle manifest");
      })
    );
    it.effect(
      "rejects parseable JSON that does not satisfy the production manifest schema",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const bundleDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-practice-kg-host-" });
        yield* fs.writeFileString(path.join(bundleDir, "bundle.manifest.json"), "{}");
        const invalid = yield* Effect.flip(loadPracticeKgBundleContext(bundleDir));
        expect(invalid).toBeInstanceOf(PracticeKgHostError);
        expect(invalid.message).toBe(
          `Practice KG bundle manifest at "${path.join(bundleDir, "bundle.manifest.json")}" is invalid.`
        );
      })
    );
  });
});

describe("@beep/law-practice-server PracticeKgHost self-check refusals", () => {
  it.layer(Layer.fresh(TestServices), { timeout: "30 seconds" })((it) => {
    it.effect(
      "refuses a bundle folder that lost its graph store without creating one",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const bundleDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-practice-kg-host-self-check-" });
        const argument2 = path.join(bundleDir, "bundle.manifest.json");
        const encodedManifest2 = yield* encodeManifest(manifest);
        yield* fs.writeFileString(argument2, encodedManifest2);

        const missing = yield* Effect.flip(runPracticeKgSelfCheck({ extensionVersion: "0.4.0", bundleDir }));

        expect(missing).toBeInstanceOf(PracticeKgHostError);
        expect(missing.message).toBe(
          `Practice KG graph store (kg.pglite) at "${bundleDir}" is missing or not an initialised store; install the bundle that matches this server.`
        );
        const exists1 = yield* fs.exists(path.join(bundleDir, "kg.pglite"));
        expect(exists1).toBe(false);
      })
    );

    it.effect(
      "refuses a file in place of the graph directory without opening either store",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const bundleDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-practice-kg-host-self-check-" });
        const argument3 = path.join(bundleDir, "bundle.manifest.json");
        const encodedManifest3 = yield* encodeManifest(manifest);
        yield* fs.writeFileString(argument3, encodedManifest3);
        yield* fs.writeFileString(path.join(bundleDir, "kg.pglite"), "not a directory");
        const error = yield* Effect.flip(runPracticeKgSelfCheck({ extensionVersion: "0.4.0", bundleDir }));
        expect(error.message).toContain("graph store (kg.pglite)");
        expect(error.message).toContain("missing or not an initialised store");
        const readFileString2 = yield* fs.readFileString(path.join(bundleDir, "kg.pglite"));
        expect(readFileString2).toBe("not a directory");
        const exists3 = yield* fs.exists(path.join(bundleDir, "practice.duckdb"));
        expect(exists3).toBe(false);
      })
    );

    it.effect(
      "distinguishes an unreadable graph store from a bundle that needs replacement",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const bundleDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-practice-kg-host-self-check-" });
        const graphStore = path.join(bundleDir, "kg.pglite");
        const argument4 = path.join(bundleDir, "bundle.manifest.json");
        const encodedManifest4 = yield* encodeManifest(manifest);
        yield* fs.writeFileString(argument4, encodedManifest4);
        yield* fs.makeDirectory(graphStore);
        yield* fs.writeFileString(path.join(graphStore, "PG_VERSION"), "17\n");
        const denied = PlatformError.systemError({
          _tag: "PermissionDenied",
          module: "PracticeKgHostTest",
          method: "stat",
          pathOrDescriptor: graphStore,
        });
        const unreadableStore = FileSystem.FileSystem.of({
          ...fs,
          stat: Effect.fn("PracticeKgHostTest.stat")((file) =>
            file === graphStore ? Effect.fail(denied) : fs.stat(file)
          ),
        });
        const error = yield* runPracticeKgSelfCheck({ extensionVersion: "0.4.0", bundleDir }).pipe(
          Effect.provideService(FileSystem.FileSystem, unreadableStore),
          Effect.flip
        );
        expect(error).toBeInstanceOf(PracticeKgHostError);
        expect(error.cause).toBe(denied);
        expect(error.message).toBe(
          `Practice KG graph store (kg.pglite) at "${bundleDir}" could not be opened; check that no other process holds the bundle (close Claude Desktop) and that the store is readable and not corrupt.`
        );
        expect(error.message).not.toContain("install the bundle");
        const readFileString4 = yield* fs.readFileString(path.join(graphStore, "PG_VERSION"));
        expect(readFileString4).toBe("17\n");
        const exists5 = yield* fs.exists(path.join(bundleDir, "practice.duckdb"));
        expect(exists5).toBe(false);
      })
    );

    it.effect(
      "refuses a zero-byte matter store once the graph store carries its marker",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const bundleDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-practice-kg-host-self-check-" });
        const argument5 = path.join(bundleDir, "bundle.manifest.json");
        const encodedManifest5 = yield* encodeManifest(manifest);
        yield* fs.writeFileString(argument5, encodedManifest5);
        yield* fs.makeDirectory(path.join(bundleDir, "kg.pglite"));
        yield* fs.writeFileString(path.join(bundleDir, "kg.pglite", "PG_VERSION"), "17\n");
        yield* fs.writeFileString(path.join(bundleDir, "practice.duckdb"), "");

        const zeroMatter = yield* Effect.flip(runPracticeKgSelfCheck({ extensionVersion: "0.4.0", bundleDir }));

        expect(zeroMatter.message).toBe(
          `Practice KG matter store (practice.duckdb) at "${bundleDir}" is missing or not an initialised store; install the bundle that matches this server.`
        );
      })
    );
  });
});

describe("@beep/law-practice-server PracticeKgHost refusal lines", () => {
  it("joins the cause chain's messages on one line without stack traces", () => {
    const refusal = makePracticeKgSelfCheckRefusal(
      PracticeKgHostError.make({
        message: "The matter store could not be opened.",
        cause: {
          message: "IO Error:\n  Could not set lock on file",
          cause: { cause: O.some({ message: "lock held" }) },
        },
      })
    );

    assertFalse(refusal.ok);
    expect(refusal.message).toBe("The matter store could not be opened.");
    expect(refusal.cause).toBe("IO Error: Could not set lock on file — lock held");
  });

  it("omits the cause when the chain carries no message", () => {
    const refusal = makePracticeKgSelfCheckRefusal(
      PracticeKgHostError.make({ message: "Bundle directory is required." })
    );

    expect(refusal.cause).toBeUndefined();
  });

  it("ignores PracticeKgHostError cause and compares diagnostic fields", () => {
    const same = S.toEquivalence(PracticeKgHostError);
    const first = PracticeKgHostError.make({ cause: { diagnostic: "first" }, message: "Host startup failed." });
    const second = PracticeKgHostError.make({ cause: { diagnostic: "second" }, message: "Host startup failed." });
    const different = PracticeKgHostError.make({ cause: { diagnostic: "first" }, message: "Host startup timed out." });

    assertTrue(same(first, second));
    assertFalse(same(first, different));
  });
});
