import {
  COVERAGE_GENERATED_STANDARDS_OWNER_ROWS,
  CoverageReaderSource,
  CoverageScopeOwner,
  coverageReaderOwners,
  coverageReaderStringTokens,
  coverageSourceReadsPath,
  planCoverageAffectedScope,
  workspaceCoverageScopeOwners,
} from "@beep/repo-cli/test/Quality";
import { FsUtils, FsUtilsLive } from "@beep/repo-utils";
import { it } from "@beep/test-runner";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Order from "effect/Order";
import * as Path from "effect/Path";

// TURB-01 slice 1 (goals/hosted-setup-tax): generated standards files select
// their scanned readers instead of the full Test Unit matrix.

const repoCli = CoverageScopeOwner.make({
  packageName: "@beep/repo-cli",
  packagePath: "packages/tooling/tool/cli",
  hasCoverage: true,
});
const repoCliKit = CoverageScopeOwner.make({
  packageName: "@beep/repo-cli-kit",
  packagePath: "packages/tooling/library/repo-cli-kit",
  hasCoverage: true,
});
const unrelated = CoverageScopeOwner.make({
  packageName: "@beep/unrelated",
  packagePath: "packages/unrelated",
  hasCoverage: true,
});
const owners = [repoCli, repoCliKit, unrelated];

// One concrete changed file per row; the catalog row is a directory glob.
const SAMPLE_CHANGED_FILES = [
  "standards/instrumentation-catalog/@beep/schema.generated.jsonc",
  "standards/jsdoc-documentation.inventory.jsonc",
  "standards/schema-first.inventory.jsonc",
  "standards/policy-tools.fingerprint.json",
  "standards/cache-qualification-baseline.json",
  "standards/fallow.boundaries.generated.jsonc",
] as const;

const UNMAPPED_STANDARDS_FILE = "standards/fallow.boundaries.provenance.jsonc";

const rowOwners = (readerPath: string): ReadonlyArray<string> =>
  pipe(
    COVERAGE_GENERATED_STANDARDS_OWNER_ROWS,
    A.filter(([path]) => path === readerPath),
    A.map(([, , owner]) => owner),
    A.dedupe,
    A.sort(Order.String)
  );

const source = (filePath: string, text: string) => CoverageReaderSource.make({ filePath, text });

