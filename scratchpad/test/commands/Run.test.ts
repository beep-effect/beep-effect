// @effect-diagnostics strictEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import type * as PlatformError from "effect/PlatformError";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stdio from "effect/Stdio";
import * as Stream from "effect/Stream";
import type { ChildProcessSpawner } from "effect/process";
import { ChildProcess } from "effect/process";
import { TestClock } from "effect/testing";
import { CommandFailedError, CommandOutput, CommandOutputError, Run } from "../../effected/commands/Run.ts";
import type { ScriptResult } from "../../effected/commands/ScriptedSpawner.ts";
import { ScriptedSpawner } from "../../effected/commands/ScriptedSpawner.ts";

const cmd = (executable = "tool", args: ReadonlyArray<string> = []) => ChildProcess.make(executable, args);

/** The common shape: provide a scripted spawner to a program that requires one. */
const withScript = <A, E>(
	program: () => Effect.Effect<A, E, ChildProcessSpawner.ChildProcessSpawner>,
	script: (command: string, args: ReadonlyArray<string>) => ScriptResult,
): Effect.Effect<A, E> => Effect.provide(program(), ScriptedSpawner.make(script).layer);

describe("Run.collect", () => {
	it.effect("returns stdout, stderr and exit code", () =>
		Effect.gen(function* () {
			const output = yield* withScript(
				() => Run.collect(cmd()),
				() => ({
					stdout: "out",
					stderr: "err",
					exit: 0,
				}),
			);
			assert.instanceOf(output, CommandOutput);
			assert.strictEqual(output.stdout, "out");
			assert.strictEqual(output.stderr, "err");
			assert.strictEqual(output.exitCode, 0);
		}),
	);

	it.effect("a NON-ZERO exit is a successful result, not an error", () =>
		// This is core's contract and the package must not silently change it:
		// `collect` reports what happened; `text`/`lines`/`json` are the ones
		// that treat a non-zero exit as failure.
		Effect.gen(function* () {
			const output = yield* withScript(
				() => Run.collect(cmd()),
				() => ({ stdout: "", exit: 42 }),
			);
			assert.strictEqual(output.exitCode, 42);
		}),
	);

	it.effect("a spawn failure fails typed as CommandFailedError with kind 'spawn'", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				withScript(
					() => Run.collect(cmd("missing")),
					() => ScriptedSpawner.notFound("missing"),
				),
			);
			assert.instanceOf(error, CommandFailedError);
			assert.strictEqual(error._tag, "CommandFailedError");
			if (S.is(CommandFailedError)(error)) {
				assert.strictEqual(error.kind, "spawn");
				assert.strictEqual(error.command, "missing");
				assert.isTrue(error.notFound, "a NotFound system error must set notFound");
			}
		}),
	);

	it.effect("a non-NotFound spawn failure is still kind 'spawn' but not notFound", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				withScript(
					() => Run.collect(cmd("blocked")),
					() => ScriptedSpawner.permissionDenied("blocked"),
				),
			);
			if (S.is(CommandFailedError)(error)) {
				assert.strictEqual(error.kind, "spawn");
				assert.isFalse(error.notFound);
			}
		}),
	);

	it.effect("fails typed when captured output exceeds maxOutputBytes", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				withScript(
					() => Run.collect(cmd(), { maxOutputBytes: 8 }),
					() => ({ stdout: "0123456789", exit: 0 }),
				),
			);
			assert.instanceOf(error, CommandOutputError);
			if (S.is(CommandOutputError)(error)) {
				assert.strictEqual(error.kind, "tooLarge");
			}
		}),
	);

	it.effect("output exactly at the cap is accepted", () =>
		Effect.gen(function* () {
			const output = yield* withScript(
				() => Run.collect(cmd(), { maxOutputBytes: 4 }),
				() => ({ stdout: "abcd", exit: 0 }),
			);
			assert.strictEqual(output.stdout, "abcd");
		}),
	);

	it.effect("with no timeout option, a hanging command does NOT fail on its own", () =>
		Effect.gen(function* () {
			// The design's "no default ceiling" decision, pinned: a forked hang is
			// still running after a large virtual-clock advance.
			const fiber = yield* Effect.forkChild(
				withScript(
					() => Run.collect(cmd()),
					() => ({ hang: true }),
				),
			);
			yield* TestClock.adjust("10 minutes");
			// `pollUnsafe` is the non-blocking check: `undefined` means the fiber
			// has not settled, which is exactly the claim — no ceiling was imposed.
			assert.strictEqual(fiber.pollUnsafe(), undefined, "expected the run to still be pending with no timeout");
			yield* Fiber.interrupt(fiber);
		}),
	);

	it.effect("an opted-in timeout fails typed with kind 'timeout'", () =>
		Effect.gen(function* () {
			const fiber = yield* withScript(
				() => Run.collect(cmd(), { timeout: "30 seconds" }),
				() => ({ hang: true }),
			).pipe(Effect.flip, Effect.forkChild);
			yield* TestClock.adjust("31 seconds");
			const error = yield* Fiber.join(fiber);
			assert.instanceOf(error, CommandFailedError);
			if (S.is(CommandFailedError)(error)) {
				assert.strictEqual(error.kind, "timeout");
			}
		}),
	);
});

