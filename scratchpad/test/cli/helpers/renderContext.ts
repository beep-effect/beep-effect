// @effect-diagnostics strictEffectProvide:skip-file
import { dual } from "effect/Function";
import * as Effect from "effect/Effect";
import type { RenderContext } from "../../../effected/cli/index.ts";
import { CliTheme } from "../../../effected/cli/index.ts";
import { stripAnsi } from "../../../effected/cli/internal/displayWidth.ts";

// biome-ignore lint/suspicious/noControlCharactersInRegex: an OSC 8 hyperlink starts with ESC and ends with BEL or ST
const OSC8 = /\u001B\]8;[^;\u0007\u001B]*;([^\u0007\u001B]*)(?:\u0007|\u001B\\)/g;
// biome-ignore lint/suspicious/noControlCharactersInRegex: an SGR sequence starts with ESC
const SGR = /\u001B\[([0-9;]*)m/g;

/** A link stub: a fixed OSC 8 wrapper. The real policy arrives with CliLinks. */
export const link: {
	(label: string): (target: { readonly url: string } | { readonly file: string }) => string;
	(target: { readonly url: string } | { readonly file: string }, label: string): string;
} = dual(2, (target: { readonly url: string } | { readonly file: string }, label: string): string =>
	`\u001B]8;;${"url" in target ? target.url : `file://${target.file}`}\u0007${label}\u001B]8;;\u0007`);

export const contextOf = (overrides: Partial<RenderContext> = {}): Effect.Effect<RenderContext> =>
	Effect.gen(function* () {
		const theme = yield* CliTheme;
		const ctx: RenderContext = {
			width: 80,
			audience: "human",
			color: theme.color,
			paint: theme.paint,
			glyphs: theme.glyphs,
			link,
			displayPath: (absolute: string) => absolute,
			...overrides,
		};
		return ctx;
	}).pipe(Effect.provide(CliTheme.layerTest({ color: "truecolor" })));

/** Replays SGR by its meaning: every closer must close something open, and nothing may stay open. */
export const sgrProblems = (text: string): ReadonlyArray<string> => {
	const problems: Array<string> = [];
	const active = new Set<string>();
	const closes: Record<string, string> = { "39": "fg", "22": "weight", "23": "italic", "24": "underline", "49": "bg" };
	for (const match of text.matchAll(SGR)) {
		const param = match[1] ?? "";
		if (param === "" || param === "0") {
			active.clear();
		} else if (param in closes) {
			const kind = closes[param];
			if (kind === undefined) continue;
			if (!active.delete(kind)) problems.push(`stray closer ${param}`);
		} else if (param === "1" || param === "2") active.add("weight");
		else if (param === "3") active.add("italic");
		else if (param === "4") active.add("underline");
		else active.add("fg");
	}
	if (active.size > 0) problems.push(`left open: ${[...active].join(",")}`);
	return problems;
};

/** The hyperlinks of a string, in order: a non-empty target opens one, an empty target closes it. */
export const linksOf = (
	text: string,
): { readonly pairs: number; readonly wrapped: string; readonly balanced: boolean } => {
	let open = false;
	let pairs = 0;
	let balanced = true;
	let wrapped = "";
	let last = 0;
	for (const match of text.matchAll(OSC8)) {
		const before = text.slice(last, match.index);
		if (open) wrapped += before;
		last = (match.index ?? 0) + match[0].length;
		if ((match[1] ?? "") !== "") {
			if (open) balanced = false;
			open = true;
			pairs++;
		} else {
			if (!open) balanced = false;
			open = false;
		}
	}
	return { pairs, wrapped: stripAnsi(wrapped), balanced: balanced && !open };
};

const TOKEN_IDS: Readonly<Record<string, number>> = {
	success: 1,
	failure: 2,
	warning: 3,
	info: 4,
	error: 5,
	muted: 6,
	accent: 7,
	emphasis: 8,
};

/**
 * A `paint` that marks text with its token name, so a test can decode SGR back to tokens without pinning what a
 * real theme emits. A style object is marked `style`.
 */
export const tokenPaint: {
	(text: string): (token: string | object) => string;
	(token: string | object, text: string): string;
} = dual(2, (token: string | object, text: string): string =>
	`\u001B[38;5;${typeof token === "string" ? (TOKEN_IDS[token] ?? 99) : 100}m${text}\u001B[39m`);

// biome-ignore lint/suspicious/noControlCharactersInRegex: decoding SGR
const TOKEN_RUN = /\u001B\[38;5;(\d+)m([^\u001B]*)\u001B\[39m/g;

/** The tokens of a `tokenPaint` string, in order, as `[token, text]`; unpainted text is `[undefined, text]`. */
export const decodeTokens = (painted: string): ReadonlyArray<readonly [string | undefined, string]> => {
	const names = Object.fromEntries(Object.entries(TOKEN_IDS).map(([name, id]) => [String(id), name]));
	const out: Array<readonly [string | undefined, string]> = [];
	let last = 0;
	for (const match of painted.matchAll(TOKEN_RUN)) {
		if (match.index > last) out.push([undefined, painted.slice(last, match.index)]);
		out.push([names[match[1] ?? ""] ?? (match[1] === "100" ? "style" : "?"), match[2] ?? ""]);
		last = match.index + match[0].length;
	}
	if (last < painted.length) out.push([undefined, painted.slice(last)]);
	return out;
};
