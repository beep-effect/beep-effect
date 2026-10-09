// @effect-diagnostics strictEffectProvide:skip-file nodeBuiltinImport:skip-file asyncFunction:skip-file processEnv:skip-file
// Proves the Task 3-6 surface additions (nameStatus, the promoted working-tree
// primitives, the quiet probes, commitInfo/status, and the mutating tier)
// against a REAL git binary and a real filesystem, through
// @effect/platform-node's NodeServices.layer. ../Git.int.test.ts remains the
// authority for the ORIGINAL surface (show/lsTree/refExists/mergeBase/
// changedFiles/workingChanges/revParse/checkout) and the runCollected
// backpressure guard; this file is the only place the expanded surface meets
// real git.
//
// Two fixtures, each in their own mkdtemp dir removed in afterAll:
//  - Fixture A: a single introspection repository with a rename, a modified
//    file, a staged addition and an untracked file, exercising the read tier.
//  - Fixture B: a "library" repo and a "superproject" repo, exercising the
//    mutating tier (submoduleAdd, add, fetch, checkout --detach,
//    sparseCheckoutSet, submoduleUpdate) against a local file:// remote.
//
// git >= 2.38 blocks file-protocol submodules unless protocol.file.allow is
// set to "always" — the superproject (and any clone of it) sets that BEFORE
// the submodule operation that would otherwise be refused.

