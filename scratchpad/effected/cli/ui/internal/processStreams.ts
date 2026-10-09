/**
 * The process's own standard streams, the default `UiStreams`.
 *
 * @remarks
 * One of the three files licensed to touch Node: it reads
 * `process.stdin`, `process.stdout` and `process.stderr` and nothing else, and only when called, never at import.
 * The boundary test holds that licence exact.
 *
 * @internal
 */
export const processStreams = (): {
	readonly stdin: NodeJS.ReadStream;
	readonly stdout: NodeJS.WriteStream;
	readonly stderr: NodeJS.WriteStream;
} => ({ stdin: process.stdin, stdout: process.stdout, stderr: process.stderr });
