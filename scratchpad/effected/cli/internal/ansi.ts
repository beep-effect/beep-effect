import { dual } from "effect/Function";
import type { ColorLevel } from "../../env/index.ts";
import type { NamedColor, Style } from "../Token.ts";
import * as R from "effect/Record";

/** Foreground SGR parameter for each named colour: 30 to 37, then 90 to 97. */
const NAMED: Readonly<Record<string, number | undefined>> = {
	black: 30,
	red: 31,
	green: 32,
	yellow: 33,
	blue: 34,
	magenta: 35,
	cyan: 36,
	white: 37,
	blackBright: 90,
	redBright: 91,
	greenBright: 92,
	yellowBright: 93,
	blueBright: 94,
	magentaBright: 95,
	cyanBright: 96,
	whiteBright: 97,
	gray: 90,
} satisfies Record<NamedColor, number>;

/** The 16 ANSI colours as xterm draws them, in SGR order (0 to 7, then bright 8 to 15), for the basic fallback. */
const PALETTE16: ReadonlyArray<readonly [number, number, number]> = [
	[0, 0, 0],
	[205, 0, 0],
	[0, 205, 0],
	[205, 205, 0],
	[0, 0, 238],
	[205, 0, 205],
	[0, 205, 205],
	[229, 229, 229],
	[127, 127, 127],
	[255, 0, 0],
	[0, 255, 0],
	[255, 255, 0],
	[92, 92, 255],
	[255, 0, 255],
	[0, 255, 255],
	[255, 255, 255],
];

/** The six levels of each axis of the xterm 6x6x6 colour cube. */
const CUBE = [0, 95, 135, 175, 215, 255] as const;

const ESC = "\x1b[";

type Rgb = readonly [number, number, number];

/** `#rgb` or `#rrggbb` to channels, or `undefined` when it is neither. */
export const parseHex = (hex: string): Rgb | undefined => {
	const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex);
	if (short !== null) {
		return [
			Number.parseInt((short[1] ?? "0").repeat(2), 16),
			Number.parseInt((short[2] ?? "0").repeat(2), 16),
			Number.parseInt((short[3] ?? "0").repeat(2), 16),
		];
	}
	const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
	if (long === null) return undefined;
	return [
		Number.parseInt(long[1] ?? "0", 16),
		Number.parseInt(long[2] ?? "0", 16),
		Number.parseInt(long[3] ?? "0", 16),
	];
};

const distance = (a: Rgb, b: Rgb): number => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

/** The index of the cube level nearest a channel value; the lower level wins a tie. */
const nearestLevel = (value: number): number => {
	let best = 0;
	for (let i = 1; i < CUBE.length; i++) {
		if (Math.abs((CUBE[i] ?? 0) - value) < Math.abs((CUBE[best] ?? 0) - value)) best = i;
	}
	return best;
};

/**
 * The nearest xterm 256-colour index for a colour: the closest of the 6x6x6 cube and the 24-step grayscale
 * ramp (232 to 255) by squared RGB distance, the cube winning a tie.
 */
export const nearest256 = (rgb: Rgb): number => {
	const [r, g, b] = [nearestLevel(rgb[0]), nearestLevel(rgb[1]), nearestLevel(rgb[2])] as const;
	const cubeIndex = 16 + 36 * r + 6 * g + b;
	const cubeDistance = distance(rgb, [CUBE[r] ?? 0, CUBE[g] ?? 0, CUBE[b] ?? 0]);

	const average = (rgb[0] + rgb[1] + rgb[2]) / 3;
	const step = Math.min(23, Math.max(0, Math.round((average - 8) / 10)));
	const gray = 8 + 10 * step;
	const grayDistance = distance(rgb, [gray, gray, gray]);

	return grayDistance < cubeDistance ? 232 + step : cubeIndex;
};

/** The SGR parameter of the nearest of the 16 ANSI colours: 30 to 37 or 90 to 97. */
const nearest16 = (rgb: Rgb): number => {
	let best = 0;
	for (let i = 1; i < PALETTE16.length; i++) {
		if (distance(rgb, PALETTE16[i] ?? [0, 0, 0]) < distance(rgb, PALETTE16[best] ?? [0, 0, 0])) best = i;
	}
	return best < 8 ? 30 + best : 90 + (best - 8);
};

/** The foreground SGR parameters for a colour at a level, or `undefined` for none. */
const foreground = (fg: NonNullable<Style["fg"]>, level: ColorLevel): string | undefined => {
	if (level === "none") return undefined;
	// A name that is not a colour is ignored, as a malformed hex is, rather than printing `undefined` into an escape.
	if (!fg.startsWith("#")) return R.has(NAMED, fg) ? String(NAMED[fg]) : undefined;
	const rgb = parseHex(fg);
	if (rgb === undefined) return undefined;
	if (level === "truecolor") return `38;2;${rgb[0]};${rgb[1]};${rgb[2]}`;
	if (level === "256") return `38;5;${nearest256(rgb)}`;
	return String(nearest16(rgb));
};

/** One attribute: how it opens and how it closes. Closers are per attribute so nested paints compose. */
interface Wrap {
	readonly open: string;
	readonly close: string;
}

/** The wraps for a style, innermost first: foreground, then dim, bold, italic and underline outward. */
const wraps = (style: Style, level: ColorLevel): ReadonlyArray<Wrap> => {
	const result: Wrap[] = [];
	const fg = style.fg === undefined ? undefined : foreground(style.fg, level);
	if (fg !== undefined) result.push({ open: `${ESC}${fg}m`, close: `${ESC}39m` });
	if (style.dim === true) result.push({ open: `${ESC}2m`, close: `${ESC}22m` });
	if (style.bold === true) result.push({ open: `${ESC}1m`, close: `${ESC}22m` });
	if (style.italic === true) result.push({ open: `${ESC}3m`, close: `${ESC}23m` });
	if (style.underline === true) result.push({ open: `${ESC}4m`, close: `${ESC}24m` });
	return result;
};

/**
 * Render `text` in a style at a colour level; identity at `none`.
 *
 * Each attribute closes with its own code (39, 22, 23, 24), never a blanket reset, and a closer that occurs
 * inside `text` is followed by the opener again, so a painted span nested in a painted span leaves the outer
 * style in force for the text after it.
 */
export const paintStyle: {
	(level: ColorLevel, text: string): (style: Style) => string;
	(style: Style, level: ColorLevel, text: string): string;
} = dual(3, (style: Style, level: ColorLevel, text: string): string => {
	if (level === "none" || text === "") return text;
	let out = text;
	for (const { open, close } of wraps(style, level)) {
		out = `${open}${out.replaceAll(close, `${close}${open}`)}${close}`;
	}
	return out;
});

/** The raw opening SGR sequence of a style at a level, `""` at `none` or for a style that paints nothing. */
export const openSequence: {
	(level: ColorLevel): (style: Style) => string;
	(style: Style, level: ColorLevel): string;
} = dual(2, (style: Style, level: ColorLevel): string =>
	level === "none"
		? ""
		: wraps(style, level)
				.toReversed()
				.map((wrap) => wrap.open)
				.join(""));
