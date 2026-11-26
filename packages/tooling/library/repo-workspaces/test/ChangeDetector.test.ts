import { Git, GitCommandError, NotARepositoryError } from "@beep/git";
import {
  ChangeDetectionOptions,
  ChangeDetector,
  PublishabilityDetector,
  WorkspaceDiscovery,
  WorkspacePackage,
  WorkspaceRoot,
} from "@beep/repo-workspaces";
import { assert, describe, layer } from "@effect/vitest";
import { assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import { manifest, platform, rootManifest } from "./support/fixtures.ts";
import type { Tree } from "./support/fixtures.ts";

const webOnBetaOnAlphaChain: Tree = {
  "/repo/package.json": rootManifest(["packages/*", "apps/*"]),
  "/repo/packages/alpha/package.json": manifest("@x/alpha"),
  "/repo/packages/beta/package.json": manifest("@x/beta", { dependencies: { "@x/alpha": "1.0.0" } }),
  "/repo/apps/web/package.json": manifest("@x/web", { dependencies: { "@x/beta": "1.0.0" } }),
};

type ChangedFiles = (
  cwd: string,
  options: { readonly base: string; readonly head: string; readonly relative?: boolean }
) => Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError>;

type WorkingChanges = (
  cwd: string,
  options?: { readonly relative?: boolean }
) => Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError>;

const stubGit = (impl: {
  readonly changedFiles?: ChangedFiles;
  readonly workingChanges?: WorkingChanges;
}): Layer.Layer<Git> =>
  Git.layerTest({
    changedFiles: impl.changedFiles ?? (() => Effect.succeed([])),
    workingChanges: impl.workingChanges ?? (() => Effect.succeed([])),
  });

const detectorOver = (git: Layer.Layer<Git>) => {
  const base = platform(webOnBetaOnAlphaChain);
  const roots = WorkspaceRoot.layer.pipe(Layer.provide(base));
  const discovery = WorkspaceDiscovery.layer({ cwd: "/repo" }).pipe(Layer.provide(roots), Layer.provide(base));
  return Layer.mergeAll(discovery, git, ChangeDetector.layer.pipe(Layer.provide(git), Layer.provide(discovery))).pipe(
    Layer.provideMerge(base)
  );
};

const committedOnly = stubGit({
  changedFiles: (_cwd, { base, head }) =>
    base === "HEAD~1" && head === "HEAD" ? Effect.succeed(["packages/alpha/src/index.ts"]) : Effect.succeed([]),
});

describe("ChangeDetector — committed changes", () => {
  layer(detectorOver(committedOnly), { timeout: "30 seconds" })((it) => {
    it.effect("changedFiles returns the diff output, sorted", () =>
      Effect.gen(function* () {
        const detector = yield* ChangeDetector;
        const changedFiles1 = yield* detector.changedFiles();
        assert.deepStrictEqual(changedFiles1, ["packages/alpha/src/index.ts"]);
      })
    );

    it.effect("changedPackages maps files onto their owning package", () =>
      Effect.gen(function* () {
        const detector = yield* ChangeDetector;
        const changed = yield* detector.changedPackages();
        assert.deepStrictEqual(
          A.map(changed, (pkg: WorkspacePackage) => pkg.name),
          ["@x/alpha"]
        );
      })
    );

    it.effect("affectedPackages walks the reverse graph TRANSITIVELY", () =>
      Effect.gen(function* () {
        const detector = yield* ChangeDetector;
        const affected = yield* detector.affectedPackages();
        assert.deepStrictEqual(
          A.map(affected, (pkg: WorkspacePackage) => pkg.name),
          ["@x/alpha", "@x/beta", "@x/web"],
          "@x/web is two hops from @x/alpha; a one-hop walk returns only alpha and beta"
        );
      })
    );
  });
});

const workingChangesFromUnstagedStagedAndUntracked = stubGit({
  changedFiles: (_cwd, { base }) =>
    base === "HEAD~1" ? Effect.succeed(["packages/alpha/committed.ts"]) : Effect.succeed([]),
  workingChanges: () =>
    Effect.succeed(["packages/beta/staged.ts", "packages/beta/unstaged.ts", "apps/web/untracked.ts"]),
});

describe("ChangeDetector — includeUncommitted", () => {
  layer(detectorOver(workingChangesFromUnstagedStagedAndUntracked), { timeout: "30 seconds" })((it) => {
    it.effect("folds the working tree in on top of the committed range", () =>
      Effect.gen(function* () {
        const detector = yield* ChangeDetector;
        const files = yield* detector.changedFiles(ChangeDetectionOptions.make({ includeUncommitted: true }));
        assert.deepStrictEqual(files, [
          "apps/web/untracked.ts",
          "packages/alpha/committed.ts",
          "packages/beta/staged.ts",
          "packages/beta/unstaged.ts",
        ]);
      })
    );

    it.effect("the default omits the working tree entirely", () =>
      Effect.gen(function* () {
        const detector = yield* ChangeDetector;
        const changedFiles2 = yield* detector.changedFiles();
        assert.deepStrictEqual(changedFiles2, ["packages/alpha/committed.ts"]);
      })
    );

    it.effect("changedPackages over the working tree covers every touched package", () =>
      Effect.gen(function* () {
        const detector = yield* ChangeDetector;
        const changed = yield* detector.changedPackages(ChangeDetectionOptions.make({ includeUncommitted: true }));
        assert.deepStrictEqual(
          A.map(changed, (pkg: WorkspacePackage) => pkg.name),
          ["@x/alpha", "@x/beta", "@x/web"]
        );
      })
    );
  });
});

describe("ChangeDetector — a custom base ref reaches git", () => {
  const answersOnlyOriginMainSoTheDefaultRangeIsEmpty = stubGit({
    changedFiles: (_cwd, { base }) =>
      base === "origin/main" ? Effect.succeed(["packages/beta/x.ts"]) : Effect.succeed([]),
  });
  layer(detectorOver(answersOnlyOriginMainSoTheDefaultRangeIsEmpty), { timeout: "30 seconds" })((it) => {
    it.effect("the base option is threaded into the git range", () =>
      Effect.gen(function* () {
        const detector = yield* ChangeDetector;
        const changed = yield* detector.changedPackages(ChangeDetectionOptions.make({ base: "origin/main" }));
        assert.deepStrictEqual(
          A.map(changed, (pkg: WorkspacePackage) => pkg.name),
          ["@x/beta"]
        );
      })
    );
  });
});

describe("ChangeDetector — the working tree is not a git repository", () => {
  const notARepo = stubGit({
    changedFiles: (cwd) => Effect.fail(NotARepositoryError.make({ cwd })),
  });
  layer(detectorOver(notARepo), { timeout: "30 seconds" })((it) => {
    it.effect("fails typed with NotARepositoryError, not a defect", () =>
      Effect.gen(function* () {
        const detector = yield* ChangeDetector;
        const result = yield* Effect.exit(detector.changedFiles());
        const error = yield* Effect.flip(detector.changedFiles());
        assertSuccess(Exit.findError(result), error);
        assert.instanceOf(error, NotARepositoryError);
      })
    );
  });
});

describe("ChangeDetector — a git command that fails", () => {
  const badRef = stubGit({
    changedFiles: (cwd, { base, head }) =>
      base === "nope"
        ? Effect.fail(
            GitCommandError.make({
              kind: "failed",
              args: ["diff", "--name-only", "-z", "--relative", `${base}...${head}`],
              cwd,
              exitCode: 128,
              stderr: "fatal: bad revision 'nope'",
            })
          )
        : Effect.succeed([]),
  });
  layer(detectorOver(badRef), { timeout: "30 seconds" })((it) => {
    it.effect("surfaces git's own diagnostic on a typed field, unwrapped", () =>
      Effect.gen(function* () {
        const detector = yield* ChangeDetector;
        const error = yield* Effect.flip(detector.changedFiles(ChangeDetectionOptions.make({ base: "nope" })));
        assert.instanceOf(error, GitCommandError);
        assert.strictEqual(error.exitCode, 128);
        assert.include(error.stderr, "bad revision");
      })
    );
  });
});

const location = {
  version: "1.0.0",
  path: "/repo/packages/p",
  packageJsonPath: "/repo/packages/p/package.json",
  relativePath: "packages/p",
  workspaceRoot: "/repo",
};

describe("PublishabilityDetector — the npm semantics", () => {
  layer(PublishabilityDetector.layerNpm, { timeout: "30 seconds" })((it) => {
    it.effect("a private package with no publishConfig.access publishes nowhere", () =>
      Effect.gen(function* () {
        const detector = yield* PublishabilityDetector;
        const targets = yield* detector.detect(WorkspacePackage.make({ name: "@x/p", ...location, private: true }));
        assert.lengthOf(targets, 0);
      })
    );

    it.effect("an explicit publishConfig.access overrides private", () =>
      Effect.gen(function* () {
        const detector = yield* PublishabilityDetector;
        const targets = yield* detector.detect(
          WorkspacePackage.make({
            name: "@x/p",
            ...location,
            private: true,
            publishConfig: { access: "restricted" },
          })
        );
        assert.lengthOf(targets, 1);
        const target = targets[0];
        assert.isDefined(target);
        if (target === undefined) return assert.fail("expected a publish target");
        assert.strictEqual(target.access, "restricted");
      })
    );

    it.effect("a public package publishes to the public registry with defaults", () =>
      Effect.gen(function* () {
        const detector = yield* PublishabilityDetector;
        const targets = yield* detector.detect(WorkspacePackage.make({ name: "@x/p", ...location }));
        assert.lengthOf(targets, 1);
        const target = targets[0];
        assert.isDefined(target);
        if (target === undefined) return assert.fail("expected a publish target");
        assert.strictEqual(target.registry, "https://registry.npmjs.org/");
        assert.strictEqual(target.directory, ".");
        assert.strictEqual(target.access, "public");
        assert.isFalse(target.provenance);
      })
    );

    it.effect("publishConfig registry and directory override the defaults", () =>
      Effect.gen(function* () {
        const detector = yield* PublishabilityDetector;
        const targets = yield* detector.detect(
          WorkspacePackage.make({
            name: "@x/p",
            ...location,
            publishConfig: { registry: "https://npm.internal/", directory: "dist/npm" },
          })
        );
        const target = targets[0];
        if (target === undefined) return assert.fail("expected a publish target");
        assert.strictEqual(target.registry, "https://npm.internal/");
        assert.strictEqual(target.directory, "dist/npm");
      })
    );
  });
});

const repoRelativePathsUnlessTheDetectorRequestsRelativeMode = stubGit({
  changedFiles: (_cwd, { relative }) =>
    relative === true
      ? Effect.succeed(["packages/alpha/src/index.ts"])
      : Effect.succeed(["repo/packages/alpha/src/index.ts", "outside/tooling.ts"]),
});

describe("ChangeDetector — a workspace nested inside a larger git repository: the detector owns requesting git's relative mode, git owns honouring it", () => {
  layer(detectorOver(repoRelativePathsUnlessTheDetectorRequestsRelativeMode), { timeout: "30 seconds" })((it) => {
    it.effect("requests relative mode, so paths are workspace-relative", () =>
      Effect.gen(function* () {
        const detector = yield* ChangeDetector;
        const changedFiles3 = yield* detector.changedFiles();
        assert.deepStrictEqual(
          changedFiles3,
          ["packages/alpha/src/index.ts"],
          "without relative: true these would be outside/tooling.ts and repo/packages/alpha/src/index.ts"
        );
      })
    );

    it.effect("changedPackages resolves the owning package from the relative path", () =>
      Effect.gen(function* () {
        const detector = yield* ChangeDetector;
        const changedPackages4 = yield* detector.changedPackages();
        const names = A.map(changedPackages4, (pkg) => pkg.name);
        assert.deepStrictEqual(
          names,
          ["@x/alpha"],
          "a repository-relative path joined onto the root (/repo/repo/packages/alpha) silently owns nothing"
        );
      })
    );

    it.effect("affectedPackages walks the reverse graph from the correctly-resolved package", () =>
      Effect.gen(function* () {
        const detector = yield* ChangeDetector;
        const affectedPackages5 = yield* detector.affectedPackages();
        const names = A.map(affectedPackages5, (pkg) => pkg.name).sort();
        assert.deepStrictEqual(names, ["@x/alpha", "@x/beta", "@x/web"]);
      })
    );
  });
});
