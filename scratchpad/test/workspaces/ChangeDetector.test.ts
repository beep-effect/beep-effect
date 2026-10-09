import { assert, describe, layer } from "@effect/vitest";
import { Git, GitCommandError, NotARepositoryError } from "../../effected/git/index.ts";
import { Effect, Layer } from "effect";
import {
	ChangeDetectionOptions,
	ChangeDetector,
	PublishabilityDetector,
	WorkspaceDiscovery,
	WorkspacePackage,
	WorkspaceRoot,
} from "../../effected/workspaces/index.ts";
import type { Tree } from "./fixtures.ts";
import { manifest, platform, rootManifest } from "./fixtures.ts";

// a → b → c: `web` depends on `beta`, `beta` depends on `alpha`. Touching a file
// in `alpha` must therefore affect `beta` AND `web`.
const tree: Tree = {
	"/repo/package.json": rootManifest(["packages/*", "apps/*"]),
	"/repo/packages/alpha/package.json": manifest("@x/alpha"),
	"/repo/packages/beta/package.json": manifest("@x/beta", { dependencies: { "@x/alpha": "1.0.0" } }),
	"/repo/apps/web/package.json": manifest("@x/web", { dependencies: { "@x/beta": "1.0.0" } }),
};

type ChangedFiles = (
	cwd: string,
	options: { readonly base: string; readonly head: string; readonly relative?: boolean },
) => Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError>;

type WorkingChanges = (
	cwd: string,
	options?: { readonly relative?: boolean },
) => Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError>;

/**
 * A `Git` stub with only the two methods `ChangeDetector` exercises supplied;
 * every other method fails loudly as a defect if the detector ever reaches it,
 * so the test proves no repository is touched. `Git.layerTest` — the shipped
 * double git.md documents for change-detection consumers.
 */
const stubGit = (impl: {
	readonly changedFiles?: ChangedFiles;
	readonly workingChanges?: WorkingChanges;
}): Layer.Layer<Git> =>
	// Git.layerTest fills every unstubbed method with a defect naming itself,
	// so the test still proves no repository is touched — without this file
	// re-enumerating (and drifting from) the full GitShape surface.
	Git.layerTest({
		changedFiles: impl.changedFiles ?? (() => Effect.succeed([])),
		workingChanges: impl.workingChanges ?? (() => Effect.succeed([])),
	});

const detectorOver = (git: Layer.Layer<Git>) => {
	const base = platform(tree);
	const roots = WorkspaceRoot.layer.pipe(Layer.provide(base));
	const discovery = WorkspaceDiscovery.layer({ cwd: "/repo" }).pipe(Layer.provide(roots), Layer.provide(base));
	return Layer.mergeAll(discovery, git, ChangeDetector.layer.pipe(Layer.provide(git), Layer.provide(discovery))).pipe(
		Layer.provideMerge(base),
	);
};

const committedOnly = stubGit({
	changedFiles: (_cwd, { base, head }) =>
		base === "HEAD~1" && head === "HEAD" ? Effect.succeed(["packages/alpha/src/index.ts"]) : Effect.succeed([]),
});

describe("ChangeDetector — committed changes", () => {
	layer(detectorOver(committedOnly))((it) => {
		it.effect("changedFiles returns the diff output, sorted", () =>
			Effect.gen(function* () {
				const detector = yield* ChangeDetector;
				assert.deepStrictEqual(yield* detector.changedFiles(), ["packages/alpha/src/index.ts"]);
			}),
		);

		it.effect("changedPackages maps files onto their owning package", () =>
			Effect.gen(function* () {
				const detector = yield* ChangeDetector;
				const changed = yield* detector.changedPackages();
				assert.deepStrictEqual(
					changed.map((pkg: WorkspacePackage) => pkg.name),
					["@x/alpha"],
				);
			}),
		);

		it.effect("affectedPackages walks the reverse graph TRANSITIVELY", () =>
			Effect.gen(function* () {
				const detector = yield* ChangeDetector;
				const affected = yield* detector.affectedPackages();
				// `@x/web` is two hops from `@x/alpha`. A one-hop implementation
				// returns only alpha and beta and passes a lazier assertion.
				assert.deepStrictEqual(
					affected.map((pkg: WorkspacePackage) => pkg.name),
					["@x/alpha", "@x/beta", "@x/web"],
				);
			}),
		);
	});
});

