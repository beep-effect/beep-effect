import { assert, describe, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as Result from "effect/Result";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as S from "effect/Schema";
import * as Tracer from "effect/Tracer";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { TestClock } from "effect/testing";
import {
	BranchEntry,
	ConfigListEntry,
	DirtyWorktreeError,
	Git,
	GitCommandError,
	LsFilesEntry,
	LsRemoteEntry,
	LsTreeEntry,
	MergeConflictError,
	NameStatusEntry,
	NonFastForwardError,
	NotARepositoryError,
	RefEntry,
	StashEntry,
	StatusEntry,
	SubmoduleStatusEntry,
	UnknownRefError,
	WorktreeEntry,
} from "../../effected/git/Git.ts";
import type { ScriptResult } from "./fixtures.ts";
import { scripted } from "./fixtures.ts";

const cwd = "/repo";

/**
 * Runs `program` (which requires `Git`) against `Git.layer` over a scripted
 * spawner.
 *
 * The EMPTY ConfigProvider is deliberate: `Git.layer` reads `GIT_SSH_COMMAND`
 * from the ambient provider, whose default resolves the host's real
 * environment. Without this, a stray `GIT_SSH_COMMAND` on a dev machine or a
 * runner would silently change the spawn environment of every test in this
 * file.
 */
const provideGit = (
  spawner: Layer.Layer<ChildProcessSpawner.ChildProcessSpawner>,
  provider: ConfigProvider.ConfigProvider = ConfigProvider.fromEnvRecord({}),
) => <A, E>(program: Effect.Effect<A, E, Git>) =>
  Effect.scopedWith((scope) => Effect.flatMap(
    Layer.buildWithScope(
      Git.layer.pipe(Layer.provideMerge(Layer.mergeAll(spawner, ConfigProvider.layer(provider)))),
      scope,
    ),
    (context) => Effect.provideContext(program, context),
  ));

const run = <A, E>(program: Effect.Effect<A, E, Git>, byArgs: (args: ReadonlyArray<string>) => ScriptResult) =>
  program.pipe(provideGit(scripted(withoutSshProbe(byArgs))));

/**
 * The config keys a network-touching member probes before its own invocation,
 * to resolve the ssh command git would have used.
 */
const SSH_PROBE_KEYS = ["core.sshCommand", "ssh.variant"];

/**
 * Whether an argv is one of those probes.
 *
 * HAZARD: this matches by argv alone, so a future test that legitimately calls
 * `git.configGet(cwd, "core.sshCommand")` or `"ssh.variant"` through `run`
 * would be answered `{ exit: 1 }` by {@link withoutSshProbe} instead of by its
 * own `byArgs`. Nothing does today. If you write one, give it its own spawner
 * rather than widening this.
 */
const isSshProbe = (args: ReadonlyArray<string>): boolean =>
	args.length === 3 && args[0] === "config" && args[1] === "--get" && SSH_PROBE_KEYS.includes(args[2] ?? "");

/**
 * Answers the ssh probe as "unset" (a silent exit 1, the `quiet` shape) and
 * keeps it out of `byArgs` entirely.
 *
 * Every network-touching member now spawns that probe first, which would
 * otherwise trip the argv assertion — and skew the spawn COUNT — of every
 * test written about the member's own invocation. Hiding it here keeps those
 * tests about what they were written to test; the probe itself is pinned
 * directly by the "spawn environment" suite, which does not use this helper.
 */
const withoutSshProbe =
	(byArgs: (args: ReadonlyArray<string>) => ScriptResult) =>
	(args: ReadonlyArray<string>): ScriptResult =>
		isSshProbe(args) ? { exit: 1 } : byArgs(args);

describe("Git", () => {
	it.effect("keeps public method spans without private helper child spans", () =>
		Effect.gen(function* () {
			const spans: Array<Tracer.NativeSpan> = [];
			const tracer = Tracer.make({
				span(options) {
					const span = new Tracer.NativeSpan(options);
					spans.push(span);
					return span;
				},
			});
			const program = Effect.gen(function* () {
				const git = yield* Git;
				yield* git.configSet(cwd, "a.b", "value");
				yield* git.configGetAll(cwd, "a.b");
				yield* git.untrackedFiles(cwd);
				yield* git.lsRemote(cwd, "ssh://git@example.invalid/x.git");
			});
			yield* run(program, () => ({ stdout: "", exit: 0 })).pipe(Effect.withTracer(tracer));
			assert.deepStrictEqual(spans.map((span) => span.name), [
				"Git.configSet", "Git.configGetAll", "Git.untrackedFiles", "Git.lsRemote",
			]);
		}),
	);

	describe("show", () => {
		it.effect("returns Option.some(contents) on a successful run — happy path", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.show(cwd, "HEAD", "package.json");
				});
				const result = yield* run(program, () => ({ stdout: '{ "name": "pkg" }\n', exit: 0 }));
				assert.deepStrictEqual(result, O.some('{ "name": "pkg" }\n'));
			}),
		);

		it.effect("absent-at-ref degrades to Option.none, never an error", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.show(cwd, "HEAD", "missing.txt");
				});
				const result = yield* run(program, () => ({
					stderr: "fatal: path 'missing.txt' does not exist in 'HEAD'\n",
					exit: 128,
				}));
				assert.deepStrictEqual(result, O.none());
			}),
		);
	});

	describe("lsTree", () => {
		it.effect("parses -z NUL-split entries, including a path with a space and a path with a newline", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.lsTree(cwd, "HEAD");
				});
				const entries = [
					"100644 blob e69de29bb2d1d6434b8b29ae775ad8c2e48c5391\tfile with space.txt",
					"100644 blob 3f786850e387550fdab836ed7e6dc881de23001b\tline\none.txt",
				].join("\0");
				const result = yield* run(program, () => ({ stdout: `${entries}\0`, exit: 0 }));
				assert.deepStrictEqual(result, [
					LsTreeEntry.make({
						mode: "100644",
						type: "blob",
						oid: "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391",
						path: "file with space.txt",
					}),
					LsTreeEntry.make({
						mode: "100644",
						type: "blob",
						oid: "3f786850e387550fdab836ed7e6dc881de23001b",
						path: "line\none.txt",
					}),
				]);
			}),
		);
	});

	describe("refExists", () => {
		it.effect("is true on a successful run", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.refExists(cwd, "HEAD");
				});
				const result = yield* run(program, () => ({ exit: 0 }));
				assert.isTrue(result);
			}),
		);

		it.effect("is false on a non-zero exit with empty stderr", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.refExists(cwd, "nonexistent");
				});
				const result = yield* run(program, () => ({ exit: 1 }));
				assert.isFalse(result);
			}),
		);

		it.effect("is false when git classifies the ref as unknown (Not a valid object name), never a defect", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.refExists(cwd, "feature-xyz");
				});
				const result = yield* run(program, () => ({
					stderr: "fatal: Not a valid object name feature-xyz\n",
					exit: 128,
				}));
				assert.isFalse(result);
			}),
		);
	});

	describe("mergeBase", () => {
		it.effect("returns the trimmed SHA — the 0.7.0 string shape, pinned against regression", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.mergeBase(cwd, "main", "feat/git");
				});
				const result = yield* run(program, () => ({ stdout: "abc123\n", exit: 0 }));
				assert.strictEqual(result, "abc123");
			}),
		);

		it.effect("no common ancestor (silent exit 1) fails LOUDLY on mergeBase — absence is exceptional here", () =>
			Effect.gen(function* () {
				// The 0.7.0 behavior, restored and pinned: installed consumers
				// (@savvy-web/silk-effects) .trim() the string result directly, so
				// this member must never grow an Option — mergeBaseOption is the probe.
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.mergeBase(cwd, "main", "orphan");
				});
				const failure = yield* Effect.flip(run(program, () => ({ exit: 1 })));
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.strictEqual(failure.exitCode, 1);
				}
			}),
		);
	});

	describe("mergeBaseOption", () => {
		it.effect("returns Option.some of the trimmed SHA", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.mergeBaseOption(cwd, "main", "feat/git");
				});
				const result = yield* run(program, () => ({ stdout: "abc123\n", exit: 0 }));
				assert.deepStrictEqual(result, O.some("abc123"));
			}),
		);

		it.effect("no common ancestor (silent exit 1) is the probe's Option.none, never an error", () =>
			Effect.gen(function* () {
				// Disjoint histories — an orphan branch, a grafted CI clone — exit 1
				// with silent stderr (probed against git 2.54): a legitimate answer.
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.mergeBaseOption(cwd, "main", "orphan");
				});
				const result = yield* run(program, () => ({ exit: 1 }));
				assert.deepStrictEqual(result, O.none());
			}),
		);

		it.effect("a NOISY exit 1 stays a loud GitCommandError — only the silent shape means disjoint", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.mergeBaseOption(cwd, "main", "feat/git");
				});
				const failure = yield* Effect.flip(
					run(program, () => ({ stderr: "error: something else went wrong\n", exit: 1 })),
				);
				assert.instanceOf(failure, GitCommandError);
			}),
		);

		it.effect("an unknown ref stays UnknownRefError on the probe — only ancestor absence degrades", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.mergeBaseOption(cwd, "main", "nonexistent");
				});
				const failure = yield* Effect.flip(
					run(program, () => ({ stderr: "fatal: Not a valid object name nonexistent\n", exit: 128 })),
				);
				assert.instanceOf(failure, UnknownRefError);
			}),
		);
	});

	describe("revParse", () => {
		it.effect("returns the trimmed SHA", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.revParse(cwd, "HEAD");
				});
				const result = yield* run(program, () => ({ stdout: "def456\n", exit: 0 }));
				assert.strictEqual(result, "def456");
			}),
		);
	});

	describe("changedFiles", () => {
		it.effect("parses -z NUL-split paths", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.changedFiles(cwd, { base: "main", head: "feat/git" });
				});
				const result = yield* run(program, () => ({ stdout: "a.ts\0b.ts\0", exit: 0 }));
				assert.deepStrictEqual(result, ["a.ts", "b.ts"]);
			}),
		);
	});

	describe("workingChanges", () => {
		// Routes the scripted spawner by argv: `--cached` is the staged query,
		// `ls-files` the untracked one, any other `diff` the unstaged one.
		const scriptWorkingTree = (byKind: {
			unstaged: string;
			staged: string;
			untracked: string;
		}): ((args: ReadonlyArray<string>) => ScriptResult) => (args) => {
				if (args[0] === "ls-files") return { stdout: byKind.untracked, exit: 0 };
				if (args.includes("--cached")) return { stdout: byKind.staged, exit: 0 };
				return { stdout: byKind.unstaged, exit: 0 };
		};

		it.effect("unions unstaged, staged and untracked paths, deduplicated", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.workingChanges(cwd, { relative: true });
				});
				const result = yield* run(
					program,
					scriptWorkingTree({
						unstaged: "shared.ts\0unstaged.ts\0",
						staged: "shared.ts\0staged.ts\0",
						untracked: "untracked.ts\0",
					}),
				);
				// `shared.ts` appears in both the unstaged and staged runs — the union
				// must dedupe it to a single entry.
				assert.deepStrictEqual([...result].sort(), ["shared.ts", "staged.ts", "unstaged.ts", "untracked.ts"]);
			}),
		);

		// Captures the argv of every spawned command for one workingChanges run.
		const argvOf = Effect.fn("argvOf")(function* (options: { readonly relative?: boolean }) {
				const seen: Array<ReadonlyArray<string>> = [];
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.workingChanges(cwd, options);
				});
				yield* run(program, (args) => {
					seen.push([...args]);
					return { stdout: "", exit: 0 };
				});
				return {
					diffs: seen.filter((args) => args[0] === "diff"),
					lsFiles: seen.filter((args) => args[0] === "ls-files"),
				};
			});

		it.effect(
			"relative:true — BOTH diffs carry --relative and ls-files is cwd-relative (no --relative, no --full-name)",
			() =>
				Effect.gen(function* () {
					const { diffs, lsFiles } = yield* argvOf({ relative: true });
					assert.strictEqual(diffs.length, 2);
					// All three sources share the cwd-relative base: --relative on the diffs
					// (and never --no-relative), plain ls-files (which is cwd-relative by default).
					assert.isTrue(diffs.every((args) => args.includes("--relative")));
					assert.isTrue(diffs.every((args) => !args.includes("--no-relative")));
					assert.strictEqual(lsFiles.length, 1);
					assert.isFalse(lsFiles[0]?.includes("--relative"));
					assert.isFalse(lsFiles[0]?.includes("--full-name"));
				}),
		);

		it.effect(
			"relative:false — BOTH diffs carry an explicit --no-relative and ls-files gets --full-name (all three repo-root-relative)",
			() =>
				Effect.gen(function* () {
					const { diffs, lsFiles } = yield* argvOf({ relative: false });
					assert.strictEqual(diffs.length, 2);
					// All three sources share the repo-root base: an EXPLICIT --no-relative on
					// the diffs (so an inherited diff.relative=true cannot make them
					// cwd-relative), and --full-name on ls-files (which would otherwise be
					// cwd-relative).
					assert.isTrue(diffs.every((args) => args.includes("--no-relative")));
					assert.isTrue(diffs.every((args) => !args.includes("--relative")));
					assert.strictEqual(lsFiles.length, 1);
					assert.isTrue(lsFiles[0]?.includes("--full-name"));
				}),
		);

		it.effect("surfaces NotARepositoryError when cwd is not a repository", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.workingChanges(cwd, {});
				});
				const failure = yield* Effect.flip(
					run(program, () => ({
						stderr: "fatal: not a git repository (or any of the parent directories): .git\n",
						exit: 128,
					})),
				);
				assert.instanceOf(failure, NotARepositoryError);
			}),
		);
	});

	describe("checkout", () => {
		it.effect("returns void on a successful run", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.checkout(cwd, "feat/git");
				});
				const result = yield* run(program, () => ({ exit: 0 }));
				assert.isUndefined(result);
			}),
		);
	});

	describe("classification taxonomy", () => {
		it.effect("stderr 'not a git repository' yields NotARepositoryError", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.revParse(cwd, "HEAD");
				});
				const failure = yield* Effect.flip(
					run(program, () => ({
						stderr: "fatal: not a git repository (or any of the parent directories): .git\n",
						exit: 128,
					})),
				);
				assert.instanceOf(failure, NotARepositoryError);
			}),
		);

		it.effect("stderr 'unknown revision' yields UnknownRefError", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.revParse(cwd, "nonexistent");
				});
				const failure = yield* Effect.flip(
					run(program, () => ({
						stderr: "fatal: ambiguous argument 'nonexistent': unknown revision or path not in the working tree.\n",
						exit: 128,
					})),
				);
				assert.instanceOf(failure, UnknownRefError);
			}),
		);

		it.effect("stderr 'bad revision' yields UnknownRefError", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.mergeBase(cwd, "main", "nonexistent");
				});
				const failure = yield* Effect.flip(
					run(program, () => ({ stderr: "fatal: bad revision 'nonexistent'\n", exit: 128 })),
				);
				assert.instanceOf(failure, UnknownRefError);
			}),
		);

		it.effect("stderr 'Not a valid object name' yields UnknownRefError", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.revParse(cwd, "nonexistent");
				});
				const failure = yield* Effect.flip(
					run(program, () => ({ stderr: "fatal: Not a valid object name nonexistent\n", exit: 128 })),
				);
				assert.instanceOf(failure, UnknownRefError);
			}),
		);

		it.effect("stderr 'invalid object name' yields UnknownRefError", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.mergeBase(cwd, "main", "nonexistent");
				});
				const failure = yield* Effect.flip(
					run(program, () => ({ stderr: "fatal: invalid object name 'nonexistent'.\n", exit: 128 })),
				);
				assert.instanceOf(failure, UnknownRefError);
			}),
		);

		it.effect("an unrecognized failure falls through to GitCommandError with exitCode/stderr intact", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.revParse(cwd, "HEAD");
				});
				const failure = yield* Effect.flip(
					run(program, () => ({ stderr: "fatal: something unrecognized went wrong\n", exit: 2 })),
				);
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.strictEqual(failure.kind, "failed");
					assert.strictEqual(failure.exitCode, 2);
					assert.strictEqual(failure.stderr, "fatal: something unrecognized went wrong\n");
				}
			}),
		);

		it.effect("a spawn-level PlatformError is absorbed into GitCommandError, never leaked raw", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.revParse(cwd, "HEAD");
				});
				const failure = yield* Effect.flip(
					run(program, () => PlatformError.systemError({ _tag: "NotFound", module: "ChildProcess", method: "spawn" })),
				);
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.strictEqual(failure.detail, "git is not installed (or the working directory does not exist)");
				}
			}),
		);

		it.effect("a non-NotFound spawn failure keeps the underlying diagnostic in detail", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.revParse(cwd, "HEAD");
				});
				const failure = yield* Effect.flip(
					run(program, () =>
						PlatformError.systemError({
							_tag: "PermissionDenied",
							module: "ChildProcess",
							method: "spawn",
							description: "EACCES on git binary",
						}),
					),
				);
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.isDefined(failure.detail);
					assert.isTrue(failure.detail?.startsWith("spawn failed: PermissionDenied:"));
					assert.include(failure.detail ?? "", "EACCES on git binary");
				}
			}),
		);

		it.effect("a run that never completes fails with GitCommandError after the 30s ceiling", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.revParse(cwd, "HEAD");
				});
				// The mock's exitCode effect is Effect.never — the operation only
				// resolves once Effect.timeoutOrElse's own duration elapses. Fork so
				// the current fiber can drive the virtual clock forward past it.
				const fiber = yield* run(program, () => ({ hang: true })).pipe(Effect.flip, Effect.forkChild);
				yield* TestClock.adjust("31 seconds");
				const failure = yield* Fiber.join(fiber);
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.strictEqual(failure.detail, "timed out after 30s");
				}
			}),
		);
	});

	describe("option-injection guard", () => {
		// A spawner that fails the test if it is ever reached: the guard must
		// refuse option-like refs BEFORE any spawn. A throw here would surface as
		// a defect, and Effect.flip on a defect fails the test.
		const neverSpawn = (): ScriptResult => {
			throw new Error("spawned — the option-injection guard did not fire");
		};

		it.effect("checkout refuses a ref git would parse as an option, before spawning", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.checkout(cwd, "-b");
				});
				const failure = yield* Effect.flip(run(program, neverSpawn));
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.include(failure.detail ?? "", "parse as an option");
					assert.deepStrictEqual([...failure.args], ["-b"]);
				}
			}),
		);

		it.effect("show refuses an option-like ref before spawning", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.show(cwd, "--help", "package.json");
				});
				const failure = yield* Effect.flip(run(program, neverSpawn));
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.include(failure.detail ?? "", "parse as an option");
				}
			}),
		);

		it.effect("mergeBase guards BOTH refs — the second alone is refused too", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.mergeBase(cwd, "main", "--fork-point");
				});
				const failure = yield* Effect.flip(run(program, neverSpawn));
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.deepStrictEqual([...failure.args], ["--fork-point"]);
				}
			}),
		);

		it.effect("changedFiles guards base and head", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.changedFiles(cwd, { base: "-Otrust", head: "HEAD" });
				});
				const failure = yield* Effect.flip(run(program, neverSpawn));
				assert.instanceOf(failure, GitCommandError);
			}),
		);

		it.effect("a dash INSIDE a ref is fine — only a leading dash is refused", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.revParse(cwd, "feat/point-in-time");
				});
				const sha = yield* run(program, () => ({ stdout: "a".repeat(40), exit: 0 }));
				assert.strictEqual(sha, "a".repeat(40));
			}),
		);

		it.effect("a guard rejection carries kind 'refused' and never spawns a process", () =>
			Effect.gen(function* () {
				let spawned = false;
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.checkout(cwd, "-b");
				});
				const failure = yield* Effect.flip(
					run(program, () => {
						spawned = true;
						return { exit: 0 };
					}),
				);
				assert.isFalse(spawned);
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.strictEqual(failure.kind, "refused");
				}
			}),
		);
	});

	describe("nameStatus", () => {
		it.effect("parses plain, scored-rename and copy entries from -z output", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.nameStatus(cwd, { base: "abc123" });
				});
				const output = [
					"M",
					"a.txt",
					"D",
					"b.txt",
					"R100",
					"old name.txt",
					"new\nname.txt",
					"C75",
					"src.txt",
					"copy.txt",
					"A",
					"staged.txt",
				].join("\0");
				const result = yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["diff", "--name-status", "-z", "--no-relative", "abc123"]);
					return { stdout: `${output}\0`, exit: 0 };
				});
				assert.deepStrictEqual(result, [
					NameStatusEntry.make({ status: "modified", path: "a.txt" }),
					NameStatusEntry.make({ status: "deleted", path: "b.txt" }),
					NameStatusEntry.make({ status: "renamed", path: "new\nname.txt", oldPath: "old name.txt" }),
					NameStatusEntry.make({ status: "copied", path: "copy.txt", oldPath: "src.txt" }),
					NameStatusEntry.make({ status: "added", path: "staged.txt" }),
				]);
			}),
		);

		it.effect("builds the base...head form when head is present", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.nameStatus(cwd, { base: "main", head: "feat/x" });
				});
				const result = yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["diff", "--name-status", "-z", "--no-relative", "main...feat/x"]);
					return { stdout: "", exit: 0 };
				});
				assert.deepStrictEqual(result, []);
			}),
		);

		it.effect("guards both refs against option-like values without spawning", () =>
			Effect.gen(function* () {
				let spawned = false;
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.nameStatus(cwd, { base: "main", head: "--output=/tmp/x" });
				});
				const exit = yield* Effect.exit(
					run(program, () => {
						spawned = true;
						return { exit: 0 };
					}),
				);
				assert.isTrue(Exit.isFailure(exit));
				assert.isFalse(spawned);
			}),
		);

		it.effect("an unknown base surfaces as UnknownRefError labeled with the range", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.nameStatus(cwd, { base: "nope", head: "HEAD" });
				});
				const exit = yield* Effect.exit(
					run(program, () => ({ stderr: "fatal: bad revision 'nope...HEAD'\n", exit: 128 })),
				);
				assert.isTrue(Exit.isFailure(exit));
				if (Exit.isFailure(exit)) {
					const found = Cause.findFail(exit.cause);
					assert.isTrue(Result.isSuccess(found));
					if (Result.isSuccess(found)) {
						const error = found.success.error;
						assert.instanceOf(error, UnknownRefError);
						assert.strictEqual(error.ref, "nope...HEAD");
					}
				}
			}),
		);
	});

	describe("working-tree primitives (promoted)", () => {
		it.effect("unstagedChanges runs the bare name-only diff and NUL-splits", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.unstagedChanges(cwd);
				});
				const result = yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["diff", "--name-only", "-z", "--no-relative"]);
					return { stdout: "a.txt\0b with space.txt\0", exit: 0 };
				});
				assert.deepStrictEqual(result, ["a.txt", "b with space.txt"]);
			}),
		);

		it.effect("stagedChanges passes --cached", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.stagedChanges(cwd, { relative: true });
				});
				const result = yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["diff", "--name-only", "-z", "--relative", "--cached"]);
					return { stdout: "staged.txt\0", exit: 0 };
				});
				assert.deepStrictEqual(result, ["staged.txt"]);
			}),
		);

		it.effect("untrackedFiles runs ls-files with --full-name when not relative", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.untrackedFiles(cwd);
				});
				const result = yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["ls-files", "--others", "--exclude-standard", "-z", "--full-name"]);
					return { stdout: "new.txt\0", exit: 0 };
				});
				assert.deepStrictEqual(result, ["new.txt"]);
			}),
		);
	});

	describe("lsTree pathspec", () => {
		it.effect("appends the pathspec behind -- and still parses entries", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.lsTree(cwd, "HEAD", { pathspec: [".changeset"] });
				});
				const entry = "100644 blob e69de29bb2d1d6434b8b29ae775ad8c2e48c5391\t.changeset/a.md";
				const result = yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["ls-tree", "-r", "-z", "HEAD", "--", ".changeset"]);
					return { stdout: `${entry}\0`, exit: 0 };
				});
				assert.strictEqual(result.length, 1);
				assert.strictEqual(result[0]?.path, ".changeset/a.md");
			}),
		);
	});

	describe("defaultBranch", () => {
		it.effect("strips the remote prefix from the symbolic-ref answer", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.defaultBranch(cwd);
				});
				const result = yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]);
					return { stdout: "origin/main\n", exit: 0 };
				});
				assert.deepStrictEqual(result, O.some("main"));
			}),
		);

		it.effect("an unset origin/HEAD (exit 1, silent) degrades to Option.none", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.defaultBranch(cwd);
				});
				const result = yield* run(program, () => ({ exit: 1 }));
				assert.deepStrictEqual(result, O.none());
			}),
		);

		it.effect("exit 1 WITH stderr is still a failure, not none", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.defaultBranch(cwd);
				});
				const exit = yield* Effect.exit(run(program, () => ({ stderr: "fatal: something else\n", exit: 1 })));
				assert.isTrue(Exit.isFailure(exit));
			}),
		);
	});

	describe("currentBranch", () => {
		it.effect("returns the branch name", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.currentBranch(cwd);
				});
				const result = yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["rev-parse", "--abbrev-ref", "HEAD"]);
					return { stdout: "feat/git-updates\n", exit: 0 };
				});
				assert.deepStrictEqual(result, O.some("feat/git-updates"));
			}),
		);

		it.effect("a detached HEAD (literal 'HEAD' answer) degrades to Option.none", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.currentBranch(cwd);
				});
				const result = yield* run(program, () => ({ stdout: "HEAD\n", exit: 0 }));
				assert.deepStrictEqual(result, O.none());
			}),
		);
	});

	describe("repoRoot", () => {
		it.effect("returns the trimmed toplevel path", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.repoRoot(cwd);
				});
				const result = yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["rev-parse", "--show-toplevel"]);
					return { stdout: "/repo\n", exit: 0 };
				});
				assert.strictEqual(result, "/repo");
			}),
		);
	});

	describe("commonDir", () => {
		it.effect("returns the trimmed absolute common directory", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.commonDir(cwd);
				});
				const result = yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
					return { stdout: "/repo/.git\n", exit: 0 };
				});
				assert.strictEqual(result, "/repo/.git");
			}),
		);

		// Only git's terminating newline is removed: a path is an identity, and a
		// directory name may legitimately end in whitespace.
		it.effect("keeps trailing whitespace that belongs to the path", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.commonDir(cwd);
				});
				const result = yield* run(program, () => ({ stdout: "/repos/bare.git \n", exit: 0 }));
				assert.strictEqual(result, "/repos/bare.git ");
			}),
		);

		// git before 2.31 does not know --path-format: rev-parse echoes the flag to
		// stdout, answers the relative form, and exits 0. That must not pass as an
		// identity.
		it.effect("fails typed when git echoes --path-format back (git older than 2.31)", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.commonDir(cwd);
				});
				const failure = yield* Effect.flip(run(program, () => ({ stdout: "--path-format=absolute\n.git\n", exit: 0 })));
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.strictEqual(failure.kind, "failed");
					assert.include(failure.detail ?? "", "2.31");
				}
			}),
		);

		it.effect("surfaces NotARepositoryError when cwd is not a repository", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.commonDir(cwd);
				});
				const failure = yield* Effect.flip(
					run(program, () => ({
						stderr: "fatal: not a git repository (or any of the parent directories): .git\n",
						exit: 128,
					})),
				);
				assert.instanceOf(failure, NotARepositoryError);
			}),
		);
	});

	describe("configGet", () => {
		it.effect("returns the trimmed value", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.configGet(cwd, "user.signingkey");
				});
				const result = yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["config", "--get", "user.signingkey"]);
					return { stdout: "ABC123\n", exit: 0 };
				});
				assert.deepStrictEqual(result, O.some("ABC123"));
			}),
		);

		it.effect("an unset key (exit 1, silent) degrades to Option.none", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.configGet(cwd, "user.signingkey");
				});
				const result = yield* run(program, () => ({ exit: 1 }));
				assert.deepStrictEqual(result, O.none());
			}),
		);

		it.effect("guards an option-like key without spawning", () =>
			Effect.gen(function* () {
				let spawned = false;
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.configGet(cwd, "--global");
				});
				const exit = yield* Effect.exit(
					run(program, () => {
						spawned = true;
						return { exit: 0 };
					}),
				);
				assert.isTrue(Exit.isFailure(exit));
				assert.isFalse(spawned);
			}),
		);
	});

	describe("remoteUrl", () => {
		it.effect("returns the trimmed URL", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.remoteUrl(cwd);
				});
				const result = yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["remote", "get-url", "origin"]);
					return { stdout: "git@github.com:o/r.git\n", exit: 0 };
				});
				assert.deepStrictEqual(result, O.some("git@github.com:o/r.git"));
			}),
		);

		it.effect("a missing remote degrades to Option.none", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.remoteUrl(cwd, { remote: "upstream" });
				});
				const result = yield* run(program, () => ({ stderr: "error: No such remote 'upstream'\n", exit: 2 }));
				assert.deepStrictEqual(result, O.none());
			}),
		);
	});

	describe("commitInfo", () => {
		it.effect("splits the NUL-separated format and keeps the message untrimmed", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.commitInfo(cwd);
				});
				const sha = "f78d2940dca62faf93051f94c54d5c7c24d465a8";
				const result = yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["log", "-1", "--format=%H%x00%G?%x00%B", "HEAD"]);
					return { stdout: `${sha}\0N\0feat: second commit\n\nbody line\n\n`, exit: 0 };
				});
				assert.strictEqual(result.sha, sha);
				assert.strictEqual(result.signatureStatus, "N");
				assert.strictEqual(result.message, "feat: second commit\n\nbody line\n\n");
			}),
		);

		it.effect("passes an explicit ref through, guarded", () =>
			Effect.gen(function* () {
				let spawned = false;
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.commitInfo(cwd, "--all");
				});
				const exit = yield* Effect.exit(
					run(program, () => {
						spawned = true;
						return { exit: 0 };
					}),
				);
				assert.isTrue(Exit.isFailure(exit));
				assert.isFalse(spawned);
			}),
		);
	});

	describe("status", () => {
		it.effect("parses XY codes, paths and the inverted rename order", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.status(cwd);
				});
				// R entries in porcelain -z order NEW path first, then ORIGINAL.
				const output = [
					"M  a.txt",
					"D  b.txt",
					"R  renamed.txt",
					"sub/c.txt",
					"A  staged.txt",
					"?? untracked.txt",
				].join("\0");
				const result = yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["status", "--porcelain", "-z"]);
					return { stdout: `${output}\0`, exit: 0 };
				});
				assert.deepStrictEqual(result, [
					StatusEntry.make({ x: "M", y: " ", path: "a.txt" }),
					StatusEntry.make({ x: "D", y: " ", path: "b.txt" }),
					StatusEntry.make({ x: "R", y: " ", path: "renamed.txt", origPath: "sub/c.txt" }),
					StatusEntry.make({ x: "A", y: " ", path: "staged.txt" }),
					StatusEntry.make({ x: "?", y: "?", path: "untracked.txt" }),
				]);
			}),
		);

		it.effect("a clean tree is an empty array", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.status(cwd);
				});
				const result = yield* run(program, () => ({ stdout: "", exit: 0 }));
				assert.deepStrictEqual(result, []);
			}),
		);
	});

	describe("StatusEntry porcelain rendering (#289)", () => {
		const entries = [
			StatusEntry.make({ x: "M", y: " ", path: "a.txt" }),
			StatusEntry.make({ x: "R", y: " ", path: "renamed.txt", origPath: "sub/c.txt" }),
			StatusEntry.make({ x: "?", y: "?", path: "untracked.txt" }),
		];

		it("toLine renders `XY <path>` — a rename emits the NEW path by default", () => {
			assert.strictEqual(entries[0]?.toLine(), "M  a.txt");
			// The kit's decided rename convention: the entry's CURRENT path.
			assert.strictEqual(entries[1]?.toLine(), "R  renamed.txt");
			assert.strictEqual(entries[2]?.toLine(), "?? untracked.txt");
		});

		it("renames: 'arrow' opts into git's own non-`-z` `orig -> new` form", () => {
			assert.strictEqual(entries[1]?.toLine({ renames: "arrow" }), "R  sub/c.txt -> renamed.txt");
			// Non-rename entries are unaffected by the option.
			assert.strictEqual(entries[0]?.toLine({ renames: "arrow" }), "M  a.txt");
		});

		it("format joins one line per entry with no trailing newline; an empty array is the empty string", () => {
			assert.strictEqual(StatusEntry.format(entries), "M  a.txt\nR  renamed.txt\n?? untracked.txt");
			assert.strictEqual(
				StatusEntry.format(entries, { renames: "arrow" }),
				"M  a.txt\nR  sub/c.txt -> renamed.txt\n?? untracked.txt",
			);
			assert.strictEqual(StatusEntry.format([]), "");
		});

		it.effect("format round-trips what parseStatus decoded", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.status(cwd);
				});
				const output = ["M  a.txt", "R  renamed.txt", "sub/c.txt"].join("\0");
				const parsed = yield* run(program, () => ({ stdout: `${output}\0`, exit: 0 }));
				assert.strictEqual(StatusEntry.format(parsed), "M  a.txt\nR  renamed.txt");
			}),
		);
	});

	describe("working-tree restore tier (#193)", () => {
		const neverSpawn = (): ScriptResult => {
			throw new Error("spawned — the option-injection guard did not fire");
		};

		it.effect("reset defaults to an explicit --mixed with no ref", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.reset(cwd);
				});
				yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["reset", "--mixed"]);
					return { exit: 0 };
				});
			}),
		);

		it.effect("reset --hard to a ref composes mode and ref", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.reset(cwd, { mode: "hard", ref: "abc123" });
				});
				yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["reset", "--hard", "abc123"]);
					return { exit: 0 };
				});
			}),
		);

		it.effect("a failed reset fails LOUDLY as GitCommandError — never a silent no-op", () =>
			Effect.gen(function* () {
				// The binding posture from the consumer census: a reset that silently
				// did nothing would hand a retry of a non-idempotent operation the
				// same dirty tree. Non-zero exit MUST surface typed.
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.reset(cwd, { mode: "hard" });
				});
				const failure = yield* Effect.flip(run(program, () => ({ stderr: "fatal: bad boom\n", exit: 128 })));
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.strictEqual(failure.kind, "failed");
					assert.strictEqual(failure.exitCode, 128);
				}
			}),
		);

		it.effect("reset refuses an option-like ref before spawning", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.reset(cwd, { ref: "--hard" });
				});
				const failure = yield* Effect.flip(run(program, neverSpawn));
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.strictEqual(failure.kind, "refused");
				}
			}),
		);

		it.effect("clean composes --force, -d, -x and a -- pathspec", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.clean(cwd, { directories: true, ignored: true, paths: ["dist"] });
				});
				yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["clean", "--force", "-d", "-x", "--", "dist"]);
					return { exit: 0 };
				});
			}),
		);

		it.effect("a failed clean fails LOUDLY as GitCommandError", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.clean(cwd, { directories: true });
				});
				const failure = yield* Effect.flip(run(program, () => ({ stderr: "fatal: cannot clean\n", exit: 1 })));
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.strictEqual(failure.kind, "failed");
				}
			}),
		);

		it.effect("restore puts paths behind a literal -- (the `checkout -- .` shape)", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.restore(cwd, ["."]);
				});
				yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["restore", "--", "."]);
					return { exit: 0 };
				});
			}),
		);

		it.effect("restore composes --source/--staged/--worktree, guarding the source ref pre-spawn", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.restore(cwd, ["a.txt"], { source: "HEAD~1", staged: true, worktree: true });
				});
				yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["restore", "--source", "HEAD~1", "--staged", "--worktree", "--", "a.txt"]);
					return { exit: 0 };
				});
				const guarded = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.restore(cwd, ["a.txt"], { source: "--staged" });
				});
				const failure = yield* Effect.flip(run(guarded, neverSpawn));
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.strictEqual(failure.kind, "refused");
				}
			}),
		);
	});

	describe("branch tier (#193)", () => {
		const neverSpawn = (): ScriptResult => {
			throw new Error("spawned — the option-injection guard did not fire");
		};

		it.effect("branchCreate builds `git branch <name> <start>` by default", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.branchCreate(cwd, "feat/x", { startPoint: "origin/main" });
				});
				yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["branch", "feat/x", "origin/main"]);
					return { exit: 0 };
				});
			}),
		);

		it.effect("branchCreate with checkout builds `git checkout -b <name> <start>`", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.branchCreate(cwd, "feat/x", { startPoint: "origin/main", checkout: true });
				});
				yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["checkout", "-b", "feat/x", "origin/main"]);
					return { exit: 0 };
				});
			}),
		);

		it.effect("branchCreate with force emits checkout -B (with checkout) or branch -f (without)", () =>
			Effect.gen(function* () {
				const invocations: Array<ReadonlyArray<string>> = [];
				const program = Effect.gen(function* () {
					const git = yield* Git;
					yield* git.branchCreate(cwd, "release/next", { startPoint: "origin/main", checkout: true, force: true });
					yield* git.branchCreate(cwd, "release/next", { startPoint: "origin/main", force: true });
				});
				yield* run(program, (args) => {
					invocations.push(args);
					return { exit: 0 };
				});
				assert.deepStrictEqual(invocations, [
					["checkout", "-B", "release/next", "origin/main"],
					["branch", "-f", "release/next", "origin/main"],
				]);
			}),
		);

		it.effect("branchCreate with force keeps the option-injection guard — no spawn on an option-like name", () =>
			Effect.gen(function* () {
				const guarded = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.branchCreate(cwd, "-B", { checkout: true, force: true });
				});
				const failure = yield* Effect.flip(run(guarded, neverSpawn));
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.strictEqual(failure.kind, "refused");
				}
			}),
		);

		it.effect("branchCreate guards BOTH the name and the start point pre-spawn", () =>
			Effect.gen(function* () {
				const badName = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.branchCreate(cwd, "-b");
				});
				const nameFailure = yield* Effect.flip(run(badName, neverSpawn));
				assert.instanceOf(nameFailure, GitCommandError);
				const badStart = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.branchCreate(cwd, "feat/x", { startPoint: "--track" });
				});
				const startFailure = yield* Effect.flip(run(badStart, neverSpawn));
				assert.instanceOf(startFailure, GitCommandError);
				if (S.is(GitCommandError)(startFailure)) {
					assert.strictEqual(startFailure.kind, "refused");
				}
			}),
		);

		it.effect("branchDelete builds -d by default, -D when forced, guarding the name", () =>
			Effect.gen(function* () {
				const invocations: Array<ReadonlyArray<string>> = [];
				const program = Effect.gen(function* () {
					const git = yield* Git;
					yield* git.branchDelete(cwd, "feat/x");
					yield* git.branchDelete(cwd, "feat/x", { force: true });
				});
				yield* run(program, (args) => {
					invocations.push(args);
					return { exit: 0 };
				});
				assert.deepStrictEqual(invocations, [
					["branch", "-d", "feat/x"],
					["branch", "-D", "feat/x"],
				]);
				const guarded = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.branchDelete(cwd, "-D");
				});
				const failure = yield* Effect.flip(run(guarded, neverSpawn));
				assert.instanceOf(failure, GitCommandError);
			}),
		);

		it.effect("an unmerged branch under plain -d fails typed as GitCommandError", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.branchDelete(cwd, "feat/x");
				});
				const failure = yield* Effect.flip(
					run(program, () => ({ stderr: "error: the branch 'feat/x' is not fully merged\n", exit: 1 })),
				);
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.strictEqual(failure.kind, "failed");
				}
			}),
		);
	});

	describe("shallow tier (#193)", () => {
		it.effect("isShallow parses `true` and `false` stdout into a boolean", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.isShallow(cwd);
				});
				const shallow = yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["rev-parse", "--is-shallow-repository"]);
					return { stdout: "true\n", exit: 0 };
				});
				assert.isTrue(shallow);
				const complete = yield* run(program, () => ({ stdout: "false\n", exit: 0 }));
				assert.isFalse(complete);
			}),
		);

		it.effect("fetchUnshallow builds `git fetch --unshallow <remote>`", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.fetchUnshallow(cwd, { remote: "upstream" });
				});
				yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["fetch", "--unshallow", "upstream"]);
					return { exit: 0 };
				});
			}),
		);

		it.effect("fetchUnshallow in a NON-shallow repo fails typed — the caller guards with isShallow", () =>
			Effect.gen(function* () {
				// The documented posture: --unshallow is a distinct mode git rejects
				// on a complete repository; this method does not tolerate it, so the
				// pairing is isShallow -> fetchUnshallow.
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.fetchUnshallow(cwd);
				});
				const failure = yield* Effect.flip(
					run(program, () => ({
						stderr: "fatal: --unshallow on a complete repository does not make sense\n",
						exit: 128,
					})),
				);
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.strictEqual(failure.kind, "failed");
					assert.strictEqual(failure.exitCode, 128);
				}
			}),
		);

		it.effect("fetchUnshallow persists only the REDACTED remote through classify (#86)", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.fetchUnshallow(cwd, { remote: "https://x:ghp_secret@github.com/a/r.git" });
				});
				const failure = yield* Effect.flip(run(program, () => ({ stderr: "fatal: nope\n", exit: 128 })));
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.deepStrictEqual([...failure.args], ["fetch", "--unshallow", "https://<redacted>@github.com/a/r.git"]);
					assert.notInclude(failure.message, "ghp_secret");
				}
			}),
		);

		it.effect("fetchUnshallow refuses an option-like remote before spawning", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.fetchUnshallow(cwd, { remote: "--upload-pack=evil" });
				});
				const failure = yield* Effect.flip(
					run(program, () => {
						throw new Error("spawned — the option-injection guard did not fire");
					}),
				);
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.strictEqual(failure.kind, "refused");
				}
			}),
		);
	});

	describe("mutating tier", () => {
		it.effect("checkout --detach passes the flag through", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.checkout(cwd, "FETCH_HEAD", { detach: true });
				});
				yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["checkout", "--detach", "FETCH_HEAD"]);
					return { exit: 0 };
				});
			}),
		);

		it.effect("fetch composes depth, remote, tag keyword and ref — both guarded", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.fetch(cwd, { ref: "v1.0.0", depth: 1, tag: true });
				});
				yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["fetch", "--depth", "1", "origin", "tag", "v1.0.0"]);
					return { exit: 0 };
				});
			}),
		);

		it.effect("fetch with a bare branch ref emits the plain form — the post-commit-sync spelling", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.fetch(cwd, { ref: "main" });
				});
				yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["fetch", "origin", "main"]);
					return { exit: 0 };
				});
			}),
		);

		it.effect("fetch passes a full +src:dst refspec through verbatim — the single-branch-clone spelling", () =>
			Effect.gen(function* () {
				// Under actions/checkout's single-branch clone a bare-ref fetch never
				// creates the remote-tracking ref; the refspec is the fix, and the
				// guard admits its legitimate leading + (only leading - is refused).
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.fetch(cwd, { ref: "+refs/heads/b:refs/remotes/origin/b" });
				});
				yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["fetch", "origin", "+refs/heads/b:refs/remotes/origin/b"]);
					return { exit: 0 };
				});
			}),
		);

		it.effect("fetch unshallow: true emits --unshallow before the remote", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.fetch(cwd, { ref: "main", unshallow: true });
				});
				yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["fetch", "--unshallow", "origin", "main"]);
					return { exit: 0 };
				});
			}),
		);

		it.effect("fetch refuses unshallow combined with depth before any spawn — git rejects the pair", () =>
			Effect.gen(function* () {
				let spawned = false;
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.fetch(cwd, { ref: "main", depth: 1, unshallow: true });
				});
				const failure = yield* Effect.flip(
					run(program, () => {
						spawned = true;
						return { exit: 0 };
					}),
				);
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.strictEqual(failure.kind, "refused");
				}
				assert.isFalse(spawned);
			}),
		);

		it.effect("fetch of a ref the remote does not have fails typed as UnknownRefError", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.fetch(cwd, { ref: "v9.9.9", tag: true });
				});
				const exit = yield* Effect.exit(
					run(program, () => ({ stderr: "fatal: couldn't find remote ref refs/tags/v9.9.9\n", exit: 128 })),
				);
				assert.isTrue(Exit.isFailure(exit));
				if (Exit.isFailure(exit)) {
					// Cause.failureOption does not exist at beta.98 — findFail returns a Result.
					const found = Cause.findFail(exit.cause);
					assert.isTrue(Result.isSuccess(found) && S.is(UnknownRefError)(found.success.error));
				}
			}),
		);

		it.effect("fetchAny stops at a successful tag-form fetch — one spawn, depth and remote composed", () =>
			Effect.gen(function* () {
				const invocations: Array<ReadonlyArray<string>> = [];
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.fetchAny(cwd, { ref: "v1.0.0", depth: 1 });
				});
				yield* run(program, (args) => {
					invocations.push(args);
					return { exit: 0 };
				});
				assert.deepStrictEqual(invocations, [["fetch", "--depth", "1", "origin", "tag", "v1.0.0"]]);
			}),
		);

		it.effect("fetchAny falls back to the plain form on UnknownRefError — options reach both invocations", () =>
			Effect.gen(function* () {
				const invocations: Array<ReadonlyArray<string>> = [];
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.fetchAny(cwd, { ref: "v1.0.0", remote: "upstream", depth: 1 });
				});
				yield* run(program, (args) => {
					invocations.push(args);
					return args.includes("tag")
						? { stderr: "fatal: couldn't find remote ref refs/tags/v1.0.0\n", exit: 128 }
						: { exit: 0 };
				});
				assert.deepStrictEqual(invocations, [
					["fetch", "--depth", "1", "upstream", "tag", "v1.0.0"],
					["fetch", "--depth", "1", "upstream", "v1.0.0"],
				]);
			}),
		);

		it.effect("fetchAny falls back on an unclassified GitCommandError from the tag form too", () =>
			Effect.gen(function* () {
				const invocations: Array<ReadonlyArray<string>> = [];
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.fetchAny(cwd, { ref: "main" });
				});
				yield* run(program, (args) => {
					invocations.push(args);
					return args.includes("tag")
						? { stderr: "error: some unclassified transport failure\n", exit: 128 }
						: { exit: 0 };
				});
				assert.strictEqual(invocations.length, 2);
				assert.deepStrictEqual(invocations[1], ["fetch", "origin", "main"]);
			}),
		);

		it.effect("fetchAny surfaces the PLAIN fetch's error when both attempts fail", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.fetchAny(cwd, { ref: "v9.9.9" });
				});
				const exit = yield* Effect.exit(
					run(program, (args) =>
						args.includes("tag")
							? { stderr: "fatal: tag-attempt failed\n", exit: 128 }
							: { stderr: "fatal: plain-attempt failed\n", exit: 128 },
					),
				);
				assert.isTrue(Exit.isFailure(exit));
				if (Exit.isFailure(exit)) {
					const found = Cause.findFail(exit.cause);
					assert.isTrue(Result.isSuccess(found));
					if (Result.isSuccess(found)) {
						const error = found.success.error;
						assert.instanceOf(error, GitCommandError);
						// The plain attempt's failure surfaces; the tag attempt's is discarded.
						assert.include(error.stderr, "plain-attempt failed");
						assert.isFalse(error.args.includes("tag"));
					}
				}
			}),
		);

		it.effect("fetchAny propagates NotARepositoryError from the tag attempt without a second spawn", () =>
			Effect.gen(function* () {
				let spawns = 0;
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.fetchAny(cwd, { ref: "v1.0.0" });
				});
				const exit = yield* Effect.exit(
					run(program, () => {
						spawns += 1;
						return { stderr: "fatal: not a git repository (or any of the parent directories): .git\n", exit: 128 };
					}),
				);
				assert.strictEqual(spawns, 1);
				assert.isTrue(Exit.isFailure(exit));
				if (Exit.isFailure(exit)) {
					const found = Cause.findFail(exit.cause);
					assert.isTrue(Result.isSuccess(found) && S.is(NotARepositoryError)(found.success.error));
				}
			}),
		);

		it.effect("fetchAny refuses an option-like REF without spawning either attempt", () =>
			Effect.gen(function* () {
				let spawned = false;
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.fetchAny(cwd, { ref: "--tags" });
				});
				const exit = yield* Effect.exit(
					run(program, () => {
						spawned = true;
						return { exit: 0 };
					}),
				);
				assert.isTrue(Exit.isFailure(exit));
				assert.isFalse(spawned);
			}),
		);

		it.effect("fetchAny short-circuits a refused ref to a single refused error, not a double rejection", () =>
			Effect.gen(function* () {
				// The refused error must NOT route through the tag-then-plain fallback
				// (which would re-reject through the plain form's guard). Routing on
				// kind "refused" is what keeps it a single rejection.
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.fetchAny(cwd, { ref: "--tags" });
				});
				const exit = yield* Effect.exit(run(program, () => ({ exit: 0 })));
				assert.isTrue(Exit.isFailure(exit));
				if (Exit.isFailure(exit)) {
					const found = Cause.findFail(exit.cause);
					assert.isTrue(Result.isSuccess(found));
					if (Result.isSuccess(found)) {
						const error = found.success.error;
						assert.instanceOf(error, GitCommandError);
						assert.strictEqual(error.kind, "refused");
						assert.deepStrictEqual([...error.args], ["--tags"]);
					}
				}
			}),
		);

		it.effect("submoduleUpdate composes init, depth and paths behind --", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.submoduleUpdate(cwd, { init: true, depth: 1, paths: [".repos/effect"] });
				});
				yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["submodule", "update", "--init", "--depth", "1", "--", ".repos/effect"]);
					return { exit: 0 };
				});
			}),
		);

		it.effect("submoduleUpdate checkout: true emits --checkout — the update=none silent-no-op override", () =>
			Effect.gen(function* () {
				// Against a `submodule.<name>.update = none` configuration, an
				// --init update without --checkout skips the submodule while
				// reporting success (probed against git 2.54). The flag on the
				// argv IS the fix; this pins it.
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.submoduleUpdate(cwd, { init: true, checkout: true, paths: ["V/vend"] });
				});
				yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["submodule", "update", "--init", "--checkout", "--", "V/vend"]);
					return { exit: 0 };
				});
			}),
		);

		it.effect("submoduleUpdate emits the widened flag family in a pinned order, --no-fetch only on fetch: false", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.submoduleUpdate(cwd, {
						init: true,
						checkout: true,
						remote: true,
						fetch: false,
						recursive: true,
						force: true,
						depth: 1,
						paths: [".repos/effect"],
					});
				});
				yield* run(program, (args) => {
					assert.deepStrictEqual(args, [
						"submodule",
						"update",
						"--init",
						"--checkout",
						"--remote",
						"--no-fetch",
						"--recursive",
						"--force",
						"--depth",
						"1",
						"--",
						".repos/effect",
					]);
					return { exit: 0 };
				});
			}),
		);

		it.effect("submoduleAdd places url and path behind --", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.submoduleAdd(cwd, { url: "https://example.com/r.git", path: ".repos/r", depth: 1 });
				});
				yield* run(program, (args) => {
					assert.deepStrictEqual(args, [
						"submodule",
						"add",
						"--depth",
						"1",
						"--",
						"https://example.com/r.git",
						".repos/r",
					]);
					return { exit: 0 };
				});
			}),
		);

		it.effect("submoduleUpdate and submoduleAdd refuse a non-natural depth before any spawn", () =>
			Effect.gen(function* () {
				let spawned = false;
				const record = () => {
					spawned = true;
					return { exit: 0 };
				};
				const updateProgram = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.submoduleUpdate(cwd, { depth: Number.NaN });
				});
				const updateFailure = yield* Effect.flip(run(updateProgram, record));
				assert.instanceOf(updateFailure, GitCommandError);
				if (S.is(GitCommandError)(updateFailure)) {
					assert.strictEqual(updateFailure.kind, "refused");
				}
				const addProgram = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.submoduleAdd(cwd, { url: "https://example.com/r.git", path: ".repos/r", depth: 1.5 });
				});
				const addFailure = yield* Effect.flip(run(addProgram, record));
				assert.instanceOf(addFailure, GitCommandError);
				if (S.is(GitCommandError)(addFailure)) {
					assert.strictEqual(addFailure.kind, "refused");
				}
				assert.isFalse(spawned);
			}),
		);

		it.effect("sparseCheckoutSet is explicit about the cone flag and guards patterns", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.sparseCheckoutSet(cwd, ["packages/effect", "migration"], { cone: false });
				});
				yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["sparse-checkout", "set", "--no-cone", "packages/effect", "migration"]);
					return { exit: 0 };
				});
			}),
		);

		it.effect("sparseCheckoutSet refuses an option-like pattern without spawning", () =>
			Effect.gen(function* () {
				let spawned = false;
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.sparseCheckoutSet(cwd, ["--cone-mode=evil"], { cone: false });
				});
				const exit = yield* Effect.exit(
					run(program, () => {
						spawned = true;
						return { exit: 0 };
					}),
				);
				assert.isTrue(Exit.isFailure(exit));
				assert.isFalse(spawned);
			}),
		);

		it.effect("configSet writes into an explicit file and guards key, value and file", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.configSet(cwd, "submodule.a.shallow", "true", { file: ".gitmodules" });
				});
				yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["config", "-f", ".gitmodules", "submodule.a.shallow", "true"]);
					return { exit: 0 };
				});
			}),
		);

		it.effect("configSet refuses an option-like VALUE without spawning", () =>
			Effect.gen(function* () {
				let spawned = false;
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.configSet(cwd, "alias.x", "--exec=evil");
				});
				const exit = yield* Effect.exit(
					run(program, () => {
						spawned = true;
						return { exit: 0 };
					}),
				);
				assert.isTrue(Exit.isFailure(exit));
				assert.isFalse(spawned);
			}),
		);

		it.effect("configSet refuses an option-like KEY without spawning", () =>
			Effect.gen(function* () {
				let spawned = false;
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.configSet(cwd, "--global", "true");
				});
				const exit = yield* Effect.exit(
					run(program, () => {
						spawned = true;
						return { exit: 0 };
					}),
				);
				assert.isTrue(Exit.isFailure(exit));
				assert.isFalse(spawned);
			}),
		);

		it.effect("configSet refuses an option-like FILE without spawning", () =>
			Effect.gen(function* () {
				let spawned = false;
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.configSet(cwd, "alias.x", "true", { file: "--blob=evil" });
				});
				const exit = yield* Effect.exit(
					run(program, () => {
						spawned = true;
						return { exit: 0 };
					}),
				);
				assert.isTrue(Exit.isFailure(exit));
				assert.isFalse(spawned);
			}),
		);

		it.effect("fetch refuses an option-like REMOTE without spawning", () =>
			Effect.gen(function* () {
				let spawned = false;
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.fetch(cwd, { ref: "main", remote: "--upload-pack=evil" });
				});
				const exit = yield* Effect.exit(
					run(program, () => {
						spawned = true;
						return { exit: 0 };
					}),
				);
				assert.isTrue(Exit.isFailure(exit));
				assert.isFalse(spawned);
			}),
		);

		it.effect("fetch refuses an option-like REF without spawning", () =>
			Effect.gen(function* () {
				let spawned = false;
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.fetch(cwd, { ref: "--tags" });
				});
				const exit = yield* Effect.exit(
					run(program, () => {
						spawned = true;
						return { exit: 0 };
					}),
				);
				assert.isTrue(Exit.isFailure(exit));
				assert.isFalse(spawned);
			}),
		);

		it.effect("fetch refuses a NaN depth before any spawn", () =>
			Effect.gen(function* () {
				let spawned = false;
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.fetch(cwd, { ref: "main", depth: Number.NaN });
				});
				const failure = yield* Effect.flip(
					run(program, () => {
						spawned = true;
						return { exit: 0 };
					}),
				);
				assert.isFalse(spawned);
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.strictEqual(failure.kind, "refused");
					assert.include(failure.detail ?? "", "non-negative integer");
				}
			}),
		);

		it.effect("fetch refuses a fractional depth before any spawn", () =>
			Effect.gen(function* () {
				let spawned = false;
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.fetch(cwd, { ref: "main", depth: 1.5 });
				});
				const failure = yield* Effect.flip(
					run(program, () => {
						spawned = true;
						return { exit: 0 };
					}),
				);
				assert.isFalse(spawned);
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.strictEqual(failure.kind, "refused");
				}
			}),
		);

		it.effect("add stages paths behind -- so option-like paths are inert", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.add(cwd, [".gitmodules", "-weird-but-legal-behind-dashdash"]);
				});
				yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["add", "--", ".gitmodules", "-weird-but-legal-behind-dashdash"]);
					return { exit: 0 };
				});
			}),
		);
	});

	describe("submodule tier", () => {
		const neverSpawn = (): ScriptResult => {
			throw new Error("spawned — the pre-spawn guard did not fire");
		};

		it.effect("submoduleStatus decodes every state prefix, the describe suffix and a path with spaces", () =>
			Effect.gen(function* () {
				const sha = "a".repeat(40);
				const output = [
					` ${sha} .repos/effect (effect@4.0.0-beta.101)`,
					`-${sha} vendor/uninitialized`,
					`+${sha} vendor/out of sync (v1.0-2-gabcdef)`,
					`U${sha} vendor/conflicted`,
					"",
				].join("\n");
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.submoduleStatus(cwd);
				});
				const entries = yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["submodule", "status"]);
					return { stdout: output, exit: 0 };
				});
				assert.deepStrictEqual(entries, [
					SubmoduleStatusEntry.make({
						state: "current",
						sha,
						path: ".repos/effect",
						describe: "effect@4.0.0-beta.101",
					}),
					SubmoduleStatusEntry.make({ state: "uninitialized", sha, path: "vendor/uninitialized" }),
					SubmoduleStatusEntry.make({
						state: "outOfSync",
						sha,
						path: "vendor/out of sync",
						describe: "v1.0-2-gabcdef",
					}),
					SubmoduleStatusEntry.make({ state: "conflict", sha, path: "vendor/conflicted" }),
				]);
			}),
		);

		it.effect("submoduleInit passes its pathspec behind --", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.submoduleInit(cwd, { paths: [".repos/effect"] });
				});
				yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["submodule", "init", "--", ".repos/effect"]);
					return { exit: 0 };
				});
			}),
		);

		it.effect("submoduleDeinit with neither paths nor all is refused typed, before any spawn", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.submoduleDeinit(cwd, {});
				});
				const failure = yield* Effect.flip(run(program, neverSpawn));
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.strictEqual(failure.kind, "refused");
					assert.include(failure.detail ?? "", "paths or all");
				}
			}),
		);

		it.effect("submoduleDeinit --all --force builds the flag form", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.submoduleDeinit(cwd, { all: true, force: true });
				});
				yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["submodule", "deinit", "--force", "--all"]);
					return { exit: 0 };
				});
			}),
		);

		it.effect("submoduleSync classifies not-a-repository typed", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.submoduleSync(cwd);
				});
				const failure = yield* Effect.flip(
					run(program, () => ({ stderr: "fatal: not a git repository\n", exit: 128 })),
				);
				assert.instanceOf(failure, NotARepositoryError);
			}),
		);

		it.effect("a failing submoduleSetUrl persists ONLY the redacted url in args and message", () =>
			Effect.gen(function* () {
				const secret = "https://x-access-token:ghp_secret@github.com/a/r.git";
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.submoduleSetUrl(cwd, ".repos/r", secret);
				});
				const failure = yield* Effect.flip(
					run(program, (args) => {
						// The SPAWNED argv carries the real url — git needs it.
						assert.include(args, secret);
						return { stderr: "fatal: no submodule mapping found\n", exit: 1 };
					}),
				);
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.notInclude(failure.args.join(" "), "ghp_secret");
					assert.include(failure.args.join(" "), "https://<redacted>@github.com/a/r.git");
					assert.notInclude(failure.message, "ghp_secret");
					assert.include(failure.message, "<redacted>");
				}
			}),
		);

		it.effect("a failing configSet persists <redacted> for the value in args and message", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.configSet(cwd, "http.extraheader", "AUTHORIZATION: bearer tok123");
				});
				const failure = yield* Effect.flip(run(program, () => ({ stderr: "error: cannot write\n", exit: 255 })));
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.notInclude(failure.args.join(" "), "tok123");
					assert.deepStrictEqual([...failure.args], ["config", "http.extraheader", "<redacted>"]);
					assert.notInclude(failure.message, "tok123");
				}
			}),
		);

		it.effect("a REFUSED option-like configSet value is reported redacted too", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.configSet(cwd, "alias.x", "--secret-looking-value");
				});
				const failure = yield* Effect.flip(run(program, neverSpawn));
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.strictEqual(failure.kind, "refused");
					assert.deepStrictEqual([...failure.args], ["<redacted>"]);
					assert.notInclude(failure.detail ?? "", "--secret-looking-value");
				}
			}),
		);

		it.effect("submoduleSetBranch refuses an option-like branch before spawning", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.submoduleSetBranch(cwd, ".repos/r", { branch: "-b" });
				});
				const failure = yield* Effect.flip(run(program, neverSpawn));
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.strictEqual(failure.kind, "refused");
				}
			}),
		);

		it.effect("submoduleSetBranch with no branch clears to --default", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.submoduleSetBranch(cwd, ".repos/r");
				});
				yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["submodule", "set-branch", "--default", "--", ".repos/r"]);
					return { exit: 0 };
				});
			}),
		);

		it.effect("submoduleAbsorbgitdirs runs bare or scoped", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.submoduleAbsorbgitdirs(cwd, { paths: [".repos/r"] });
				});
				yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["submodule", "absorbgitdirs", "--", ".repos/r"]);
					return { exit: 0 };
				});
			}),
		);

		it.effect("submoduleForeach returns the collected stdout", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.submoduleForeach(cwd, "git rev-parse HEAD", { recursive: true });
				});
				const output = yield* run(program, (args) => {
					assert.deepStrictEqual(args, ["submodule", "foreach", "--recursive", "git rev-parse HEAD"]);
					return { stdout: "Entering '.repos/effect'\nabc123\n", exit: 0 };
				});
				assert.strictEqual(output, "Entering '.repos/effect'\nabc123\n");
			}),
		);

		it.effect("submoduleForeach refuses an option-like command before spawning", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.submoduleForeach(cwd, "--recursive");
				});
				const failure = yield* Effect.flip(run(program, neverSpawn));
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.strictEqual(failure.kind, "refused");
				}
			}),
		);

		it.effect("an unrecognized submodule failure falls through to GitCommandError with exit and stderr", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.submoduleDeinit(cwd, { paths: [".repos/r"] });
				});
				const failure = yield* Effect.flip(
					run(program, () => ({ stderr: "error: the following file has local modifications\n", exit: 1 })),
				);
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.strictEqual(failure.kind, "failed");
					assert.strictEqual(failure.exitCode, 1);
					assert.include(failure.stderr, "local modifications");
				}
			}),
		);
	});
});

