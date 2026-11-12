/**
 * Copy text to the operator's clipboard: `wl-copy` when it works, otherwise
 * an OSC 52 escape that Ghostty and most modern terminals honour.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Stdio from "effect/Stdio";
import * as Stream from "effect/Stream";

// The OSC 52 sequence that asks the terminal to set the clipboard.
const osc52 = (text: string): string => `\u001b]52;c;${Base64.encode(text)}\u0007`;

/**
 * Copy `text`, preferring `wl-copy` and falling back to an OSC 52 escape on
 * standard output.
 *
 * **Details**
 *
 * The escape goes through the `Stdio` service's standard-output sink, which
 * leaves the stream open, so the terminal renderer keeps writing to it.
 *
 * **Example** (Build the copy effect)
 *
 * ```ts
 * import { copyText } from "@/Clipboard"
 *
 * console.log(typeof copyText("/work/beep-effect")) // "object"
 * ```
 *
 * @param text - Text to copy.
 * @returns The copy effect.
 * @category clipboard
 * @since 0.0.0
 */
export const copyText = Effect.fn("Clipboard.copyText")(function* (
  text: string
): Effect.fn.Return<void, never, ChildProcessSpawner.ChildProcessSpawner | Stdio.Stdio> {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const exitCode = yield* spawner
    .exitCode(ChildProcess.make("wl-copy", ["--", text], { stdin: "ignore", stdout: "ignore", stderr: "ignore" }))
    .pipe(Effect.orElseSucceed(() => -1));
  if (exitCode !== 0) {
    const stdio = yield* Stdio.Stdio;
    yield* Stream.run(Stream.succeed(osc52(text)), stdio.stdout()).pipe(Effect.orDie);
  }
});
