import { CyclicDependencyError } from "@beep/repo-utils";
import {
  extractWorkspaceDependencies,
  sortWorkspacePackages,
  workspaceDependencyNames,
} from "@beep/repo-utils/Dependencies";
import { decodePackageJson } from "@beep/repo-utils/schemas/PackageJson";
import { describe, expect, it } from "@effect/vitest";
import { Effect, HashSet } from "effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const isCyclicDependencyError = S.is(CyclicDependencyError);

describe("workspaceDependencyNames", () => {
  it("reads package names inside every bucket and drops the bucket names", () => {
    const workspaceNames = HashSet.make("@beep/kit", "@beep/lib", "@beep/opt", "@beep/peer");
    const deps = extractWorkspaceDependencies(
      decodePackageJson({
        name: "@beep/app",
        dependencies: { "@beep/lib": "workspace:*", effect: "^4.0.0" },
        devDependencies: { "@beep/kit": "workspace:*", "@beep/lib": "workspace:*" },
        peerDependencies: { "@beep/peer": "workspace:*" },
        optionalDependencies: { "@beep/opt": "workspace:*" },
      }),
      workspaceNames
    );

    expect(workspaceDependencyNames(deps)).toEqual(["@beep/kit", "@beep/lib", "@beep/opt", "@beep/peer"]);
  });
});

describe("sortWorkspacePackages", () => {
  it.effect("prints a dependency before the package that depends on it", () =>
    Effect.gen(function* () {
      const workspaceNames = HashSet.make("@beep/lib");
      const lib = extractWorkspaceDependencies(decodePackageJson({ name: "@beep/lib" }), workspaceNames);
      const app = extractWorkspaceDependencies(
        decodePackageJson({
          name: "@beep/app",
          dependencies: { "@beep/lib": "workspace:*" },
        }),
        workspaceNames
      );

      expect(
        yield* sortWorkspacePackages([
          ["@beep/app", app],
          ["@beep/lib", lib],
        ])
      ).toEqual(["@beep/lib", "@beep/app"]);
    })
  );

  it.effect("fails with CyclicDependencyError when two packages depend on each other", () =>
    Effect.gen(function* () {
      const workspaceNames = HashSet.make("@beep/a", "@beep/b");
      const a = extractWorkspaceDependencies(
        decodePackageJson({
          name: "@beep/a",
          dependencies: { "@beep/b": "workspace:*" },
        }),
        workspaceNames
      );
      const b = extractWorkspaceDependencies(
        decodePackageJson({
          name: "@beep/b",
          dependencies: { "@beep/a": "workspace:*" },
        }),
        workspaceNames
      );
      const result = yield* sortWorkspacePackages([
        ["@beep/a", a],
        ["@beep/b", b],
      ]).pipe(Effect.catchTag("CyclicDependencyError", (error) => Effect.succeed(error)));

      expect(isCyclicDependencyError(result)).toBe(true);
    })
  );
});

describe("Dependencies", () => {
  const workspaceNames = HashSet.make("@mock/pkg-a", "@mock/pkg-b", "@mock/pkg-c");

  describe("extractWorkspaceDependencies", () => {
    it("should classify workspace dependencies separately from npm dependencies", () => {
      const pkg = decodePackageJson({
        name: "@mock/pkg-a",
        dependencies: {
          "@mock/pkg-b": "workspace:*",
          effect: "^3.0.0",
        },
      });

      const result = extractWorkspaceDependencies(pkg, workspaceNames);

      expect(result.packageName).toBe("@mock/pkg-a");
      expect(result.workspace.dependencies).toEqual({ "@mock/pkg-b": "workspace:*" });
      expect(result.npm.dependencies).toEqual({ effect: "^3.0.0" });
    });

    it("should classify devDependencies correctly", () => {
      const pkg = decodePackageJson({
        name: "@mock/pkg-b",
        devDependencies: {
          "@mock/pkg-c": "workspace:*",
          vitest: "^1.0.0",
        },
      });

      const result = extractWorkspaceDependencies(pkg, workspaceNames);

      expect(result.workspace.devDependencies).toEqual({ "@mock/pkg-c": "workspace:*" });
      expect(result.npm.devDependencies).toEqual({ vitest: "^1.0.0" });
    });

    it("should classify peerDependencies correctly", () => {
      const pkg = decodePackageJson({
        name: "@mock/pkg-c",
        peerDependencies: {
          "@mock/pkg-a": ">=1.0.0",
          react: "^18.0.0",
        },
      });

      const result = extractWorkspaceDependencies(pkg, workspaceNames);

      expect(result.workspace.peerDependencies).toEqual({ "@mock/pkg-a": ">=1.0.0" });
      expect(result.npm.peerDependencies).toEqual({ react: "^18.0.0" });
    });

    it("should classify optionalDependencies correctly", () => {
      const pkg = decodePackageJson({
        name: "@mock/pkg-a",
        optionalDependencies: {
          "@mock/pkg-c": "workspace:*",
          fsevents: "^2.3.0",
        },
      });

      const result = extractWorkspaceDependencies(pkg, workspaceNames);

      expect(result.workspace.optionalDependencies).toEqual({ "@mock/pkg-c": "workspace:*" });
      expect(result.npm.optionalDependencies).toEqual({ fsevents: "^2.3.0" });
    });

    it("should handle package with no dependencies", () => {
      const pkg = decodePackageJson({
        name: "@mock/empty",
      });

      const result = extractWorkspaceDependencies(pkg, workspaceNames);

      expect(result.packageName).toBe("@mock/empty");
      expect(result.workspace.dependencies).toEqual({});
      expect(result.workspace.devDependencies).toEqual({});
      expect(result.workspace.peerDependencies).toEqual({});
      expect(result.workspace.optionalDependencies).toEqual({});
      expect(result.npm.dependencies).toEqual({});
      expect(result.npm.devDependencies).toEqual({});
      expect(result.npm.peerDependencies).toEqual({});
      expect(result.npm.optionalDependencies).toEqual({});
    });

    it("should handle all-workspace dependencies", () => {
      const pkg = decodePackageJson({
        name: "@mock/consumer",
        dependencies: {
          "@mock/pkg-a": "workspace:*",
          "@mock/pkg-b": "workspace:*",
          "@mock/pkg-c": "workspace:*",
        },
      });

      const result = extractWorkspaceDependencies(pkg, workspaceNames);

      expect(R.keys(result.workspace.dependencies)).toHaveLength(3);
      expect(R.keys(result.npm.dependencies)).toHaveLength(0);
    });

    it("should handle all-npm dependencies", () => {
      const pkg = decodePackageJson({
        name: "@mock/external-only",
        dependencies: {
          lodash: "^4.0.0",
          express: "^4.18.0",
        },
      });

      const result = extractWorkspaceDependencies(pkg, workspaceNames);

      expect(R.keys(result.workspace.dependencies)).toHaveLength(0);
      expect(R.keys(result.npm.dependencies)).toHaveLength(2);
    });

    it("should use empty HashSet to treat all deps as npm", () => {
      const pkg = decodePackageJson({
        name: "@mock/pkg-a",
        dependencies: {
          "@mock/pkg-b": "workspace:*",
          effect: "^3.0.0",
        },
      });

      const result = extractWorkspaceDependencies(pkg, HashSet.empty<string>());

      expect(R.keys(result.workspace.dependencies)).toHaveLength(0);
      expect(R.keys(result.npm.dependencies)).toHaveLength(2);
    });
  });
});
