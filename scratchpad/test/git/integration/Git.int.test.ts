// Proves the whole @effected/git stack against a REAL git binary and a real
// filesystem, through @effect/platform-node's NodeServices.layer. Every other
// test in this package runs against the scripted spawner in ../fixtures.ts;
// this is the only place that proves the argv, the LC_ALL=C classification,
// the -z NUL-splitting, and runCollected's concurrent stream collection all
// compose against something that isn't a mock.
//
// Two obligations accumulated from earlier reviews live here, and nowhere
// else can regress them:
//  - runCollected's { concurrency: "unbounded" } stdout/stderr/exitCode
//    collection must not deadlock under SIMULTANEOUS pressure on both pipes
//    (see src/internal/run.ts and the dedicated "runCollected drains stdout
//    and stderr concurrently" test below) — no mock test can touch a real OS
//    pipe buffer, and a large-output-on-ONE-stream case does not discriminate
//    this: stdout is index 0 of the Effect.all array, so a sequential
//    collector drains it first and never deadlocks unless the OTHER pipe is
//    ALSO under pressure at the same time;
//  - refExists against a real nonexistent branch must resolve Success(false),
//    never a defect.
//
// The fixture is built with a mix of raw ChildProcess.make invocations (git
// init/config/add/commit/branch/tag — deliberately not part of the Git
// surface) and the real Git service itself for checkout, which IS part of
// the surface this package owns.

