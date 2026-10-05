import {
  PracticeKgBundleManifest,
  PracticeKgCounts,
  PracticeKgSchemaVersions,
  PracticeKgSourceRuns,
} from "@beep/law-practice-server";
import { it } from "@beep/test-runner";
import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, FileSystem, Layer, Path, Result } from "effect";
import * as S from "effect/Schema";
import { loadPracticeKgBundleContext, PracticeKgHostError } from "../src/runtime/Host.ts";

const TestServices = Layer.mergeAll(BunFileSystem.layer, BunPath.layer);
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
  schemaVersion: PracticeKgSchemaVersions.make({ duckdb: "1", pglite: "1" }),
  sourceRuns: PracticeKgSourceRuns.make({ base: "included", refresh202607: "excluded" }),
});

for (const [adapter, services] of [
  ["native", TestServices],
  ["memory", Layer.mergeAll(MemoryFileSystem.layer, BunPath.layer)],
] as const) {
  describe(`@beep/practice-kg-mcp runtime host (${adapter})`, () => {
    it.layer(Layer.fresh(services), { timeout: "10 seconds" })((it) => {
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
        })
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
        })
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

          assertTrue(Result.isFailure(missing));
          assertTrue(Result.isFailure(invalid));
          if (Result.isFailure(missing) && Result.isFailure(invalid)) {
            expect(missing.failure).toBeInstanceOf(PracticeKgHostError);
            expect(missing.failure.message).toContain("Failed reading practice KG bundle manifest");
            expect(invalid.failure).toBeInstanceOf(PracticeKgHostError);
            expect(invalid.failure.message).toContain("bundle manifest");
          }
        })
      );
      it.effect(
        "rejects parseable JSON that does not satisfy the production manifest schema",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const bundleDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-practice-kg-host-" });
          yield* fs.writeFileString(path.join(bundleDir, "bundle.manifest.json"), "{}");
          const invalid = yield* Effect.result(loadPracticeKgBundleContext(bundleDir));
          assertTrue(Result.isFailure(invalid));
          expect(invalid.failure).toBeInstanceOf(PracticeKgHostError);
          expect(invalid.failure.message).toBe(
            `Practice KG bundle manifest at "${path.join(bundleDir, "bundle.manifest.json")}" is invalid.`
          );
        })
      );
    });
  });
}
