import type { UiStreamsShape } from "../UiStreams.ts";
import * as P from "effect/Predicate";

// Effect Stream cannot provide Ink's Node stream events, raw-mode methods and write-callback barriers.
const { Socket } = process.getBuiltinModule("node:net");
const { clearLine, clearScreenDown, cursorTo, moveCursor } = process.getBuiltinModule("node:readline");
const { WriteStream } = process.getBuiltinModule("node:tty");

type WriteCallback = Parameters<import("node:stream").Writable["_write"]>[2];

// A socket without a handle supplies Node's socket API without opening a descriptor. All I/O stays in memory.
abstract class MemorySocket extends Socket {
	protected abstract receive(chunk: Buffer | string): void;

	override _read(): void {
		// Bytes arrive through receive rather than a native socket handle.
		return undefined;
	}

	override _write(chunk: Buffer | string, _encoding: BufferEncoding, callback: WriteCallback): void {
		this.receive(chunk);
		callback();
	}

	override _writev(
		chunks: Array<{ chunk: Buffer | string; encoding: BufferEncoding }>,
		callback: WriteCallback,
	): void {
		const remaining = chunks[Symbol.iterator]();
		const writeNext: WriteCallback = (error) => {
			if (error !== undefined && error !== null) {
				callback(error);
				return;
			}
			const next = remaining.next();
			if (next.done === true) callback();
			else this._write(next.value.chunk, next.value.encoding, writeNext);
		};
		writeNext();
	}

	override _final(callback: WriteCallback): void {
		this.push(null);
		callback();
	}
}

class MemoryInput extends MemorySocket implements NodeJS.ReadStream {
	isTTY = true;
	isRaw = false;
	private readonly rawModes: Array<boolean>;
	private pendingWrite: (() => void) | undefined;

	constructor(rawModes: Array<boolean>) {
		super();
		this.rawModes = rawModes;
	}

	protected receive(chunk: Buffer | string): void {
		this.push(chunk);
	}

	override _read(): void {
		const callback = this.pendingWrite;
		this.pendingWrite = undefined;
		callback?.();
	}

	override _write(chunk: Buffer | string, _encoding: BufferEncoding, callback: WriteCallback): void {
		const length = this.readableLength;
		this.receive(chunk);
		// Like PassThrough, hold the write callback until the reader makes room for more input.
		if (
			this.writableEnded ||
			this.readableLength === length ||
			this.readableLength < this.readableHighWaterMark
		) {
			callback();
		} else this.pendingWrite = callback;
	}

	setRawMode(mode: boolean): this {
		this.isRaw = mode;
		this.rawModes.push(mode);
		return this;
	}
}

class MemoryOutput extends MemorySocket implements NodeJS.WriteStream {
	isTTY = true;
	columns: number;
	rows: number;
	private readonly onWrite: (chunk: string) => void;
	readonly getColorDepth = WriteStream.prototype.getColorDepth;
	readonly hasColors = WriteStream.prototype.hasColors;

	constructor(columns: number, rows: number, onWrite: (chunk: string) => void) {
		super({ readable: false });
		this.columns = columns;
		this.rows = rows;
		this.onWrite = onWrite;
	}

	protected receive(chunk: Buffer | string): void {
		this.onWrite(chunk.toString());
	}

	clearLine(direction: Parameters<NodeJS.WriteStream["clearLine"]>[0], callback?: () => void): boolean {
		return clearLine(this, direction, callback);
	}

	clearScreenDown(callback?: () => void): boolean {
		return clearScreenDown(this, callback);
	}

	cursorTo(x: number, y?: number, callback?: () => void): boolean;
	cursorTo(x: number, callback: () => void): boolean;
	cursorTo(x: number, y?: number | (() => void), callback?: () => void): boolean {
		return P.isFunction(y) ? cursorTo(this, x, undefined, y) : cursorTo(this, x, y, callback);
	}

	moveCursor(dx: number, dy: number, callback?: () => void): boolean {
		return moveCursor(this, dx, dy, callback);
	}

	getWindowSize(): [number, number] {
		return [this.columns, this.rows];
	}
}

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
): { readonly stream: MemoryOutput; readonly text: () => string } => {
	const chunks: Array<string> = [];
	const stream = new MemoryOutput(columns, rows, (text) => {
		chunks.push(text);
		both.push(text);
		onWrite?.(text);
	});
	return { stream, text: () => chunks.join("") };
};

/**
 * Make in-memory stdin, stdout and stderr that satisfy Ink's stream contract: TTYs with a size, a recorded
 * `setRawMode`, `ref` and `unref`, and captured writes.
 *
 * **Details**
 *
 * The third file licensed to touch Node, testing only: Ink's stream
 * contract is Node's, so the fakes inherit `node:net` sockets without native handles. Their in-memory I/O preserves
 * `readable`, `read()`, `setEncoding` and the write-callback barrier Ink waits on at unmount. Input records raw mode;
 * output implements Node's cursor, colour and terminal-size methods.
 *
 * @internal
 */
export const makeFakeStreams = (options: FakeStreamsOptions = {}): FakeStreams => {
	const columns = options.columns ?? 80;
	const rows = options.rows ?? 24;
	const rawModes: Array<boolean> = [];
	const stdin = new MemoryInput(rawModes);
	const both: Array<string> = [];
	const stdout = capture(columns, rows, both, options.onStdoutWrite);
	const stderr = capture(columns, rows, both);
	return {
		streams: {
			stdin,
			stdout: stdout.stream,
			stderr: stderr.stream,
		},
		rawModes,
		stdout: stdout.text,
		stderr: stderr.text,
		written: () => both.join(""),
		input: (data) => {
			stdin.write(data);
		},
		resize: (nextColumns, nextRows) => {
			stdout.stream.columns = nextColumns;
			stdout.stream.rows = nextRows;
			stderr.stream.columns = nextColumns;
			stderr.stream.rows = nextRows;
			stdout.stream.emit("resize");
		},
	};
};
