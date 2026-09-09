import {
  CHECK_CENSUS_OVERLAY_FILE_NAME,
  CheckCensusOptions,
  renderCheckCensusLines,
  runCheckCensus,
} from "@beep/repo-cli/test/Quality";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { encodeJsonString } from "@beep/schema/Json";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import * as A from "effect/Array";
import * as Str from "effect/String";

const writeFixtureFile = Effect.fn("CheckCensusTest.writeFixtureFile")(function* (
  root: string,
  relativePath: string,
  content: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.join(root, relativePath);

  yield* fs.makeDirectory(path.dirname(absolutePath), { recursive: true });
  yield* fs.writeFileString(absolutePath, content);
});

const writeFixtureJson = Effect.fn("CheckCensusTest.writeFixtureJson")(function* (
  root: string,
  relativePath: string,
  document: unknown
) {
  yield* writeFixtureFile(root, relativePath, `${yield* encodeJsonString(document)}\n`);
});

const baseCompilerOptions = {
  target: "ES2022",
  module: "ESNext",
  moduleResolution: "Bundler",
  strict: true,
  skipLibCheck: true,
  types: [],
} as const;

// Two workspace packages: `upstream` is a composite library with a built
// `dist/`, `consumer` imports it by relative source path. The committed check
// overlay drops `references`, so the consumer program reads `upstream/src`;
// the reference-keeping overlay keeps them, so the same import resolves to
// `upstream/dist/index.d.ts`. That is the D3 evidence the census exists for.
const writeFixtureRepo = Effect.fn("CheckCensusTest.writeFixtureRepo")(function* (root: string) {
  yield* writeFixtureJson(root, "package.json", {
    name: "check-census-fixture",
    private: true,
    workspaces: ["packages/*"],
  });
  yield* writeFixtureJson(root, "packages/upstream/package.json", { name: "@fixture/upstream", private: true });
  yield* writeFixtureJson(root, "packages/upstream/tsconfig.json", {
    compilerOptions: { ...baseCompilerOptions, composite: true, declaration: true, outDir: "dist", rootDir: "src" },
    include: ["src"],
  });
  yield* writeFixtureFile(root, "packages/upstream/src/index.ts", "export const upstreamValue: number = 1;\n");

  yield* writeFixtureJson(root, "packages/consumer/package.json", { name: "@fixture/consumer", private: true });
  yield* writeFixtureJson(root, "packages/consumer/tsconfig.json", {
    compilerOptions: { ...baseCompilerOptions, composite: true, declaration: true, outDir: "dist" },
    include: ["src"],
    references: [{ path: "../upstream/tsconfig.json" }],
  });
  yield* writeFixtureJson(root, "packages/consumer/tsconfig.check.json", {
    extends: "./tsconfig.json",
    references: [],
    compilerOptions: { composite: false, declaration: false, incremental: false, noEmit: true, rootDir: "../.." },
  });
  yield* writeFixtureFile(
    root,
    "packages/consumer/src/index.ts",
    'import { upstreamValue } from "../../upstream/src/index";\n\nexport const consumerValue: number = upstreamValue + 1;\n'
  );
});

describe("check census", () => {
  it.effect(
    "measures the committed overlay against a reference-keeping overlay and removes the temporary config",
    Effect.fnUntraced(
      function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repoRoot = yield* findRepoRoot();
        const tsgoPath = path.join(repoRoot, "node_modules", ".bin", "tsgo");
        // Under the repo's node_modules/.tmp (the tsgo-smoke precedent): the tsgo
        // shim discovers the installed compiler from the spawn cwd, so a fixture
        // outside the checkout fails discovery under Node.
        const tempRoot = path.join(repoRoot, "node_modules", ".tmp");
        yield* fs.makeDirectory(tempRoot, { recursive: true });
        const root = yield* fs.makeTempDirectoryScoped({ directory: tempRoot, prefix: "check-census-" });
        const consumerDir = path.join(root, "packages", "consumer");

        yield* writeFixtureRepo(root);
        // Build the upstream declaration output the reference-keeping overlay resolves through.
        const build = Bun.spawnSync([tsgoPath, "-p", path.join(root, "packages", "upstream", "tsconfig.json")], {
          cwd: root,
          stderr: "pipe",
          stdout: "pipe",
        });
        expect(build.exitCode, `${build.stdout.toString()}\n${build.stderr.toString()}`).toBe(0);

        const report = yield* runCheckCensus(
          CheckCensusOptions.make({
            repoRoot: root,
            tsgoPath,
            packages: [{ name: "@fixture/consumer", dir: consumerDir }],
            concurrency: 1,
          })
        );

        expect(report.rows).toHaveLength(1);
        const row = report.rows[0];
        expect(row?.package).toBe("@fixture/consumer");
        // Committed overlay: no references, so the upstream import is its source file.
        expect(row?.overlay.upstreamSrc).toBe(1);
        expect(row?.overlay.upstreamDist).toBe(0);
        expect(row?.overlay.diagnostics).toBe(0);
        // Reference-keeping overlay: the same import resolves to upstream/dist/index.d.ts.
        expect(row?.referenceKeeping.upstreamSrc).toBe(0);
        expect(row?.referenceKeeping.upstreamDist).toBe(1);
        expect(row?.referenceKeeping.diagnostics).toBe(0);
        expect(row?.delta.upstreamSrc).toBe(-1);
        expect(row?.delta.upstreamDist).toBe(1);
        expect(row?.delta.diagnostics).toBe(0);
        // Both programs share the consumer's own source with the build program.
        expect(row?.buildOverlapFiles).toBeGreaterThanOrEqual(1);
        expect(row?.overlay.files).toBeGreaterThan(row?.overlay.upstreamSrc ?? 0);
        expect(row?.overlay.wallMs).toBeGreaterThanOrEqual(0);
        expect(yield* fs.exists(path.join(consumerDir, CHECK_CENSUS_OVERLAY_FILE_NAME))).toBe(false);

        const lines = renderCheckCensusLines(report);
        expect(lines).toHaveLength(3);
        expect(A.some(lines, Str.includes("@fixture/consumer"))).toBe(true);
      },
      Effect.scoped,
      provideScopedLayer(NodeServices.layer)
    )
  );
});
