// @effect-diagnostics strictEffectProvide:skip-file multipleEffectProvide:skip-file asyncFunction:skip-file
import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Runtime from "effect/Runtime";
import { Command, Flag } from "effect/cli";
import { Cancelled, CliInteractive, CliPrompt, CliRuntime, CliTheme } from "../../../effected/cli/index.ts";
import { TestTerminal } from "../../../effected/cli/testing.ts";
import type { Screen } from "../../../effected/cli/ui.ts";
import { CliUi, Confirm, Select } from "../../../effected/cli/ui.ts";
import type { CliUiTestSession } from "../../../effected/cli/ui-testing.ts";
import { CliUiTest } from "../../../effected/cli/ui-testing.ts";

const proceed: Screen<boolean> = CliUi.map(Confirm.screen({ message: "Publish?" }), (result) => result.confirmed);

const exitCode = (exit: Exit.Exit<unknown, unknown>): number =>
	Exit.isFailure(exit) ? exit.cause.pipe(Cause.squash, Runtime.getErrorExitCode) : 0;

/** The "confirm, or pass --yes" shape: a boolean flag whose fallback is a mapped Confirm. */
const app = Command.make("tool").pipe(
	Command.withSubcommands([
		Command.make(
			"publish",
			{
				yes: Flag.Boolean("yes").pipe(
					Flag.withFallbackPrompt(CliUi.fallback(proceed, { flag: "yes", otherwise: false })),
				),
			},
			({ yes }) => Console.log(`yes=${yes}`),
		),
	]),
);

const platform = Effect.map(TestTerminal.make(), (terminal) =>
	Layer.mergeAll(NodeServices.layer, CliPrompt.gateTerminal.pipe(Layer.provide(terminal.layer))),
);

const run = (argv: ReadonlyArray<string>, session: CliUiTestSession) =>
	Effect.flatMap(platform, (layer) =>
		CliRuntime.main(Command.runWith(app, { version: "1.0.0" })(argv), { platform: layer }).pipe(
			Effect.provide(session.layer),
			Effect.exit,
			Effect.map(exitCode),
		),
	);

describe("CliUi.map", () => {
	it.effect("resolves with the mapped value: Confirm's whole result becomes its confirmed boolean", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(proceed);
			yield* handle.press({ char: "y" }, "enter");
			const answer: boolean = yield* handle.result;
			assert.strictEqual(answer, true);
		}).pipe(Effect.scoped),
	);

	it.effect("a cancel passes through unchanged, as the same Cancelled with its reason", () =>
		Effect.gen(function* () {
			const handle = yield* CliUiTest.render(proceed);
			yield* handle.press("escape");
			const error = yield* Effect.flip(handle.result);
			assert.instanceOf(error, Cancelled);
			assert.strictEqual(error.reason, "escape");
		}).pipe(Effect.scoped),
	);

	it.effect("f sees exactly the inner screen's value, and runs only when it resolves", () =>
		Effect.gen(function* () {
			const seen: Array<string> = [];
			const choices = [
				{ label: "a", value: "a" },
				{ label: "b", value: "b" },
			];
			const mapped = CliUi.map(Select.screen({ message: "Pick", choices }), (value) => {
				seen.push(value);
				return value.length;
			});
			const handle = yield* CliUiTest.render(mapped);
			yield* handle.press("down");
			assert.deepStrictEqual(seen, [], "nothing is mapped before the screen resolves");
			yield* handle.press("enter");
			assert.strictEqual(yield* handle.result, 1);
			assert.deepStrictEqual(seen, ["b"]);
		}).pipe(Effect.scoped),
	);

	it.effect("composes with CliUi.lazy, both ways round", () =>
		Effect.gen(function* () {
			const lazyInner = CliUi.map(
				CliUi.lazy(async () => ({ default: Confirm.screen({ message: "Lazy?" }) })),
				(result) => result.confirmed,
			);
			const outer = CliUi.lazy(async () => ({ default: proceed }));
			const first = yield* Effect.scoped(
				Effect.gen(function* () {
					const handle = yield* CliUiTest.render(lazyInner);
					yield* handle.press({ char: "y" }, "enter");
					return yield* handle.result;
				}),
			);
			const second = yield* Effect.scoped(
				Effect.gen(function* () {
					const handle = yield* CliUiTest.render(outer);
					yield* handle.press({ char: "n" }, "enter");
					return yield* handle.result;
				}),
			);
			assert.deepStrictEqual([first, second], [true, false]);
		}),
	);

	it.effect("composes with CliUi.prompt: not interactive, otherwise is the mapped type", () =>
		Effect.gen(function* () {
			const answer: boolean = yield* CliUi.prompt(proceed, { otherwise: true });
			assert.isTrue(answer);
		}).pipe(Effect.provide(CliTheme.layerTest()), Effect.provide(CliInteractive.layerTest(false))),
	);

	describe("behind a boolean flag with CliUi.fallback", () => {
		it.effect("--yes given: true, and no screen mounts", () =>
			Effect.gen(function* () {
				const session = yield* CliUiTest.session();
				assert.strictEqual(yield* run(["publish", "--yes"], session), 0);
				assert.strictEqual(yield* session.stdout, "yes=true\n");
				assert.strictEqual(yield* session.mounts, 0);
			}).pipe(Effect.scoped),
		);

		it.effect("absent and interactive: the Confirm's answer is the flag's boolean", () =>
			Effect.gen(function* () {
				const session = yield* CliUiTest.session();
				const program = yield* Effect.forkScoped(run(["publish"], session));
				yield* (yield* session.next({ contains: "Publish?" })).press({ char: "y" }, "enter");
				assert.strictEqual(yield* Fiber.join(program), 0, yield* session.stderr);
				assert.strictEqual(yield* session.stdout, "yes=true\n");
			}).pipe(Effect.scoped),
		);

		it.effect("absent and not interactive: otherwise, false", () =>
			Effect.gen(function* () {
				const session = yield* CliUiTest.session({ interactive: false });
				assert.strictEqual(yield* run(["publish"], session), 0);
				assert.strictEqual(yield* session.stdout, "yes=false\n");
				assert.strictEqual(yield* session.mounts, 0);
			}).pipe(Effect.scoped),
		);
	});
});