describe("Run.text", () => {
	it.effect("returns trimmed stdout", () =>
		Effect.gen(function* () {
			const text = yield* withScript(
				() => Run.text(cmd()),
				() => ({ stdout: "  value\n", exit: 0 }),
			);
			assert.strictEqual(text, "value");
		}),
	);

	it.effect("a non-zero exit fails with kind 'nonZero', carrying exitCode and stderr", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				withScript(
					() => Run.text(cmd("tool", ["build"])),
					() => ({ stderr: "boom", exit: 2 }),
				),
			);
			assert.instanceOf(error, CommandFailedError);
			if (S.is(CommandFailedError)(error)) {
				assert.strictEqual(error.kind, "nonZero");
				assert.strictEqual(error.exitCode, 2);
				assert.strictEqual(error.stderr, "boom");
				assert.deepStrictEqual([...error.args], ["build"]);
			}
		}),
	);

	it.effect("the message surfaces stderr, falling back to stdout when stderr is empty", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				withScript(
					() => Run.text(cmd()),
					() => ({ stdout: "npm error here", exit: 1 }),
				),
			);
			assert.include(error.message, "npm error here");
		}),
	);
});

describe("Run.lines", () => {
	it.effect("splits, trims and drops blank lines", () =>
		Effect.gen(function* () {
			const lines = yield* withScript(
				() => Run.lines(cmd()),
				() => ({
					stdout: "a\n  b  \n\n c\n",
					exit: 0,
				}),
			);
			assert.deepStrictEqual([...lines], ["a", "b", "c"]);
		}),
	);

	it.effect("handles CRLF output", () =>
		Effect.gen(function* () {
			const lines = yield* withScript(
				() => Run.lines(cmd()),
				() => ({ stdout: "a\r\nb\r\n", exit: 0 }),
			);
			assert.deepStrictEqual([...lines], ["a", "b"]);
		}),
	);
});

