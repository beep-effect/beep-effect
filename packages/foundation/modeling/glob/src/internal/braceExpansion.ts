// Ported from brace-expansion@5.0.7 (https://github.com/juliangruber/brace-expansion)
// Copyright (c) 2013 Julian Gruber <julian@juliangruber.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of
// this software and associated documentation files (the "Software"), to deal in
// the Software without restriction, including without limitation the rights to
// use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
// of the Software, and to permit persons to whom the Software is furnished to do
// so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
// Port notes, three deliberate changes from upstream:
// 1. Depth guard on expand_ at MAX_NESTING_DEPTH — comma-bearing nesting
//    descends one frame per level; the guard throws GuardExceeded
//    ("NestingDepthExceeded") instead of overflowing the stack. The upstream
//    {a},b} for-loop rewrite and the lazy post evaluation (both load-bearing
//    DoS fixes; their upstream comments are preserved below) are kept exactly.
// 2. Depth guard on parseCommaParts — self-recursive on the post side;
//    upstream relies only on the 64KB pattern-length cap.
// 3. Budget exhaustion THROWS GuardExceeded("ExpansionBudgetExceeded") where
//    upstream silently truncates the expansion list at max — silent truncation
//    silently changes match semantics; the typed signal is the honest surface.
//    The max cap itself is validated by assertCap: a NaN or non-integer max is
//    programmer error and dies as a TypeError defect.