import { $ScratchpadId } from "@beep/identity/packages";
import { NodeServices } from "@effect/platform-node";
import { afterAll, assert, beforeAll, describe, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import { assertExitFailure, assertNone, assertSome } from "@effect/vitest/utils";
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
import * as S from "effect/Schema";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import { Git, NotARepositoryError } from "../../../effected/git/Git.ts";
import { runCollected } from "../../../effected/git/internal/run.ts";

const $I = $ScratchpadId.create("effected/git/Git.int.test");

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
			real.spawn(ChildProcess.setEnv(command, { GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" })),
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

const encodeSshArgvJson = S.encodeEffect(S.fromJsonString(S.Array(S.String)));

/** The locale and prompt pins the `Git` service applies to its own spawns (#670). */
const FIXTURE_ENV = { LC_ALL: "C", GIT_TERMINAL_PROMPT: "0" } as const;

/**
 * Runs one raw `git` invocation for fixture setup — the operations that are
 * deliberately NOT part of the `Git` surface (init, config, add, commit,
 * branch, tag). Dies loudly (never cascades as a passed test) if git itself
 * could not be spawned, or if it ran and exited non-zero.
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

interface RepoFixture {
	readonly dir: string;
	/** Adds a.txt ("one"), "file with space.txt", and deleted.txt. */
	readonly commit1: string;
	/** Changes a.txt to "two" and removes deleted.txt. Tagged v1.0.0. */
	readonly commit2: string;
	/** Adds the >1MiB big.txt, on top of commit2. */
	readonly commit3: string;
	/** The tip of `feature/git`, branched from commit1. */
	readonly branchCommit: string;
	/** merge-base(main, feature/git) — expected to equal commit1. */
	readonly forkPoint: string;
	readonly tag: string;
	readonly bigContent: string;
}

/** Comfortably over any OS pipe buffer (64 KiB on Linux; historically ~16 KiB-64 KiB on darwin). */
const BIG_FILE_SIZE = 1_500_000;

const generateBigText = (size: number): string => {
	const line = "the quick brown fox jumps over the lazy dog\n";
	return line.repeat(Math.ceil(size / line.length)).slice(0, size);
};

/**
 * Builds one repository with branched history, a tag, a deleted file, a
 * changed file, a space-containing path, and an oversized file — everything
 * the assertion list needs from a single fixture.
 */
const buildFixture = Effect.fnUntraced(function* (dir: string) {
	const raw = (args: ReadonlyArray<string>) => runFixtureGit(dir, args);
	const git = yield* Git;

	yield* raw(["-c", "init.defaultBranch=main", "init"]);
	yield* raw(["config", "user.email", "git-integration@example.com"]);
	yield* raw(["config", "user.name", "Git Integration"]);

	yield* fs.writeFileString(join(dir, "a.txt"), "one\n");
	yield* fs.writeFileString(join(dir, "file with space.txt"), "space content\n");
	yield* fs.writeFileString(join(dir, "deleted.txt"), "will be deleted\n");
	yield* raw(["add", "-A"]);
	yield* raw(["-c", "commit.gpgsign=false", "commit", "-m", "commit1"]);
	const commit1 = (yield* raw(["rev-parse", "HEAD"])).trim();

	yield* raw(["branch", "feature/git"]);
	// checkout IS Git surface — dogfood the real service for the fixture's
	// own branch switches, not a raw invocation.
	yield* git.checkout(dir, "feature/git").pipe(Effect.orDie);
	yield* fs.writeFileString(join(dir, "feature.txt"), "feature content\n");
	yield* raw(["add", "-A"]);
	yield* raw(["-c", "commit.gpgsign=false", "commit", "-m", "branch commit"]);
	const branchCommit = (yield* raw(["rev-parse", "HEAD"])).trim();

	yield* git.checkout(dir, "main").pipe(Effect.orDie);
	yield* fs.writeFileString(join(dir, "a.txt"), "two\n");
	yield* fs.remove(join(dir, "deleted.txt"));
	yield* raw(["add", "-A"]);
	yield* raw(["-c", "commit.gpgsign=false", "commit", "-m", "commit2"]);
	const commit2 = (yield* raw(["rev-parse", "HEAD"])).trim();

	yield* raw(["tag", "v1.0.0", commit2]);

	const bigContent = generateBigText(BIG_FILE_SIZE);
	yield* fs.writeFileString(join(dir, "big.txt"), bigContent);
	yield* raw(["add", "-A"]);
	yield* raw(["-c", "commit.gpgsign=false", "commit", "-m", "commit3: add big file"]);
	const commit3 = (yield* raw(["rev-parse", "HEAD"])).trim();

	const forkPoint = (yield* raw(["merge-base", "main", "feature/git"])).trim();

	return { dir, commit1, commit2, commit3, branchCommit, forkPoint, tag: "v1.0.0", bigContent };
});

it.layer(SharedTestLayer, { timeout: "30 seconds" })("Git — real repository integration", (it) => {
	let fixtureDir = "";
	let fixture: RepoFixture;

	beforeAll(
		() =>
			Effect.gen(function* () {
				fixtureDir = yield* fs.makeTempDirectory({ directory: tempDir, prefix: "effected-git-int-" });
				fixture = yield* buildFixture(fixtureDir);
			}).pipe(run, Effect.runPromise),
		30_000,
	);

	afterAll(() =>
		Effect.gen(function* () {
			if (fixtureDir !== "") yield* fs.remove(fixtureDir, { recursive: true, force: true });
		}).pipe(run, Effect.runPromise),
	);

	it.effect("show at both commits: changed content differs", () =>
		Effect.gen(function* () {
			const git = yield* Git;
			const atCommit1 = yield* git.show(fixture.dir, fixture.commit1, "a.txt");
			const atCommit2 = yield* git.show(fixture.dir, fixture.commit2, "a.txt");
			assertSome(atCommit1, "one\n");
			assertSome(atCommit2, "two\n");
			assert.notDeepEqual(atCommit1, atCommit2);
		}),
	);

	it.effect("show of a file deleted at the later ref resolves Option.none", () =>
		Effect.gen(function* () {
			const git = yield* Git;
			const beforeDeletion = yield* git.show(fixture.dir, fixture.commit1, "deleted.txt");
			const afterDeletion = yield* git.show(fixture.dir, fixture.commit2, "deleted.txt");
			assertSome(beforeDeletion, "will be deleted\n");
			assertNone(afterDeletion);
		}),
	);

	it.effect("lsTree includes the space-path entry", () =>
		Effect.gen(function* () {
			const git = yield* Git;
			const entries = yield* git.lsTree(fixture.dir, fixture.commit1);
			const spaced = entries.find((entry) => entry.path === "file with space.txt");
			assert.isDefined(spaced);
			assert.strictEqual(spaced?.type, "blob");
			assert.match(spaced?.oid ?? "", /^[0-9a-f]{40}$/);
		}),
	);

	it.effect("refExists: true for the tag, false for a bogus ref", () =>
		Effect.gen(function* () {
			const git = yield* Git;
			assert.isTrue(yield* git.refExists(fixture.dir, "v1.0.0"));
			// ACCUMULATED OBLIGATION (G4): a real nonexistent branch must
			// resolve Success(false), never a defect.
			assert.isFalse(yield* git.refExists(fixture.dir, "no-such-branch"));
		}),
	);

	it.effect("mergeBase on branched history equals the fork-point SHA captured during setup", () =>
		Effect.gen(function* () {
			const git = yield* Git;
			const base = yield* git.mergeBase(fixture.dir, "main", "feature/git");
			assert.strictEqual(base, fixture.forkPoint);
			assert.strictEqual(base, fixture.commit1);
			// The probe sibling answers the same sha, wrapped.
			const probed = yield* git.mergeBaseOption(fixture.dir, "main", "feature/git");
			assertSome(probed, fixture.forkPoint);
		}),
	);

	it.effect("changedFiles across the two commits names exactly the changed and deleted files", () =>
		Effect.gen(function* () {
			const git = yield* Git;
			const changed = yield* git.changedFiles(fixture.dir, { base: fixture.commit1, head: fixture.commit2 });
			assert.deepStrictEqual([...changed].sort(), ["a.txt", "deleted.txt"]);
		}),
	);

	it.effect("revParse of the tag resolves a 40-char SHA equal to commit2", () =>
		Effect.gen(function* () {
			const git = yield* Git;
			const resolved = yield* git.revParse(fixture.dir, "v1.0.0");
			assert.match(resolved, /^[0-9a-f]{40}$/);
			assert.strictEqual(resolved, fixture.commit2);
		}),
	);

	// Pins content fidelity for a large single-stream blob (stdout only) — it
	// is NOT the concurrency guard. All of big.txt's ~1.5MiB lands on stdout,
	// which is index 0 of runCollected's Effect.all array, so a sequential
	// collector drains it first and completes without ever touching the
	// deadlock case. The dedicated backpressure test below (dual-stream
	// pressure on stdout AND stderr at once) is what discriminates
	// { concurrency: "unbounded" }; this test stays only as a large-content
	// round-trip check.
	it.effect(
		"show round-trips a file well over pipe-buffer size — content fidelity, not the concurrency guard",
		() =>
			Effect.gen(function* () {
				const git = yield* Git;
				const shown = yield* git.show(fixture.dir, fixture.commit3, "big.txt");
				assertSome(shown, fixture.bigContent);
				const content = O.getOrThrow(shown);
				assert.strictEqual(content.length, fixture.bigContent.length);
				assert.strictEqual(content.slice(0, 200), fixture.bigContent.slice(0, 200));
				assert.strictEqual(content.slice(-200), fixture.bigContent.slice(-200));
				assert.strictEqual(content, fixture.bigContent);
			}),
		10_000,
	);

	// THE backpressure guard. Discriminates runCollected's
	// { concurrency: "unbounded" } by putting simultaneous pressure on BOTH
	// pipes: the child writes ~2MB to stderr FIRST, then ~2MB to stdout. Under
	// a sequential collector (stdout is index 0 of the Effect.all array), the
	// reader waits on stdout while the child is still blocked writing the full
	// stderr pipe — neither side can proceed, and the run hangs to the
	// per-test timeout below. Under concurrent collection both pipes drain and
	// the run completes quickly. This is a plain `sh` subprocess, not git —
	// the obligation guards runCollected's generic infra, not anything
	// git-specific.
	it.effect(
		"runCollected drains stdout and stderr concurrently under simultaneous backpressure on both pipes",
		() =>
			Effect.gen(function* () {
				const result = yield* runCollected(
					ChildProcess.make("sh", [
						"-c",
						"head -c 2000000 /dev/zero | tr '\\0' 'e' >&2; head -c 2000000 /dev/zero | tr '\\0' 'o'",
					]),
				);
				assert.strictEqual(result.exitCode, 0);
				assert.strictEqual(result.stdout.length, 2_000_000);
				assert.strictEqual(result.stderr.length, 2_000_000);
				assert.strictEqual(result.stdout[0], "o");
				assert.strictEqual(result.stderr[0], "e");
			}),
		15_000,
	);

	describe("workingChanges, in its own dirty repository", () => {
		let dirtyDir = "";

		beforeAll(
			() =>
				Effect.gen(function* () {
					dirtyDir = yield* fs.makeTempDirectory({ directory: tempDir, prefix: "effected-git-int-dirty-" });

					const raw = (args: ReadonlyArray<string>) => runFixtureGit(dirtyDir, args);
					yield* raw(["-c", "init.defaultBranch=main", "init"]);
					yield* raw(["config", "user.email", "git-integration@example.com"]);
					yield* raw(["config", "user.name", "Git Integration"]);
					// Pin diff.relative=true on this repo: this is the adverse config Fix 1
					// guards against. Without the explicit --relative/--no-relative flags the
					// diffs would silently follow this config and desync from ls-files'
					// repo-root base — proven by the nested-cwd case below.
					yield* raw(["config", "diff.relative", "true"]);
					yield* fs.writeFileString(join(dirtyDir, "tracked.txt"), "one\n");
					// A tracked file in a NESTED subdirectory, so a cwd nested under the
					// repo root discriminates repo-root-relative from cwd-relative output.
					yield* fs.makeDirectory(join(dirtyDir, "pkg"), { recursive: true });
					yield* fs.writeFileString(join(dirtyDir, "pkg", "mod.txt"), "one\n");
					yield* raw(["add", "-A"]);
					yield* raw(["-c", "commit.gpgsign=false", "commit", "-m", "base"]);
					// Dirty the tree three distinct ways so the union covers each source.
					yield* fs.writeFileString(join(dirtyDir, "tracked.txt"), "two\n"); // unstaged
					yield* fs.writeFileString(join(dirtyDir, "pkg", "mod.txt"), "two\n"); // unstaged, nested
					yield* fs.writeFileString(join(dirtyDir, "staged.txt"), "new\n");
					yield* raw(["add", "staged.txt"]); // staged
					yield* fs.writeFileString(join(dirtyDir, "untracked.txt"), "loose\n"); // untracked
				}).pipe(run, Effect.runPromise),
			30_000,
		);

		afterAll(() =>
			Effect.gen(function* () {
				if (dirtyDir !== "") yield* fs.remove(dirtyDir, { recursive: true, force: true });
			}).pipe(run, Effect.runPromise),
		);

		it.effect("relative:true reports cwd-relative paths from the repo root (--relative honored)", () =>
			Effect.gen(function* () {
				const git = yield* Git;
				const changed = yield* git.workingChanges(dirtyDir, { relative: true });
				assert.deepStrictEqual([...changed].sort(), ["pkg/mod.txt", "staged.txt", "tracked.txt", "untracked.txt"]);
			}),
		);

		it.effect(
			"relative:false from a NESTED cwd stays repo-root-relative despite diff.relative=true (--no-relative overrides the config)",
			() =>
				Effect.gen(function* () {
					const git = yield* Git;
					// Run from the nested `pkg/` directory with the repo's diff.relative=true
					// in force. The explicit --no-relative keeps the DIFFS repo-root-relative
					// AND repo-wide, so `tracked.txt` and `staged.txt` (root files) appear
					// alongside the nested `pkg/mod.txt`, all with their repo-root spelling.
					// Without --no-relative, the inherited diff.relative would scope the diff
					// to `pkg/` and emit a lone cwd-relative `mod.txt`, dropping the root
					// files — the exact desync Fix 1 prevents. (The root `untracked.txt` is
					// absent by design: `git ls-files` is cwd-scoped, so from `pkg/` it lists
					// no untracked files above the subtree — a property of ls-files, not the
					// --relative flag.)
					const changed = yield* git.workingChanges(join(dirtyDir, "pkg"), { relative: false });
					assert.deepStrictEqual([...changed].sort(), ["pkg/mod.txt", "staged.txt", "tracked.txt"]);
				}),
		);
	});

	describe("checkout, in its own clone", () => {
		let cloneDir = "";

		beforeAll(
			() =>
				Effect.gen(function* () {
					cloneDir = yield* fs.makeTempDirectory({ directory: tempDir, prefix: "effected-git-int-clone-" });
					yield* runFixtureGit(tempDir, ["clone", fixture.dir, cloneDir]);
				}).pipe(run, Effect.runPromise),
			30_000,
		);

		afterAll(() =>
			Effect.gen(function* () {
				if (cloneDir !== "") yield* fs.remove(cloneDir, { recursive: true, force: true });
			}).pipe(run, Effect.runPromise),
		);

		it.effect("checkout moves HEAD, verified via revParse", () =>
			Effect.gen(function* () {
				const git = yield* Git;
				// A fresh clone checks out the default branch (main), at commit3.
				const before = yield* git.revParse(cloneDir, "HEAD");
				assert.strictEqual(before, fixture.commit3);

				yield* git.checkout(cloneDir, fixture.branchCommit);

				const after = yield* git.revParse(cloneDir, "HEAD");
				assert.strictEqual(after, fixture.branchCommit);
				assert.notStrictEqual(after, before);
			}),
		);
	});

	describe("an empty directory is not a repository", () => {
		let emptyDir = "";

		beforeAll(() =>
			Effect.gen(function* () {
				emptyDir = yield* fs.makeTempDirectory({ directory: tempDir, prefix: "effected-git-int-empty-" });
			}).pipe(run, Effect.runPromise),
		);

		afterAll(() =>
			Effect.gen(function* () {
				if (emptyDir !== "") yield* fs.remove(emptyDir, { recursive: true, force: true });
			}).pipe(run, Effect.runPromise),
		);

		it.effect("revParse fails with NotARepositoryError", () =>
			Effect.gen(function* () {
				const git = yield* Git;
				const failure = yield* Effect.flip(git.revParse(emptyDir, "HEAD"));
				assert.instanceOf(failure, NotARepositoryError);
			}),
		);

		it.effect("refExists fails with NotARepositoryError, never silently false", () =>
			Effect.gen(function* () {
				const git = yield* Git;
				const failure = yield* Effect.flip(git.refExists(emptyDir, "HEAD"));
				assert.instanceOf(failure, NotARepositoryError);
			}),
		);
	});

	// The mocked spawner proves the pins are COMPUTED; only a real git spawn
	// proves they REACH git. A stand-in ssh records the argv git handed it, so
	// the appended `-o BatchMode=yes` is observable without a network remote.
	describe("ssh pins reach a real git invocation (#670)", () => {
		let sshDir = "";
		let argvLog = "";
		let fakeSsh = "";

		beforeAll(() =>
			Effect.gen(function* () {
				sshDir = yield* fs.makeTempDirectory({ directory: tempDir, prefix: "effected-git-ssh-" });
				argvLog = join(sshDir, "argv.txt");
				// The basename MUST be `ssh`: the service only appends `-o` to a command it
				// recognizes as OpenSSH, mirroring git's own basename-driven variant
				// detection. A stand-in named anything else is correctly left untouched.
				fakeSsh = join(sshDir, "ssh");
				yield* fs.writeFileString(fakeSsh, `#!/bin/sh\nprintf '%s\\n' "$@" >> "${argvLog}"\nexit 1\n`, { mode: 0o755 });
			}).pipe(run, Effect.runPromise),
		);

		afterAll(() => fs.remove(sshDir, { recursive: true, force: true }).pipe(run, Effect.runPromise));

		it.layer(
			Layer.effectContext(
				Effect.gen(function* () {
					const scope = yield* Scope.Scope;
					return yield* Layer.buildWithScope(Layer.fresh(Git.layer), scope).pipe(
						Effect.provideContext(
							Context.add(
								testContext,
								ConfigProvider.ConfigProvider,
								ConfigProvider.fromEnvRecord({ GIT_SSH_COMMAND: fakeSsh }),
							),
						),
					);
				}),
			),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("appends BatchMode to the caller's own GIT_SSH_COMMAND", () =>
				Effect.gen(function* () {
					// lsRemote over an ssh URL routes through GIT_SSH_COMMAND. The
					// stand-in exits 1, so the call fails; the assertion is on the argv
					// git handed it, not on the outcome.
					const outcome = yield* Effect.exit(
						Effect.gen(function* () {
							const git = yield* Git;
							return yield* git.lsRemote(sshDir, "ssh://git@example.invalid/repo.git");
						}),
					);
					assertExitFailure(outcome, outcome.pipe(Exit.getCause, O.getOrThrow));
					const recorded = yield* fs.readFileString(argvLog, "utf8");
					const argv = Str.split(recorded, "\n").filter((line) => line !== "");
					// The pin arrived at a REAL git, which passed it through to ssh.
					assert.isTrue(
						argv.some((token, index) => token === "-o" && argv[index + 1] === "BatchMode=yes"),
						`expected "-o BatchMode=yes" in the ssh argv, got: ${yield* encodeSshArgvJson(argv)}`,
					);
				}),
			);
		});
	});
});
