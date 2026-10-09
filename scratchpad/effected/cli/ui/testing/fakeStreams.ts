import type { UiStreamsShape } from "../UiStreams.ts";

// Effect Stream cannot provide Ink's Node stream events, raw-mode methods and write-callback barriers.
const { PassThrough, Writable } = process.getBuiltinModule("node:stream");

/**
 * Options for {@link makeFakeStreams}.
 *
 * @internal
 */
export interface FakeStreamsOptions {
	/** The terminal width; 80 by default. */
	readonly columns?: number;
	/** The terminal height; 24 by default. */
	readonly rows?: number;
	/** Called with each chunk written to stdout, as it is written. */
	readonly onStdoutWrite?: (chunk: string) => void;
}

/**
 * In-memory terminal streams a screen mounts on.
 *
 * @internal
 */
export interface FakeStreams {
	/** The streams, to provide as `UiStreams`. */
	readonly streams: UiStreamsShape;
	/** Every `setRawMode` call, in order. */
	readonly rawModes: ReadonlyArray<boolean>;
	/** Everything written to stdout so far. */
	readonly stdout: () => string;
	/** Everything written to stderr so far. */
	readonly stderr: () => string;
	/** Everything written to stdout and stderr so far, in the order it was written: what one terminal shows. */
	readonly written: () => string;
	/** Feed raw bytes to stdin, as a terminal in raw mode would deliver a key. */
	readonly input: (data: string) => void;
	/** Resize the terminal: set both outputs' size and emit `resize` on stdout, as a terminal does. */
	readonly resize: (columns: number, rows: number) => void;
}

const capture = (
	columns: number,
	rows: number,
	both: Array<string>,
	onWrite?: (chunk: string) => void,
): { readonly stream: import("node:stream").Writable; readonly text: () => string } => {
	const chunks: Array<string> = [];
	const stream = new Writable({
		write(chunk: Buffer | string, _encoding, callback) {
			const text = chunk.toString();
			chunks.push(text);
			both.push(text);
			onWrite?.(text);
			callback();
		},
	});
	Object.assign(stream, { isTTY: true, columns, rows });
	return { stream, text: () => chunks.join("") };
};

/**
 * Make in-memory stdin, stdout and stderr that satisfy Ink's stream contract: TTYs with a size, a recorded
 * `setRawMode`, `ref` and `unref`, and captured writes.
 *
 * @remarks
 * The third file licensed to touch Node, testing only: Ink's stream
 * contract is Node's, so the fakes are `node:stream` streams rather than a hand-rolled emitter that would have to
 * reproduce `readable`, `read()`, `setEncoding` and the write-callback barrier Ink waits on at unmount.
 *
 * @internal
 */
export const makeFakeStreams = (options: FakeStreamsOptions = {}): FakeStreams => {
	const columns = options.columns ?? 80;
	const rows = options.rows ?? 24;
	const rawModes: Array<boolean> = [];
	const stdin = new PassThrough();
	Object.assign(stdin, {
		isTTY: true,
		setRawMode: (mode: boolean) => {
			rawModes.push(mode);
			return stdin;
		},
		ref: () => stdin,
		unref: () => stdin,
	});
	const both: Array<string> = [];
	const stdout = capture(columns, rows, both, options.onStdoutWrite);
	const stderr = capture(columns, rows, both);
	return {
		// The fakes carry every member Ink reads; Node's tty stream types also demand a file descriptor they cannot have.
		streams: {
			stdin: stdin as unknown as NodeJS.ReadStream,
			stdout: stdout.stream as NodeJS.WriteStream,
			stderr: stderr.stream as NodeJS.WriteStream,
		},
		rawModes,
		stdout: stdout.text,
		stderr: stderr.text,
		written: () => both.join(""),
		input: (data) => {
			stdin.write(data);
		},
		resize: (nextColumns, nextRows) => {
			Object.assign(stdout.stream, { columns: nextColumns, rows: nextRows });
			Object.assign(stderr.stream, { columns: nextColumns, rows: nextRows });
			stdout.stream.emit("resize");
		},
	};
};