import { $GlobId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { constant, dual, pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Random from "effect/Random";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { balanced } from "./balancedMatch.ts";
import { assertCap, EXPANSION_MAX, GuardExceeded, MAX_NESTING_DEPTH } from "./limits.ts";
import type { BalancedResult } from "./balancedMatch.ts";

const $I = $GlobId.create("internal/braceExpansion");

const random = Random.Random.defaultValue();
const escSlash = `\0SLASH${random.nextDoubleUnsafe()}\0`;
const escOpen = `\0OPEN${random.nextDoubleUnsafe()}\0`;
const escClose = `\0CLOSE${random.nextDoubleUnsafe()}\0`;
const escComma = `\0COMMA${random.nextDoubleUnsafe()}\0`;
const escPeriod = `\0PERIOD${random.nextDoubleUnsafe()}\0`;
const escSlashPattern = new RegExp(escSlash, "g");
const escOpenPattern = new RegExp(escOpen, "g");
const escClosePattern = new RegExp(escClose, "g");
const escCommaPattern = new RegExp(escComma, "g");
const escPeriodPattern = new RegExp(escPeriod, "g");
const slashPattern = /\\\\/g;
const openPattern = /\\{/g;
const closePattern = /\\}/g;
const commaPattern = /\\,/g;
const periodPattern = /\\\./g;

const numeric = (str: string): number =>
  Number.isNaN(Number(str)) ? O.getOrElse(constant(Number.NaN))(Str.charCodeAt(0)(str)) : Number.parseInt(str, 10);

const escapeBraces = (str: string): string =>
  pipe(
    str,
    Str.replace(slashPattern, escSlash),
    Str.replace(openPattern, escOpen),
    Str.replace(closePattern, escClose),
    Str.replace(commaPattern, escComma),
    Str.replace(periodPattern, escPeriod)
  );

const unescapeBraces = (str: string): string =>
  pipe(
    str,
    Str.replace(escSlashPattern, "\\"),
    Str.replace(escOpenPattern, "{"),
    Str.replace(escClosePattern, "}"),
    Str.replace(escCommaPattern, ","),
    Str.replace(escPeriodPattern, ".")
  );

/**
 * Basically just str.split(","), but handling cases where we have nested
 * braced sections, which should be treated as individual members, like
 * `{a,{b,c},d}`.
 */
const parseCommaParts: {
  (str: string, depth: number): Array<string>;
  (depth: number): (str: string) => Array<string>;
} = dual(2, (str: string, depth: number): Array<string> => {
  if (depth > MAX_NESTING_DEPTH) {
    throw GuardExceeded.fromReason("NestingDepthExceeded", MAX_NESTING_DEPTH, depth);
  }
  if (str === "") {
    return [""];
  }

  const parts: Array<string> = [];
  const m = balanced("{", "}", str);

  if (m === false) {
    return Str.split(",")(str);
  }

  const { pre, body, post } = m;
  const p = Str.split(",")(pre);

  p[p.length - 1] += `{${body}}`;
  const postParts = parseCommaParts(post, depth + 1);
  if (post.length !== 0) {
    p[p.length - 1] += A.join(postParts.splice(0, 1), "");
    p.push(...postParts);
  }

  parts.push(...p);

  return parts;
});

/**
 * **Gotchas**
 *
 * An invalid `max` raises a `TypeError`; exhausting a valid budget raises
 * {@link GuardExceeded} rather than silently truncating the alternatives.
 * {@link expand} takes the plain encoded bag, so a bad cap reaches assertCap
 * rather than failing schema construction.
 *
 * **Example** (Bound an expansion)
 *
 * ```ts
 * import { BraceExpansionOptions, expand } from "@beep/glob/internal/braceExpansion"
 *
 * const options = BraceExpansionOptions.make({ max: 2 })
 * console.log(expand("{a,b}", options).join(",")) // a,b
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class BraceExpansionOptions extends S.Opaque<BraceExpansionOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    max: S.optionalKey(S.Finite.check(S.isInt(), S.isGreaterThan(0))).pipe(
      $I.annoteKey("BraceExpansionOptions.max", {
        description: "Maximum number of alternatives to produce (default and ceiling 100_000).",
      })
    ),
  }).pipe(
    $I.annoteSchema("BraceExpansionOptions", {
      description: "Configures the maximum number of alternatives produced by brace expansion.",
    })
  )
) {}

/**
 * Expand a brace pattern into its alternatives, Bash 4.3 style.
 *
 * **Gotchas**
 *
 * Guard behavior (see the port notes above): over-deep nesting and budget
 * exhaustion throw {@link GuardExceeded}; an invalid `max` dies as a
 * `TypeError` defect.
 *
 * **Example** (Expand alternatives and a padded sequence)
 *
 * ```ts
 * import { expand } from "@beep/glob/internal/braceExpansion"
 *
 * console.log(expand("file.{ts,js}").join(",")) // file.ts,file.js
 * console.log(expand("part{01..03}").join(",")) // part01,part02,part03
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const expand: {
  (options?: typeof BraceExpansionOptions.Encoded): (str: string) => Array<string>;
  (str: string, options?: typeof BraceExpansionOptions.Encoded): Array<string>;
} = dual(
  (args) => P.isString(args[0]),
  (str: string, options: typeof BraceExpansionOptions.Encoded = {}): Array<string> => {
    if (str === "") {
      return [];
    }

    const max = assertCap("braceExpandMax", options.max ?? EXPANSION_MAX);

    // I don't know why Bash 4.3 does this, but it does.
    // Anything starting with {} will have the first two bytes preserved
    // but *only* at the top level, so {},a}b will not expand to anything,
    // but a{},b}c will be expanded to [a}c,abc].
    // One could argue that this is a bug in Bash, but since the goal of
    // this module is to match Bash's rules, we escape a leading {}
    let input = str;
    if (Str.slice(0, 2)(input) === "{}") {
      input = `\\{\\}${Str.slice(2)(input)}`;
    }

    const result: Array<string> = [];
    for (const member of expand_(escapeBraces(input), max, true, 0)) {
      if (result.length >= max) {
        throw GuardExceeded.fromReason("ExpansionBudgetExceeded", max, result.length + 1);
      }
      result.push(unescapeBraces(member));
    }
    return result;
  }
);

const embrace = (str: string): string => `{${str}}`;

const isPadded = (el: string): boolean => /^-?0\d/.test(el);

const lte: {
  (i: number, y: number): boolean;
  (y: number): (i: number) => boolean;
} = dual(2, (i: number, y: number): boolean => i <= y);

const gte: {
  (i: number, y: number): boolean;
  (y: number): (i: number) => boolean;
} = dual(2, (i: number, y: number): boolean => i >= y);

// What the leftmost balanced brace set of a string calls for: emit the string
// unchanged, emit a `${...}` set verbatim, expand the set, or restart on the
// `{a},b}` rewrite.
type BraceStep =
  | { readonly _tag: "Literal" }
  | { readonly _tag: "Dollar"; readonly m: BalancedResult }
  | { readonly _tag: "Expand"; readonly m: BalancedResult; readonly kind: BraceKind }
  | { readonly _tag: "Rewrite"; readonly current: string };

type BraceKind = "numeric" | "alpha" | "options";

const LITERAL_STEP: BraceStep = { _tag: "Literal" };

const braceKind = (body: string): BraceKind | undefined => {
  if (/^-?\d+\.\.-?\d+(?:\.\.-?\d+)?$/.test(body)) return "numeric";
  if (/^[a-zA-Z]\.\.[a-zA-Z](?:\.\.-?\d+)?$/.test(body)) return "alpha";
  return Str.includes(",")(body) ? "options" : undefined;
};

const classifyBrace = (current: string): BraceStep => {
  const m = balanced("{", "}", current);
  if (m === false) return LITERAL_STEP;
  if (/\$$/.test(m.pre)) return { _tag: "Dollar", m };
  const kind = braceKind(m.body);
  if (kind !== undefined) return { _tag: "Expand", m, kind };
  // {a},b}
  if (/,(?!,).*}/.test(m.post)) return { _tag: "Rewrite", current: `${m.pre}{${m.body}${escClose}${m.post}` };
  return LITERAL_STEP;
};

function* expand_(str: string, max: number, isTopInput: boolean, depth: number): Generator<string> {
  if (depth > MAX_NESTING_DEPTH) {
    throw GuardExceeded.fromReason("NestingDepthExceeded", MAX_NESTING_DEPTH, depth);
  }

  let current = str;
  let isTop = isTopInput;

  // The `{a},b}` rewrite restarts expansion on a rewritten string with the
  // same `max` and `isTop = true`. Loop instead of recursing so a long run of
  // non-expanding `{}` groups can't exhaust the call stack.
  let step = classifyBrace(current);
  while (step._tag === "Rewrite") {
    current = step.current;
    isTop = true;
    step = classifyBrace(current);
  }
  yield* runBraceStep(step, current, max, isTop, depth);
}

const runBraceStep = (step: BraceStep, current: string, max: number, isTop: boolean, depth: number): Iterable<string> =>
  Match.valueTags(step, {
    Literal: (): Iterable<string> => [current],
    Rewrite: (): Iterable<string> => [current],
    Dollar: ({ m }) => expandDollarBrace(m, max, depth),
    Expand: ({ m, kind }) => expandBraceSet(m, kind, max, isTop, depth),
  });

// no need to expand pre, since it is guaranteed to be free of brace-sets
function* expandDollarBrace(m: BalancedResult, max: number, depth: number): Generator<string> {
  for (const p of postOf(m, max, depth)()) yield `${m.pre}{${m.body}}${p}`;
}

// Only expand post once we know this brace set actually expands. Computing it
// before the early returns expanded post a second time on every non-expanding
// `{}`, which is what made inputs like `a{},{},{}...` blow up exponentially.
const postOf = (m: BalancedResult, max: number, depth: number) => (): Iterable<string> =>
  m.post.length !== 0 ? expand_(m.post, max, false, depth + 1) : [""];

// The per-set context every member emission shares.
interface BraceSet {
  readonly depth: number;
  readonly isSequence: boolean;
  readonly isTop: boolean;
  readonly max: number;
  readonly post: () => Iterable<string>;
  readonly pre: string;
}

function* emitMembers(set: BraceSet, members: Iterable<string>): Generator<string> {
  for (const member of members) {
    for (const suffix of set.post()) {
      const expansion = set.pre + member + suffix;
      if (!set.isTop || set.isSequence || expansion !== "") yield expansion;
    }
  }
}

function* expandBraceSet(
  m: BalancedResult,
  kind: BraceKind,
  max: number,
  isTop: boolean,
  depth: number
): Generator<string> {
  const isSequence = kind !== "options";
  const set: BraceSet = { pre: m.pre, post: postOf(m, max, depth), isTop, isSequence, max, depth };
  const n = isSequence ? Str.split(/\.\./)(m.body) : parseCommaParts(m.body, depth + 1);
  const n0 = n[0];
  const n1 = n[1];
  if (isSequence && n0 !== undefined && n1 !== undefined) {
    yield* expandSequence(set, n, n0, n1, kind === "alpha");
  } else if (n.length === 1 && n0 !== undefined) {
    yield* expandDoubled(set, n0);
  } else {
    for (const part of n) yield* emitMembers(set, expand_(part, max, false, depth + 1));
  }
}

// The validated arithmetic of one `{x..y[..incr]}` sequence.
interface SequencePlan {
  readonly incr: number;
  readonly pad: boolean;
  readonly test: (i: number, y: number) => boolean;
  readonly total: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

const sequencePlan = (n: ReadonlyArray<string>, n0: string, n1: string, max: number): SequencePlan => {
  const x = numeric(n0);
  const y = numeric(n1);
  const width = Math.max(n0.length, n1.length);
  const n2 = n[2];
  const step = n.length === 3 && n2 !== undefined ? Math.max(Math.abs(numeric(n2)), 1) : 1;
  const reverse = y < x;
  const incr = reverse ? step * -1 : step;
  const pad = A.some(n, isPadded);

  // Validate the count before generating members. Overflow can produce
  // Infinity or NaN; both exceed the budget, measured as positive infinity.
  const count = Math.floor(Math.abs(y - x) / Math.abs(incr)) + 1;
  const total = S.is(S.Finite)(count) ? count : Number.POSITIVE_INFINITY;
  if (total > max) {
    throw GuardExceeded.fromReason("ExpansionBudgetExceeded", max, total);
  }
  return { x, y, incr, test: reverse ? gte : lte, width, pad, total };
};

const alphaMember = (i: number): string => {
  const c = String.fromCharCode(i);
  return c === "\\" ? "" : c;
};

const numericMember = (i: number, plan: SequencePlan): string => {
  const c = String(i);
  const need = plan.pad ? plan.width - c.length : 0;
  if (need <= 0) return c;
  const z = Str.repeat(need)("0");
  return i < 0 ? `-${z}${Str.slice(1)(c)}` : `${z}${c}`;
};

function* expandSequence(
  set: BraceSet,
  n: ReadonlyArray<string>,
  n0: string,
  n1: string,
  isAlphaSequence: boolean
): Generator<string> {
  const plan = sequencePlan(n, n0, n1, set.max);
  // Advancing arithmetic follows the endpoint, even when rounding makes
  // the actual increment smaller than the declared step. A stalled
  // addition retains the round-2 bounded duplicate-member behavior.
  for (let i = plan.x, member = 0; plan.test(i, plan.y); member++) {
    yield* emitMembers(set, [isAlphaSequence ? alphaMember(i) : numericMember(i, plan)]);
    const next = i + plan.incr;
    if (next === i && member + 1 >= plan.total) break;
    i = next;
  }
}

// The doubled-brace form wraps each expanded inner alternative. Its
// singleton form bypasses top-level empty-member filtering upstream.
function* expandDoubled(set: BraceSet, inner: string): Generator<string> {
  let first = "";
  let count = 0;
  for (const member of expand_(inner, set.max, false, set.depth + 1)) {
    if (count === 0) first = member;
    else yield* emitDoubledMember(set, first, member, count);
    count++;
  }
  if (count === 1) {
    for (const suffix of set.post()) yield set.pre + embrace(first) + suffix;
  }
}

function* emitDoubledMember(set: BraceSet, first: string, member: string, count: number): Generator<string> {
  if (count === 1) yield* emitMembers(set, [embrace(first)]);
  yield* emitMembers(set, [embrace(member)]);
}