describe("Git — remaining tiers (round 2)", () => {
	const neverSpawn = (): ScriptResult => {
		throw new Error("spawned — the pre-spawn guard did not fire");
	};

	// The ASCII unit separator stashList's fixed --format uses between fields.
	const US = "\u001f";

	describe("lsRemote", () => {
		it.effect("parses sha<TAB>refname lines, peeled ^{} entries included", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.lsRemote(cwd, "origin", { tags: true });
				});
				const sha = "9d41fb9d5825a52a6ab6d3232a8c7a111920bf94";
				const peeled = "ac28891d7c72307eb31c5bbe6c5e35ae4a7788c9";
				const output = [
					`${sha}\trefs/tags/effect@4.0.0-beta.101`,
					`${peeled}\trefs/tags/v1`,
					`${sha}\trefs/tags/v1^{}`,
					"",
				].join("\n");
				const result = yield* run(program, () => ({ stdout: output, exit: 0 }));
				assert.deepStrictEqual(result, [
					LsRemoteEntry.make({ sha, ref: "refs/tags/effect@4.0.0-beta.101" }),
					LsRemoteEntry.make({ sha: peeled, ref: "refs/tags/v1" }),
					LsRemoteEntry.make({ sha, ref: "refs/tags/v1^{}" }),
				]);
			}),
		);

		it("nearMatches surfaces a monorepo-prefixed tag for a bare wanted ref, and nothing else", () => {
			const entries = [
				LsRemoteEntry.make({ sha: "a".repeat(40), ref: "refs/tags/effect@4.0.0-beta.101" }),
				LsRemoteEntry.make({ sha: "b".repeat(40), ref: "refs/tags/4.0.0-beta.101-rc" }),
				LsRemoteEntry.make({ sha: "c".repeat(40), ref: "refs/heads/main" }),
			];
			// The systems#357 story: the caller wanted `4.0.0-beta.101`, the remote
			// advertises `effect@4.0.0-beta.101` — a near miss behind a separator.
			const matches = LsRemoteEntry.nearMatches(entries, "4.0.0-beta.101");
			assert.deepStrictEqual(
				matches.map((entry) => entry.ref),
				["refs/tags/effect@4.0.0-beta.101"],
			);
			// An exact match is a MATCH, not a near miss.
			const exact = LsRemoteEntry.nearMatches([LsRemoteEntry.make({ sha: "d".repeat(40), ref: "refs/tags/v1" })], "v1");
			assert.deepStrictEqual(exact, []);
		});

		it("shortName strips ref prefixes and the ^{} peel suffix", () => {
			assert.strictEqual(LsRemoteEntry.shortName("refs/tags/v1^{}"), "v1");
			assert.strictEqual(LsRemoteEntry.shortName("refs/heads/feat/x"), "feat/x");
			assert.strictEqual(LsRemoteEntry.shortName("HEAD"), "HEAD");
		});

		it.effect("an unreachable remote stays a plain GitCommandError — no dedicated type", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.lsRemote(cwd, "https://127.0.0.1:1/nope.git");
				});
				const failure = yield* Effect.flip(
					run(program, () => ({
						stderr: "fatal: unable to access 'https://127.0.0.1:1/nope.git/': Failed to connect\n",
						exit: 128,
					})),
				);
				assert.instanceOf(failure, GitCommandError);
			}),
		);

		it.effect("a failing lsRemote persists only the REDACTED remote in the error argv", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.lsRemote(cwd, "https://user:tok@example.com/r.git");
				});
				const failure = yield* Effect.flip(run(program, () => ({ stderr: "fatal: boom\n", exit: 128 })));
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.deepStrictEqual([...failure.args], ["ls-remote", "https://<redacted>@example.com/r.git"]);
					assert.notInclude(failure.message, "user:tok");
				}
			}),
		);

		it.effect("guards the remote and every pattern before spawning", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.lsRemote(cwd, "origin", { patterns: ["--upload-pack=evil"] });
				});
				const failure = yield* Effect.flip(run(program, neverSpawn));
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.strictEqual(failure.kind, "refused");
				}
			}),
		);
	});

	describe("remote management", () => {
		it.effect("remoteAdd persists a redacted url on failure", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.remoteAdd(cwd, "up", "https://user:tok@example.com/r.git");
				});
				const failure = yield* Effect.flip(
					run(program, () => ({ stderr: "error: remote up already exists\n", exit: 3 })),
				);
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.deepStrictEqual([...failure.args], ["remote", "add", "up", "https://<redacted>@example.com/r.git"]);
				}
			}),
		);

		it.effect("remoteRemove of a missing remote fails loudly — not an absence degrade", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.remoteRemove(cwd, "nope");
				});
				const failure = yield* Effect.flip(
					run(program, () => ({ stderr: "error: No such remote: 'nope'\n", exit: 2 })),
				);
				assert.instanceOf(failure, GitCommandError);
			}),
		);

		it.effect("remoteSetUrl guards the name before spawning", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.remoteSetUrl(cwd, "--push", "https://example.com/r.git");
				});
				const failure = yield* Effect.flip(run(program, neverSpawn));
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.strictEqual(failure.kind, "refused");
				}
			}),
		);
	});

	describe("stash", () => {
		it.effect("stashList parses NUL-terminated unit-separated records", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.stashList(cwd);
				});
				const output =
					`stash@{0}${US}9082ed4f3a84eac9fe9f84f1792959f4e6704642${US}WIP on main: 9d41fb9 one\0` +
					`stash@{1}${US}a5ba0f23294307d84952fdec58bd058d3c8d068c${US}On main: first msg\0`;
				const result = yield* run(program, () => ({ stdout: output, exit: 0 }));
				assert.deepStrictEqual(result, [
					StashEntry.make({
						ref: "stash@{0}",
						sha: "9082ed4f3a84eac9fe9f84f1792959f4e6704642",
						message: "WIP on main: 9d41fb9 one",
					}),
					StashEntry.make({
						ref: "stash@{1}",
						sha: "a5ba0f23294307d84952fdec58bd058d3c8d068c",
						message: "On main: first msg",
					}),
				]);
			}),
		);

		it.effect("stashPop maps the dirty-worktree refusal to DirtyWorktreeError", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.stashPop(cwd);
				});
				const failure = yield* Effect.flip(
					run(program, () => ({
						stderr:
							"error: Your local changes to the following files would be overwritten by merge:\n\tg.txt\nPlease commit your changes or stash them before you merge.\nAborting\n",
						exit: 1,
					})),
				);
				assert.instanceOf(failure, DirtyWorktreeError);
			}),
		);

		it.effect("stashApply maps a STDOUT conflict report to MergeConflictError", () =>
			Effect.gen(function* () {
				// git's merge machinery reports conflicts on stdout (probed): the
				// classification must read stdout, not just stderr.
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.stashApply(cwd, { index: 0 });
				});
				const failure = yield* Effect.flip(
					run(program, () => ({
						stdout: "Auto-merging f.txt\nCONFLICT (content): Merge conflict in f.txt\n",
						stderr: "",
						exit: 1,
					})),
				);
				assert.instanceOf(failure, MergeConflictError);
			}),
		);

		it.effect("a NaN stash index is refused before any spawn", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.stashPop(cwd, { index: Number.NaN });
				});
				const failure = yield* Effect.flip(run(program, neverSpawn));
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.strictEqual(failure.kind, "refused");
					assert.include(failure.detail ?? "", "non-negative integer");
				}
			}),
		);

		it.effect("a fractional stash index is refused before any spawn", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.stashDrop(cwd, { index: 1.5 });
				});
				const failure = yield* Effect.flip(run(program, neverSpawn));
				assert.instanceOf(failure, GitCommandError);
			}),
		);

		it.effect("popping an empty stash stays a loud GitCommandError", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.stashPop(cwd);
				});
				const failure = yield* Effect.flip(run(program, () => ({ stderr: "No stash entries found.\n", exit: 1 })));
				assert.instanceOf(failure, GitCommandError);
			}),
		);
	});

	describe("refs tier", () => {
		it.effect("branchList decodes the HEAD marker and NUL-separated fields", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.branchList(cwd);
				});
				const sha = "9d41fb9d5825a52a6ab6d3232a8c7a111920bf94";
				const output = `*\0main\0${sha}\n \0other\0${sha}\n`;
				const result = yield* run(program, () => ({ stdout: output, exit: 0 }));
				assert.deepStrictEqual(result, [
					BranchEntry.make({ name: "main", sha, current: true }),
					BranchEntry.make({ name: "other", sha, current: false }),
				]);
			}),
		);

		it.effect("forEachRef decodes the fixed refname/sha/objecttype triple", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.forEachRef(cwd, { patterns: ["refs/tags"] });
				});
				const output = [`refs/tags/v1\0${"a".repeat(40)}\0tag`, `refs/tags/v2\0${"b".repeat(40)}\0commit`].join("\n");
				const result = yield* run(program, () => ({ stdout: `${output}\n`, exit: 0 }));
				assert.deepStrictEqual(result, [
					RefEntry.make({ ref: "refs/tags/v1", sha: "a".repeat(40), objectType: "tag" }),
					RefEntry.make({ ref: "refs/tags/v2", sha: "b".repeat(40), objectType: "commit" }),
				]);
			}),
		);

		it.effect("revList returns the sha lines; a NaN limit is refused pre-spawn", () =>
			Effect.gen(function* () {
				const listing = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.revList(cwd, "HEAD", { limit: 2, firstParent: true });
				});
				const result = yield* run(listing, () => ({ stdout: `${"a".repeat(40)}\n${"b".repeat(40)}\n`, exit: 0 }));
				assert.deepStrictEqual(result, ["a".repeat(40), "b".repeat(40)]);
				const guarded = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.revList(cwd, "HEAD", { limit: Number.NaN });
				});
				const failure = yield* Effect.flip(run(guarded, neverSpawn));
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.strictEqual(failure.kind, "refused");
				}
			}),
		);

		it.effect("tagCreate guards the name and the start ref before spawning", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.tagCreate(cwd, "v1", { ref: "--annotate" });
				});
				const failure = yield* Effect.flip(run(program, neverSpawn));
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.strictEqual(failure.kind, "refused");
				}
			}),
		);

		it.effect("tagList splits names on newlines", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.tagList(cwd, { pattern: "v*" });
				});
				const result = yield* run(program, () => ({ stdout: "v1\nv2\n", exit: 0 }));
				assert.deepStrictEqual(result, ["v1", "v2"]);
			}),
		);
	});

	describe("history tier", () => {
		it.effect("push maps the fetch-first rejection to NonFastForwardError, refspec attached", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.push(cwd, { refspec: "main" });
				});
				const failure = yield* Effect.flip(
					run(program, () => ({
						stderr:
							"To /up\n ! [rejected]        main -> main (fetch first)\nerror: failed to push some refs to '/up'\n",
						exit: 1,
					})),
				);
				assert.instanceOf(failure, NonFastForwardError);
				if (S.is(NonFastForwardError)(failure)) {
					assert.strictEqual(failure.refspec, "main");
				}
			}),
		);

		it.effect("push maps a --force-with-lease stale-info rejection to NonFastForwardError too", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.push(cwd, { refspec: "main:lease-target", forceWithLease: true });
				});
				const failure = yield* Effect.flip(
					run(program, () => ({
						stderr: "To /up\n ! [rejected]        main -> lease-target (stale info)\nerror: failed to push some refs\n",
						exit: 1,
					})),
				);
				assert.instanceOf(failure, NonFastForwardError);
			}),
		);

		it.effect("a push failure WITHOUT the rejection line stays GitCommandError", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.push(cwd, { refspec: "main" });
				});
				const failure = yield* Effect.flip(
					run(program, () => ({ stderr: "fatal: unable to access remote: connection refused\n", exit: 128 })),
				);
				assert.instanceOf(failure, GitCommandError);
			}),
		);

		it.effect("a failing push persists only the REDACTED remote URL", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.push(cwd, { remote: "https://x:tok@github.com/a/r.git", refspec: "main" });
				});
				const failure = yield* Effect.flip(run(program, () => ({ stderr: "fatal: boom\n", exit: 128 })));
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.deepStrictEqual([...failure.args], ["push", "https://<redacted>@github.com/a/r.git", "main"]);
					assert.notInclude(failure.message, "x:tok");
				}
			}),
		);

		it.effect("pull maps a merge-machinery STDOUT conflict to MergeConflictError", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.pull(cwd, { ref: "main" });
				});
				const failure = yield* Effect.flip(
					run(program, () => ({
						stdout:
							"Auto-merging f.txt\nCONFLICT (content): Merge conflict in f.txt\nAutomatic merge failed; fix conflicts and then commit the result.\n",
						stderr: "From /up\n * branch            main       -> FETCH_HEAD\n",
						exit: 1,
					})),
				);
				assert.instanceOf(failure, MergeConflictError);
			}),
		);

		it.effect("a rebase-mode pull's could-not-apply lands on stderr and still classifies as conflict", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.pull(cwd, { ref: "main", rebase: true });
				});
				const failure = yield* Effect.flip(
					run(program, () => ({
						stderr: "Rebasing (1/1)error: could not apply 06b4752... r2\nCould not apply 06b4752...\n",
						exit: 1,
					})),
				);
				assert.instanceOf(failure, MergeConflictError);
			}),
		);

		it.effect("pull maps the pre-merge dirty refusal to DirtyWorktreeError", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.pull(cwd, { ref: "main" });
				});
				const failure = yield* Effect.flip(
					run(program, () => ({
						stdout: "Updating 9d41fb9..733772c\n",
						stderr:
							"error: Your local changes to the following files would be overwritten by merge:\n\tf.txt\nPlease commit your changes or stash them before you merge.\nAborting\n",
						exit: 1,
					})),
				);
				assert.instanceOf(failure, DirtyWorktreeError);
			}),
		);

		it.effect("the merge rows are GATED: checkout with conflict-shaped stderr stays GitCommandError", () =>
			Effect.gen(function* () {
				// Zero-churn guarantee: an existing member's union never picks up the
				// new classifications — only push/pull/stashPop/stashApply carry them.
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.checkout(cwd, "main");
				});
				const failure = yield* Effect.flip(
					run(program, () => ({
						stderr: "error: Your local changes to the following files would be overwritten by checkout:\n",
						exit: 1,
					})),
				);
				assert.instanceOf(failure, GitCommandError);
			}),
		);

		it.effect("commit failure (nothing to commit) stays a loud GitCommandError", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.commit(cwd, "msg");
				});
				const failure = yield* Effect.flip(
					run(program, () => ({ stdout: "nothing to commit, working tree clean\n", exit: 1 })),
				);
				assert.instanceOf(failure, GitCommandError);
			}),
		);
	});

	describe("config tier", () => {
		it.effect("configList parses NUL records with first-newline key/value split — multi-line values survive", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.configList(cwd, { file: ".cfg" });
				});
				const output = "a.b\none\0a.b\ntwo\0x.y\nline1\nline2\0shorthand.flag\0";
				const result = yield* run(program, () => ({ stdout: output, exit: 0 }));
				assert.deepStrictEqual(result, [
					ConfigListEntry.make({ key: "a.b", value: "one" }),
					ConfigListEntry.make({ key: "a.b", value: "two" }),
					ConfigListEntry.make({ key: "x.y", value: "line1\nline2" }),
					// A valueless key is git's boolean-true shorthand.
					ConfigListEntry.make({ key: "shorthand.flag", value: "" }),
				]);
			}),
		);

		it.effect("configGetAll returns every value in order, and degrades an unset key to []", () =>
			Effect.gen(function* () {
				const listing = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.configGetAll(cwd, "a.b");
				});
				const values = yield* run(listing, () => ({ stdout: "one\0two\0", exit: 0 }));
				assert.deepStrictEqual(values, ["one", "two"]);
				const unset = yield* run(listing, () => ({ exit: 1 }));
				assert.deepStrictEqual(unset, []);
			}),
		);

		it.effect("configGetAll preserves a single explicitly empty value", () =>
			Effect.gen(function* () {
				const listing = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.configGetAll(cwd, "a.b");
				});
				const values = yield* run(listing, () => ({ stdout: "\0", exit: 0 }));
				assert.deepStrictEqual(values, [""]);
			}),
		);

		it.effect("configGetAll preserves empty values and their positions among nonempty values", () =>
			Effect.gen(function* () {
				const listing = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.configGetAll(cwd, "a.b");
				});
				const values = yield* run(listing, () => ({ stdout: "\0one\0\0", exit: 0 }));
				assert.deepStrictEqual(values, ["", "one", ""]);
			}),
		);

		it.effect("configUnset of a never-set key fails loudly (git exits 5, silently)", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.configUnset(cwd, "missing.key");
				});
				const failure = yield* Effect.flip(run(program, () => ({ exit: 5 })));
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.strictEqual(failure.exitCode, 5);
				}
			}),
		);

		it.effect("configRemoveSection targets the live config, or an explicit file via -f", () =>
			Effect.gen(function* () {
				const live = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.configRemoveSection(cwd, "submodule.vendored");
				});
				yield* run(live, (args) => {
					assert.deepStrictEqual(args, ["config", "--remove-section", "submodule.vendored"]);
					return { exit: 0 };
				});
				const filed = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.configRemoveSection(cwd, "submodule.vendored", { file: ".gitmodules" });
				});
				yield* run(filed, (args) => {
					assert.deepStrictEqual(args, ["config", "-f", ".gitmodules", "--remove-section", "submodule.vendored"]);
					return { exit: 0 };
				});
			}),
		);

		it.effect("configRemoveSection of a missing section fails loudly (git exits 128)", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.configRemoveSection(cwd, "submodule.phantom");
				});
				const failure = yield* Effect.flip(
					run(program, () => ({ stderr: "fatal: no such section: submodule.phantom\n", exit: 128 })),
				);
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.strictEqual(failure.exitCode, 128);
				}
			}),
		);

		it.effect("configRenameSection emits --rename-section old-then-new, optionally into a file", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.configRenameSection(cwd, "submodule.old", "submodule.new", { file: ".gitmodules" });
				});
				yield* run(program, (args) => {
					assert.deepStrictEqual(args, [
						"config",
						"-f",
						".gitmodules",
						"--rename-section",
						"submodule.old",
						"submodule.new",
					]);
					return { exit: 0 };
				});
			}),
		);

		it.effect("configRemoveSection and configRenameSection refuse option-like positionals before any spawn", () =>
			Effect.gen(function* () {
				let spawned = false;
				const record = () => {
					spawned = true;
					return { exit: 0 };
				};
				const removeProgram = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.configRemoveSection(cwd, "--global");
				});
				const removeFailure = yield* Effect.flip(run(removeProgram, record));
				assert.instanceOf(removeFailure, GitCommandError);
				if (S.is(GitCommandError)(removeFailure)) {
					assert.strictEqual(removeFailure.kind, "refused");
				}
				const renameProgram = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.configRenameSection(cwd, "submodule.old", "--global");
				});
				const renameFailure = yield* Effect.flip(run(renameProgram, record));
				assert.instanceOf(renameFailure, GitCommandError);
				if (S.is(GitCommandError)(renameFailure)) {
					assert.strictEqual(renameFailure.kind, "refused");
				}
				const fileProgram = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.configRemoveSection(cwd, "submodule.old", { file: "--system" });
				});
				const fileFailure = yield* Effect.flip(run(fileProgram, record));
				assert.instanceOf(fileFailure, GitCommandError);
				if (S.is(GitCommandError)(fileFailure)) {
					assert.strictEqual(fileFailure.kind, "refused");
				}
				assert.isFalse(spawned);
			}),
		);
	});

	describe("misc tier", () => {
		it.effect("checkIgnore returns the ignored subset and degrades none-ignored to []", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.checkIgnore(cwd, ["ig.txt", "vis.txt"]);
				});
				const some = yield* run(program, () => ({ stdout: "ig.txt\0", exit: 0 }));
				assert.deepStrictEqual(some, ["ig.txt"]);
				const none = yield* run(program, () => ({ exit: 1 }));
				assert.deepStrictEqual(none, []);
			}),
		);

		it.effect("worktreeList parses porcelain -z blocks: attached, detached, bare and locked", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.worktreeList(cwd);
				});
				const sha = "9d41fb9d5825a52a6ab6d3232a8c7a111920bf94";
				const output =
					`worktree /repo\0HEAD ${sha}\0branch refs/heads/main\0\0` +
					`worktree /wt2\0HEAD ${sha}\0detached\0\0` +
					`worktree /bare\0bare\0\0` +
					`worktree /locked\0HEAD ${sha}\0detached\0locked reason text\0\0`;
				const result = yield* run(program, () => ({ stdout: output, exit: 0 }));
				assert.deepStrictEqual(result, [
					WorktreeEntry.make({ path: "/repo", head: sha, branch: "refs/heads/main", detached: false, bare: false }),
					WorktreeEntry.make({ path: "/wt2", head: sha, detached: true, bare: false }),
					WorktreeEntry.make({ path: "/bare", detached: false, bare: true }),
					WorktreeEntry.make({ path: "/locked", head: sha, detached: true, bare: false, locked: "reason text" }),
				]);
			}),
		);

		it.effect("worktreeAdd guards path and ref before spawning", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.worktreeAdd(cwd, "--force-move");
				});
				const failure = yield* Effect.flip(run(program, neverSpawn));
				assert.instanceOf(failure, GitCommandError);
				if (S.is(GitCommandError)(failure)) {
					assert.strictEqual(failure.kind, "refused");
				}
			}),
		);

		it.effect("lsFiles parses index entries — the staged gitlink a HEAD-side read misses", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.lsFiles(cwd, { pathspec: [".repos/effect"] });
				});
				const gitlink = "3a65aa2fd529914855a65806f87d44f8cb158079";
				const blob = "78981922613b2afb6025042ff6bd878ac1994e85";
				const output = `100644 ${blob} 0\tfile with space.txt\0` + `160000 ${gitlink} 0\t.repos/effect\0`;
				const result = yield* run(program, () => ({ stdout: output, exit: 0 }));
				assert.deepStrictEqual(result, [
					LsFilesEntry.make({ mode: "100644", oid: blob, stage: 0, path: "file with space.txt" }),
					LsFilesEntry.make({ mode: "160000", oid: gitlink, stage: 0, path: ".repos/effect" }),
				]);
			}),
		);

		it.effect("lsFiles preserves a path containing a newline (the -z rule)", () =>
			Effect.gen(function* () {
				const program = Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.lsFiles(cwd);
				});
				const blob = "78981922613b2afb6025042ff6bd878ac1994e85";
				const result = yield* run(program, () => ({ stdout: `100644 ${blob} 0\tline\none.txt\0`, exit: 0 }));
				assert.deepStrictEqual(result, [
					LsFilesEntry.make({ mode: "100644", oid: blob, stage: 0, path: "line\none.txt" }),
				]);
			}),
		);
	});

	describe("spawn environment (#647, #670)", () => {
		/**
		 * Runs one member against a spawner that records every spawned command,
		 * and returns the options of the LAST one — the member's own invocation,
		 * after any `core.sshCommand` probe.
		 *
		 * `env` seeds the ambient ConfigProvider; `configured` and `variant` are
		 * what the probes report for `core.sshCommand` and `ssh.variant`
		 * (omitted = unset, a silent exit 1).
		 */
		const spawned = Effect.fn("spawned")(function* (options: {
			readonly env?: Record<string, string | undefined>;
			readonly configured?: string;
			readonly variant?: string;
			readonly network?: boolean;
		}) {
				const seen: Array<{
					readonly args: ReadonlyArray<string>;
					readonly options: ChildProcess.StandardCommand["options"];
				}> = [];
				const recording = Layer.succeed(
					ChildProcessSpawner.ChildProcessSpawner,
					ChildProcessSpawner.make((command) => {
						if (!ChildProcess.isStandardCommand(command)) return Effect.die("piped commands not scripted");
						seen.push({ args: command.args, options: command.options });
						const probe = isSshProbe(command.args);
						const asked = command.args[2];
						const answer =
							asked === "core.sshCommand" ? options.configured : asked === "ssh.variant" ? options.variant : undefined;
						const unset = probe && answer === undefined;
						return Effect.succeed(
							ChildProcessSpawner.makeHandle({
								pid: ChildProcessSpawner.ProcessId(1),
								exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(unset ? 1 : 0)),
								isRunning: Effect.succeed(false),
								kill: () => Effect.void,
								stdin: Sink.drain,
								stdout: Stream.make(new TextEncoder().encode(probe ? `${answer ?? ""}\n` : "abc123\n")),
								stderr: Stream.empty,
								all: Stream.empty,
								getInputFd: () => Sink.drain,
								getOutputFd: () => Stream.empty,
								unref: Effect.succeed(Effect.void),
							}),
						);
					}),
				);
				yield* Effect.gen(function* () {
					const git = yield* Git;
					// lsRemote is network-touching (it reads over the wire); revParse
					// is not — the ssh pin is scoped to members that can invoke ssh.
					return options.network === false
						? yield* git.revParse(cwd, "HEAD")
						: yield* git.lsRemote(cwd, "ssh://git@example.invalid/x.git");
				}).pipe(
					provideGit(recording, ConfigProvider.fromEnvRecord(options.env ?? {})),
				);
				assert.isTrue(seen.length > 0);
				const last = seen[seen.length - 1];
				assert.isDefined(last);
				return { seen, env: last.options.env, options: last.options };
			});

		it.effect("pins the classification, prompt and askpass keys on every spawn", () =>
			Effect.gen(function* () {
				const { env } = yield* spawned({ network: false });
				assert.strictEqual(env?.LC_ALL, "C");
				assert.strictEqual(env?.GIT_TERMINAL_PROMPT, "0");
				// Probed against git 2.55: an EMPTY GIT_ASKPASS is a hard stop, not a
				// fall-through — it suppresses core.askPass and SSH_ASKPASS too.
				// GIT_TERMINAL_PROMPT=0 alone closes none of those routes.
				assert.strictEqual(env?.GIT_ASKPASS, "");
				assert.strictEqual(env?.SSH_ASKPASS_REQUIRE, "never");
			}),
		);

		it.effect("keeps extendEnv true so the pins merge with the parent environment", () =>
			Effect.gen(function* () {
				const { options } = yield* spawned({ network: false });
				// Without this, pinning env would REPLACE the environment and git
				// would lose PATH, HOME and SSH_AUTH_SOCK.
				assert.strictEqual(options.extendEnv, true);
			}),
		);

		it.effect("leaves a non-network member alone: no ssh pin, and no probe spawned for it", () =>
			Effect.gen(function* () {
				const { seen, env } = yield* spawned({ network: false });
				assert.isUndefined(env?.GIT_SSH_COMMAND);
				// A member that never invokes ssh must not pay the config read.
				assert.isFalse(seen.some((spawn) => isSshProbe(spawn.args)));
			}),
		);

		it.effect("pins BatchMode when neither the environment nor git config names an ssh command", () =>
			Effect.gen(function* () {
				const { seen, env } = yield* spawned({});
				// `-o BatchMode=yes` is the ONLY lever that stops ssh reading a
				// passphrase or host-key confirmation from /dev/tty; no askpass pin
				// reaches those (probed under a real pty).
				assert.strictEqual(env?.GIT_SSH_COMMAND, "ssh -o BatchMode=yes");
				assert.isTrue(seen.some((spawn) => isSshProbe(spawn.args)));
			}),
		);

		it.effect("preserves a caller's GIT_SSH_COMMAND and appends BatchMode to it", () =>
			Effect.gen(function* () {
				const { seen, env } = yield* spawned({ env: { GIT_SSH_COMMAND: "ssh -i /keys/id_ed25519 -p 2222" } });
				// A hard pin would discard a working ssh configuration and turn
				// "prompts for a passphrase" into "cannot reach the remote at all".
				assert.strictEqual(env?.GIT_SSH_COMMAND, "ssh -i /keys/id_ed25519 -p 2222 -o BatchMode=yes");
				// The environment variable already settles the COMMAND — git resolves
				// it ahead of core.sshCommand — so that probe is skipped. The
				// ssh.variant probe still runs: the variant decides the argument
				// grammar and is a separate question from which command to run.
				assert.isFalse(seen.some((spawn) => spawn.args[2] === "core.sshCommand"));
				assert.isTrue(seen.some((spawn) => spawn.args[2] === "ssh.variant"));
			}),
		);

		it.effect("resolves core.sshCommand when the environment names none, and appends to THAT", () =>
			Effect.gen(function* () {
				const { env } = yield* spawned({ configured: "ssh -i /keys/deploy_key -o IdentitiesOnly=yes" });
				// The regression this guards: git resolves GIT_SSH_COMMAND ahead of
				// core.sshCommand, so pinning a bare `ssh` here would silently drop a
				// configured deploy key and fail auth on every ssh operation that
				// worked before.
				assert.strictEqual(env?.GIT_SSH_COMMAND, "ssh -i /keys/deploy_key -o IdentitiesOnly=yes -o BatchMode=yes");
			}),
		);

		it.effect("declines to touch an ssh command that is not OpenSSH", () =>
			Effect.gen(function* () {
				// plink has no `-o KEY=VALUE` form at all (its switch is -batch), so
				// appending would break a working PuTTY setup rather than degrade it.
				const { env } = yield* spawned({ env: { GIT_SSH_COMMAND: "plink -i C:\\keys\\id.ppk" } });
				assert.isUndefined(env?.GIT_SSH_COMMAND);
			}),
		);

		it.effect("declines when the caller already decides BatchMode for themselves", () =>
			Effect.gen(function* () {
				// OpenSSH takes the FIRST value obtained for a repeated option, so an
				// appended BatchMode=yes after the caller's BatchMode=no is inert
				// (verified with `ssh -G` against OpenSSH 10.3). The caller's decision
				// stands rather than being papered over with a pin that does nothing.
				const { env } = yield* spawned({ env: { GIT_SSH_COMMAND: "ssh -o BatchMode=no" } });
				assert.isUndefined(env?.GIT_SSH_COMMAND);
			}),
		);

		it.effect("pins a quoted ssh path containing spaces — the program is read quote-aware", () =>
			Effect.gen(function* () {
				// GIT_SSH_COMMAND is shell-interpreted, so quoting a path with spaces
				// is a working setup (verified against git 2.55). Splitting on
				// whitespace alone would read `"/opt/my` and silently skip the pin.
				const { env } = yield* spawned({ env: { GIT_SSH_COMMAND: '"/opt/my tools/ssh" -i /keys/id' } });
				assert.strictEqual(env?.GIT_SSH_COMMAND, '"/opt/my tools/ssh" -i /keys/id -o BatchMode=yes');
			}),
		);

		it.effect("pins despite an incidental mention of BatchMode that decides nothing", () =>
			Effect.gen(function* () {
				// `-F /tmp/BatchMode` names a config file. Treating the bare word as
				// the caller's decision would skip the pin for someone who never
				// asked to be prompted.
				const { env } = yield* spawned({ env: { GIT_SSH_COMMAND: "ssh -F /tmp/BatchMode" } });
				assert.strictEqual(env?.GIT_SSH_COMMAND, "ssh -F /tmp/BatchMode -o BatchMode=yes");
			}),
		);

		it.effect("treats a blank GIT_SSH_COMMAND as absent rather than appending to nothing", () =>
			Effect.gen(function* () {
				const { env } = yield* spawned({ env: { GIT_SSH_COMMAND: "   " } });
				assert.strictEqual(env?.GIT_SSH_COMMAND, "ssh -o BatchMode=yes");
			}),
		);

		it.effect("declines to pin when GIT_SSH is the deciding rung, rather than displacing it", () =>
			Effect.gen(function* () {
				// Git's order is GIT_SSH_COMMAND > core.sshCommand > GIT_SSH > ssh
				// (verified against git 2.55). GIT_SSH names a PROGRAM and takes no
				// arguments, so nothing can be appended to it — and because
				// GIT_SSH_COMMAND outranks it, pinning even a bare `ssh` would
				// silently replace the caller's working transport.
				const { env } = yield* spawned({ env: { GIT_SSH: "/opt/corp/ssh-wrapper" } });
				assert.isUndefined(env?.GIT_SSH_COMMAND);
				// The rest of the non-interactive pins still apply to that caller.
				assert.strictEqual(env?.GIT_TERMINAL_PROMPT, "0");
			}),
		);

		it.effect("prefers core.sshCommand over GIT_SSH, the way git does", () =>
			Effect.gen(function* () {
				const { env } = yield* spawned({
					env: { GIT_SSH: "/opt/corp/ssh-wrapper" },
					configured: "ssh -i /keys/deploy_key",
				});
				assert.strictEqual(env?.GIT_SSH_COMMAND, "ssh -i /keys/deploy_key -o BatchMode=yes");
			}),
		);

		it.effect("declines when ssh.variant tells git the command is not OpenSSH", () =>
			Effect.gen(function* () {
				// The basename inference is overridable: a program literally named
				// `ssh` with ssh.variant=plink is invoked with plink's -P (verified
				// against git 2.55), so the append would corrupt a working command.
				const { env } = yield* spawned({ env: { GIT_SSH_COMMAND: "ssh" }, variant: "plink" });
				assert.isUndefined(env?.GIT_SSH_COMMAND);
			}),
		);

		it.effect("declines when GIT_SSH_VARIANT says the same from the environment", () =>
			Effect.gen(function* () {
				const { env } = yield* spawned({ env: { GIT_SSH_COMMAND: "ssh", GIT_SSH_VARIANT: "tortoiseplink" } });
				assert.isUndefined(env?.GIT_SSH_COMMAND);
			}),
		);

		it.effect("still pins under ssh.variant=auto, which just means 'infer from the basename'", () =>
			Effect.gen(function* () {
				const { env } = yield* spawned({ env: { GIT_SSH_COMMAND: "ssh -p 2222" }, variant: "auto" });
				assert.strictEqual(env?.GIT_SSH_COMMAND, "ssh -p 2222 -o BatchMode=yes");
			}),
		);

		it.effect("recognizes a Windows ssh.exe path written with backslashes", () =>
			Effect.gen(function* () {
				const { env } = yield* spawned({
					env: { GIT_SSH_COMMAND: "C:\\Windows\\System32\\OpenSSH\\ssh.exe" },
				});
				assert.strictEqual(env?.GIT_SSH_COMMAND, "C:\\Windows\\System32\\OpenSSH\\ssh.exe -o BatchMode=yes");
			}),
		);

		it.effect("degrades a failing ConfigProvider to absent rather than escaping the layer", () =>
			Effect.gen(function* () {
				// Git.layer's error channel is `never` by contract. Config.option
				// covers ABSENT input only — a provider whose `load` fails still
				// propagates — so the layer's Effect.catch is what actually holds that
				// contract, and this is the only test that exercises it.
				const failing = ConfigProvider.make(() =>
					Effect.fail(new ConfigProvider.SourceError({ message: "provider unavailable" })),
				);
				let captured: ChildProcess.StandardCommand["options"] | undefined;
				const recording = Layer.succeed(
					ChildProcessSpawner.ChildProcessSpawner,
					ChildProcessSpawner.make((command) => {
						if (!ChildProcess.isStandardCommand(command)) return Effect.die("piped commands not scripted");
						captured = command.options;
						return Effect.succeed(
							ChildProcessSpawner.makeHandle({
								pid: ChildProcessSpawner.ProcessId(1),
								exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(isSshProbe(command.args) ? 1 : 0)),
								isRunning: Effect.succeed(false),
								kill: () => Effect.void,
								stdin: Sink.drain,
								stdout: Stream.make(new TextEncoder().encode("abc123\n")),
								stderr: Stream.empty,
								all: Stream.empty,
								getInputFd: () => Sink.drain,
								getOutputFd: () => Stream.empty,
								unref: Effect.succeed(Effect.void),
							}),
						);
					}),
				);
				yield* Effect.gen(function* () {
					const git = yield* Git;
					return yield* git.lsRemote(cwd, "ssh://git@example.invalid/x.git");
				}).pipe(provideGit(recording, failing));
				// An unreadable provider is answered with the pin that cannot hang.
				assert.strictEqual(captured?.env?.GIT_SSH_COMMAND, "ssh -o BatchMode=yes");
			}),
		);

		// Each of the seven members that reaches a remote must route through
		// `runForNetwork`. Nothing else pins that: a member reverted to `runFor`
		// still passes its own tests, which only assert argv, and the vanished
		// probe is invisible to them because `withoutSshProbe` swallows it by
		// argv regardless of who emitted it. This table is the only guard.
		const NETWORK_MEMBERS: ReadonlyArray<{
			readonly name: string;
			readonly call: (git: Git["Service"]) => Effect.Effect<
				unknown,
				GitCommandError | NotARepositoryError | UnknownRefError | NonFastForwardError | MergeConflictError | DirtyWorktreeError
			>;
		}> = [
			{ name: "lsRemote", call: (git) => git.lsRemote(cwd, "ssh://git@example.invalid/x.git") },
			{ name: "fetch", call: (git) => git.fetch(cwd, { ref: "main", remote: "origin" }) },
			{ name: "fetchUnshallow", call: (git) => git.fetchUnshallow(cwd, { remote: "origin" }) },
			{ name: "push", call: (git) => git.push(cwd, { remote: "origin", refspec: "main" }) },
			{ name: "pull", call: (git) => git.pull(cwd, { remote: "origin", ref: "main" }) },
			{
				name: "submoduleAdd",
				call: (git) => git.submoduleAdd(cwd, { url: "ssh://git@example.invalid/m.git", path: "m" }),
			},
			{ name: "submoduleUpdate", call: (git) => git.submoduleUpdate(cwd, { init: true }) },
		];

		for (const member of NETWORK_MEMBERS) {
			it.effect(`${member.name} resolves the ssh pin — it reaches a remote`, () =>
				Effect.gen(function* () {
					const seen: Array<{
						readonly args: ReadonlyArray<string>;
						readonly options: ChildProcess.StandardCommand["options"];
					}> = [];
					const recording = Layer.succeed(
						ChildProcessSpawner.ChildProcessSpawner,
						ChildProcessSpawner.make((command) => {
							if (!ChildProcess.isStandardCommand(command)) return Effect.die("piped commands not scripted");
							seen.push({ args: command.args, options: command.options });
							return Effect.succeed(
								ChildProcessSpawner.makeHandle({
									pid: ChildProcessSpawner.ProcessId(1),
									exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(isSshProbe(command.args) ? 1 : 0)),
									isRunning: Effect.succeed(false),
									kill: () => Effect.void,
									stdin: Sink.drain,
									stdout: Stream.empty,
									stderr: Stream.empty,
									all: Stream.empty,
									getInputFd: () => Sink.drain,
									getOutputFd: () => Stream.empty,
									unref: Effect.succeed(Effect.void),
								}),
							);
						}),
					);
					yield* Effect.gen(function* () {
						const git = yield* Git;
						return yield* member.call(git);
					}).pipe(
						provideGit(recording),
						Effect.catchCause(() => Effect.void),
					);
					const invocation = seen.find((spawn) => !isSshProbe(spawn.args));
					assert.isDefined(invocation);
					assert.strictEqual(invocation.options.env?.GIT_SSH_COMMAND, "ssh -o BatchMode=yes");
				}),
			);
		}

		it.effect("reads the ambient environment ONCE, at layer construction", () =>
			Effect.gen(function* () {
				// Two members off one service instance must carry the same pins: the
				// environment read is a property of the instance, not of a call.
				let reads = 0;
				const counting = ConfigProvider.make((path) => {
					if (path.join(".").includes("GIT_SSH_COMMAND")) reads += 1;
					return Effect.as(Effect.void, undefined);
				});
				yield* Effect.gen(function* () {
					const git = yield* Git;
					// Two NETWORK members: both enter resolveSshEnv, so `reads === 1`
					// discriminates a per-call provider re-read. Two revParse calls
					// would only prove the layer itself reads once.
					yield* git.lsRemote(cwd, "ssh://git@example.invalid/x.git");
					yield* git.lsRemote(cwd, "ssh://git@example.invalid/x.git");
				}).pipe(
					provideGit(scripted(withoutSshProbe(() => ({ stdout: "abc123\n" }))), counting),
				);
				assert.strictEqual(reads, 1);
			}),
		);
	});
});
