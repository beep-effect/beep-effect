import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import type { TerminalEnvShape } from "../../env/index.ts";

/**
 * Whether the terminal facts let a run prompt: a terminal on standard input and on standard output, and a `TERM` that
 * is not `dumb`. A dumb terminal is a terminal, but it cannot move the cursor or take synchronized output, which every
 * redrawing prompt and screen needs. `TERM` is read through `Config` (never `process`), and only when both streams are
 * terminals; a read that fails counts as unset, as the env package treats every read.
 *
 * **Example** (Refuse a prompt with redirected input)
 *
 * ```ts
 * import { canPrompt } from "@beep/scratchpad/effected/cli/internal/canPrompt"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import type { StreamEnv, TerminalEnvShape } from "@beep/scratchpad/effected/env/TerminalEnv"
 *
 * const stream: StreamEnv = { isTerminal: false, color: "none", hyperlinks: false, columns: O.none<number>() }
 * const terminal: TerminalEnvShape = {
 *   stdinIsTerminal: false,
 *   stdout: stream,
 *   stderr: stream,
 *   width: () => 80,
 * }
 * console.log(Effect.runSync(canPrompt(terminal))) // false
 * ```
 *
 * @internal
 * @category predicates
 * @since 0.0.0
 */
export const canPrompt = (terminal: TerminalEnvShape): Effect.Effect<boolean> =>
	terminal.stdinIsTerminal && terminal.stdout.isTerminal
		? Effect.map(
				Config.option(Config.String("TERM")).pipe(Effect.orElseSucceed(O.none<string>)),
				(term) => !(O.isSome(term) && term.value === "dumb"),
			)
		: Effect.succeed(false);
