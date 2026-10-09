import * as Clock from "effect/Clock";
import type * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Inspectable from "effect/Inspectable";
import type { FunctionComponent, ReactNode } from "react";
import { UiStreams } from "../UiStreams.ts";
import { inkModules } from "./ink.ts";

/**
 * A `Console` that writes above a mounted Ink frame, the component that connects it, and the switch back to direct
 * writes.
 *
 * @internal
 */
export interface InkConsole {
	/**
	 * Every method writes through Ink's own writers while a `Bridge` is mounted and attached, so its output lands above
	 * the frame, and straight to `UiStreams` otherwise; none falls through to the ambient console. `log`, `info`,
	 * `debug`, `dir`, `dirxml`, `table`, `count`, `timeLog`, `timeEnd` and a group's label go to stdout, `error`, `warn`,
	 * `trace` and a failed `assert` to stderr, as Node's console splits them; a group indents what follows by two
	 * spaces. Arguments are joined by spaces, a string as is, an `Error` with its stack and anything else as JSON; a
	 * table is a plain pipe table. `clear` does nothing: it would erase the scrollback above a live frame, and the
	 * frame. Named `writer`, not `console`: the boundary scan's console rule has no scope analysis and would read the
	 * key as the global.
	 */
	readonly writer: Console.Console;
	/**
	 * Write `text` and a line break to stdout, as `writer.log` would but as given: no formatting and no group indent.
	 * For a frame drawn as a string.
	 */
	readonly print: (text: string) => void;
	/** Mounted inside the Ink tree, it hands Ink's writers to `writer`, and renders its children. */
	readonly Bridge: FunctionComponent<{ readonly children?: ReactNode }>;
	/** Write straight to the streams from now on, until a `Bridge` mounts again; call it before Ink's `unmount()`. */
	readonly detach: () => void;
}

type Write = (data: string) => void;

/** One argument as a console shows it: a string as is, an `Error` with its stack, anything else as data (JSON). */
const shown = (arg: unknown): string =>
	arg instanceof Error ? (arg.stack ?? String(arg)) : Inspectable.toStringUnknown(arg, 0);

/** A console call's arguments as one line of text, joined by spaces. */
const textOf = (args: ReadonlyArray<unknown>): string => args.map(shown).join(" ");

/** `console.table`'s rows, as a plain pipe table: an `(index)` column, then each key, then `Values` for scalars. */
const tableOf = (data: unknown, properties?: ReadonlyArray<string>): string => {
	if (data === null || typeof data !== "object") return textOf([data]);
	const rows = Object.entries(data as Record<string, unknown>);
	const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object";
	const keys = properties ?? [...new Set(rows.flatMap(([, value]) => (isRecord(value) ? Object.keys(value) : [])))];
	const scalars = rows.some(([, value]) => !isRecord(value));
	const header = ["(index)", ...keys, ...(scalars ? ["Values"] : [])];
	const cell = (value: unknown): string =>
		value === undefined ? "" : typeof value === "string" ? value : shown(value);
	const body = rows.map(([index, value]) => [
		index,
		...keys.map((key) => (isRecord(value) ? cell(value[key]) : "")),
		...(scalars ? [isRecord(value) ? "" : cell(value)] : []),
	]);
	const widths = header.map((title, column) =>
		Math.max(title.length, ...body.map((row) => (row[column] ?? "").length)),
	);
	const line = (cells: ReadonlyArray<string>): string =>
		`| ${cells.map((text, column) => text.padEnd(widths[column] ?? 0)).join(" | ")} |`;
	return [line(header), ...body.map(line)].join("\n");
};

/** Milliseconds now, for `time`; the platform clock when there is one. */
const now = (): number => globalThis.performance?.now() ?? Clock.Clock.defaultValue().currentTimeMillisUnsafe();

