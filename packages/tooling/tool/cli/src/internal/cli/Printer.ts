/**
 * Shared terminal printer helpers for repo-cli command adapters.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Console, Effect } from "effect";

// parity fixture: documentation stripped
export const printLines = Effect.fn("RepoCli.Printer.printLines")(function* (
  lines: ReadonlyArray<string>
): Effect.fn.Return<void> {
  yield* Effect.forEach(lines, Console.log, { discard: true });
});