import { mkdir, mkdtemp, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { afterAll, assert, beforeAll, describe, it } from "@effect/vitest";
import { Cause, DateTime, Effect, Exit, Layer, Option, Result, Schema } from "effect";
import type { ChildProcessSpawner } from "effect/process";
import { ChildProcess } from "effect/process";
import { Git, NotARepositoryError, UnknownRefError } from "../../../effected/git/Git.ts";
import { runCollected } from "../../../effected/git/internal/run.ts";

/** Resolves both `Git` and every Node platform service (including the real `ChildProcessSpawner`). */
const TestLayer = Git.layer.pipe(Layer.provideMerge(NodeServices.layer));

const run = <A, E>(effect: Effect.Effect<A, E, Git | ChildProcessSpawner.ChildProcessSpawner>) =>
	effect.pipe(Effect.provide(TestLayer));

/** The locale and prompt pins the `Git` service applies to its own spawns (#670). */
const FIXTURE_ENV = { LC_ALL: "C", GIT_TERMINAL_PROMPT: "0" } as const;

// git >= 2.38 (CVE-2022-39253) refuses a file:// submodule remote unless
// explicitly allowed. Probed against the installed git (2.54.0): a repo-local
// `git config protocol.file.allow always` on the superproject does NOT reach
// `git submodule add`'s internal clone subprocess — only a command-line `-c`,
// the environment, or global config do. The `Git` service's per-call env pins
// (applied at its spawn choke point, over `extendEnv: true`) merge with
// `process.env`, so setting it here on the running test process reaches every
// spawn in this file, including the real `Git` service's own
// submoduleAdd/fetch/sparseCheckoutSet calls. The fixtures below also set the
// repo-local config, matching the documented mutating-tier contract, but it is
// this environment variable that actually authorizes the file-protocol
// clone/fetch on this git version.
process.env.GIT_ALLOW_PROTOCOL = "file";

/**
 * Runs one raw `git` invocation for fixture setup — the operations that are
 * deliberately NOT part of the `Git` surface (init, config, add, commit,
 * branch, tag, mv, clone, remote, update-ref, symbolic-ref). Dies loudly
 * (never cascades as a passed test) if git itself could not be spawned, or if
 * it ran and exited non-zero.
 */
const runFixtureGit = (
	cwd: string,
	args: ReadonlyArray<string>,
): Effect.Effect<string, never, ChildProcessSpawner.ChildProcessSpawner> =>
	runCollected(ChildProcess.setCwd(ChildProcess.make("git", args, { env: FIXTURE_ENV, extendEnv: true }), cwd)).pipe(
		Effect.orDie,
		Effect.flatMap((result) =>
			result.exitCode === 0
				? Effect.succeed(result.stdout)
				: Effect.die(
						new Error(
							`fixture setup failed: git ${args.join(" ")} in ${cwd} (exit ${result.exitCode}): ${result.stderr}`,
						),
					),
		),
	);

/** Confirms a path exists on the real FS — dies (via the rejected promise) if it does not. */
const assertExists = (path: string): Effect.Effect<void> => Effect.promise(() => stat(path)).pipe(Effect.asVoid);

// The `Git` service probes `ssh.variant` before every network-touching member,
// and that read is a MERGED config read — so without this it reaches the
// developer's or runner's own global git config. A machine with a global
// `ssh.variant` outside `auto`/`ssh` would decline the ssh pin and fail the
// assertions below with a message that says nothing about why. Pointing both
// config scopes at /dev/null makes every git spawn in this file see only the
// repository config its fixture wrote. Safe here because the fixtures pin
// everything they depend on locally, including `init.defaultBranch`.
const HOST_CONFIG_KEYS = ["GIT_CONFIG_GLOBAL", "GIT_CONFIG_SYSTEM"] as const;
const hostConfig = new Map<string, string | undefined>();

beforeAll(() => {
	for (const key of HOST_CONFIG_KEYS) {
		hostConfig.set(key, process.env[key]);
		process.env[key] = "/dev/null";
	}
});

afterAll(() => {
	for (const key of HOST_CONFIG_KEYS) {
		const previous = hostConfig.get(key);
		if (previous === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = previous;
		}
	}
});

describe("Git surface — introspection repository (fixture A)", () => {
	let dirA: string;
	let commit1Sha: string;

	/**
	 * commit1 = a.txt ("one") + sub/c.txt ("c"); then sub/c.txt is renamed to
	 * renamed.txt, a.txt is modified, staged.txt is staged new, and
	 * untracked.txt is left untracked — every stage of the working tree in one
	 * fixture.
	 */
	beforeAll(async () => {
		dirA = await mkdtemp(join(tmpdir(), "effected-git-surface-a-"));
		commit1Sha = await Effect.runPromise(
			run(
				Effect.gen(function* () {
					const raw = (args: ReadonlyArray<string>) => runFixtureGit(dirA, args);

					yield* raw(["-c", "init.defaultBranch=main", "init"]);
					yield* raw(["config", "user.email", "git-integration@example.com"]);
					yield* raw(["config", "user.name", "Git Integration"]);

					yield* Effect.promise(() => writeFile(join(dirA, "a.txt"), "one\n"));
					yield* Effect.promise(() => mkdir(join(dirA, "sub"), { recursive: true }));
					yield* Effect.promise(() => writeFile(join(dirA, "sub", "c.txt"), "c\n"));
					yield* raw(["add", "-A"]);
					yield* raw(["-c", "commit.gpgsign=false", "commit", "-m", "commit1"]);
					const commit1 = (yield* raw(["rev-parse", "HEAD"])).trim();

					yield* raw(["mv", "sub/c.txt", "renamed.txt"]);
					yield* Effect.promise(() => writeFile(join(dirA, "a.txt"), "two\n"));
					yield* Effect.promise(() => writeFile(join(dirA, "staged.txt"), "staged\n"));
					yield* raw(["add", "staged.txt"]);
					yield* Effect.promise(() => writeFile(join(dirA, "untracked.txt"), "loose\n"));

					return commit1;
				}),
			),
		);
	}, 30_000);

	afterAll(async () => {
		if (dirA !== "") await rm(dirA, { recursive: true, force: true });
	});

	it.effect("nameStatus (working-tree form) reports modify, rename and add with typed statuses", () =>
		run(
			Effect.gen(function* () {
				const git = yield* Git;
				const entries = yield* git.nameStatus(dirA, { base: "HEAD" });

				const modified = entries.find((entry) => entry.path === "a.txt");
				assert.isDefined(modified);
				assert.strictEqual(modified?.status, "modified");

				const renamed = entries.find((entry) => entry.path === "renamed.txt");
				assert.isDefined(renamed);
				assert.strictEqual(renamed?.status, "renamed");
				assert.strictEqual(renamed?.oldPath, "sub/c.txt");

				const added = entries.find((entry) => entry.path === "staged.txt");
				assert.isDefined(added);
				assert.strictEqual(added?.status, "added");

				// untracked.txt never appears in a diff.
				assert.isUndefined(entries.find((entry) => entry.path === "untracked.txt"));
			}),
		),
	);

	it.effect("the promoted primitives partition the working tree", () =>
		run(
			Effect.gen(function* () {
				const git = yield* Git;
				const unstaged = yield* git.unstagedChanges(dirA);
				const staged = yield* git.stagedChanges(dirA);
				const untracked = yield* git.untrackedFiles(dirA);

				assert.include(unstaged, "a.txt");
				assert.include(staged, "staged.txt");
				// --name-only reports only the NEW path for a staged rename (unlike
				// --name-status's three-token form, which carries the old path too) —
				// probed against real git; "the rename pair" is visible via nameStatus
				// above, not through this name-only primitive.
				assert.include(staged, "renamed.txt");
				assert.notInclude(staged, "sub/c.txt");
				assert.deepStrictEqual(untracked, ["untracked.txt"]);
			}),
		),
	);

	it.effect("status --porcelain reports the same tree with XY codes", () =>
		run(
			Effect.gen(function* () {
				const git = yield* Git;
				const entries = yield* git.status(dirA);

				const untrackedEntry = entries.find((entry) => entry.path === "untracked.txt");
				assert.isDefined(untrackedEntry);
				assert.strictEqual(untrackedEntry?.x, "?");
				assert.strictEqual(untrackedEntry?.y, "?");

				const renamedEntry = entries.find((entry) => entry.path === "renamed.txt");
				assert.isDefined(renamedEntry);
				assert.strictEqual(renamedEntry?.x, "R");
				assert.strictEqual(renamedEntry?.origPath, "sub/c.txt");
			}),
		),
	);

	it.effect("lsTree with a pathspec narrows to the subtree", () =>
		run(
			Effect.gen(function* () {
				const git = yield* Git;
				const entries = yield* git.lsTree(dirA, commit1Sha, { pathspec: ["sub"] });
				assert.deepStrictEqual(
					entries.map((entry) => entry.path),
					["sub/c.txt"],
				);
			}),
		),
	);

	it.effect("configGet reads what configSet wrote, and -f writes into an explicit file", () =>
		run(
			Effect.gen(function* () {
				const git = yield* Git;

				yield* git.configSet(dirA, "test.kit", "yes");
				assert.deepStrictEqual(yield* git.configGet(dirA, "test.kit"), Option.some("yes"));
				assert.deepStrictEqual(yield* git.configGet(dirA, "test.unset"), Option.none());

				yield* git.configSet(dirA, "submodule.x.shallow", "true", { file: "modcfg" });
				const written = yield* runFixtureGit(dirA, ["config", "-f", "modcfg", "--get", "submodule.x.shallow"]);
				assert.strictEqual(written.trim(), "true");
			}),
		),
	);

	it.effect("remoteUrl is none before a remote exists and some after", () =>
		run(
			Effect.gen(function* () {
				const git = yield* Git;
				assert.deepStrictEqual(yield* git.remoteUrl(dirA), Option.none());

				yield* runFixtureGit(dirA, ["remote", "add", "origin", "https://example.com/o/r.git"]);
				assert.deepStrictEqual(yield* git.remoteUrl(dirA), Option.some("https://example.com/o/r.git"));
			}),
		),
	);

	it.effect("defaultBranch is none until origin/HEAD is set symbolically", () =>
		run(
			Effect.gen(function* () {
				const git = yield* Git;
				assert.deepStrictEqual(yield* git.defaultBranch(dirA), Option.none());

				yield* runFixtureGit(dirA, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
				yield* runFixtureGit(dirA, ["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main"]);

				assert.deepStrictEqual(yield* git.defaultBranch(dirA), Option.some("main"));
			}),
		),
	);

	it.effect("currentBranch names the branch, and repoRoot agrees with rev-parse", () =>
		run(
			Effect.gen(function* () {
				const git = yield* Git;
				assert.deepStrictEqual(yield* git.currentBranch(dirA), Option.some("main"));

				const root = yield* git.repoRoot(dirA);
				const expected = (yield* runFixtureGit(dirA, ["rev-parse", "--show-toplevel"])).trim();
				assert.strictEqual(root, expected);
			}),
		),
	);

	it.effect("commitInfo reads HEAD's sha, N signature and exact message", () =>
		run(
			Effect.gen(function* () {
				const git = yield* Git;
				const info = yield* git.commitInfo(dirA);
				const sha = yield* git.revParse(dirA, "HEAD");

				assert.strictEqual(info.sha, sha);
				// The fixture's commits are never signed.
				assert.strictEqual(info.signatureStatus, "N");
				// Raw %B output is byte-identical to commitInfo's untrimmed message —
				// a trim or mutation anywhere in the pipeline breaks this equality.
				const expectedMessage = yield* runFixtureGit(dirA, ["log", "-1", "--format=%B"]);
				assert.strictEqual(info.message, expectedMessage);
			}),
		),
	);
});

describe("Git surface — submodule/fetch pair (fixture B)", () => {
	let libDir: string;
	let superDir: string;
	let libTagSha: string;

	/** The submodule's working copy, once `submoduleAdd` has vendored it. */
	const subDir = () => join(superDir, "vendor", "lib");

	/**
	 * "library" = a one-commit repo on `main`, tagged `v1.0.0`. "superproject" =
	 * an empty repo with `protocol.file.allow always` set BEFORE any submodule
	 * operation — git >= 2.38 refuses a file:// submodule otherwise.
	 */
	beforeAll(async () => {
		libDir = await mkdtemp(join(tmpdir(), "effected-git-surface-lib-"));
		superDir = await mkdtemp(join(tmpdir(), "effected-git-surface-super-"));
		libTagSha = await Effect.runPromise(
			run(
				Effect.gen(function* () {
					const rawLib = (args: ReadonlyArray<string>) => runFixtureGit(libDir, args);
					const rawSuper = (args: ReadonlyArray<string>) => runFixtureGit(superDir, args);

					yield* rawLib(["-c", "init.defaultBranch=main", "init"]);
					yield* rawLib(["config", "user.email", "git-integration@example.com"]);
					yield* rawLib(["config", "user.name", "Git Integration"]);
					yield* Effect.promise(() => writeFile(join(libDir, "lib.txt"), "library\n"));
					yield* rawLib(["add", "-A"]);
					yield* rawLib(["-c", "commit.gpgsign=false", "commit", "-m", "lib commit"]);
					yield* rawLib(["tag", "v1.0.0"]);
					const tagSha = (yield* rawLib(["rev-parse", "v1.0.0"])).trim();

					yield* rawSuper(["-c", "init.defaultBranch=main", "init"]);
					yield* rawSuper(["config", "user.email", "git-integration@example.com"]);
					yield* rawSuper(["config", "user.name", "Git Integration"]);
					yield* rawSuper(["config", "protocol.file.allow", "always"]);

					return tagSha;
				}),
			),
		);
	}, 30_000);

	afterAll(async () => {
		if (libDir !== "") await rm(libDir, { recursive: true, force: true });
		if (superDir !== "") await rm(superDir, { recursive: true, force: true });
	});

	// Sequential, order-dependent stages against the same superproject: add
	// vendors the submodule, fetch+checkout pin it to a tag, a bad fetch fails
	// typed, and sparse-checkout narrows its tree — each stage builds on the
	// last, mirroring the brief's scenario-grouped-its style.

	it.effect(
		"submoduleAdd vendors the library and add stages the result",
		() =>
			run(
				Effect.gen(function* () {
					const git = yield* Git;
					// No depth: local-path clones ignore/warn on --depth; the depth argv
					// is already unit-tested.
					yield* git.submoduleAdd(superDir, { url: libDir, path: "vendor/lib" });
					yield* assertExists(join(subDir(), "lib.txt"));

					yield* git.add(superDir, [".gitmodules", "vendor/lib"]);
					const entries = yield* git.status(superDir);

					const gitmodules = entries.find((entry) => entry.path === ".gitmodules");
					assert.isDefined(gitmodules);
					assert.strictEqual(gitmodules?.x, "A");

					const vendorLib = entries.find((entry) => entry.path === "vendor/lib");
					assert.isDefined(vendorLib);
					assert.strictEqual(vendorLib?.x, "A");
				}),
			),
		20_000,
	);

	it.effect("fetch tag + checkout --detach pins the submodule, currentBranch reads none", () =>
		run(
			Effect.gen(function* () {
				const git = yield* Git;
				yield* git.fetch(subDir(), { ref: "v1.0.0", tag: true });
				yield* git.checkout(subDir(), "FETCH_HEAD", { detach: true });

				assert.deepStrictEqual(yield* git.currentBranch(subDir()), Option.none());
				assert.strictEqual(yield* git.revParse(subDir(), "HEAD"), libTagSha);
			}),
		),
	);

	it.effect("fetch of a tag the remote does not have fails typed", () =>
		run(
			Effect.gen(function* () {
				const git = yield* Git;
				const exit = yield* Effect.exit(git.fetch(subDir(), { ref: "v9.9.9", tag: true }));
				assert.isTrue(Exit.isFailure(exit));
				if (Exit.isFailure(exit)) {
					// Cause.failureOption does not exist at beta.98 — findFail returns a Result.
					const found = Cause.findFail(exit.cause);
					assert.isTrue(Result.isSuccess(found) && Schema.is(UnknownRefError)(found.success.error));
				}
			}),
		),
	);

	it.effect("sparseCheckoutSet --no-cone narrows the submodule's tree", () =>
		run(
			Effect.gen(function* () {
				const git = yield* Git;
				yield* git.sparseCheckoutSet(subDir(), ["src"], { cone: false });
				assert.deepStrictEqual(yield* git.configGet(subDir(), "core.sparseCheckout"), Option.some("true"));
				// The narrowing must be real, not just configured: lib.txt sits at the
				// tree root, outside the "src" pattern, so it leaves the working tree.
				const libGone = yield* Effect.promise(() =>
					stat(join(subDir(), "lib.txt")).then(
						() => false,
						() => true,
					),
				);
				assert.isTrue(libGone);
			}),
		),
	);

	describe("a fresh clone", () => {
		let cloneDir: string;

		beforeAll(async () => {
			// The superproject needs a commit between add and clone so the clone
			// has something to check out — fixture setup, so raw, not the service.
			await Effect.runPromise(
				run(runFixtureGit(superDir, ["-c", "commit.gpgsign=false", "commit", "-m", "vendor lib"])),
			);
			cloneDir = await mkdtemp(join(tmpdir(), "effected-git-surface-clone-"));
			await Effect.runPromise(run(runFixtureGit(tmpdir(), ["clone", superDir, cloneDir])));
			// Any clone needs protocol.file.allow set BEFORE submoduleUpdate --init too.
			await Effect.runPromise(run(runFixtureGit(cloneDir, ["config", "protocol.file.allow", "always"])));
		}, 30_000);

		afterAll(async () => {
			if (cloneDir !== "") await rm(cloneDir, { recursive: true, force: true });
		});

		it.effect(
			"a fresh clone materializes the submodule via submoduleUpdate --init",
			() =>
				run(
					Effect.gen(function* () {
						const git = yield* Git;
						yield* git.submoduleUpdate(cloneDir, { init: true, paths: ["vendor/lib"] });
						yield* assertExists(join(cloneDir, "vendor", "lib", "lib.txt"));
					}),
				),
			20_000,
		);
	});
});

// Fixture C is `Git.log`'s own: it is the only member whose answer depends on
// the SHAPE of history rather than one tree, so it needs a repository with a
// rename across the scoped path, an off-pathspec commit, and a real merge.
// A mock spawner can pin the parser; only real git can tell us whether
// `--follow` actually walks the rename and whether `--diff-merges` actually
// changes what a merge contributes.
describe("Git.log — history repository (fixture C)", () => {
	let dirC: string;
	let emptyDir: string;

	/**
	 * main:  c1 (tracked/old.txt + other.txt)
	 *     -> c2 (tracked/old.txt renamed to tracked/new.txt)
	 *     -> c3 (other.txt only — the off-pathspec commit)
	 *     -> c4 (main edits tracked/new.txt)   \
	 *        side branched at c2, also edits it -> merge (conflict, resolved)
	 */
	beforeAll(async () => {
		dirC = await mkdtemp(join(tmpdir(), "effected-git-log-c-"));
		emptyDir = await mkdtemp(join(tmpdir(), "effected-git-log-empty-"));
		await Effect.runPromise(
			run(
				Effect.gen(function* () {
					const raw = (args: ReadonlyArray<string>) => runFixtureGit(dirC, args);
					const commit = (message: string) => raw(["-c", "commit.gpgsign=false", "commit", "-m", message]);

					yield* raw(["-c", "init.defaultBranch=main", "init"]);
					yield* raw(["config", "user.email", "log-integration@example.com"]);
					yield* raw(["config", "user.name", "Log Integration"]);

					yield* Effect.promise(() => mkdir(join(dirC, "tracked"), { recursive: true }));
					yield* Effect.promise(() => writeFile(join(dirC, "tracked", "old.txt"), "one\n"));
					yield* Effect.promise(() => writeFile(join(dirC, "other.txt"), "other\n"));
					// A path with a space, to prove -z leaves names unquoted.
					yield* Effect.promise(() => writeFile(join(dirC, "a name.txt"), "spaced\n"));
					yield* raw(["add", "-A"]);
					yield* commit("c1");

					yield* raw(["mv", "tracked/old.txt", "tracked/new.txt"]);
					yield* commit("c2");
					const branchPoint = (yield* raw(["rev-parse", "HEAD"])).trim();

					yield* Effect.promise(() => writeFile(join(dirC, "other.txt"), "other again\n"));
					yield* raw(["add", "-A"]);
					yield* commit("c3");

					yield* Effect.promise(() => writeFile(join(dirC, "tracked", "new.txt"), "main\n"));
					yield* raw(["add", "-A"]);
					yield* commit("c4");

					yield* raw(["checkout", "-b", "side", branchPoint]);
					yield* Effect.promise(() => writeFile(join(dirC, "tracked", "new.txt"), "side\n"));
					yield* raw(["add", "-A"]);
					yield* commit("side");

					yield* raw(["checkout", "main"]);
					// The merge conflicts on purpose; the resolution is what makes the
					// merge commit differ from its first parent.
					yield* runCollected(
						ChildProcess.setCwd(
							ChildProcess.make("git", ["merge", "side"], { env: FIXTURE_ENV, extendEnv: true }),
							dirC,
						),
					).pipe(Effect.orDie);
					yield* Effect.promise(() => writeFile(join(dirC, "tracked", "new.txt"), "resolved\n"));
					yield* raw(["add", "-A"]);
					yield* commit("merge side");

					yield* runFixtureGit(emptyDir, ["-c", "init.defaultBranch=main", "init"]);
				}),
			),
		);
	}, 60_000);

	afterAll(async () => {
		if (dirC !== "") await rm(dirC, { recursive: true, force: true });
		if (emptyDir !== "") await rm(emptyDir, { recursive: true, force: true });
	});

	it.effect("--follow walks a real rename; the same query without it stops at the rename", () =>
		run(
			Effect.gen(function* () {
				const git = yield* Git;
				const followed = yield* git.log(dirC, { paths: ["tracked/new.txt"], follow: true });
				const unfollowed = yield* git.log(dirC, { paths: ["tracked/new.txt"] });

				// The discriminating pair: `--follow` reaches back past c2's rename to
				// c1, where the blob was still tracked/old.txt. Without it, history
				// for this path begins at the rename. Note this is NOT a
				// longer-vs-shorter comparison — `--follow` also drops merge commits
				// (probed against git 2.54), so the two walks are the same LENGTH here
				// and only their contents discriminate.
				assert.include(
					followed.flatMap((entry) => entry.paths),
					"tracked/old.txt",
				);
				assert.notInclude(
					unfollowed.flatMap((entry) => entry.paths),
					"tracked/old.txt",
				);
				// ...and the merge, present unfollowed, is gone under --follow.
				const merged = unfollowed.find((entry) => entry.paths.length === 0);
				assert.isDefined(merged);
				assert.isUndefined(followed.find((entry) => entry.sha === merged?.sha));
			}),
		),
	);

	it.effect("a pathspec scopes the walk — an off-pathspec commit never appears", () =>
		run(
			Effect.gen(function* () {
				const git = yield* Git;
				const scoped = yield* git.log(dirC, { paths: ["other.txt"] });
				const everything = yield* git.log(dirC);

				assert.isTrue(scoped.length < everything.length);
				// Every scoped entry touched other.txt and nothing that is not it.
				for (const entry of scoped) {
					assert.deepStrictEqual(entry.paths, ["other.txt"]);
				}
				// The control: c2's rename IS in the unscoped walk, so the absence
				// above is scoping rather than an empty query.
				assert.include(
					everything.flatMap((entry) => entry.paths),
					"tracked/new.txt",
				);
			}),
		),
	);

	it.effect("firstParentDiffMerges is what gives a merge commit any paths at all", () =>
		run(
			Effect.gen(function* () {
				const git = yield* Git;
				const plain = yield* git.log(dirC, { paths: ["tracked/new.txt"], limit: 1 });
				const firstParent = yield* git.log(dirC, {
					paths: ["tracked/new.txt"],
					limit: 1,
					firstParentDiffMerges: true,
				});

				// Same commit both times — the merge — but git omits a merge's diff by
				// default, so the entry's path list is empty until we ask for the
				// first-parent diff.
				assert.strictEqual(plain[0]?.sha, firstParent[0]?.sha);
				assert.deepStrictEqual(plain[0]?.paths, []);
				assert.deepStrictEqual(firstParent[0]?.paths, ["tracked/new.txt"]);
			}),
		),
	);

	it.effect("entries arrive newest-first with real, ordered, decoded dates", () =>
		run(
			Effect.gen(function* () {
				const git = yield* Git;
				const entries = yield* git.log(dirC);
				assert.isTrue(entries.length >= 5);
				for (let index = 1; index < entries.length; index++) {
					const newer = entries[index - 1];
					const older = entries[index];
					assert.isDefined(newer);
					assert.isDefined(older);
					if (newer === undefined || older === undefined) continue;
					assert.isTrue(DateTime.toEpochMillis(newer.committedAt) >= DateTime.toEpochMillis(older.committedAt));
				}
				assert.strictEqual(entries[0]?.authorEmail, "log-integration@example.com");
			}),
		),
	);

	it.effect("limit caps the walk, and limit 0 is the empty listing", () =>
		run(
			Effect.gen(function* () {
				const git = yield* Git;
				assert.strictEqual((yield* git.log(dirC, { limit: 2 })).length, 2);
				assert.deepStrictEqual(yield* git.log(dirC, { limit: 0 }), []);
			}),
		),
	);

	it.effect("a path with a space comes back raw, never C-quoted", () =>
		run(
			Effect.gen(function* () {
				const git = yield* Git;
				const entries = yield* git.log(dirC, { paths: ["a name.txt"], follow: true });
				assert.deepStrictEqual(entries.at(-1)?.paths, ["a name.txt"]);
			}),
		),
	);

	it.effect("an unborn HEAD is the empty listing against real git, not a failure", () =>
		run(
			Effect.gen(function* () {
				const git = yield* Git;
				assert.deepStrictEqual(yield* git.log(emptyDir), []);
			}),
		),
	);

	it.effect("a directory that is not a repository still fails NotARepositoryError", () =>
		run(
			Effect.gen(function* () {
				const git = yield* Git;
				const error = yield* Effect.flip(git.log(tmpdir()));
				assert.isTrue(Schema.is(NotARepositoryError)(error));
			}),
		),
	);
});

describe("Git surface — repository identity across worktrees (commonDir)", () => {
	let base: string;
	let main: string;
	let worktree: string;
	let linked: string;
	let bare: string;
	let spaced: string;
	let outside: string;

	/**
	 * A repository with a subdirectory and one linked worktree, a directory
	 * symlink onto the repository, a bare repository, and a plain directory.
	 * `base` is the UNRESOLVED tmpdir path, so on macOS every cwd below sits
	 * behind the `/var` -> `/private/var` link, and `linked` adds an explicit
	 * symlink so the same trap is exercised on Linux, whose tmpdir is real.
	 */
	beforeAll(async () => {
		base = await mkdtemp(join(tmpdir(), "effected-git-common-dir-"));
		main = join(base, "main");
		worktree = join(base, "worktree");
		linked = join(base, "linked");
		bare = join(base, "bare.git");
		spaced = join(base, "spaced.git ");
		outside = join(base, "outside");
		await mkdir(join(main, "sub"), { recursive: true });
		await mkdir(outside);
		await Effect.runPromise(
			run(
				Effect.gen(function* () {
					yield* runFixtureGit(main, ["-c", "init.defaultBranch=main", "init"]);
					yield* runFixtureGit(main, [
						"-c",
						"user.email=git-integration@example.com",
						"-c",
						"user.name=Git Integration",
						"-c",
						"commit.gpgsign=false",
						"commit",
						"--allow-empty",
						"-m",
						"init",
					]);
					yield* runFixtureGit(main, ["worktree", "add", "-b", "side", worktree]);
					yield* runFixtureGit(base, ["init", "--bare", bare]);
					yield* runFixtureGit(base, ["init", "--bare", spaced]);
				}),
			),
		);
		await symlink(main, linked, "dir");
	});

	afterAll(async () => {
		await rm(base, { recursive: true, force: true });
	});

	it.effect("answers one realpath'd directory from the checkout, a subdirectory, a worktree and a symlink", () =>
		run(
			Effect.gen(function* () {
				const git = yield* Git;
				const expected = yield* Effect.promise(() => realpath(join(main, ".git")));
				for (const cwd of [main, join(main, "sub"), worktree, linked, join(linked, "sub")]) {
					assert.strictEqual(yield* git.commonDir(cwd), expected, cwd);
				}
			}),
		),
	);

	it.effect("answers the repository directory itself for a bare repository", () =>
		run(
			Effect.gen(function* () {
				const git = yield* Git;
				assert.strictEqual(yield* git.commonDir(bare), yield* Effect.promise(() => realpath(bare)));
			}),
		),
	);

	it.effect("keeps a trailing space that belongs to the repository path", () =>
		run(
			Effect.gen(function* () {
				const git = yield* Git;
				const answer = yield* git.commonDir(spaced);
				assert.strictEqual(answer, yield* Effect.promise(() => realpath(spaced)));
				assert.isTrue(answer.endsWith(" "));
			}),
		),
	);

	it.effect("fails NotARepositoryError outside any repository", () =>
		run(
			Effect.gen(function* () {
				const git = yield* Git;
				const failure = yield* Effect.flip(git.commonDir(outside));
				assert.instanceOf(failure, NotARepositoryError);
			}),
		),
	);
});