describe("Run.json", () => {
	const Info = S.Struct({ version: S.String });

	it.effect("parses and DECODES stdout through the schema", () =>
		Effect.gen(function* () {
			const info = yield* withScript(
				() => Run.json(cmd(), Info),
				() => ({
					stdout: '{"version":"1.2.3"}',
					exit: 0,
				}),
			);
			assert.deepStrictEqual(info, { version: "1.2.3" });
		}),
	);

	it.effect("unparseable stdout fails with kind 'notJson'", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				withScript(
					() => Run.json(cmd(), Info),
					() => ({ stdout: "not json", exit: 0 }),
				),
			);
			assert.instanceOf(error, CommandOutputError);
			if (S.is(CommandOutputError)(error)) {
				assert.strictEqual(error.kind, "notJson");
			}
		}),
	);

	it.effect("a schema mismatch fails with kind 'schema' — distinguishable from notJson", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				withScript(
					() => Run.json(cmd(), Info),
					() => ({ stdout: '{"version":7}', exit: 0 }),
				),
			);
			assert.instanceOf(error, CommandOutputError);
			if (S.is(CommandOutputError)(error)) {
				assert.strictEqual(error.kind, "schema");
			}
		}),
	);

	it.effect("a non-zero exit fails as a command failure, never as an output failure", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				withScript(
					() => Run.json(cmd(), Info),
					() => ({ stderr: "no", exit: 1 }),
				),
			);
			assert.instanceOf(error, CommandFailedError);
		}),
	);
});

