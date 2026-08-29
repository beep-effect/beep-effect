import {
  PracticeKgBundleManifest,
  PracticeKgCounts,
  PracticeKgSchemaVersions,
  PracticeKgSourceRuns,
} from "@beep/law-practice-server";
import { NonNegativeInt } from "@beep/schema";
import { provideScopedLayer } from "@beep/test-utils";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path, Result } from "effect";
import * as S from "effect/Schema";
import { loadPracticeKgBundleContext, PracticeKgHostError } from "../src/runtime/Host.ts";

const TestServices = Layer.mergeAll(BunFileSystem.layer, BunPath.layer);
const encodeManifest = S.encodeUnknownEffect(S.fromJsonString(PracticeKgBundleManifest));

const manifest = PracticeKgBundleManifest.make({
  builtAt: "2026-08-13T00:00:00.000Z",
  bundleVersion: "2026.08.1",
  corpusRootExpected: true,
  counts: PracticeKgCounts.make({
    documents: NonNegativeInt.make(2),
    edges: NonNegativeInt.make(3),
    emails: NonNegativeInt.make(1),
    nodes: NonNegativeInt.make(4),
  }),
  schemaVersion: PracticeKgSchemaVersions.make({ duckdb: "1", pglite: "1" }),
  sourceRuns: PracticeKgSourceRuns.make({ base: "included", refresh202607: "excluded" }),
});

describe("@beep/practice-kg-mcp runtime host", () => {
  it.effect(
    "loads a portable bundle manifest and preserves an optional corpus root",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const bundleDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-practice-kg-host-" });
      const corpusRoot = path.join(bundleDir, "corpus");
      yield* fs.writeFileString(path.join(bundleDir, "bundle.manifest.json"), yield* encodeManifest(manifest));

      const context = yield* loadPracticeKgBundleContext(bundleDir, corpusRoot);

      expect(context.bundleDir).toBe(bundleDir);
      expect(context.manifest).toEqual(manifest);
      expect(context.corpusRoot).toBe(corpusRoot);
    }, provideScopedLayer(TestServices))
  );

  it.effect(
    "omits the corpus root when the caller does not provide one",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const bundleDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-practice-kg-host-" });
      yield* fs.writeFileString(path.join(bundleDir, "bundle.manifest.json"), yield* encodeManifest(manifest));

      const context = yield* loadPracticeKgBundleContext(bundleDir);

      expect(context.corpusRoot).toBeUndefined();
    }, provideScopedLayer(TestServices))
  );

  it.effect(
    "maps missing and invalid manifests to sanitized typed host errors",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const bundleDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-practice-kg-host-" });
      const missing = yield* Effect.result(loadPracticeKgBundleContext(bundleDir));

      yield* fs.writeFileString(path.join(bundleDir, "bundle.manifest.json"), "not-json");
      const invalid = yield* Effect.result(loadPracticeKgBundleContext(bundleDir));

      expect(Result.isFailure(missing)).toBe(true);
      expect(Result.isFailure(invalid)).toBe(true);
      if (Result.isFailure(missing) && Result.isFailure(invalid)) {
        expect(missing.failure).toBeInstanceOf(PracticeKgHostError);
        expect(missing.failure.message).toContain("Failed reading practice KG bundle manifest");
        expect(invalid.failure).toBeInstanceOf(PracticeKgHostError);
        expect(invalid.failure.message).toContain("bundle manifest");
      }
    }, provideScopedLayer(TestServices))
  );
});
