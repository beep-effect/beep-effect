/**
 * Stream-console drain shared by the full and slim CLI entry points.
 *
 * **Details**
 *
 * The runner's `onExit` hard-exits on a nonzero code, so the stream console
 * must drain first; a dropped-line report goes to the other stream. Both
 * `bin-main.ts` and `bin-ci.ts` drain here, then exit from their own module.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { drainProcessStreams, ProcessStreamName, writeBestEffortLine } from "@beep/repo-cli-kit/cli/Stdout";
import * as O from "effect/Option";

/**
 * Drain the process streams, report any dropped lines, then call `onDrained`.
 *
 * **Example** (Exit after the stream console drains)
 *
 * ```ts
 * import { drainThenExit } from "./ExitDrain.ts"
 *
 * drainThenExit({ label: "beep-ci", code: 0, onDrained: () => console.log("drained") })
 * ```
 *
 * @param options - The entry point `label` and the teardown's exit `code`, both printed in the dropped-line report, and `onDrained`, called once the streams have drained.
 * @internal
 * @category configuration
 * @since 0.0.0
 */
export const drainThenExit = ({
  label,
  code,
  onDrained,
}: {
  readonly label: string;
  readonly code: number;
  readonly onDrained: () => void;
}): void =>
  drainProcessStreams((failure) => {
    if (O.isSome(failure)) {
      const { stream, message, droppedLines } = failure.value;
      const channel = ProcessStreamName.is.stderr(stream) ? process.stdout : process.stderr;
      const fallback = ProcessStreamName.is.stderr(stream) ? process.stderr : process.stdout;
      writeBestEffortLine(
        channel,
        fallback,
        `[${label}] exiting with code ${code}; ${stream} write failed: ${message}; ${droppedLines} line(s) dropped\n`
      );
    }
    onDrained();
  });
