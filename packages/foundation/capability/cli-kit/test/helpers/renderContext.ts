import { CliTheme } from "@beep/cli-kit";
import { stripAnsi } from "@beep/cli-kit/internal/displayWidth";
import { provideBuilt } from "@beep/cli-kit/internal/provideBuilt";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Match from "effect/Match";
import * as R from "effect/Record";
import * as Str from "effect/String";
import type { LinkTargetInput, RenderContext, Style, TokenName } from "@beep/cli-kit";

const OSC8 = /\u001B\]8;[^;\u0007\u001B]*;([^\u0007\u001B]*)(?:\u0007|\u001B\\)/g;
const SGR = /\u001B\[([0-9;]*)m/g;

/** A link stub: a fixed OSC 8 wrapper. The real policy arrives with CliLinks. */
export const link: {
  (label: string): (target: { readonly url: string } | { readonly file: string }) => string;
  (target: { readonly url: string } | { readonly file: string }, label: string): string;
} = dual(
  2,
  (target: { readonly url: string } | { readonly file: string }, label: string): string =>
    `\u001B]8;;${"url" in target ? target.url : `file://${target.file}`}\u0007${label}\u001B]8;;\u0007`
);

/** A paint that writes the text unpainted, in the dual shape `RenderContext.paint` has. */
export const plainPaint: RenderContext.Encoded["paint"] = dual(
  2,
  (_token: TokenName | Style.Encoded, text: string): string => text
);

/** A link that leaves the label unlinked, in the dual shape `RenderContext.link` has. */
export const labelLink: RenderContext.Encoded["link"] = dual(
  2,
  (_target: LinkTargetInput, label: string): string => label
);

export const contextOf = (overrides: Partial<RenderContext.Encoded> = {}): Effect.Effect<RenderContext.Encoded> =>
  Effect.gen(function* () {
    const theme = yield* CliTheme;
    const ctx: RenderContext.Encoded = {
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
  }).pipe(provideBuilt(CliTheme.layerTest({ color: "truecolor" })));

const closes: Record<string, string> = { "39": "fg", "22": "weight", "23": "italic", "24": "underline", "49": "bg" };

const sgrKind = (param: string): string =>
  Match.value(param).pipe(
    Match.when("1", () => "weight"),
    Match.when("2", () => "weight"),
    Match.when("3", () => "italic"),
    Match.when("4", () => "underline"),
    Match.orElse(() => "fg")
  );

const addSgr = (active: ReadonlyArray<string>, kind: string): ReadonlyArray<string> =>
  A.contains(active, kind) ? active : [...active, kind];

const replaySgr = (param: string, active: ReadonlyArray<string>, problems: string[]): ReadonlyArray<string> => {
  if (param === "" || param === "0") return [];
  if (!(param in closes)) return addSgr(active, sgrKind(param));
  const kind = closes[param];
  if (kind === undefined) return active;
  if (!A.contains(active, kind)) problems.push(`stray closer ${param}`);
  return A.filter(active, (entry) => entry !== kind);
};

/** Replays SGR by its meaning: every closer must close something open, and nothing may stay open. */
export const sgrProblems = (text: string): ReadonlyArray<string> => {
  const problems: Array<string> = [];
  let active: ReadonlyArray<string> = [];
  for (const match of Str.matchAll(SGR)(text)) {
    active = replaySgr(match[1] ?? "", active, problems);
  }
  if (active.length > 0) problems.push(`left open: ${A.join(active, ",")}`);
  return problems;
};

const readLink = (
  text: string,
  match: RegExpMatchArray,
  state: { open: boolean; pairs: number; balanced: boolean; wrapped: string; last: number }
): void => {
  const before = Str.slice(state.last, match.index)(text);
  if (state.open) state.wrapped += before;
  state.last = (match.index ?? 0) + A.getUnsafe(match, 0).length;
  const opens = (match[1] ?? "") !== "";
  if (state.open === opens) state.balanced = false;
  state.open = opens;
  if (opens) state.pairs++;
};

/** The hyperlinks of a string, in order: a non-empty target opens one, an empty target closes it. */
export const linksOf = (
  text: string
): { readonly pairs: number; readonly wrapped: string; readonly balanced: boolean } => {
  const state = { open: false, pairs: 0, balanced: true, wrapped: "", last: 0 };
  for (const match of Str.matchAll(OSC8)(text)) readLink(text, match, state);
  return { pairs: state.pairs, wrapped: stripAnsi(state.wrapped), balanced: state.balanced && !state.open };
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
} = dual(
  2,
  (token: string | object, text: string): string =>
    `\u001B[38;5;${typeof token === "string" ? (TOKEN_IDS[token] ?? 99) : 100}m${text}\u001B[39m`
);

const TOKEN_RUN = /\u001B\[38;5;(\d+)m([^\u001B]*)\u001B\[39m/g;

const tokenName = (names: Record<string, string>, id: string | undefined): string =>
  names[id ?? ""] ?? (id === "100" ? "style" : "?");

/** The tokens of a `tokenPaint` string, in order, as `[token, text]`; unpainted text is `[undefined, text]`. */
export const decodeTokens = (painted: string): ReadonlyArray<readonly [string | undefined, string]> => {
  const names = R.fromEntries(A.map(R.toEntries(TOKEN_IDS), ([name, id]) => [String(id), name] as const));
  const out: Array<readonly [string | undefined, string]> = [];
  let last = 0;
  for (const match of Str.matchAll(TOKEN_RUN)(painted)) {
    const fallbackMatchAllNeverUses = last;
    const at = match.index ?? fallbackMatchAllNeverUses;
    if (at > last) out.push([undefined, Str.slice(last, at)(painted)]);
    out.push([tokenName(names, match[1]), match[2] ?? ""]);
    last = at + match[0].length;
  }
  if (last < painted.length) out.push([undefined, Str.slice(last)(painted)]);
  return out;
};
