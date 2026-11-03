import { identity } from "effect/Function";
// The repo CLI's one workspace reader (4-A3): members from `@beep/repo-workspaces`
// `WorkspaceDiscovery`, edges and order from `DependencyGraph`. These pin the
// behaviour the retired repo-utils readers had and every caller relies on: the
// root is never a member, directories are real paths, a wildcard whose base is
// absent selects nothing, a root without workspaces has no members, a member
// link that leaves the checkout is skipped, a bad root fails closed (a strictly
// invalid manifest or an escaping pattern), generated directories hold no
// members and are skipped before their manifests are read, and a
// self-dependency is no edge.

import {
  DecodedWorkspaceMember,
  UnsafeWorkspacePatternError,
  workspaceDependencyGraph,
  workspaceDirectories,
  workspaceManifests,
  workspaceMembers,
  workspacePackages,
} from "@beep/repo-cli/test/SharedInternals";
import { WorkspaceDiscoveryError } from "@beep/repo-workspaces/WorkspaceDiscovery";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { describe } from "@effect/vitest";
import { assertInstanceOf, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const UnknownJson = S.fromJsonString(S.Unknown);

const json = (value: unknown): string =>
  `${Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(value), identity)}\n`;

// A scratch repository: `files` maps repo-relative paths to contents.
const repository = Effect.fnUntraced(function* (files: Readonly<Record<string, string>>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const madeTempDirectoryScoped = yield* fs.makeTempDirectoryScoped({ prefix: "beep-repo-workspaces-" });
  const root = yield* fs.realPath(madeTempDirectoryScoped);
  for (const [relative, content] of R.toEntries(files)) {
    const file = path.join(root, relative);
    yield* fs.makeDirectory(path.dirname(file), { recursive: true });
    yield* fs.writeFileString(file, content);
  }
  return root;
});

const twoMembers = {
  "package.json": json({ name: "@beep/root", private: true, workspaces: ["packages/*", "apps/*"] }),
  "packages/core/package.json": json({ name: "@beep/core", scripts: { test: "vitest" } }),
  "packages/app/package.json": json({
    name: "@beep/app",
    dependencies: { "@beep/core": "workspace:^", effect: "4.0.0" },
  }),
};

const sortedEntries = <V>(map: HashMap.HashMap<string, V>): ReadonlyArray<readonly [string, V]> =>
  A.sort(
    HashMap.toEntries(map),
    Order.mapInput(Str.Order, (entry: readonly [string, V]) => entry[0])
  );

it.layer(NodeServices.layer, { timeout: "30 seconds" })("RepoWorkspaces", (it) => {
  describe("members", () => {
    it.effect("lists the root first and never counts it as a member; a missing wildcard base selects nothing", () =>
      Effect.gen(function* () {
        const root = yield* repository(twoMembers);
        const packages = yield* workspacePackages(root);
        deepStrictEqual(
          A.map(packages, (pkg) => `${pkg.name}=${pkg.relativePath}`),
          ["@beep/root=.", "@beep/app=packages/app", "@beep/core=packages/core"]
        );
        const members = yield* workspaceMembers(root);
        deepStrictEqual(
          A.map(members, (pkg) => pkg.name),
          ["@beep/app", "@beep/core"]
        );
      })
    );

    it.effect("reads a root that declares no workspaces as having no members", () =>
      Effect.gen(function* () {
        const root = yield* repository({ "package.json": json({ name: "fixture" }) });
        const workspacePackages1 = yield* workspacePackages(root);
        deepStrictEqual(workspacePackages1, []);
        const workspaceDirectories2 = yield* workspaceDirectories(root);
        strictEqual(HashMap.size(workspaceDirectories2), 0);
      })
    );

    it.effect("fails typed when the root manifest is missing or is not JSON", () =>
      Effect.gen(function* () {
        const repository3 = yield* repository({});
        const missing = yield* Effect.flip(workspaceMembers(repository3));
        assertInstanceOf(missing, WorkspaceDiscoveryError);
        strictEqual(missing.kind, "read");
        const repository4 = yield* repository({ "package.json": "{" });
        const malformed = yield* Effect.flip(workspaceMembers(repository4));
        assertInstanceOf(malformed, WorkspaceDiscoveryError);
        strictEqual(malformed.kind, "invalidJson");
      })
    );

    it.effect("fails typed on a root manifest that is valid JSON but fails the strict model", () =>
      Effect.gen(function* () {
        const repository5 = yield* repository({ "package.json": json({ name: "root", workspaces: "notarray" }) });
        const notArray = yield* Effect.flip(workspaceMembers(repository5));
        assertInstanceOf(notArray, WorkspaceDiscoveryError);
        strictEqual(notArray.kind, "invalidShape");
        const repository6 = yield* repository({ "package.json": json({ name: 42, workspaces: ["packages/*"] }) });
        const badName = yield* Effect.flip(workspaceMembers(repository6));
        assertInstanceOf(badName, WorkspaceDiscoveryError);
        strictEqual(badName.kind, "invalidShape");
      })
    );

    it.effect("fails typed when pnpm-workspace.yaml is not YAML, naming that file", () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const root = yield* repository({
          "package.json": json({ name: "@beep/root", private: true }),
          "pnpm-workspace.yaml": "packages: [unterminated\n",
        });
        const failure = yield* Effect.flip(workspaceMembers(root));
        assertInstanceOf(failure, WorkspaceDiscoveryError);
        strictEqual(failure.kind, "invalidYaml");
        strictEqual(failure.path, path.join(root, "pnpm-workspace.yaml"));
      })
    );

    it.effect("fails closed on an empty, absolute or parent-traversing root pattern before reading members", () =>
      Effect.gen(function* () {
        const cases: ReadonlyArray<readonly [string, string]> = [
          ["../*", "parentSegment"],
          ["packages/../../*", "parentSegment"],
          ["", "empty"],
          ["!", "empty"],
          ["C:/outside/*", "absolute"],
          ["/etc/*", "absolute"],
          ["\\\\host\\share\\*", "absolute"],
        ];
        for (const [pattern, reason] of cases) {
          const root = yield* repository({
            ...twoMembers,
            "package.json": json({ name: "root", workspaces: ["packages/*", pattern] }),
          });
          const error = yield* Effect.flip(workspacePackages(root));
          assertInstanceOf(error, UnsafeWorkspacePatternError);
          strictEqual(error.pattern, pattern);
          strictEqual(error.reason, reason);
          strictEqual(error.message, `Unsafe workspace pattern "${pattern}" escapes the repository root (${reason}).`);
        }
      })
    );

    it.effect("drops members beneath generated directories", () =>
      Effect.gen(function* () {
        const root = yield* repository({
          ...twoMembers,
          "package.json": json({ name: "root", workspaces: ["packages/*", "packages/*/coverage", "dist/*"] }),
          "packages/core/coverage/package.json": json({ name: "@gen/cov" }),
          "dist/out/package.json": json({ name: "@gen/dist" }),
        });
        const workspaceMembers7 = yield* workspaceMembers(root);
        deepStrictEqual(
          A.map(workspaceMembers7, (pkg) => pkg.name),
          ["@beep/app", "@beep/core"]
        );
      })
    );

    it.effect("skips a malformed generated manifest under a matched pattern before reading it", () =>
      Effect.gen(function* () {
        const root = yield* repository({
          ...twoMembers,
          "package.json": json({
            name: "root",
            workspaces: ["packages/*", "packages/*/coverage", "dist/*", "packages/core/build"],
          }),
          "packages/core/coverage/package.json": "{}\n",
          "packages/core/build/package.json": "{\n",
          "dist/out/package.json": "not json\n",
        });
        const workspacePackages8 = yield* workspacePackages(root);
        deepStrictEqual(
          A.map(workspacePackages8, (pkg) => `${pkg.name}=${pkg.relativePath}`),
          ["root=.", "@beep/app=packages/app", "@beep/core=packages/core"]
        );
      })
    );

    it.effect("reads a slashed wildcard and a slashed literal root pattern as their unslashed forms", () =>
      Effect.gen(function* () {
        const root = yield* repository({
          ...twoMembers,
          "package.json": json({ name: "root", workspaces: ["packages/*/", "packages/core/"] }),
        });
        // The literal names a member the wildcard also selects: one member, at the unslashed path.
        const workspacePackages9 = yield* workspacePackages(root);
        deepStrictEqual(
          A.map(workspacePackages9, (pkg) => `${pkg.name}=${pkg.relativePath}`),
          ["root=.", "@beep/app=packages/app", "@beep/core=packages/core"]
        );
      })
    );

    it.effect("selects the base of a /** pattern and applies a ./ exclusion", () =>
      Effect.gen(function* () {
        const root = yield* repository({
          ...twoMembers,
          "package.json": json({ name: "root", workspaces: ["packages/core/**", "packages/*", "!./packages/app"] }),
        });
        const workspacePackages10 = yield* workspacePackages(root);
        deepStrictEqual(
          A.map(workspacePackages10, (pkg) => `${pkg.name}=${pkg.relativePath}`),
          ["root=.", "@beep/core=packages/core"]
        );
      })
    );

    it.effect("skips a member link whose real path leaves the checkout", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* repository(twoMembers);
        const outside = yield* repository({ "package.json": json({ name: "@beep/outside" }) });
        yield* fs.symlink(outside, path.join(root, "packages", "outside"));
        const workspaceMembers11 = yield* workspaceMembers(root);
        deepStrictEqual(
          A.map(workspaceMembers11, (pkg) => pkg.name),
          ["@beep/app", "@beep/core"]
        );
      })
    );
  });

  describe("directories", () => {
    it.effect("keys each member's real path by package name, through a linked root and a linked member", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* repository({
          ...twoMembers,
          "package.json": json({ name: "@beep/root", private: true, workspaces: ["packages/*", "alias"] }),
        });
        yield* fs.symlink(path.join(root, "packages", "core"), path.join(root, "alias"));
        const repository12 = yield* repository({});
        const aliasRoot = path.join(repository12, "link");
        yield* fs.symlink(root, aliasRoot);

        const workspaceDirectories13 = yield* workspaceDirectories(aliasRoot);
        deepStrictEqual(sortedEntries(workspaceDirectories13), [
          ["@beep/app", path.join(root, "packages", "app")],
          ["@beep/core", path.join(root, "packages", "core")],
        ]);
      })
    );
  });

  describe("manifests", () => {
    it.effect("decodes each member's as-read manifest through the strict model", () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const root = yield* repository(twoMembers);
        const manifests = yield* workspaceManifests(root);
        const core = O.getOrThrow(HashMap.get(manifests, "@beep/core"));
        assertTrue(S.is(DecodedWorkspaceMember)(core));
        strictEqual(core.dir, path.join(root, "packages", "core"));
        deepStrictEqual(sortedEntries(core.manifest.scripts), [["test", "vitest"]]);
      })
    );

    it.effect("fails with a schema error on a member manifest the strict model rejects", () =>
      Effect.gen(function* () {
        const root = yield* repository({
          ...twoMembers,
          "packages/core/package.json": json({ name: "@beep/core", scripts: { test: "" } }),
        });
        const flip14 = yield* Effect.flip(workspaceManifests(root));
        assertInstanceOf(flip14, S.SchemaError);
      })
    );
  });

  describe("dependency graph", () => {
    it.effect("draws edges between members only and sorts dependencies first", () =>
      Effect.gen(function* () {
        const root = yield* repository(twoMembers);
        const graph = yield* workspaceDependencyGraph(root);
        const dependenciesOf15 = yield* graph.dependenciesOf("@beep/app");
        deepStrictEqual(dependenciesOf15, ["@beep/core"]);
        const sort16 = yield* graph.sort();
        deepStrictEqual(sort16, ["@beep/core", "@beep/app"]);
      })
    );

    it.effect("gives a self-dependency no edge, so it sorts instead of reading as a cycle", () =>
      Effect.gen(function* () {
        const root = yield* repository({
          ...twoMembers,
          "packages/core/package.json": json({ name: "@beep/core", dependencies: { "@beep/core": "workspace:*" } }),
        });
        const graph = yield* workspaceDependencyGraph(root);
        const dependenciesOf17 = yield* graph.dependenciesOf("@beep/core");
        deepStrictEqual(dependenciesOf17, []);
        const sort18 = yield* graph.sort();
        deepStrictEqual(sort18, ["@beep/core", "@beep/app"]);
      })
    );
  });
});