describe("Run.jsonLine", () => {
	const Payload = S.Struct({ ok: S.Boolean });

	it.effect("parses and decodes a clean single-line payload", () =>
		Effect.gen(function* () {
			const payload = yield* withScript(
				() => Run.jsonLine(cmd(), Payload),
				() => ({ stdout: '{"ok":true}', exit: 0 }),
			);
			assert.deepStrictEqual(payload, { ok: true });
		}),
	);

	it.effect("takes the LAST non-empty line — noise before the payload is tolerated", () =>
		Effect.gen(function* () {
			const payload = yield* withScript(
				() => Run.jsonLine(cmd(), Payload),
				() => ({ stdout: 'hook says hello\n{not json either\n{"ok":true}', exit: 0 }),
			);
			assert.deepStrictEqual(payload, { ok: true });
		}),
	);

	it.effect("trailing newlines and whitespace-only lines after the payload are ignored", () =>
		Effect.gen(function* () {
			const payload = yield* withScript(
				() => Run.jsonLine(cmd(), Payload),
				() => ({ stdout: '{"ok":false}\n \n\n', exit: 0 }),
			);
			assert.deepStrictEqual(payload, { ok: false });
		}),
	);

	it.effect("handles CRLF framing", () =>
		Effect.gen(function* () {
			const payload = yield* withScript(
				() => Run.jsonLine(cmd(), Payload),
				() => ({ stdout: 'noise\r\n{"ok":true}\r\n', exit: 0 }),
			);
			assert.deepStrictEqual(payload, { ok: true });
		}),
	);

	it.effect("a NON-ZERO exit with a valid payload still succeeds — the payload outranks the exit code", () =>
		// The documented posture: a protocol payload discriminates success
		// in-band, so a child that crashes AFTER flushing its payload still
		// reported. Callers wanting exit-code semantics use Run.json.
		Effect.gen(function* () {
			const payload = yield* withScript(
				() => Run.jsonLine(cmd(), Payload),
				() => ({ stdout: '{"ok":false}', stderr: "crashed after reporting", exit: 7 }),
			);
			assert.deepStrictEqual(payload, { ok: false });
		}),
	);

	it.effect("empty stdout fails with kind 'notJson', carrying exit code and stderr as context", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				withScript(
					() => Run.jsonLine(cmd(), Payload),
					() => ({ stdout: "", stderr: "boom from node", exit: 7 }),
				),
			);
			assert.instanceOf(error, CommandOutputError);
			if (S.is(CommandOutputError)(error)) {
				assert.strictEqual(error.kind, "notJson");
				assert.strictEqual(error.exitCode, 7);
				assert.strictEqual(error.stderr, "boom from node");
				assert.include(error.message, "exit 7");
				assert.include(error.message, "boom from node");
			}
		}),
	);

	it.effect("a garbage last line fails with kind 'notJson', carrying the captured stdout", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				withScript(
					() => Run.jsonLine(cmd(), Payload),
					() => ({ stdout: "definitely not json\nnor this\n", exit: 0 }),
				),
			);
			assert.instanceOf(error, CommandOutputError);
			if (S.is(CommandOutputError)(error)) {
				assert.strictEqual(error.kind, "notJson");
				assert.strictEqual(error.exitCode, 0);
				assert.strictEqual(error.stdout, "definitely not json\nnor this\n");
			}
		}),
	);

	it.effect("a schema mismatch fails with kind 'schema' — distinguishable from notJson", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				withScript(
					() => Run.jsonLine(cmd(), Payload),
					() => ({ stdout: '{"ok":"yes"}', exit: 0 }),
				),
			);
			assert.instanceOf(error, CommandOutputError);
			if (S.is(CommandOutputError)(error)) {
				assert.strictEqual(error.kind, "schema");
				assert.strictEqual(error.exitCode, 0);
			}
		}),
	);

	it.effect("a spawn failure still fails as CommandFailedError, never an output failure", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				withScript(
					() => Run.jsonLine(cmd("missing"), Payload),
					() => ScriptedSpawner.notFound("missing"),
				),
			);
			assert.instanceOf(error, CommandFailedError);
			if (S.is(CommandFailedError)(error)) {
				assert.strictEqual(error.kind, "spawn");
			}
		}),
	);

	it.effect("the context carried on the error is redacted", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				withScript(
					() => Run.jsonLine(cmd(), Payload, { redact: [Redacted.make("s3cr3t")] }),
					() => ({ stdout: "token is s3cr3t", stderr: "auth failed for s3cr3t", exit: 1 }),
				),
			);
			assert.instanceOf(error, CommandOutputError);
			if (S.is(CommandOutputError)(error)) {
				assert.notInclude(error.stdout ?? "", "s3cr3t");
				assert.notInclude(error.stderr ?? "", "s3cr3t");
				assert.notInclude(error.message, "s3cr3t");
			}
		}),
	);

	it.effect("a trailing log line AFTER the payload is tolerated — the exit-hook case (#292)", () =>
		// The controlled pair from the consumer evidence: a pnpmfile hook logging
		// from `process.on("exit", ...)` writes after the payload has flushed and
		// used to win the "last non-empty line" and break the parse. The scan
		// from the end now walks past it to the payload.
		Effect.gen(function* () {
			const payload = yield* withScript(
				() => Run.jsonLine(cmd(), Payload),
				() => ({ stdout: '{"ok":true}\ncleanup: hook exiting\n', exit: 0 }),
			);
			assert.deepStrictEqual(payload, { ok: true });
		}),
	);

	it.effect("a trailing line that is valid JSON but fails the schema does not displace the payload", () =>
		Effect.gen(function* () {
			const payload = yield* withScript(
				() => Run.jsonLine(cmd(), Payload),
				() => ({ stdout: '{"ok":true}\n{"cleanup":"done"}\n', exit: 0 }),
			);
			assert.deepStrictEqual(payload, { ok: true });
		}),
	);

	it.effect("noise on BOTH sides of the payload is tolerated", () =>
		Effect.gen(function* () {
			const payload = yield* withScript(
				() => Run.jsonLine(cmd(), Payload),
				() => ({ stdout: 'hook says hello\n{"ok":false}\nnot json at all\n \n', exit: 0 }),
			);
			assert.deepStrictEqual(payload, { ok: false });
		}),
	);

	it.effect("when MULTIPLE lines decode under the schema, the LAST one wins — the documented consequence", () =>
		// A child must not emit two schema-valid lines; when one does anyway,
		// the scan from the end makes the later line the payload. Pinned so the
		// documented tie-break cannot drift silently.
		Effect.gen(function* () {
			const payload = yield* withScript(
				() => Run.jsonLine(cmd(), Payload),
				() => ({ stdout: '{"ok":true}\n{"ok":false}\n', exit: 0 }),
			);
			assert.deepStrictEqual(payload, { ok: false });
		}),
	);

	it.effect("nothing decodes but a line parsed as JSON: kind 'schema' with the LAST parseable line's issue", () =>
		// The near-miss diagnostic: the last JSON-parseable line is the most
		// probable intended payload, so its decode failure rides as the cause
		// even when garbage lines follow it.
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				withScript(
					() => Run.jsonLine(cmd(), Payload),
					() => ({ stdout: '{"ok":"yes"}\ntrailing garbage line\n', stderr: "hook stderr", exit: 3 }),
				),
			);
			assert.instanceOf(error, CommandOutputError);
			if (S.is(CommandOutputError)(error)) {
				assert.strictEqual(error.kind, "schema");
				assert.strictEqual(error.exitCode, 3);
				assert.strictEqual(error.stderr, "hook stderr");
				assert.isDefined(error.cause, "the last parseable line's decode failure must ride as the cause");
			}
		}),
	);

	it.effect("no line anywhere is JSON: kind 'notJson', still carrying the run context", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				withScript(
					() => Run.jsonLine(cmd(), Payload),
					() => ({ stdout: "line one\nline two\n", exit: 5 }),
				),
			);
			assert.instanceOf(error, CommandOutputError);
			if (S.is(CommandOutputError)(error)) {
				assert.strictEqual(error.kind, "notJson");
				assert.strictEqual(error.exitCode, 5);
				assert.strictEqual(error.stdout, "line one\nline two\n");
			}
		}),
	);
});

