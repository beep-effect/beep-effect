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

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { afterAll, assert, beforeAll, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Layer, Option } from "effect";
import type { ChildProcessSpawner } from "effect/process";
import { ChildProcess } from "effect/process";
import { Git, NotARepositoryError } from "../../../effected/git/Git.ts";
import { runCollected } from "../../../effected/git/internal/run.ts";

/** Resolves both `Git` and every Node platform service (including the real `ChildProcessSpawner`). */
const TestLayer = Git.layer.pipe(Layer.provideMerge(NodeServices.layer));

const run = <A, E>(effect: Effect.Effect<A, E, Git | ChildProcessSpawner.ChildProcessSpawner>) =>
	effect.pipe(Effect.provide(TestLayer));

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
						new Error(
							`fixture setup failed: git ${args.join(" ")} in ${cwd} (exit ${result.exitCode}): ${result.stderr}`,
						),
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
const buildFixture = (dir: string): Effect.Effect<RepoFixture, never, Git | ChildProcessSpawner.ChildProcessSpawner> =>
	Effect.gen(function* () {
		const raw = (args: ReadonlyArray<string>) => runFixtureGit(dir, args);
		const git = yield* Git;

		yield* raw(["-c", "init.defaultBranch=main", "init"]);
		yield* raw(["config", "user.email", "git-integration@example.com"]);
		yield* raw(["config", "user.name", "Git Integration"]);

		yield* Effect.promise(() => writeFile(join(dir, "a.txt"), "one\n"));
		yield* Effect.promise(() => writeFile(join(dir, "file with space.txt"), "space content\n"));
		yield* Effect.promise(() => writeFile(join(dir, "deleted.txt"), "will be deleted\n"));
		yield* raw(["add", "-A"]);
		yield* raw(["-c", "commit.gpgsign=false", "commit", "-m", "commit1"]);
		const commit1 = (yield* raw(["rev-parse", "HEAD"])).trim();

		yield* raw(["branch", "feature/git"]);
		// checkout IS Git surface — dogfood the real service for the fixture's
		// own branch switches, not a raw invocation.
		yield* git.checkout(dir, "feature/git").pipe(Effect.orDie);
		yield* Effect.promise(() => writeFile(join(dir, "feature.txt"), "feature content\n"));
		yield* raw(["add", "-A"]);
		yield* raw(["-c", "commit.gpgsign=false", "commit", "-m", "branch commit"]);
		const branchCommit = (yield* raw(["rev-parse", "HEAD"])).trim();

		yield* git.checkout(dir, "main").pipe(Effect.orDie);
		yield* Effect.promise(() => writeFile(join(dir, "a.txt"), "two\n"));
		yield* Effect.promise(() => rm(join(dir, "deleted.txt")));
		yield* raw(["add", "-A"]);
		yield* raw(["-c", "commit.gpgsign=false", "commit", "-m", "commit2"]);
		const commit2 = (yield* raw(["rev-parse", "HEAD"])).trim();

		yield* raw(["tag", "v1.0.0", commit2]);

		const bigContent = generateBigText(BIG_FILE_SIZE);
		yield* Effect.promise(() => writeFile(join(dir, "big.txt"), bigContent));
		yield* raw(["add", "-A"]);
		yield* raw(["-c", "commit.gpgsign=false", "commit", "-m", "commit3: add big file"]);
		const commit3 = (yield* raw(["rev-parse", "HEAD"])).trim();

		const forkPoint = (yield* raw(["merge-base", "main", "feature/git"])).trim();

		return { dir, commit1, commit2, commit3, branchCommit, forkPoint, tag: "v1.0.0", bigContent };
	});

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

