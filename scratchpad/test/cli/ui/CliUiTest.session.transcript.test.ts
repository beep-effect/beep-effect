// @effect-diagnostics strictEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import { Console, Deferred, Effect, Fiber, PubSub } from "effect";
import { CliUi, Select } from "../../../effected/cli/ui.ts";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";
import type { Ev } from "../helpers/live.ts";
import { End, Start, optionsOf, tick } from "../helpers/live.ts";

const ESC = String.fromCharCode(0x1b);

/**
 * A handler that draws a live view and reports through its `logConsole`, as reposets' sync does: the report lines
 * belong above the frame, on the terminal, not in the program's own `Console` output.
 */
const syncing = (gate: Deferred.Deferred<void>) =>
	Effect.scoped(
		Effect.gen(function* () {
			const pubsub = yield* PubSub.unbounded<Ev>();
			const subscription = yield* PubSub.subscribe(pubsub);
			const handle = yield* CliUi.live(optionsOf(subscription));
			yield* PubSub.publish(pubsub, Start);
			yield* Deferred.await(gate);
			const report = Effect.gen(function* () {
				yield* Console.log("✓ synced acme/web");
				yield* Console.error("✗ acme/api: 404");
			});
			yield* report.pipe(Effect.provideService(Console.Console, handle.logConsole));
			yield* PubSub.publish(pubsub, tick(1));
			yield* PubSub.publish(pubsub, End);
			yield* handle.close;
			yield* Console.log("done");
		}),
	);

describe("CliUiTest.session: transcript and written", () => {
	it.effect("hold the lines a live view writes above its frame through logConsole, in order, above the frame", () =>
		Effect.gen(function* () {
			const session = yield* CliUiTest.session({ color: "none" });
			const gate = yield* Deferred.make<void>();
			const fiber = yield* Effect.forkScoped(syncing(gate).pipe(Effect.provide(session.layer)));
			const view = yield* session.next({ contains: "RUN 1" });
			assert.include(yield* view.plainFrame, "started");
			yield* Deferred.succeed(gate, undefined);
			yield* Fiber.join(fiber);
			const transcript = (yield* session.transcript).split("\n");
			const synced = transcript.indexOf("✓ synced acme/web");
			const failed = transcript.indexOf("✗ acme/api: 404");
			const frame = transcript.lastIndexOf("RUN 1");
			assert.isAtLeast(synced, 0, `the stdout report line is on the terminal: ${transcript.join(" | ")}`);
			assert.isAbove(failed, synced, "and the stderr one after it: one terminal, as on a real one");
			assert.isAbove(frame, failed, "the committed frame stays below the lines logged above it");
			assert.strictEqual(transcript.at(-1), "ended", "the run's final frame is what is left at the bottom");
			assert.include(yield* session.written, "synced acme/web");
			// Each stream alone: the report's stdout line on stdout only, its stderr line on stderr only.
			const out = yield* session.stdoutWritten;
			const err = yield* session.stderrWritten;
			assert.include(out, "✓ synced acme/web");
			assert.notInclude(out, "✗ acme/api: 404", "the stderr line is not on stdout");
			assert.include(err, "✗ acme/api: 404");
			assert.notInclude(err, "synced acme/web", "the stdout line is not on stderr");
			assert.include(out, "RUN 1", "the frame is drawn on stdout");
			// The program's own Console output is the session's stdout, and the logConsole lines are not.
			assert.strictEqual(yield* session.stdout, "done\n");
			assert.strictEqual(yield* session.stderr, "");
		}).pipe(Effect.scoped),
	);

	it.effect("an empty terminal transcript before anything is drawn", () =>
		Effect.gen(function* () {
			const session = yield* CliUiTest.session();
			assert.strictEqual(yield* session.transcript, "");
			assert.strictEqual(yield* session.written, "");
			assert.strictEqual(yield* session.stdoutWritten, "");
			assert.strictEqual(yield* session.stderrWritten, "");
		}).pipe(Effect.scoped),
	);
});

const paint = (code: number, text: string) => `${ESC}[${code}m${text}${ESC}[39m`;

/** A live view whose logConsole prints a painted counter on stdout (paint breaking it mid-line) and a painted line on stderr. */
const counting = (gate: Deferred.Deferred<void>) =>
	Effect.scoped(
		Effect.gen(function* () {
			const pubsub = yield* PubSub.unbounded<Ev>();
			const subscription = yield* PubSub.subscribe(pubsub);
			const handle = yield* CliUi.live(optionsOf(subscription));
			yield* PubSub.publish(pubsub, Start);
			yield* Deferred.await(gate);
			const report = Effect.gen(function* () {
				yield* Console.log(`Dry run ${paint(32, "0")}/2 ${paint(90, "repos")}`);
				yield* Console.error(paint(31, "✗ acme/api: 404"));
			});
			yield* report.pipe(Effect.provideService(Console.Console, handle.logConsole));
			yield* PubSub.publish(pubsub, End);
			yield* handle.close;
		}),
	);

