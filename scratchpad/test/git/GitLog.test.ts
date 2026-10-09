// @effect-diagnostics strictEffectProvide:skip-file multipleEffectProvide:skip-file
// The `Git.log` unit suite: argv routing, the record parser's byte shape, the
// unborn-HEAD degrade, and the two pre-spawn refusals. Every case here scripts
// the spawner — `__test__/integration/GitSurface.int.test.ts` is where `log`
// meets a real git binary, a real rename and a real merge.

import { assert, describe, it } from "@effect/vitest";
import { DateTime, Effect, Exit, PlatformError, Schema } from "effect";
import type { GitShape } from "../../effected/git/Git.ts";
import { CommitLogEntry, Git, GitCommandError, NotARepositoryError } from "../../effected/git/Git.ts";
import type { ScriptResult } from "./fixtures.ts";
import { scripted } from "./fixtures.ts";

const cwd = "/repo";

const run = <A, E>(program: Effect.Effect<A, E, Git>, byArgs: (args: ReadonlyArray<string>) => ScriptResult) =>
	program.pipe(Effect.provide(Git.layer), Effect.provide(scripted(byArgs)));

const log = Effect.fn("log")(function* (options?: Parameters<GitShape["log"]>[1]) {
		const git = yield* Git;
		return yield* git.log(cwd, options);
	});

/** Builds one record in git's probed `-z` shape: header, then `\n` and NUL-terminated paths. */
const record = (
	sha: string,
	authoredAt: string,
	committedAt: string,
	authorName: string,
	authorEmail: string,
	paths: ReadonlyArray<string>,
): string => {
	const header = `\x1e${[sha, authoredAt, committedAt, authorName, authorEmail].join("\0")}\0`;
	return paths.length === 0 ? header : `${header}\n${paths.join("\0")}\0`;
};

const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);