describe("Git — real repository integration", () => {
	let fixtureDir: string;
	let fixture: RepoFixture;

	beforeAll(async () => {
		fixtureDir = await mkdtemp(join(tmpdir(), "effected-git-int-"));
		fixture = await Effect.runPromise(run(buildFixture(fixtureDir)));
	}, 30_000);

	afterAll(async () => {
		if (fixtureDir) await rm(fixtureDir, { recursive: true, force: true });
	});

	it.effect("show at both commits: changed content differs", () =>
		run(
			Effect.gen(function* () {
				const git = yield* Git;
				const atCommit1 = yield* git.show(fixture.dir, fixture.commit1, "a.txt");
				const atCommit2 = yield* git.show(fixture.dir, fixture.commit2, "a.txt");
				assert.deepStrictEqual(atCommit1, Option.some("one\n"));
				assert.deepStrictEqual(atCommit2, Option.some("two\n"));
				assert.notDeepEqual(atCommit1, atCommit2);
			}),
		),
	);

	it.effect("show of a file deleted at the later ref resolves Option.none", () =>
		run(
			Effect.gen(function* () {
				const git = yield* Git;
				const beforeDeletion = yield* git.show(fixture.dir, fixture.commit1, "deleted.txt");
				const afterDeletion = yield* git.show(fixture.dir, fixture.commit2, "deleted.txt");
				assert.deepStrictEqual(beforeDeletion, Option.some("will be deleted\n"));
				assert.deepStrictEqual(afterDeletion, Option.none());
			}),
		),
	);

	it.effect("lsTree includes the space-path entry", () =>
		run(
			Effect.gen(function* () {
				const git = yield* Git;
				const entries = yield* git.lsTree(fixture.dir, fixture.commit1);
				const spaced = entries.find((entry) => entry.path === "file with space.txt");
				assert.isDefined(spaced);
				assert.strictEqual(spaced?.type, "blob");
				assert.match(spaced?.oid ?? "", /^[0-9a-f]{40}$/);
			}),
		),
	);

	it.effect("refExists: true for the tag, false for a bogus ref", () =>
		run(
			Effect.gen(function* () {
				const git = yield* Git;
				assert.isTrue(yield* git.refExists(fixture.dir, "v1.0.0"));
				// ACCUMULATED OBLIGATION (G4): a real nonexistent branch must
				// resolve Success(false), never a defect.
				assert.isFalse(yield* git.refExists(fixture.dir, "no-such-branch"));
			}),
		),
	);

	it.effect("mergeBase on branched history equals the fork-point SHA captured during setup", () =>
		run(
			Effect.gen(function* () {
				const git = yield* Git;
				const base = yield* git.mergeBase(fixture.dir, "main", "feature/git");
				assert.strictEqual(base, fixture.forkPoint);
				assert.strictEqual(base, fixture.commit1);
				// The probe sibling answers the same sha, wrapped.
				const probed = yield* git.mergeBaseOption(fixture.dir, "main", "feature/git");
				assert.deepStrictEqual(probed, Option.some(fixture.forkPoint));
			}),
		),
	);

	it.effect("changedFiles across the two commits names exactly the changed and deleted files", () =>
		run(
			Effect.gen(function* () {
				const git = yield* Git;
				const changed = yield* git.changedFiles(fixture.dir, { base: fixture.commit1, head: fixture.commit2 });
				assert.deepStrictEqual([...changed].sort(), ["a.txt", "deleted.txt"]);
			}),
		),
	);

	it.effect("revParse of the tag resolves a 40-char SHA equal to commit2", () =>
		run(
			Effect.gen(function* () {
				const git = yield* Git;
				const resolved = yield* git.revParse(fixture.dir, "v1.0.0");
				assert.match(resolved, /^[0-9a-f]{40}$/);
				assert.strictEqual(resolved, fixture.commit2);
			}),
		),
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
			run(
				Effect.gen(function* () {
					const git = yield* Git;
					const shown = yield* git.show(fixture.dir, fixture.commit3, "big.txt");
					assert.isTrue(Option.isSome(shown));
					const content = Option.getOrThrow(shown);
					assert.strictEqual(content.length, fixture.bigContent.length);
					assert.strictEqual(content.slice(0, 200), fixture.bigContent.slice(0, 200));
					assert.strictEqual(content.slice(-200), fixture.bigContent.slice(-200));
					assert.strictEqual(content, fixture.bigContent);
				}),
			),
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
			run(
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
			),
		15_000,
	);

	describe("workingChanges, in its own dirty repository", () => {
		let dirtyDir: string;

		beforeAll(async () => {
			dirtyDir = await mkdtemp(join(tmpdir(), "effected-git-int-dirty-"));
			await Effect.runPromise(
				run(
					Effect.gen(function* () {
						const raw = (args: ReadonlyArray<string>) => runFixtureGit(dirtyDir, args);
						yield* raw(["-c", "init.defaultBranch=main", "init"]);
						yield* raw(["config", "user.email", "git-integration@example.com"]);
						yield* raw(["config", "user.name", "Git Integration"]);
						// Pin diff.relative=true on this repo: this is the adverse config Fix 1
						// guards against. Without the explicit --relative/--no-relative flags the
						// diffs would silently follow this config and desync from ls-files'
						// repo-root base — proven by the nested-cwd case below.
						yield* raw(["config", "diff.relative", "true"]);
						yield* Effect.promise(() => writeFile(join(dirtyDir, "tracked.txt"), "one\n"));
						// A tracked file in a NESTED subdirectory, so a cwd nested under the
						// repo root discriminates repo-root-relative from cwd-relative output.
						yield* Effect.promise(() => mkdir(join(dirtyDir, "pkg"), { recursive: true }));
						yield* Effect.promise(() => writeFile(join(dirtyDir, "pkg", "mod.txt"), "one\n"));
						yield* raw(["add", "-A"]);
						yield* raw(["-c", "commit.gpgsign=false", "commit", "-m", "base"]);
						// Dirty the tree three distinct ways so the union covers each source.
						yield* Effect.promise(() => writeFile(join(dirtyDir, "tracked.txt"), "two\n")); // unstaged
						yield* Effect.promise(() => writeFile(join(dirtyDir, "pkg", "mod.txt"), "two\n")); // unstaged, nested
						yield* Effect.promise(() => writeFile(join(dirtyDir, "staged.txt"), "new\n"));
						yield* raw(["add", "staged.txt"]); // staged
						yield* Effect.promise(() => writeFile(join(dirtyDir, "untracked.txt"), "loose\n")); // untracked
					}),
				),
			);
		}, 30_000);

		afterAll(async () => {
			if (dirtyDir) await rm(dirtyDir, { recursive: true, force: true });
		});

		it.effect("relative:true reports cwd-relative paths from the repo root (--relative honored)", () =>
			run(
				Effect.gen(function* () {
					const git = yield* Git;
					const changed = yield* git.workingChanges(dirtyDir, { relative: true });
					assert.deepStrictEqual([...changed].sort(), ["pkg/mod.txt", "staged.txt", "tracked.txt", "untracked.txt"]);
				}),
			),
		);

		it.effect(
			"relative:false from a NESTED cwd stays repo-root-relative despite diff.relative=true (--no-relative overrides the config)",
			() =>
				run(
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
				),
		);
	});

	describe("checkout, in its own clone", () => {
		let cloneDir: string;

		beforeAll(async () => {
			cloneDir = await mkdtemp(join(tmpdir(), "effected-git-int-clone-"));
			await Effect.runPromise(run(runFixtureGit(tmpdir(), ["clone", fixture.dir, cloneDir])));
		}, 30_000);

		afterAll(async () => {
			if (cloneDir) await rm(cloneDir, { recursive: true, force: true });
		});

		it.effect("checkout moves HEAD, verified via revParse", () =>
			run(
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
			),
		);
	});

	describe("an empty directory is not a repository", () => {
		let emptyDir: string;

		beforeAll(async () => {
			emptyDir = await mkdtemp(join(tmpdir(), "effected-git-int-empty-"));
		});

		afterAll(async () => {
			if (emptyDir) await rm(emptyDir, { recursive: true, force: true });
		});

		it.effect("revParse fails with NotARepositoryError", () =>
			run(
				Effect.gen(function* () {
					const git = yield* Git;
					const failure = yield* Effect.flip(git.revParse(emptyDir, "HEAD"));
					assert.instanceOf(failure, NotARepositoryError);
				}),
			),
		);

		it.effect("refExists fails with NotARepositoryError, never silently false", () =>
			run(
				Effect.gen(function* () {
					const git = yield* Git;
					const failure = yield* Effect.flip(git.refExists(emptyDir, "HEAD"));
					assert.instanceOf(failure, NotARepositoryError);
				}),
			),
		);
	});

	// The mocked spawner proves the pins are COMPUTED; only a real git spawn
	// proves they REACH git. A stand-in ssh records the argv git handed it, so
	// the appended `-o BatchMode=yes` is observable without a network remote.
	describe("ssh pins reach a real git invocation (#670)", () => {
		let sshDir: string;
		let argvLog: string;
		let fakeSsh: string;

		beforeAll(async () => {
			sshDir = await mkdtemp(join(tmpdir(), "effected-git-ssh-"));
			argvLog = join(sshDir, "argv.txt");
			// The basename MUST be `ssh`: the service only appends `-o` to a command it
			// recognizes as OpenSSH, mirroring git's own basename-driven variant
			// detection. A stand-in named anything else is correctly left untouched.
			fakeSsh = join(sshDir, "ssh");
			await writeFile(fakeSsh, `#!/bin/sh\nprintf '%s\\n' "$@" >> "${argvLog}"\nexit 1\n`, { mode: 0o755 });
		});

		afterAll(async () => {
			await rm(sshDir, { recursive: true, force: true });
		});

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
				assert.strictEqual(outcome._tag, "Failure");
				const recorded = yield* Effect.promise(() => readFile(argvLog, "utf8"));
				const argv = recorded.split("\n").filter((line) => line !== "");
				// The pin arrived at a REAL git, which passed it through to ssh.
				assert.isTrue(
					argv.some((token, index) => token === "-o" && argv[index + 1] === "BatchMode=yes"),
					`expected "-o BatchMode=yes" in the ssh argv, got: ${JSON.stringify(argv)}`,
				);
			}).pipe(
				Effect.provide(Git.layer),
				Effect.provide(NodeServices.layer),
				Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord({ GIT_SSH_COMMAND: fakeSsh }))),
			),
		);
	});
});