/**
 * Build an `InkConsole` over `UiStreams`.
 *
 * @remarks
 * Ink's writers (`useStdout().write`, `useStderr().write`) clear the frame, write the line and repaint the frame, so a
 * line written through them lands above the frame without tearing it; a raw write to the stream lands inside the frame
 * instead. They are reachable only from inside the tree, which is what the `Bridge` is for. Ink drops whatever they
 * are handed once it has unmounted, so the owner detaches before it unmounts, and a line written after goes straight
 * to the stream.
 *
 * Every `Console` method is the bridge's own, none the ambient console's: one that fell through would write to the
 * process's terminal past Ink, tearing the frame and escaping `UiStreams`.
 *
 * @internal
 */
export const makeInkConsole: Effect.Effect<InkConsole> = Effect.gen(function* () {
	const streams = yield* UiStreams;
	let attached: { readonly out: Write; readonly err: Write } | undefined;
	let indent = "";
	const counts = new Map<string, number>();
	const timers = new Map<string, number>();
	const emit = (stream: "out" | "err", text: string): void => {
		const data = `${text
			.split("\n")
			.map((line) => indent + line)
			.join("\n")}\n`;
		if (attached !== undefined) (stream === "out" ? attached.out : attached.err)(data);
		else if (stream === "out") streams.stdout.write(data);
		else streams.stderr.write(data);
	};
	const toOut = (...args: ReadonlyArray<unknown>): void => emit("out", textOf(args));
	const toErr = (...args: ReadonlyArray<unknown>): void => emit("err", textOf(args));
	const elapsed = (label: string, method: string, extra: ReadonlyArray<unknown>): void => {
		const started = timers.get(label);
		if (started === undefined) {
			emit("err", `Warning: No such label '${label}' for console.${method}()`);
			return;
		}
		const tail = extra.length === 0 ? "" : ` ${textOf(extra)}`;
		emit("out", `${label}: ${(now() - started).toFixed(3)}ms${tail}`);
	};
	const group = (...label: ReadonlyArray<unknown>): void => {
		if (label.length > 0) toOut(...label);
		indent += "  ";
	};
	const writer: Console.Console = {
		log: toOut,
		info: toOut,
		debug: toOut,
		dirxml: toOut,
		error: toErr,
		warn: toErr,
		trace: (...args) => {
			const stack = (new Error().stack ?? "").split("\n").slice(2).join("\n");
			emit("err", `Trace${args.length === 0 ? "" : `: ${textOf(args)}`}${stack === "" ? "" : `\n${stack}`}`);
		},
		dir: (item) => toOut(item),
		table: (data, properties) => emit("out", tableOf(data, properties)),
		assert: (condition, ...args) => {
			if (!condition) emit("err", `Assertion failed${args.length === 0 ? "" : `: ${textOf(args)}`}`);
		},
		count: (label = "default") => {
			const next = (counts.get(label) ?? 0) + 1;
			counts.set(label, next);
			emit("out", `${label}: ${next}`);
		},
		countReset: (label = "default") => {
			counts.delete(label);
		},
		group,
		groupCollapsed: group,
		groupEnd: () => {
			indent = indent.slice(2);
		},
		time: (label = "default") => {
			timers.set(label, now());
		},
		timeLog: (label = "default", ...extra) => elapsed(label, "timeLog", extra),
		timeEnd: (label = "default") => {
			elapsed(label, "timeEnd", []);
			timers.delete(label);
		},
		// Erasing the screen would take the scrollback a live view keeps above its frame, and the frame with it.
		clear: () => undefined,
	};
	const Bridge: InkConsole["Bridge"] = (props) => {
		const { ink, react } = inkModules();
		const out = ink.useStdout().write;
		const err = ink.useStderr().write;
		react.useLayoutEffect(() => {
			const writers = { out, err };
			attached = writers;
			// An unmount without a detach first also goes back to the streams, once Ink has let go of the tree.
			return () => {
				if (attached === writers) attached = undefined;
			};
		}, [out, err]);
		return props.children ?? null;
	};
	return {
		writer,
		print: (text) => {
			const data = `${text}\n`;
			if (attached !== undefined) attached.out(data);
			else streams.stdout.write(data);
		},
		Bridge,
		detach: () => {
			attached = undefined;
		},
	};
});