describe("Run.exitCode", () => {
	it.effect("returns a non-zero code without failing", () =>
		Effect.gen(function* () {
			const code = yield* withScript(
				() => Run.exitCode(cmd()),
				() => ({ exit: 3 }),
			);
			assert.strictEqual(code, 3);
		}),
	);

	it.effect("still fails typed when the spawn itself fails", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				withScript(
					() => Run.exitCode(cmd("x")),
					() => ScriptedSpawner.notFound("x"),
				),
			);
			assert.instanceOf(error, CommandFailedError);
		}),
	);
});

describe("Run.succeeds", () => {
	it.effect("true for a zero exit", () =>
		Effect.gen(function* () {
			assert.isTrue(
				yield* withScript(
					() => Run.succeeds(cmd()),
					() => ({ exit: 0 }),
				),
			);
		}),
	);

	it.effect("false for a non-zero exit", () =>
		Effect.gen(function* () {
			assert.isFalse(
				yield* withScript(
					() => Run.succeeds(cmd()),
					() => ({ exit: 1 }),
				),
			);
		}),
	);

	it.effect("false — never a failure — when the executable is absent", () =>
		Effect.gen(function* () {
			assert.isFalse(
				yield* withScript(
					() => Run.succeeds(cmd("missing")),
					() => ScriptedSpawner.notFound("missing"),
				),
			);
		}),
	);
});

describe("Run redaction", () => {
	const token = Redacted.make("s3cr3t");

	it.effect("a declared secret never reaches the error's args", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				withScript(
					() => Run.text(ChildProcess.make("npm", ["publish", "--token", "s3cr3t"]), { redact: [token] }),
					() => ({ stderr: "denied", exit: 1 }),
				),
			);
			if (S.is(CommandFailedError)(error)) {
				assert.notInclude(error.args.join(" "), "s3cr3t");
				assert.notInclude(error.message, "s3cr3t");
			}
		}),
	);

	it.effect("a declared secret never reaches the error's captured output", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				withScript(
					() => Run.text(cmd(), { redact: [token] }),
					() => ({ stderr: "auth failed for s3cr3t", exit: 1 }),
				),
			);
			if (S.is(CommandFailedError)(error)) {
				assert.notInclude(error.stderr ?? "", "s3cr3t");
				assert.notInclude(error.message, "s3cr3t");
			}
		}),
	);

	it.effect("the flag heuristic redacts an UNDECLARED secret in the error", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				withScript(
					() => Run.text(ChildProcess.make("npm", ["publish", "--token", "undeclared"])),
					() => ({ stderr: "denied", exit: 1 }),
				),
			);
			if (S.is(CommandFailedError)(error)) {
				assert.notInclude(error.args.join(" "), "undeclared");
			}
		}),
	);

	it.effect("captured output on the SUCCESS path is redacted too", () =>
		Effect.gen(function* () {
			const output = yield* withScript(
				() => Run.collect(cmd(), { redact: [token] }),
				() => ({ stdout: "token is s3cr3t", exit: 0 }),
			);
			assert.notInclude(output.stdout, "s3cr3t");
		}),
	);
});