describe("CliUiTest.session: per-stream transcripts", () => {
	it.effect("read each stream as unpainted text, a painted counter as one contiguous string", () =>
		Effect.gen(function* () {
			const session = yield* CliUiTest.session({ color: "none" });
			const gate = yield* Deferred.make<void>();
			const fiber = yield* Effect.forkScoped(counting(gate).pipe(Effect.provide(session.layer)));
			yield* session.next({ contains: "RUN 1" });
			yield* Deferred.succeed(gate, undefined);
			yield* Fiber.join(fiber);
			const out = yield* session.stdoutTranscript;
			const err = yield* session.stderrTranscript;
			assert.include(yield* session.stdoutWritten, paint(32, "0"), "control: the raw bytes are painted and split");
			assert.notInclude(yield* session.stdoutWritten, "Dry run 0/2 repos", "control: raw bytes break the counter");
			assert.notInclude(out, ESC, "stdoutTranscript carries no escape sequences");
			assert.notInclude(err, ESC, "stderrTranscript carries no escape sequences");
			assert.include(out, "Dry run 0/2 repos");
			assert.notInclude(out, "acme/api", "stdout holds none of stderr's text");
			assert.strictEqual(err, "✗ acme/api: 404");
		}).pipe(Effect.scoped),
	);

	it.effect("an empty transcript for each stream before anything is drawn", () =>
		Effect.gen(function* () {
			const session = yield* CliUiTest.session();
			assert.strictEqual(yield* session.stdoutTranscript, "");
			assert.strictEqual(yield* session.stderrTranscript, "");
		}).pipe(Effect.scoped),
	);
});

const profile = Select.screen({
	message: "Profile",
	choices: [
		{ label: "software-project", value: "software-project" },
		{ label: "library", value: "library" },
	],
});

const pick = Effect.fn("pick")(function* (clear: boolean) {
		const chosen = yield* CliUi.run(profile, clear ? { clear: true } : undefined);
		yield* Console.log(chosen);
	});

describe("CliUiTest.session with renderPath: production", () => {
	const answered = Effect.fn("answered")(function* (clear: boolean) {
			const session = yield* CliUiTest.session({ renderPath: "production", color: "none" });
			const fiber = yield* Effect.forkScoped(pick(clear).pipe(Effect.provide(session.layer)));
			const screen = yield* session.next({ contains: "Profile" });
			assert.include(yield* screen.plainFrame, "software-project", "next and frames read a production screen");
			yield* screen.press("down", "enter");
			yield* Fiber.join(fiber);
			assert.strictEqual(yield* session.stdout, "library\n");
			return { transcript: yield* session.transcript, written: yield* session.written };
		}, Effect.scoped);

	it.effect("a screen run with clear: true leaves nothing on the terminal", () =>
		Effect.gen(function* () {
			const { transcript, written } = yield* answered(true);
			assert.notInclude(transcript, "Profile");
			assert.include(written, "Profile", "it was drawn: the clear erased it");
			assert.include(written, `${ESC}[`, "with Ink's erase moves");
		}),
	);

	it.effect("a cleared frame is absent from stdoutTranscript and present in stdoutWritten", () =>
		Effect.gen(function* () {
			const session = yield* CliUiTest.session({ renderPath: "production", color: "none" });
			const fiber = yield* Effect.forkScoped(pick(true).pipe(Effect.provide(session.layer)));
			yield* (yield* session.next({ contains: "Profile" })).press("down", "enter");
			yield* Fiber.join(fiber);
			assert.notInclude(yield* session.stdoutTranscript, "Profile");
			assert.include(yield* session.stdoutWritten, "Profile");
		}).pipe(Effect.scoped),
	);

	it.effect("control: without clear the answered frame stays on the terminal", () =>
		Effect.gen(function* () {
			const { transcript } = yield* answered(false);
			assert.include(transcript, "Profile");
			assert.include(transcript, "library");
		}),
	);

	it.effect("control: on the default debug path, clear is not observable", () =>
		Effect.gen(function* () {
			const session = yield* CliUiTest.session({ color: "none" });
			const fiber = yield* Effect.forkScoped(pick(true).pipe(Effect.provide(session.layer)));
			yield* (yield* session.next({ contains: "Profile" })).press("enter");
			yield* Fiber.join(fiber);
			assert.include(yield* session.transcript, "Profile");
		}).pipe(Effect.scoped),
	);
});