// `includeUncommitted` must fold in the working tree via `Git.workingChanges`.
// A stub whose `workingChanges` returns three distinct files proves all three
// sources (unstaged, staged, untracked) are unioned into the result.
const withWorkingTree = stubGit({
	changedFiles: (_cwd, { base }) =>
		base === "HEAD~1" ? Effect.succeed(["packages/alpha/committed.ts"]) : Effect.succeed([]),
	workingChanges: () =>
		Effect.succeed(["packages/beta/staged.ts", "packages/beta/unstaged.ts", "apps/web/untracked.ts"]),
});

describe("ChangeDetector — includeUncommitted", () => {
	layer(detectorOver(withWorkingTree))((it) => {
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
			}),
		);

		it.effect("the default omits the working tree entirely", () =>
			Effect.gen(function* () {
				const detector = yield* ChangeDetector;
				assert.deepStrictEqual(yield* detector.changedFiles(), ["packages/alpha/committed.ts"]);
			}),
		);

		it.effect("changedPackages over the working tree covers every touched package", () =>
			Effect.gen(function* () {
				const detector = yield* ChangeDetector;
				const changed = yield* detector.changedPackages(ChangeDetectionOptions.make({ includeUncommitted: true }));
				assert.deepStrictEqual(
					changed.map((pkg: WorkspacePackage) => pkg.name),
					["@x/alpha", "@x/beta", "@x/web"],
				);
			}),
		);
	});
});

describe("ChangeDetector — a custom base ref reaches git", () => {
	// The stub answers ONLY `origin/main`; a detector that ignored the option and
	// used the default range would see an empty diff.
	const custom = stubGit({
		changedFiles: (_cwd, { base }) =>
			base === "origin/main" ? Effect.succeed(["packages/beta/x.ts"]) : Effect.succeed([]),
	});
	layer(detectorOver(custom))((it) => {
		it.effect("the base option is threaded into the git range", () =>
			Effect.gen(function* () {
				const detector = yield* ChangeDetector;
				const changed = yield* detector.changedPackages(ChangeDetectionOptions.make({ base: "origin/main" }));
				assert.deepStrictEqual(
					changed.map((pkg: WorkspacePackage) => pkg.name),
					["@x/beta"],
				);
			}),
		);
	});
});

describe("ChangeDetector — the working tree is not a git repository", () => {
	// `Git` surfaces a non-repository directly as NotARepositoryError — the
	// v1 `available()` pre-check that synthesized a `GitCommandError` is gone.
	const notARepo = stubGit({
		changedFiles: (cwd) => Effect.fail(new NotARepositoryError({ cwd })),
	});
	layer(detectorOver(notARepo))((it) => {
		it.effect("fails typed with NotARepositoryError, not a defect", () =>
			Effect.gen(function* () {
				const detector = yield* ChangeDetector;
				const result = yield* Effect.result(detector.changedFiles());
				assert.strictEqual(result._tag, "Failure");
				const error = yield* Effect.flip(detector.changedFiles());
				assert.instanceOf(error, NotARepositoryError);
			}),
		);
	});
});

describe("ChangeDetector — a git command that fails", () => {
	const badRef = stubGit({
		changedFiles: (cwd, { base, head }) =>
			base === "nope"
				? Effect.fail(
						new GitCommandError({
							kind: "failed",
							args: ["diff", "--name-only", "-z", "--relative", `${base}...${head}`],
							cwd,
							exitCode: 128,
							stderr: "fatal: bad revision 'nope'",
						}),
					)
				: Effect.succeed([]),
	});
	layer(detectorOver(badRef))((it) => {
		it.effect("surfaces git's own diagnostic on a typed field, unwrapped", () =>
			Effect.gen(function* () {
				const detector = yield* ChangeDetector;
				const error = yield* Effect.flip(detector.changedFiles(ChangeDetectionOptions.make({ base: "nope" })));
				assert.instanceOf(error, GitCommandError);
				assert.strictEqual(error.exitCode, 128);
				assert.include(error.stderr, "bad revision");
			}),
		);
	});
});