describe("coverage owners for generated standards inventories", () => {
  describe("planner fixtures", () => {
    it("has one sample changed file per row", () => {
      expect(A.length(A.dedupe(A.map(COVERAGE_GENERATED_STANDARDS_OWNER_ROWS, ([path]) => path)))).toBe(
        SAMPLE_CHANGED_FILES.length
      );
    });

    it.each(SAMPLE_CHANGED_FILES)("selects exactly the scanned owner for %s", (file) => {
      expect(planCoverageAffectedScope(owners, [file])).toEqual({
        _tag: "selected",
        packageNames: ["@beep/repo-cli"],
        dependentPackageNames: [],
      });
    });

    it("keeps an unmapped standards file on the full fallback", () => {
      expect(planCoverageAffectedScope(owners, [UNMAPPED_STANDARDS_FILE])).toEqual({
        _tag: "full",
        reasons: [`${UNMAPPED_STANDARDS_FILE}: no current workspace owner`],
      });
      expect(
        planCoverageAffectedScope(owners, ["standards/policy-tools.fingerprint.json", UNMAPPED_STANDARDS_FILE])._tag
      ).toBe("full");
    });

    it("falls back to full when the scanned owner cannot measure coverage", () => {
      const unmeasured = CoverageScopeOwner.make({ ...repoCli, hasCoverage: false });
      expect(planCoverageAffectedScope([unmeasured], ["standards/schema-first.inventory.jsonc"])).toEqual({
        _tag: "full",
        reasons: [
          "standards/schema-first.inventory.jsonc: configured repository fixture coverage owner is unavailable",
        ],
      });
    });

    it("does not map a sibling that only shares a name prefix", () => {
      expect(planCoverageAffectedScope(owners, ["standards/instrumentation-catalog.jsonc"])._tag).toBe("full");
      expect(planCoverageAffectedScope(owners, ["standards/policy-tools.fingerprint.json.bak"])._tag).toBe("full");
    });
  });

  describe("reader scan", () => {
    const target = "standards/policy-tools.fingerprint.json";

    it("sees a seeded path.join read with the basename as its own argument", () => {
      const text =
        'import * as path from "node:path";\nconst p = path.join(root, "standards", "policy-tools.fingerprint.json");\n';
      expect(coverageSourceReadsPath(source("seed.ts", text), target)).toBe(true);
    });

    it("sees a basename folded from literal concatenation and template parts", () => {
      expect(coverageSourceReadsPath(source("a.ts", 'const p = "policy-tools" + ".fingerprint.json";'), target)).toBe(
        true
      );
      expect(
        coverageSourceReadsPath(source("a.ts", "const p = `${root}/standards/policy-tools.fingerprint.json`;"), target)
      ).toBe(true);
    });

    it("ignores comments and segments that only contain the basename", () => {
      expect(
        coverageSourceReadsPath(source("a.ts", "// standards/policy-tools.fingerprint.json\nconst x = 1;"), target)
      ).toBe(false);
      expect(
        coverageSourceReadsPath(source("a.ts", "/** reads standards/policy-tools.fingerprint.json */"), target)
      ).toBe(false);
      expect(
        coverageSourceReadsPath(source("a.ts", 'const p = "standards/policy-tools.fingerprint.json.bak";'), target)
      ).toBe(false);
      expect(coverageSourceReadsPath(source("a.ts", 'const p = "old-policy-tools.fingerprint.json";'), target)).toBe(
        false
      );
      expect(
        coverageSourceReadsPath(
          source("a.ts", 'const tag = "cache-qualification-baseline/v2";'),
          "standards/cache-qualification-baseline.json"
        )
      ).toBe(false);
    });

    it("tokenises TSX sources", () => {
      expect(coverageReaderStringTokens(source("a.tsx", 'const v = <div title="standards/a.json" />;'))).toContain(
        "standards/a.json"
      );
    });

    it("reads a directory row from a path segment", () => {
      expect(
        coverageSourceReadsPath(
          source("a.ts", 'const dir = path.join(root, "standards", "instrumentation-catalog");'),
          "standards/instrumentation-catalog"
        )
      ).toBe(true);
    });

    it("adds coverage dependents only for a read outside the test tree", () => {
      const dependent = CoverageScopeOwner.make({
        packageName: "@beep/dependent",
        packagePath: "packages/dependent",
        hasCoverage: true,
        workspaceDependencies: ["@beep/unrelated"],
      });
      const graph = [...owners, dependent];
      const read = '"standards/policy-tools.fingerprint.json"';
      expect(coverageReaderOwners(graph, [source("packages/unrelated/test/A.test.ts", read)], target)).toEqual([
        "@beep/unrelated",
      ]);
      expect(coverageReaderOwners(graph, [source("packages/unrelated/src/A.ts", read)], target)).toEqual([
        "@beep/dependent",
        "@beep/unrelated",
      ]);
      expect(coverageReaderOwners(graph, [source("packages/unrelated/src/A.ts", `// ${read}`)], target)).toEqual([]);
    });
  });
});

const PlatformLayer = FsUtilsLive.pipe(Layer.provideMerge(NodeServices.layer));

it.layer(PlatformLayer, { timeout: "120 seconds" })("coverage owner drift check", (it) => {
  it.effect("keeps every row equal to the reader scan over the live workspace sources", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const fsUtils = yield* FsUtils;
      const path = yield* Path.Path;
      const repoRoot = path.resolve(import.meta.dirname, "../../../../..");
      const workspace = yield* workspaceCoverageScopeOwners(repoRoot);
      const files = yield* fsUtils.globFiles(["packages/**/*.{ts,tsx,mts,cts}", "apps/**/*.{ts,tsx,mts,cts}"], {
        cwd: repoRoot,
        ignore: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.turbo/**", "**/coverage/**"],
      });
      const sources = yield* Effect.forEach(
        files,
        (file) =>
          Effect.map(fs.readFileString(path.join(repoRoot, file)), (text) =>
            source(path.relative(repoRoot, path.resolve(repoRoot, file)), text)
          ),
        { concurrency: 32 }
      );
      expect(A.length(sources)).toBeGreaterThan(1000);
      for (const readerPath of A.dedupe(A.map(COVERAGE_GENERATED_STANDARDS_OWNER_ROWS, ([path]) => path))) {
        expect({ readerPath, owners: coverageReaderOwners(workspace, sources, readerPath) }).toEqual({
          readerPath,
          owners: rowOwners(readerPath),
        });
      }
    })
  );
});
