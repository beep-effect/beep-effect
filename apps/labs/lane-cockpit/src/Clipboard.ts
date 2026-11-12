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

/**
 * The OSC 52 sequence that asks the terminal to set the clipboard.
 *
 * **Example** (Encode a path)
 *
 * ```ts
 * import { osc52 } from "@/Clipboard"
 *
 * console.log(osc52("hi")) // "\u001b]52;c;aGk=\u0007"
 * ```
 *
 * @param text - Text to copy.
 * @returns The escape sequence.
 * @category clipboard
 * @since 0.0.0
 */
export const osc52 = (text: string): string => `\u001b]52;c;${Base64.encode(text)}\u0007`;

/**
 * Copy `text`, preferring `wl-copy` and falling back to OSC 52 on `write`.
 *
 * **Example** (Build the copy effect)
 *
 * ```ts
 * import { copyText } from "@/Clipboard"
 *
 * console.log(typeof copyText) // "function"
 * ```
 *
 * @param write - Writes raw bytes to the terminal.
 * @returns A function from text to the copy effect.
 * @category clipboard
 * @since 0.0.0
 */
export const copyText = (write: (chunk: string) => void) =>
  Effect.fn("Clipboard.copyText")(function* (
    text: string
  ): Effect.fn.Return<void, never, ChildProcessSpawner.ChildProcessSpawner> {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const exitCode = yield* spawner
      .exitCode(ChildProcess.make("wl-copy", ["--", text], { stdin: "ignore", stdout: "ignore", stderr: "ignore" }))
      .pipe(Effect.orElseSucceed(() => -1));
    if (exitCode !== 0) {
      yield* Effect.sync(() => write(osc52(text)));
    }
  });
