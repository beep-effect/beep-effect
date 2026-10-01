import {
  CoverageScopeOwner,
  isModuleTagScannedPathForTesting,
  planCoverageAffectedScope,
} from "@beep/repo-cli/test/Quality";
import { it } from "@beep/test-runner";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect } from "@effect/vitest";
import { Effect, Path } from "effect";

const labOwner = CoverageScopeOwner.make({
  packageName: "@beep/lab-demo",
  packagePath: "apps/labs/demo",
  hasCoverage: false,
});

const coveredLabOwner = CoverageScopeOwner.make({
  packageName: "@beep/lab-demo",
  packagePath: "apps/labs/demo",
  hasCoverage: true,
});

const productOwner = CoverageScopeOwner.make({
  packageName: "@beep/a",
  packagePath: "packages/a",
  hasCoverage: true,
});

describe("labs ceremony scoping", () => {
  describe("planCoverageAffectedScope", () => {
    it("treats lab source changes as coverage no-ops", () => {
      expect(planCoverageAffectedScope([labOwner], ["apps/labs/demo/src/App.tsx"])).toEqual({ _tag: "noop" });
    });

    it("does not treat a lab package manifest as a package-identity full reason", () => {
      expect(planCoverageAffectedScope([labOwner], ["apps/labs/demo/package.json"])).toEqual({ _tag: "noop" });
    });

    it("treats lab paths as no-ops even without any lab owner", () => {
      expect(planCoverageAffectedScope([productOwner], ["apps/labs/demo/src/App.tsx"])).toEqual({ _tag: "noop" });
    });

    it("never selects a lab owner that illegally defines coverage", () => {
      expect(planCoverageAffectedScope([coveredLabOwner], ["apps/labs/demo/src/App.tsx"])).toEqual({ _tag: "noop" });
    });

    it("keeps product owners selected when labs change alongside them", () => {
      expect(
        planCoverageAffectedScope(
          [coveredLabOwner, productOwner],
          ["apps/labs/demo/src/App.tsx", "packages/a/src/A.ts"]
        )
      ).toEqual({ _tag: "selected", packageNames: ["@beep/a"], dependentPackageNames: [] });
    });
  });

  describe("isModuleTagScannedPathForTesting", () => {
    it.layer(NodePath.layer, { timeout: "10 seconds" })((it) => {
      it.effect("excludes labs paths from the module-tags scan while keeping every other root", () =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const isScannedPath = isModuleTagScannedPathForTesting(path);

          expect(isScannedPath("packages/demo/src/File.ts")).toBe(true);
          expect(isScannedPath("apps/demo/src/File.ts")).toBe(true);
          expect(isScannedPath(".patterns/jsdoc-documentation.md")).toBe(true);
          expect(isScannedPath("apps/labs/demo/src/File.ts")).toBe(false);
          expect(isScannedPath("apps/labs/demo/README.md")).toBe(false);
          // Prefix guard: apps/labsx is not the labs root.
          expect(isScannedPath("apps/labsx/src/File.ts")).toBe(true);
          // Extension guard still applies outside labs.
          expect(isScannedPath("packages/demo/src/data.json")).toBe(false);
        })
      );
    });
  });
});