// ── Publishability, which is pure and swappable ────────────────────────────

const location = {
	version: "1.0.0",
	path: "/repo/packages/p",
	packageJsonPath: "/repo/packages/p/package.json",
	relativePath: "packages/p",
	workspaceRoot: "/repo",
};

describe("PublishabilityDetector — the npm semantics", () => {
	layer(PublishabilityDetector.layerNpm)((it) => {
		it.effect("a private package with no publishConfig.access publishes nowhere", () =>
			Effect.gen(function* () {
				const detector = yield* PublishabilityDetector;
				const targets = yield* detector.detect(WorkspacePackage.make({ name: "@x/p", ...location, private: true }));
				assert.lengthOf(targets, 0);
			}),
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
					}),
				);
				assert.lengthOf(targets, 1);
				assert.strictEqual(targets[0].access, "restricted");
			}),
		);

		it.effect("a public package publishes to the public registry with defaults", () =>
			Effect.gen(function* () {
				const detector = yield* PublishabilityDetector;
				const targets = yield* detector.detect(WorkspacePackage.make({ name: "@x/p", ...location }));
				assert.lengthOf(targets, 1);
				assert.strictEqual(targets[0].registry, "https://registry.npmjs.org/");
				assert.strictEqual(targets[0].directory, ".");
				assert.strictEqual(targets[0].access, "public");
				assert.isFalse(targets[0].provenance);
			}),
		);

		it.effect("publishConfig registry and directory override the defaults", () =>
			Effect.gen(function* () {
				const detector = yield* PublishabilityDetector;
				const targets = yield* detector.detect(
					WorkspacePackage.make({
						name: "@x/p",
						...location,
						publishConfig: { registry: "https://npm.internal/", directory: "dist/npm" },
					}),
				);
				assert.strictEqual(targets[0].registry, "https://npm.internal/");
				assert.strictEqual(targets[0].directory, "dist/npm");
			}),
		);
	});
});

// ── a workspace NESTED inside a larger git repository ──────────────────────
//
// The `--relative` correctness now lives inside `@effected/git`: `Git` runs
// `git diff --relative` and returns workspace-root-relative paths. What the
// detector owns is REQUESTING that mode. This stub proves the detector passes
// `relative: true` — it returns workspace-relative paths for `relative: true`
// and the (wrong, repository-relative) paths otherwise, so a detector that
// forgot to ask for relative mode resolves the wrong package (or none). Real
// `--relative` behavior against a real nested tree is git's own integration test.

const nestedGit = stubGit({
	changedFiles: (_cwd, { relative }) =>
		relative === true
			? Effect.succeed(["packages/alpha/src/index.ts"])
			: Effect.succeed(["repo/packages/alpha/src/index.ts", "outside/tooling.ts"]),
});

describe("ChangeDetector — a workspace nested inside a larger git repository", () => {
	layer(detectorOver(nestedGit))((it) => {
		it.effect("requests relative mode, so paths are workspace-relative", () =>
			Effect.gen(function* () {
				const detector = yield* ChangeDetector;
				// If the detector forgot `relative: true`, this would be
				// ["outside/tooling.ts", "repo/packages/alpha/src/index.ts"].
				assert.deepStrictEqual(yield* detector.changedFiles(), ["packages/alpha/src/index.ts"]);
			}),
		);

		it.effect("changedPackages resolves the owning package from the relative path", () =>
			Effect.gen(function* () {
				const detector = yield* ChangeDetector;
				const names = (yield* detector.changedPackages()).map((pkg) => pkg.name);
				// A repository-relative path joined onto the workspace root yields
				// /repo/repo/packages/alpha/... — which owns nothing. Silent and wrong.
				assert.deepStrictEqual(names, ["@x/alpha"]);
			}),
		);

		it.effect("affectedPackages walks the reverse graph from the correctly-resolved package", () =>
			Effect.gen(function* () {
				const detector = yield* ChangeDetector;
				const names = (yield* detector.affectedPackages()).map((pkg) => pkg.name).sort();
				assert.deepStrictEqual(names, ["@x/alpha", "@x/beta", "@x/web"]);
			}),
		);
	});
});
