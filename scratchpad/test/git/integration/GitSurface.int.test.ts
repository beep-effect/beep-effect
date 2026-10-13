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

import { $ScratchpadId } from "@beep/identity/packages";
import { NodeServices } from "@effect/platform-node";
import { afterAll, assert, beforeAll, describe, it } from "@effect/vitest";
import { assertExitFailure, assertNone, assertSome, assertSuccess } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Scope from "effect/Scope";
import * as Str from "effect/String";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import { Git, NotARepositoryError, UnknownRefError } from "../../../effected/git/Git.ts";
import { runCollected } from "../../../effected/git/internal/run.ts";

const $I = $ScratchpadId.create("effected/git/GitSurface.int.test");

class FixtureSetupError extends S.TaggedError<FixtureSetupError>($I`FixtureSetupError`)(
	"FixtureSetupError",
	{ message: S.String.annotate({ description: "The failing Git invocation, exit code and stderr." }) },
	$I.annote("FixtureSetupError", { description: "A real Git fixture command exited unsuccessfully." }),
) {}

/** Pins fixture configuration at the real spawner boundary without changing the host environment. */
const FixtureServices = Layer.effect(
	ChildProcessSpawner.ChildProcessSpawner,
	Effect.gen(function* () {
		const real = yield* ChildProcessSpawner.ChildProcessSpawner;
		return ChildProcessSpawner.make((command) =>
			real.spawn(
				ChildProcess.setEnv(command, {
					GIT_ALLOW_PROTOCOL: "file",
					GIT_CONFIG_GLOBAL: "/dev/null",
					GIT_CONFIG_SYSTEM: "/dev/null",
				}),
			),
		);
	}),
).pipe(Layer.provideMerge(NodeServices.layer));

/** One scoped context serves the fixture hooks and the real Git tests throughout this file. */
const TestLayer = Git.layer.pipe(Layer.provideMerge(FixtureServices));
let testScope: Scope.Closeable;
let testContext: Context.Context<Git | NodeServices.NodeServices>;
let fs: FileSystem.FileSystem;
let path: Path.Path;
let tempDir = "";
const join = (...parts: ReadonlyArray<string>) => path.join(...parts);
const run = <A, E>(effect: Effect.Effect<A, E, Git | NodeServices.NodeServices>) =>
	Effect.provideContext(effect, testContext);
const SharedTestLayer = Layer.unwrap(Effect.sync(() => Layer.succeedContext(testContext)));

beforeAll(() =>
	Effect.gen(function* () {
		testScope = yield* Scope.make();
		testContext = yield* Layer.buildWithScope(TestLayer, testScope);
		fs = Context.get(testContext, FileSystem.FileSystem);
		path = Context.get(testContext, Path.Path);
		tempDir = yield* fs.makeTempDirectory({ prefix: "effected-git-suite-" });
		yield* Scope.addFinalizer(testScope, fs.remove(tempDir, { recursive: true, force: true }).pipe(Effect.orDie));
	}).pipe(Effect.runPromise),
);
afterAll(() => Scope.close(testScope, Exit.void).pipe(Effect.runPromise));

/** The locale and prompt pins the `Git` service applies to its own spawns (#670). */
const FIXTURE_ENV = { LC_ALL: "C", GIT_TERMINAL_PROMPT: "0" } as const;

// A repo-local protocol.file.allow does not reach submodule add's internal clone.
// The real spawner supplies GIT_ALLOW_PROTOCOL=file to Git and its subprocesses.

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
						FixtureSetupError.make({
							message: `fixture setup failed: git ${A.join(args, " ")} in ${cwd} (exit ${result.exitCode}): ${result.stderr}`,
						}),
					),
		),
	);

/** Confirms a path exists on the real FS — dies with the platform error if it does not. */
const assertExists = (file: string) => fs.stat(file).pipe(Effect.asVoid, Effect.orDie);

