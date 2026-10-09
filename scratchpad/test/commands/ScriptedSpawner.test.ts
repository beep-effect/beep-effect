// The public scripted-spawner fixture is itself load-bearing test machinery —
// every unit suite in this package (and downstream consumers stubbing the
// spawner seam) leans on it — so its contract is tested directly: script
// routing, spawn recording (options, extendEnv), the PlatformError failure
// path, hang, unref observation, and the loud pipeline refusal.

import { assert, describe, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as S from "effect/Schema";
import * as ChildProcess from "effect/process/ChildProcess";
import * as TestClock from "effect/testing/TestClock";
import { CommandFailedError, Run } from "../../effected/commands/Run.ts";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import { ScriptResult, SpawnRecord, ScriptedSpawner } from "../../effected/commands/ScriptedSpawner.ts";

/** Builds each test layer under the program's scope, with fresh per-invocation state. */
const withLayer = <R, E2, R2>(layer: Layer.Layer<R, E2, R2>) => <A, E, R3>(program: Effect.Effect<A, E, R3>) =>
 Effect.scopedWith((scope) => Effect.flatMap(
  Layer.buildWithScope(layer, scope),
  (context) => Effect.provideContext(program, context),
 ));

const cmd = (executable = "tool", args: ReadonlyArray<string> = []) => ChildProcess.make(executable, args);

describe("ScriptedSpawner.make", () => {
	it.effect("routes by executable and argv", () =>
		Effect.gen(function* () {
			const spawner = ScriptedSpawner.make((command, args) =>
				command === "git" && args[0] === "rev-parse" ? { stdout: "abc123\n" } : { stdout: "other\n" },
			);
			const sha = yield* Run.text(cmd("git", ["rev-parse", "HEAD"])).pipe(withLayer(spawner.layer));
			const other = yield* Run.text(cmd("npm", ["--version"])).pipe(withLayer(spawner.layer));
			assert.strictEqual(sha, "abc123");
			assert.strictEqual(other, "other");
		}),
	);

	it.effect("an empty ScriptResult scripts a silent success", () =>
		Effect.gen(function* () {
			const spawner = ScriptedSpawner.make(() => ({}));
			const output = yield* Run.collect(cmd()).pipe(withLayer(spawner.layer));
			assert.strictEqual(output.stdout, "");
			assert.strictEqual(output.stderr, "");
			assert.strictEqual(output.exitCode, 0);
		}),
	);

	it.effect("records command, args, cwd, env and extendEnv, plus the full options", () =>
		Effect.gen(function* () {
			const spawner = ScriptedSpawner.make(() => ({ stdout: "ok" }));
			const command = cmd("pnpm", ["store", "path"]).pipe(ChildProcess.setCwd("/repo"), Run.extendEnv({ CI: "1" }));
			yield* Run.collect(command).pipe(withLayer(spawner.layer));
			const record = spawner.spawns[0];
			assert.strictEqual(record?.command, "pnpm");
			assert.deepStrictEqual(record?.args, ["store", "path"]);
			assert.strictEqual(record?.cwd, "/repo");
			assert.deepStrictEqual(record?.env, { CI: "1" });
			assert.strictEqual(record?.extendEnv, true);
			// The conveniences are lifted from the full options, which stay readable.
			assert.strictEqual(record?.options.cwd, "/repo");
			assert.deepStrictEqual(record?.options.env, { CI: "1" });
		}),
	);

	it.effect("records spawns in call order, only when the effect actually runs", () =>
		Effect.gen(function* () {
			const spawner = ScriptedSpawner.make(() => ({}));
			const program = Run.collect(cmd("first")).pipe(withLayer(spawner.layer));
			// Constructed but not yet run: nothing may be recorded.
			assert.lengthOf(spawner.spawns, 0);
			yield* program;
			yield* Run.collect(cmd("second")).pipe(withLayer(spawner.layer));
			assert.deepStrictEqual(
				spawner.spawns.map((record) => record.command),
				["first", "second"],
			);
		}),
	);

	it.effect("a scripted notFound fails the spawn as kind 'spawn' with notFound set — and is still recorded", () =>
		Effect.gen(function* () {
			const spawner = ScriptedSpawner.make((command) => ScriptedSpawner.notFound(command));
			const error = yield* Effect.flip(Run.collect(cmd("missing")).pipe(withLayer(spawner.layer)));
			assert.instanceOf(error, CommandFailedError);
			if (S.is(CommandFailedError)(error)) {
				assert.strictEqual(error.kind, "spawn");
				assert.isTrue(error.notFound, "a NotFound system error must classify as absent");
			}
			assert.lengthOf(spawner.spawns, 1, "a failed spawn is a probe and must be recorded");
		}),
	);

	it.effect("a scripted permissionDenied is kind 'spawn' but NOT notFound", () =>
		Effect.gen(function* () {
			const spawner = ScriptedSpawner.make((command) => ScriptedSpawner.permissionDenied(command));
			const error = yield* Effect.flip(Run.collect(cmd("blocked")).pipe(withLayer(spawner.layer)));
			assert.instanceOf(error, CommandFailedError);
			if (S.is(CommandFailedError)(error)) {
				assert.strictEqual(error.kind, "spawn");
				assert.isFalse(error.notFound);
			}
		}),
	);

	it.effect("hang never resolves exitCode, so an opted-in timeout fires", () =>
		Effect.gen(function* () {
			const spawner = ScriptedSpawner.make(() => ({ hang: true }));
			const fiber = yield* Run.collect(cmd(), { timeout: "30 seconds" }).pipe(
				withLayer(spawner.layer), Effect.flip, Effect.forkChild,
			);
			yield* TestClock.adjust("31 seconds");
			const error = yield* Fiber.join(fiber);
			assert.instanceOf(error, CommandFailedError);
			if (S.is(CommandFailedError)(error)) {
				assert.strictEqual(error.kind, "timeout");
			}
		}),
	);

	it.effect("unrefed flips only when the handle's unref actually RUNS", () =>
		Effect.gen(function* () {
			const spawner = ScriptedSpawner.make(() => ({}));
			yield* Run.collect(cmd("plain")).pipe(withLayer(spawner.layer));
			yield* Run.detach(cmd("daemon")).pipe(withLayer(spawner.layer));
			assert.isFalse(spawner.spawns[0]?.unrefed, "a plain run must not report unref");
			assert.isTrue(spawner.spawns[1]?.unrefed, "detach runs unref before its scope closes");
		}),
	);

	it.effect("a piped command dies loudly with the documented message", () =>
		Effect.gen(function* () {
			const spawner = ScriptedSpawner.make(() => ({}));
			const piped = ChildProcess.pipeTo(cmd("producer"), cmd("consumer"));
			const exit = yield* Effect.exit(Run.collect(piped).pipe(withLayer(spawner.layer)));
			assert.isTrue(Exit.isFailure(exit));
			if (Exit.isFailure(exit)) {
				assert.isFalse(exit.cause.reasons.some(Cause.isFailReason), "must be a die, never a typed failure");
				assert.isTrue(Cause.hasDies(exit.cause));
				const defect = exit.cause.reasons.filter(Cause.isDieReason).map((reason) => reason.defect)[0];
				assert.instanceOf(defect, Error);
				assert.include(defect.message, "piped command");
			}
			assert.lengthOf(spawner.spawns, 0, "a refused pipeline must not be recorded as a spawn");
		}),
	);
});


it("ScriptResult retains optional fields, platform errors and the upstream numeric domain", () => {
 assert.isTrue(S.is(ScriptResult)({}));
 assert.isTrue(S.is(ScriptResult)({ stdout: undefined, stderr: undefined, exit: undefined, hang: undefined }));
 assert.isTrue(S.is(ScriptResult)({ stdout: "ok", exit: 1.5, hang: true }));
 assert.isTrue(S.is(ScriptResult)({ exit: Number.POSITIVE_INFINITY }));
 const platformError = ScriptedSpawner.notFound("tool");
 assert.isTrue(S.is(ScriptResult)(platformError));
 const decode = (input: unknown) => S.decodeUnknownOption(ScriptResult)(input);
 const decoded = decode(platformError);
 if (decoded._tag !== "Some") assert.fail("expected the platform error carrier");
 assert.strictEqual(decoded.value, platformError);
 assert.isFalse(S.is(ScriptResult)({ stdout: 1 }));
 assert.isFalse(S.is(ScriptResult)({ hang: "true" }));
});

it("SpawnRecord retains complete options, opaque objects and writable unref state", () => {
 const options: ChildProcess.CommandOptions = {
  cwd: "/repo", env: { MARKER: undefined }, extendEnv: true, shell: "/bin/sh", detached: true, windowsHide: false,
  killSignal: "SIGTERM", forceKillAfter: { milliseconds: 50 },
  stdin: { stream: Stream.empty, endOnDone: false, encoding: "utf-8" },
  stdout: { stream: Sink.succeed(new Uint8Array()) }, stderr: "pipe",
  additionalFds: { fd3: { type: "input", stream: Stream.empty }, fd4: { type: "output", sink: Sink.succeed(new Uint8Array()) } },
 };
 const record = { command: "tool", args: [], cwd: options.cwd, env: options.env, extendEnv: options.extendEnv, options, unrefed: false };
 assert.isTrue(S.is(SpawnRecord)(record));
 const decode = (input: unknown) => S.decodeUnknownOption(SpawnRecord)(input);
 const decoded = decode(record);
 if (decoded._tag !== "Some") assert.fail("expected a spawn record");
 assert.strictEqual(decoded.value.options, options);
 record.unrefed = true;
 assert.isTrue(record.unrefed);
 assert.isFalse(S.is(SpawnRecord)({ ...record, options: { cwd: 1 } }));
 assert.isFalse(S.is(SpawnRecord)({ ...record, options: { stdin: { stream: {} } } }));
 assert.isFalse(S.is(SpawnRecord)({ ...record, options: { killSignal: "INVALID" } }));
});