describe("Run.collectTee", () => {
	it.effect("tees stdout and stderr to Stdio while still collecting them", () =>
		Effect.gen(function* () {
			const seen: Array<string> = [];
			const capture = (): Sink.Sink<void, string | Uint8Array, never, PlatformError.PlatformError> =>
				// biome-ignore lint/suspicious/useIterableCallbackReturn: Sink.forEach is Effect's sink constructor, not Array#forEach — its callback must return an Effect
				Sink.forEach((chunk: string | Uint8Array) =>
					Effect.sync(() => {
						seen.push(typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk));
					}),
				);
			const output = yield* withScript(
				() => Run.collectTee(cmd()).pipe(Effect.provide(Stdio.layerTest({ stdout: capture, stderr: capture }))),
				() => ({ stdout: "hello", stderr: "warn", exit: 0 }),
			);

			assert.strictEqual(output.stdout, "hello");
			assert.strictEqual(output.stderr, "warn");
			assert.include(seen.join(""), "hello");
			assert.include(seen.join(""), "warn");
		}),
	);
});

describe("Run.stream", () => {
	it.effect("emits decoded lines", () =>
		Effect.gen(function* () {
			const lines = yield* withScript(
				() => Stream.runCollect(Run.stream(cmd())),
				() => ({ stdout: "one\ntwo\n", exit: 0 }),
			);
			assert.deepStrictEqual([...lines], ["one", "two"]);
		}),
	);
});

describe("Run.detach", () => {
	it.effect("unrefs the handle and returns the pid", () =>
		Effect.gen(function* () {
			const spawner = ScriptedSpawner.make(() => ({ exit: 0 }));
			const pid = yield* Effect.provide(Run.detach(cmd("server")), spawner.layer);
			assert.strictEqual(Number(pid), 4242);
			// The invariant the helper exists to encode: unref RAN. Without it the
			// scope's release kills the child and nothing outlives this process.
			assert.isTrue(spawner.spawns[0]?.unrefed, "detach must run handle.unref before the scope closes");
		}),
	);

	it.effect("a spawn failure fails typed", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				withScript(
					() => Run.detach(cmd("missing")),
					() => ScriptedSpawner.notFound("missing"),
				),
			);
			assert.instanceOf(error, CommandFailedError);
			if (S.is(CommandFailedError)(error)) {
				assert.strictEqual(error.kind, "spawn");
			}
		}),
	);
});