describe("Git.log", () => {
	it.effect("decodes a record's five header fields and its --name-only paths", () =>
		Effect.gen(function* () {
			const entries = yield* run(
				log(),
				(): ScriptResult => ({
					stdout: record(SHA_A, "2026-09-07T20:25:41-04:00", "2026-09-08T09:00:00+02:00", "Ada", "ada@example.com", [
						"src/Git.ts",
						"README.md",
					]),
				}),
			);
			assert.strictEqual(entries.length, 1);
			const entry = entries[0];
			assert.isTrue(Schema.is(CommitLogEntry)(entry));
			assert.strictEqual(entry?.sha, SHA_A);
			assert.strictEqual(entry?.authorName, "Ada");
			assert.strictEqual(entry?.authorEmail, "ada@example.com");
			assert.deepStrictEqual(entry?.paths, ["src/Git.ts", "README.md"]);
			// The offset-bearing ISO decodes to the INSTANT, not the wall clock:
			// -04:00 at 20:25 is 00:25 the next day in UTC.
			assert.strictEqual(entry === undefined ? "" : DateTime.formatIso(entry.authoredAt), "2026-09-08T00:25:41.000Z");
			assert.strictEqual(entry === undefined ? "" : DateTime.formatIso(entry.committedAt), "2026-09-08T07:00:00.000Z");
		}),
	);

	it.effect("keeps a record whose commit touched nothing as an EMPTY path list", () =>
		Effect.gen(function* () {
			// git's default for a merge commit: a header with no diff at all. The
			// discriminating case for the trailing-NUL token — read naively it is
			// one empty-string path, which is a different (and wrong) answer.
			const entries = yield* run(
				log(),
				(): ScriptResult => ({
					stdout:
						record(SHA_A, "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z", "Ada", "ada@example.com", []) +
						record(SHA_B, "2026-01-02T00:00:00Z", "2026-01-02T00:00:00Z", "Ada", "ada@example.com", ["f.txt"]),
				}),
			);
			assert.deepStrictEqual(
				entries.map((entry) => entry.paths),
				[[], ["f.txt"]],
			);
		}),
	);

	it.effect("returns paths raw — a space, a quote and a leading newline all survive", () =>
		Effect.gen(function* () {
			// `-z` disables git's C-style path quoting, so the parser must not undo
			// any. The leading-newline path is the case that discriminates a
			// "strip one separator byte" parser from a "trim the token" one.
			const entries = yield* run(
				log(),
				(): ScriptResult => ({
					stdout: record(SHA_A, "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z", "Ada", "ada@example.com", [
						'\nnl "quoted" name.txt',
						"a b.txt",
					]),
				}),
			);
			assert.deepStrictEqual(entries[0]?.paths, ['\nnl "quoted" name.txt', "a b.txt"]);
		}),
	);

	it.effect("returns an empty listing for empty stdout", () =>
		Effect.gen(function* () {
			const entries = yield* run(log({ paths: ["nosuch.txt"] }), (): ScriptResult => ({ stdout: "" }));
			assert.deepStrictEqual(entries, []);
		}),
	);

	it.effect("degrades an unborn HEAD to the empty listing, not a failure", () =>
		Effect.gen(function* () {
			const entries = yield* run(
				log(),
				(): ScriptResult => ({
					stderr: "fatal: your current branch 'main' does not have any commits yet\n",
					exit: 128,
				}),
			);
			assert.deepStrictEqual(entries, []);
		}),
	);

	it.effect("degrades an unknown-revision HEAD to the empty listing too", () =>
		Effect.gen(function* () {
			// The other spelling of "there is no history here". `Git.log` takes no
			// ref, so there is nothing an UnknownRefError could name.
			const entries = yield* run(
				log(),
				(): ScriptResult => ({
					stderr: "fatal: ambiguous argument 'HEAD': unknown revision or path not in the working tree.\n",
					exit: 128,
				}),
			);
			assert.deepStrictEqual(entries, []);
		}),
	);

	it.effect("keeps `not a git repository` a NotARepositoryError", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				run(log(), (): ScriptResult => ({ stderr: "fatal: not a git repository\n", exit: 128 })),
			);
			assert.isTrue(Schema.is(NotARepositoryError)(error));
		}),
	);

	it.effect("surfaces an unrecognized non-zero exit as a GitCommandError", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				run(log(), (): ScriptResult => ({ stderr: "fatal: something else entirely\n", exit: 128 })),
			);
			assert.isTrue(Schema.is(GitCommandError)(error));
			assert.strictEqual(Schema.is(GitCommandError)(error) ? error.kind : undefined, "failed");
		}),
	);

	it.effect("fails typed — never as a defect — on output it cannot parse", () =>
		Effect.gen(function* () {
			const exit = yield* Effect.exit(run(log(), (): ScriptResult => ({ stdout: "not a record at all\n" })));
			assert.isTrue(Exit.isFailure(exit));
			const error = yield* Effect.flip(run(log(), (): ScriptResult => ({ stdout: "not a record at all\n" })));
			assert.isTrue(Schema.is(GitCommandError)(error));
			assert.include(Schema.is(GitCommandError)(error) ? (error.detail ?? "") : "", "unparseable log output");
		}),
	);

	it.effect("fails typed on a record whose date does not decode", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				run(
					log(),
					(): ScriptResult => ({
						stdout: record(SHA_A, "yesterday", "2026-01-01T00:00:00Z", "Ada", "ada@example.com", ["f.txt"]),
					}),
				),
			);
			assert.isTrue(Schema.is(GitCommandError)(error));
			assert.include(Schema.is(GitCommandError)(error) ? (error.detail ?? "") : "", "undecodable date");
		}),
	);

	it.effect("refuses --follow with anything but exactly one path, WITHOUT spawning", () =>
		Effect.gen(function* () {
			for (const paths of [[], ["a.txt", "b.txt"]]) {
				const error = yield* Effect.flip(
					run(log({ paths, follow: true }), (): ScriptResult => {
						throw new Error("Git.log spawned git despite the --follow guard");
					}),
				);
				assert.isTrue(Schema.is(GitCommandError)(error));
				assert.strictEqual(Schema.is(GitCommandError)(error) ? error.kind : undefined, "refused");
				assert.include(Schema.is(GitCommandError)(error) ? (error.detail ?? "") : "", "refused --follow");
			}
		}),
	);

	it.effect("refuses a fractional or NaN limit, WITHOUT spawning", () =>
		Effect.gen(function* () {
			for (const limit of [1.5, Number.NaN, -1]) {
				const error = yield* Effect.flip(
					run(log({ limit }), (): ScriptResult => {
						throw new Error("Git.log spawned git despite the limit guard");
					}),
				);
				assert.strictEqual(Schema.is(GitCommandError)(error) ? error.kind : undefined, "refused");
			}
		}),
	);

	it.effect("passes the caller's options straight into the argv", () =>
		Effect.gen(function* () {
			let seen: ReadonlyArray<string> = [];
			yield* run(log({ paths: ["docs/a.md"], follow: true, limit: 3, firstParentDiffMerges: true }), (args) => {
				seen = args;
				return { stdout: "" };
			});
			assert.deepStrictEqual(seen, [
				"log",
				"-z",
				"--format=%x1e%H%x00%aI%x00%cI%x00%an%x00%ae",
				"--name-only",
				"--follow",
				"--diff-merges=first-parent",
				"--max-count=3",
				"--",
				"docs/a.md",
			]);
		}),
	);

	it.effect("absorbs a spawn PlatformError into a GitCommandError", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				run(log(), () => PlatformError.systemError({ _tag: "NotFound", module: "ChildProcess", method: "spawn" })),
			);
			assert.isTrue(Schema.is(GitCommandError)(error));
		}),
	);

	it.effect("encodes both dates as UTC — the committer's local offset is NOT preserved", () =>
		Effect.gen(function* () {
			const entry = CommitLogEntry.make({
				sha: SHA_A,
				authoredAt: DateTime.makeUnsafe("2026-09-07T20:25:41-04:00"),
				committedAt: DateTime.makeUnsafe("2026-09-07T20:25:41-04:00"),
				authorName: "Ada",
				authorEmail: "ada@example.com",
				paths: ["f.txt"],
			});
			const encoded = yield* Schema.encodeEffect(CommitLogEntry)(entry);
			// The class IS the schema, so this is the shape a consumer persisting a
			// CommitLogEntry gets: -04:00 has become Z, and the offset is gone.
			assert.strictEqual(encoded.authoredAt, "2026-09-08T00:25:41.000Z");
			assert.strictEqual(encoded.committedAt, "2026-09-08T00:25:41.000Z");
		}),
	);
});
