// decision: inline-refactor-differentials

import * as A from "effect/Array";

const INLINE_TOKENS: ReadonlyArray<string> = [
  "a",
  "b",
  "x",
  "1",
  "9",
  ".",
  "-",
  "_",
  "+",
  "@",
  ":",
  "/",
  "(",
  ")",
  ";",
  "&",
  "!",
  "?",
  "*",
  "**",
  "~",
  "~~",
  "[",
  "]",
  "<",
  ">",
  " ",
  "\n",
  "www.",
  "http://",
  "https://",
  "ftp://",
  "mailto:",
  "xmpp:",
  "example",
  "com",
  "org",
  "a@",
  "@b.",
  "c.d",
  ".org",
  "ada@ex.org",
  "x_y",
  "/res",
  "&amp;",
  "&hl;",
  "\\",
  "`",
  "é",
  "😀",
  "𐄀",
  "🎉",
  "𝐀",
];

/**
 * `count` sources of 1 to 24 tokens, drawn from a mulberry32 stream seeded
 * with `seed`.
 *
 * @category testing
 * @since 0.0.0
 */
export const inlineCorpus = ({ seed, count }: { readonly seed: number; readonly count: number }) => {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = (): string => A.getUnsafe(INLINE_TOKENS, Math.floor(next() * INLINE_TOKENS.length));
  return A.makeBy(count, () => A.join(A.makeBy(1 + Math.floor(next() * 24), pick), ""));
};