describe("Run.extendEnv", () => {
	it.effect("the spawner receives the merged env AND extendEnv true", () =>
		Effect.gen(function* () {
			const spawner = ScriptedSpawner.make(() => ({ stdout: "ok", exit: 0 }));
			const command = ChildProcess.make("tool", ["x"], { env: { FROM_CONSTRUCTION: "a" } }).pipe(
				Run.extendEnv({ FROM_COMBINATOR: "b" }),
			);
			yield* Effect.provide(Run.collect(command), spawner.layer);
			const record = spawner.spawns[0];
			assert.deepStrictEqual(record?.options.env, { FROM_CONSTRUCTION: "a", FROM_COMBINATOR: "b" });
			assert.strictEqual(record?.options.extendEnv, true);
		}),
	);

	it("combinator values win over construction-time env values", () => {
		// Data-first call shape, so both halves of the dual signature are pinned.
		const command = Run.extendEnv(ChildProcess.make("tool", [], { env: { NODE_ENV: "construction" } }), {
			NODE_ENV: "combinator",
		});
		if (!ChildProcess.isStandardCommand(command)) {
			assert.fail("expected a standard command");
		}
		assert.deepStrictEqual(command.options.env, { NODE_ENV: "combinator" });
	});

	it("forces extendEnv true even where construction set it false — the documented contract", () => {
		// Inheriting the parent environment is the combinator's entire purpose;
		// a caller who wants a hermetic env uses core's setEnv/options directly.
		const command = ChildProcess.make("tool", [], { env: { A: "1" }, extendEnv: false }).pipe(
			Run.extendEnv({ B: "2" }),
		);
		if (!ChildProcess.isStandardCommand(command)) {
			assert.fail("expected a standard command");
		}
		assert.strictEqual(command.options.extendEnv, true);
	});

	it("a pipeline gets the env on BOTH sides, with the pipe's own options preserved", () => {
		const piped = ChildProcess.pipeTo(
			ChildProcess.make("producer", [], { env: { LEFT_ONLY: "l" } }),
			ChildProcess.make("consumer", []),
			{ from: "stderr" },
		).pipe(Run.extendEnv({ SHARED: "s" }));
		if (!ChildProcess.isPipedCommand(piped)) {
			assert.fail("expected a piped command");
		}
		assert.deepStrictEqual(piped.options, { from: "stderr" });
		if (!ChildProcess.isStandardCommand(piped.left) || !ChildProcess.isStandardCommand(piped.right)) {
			assert.fail("expected standard commands on both sides");
		}
		assert.deepStrictEqual(piped.left.options.env, { LEFT_ONLY: "l", SHARED: "s" });
		assert.strictEqual(piped.left.options.extendEnv, true);
		assert.deepStrictEqual(piped.right.options.env, { SHARED: "s" });
		assert.strictEqual(piped.right.options.extendEnv, true);
	});

	it.effect("CONTROL: bare core setEnv reaches the spawner with extendEnv UNSET — the trap itself", () =>
		Effect.gen(function* () {
			// This pins the core behavior Run.extendEnv exists to compensate for:
			// ChildProcess.setEnv merges options.env but never sets extendEnv, so the
			// Node spawner resolves the child environment to ONLY these variables
			// (no PATH, no HOME). If a future core beta makes this assertion fail,
			// setEnv started extending — re-evaluate this combinator's raison d'être.
			const spawner = ScriptedSpawner.make(() => ({ stdout: "ok", exit: 0 }));
			const command = ChildProcess.make("tool", []).pipe(ChildProcess.setEnv({ MARKER: "x" }));
			yield* Effect.provide(Run.collect(command), spawner.layer);
			const record = spawner.spawns[0];
			assert.deepStrictEqual(record?.options.env, { MARKER: "x" });
			assert.isUndefined(record?.options.extendEnv);
		}),
	);
});

describe("Run over core Command combinators", () => {
	it.effect("honours cwd and env applied with core's own combinators", () =>
		Effect.gen(function* () {
			// RunOptions deliberately carries no cwd/env — those live on the core
			// Command. This pins that the package consumes them rather than
			// re-declaring them.
			const command = ChildProcess.make("tool", ["x"]).pipe(
				ChildProcess.setCwd("/repo"),
				ChildProcess.setEnv({ LC_ALL: "C" }),
			);
			// A real `if` narrows; `assert.isTrue(guard(x))` would not.
			if (!ChildProcess.isStandardCommand(command)) {
				assert.fail("expected a standard command");
			}
			assert.strictEqual(command.options.cwd, "/repo");
			assert.deepStrictEqual(command.options.env, { LC_ALL: "C" });
			const output = yield* withScript(
				() => Run.collect(command),
				() => ({ stdout: "ok", exit: 0 }),
			);
			assert.strictEqual(output.stdout, "ok");
		}),
	);
});
