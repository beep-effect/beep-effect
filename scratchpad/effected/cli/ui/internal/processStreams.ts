/**
 * The process's own standard streams, the default `UiStreams`.
 *
 * **Details**
 *
 * One of the three files licensed to touch Node: it reads
 * `process.stdin`, `process.stdout` and `process.stderr` and nothing else, and only when called, never at import.
 * The boundary test holds that licence exact.
 *
 * **Example** (Read the standard stream contract)
 *
 * ```ts
 * import { processStreams } from "@beep/scratchpad/effected/cli/ui/internal/processStreams"
 * const streams = processStreams()
 * console.log(typeof streams.stdout.write) // function
 * ```
 *
 * @internal
 * @category streams
 * @since 0.0.0
 */
export const processStreams = (): {
	readonly stdin: NodeJS.ReadStream;
	readonly stdout: NodeJS.WriteStream;
	readonly stderr: NodeJS.WriteStream;
} => ({ stdin: process.stdin, stdout: process.stdout, stderr: process.stderr });
