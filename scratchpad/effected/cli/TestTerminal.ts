import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import type * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Queue from "effect/Queue";
import * as S from "effect/Schema";
import * as Terminal from "effect/Terminal";

const $I = $ScratchpadId.create("effected/cli/TestTerminal");

/**
 * One key press for {@link TestTerminal}.
 *
 * **Details**
 *
 * `name` is any string, so a test can send a key the prompts do not know. Each modifier may be omitted or
 * explicitly `undefined`; both read as "not held" when the key is queued. `TestTerminalHandle.input` takes these
 * values as typed and never decodes them.
 *
 * **Example** (Check a key press)
 *
 * ```ts
 * import { KeyInput } from "@beep/scratchpad/effected/cli/TestTerminal"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(KeyInput)({ name: "c", ctrl: true })) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const KeyInput = S.Struct({
	/** The key name the prompts switch on: `down`, `up`, `enter`, `space`, `escape`, or a character. */
	name: S.String.annotate(
		$I.annote("KeyInput.name", {
			description: "The key name the prompts switch on, such as down, up, enter, space, escape or a single character; any string is accepted.",
		}),
	),
	/** Whether Ctrl is held. */
	ctrl: S.optional(S.Boolean).annotate(
		$I.annote("KeyInput.ctrl", { description: "Whether Ctrl is held; omitted or undefined is queued as not held." }),
	),
	/** Whether Meta is held. */
	meta: S.optional(S.Boolean).annotate(
		$I.annote("KeyInput.meta", { description: "Whether Meta is held; omitted or undefined is queued as not held." }),
	),
	/** Whether Shift is held. */
	shift: S.optional(S.Boolean).annotate(
		$I.annote("KeyInput.shift", { description: "Whether Shift is held; omitted or undefined is queued as not held." }),
	),
}).annotate($I.annote("KeyInput", { description: "One scripted key press queued into a TestTerminal." }));
/**
 * One key press for {@link TestTerminal}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type KeyInput = typeof KeyInput.Type;

/**
 * What {@link TestTerminal.make} builds: the `Terminal` layer and the means to drive and inspect it.
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export interface TestTerminalHandle {
	/**
	 * Provides `Terminal` backed by this double.
	 *
	 * @since 0.0.0
	 */
	readonly layer: Layer.Layer<Terminal.Terminal>;
	/**
	 * Queue key presses, as if the user had typed them.
	 *
	 * @since 0.0.0
	 */
	readonly input: (keys: ReadonlyArray<KeyInput>) => Effect.Effect<void>;
	/**
	 * Queue `text` one character at a time.
	 *
	 * @since 0.0.0
	 */
	readonly type: (text: string) => Effect.Effect<void>;
	/**
	 * End the input, as Ctrl-C or end-of-file does: a prompt waiting for a key is quit.
	 *
	 * @since 0.0.0
	 */
	readonly end: Effect.Effect<void>;
	/**
	 * Everything written to the terminal so far, prompt frames and escape codes included.
	 *
	 * @since 0.0.0
	 */
	readonly output: Effect.Effect<string>;
	/**
	 * How many queued key presses nobody has taken yet.
	 *
	 * @since 0.0.0
	 */
	readonly pending: Effect.Effect<number>;
	/**
	 * What the program did with the input: `keys` taken from it, `lines` read with `readLine`, and
	 * `subscriptions` to `readInput`. All `0` proves a code path never touched the terminal's input. Counting the
	 * subscription matters: on a real terminal merely subscribing attaches a reader to stdin, even when no key is
	 * ever taken.
	 *
	 * @since 0.0.0
	 */
	readonly reads: Effect.Effect<{
		readonly keys: number;
		readonly lines: number;
		readonly subscriptions: number;
	}>;
}

/**
 * A scripted `Terminal` for testing prompts and anything that reads the terminal.
 *
 * **Details**
 *
 * Queue keys with `input` or `type`, run the program under `layer`, then read `output`. To assert that a code path
 * did NOT touch the terminal, queue some keys first and check `reads` is all zero (no subscription, no key, no
 * line) and `pending` is unchanged afterwards. Only
 * available from the testing entry point `@beep/scratchpad/effected/cli/testing`.
 *
 * **Example** (Inspect untouched queued input)
 *
 * ```ts
 * import { TestTerminal } from "@beep/scratchpad/effected/cli/TestTerminal"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const terminal = yield* TestTerminal.make()
 *   yield* terminal.input([{ name: "enter" }])
 *   const reads = yield* terminal.reads
 *   const pending = yield* terminal.pending
 *   return reads.keys === 0 && reads.lines === 0 && reads.subscriptions === 0 && pending === 1
 * })
 * console.log(await Effect.runPromise(program)) // true
 * ```
 *
 * @public
 * @category testing
 * @since 0.0.0
 */
export class TestTerminal {
	private constructor() {}

	/**
	 * Build a test terminal.
	 *
	 * **Example** (Create a terminal with a custom size)
	 *
	 * ```ts
	 * import { TestTerminal } from "@beep/scratchpad/effected/cli/TestTerminal"
	 * import * as Effect from "effect/Effect"
	 *
	 * import * as Terminal from "effect/Terminal"
	 *
	 * const program = Effect.gen(function* () {
	 *   const handle = yield* TestTerminal.make({ columns: 100 })
	 *   return yield* Effect.gen(function* () {
	 *     const terminal = yield* Terminal.Terminal
	 *     return yield* terminal.columns
	 *   }).pipe(Effect.provide(handle.layer))
	 * })
	 * console.log(await Effect.runPromise(program)) // 100
	 * ```
	 *
	 * @param options - the reported size; 80 by 24 by default
	 * @category constructors
	 * @since 0.0.0
	 */
	static readonly make = Effect.fn("make")(function* (options?: {
		readonly columns?: number | undefined;
		readonly rows?: number | undefined;
	}): Effect.fn.Return<TestTerminalHandle> {
		const queue = yield* Queue.unbounded<Terminal.UserInput, Cause.Done>();
		const written: string[] = [];
		let offered = 0;
		let lines = 0;
		let subscriptions = 0;

		const offer = (inputs: ReadonlyArray<Terminal.UserInput>) =>
			Effect.map(Queue.offerAll(queue, inputs), (unaccepted) => {
				offered += inputs.length - unaccepted.length;
			});

		const terminal = Terminal.make({
			columns: Effect.succeed(options?.columns ?? 80),
			rows: Effect.succeed(options?.rows ?? 24),
			readInput: Effect.sync(() => {
				subscriptions++;
				return queue;
			}),
			readLine: Effect.suspend(() => {
				lines++;
				return Effect.fail(Terminal.QuitError.make({}));
			}),
			display: (text) =>
				Effect.sync(() => {
					written.push(text);
				}),
		});

		return {
			layer: Layer.succeed(Terminal.Terminal, terminal),
			input: (keys) =>
				offer(
					keys.map((key) => ({
						input: O.none<string>(),
						key: {
							name: key.name,
							ctrl: key.ctrl ?? false,
							meta: key.meta ?? false,
							shift: key.shift ?? false,
						},
					})),
				),
			type: (text) =>
				offer(
					A.map(A.fromIterable(text), (char) => ({
						input: O.some(char),
						key: { name: char, ctrl: false, meta: false, shift: false },
					})),
				),
			end: Queue.end(queue).pipe(Effect.asVoid),
			output: Effect.sync(() => written.join("")),
			pending: Queue.size(queue),
			reads: Effect.map(Queue.size(queue), (size) => ({ keys: offered - size, lines, subscriptions })),
		} satisfies TestTerminalHandle;
	});
}
