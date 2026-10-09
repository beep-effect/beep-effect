import type { Cause } from "effect";
import { Effect, Layer, Option, Queue, Terminal } from "effect";

/**
 * One key press for {@link TestTerminal}.
 *
 * @public
 */
export interface KeyInput {
	/** The key name the prompts switch on: `down`, `up`, `enter`, `space`, `escape`, or a character. */
	readonly name: string;
	/** Whether Ctrl is held. */
	readonly ctrl?: boolean | undefined;
	/** Whether Meta is held. */
	readonly meta?: boolean | undefined;
	/** Whether Shift is held. */
	readonly shift?: boolean | undefined;
}

/**
 * What {@link TestTerminal.make} builds: the `Terminal` layer and the means to drive and inspect it.
 *
 * @public
 */
export interface TestTerminalHandle {
	/** Provides `Terminal` backed by this double. */
	readonly layer: Layer.Layer<Terminal.Terminal>;
	/** Queue key presses, as if the user had typed them. */
	readonly input: (keys: ReadonlyArray<KeyInput>) => Effect.Effect<void>;
	/** Queue `text` one character at a time. */
	readonly type: (text: string) => Effect.Effect<void>;
	/** End the input, as Ctrl-C or end-of-file does: a prompt waiting for a key is quit. */
	readonly end: Effect.Effect<void>;
	/** Everything written to the terminal so far, prompt frames and escape codes included. */
	readonly output: Effect.Effect<string>;
	/** How many queued key presses nobody has taken yet. */
	readonly pending: Effect.Effect<number>;
	/**
	 * What the program did with the input: `keys` taken from it, `lines` read with `readLine`, and
	 * `subscriptions` to `readInput`. All `0` proves a code path never touched the terminal's input. Counting the
	 * subscription matters: on a real terminal merely subscribing attaches a reader to stdin, even when no key is
	 * ever taken.
	 */
	readonly reads: Effect.Effect<{ readonly keys: number; readonly lines: number; readonly subscriptions: number }>;
}

/**
 * A scripted `Terminal` for testing prompts and anything that reads the terminal.
 *
 * @remarks
 * Queue keys with `input` or `type`, run the program under `layer`, then read `output`. To assert that a code path
 * did NOT touch the terminal, queue some keys first and check `reads` is all zero (no subscription, no key, no
 * line) and `pending` is unchanged afterwards. Only
 * available from `@effected/cli/testing`.
 *
 * @public
 */
export class TestTerminal {
	private constructor() {}

	/**
	 * Build a test terminal.
	 *
	 * @param options - the reported size; 80 by 24 by default
	 */
	static readonly make = (options?: {
		readonly columns?: number | undefined;
		readonly rows?: number | undefined;
	}): Effect.Effect<TestTerminalHandle> =>
		Effect.gen(function* () {
			const queue = yield* Queue.unbounded<Terminal.UserInput, Cause.Done>();
			const written: string[] = [];
			let offered = 0;
			let lines = 0;
			let subscriptions = 0;

			const offer = (inputs: ReadonlyArray<Terminal.UserInput>) =>
				Effect.suspend(() => {
					offered += inputs.length;
					return Queue.offerAll(queue, inputs);
				}).pipe(Effect.asVoid);

			const terminal = Terminal.make({
				columns: Effect.succeed(options?.columns ?? 80),
				rows: Effect.succeed(options?.rows ?? 24),
				readInput: Effect.sync(() => {
					subscriptions++;
					return queue;
				}),
				readLine: Effect.suspend(() => {
					lines++;
					return Effect.fail(new Terminal.QuitError({}));
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
							input: Option.none<string>(),
							key: { name: key.name, ctrl: key.ctrl ?? false, meta: key.meta ?? false, shift: key.shift ?? false },
						})),
					),
				type: (text) =>
					offer(
						Array.from(text, (char) => ({
							input: Option.some(char),
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