it.layer(SharedTestLayer, { timeout: "30 seconds" })("Git surface — introspection repository (fixture A)", (it) => {
	let dirA = "";
	let commit1Sha = "";

	/**
	 * commit1 = a.txt ("one") + sub/c.txt ("c"); then sub/c.txt is renamed to
	 * renamed.txt, a.txt is modified, staged.txt is staged new, and
	 * untracked.txt is left untracked — every stage of the working tree in one
	 * fixture.
	 */
	beforeAll(
		() =>
			Effect.gen(function* () {
				dirA = yield* fs.makeTempDirectory({ directory: tempDir, prefix: "effected-git-surface-a-" });

				const raw = (args: ReadonlyArray<string>) => runFixtureGit(dirA, args);

				yield* raw(["-c", "init.defaultBranch=main", "init"]);
				yield* raw(["config", "user.email", "git-integration@example.com"]);
				yield* raw(["config", "user.name", "Git Integration"]);

				yield* fs.writeFileString(join(dirA, "a.txt"), "one\n");
				yield* fs.makeDirectory(join(dirA, "sub"), { recursive: true });
				yield* fs.writeFileString(join(dirA, "sub", "c.txt"), "c\n");
				yield* raw(["add", "-A"]);
				yield* raw(["-c", "commit.gpgsign=false", "commit", "-m", "commit1"]);
				const commit1 = (yield* raw(["rev-parse", "HEAD"])).trim();

				yield* raw(["mv", "sub/c.txt", "renamed.txt"]);
				yield* fs.writeFileString(join(dirA, "a.txt"), "two\n");
				yield* fs.writeFileString(join(dirA, "staged.txt"), "staged\n");
				yield* raw(["add", "staged.txt"]);
				yield* fs.writeFileString(join(dirA, "untracked.txt"), "loose\n");

				commit1Sha = commit1;
			}).pipe(run, Effect.runPromise),
		30_000,
	);

	afterAll(() =>
		Effect.gen(function* () {
			if (dirA !== "") yield* fs.remove(dirA, { recursive: true, force: true });
		}).pipe(run, Effect.runPromise),
	);

	it.effect("nameStatus (working-tree form) reports modify, rename and add with typed statuses", () =>
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
	);

	it.effect("the promoted primitives partition the working tree", () =>
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
	);

	it.effect("status --porcelain reports the same tree with XY codes", () =>
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
	);

	it.effect("lsTree with a pathspec narrows to the subtree", () =>
		Effect.gen(function* () {
			const git = yield* Git;
			const entries = yield* git.lsTree(dirA, commit1Sha, { pathspec: ["sub"] });
			assert.deepStrictEqual(
				entries.map((entry) => entry.path),
				["sub/c.txt"],
			);
		}),
	);

	it.effect("configGet reads what configSet wrote, and -f writes into an explicit file", () =>
		Effect.gen(function* () {
			const git = yield* Git;

			yield* git.configSet(dirA, "test.kit", "yes");
			assertSome(yield* git.configGet(dirA, "test.kit"), "yes");
			assertNone(yield* git.configGet(dirA, "test.unset"));

			yield* git.configSet(dirA, "submodule.x.shallow", "true", { file: "modcfg" });
			const written = yield* runFixtureGit(dirA, ["config", "-f", "modcfg", "--get", "submodule.x.shallow"]);
			assert.strictEqual(Str.trim(written), "true");
		}),
	);

	it.effect("remoteUrl is none before a remote exists and some after", () =>
		Effect.gen(function* () {
			const git = yield* Git;
			assertNone(yield* git.remoteUrl(dirA));

			yield* runFixtureGit(dirA, ["remote", "add", "origin", "https://example.com/o/r.git"]);
			assertSome(yield* git.remoteUrl(dirA), "https://example.com/o/r.git");
		}),
	);

	it.effect("defaultBranch is none until origin/HEAD is set symbolically", () =>
		Effect.gen(function* () {
			const git = yield* Git;
			assertNone(yield* git.defaultBranch(dirA));

			yield* runFixtureGit(dirA, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
			yield* runFixtureGit(dirA, ["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main"]);

			assertSome(yield* git.defaultBranch(dirA), "main");
		}),
	);

	it.effect("currentBranch names the branch, and repoRoot agrees with rev-parse", () =>
		Effect.gen(function* () {
			const git = yield* Git;
			assertSome(yield* git.currentBranch(dirA), "main");

			const root = yield* git.repoRoot(dirA);
			const expected = (yield* runFixtureGit(dirA, ["rev-parse", "--show-toplevel"])).trim();
			assert.strictEqual(root, expected);
		}),
	);

	it.effect("commitInfo reads HEAD's sha, N signature and exact message", () =>
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
	);
});

it.layer(SharedTestLayer, { timeout: "30 seconds" })("Git surface — submodule/fetch pair (fixture B)", (it) => {
	let libDir = "";
	let superDir = "";
	let libTagSha = "";

	/** The submodule's working copy, once `submoduleAdd` has vendored it. */
	const subDir = () => join(superDir, "vendor", "lib");

	/**
	 * "library" = a one-commit repo on `main`, tagged `v1.0.0`. "superproject" =
	 * an empty repo with `protocol.file.allow always` set BEFORE any submodule
	 * operation — git >= 2.38 refuses a file:// submodule otherwise.
	 */
	beforeAll(
		() =>
			Effect.gen(function* () {
				libDir = yield* fs.makeTempDirectory({ directory: tempDir, prefix: "effected-git-surface-lib-" });
				superDir = yield* fs.makeTempDirectory({ directory: tempDir, prefix: "effected-git-surface-super-" });

				const rawLib = (args: ReadonlyArray<string>) => runFixtureGit(libDir, args);
				const rawSuper = (args: ReadonlyArray<string>) => runFixtureGit(superDir, args);

				yield* rawLib(["-c", "init.defaultBranch=main", "init"]);
				yield* rawLib(["config", "user.email", "git-integration@example.com"]);
				yield* rawLib(["config", "user.name", "Git Integration"]);
				yield* fs.writeFileString(join(libDir, "lib.txt"), "library\n");
				yield* rawLib(["add", "-A"]);
				yield* rawLib(["-c", "commit.gpgsign=false", "commit", "-m", "lib commit"]);
				yield* rawLib(["tag", "v1.0.0"]);
				const tagSha = (yield* rawLib(["rev-parse", "v1.0.0"])).trim();

				yield* rawSuper(["-c", "init.defaultBranch=main", "init"]);
				yield* rawSuper(["config", "user.email", "git-integration@example.com"]);
				yield* rawSuper(["config", "user.name", "Git Integration"]);
				yield* rawSuper(["config", "protocol.file.allow", "always"]);

				libTagSha = tagSha;
			}).pipe(run, Effect.runPromise),
		30_000,
	);

	afterAll(() =>
		Effect.gen(function* () {
			if (libDir !== "") yield* fs.remove(libDir, { recursive: true, force: true });
			if (superDir !== "") yield* fs.remove(superDir, { recursive: true, force: true });
		}).pipe(run, Effect.runPromise),
	);

	// Sequential, order-dependent stages against the same superproject: add
	// vendors the submodule, fetch+checkout pin it to a tag, a bad fetch fails
	// typed, and sparse-checkout narrows its tree — each stage builds on the
	// last, mirroring the brief's scenario-grouped-its style.

	it.effect(
		"submoduleAdd vendors the library and add stages the result",
		() =>
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
		20_000,
	);

	it.effect("fetch tag + checkout --detach pins the submodule, currentBranch reads none", () =>
		Effect.gen(function* () {
			const git = yield* Git;
			yield* git.fetch(subDir(), { ref: "v1.0.0", tag: true });
			yield* git.checkout(subDir(), "FETCH_HEAD", { detach: true });

			assertNone(yield* git.currentBranch(subDir()));
			assert.strictEqual(yield* git.revParse(subDir(), "HEAD"), libTagSha);
		}),
	);

	it.effect("fetch of a tag the remote does not have fails typed", () =>
		Effect.gen(function* () {
			const git = yield* Git;
			const exit = yield* Effect.exit(git.fetch(subDir(), { ref: "v9.9.9", tag: true }));
			assertExitFailure(exit, exit.pipe(Exit.getCause, O.getOrThrow));
			const found = Cause.findFail(exit.cause);
			assertSuccess(found, found.pipe(Result.getSuccess, O.getOrThrow));
			assert.isTrue(S.is(UnknownRefError)(found.success.error));
		}),
	);

	it.effect("sparseCheckoutSet --no-cone narrows the submodule's tree", () =>
		Effect.gen(function* () {
			const git = yield* Git;
			yield* git.sparseCheckoutSet(subDir(), ["src"], { cone: false });
			assertSome(yield* git.configGet(subDir(), "core.sparseCheckout"), "true");
			// The narrowing must be real, not just configured: lib.txt sits at the
			// tree root, outside the "src" pattern, so it leaves the working tree.
			const libGone = yield* fs
				.stat(join(subDir(), "lib.txt"))
				.pipe(Effect.match({ onSuccess: () => false, onFailure: () => true }));
			assert.isTrue(libGone);
		}),
	);

	describe("a fresh clone", () => {
		let cloneDir = "";

		beforeAll(
			() =>
				Effect.gen(function* () {
					// The superproject needs a commit between add and clone so the clone
					// has something to check out — fixture setup, so raw, not the service.
					yield* runFixtureGit(superDir, ["-c", "commit.gpgsign=false", "commit", "-m", "vendor lib"]);
					cloneDir = yield* fs.makeTempDirectory({ directory: tempDir, prefix: "effected-git-surface-clone-" });
					yield* runFixtureGit(tempDir, ["clone", superDir, cloneDir]);
					// Any clone needs protocol.file.allow set BEFORE submoduleUpdate --init too.
					yield* runFixtureGit(cloneDir, ["config", "protocol.file.allow", "always"]);
				}).pipe(run, Effect.runPromise),
			30_000,
		);

		afterAll(() =>
			Effect.gen(function* () {
				if (cloneDir !== "") yield* fs.remove(cloneDir, { recursive: true, force: true });
			}).pipe(run, Effect.runPromise),
		);

		it.effect(
			"a fresh clone materializes the submodule via submoduleUpdate --init",
			() =>
				Effect.gen(function* () {
					const git = yield* Git;
					yield* git.submoduleUpdate(cloneDir, { init: true, paths: ["vendor/lib"] });
					yield* assertExists(join(cloneDir, "vendor", "lib", "lib.txt"));
				}),
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
it.layer(SharedTestLayer, { timeout: "30 seconds" })("Git.log — history repository (fixture C)", (it) => {
	let dirC = "";
	let emptyDir = "";

	/**
	 * main:  c1 (tracked/old.txt + other.txt)
	 *     -> c2 (tracked/old.txt renamed to tracked/new.txt)
	 *     -> c3 (other.txt only — the off-pathspec commit)
	 *     -> c4 (main edits tracked/new.txt)   \
	 *        side branched at c2, also edits it -> merge (conflict, resolved)
	 */
	beforeAll(
		() =>
			Effect.gen(function* () {
				dirC = yield* fs.makeTempDirectory({ directory: tempDir, prefix: "effected-git-log-c-" });
				emptyDir = yield* fs.makeTempDirectory({ directory: tempDir, prefix: "effected-git-log-empty-" });

				const raw = (args: ReadonlyArray<string>) => runFixtureGit(dirC, args);
				const commit = (message: string) => raw(["-c", "commit.gpgsign=false", "commit", "-m", message]);

				yield* raw(["-c", "init.defaultBranch=main", "init"]);
				yield* raw(["config", "user.email", "log-integration@example.com"]);
				yield* raw(["config", "user.name", "Log Integration"]);

				yield* fs.makeDirectory(join(dirC, "tracked"), { recursive: true });
				yield* fs.writeFileString(join(dirC, "tracked", "old.txt"), "one\n");
				yield* fs.writeFileString(join(dirC, "other.txt"), "other\n");
				// A path with a space, to prove -z leaves names unquoted.
				yield* fs.writeFileString(join(dirC, "a name.txt"), "spaced\n");
				yield* raw(["add", "-A"]);
				yield* commit("c1");

				yield* raw(["mv", "tracked/old.txt", "tracked/new.txt"]);
				yield* commit("c2");
				const branchPoint = (yield* raw(["rev-parse", "HEAD"])).trim();

				yield* fs.writeFileString(join(dirC, "other.txt"), "other again\n");
				yield* raw(["add", "-A"]);
				yield* commit("c3");

				yield* fs.writeFileString(join(dirC, "tracked", "new.txt"), "main\n");
				yield* raw(["add", "-A"]);
				yield* commit("c4");

				yield* raw(["checkout", "-b", "side", branchPoint]);
				yield* fs.writeFileString(join(dirC, "tracked", "new.txt"), "side\n");
				yield* raw(["add", "-A"]);
				yield* commit("side");

				yield* raw(["checkout", "main"]);
				// The merge conflicts on purpose; the resolution is what makes the
				// merge commit differ from its first parent.
				yield* runCollected(
					ChildProcess.setCwd(ChildProcess.make("git", ["merge", "side"], { env: FIXTURE_ENV, extendEnv: true }), dirC),
				).pipe(Effect.orDie);
				yield* fs.writeFileString(join(dirC, "tracked", "new.txt"), "resolved\n");
				yield* raw(["add", "-A"]);
				yield* commit("merge side");

				yield* runFixtureGit(emptyDir, ["-c", "init.defaultBranch=main", "init"]);
			}).pipe(run, Effect.runPromise),
		60_000,
	);

	afterAll(() =>
		Effect.gen(function* () {
			if (dirC !== "") yield* fs.remove(dirC, { recursive: true, force: true });
			if (emptyDir !== "") yield* fs.remove(emptyDir, { recursive: true, force: true });
		}).pipe(run, Effect.runPromise),
	);

	it.effect("--follow walks a real rename; the same query without it stops at the rename", () =>
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
	);

	it.effect("a pathspec scopes the walk — an off-pathspec commit never appears", () =>
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
	);

	it.effect("firstParentDiffMerges is what gives a merge commit any paths at all", () =>
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
	);

	it.effect("entries arrive newest-first with real, ordered, decoded dates", () =>
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
	);

	it.effect("limit caps the walk, and limit 0 is the empty listing", () =>
		Effect.gen(function* () {
			const git = yield* Git;
			assert.strictEqual((yield* git.log(dirC, { limit: 2 })).length, 2);
			assert.deepStrictEqual(yield* git.log(dirC, { limit: 0 }), []);
		}),
	);

	it.effect("a path with a space comes back raw, never C-quoted", () =>
		Effect.gen(function* () {
			const git = yield* Git;
			const entries = yield* git.log(dirC, { paths: ["a name.txt"], follow: true });
			assert.deepStrictEqual(entries.at(-1)?.paths, ["a name.txt"]);
		}),
	);

	it.effect("an unborn HEAD is the empty listing against real git, not a failure", () =>
		Effect.gen(function* () {
			const git = yield* Git;
			assert.deepStrictEqual(yield* git.log(emptyDir), []);
		}),
	);

	it.effect("a directory that is not a repository still fails NotARepositoryError", () =>
		Effect.gen(function* () {
			const git = yield* Git;
			const error = yield* Effect.flip(git.log(tempDir));
			assert.isTrue(S.is(NotARepositoryError)(error));
		}),
	);
});

it.layer(SharedTestLayer, { timeout: "30 seconds" })(
	"Git surface — repository identity across worktrees (commonDir)",
	(it) => {
		let base = "";
		let main = "";
		let worktree = "";
		let linked = "";
		let bare = "";
		let spaced = "";
		let outside = "";

		/**
		 * A repository with a subdirectory and one linked worktree, a directory
		 * symlink onto the repository, a bare repository, and a plain directory.
		 * `base` is the UNRESOLVED tmpdir path, so on macOS every cwd below sits
		 * behind the `/var` -> `/private/var` link, and `linked` adds an explicit
		 * symlink so the same trap is exercised on Linux, whose tmpdir is real.
		 */
		beforeAll(() =>
			Effect.gen(function* () {
				base = yield* fs.makeTempDirectory({ directory: tempDir, prefix: "effected-git-common-dir-" });
				main = join(base, "main");
				worktree = join(base, "worktree");
				linked = join(base, "linked");
				bare = join(base, "bare.git");
				spaced = join(base, "spaced.git ");
				outside = join(base, "outside");
				yield* fs.makeDirectory(join(main, "sub"), { recursive: true });
				yield* fs.makeDirectory(outside);

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

				yield* fs.symlink(main, linked);
			}).pipe(run, Effect.runPromise),
		);

		afterAll(() => fs.remove(base, { recursive: true, force: true }).pipe(run, Effect.runPromise));

		it.effect("answers one realpath'd directory from the checkout, a subdirectory, a worktree and a symlink", () =>
			Effect.gen(function* () {
				const git = yield* Git;
				const expected = yield* fs.realPath(join(main, ".git"));
				for (const cwd of [main, join(main, "sub"), worktree, linked, join(linked, "sub")]) {
					assert.strictEqual(yield* git.commonDir(cwd), expected, cwd);
				}
			}),
		);

		it.effect("answers the repository directory itself for a bare repository", () =>
			Effect.gen(function* () {
				const git = yield* Git;
				assert.strictEqual(yield* git.commonDir(bare), yield* fs.realPath(bare));
			}),
		);

		it.effect("keeps a trailing space that belongs to the repository path", () =>
			Effect.gen(function* () {
				const git = yield* Git;
				const answer = yield* git.commonDir(spaced);
				assert.strictEqual(answer, yield* fs.realPath(spaced));
				assert.isTrue(Str.endsWith(" ")(answer));
			}),
		);

		it.effect("fails NotARepositoryError outside any repository", () =>
			Effect.gen(function* () {
				const git = yield* Git;
				const failure = yield* Effect.flip(git.commonDir(outside));
				assert.instanceOf(failure, NotARepositoryError);
			}),
		);
	},
);
