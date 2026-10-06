import {
  PracticeKgBundleManifest,
  PracticeKgCounts,
  PracticeKgSchemaVersions,
  PracticeKgSourceRuns,
  PracticeKgToolkit,
} from "@beep/law-practice-server";
import { it } from "@beep/test-runner";
import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, FileSystem, Layer, Path, Result } from "effect";
import * as A from "effect/Array";
import * as R from "effect/Record";
import * as Runtime from "effect/Runtime";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";
import { SelfCheckFailure } from "../src/PracticeKgMcp.errors.ts";
import { loadPracticeKgBundleContext, PracticeKgHostError } from "../src/runtime/Host.ts";
import {
  PracticeKgSelfCheckRefusal,
  PracticeKgSelfCheckReport,
  printPracticeKgSelfCheck,
  runPracticeKgSelfCheck,
} from "../src/runtime/SelfCheck.ts";
import { makePracticeKgSmokeBundle } from "../src/smoke.ts";
import { PRACTICE_KG_EXTENSION_VERSION } from "../src/Version.ts";

const TestServices = Layer.mergeAll(BunFileSystem.layer, BunPath.layer);
const encodeManifest = S.encodeUnknownEffect(S.fromJsonString(PracticeKgBundleManifest));
const decodeReportLine = S.decodeUnknownEffect(S.fromJsonString(PracticeKgSelfCheckReport));
const decodeFailureLine = S.decodeUnknownEffect(S.fromJsonString(PracticeKgSelfCheckRefusal));
const isString = S.is(S.String);
// The test console is shared by every test in one `it.layer` block, so each
// test reads only the lines printed after the count it started with.
const printedSince = (start: number) =>
  TestConsole.logLines.pipe(Effect.map(A.drop(start)), Effect.map(A.filter(isString)));

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
  schemaVersion: PracticeKgSchemaVersions.make({ duckdb: "3", pglite: "3" }),
  sourceRuns: PracticeKgSourceRuns.make({
    base: "included",
    includedRuns: ["2026-10-working-files"],
    refresh202607: "excluded",
  }),
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
          expect(error.message).toContain("reads pglite 3 / duckdb 3");
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
          expect(error.message).toContain("reads pglite 3 / duckdb 3");
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

describe("@beep/practice-kg-mcp self-check", () => {
  it.layer(Layer.fresh(TestServices), { timeout: "2 minutes" })((it) => {
    it.effect(
      "prints one line naming the versions, both store counts and the toolkit size",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-practice-kg-self-check-" });
        const bundleDir = yield* makePracticeKgSmokeBundle(root);
        const context = yield* loadPracticeKgBundleContext(bundleDir);
        const start = A.length(yield* TestConsole.logLines);

        yield* printPracticeKgSelfCheck(runPracticeKgSelfCheck(bundleDir));

        const lines = yield* printedSince(start);
        expect(lines).toHaveLength(1);
        const line = lines[0] ?? "";
        expect(line).toMatch(
          /^\{"ok":true,"extensionVersion":"[^"]+","bundleVersion":"[^"]+","schemaVersion":\{"duckdb":"3","pglite":"3"\},"nodes":\d+,"matters":\d+,"tools":\d+\}$/
        );
        const report = yield* decodeReportLine(line);
        expect(report.extensionVersion).toBe(PRACTICE_KG_EXTENSION_VERSION);
        expect(report.bundleVersion).toBe(context.manifest.bundleVersion);
        expect(report.nodes).toBe(context.manifest.counts.nodes);
        expect(report.nodes).toBeGreaterThan(0);
        expect(report.matters).toBe(1);
        expect(report.tools).toBe(R.keys(PracticeKgToolkit.tools).length);
      })
    );

    it.effect(
      "refuses an old store format with one ok:false line and the typed host error",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const bundleDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-practice-kg-self-check-" });
        yield* fs.writeFileString(
          path.join(bundleDir, "bundle.manifest.json"),
          '{"builtAt":"2026-10-06T00:00:00.000Z","bundleVersion":"2026-10-06-01","corpusRootExpected":true,"corpusSnapshotAt":"2026-10-05T00:00:00.000Z","counts":{"documents":1,"edges":1,"emails":1,"nodes":1},"schemaVersion":{"duckdb":"2","pglite":"2"},"sourceRuns":{"base":"included","refresh202607":"excluded"}}'
        );
        const start = A.length(yield* TestConsole.logLines);

        const error = yield* Effect.flip(printPracticeKgSelfCheck(runPracticeKgSelfCheck(bundleDir)));

        const lines = yield* printedSince(start);
        expect(lines).toHaveLength(1);
        const failure = yield* decodeFailureLine(lines[0] ?? "");
        expect(error).toBeInstanceOf(SelfCheckFailure);
        expect(error[Runtime.errorReported]).toBe(false);
        expect(error.cause).toBeInstanceOf(PracticeKgHostError);
        expect(failure.ok).toBe(false);
        expect(failure.message).toBe(error.message);
        expect(failure.message).toContain("store format pglite 2 / duckdb 2");
        expect(yield* fs.exists(path.join(bundleDir, "kg.pglite"))).toBe(false);
      })
    );

    it.effect(
      "reports a bundle folder that lost a store instead of creating an empty one",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const bundleDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-practice-kg-self-check-" });
        yield* fs.writeFileString(path.join(bundleDir, "bundle.manifest.json"), yield* encodeManifest(manifest));

        const missing = yield* Effect.flip(runPracticeKgSelfCheck(bundleDir));
        yield* fs.makeDirectory(path.join(bundleDir, "kg.pglite"));
        yield* fs.writeFileString(path.join(bundleDir, "practice.duckdb"), "not a database");
        const unreadable = yield* Effect.flip(runPracticeKgSelfCheck(bundleDir));

        expect(missing.message).toBe(`Practice KG bundle store is missing at "${path.join(bundleDir, "kg.pglite")}".`);
        expect(unreadable).toBeInstanceOf(PracticeKgHostError);
        expect(unreadable.message).toBe(`Practice KG self-check could not read the bundle stores at "${bundleDir}".`);
      })
    );
  });
});
