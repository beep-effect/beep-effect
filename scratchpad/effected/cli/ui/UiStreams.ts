import { $ScratchpadId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import { processStreams } from "./internal/processStreams.ts";

const $I = $ScratchpadId.create("effected/cli/ui/UiStreams");

/**
 * The streams a screen mounts on: Node streams, because Ink's stream contract is Node's.
 *
 * **Details**
 *
 * `stdin` must offer `isTTY`, `setRawMode`, `ref` and `unref`, and emit `readable`; `stdout` and `stderr` offer
 * `columns`, `rows`, `isTTY` and `write`, and emit `resize`.
 *
 * The members are typed with Node's own stream types (`NodeJS.ReadStream`, `NodeJS.WriteStream`), as Ink's are, so a
 * TypeScript consumer of `./ui` needs `@types/node`, beside the optional peer `@types/react` for its React types.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface UiStreamsShape {
	/**
	 * The input a screen reads keys from.
	 *
	 * @since 0.0.0
	 */
	readonly stdin: NodeJS.ReadStream;
	/**
	 * The output a screen draws on.
	 *
	 * @since 0.0.0
	 */
	readonly stdout: NodeJS.WriteStream;
	/**
	 * The error output, which Ink also binds.
	 *
	 * @since 0.0.0
	 */
	readonly stderr: NodeJS.WriteStream;
}

/**
 * The streams a screen mounts on, the process's own standard streams by default.
 *
 * **Details**
 *
 * A `Context.Reference`, so it never appears in `R`: the default reads the process streams when first used, never
 * at import, and a test provides in-memory streams with `Effect.provideService(UiStreams, streams)`. `./ui` binds
 * Node's process streams.
 *
 * **Example** (Read the default stream service)
 *
 * ```ts
 * import { UiStreams } from "@beep/scratchpad/effected/cli/ui/UiStreams"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.map(UiStreams, (streams) => typeof streams.stdout.write)
 * console.log(Effect.runSync(program)) // function
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class UiStreams extends Context.Reference<UiStreamsShape>($I`UiStreams`, {
	defaultValue: () => processStreams(),
}) {}
