// Ported from minimatch@10.2.5 (https://github.com/isaacs/minimatch)
// Copyright: Isaac Z. Schlueter and Contributors
// License: BlueOak-1.0.0 (https://blueoakcouncil.org/license/1.0.0)
// Port notes: verbatim modulo house strictness (indexed access narrowed with
// locals). Position-bounded iteration over one [...] class — no recursion, no
// guard.

import { $GlobId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as RE from "effect/RegExp";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $GlobId.create("internal/braceExpressions");

/**
 * Reports a programmer error raised by this internal glob boundary.
 *
 * **Details**
 *
 * The character-class parser raises this error when the supplied position does
 * not begin a brace expression.
 *
 * **Example** (Describe an invalid parser invocation)
 *
 * ```ts
 * import { BraceExpressionError } from "@beep/glob/internal/braceExpressions"
 *
 * const error = BraceExpressionError.make({ message: "not in a brace expression" })
 * console.log(error.message) // not in a brace expression
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class BraceExpressionError extends S.TaggedError<BraceExpressionError, { readonly brand: unique symbol }>(
  $I`BraceExpressionError`
)(
  "BraceExpressionError",
  {
    message: S.String.pipe(
      $I.annoteKey("BraceExpressionError.message", {
        description: "Explains why character-class parsing was called outside a brace expression.",
      })
    ),
  },
  $I.annoteError<BraceExpressionError>("BraceExpressionError", {
    description:
      "Programmer error raised when the character-class parser is invoked at a position that does not begin a brace expression.",
  })
) {}

const posixClassesAsLocaleIndependentUnicodeProperties: {
  [posixClass: string]: [translation: string, uFlagRequired: boolean, negated?: boolean];
} = {
  "[:alnum:]": ["\\p{L}\\p{Nl}\\p{Nd}", true],
  "[:alpha:]": ["\\p{L}\\p{Nl}", true],
  "[:ascii:]": ["\\x00-\\x7f", false],
  "[:blank:]": ["\\p{Zs}\\t", true],
  "[:cntrl:]": ["\\p{Cc}", true],
  "[:digit:]": ["\\p{Nd}", true],
  "[:graph:]": ["\\p{Z}\\p{C}", true, true],
  "[:lower:]": ["\\p{Ll}", true],
  "[:print:]": ["\\p{C}", true],
  "[:punct:]": ["\\p{P}", true],
  "[:space:]": ["\\p{Z}\\t\\r\\n\\v\\f", true],
  "[:upper:]": ["\\p{Lu}", true],
  "[:word:]": ["\\p{L}\\p{Nl}\\p{Nd}\\p{Pc}", true],
  "[:xdigit:]": ["A-Fa-f0-9", false],
};

const escapeOnlyTheFewMetacharsBracketsNeed = Str.replace(/[[\]\\-]/g, "\\$&");
const regexpEscape = Str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");

const joinAlreadyEscapedRanges = (ranges: Array<string>): string => A.join(ranges, "");

/**
 * Describes a parsed character class through its regular-expression source,
 * Unicode-flag requirement, consumed character count, and magic-pattern status.
 *
 * @category models
 * @since 0.0.0
 */
export type ParseClassResult = [src: string, uFlag: boolean, consumed: number, hasMagic: boolean];

/**
 * Parses a glob character class at the supplied position into equivalent
 * regular-expression source.
 *
 * **Details**
 *
 * The result indicates whether the `/u` flag needs to be applied and the number
 * of characters consumed to parse the character class. This also removes
 * out-of-order ranges and returns `($.)` if the entire class is no good.
 * The source in that case is `$.`, which cannot match.
 * An unterminated class returns empty source, consumes zero characters, and
 * has no magic; a class containing one literal character also has no magic.
 *
 * **Gotchas**
 *
 * The supplied position must point to `[`; otherwise the parser raises
 * {@link BraceExpressionError}.
 *
 * **Example** (Inspect a character range)
 *
 * ```ts
 * import { parseClass } from "@beep/glob/internal/braceExpressions"
 *
 * const [source, unicode, consumed, hasMagic] = parseClass("[a-c]", 0)
 * console.log(source) // [a-c]
 * console.log([unicode, consumed, hasMagic].join(",")) // false,5,true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseClass: {
  (position: number): (glob: string) => ParseClassResult;
  (glob: string, position: number): ParseClassResult;
} = dual(2, (glob: string, position: number): ParseClassResult => {
  const pos = position;
  if (!O.contains("[")(Str.charAt(pos)(glob))) {
    throw BraceExpressionError.make({ message: "not in a brace expression" });
  }
  const scan: ClassScan = {
    glob,
    pos,
    ranges: [],
    negs: [],
    i: pos + 1,
    sawStart: false,
    uflag: false,
    escaping: false,
    negate: false,
    endPos: pos,
    rangeStart: "",
    posixClassInsideRangePoisonsGlob: false,
  };
  while (scan.i < glob.length && classStep(scan));
  return finishClass(scan);
});

const posixClassEntries = A.map(R.toEntries(posixClassesAsLocaleIndependentUnicodeProperties), (entry) => ({
  entry,
  regexp: new RegExp(RE.escape(entry[0]), "y"),
}));

interface ClassScan {
  endPos: number;
  escaping: boolean;
  readonly glob: string;
  i: number;
  negate: boolean;
  readonly negs: Array<string>;
  readonly pos: number;
  posixClassInsideRangePoisonsGlob: boolean;
  rangeStart: string;
  readonly ranges: Array<string>;
  sawStart: boolean;
  uflag: boolean;
}

const classStep = (scan: ClassScan): boolean => {
  const c = String(scan.glob[scan.i]);
  const control = classControlStep(scan, c);
  if (control !== undefined) return control;
  if (c === "[" && !scan.escaping) {
    const posix = consumePosixClass(scan);
    if (posix !== undefined) return posix;
  }
  classCharacter(scan, c);
  return true;
};

const classControlStep = (scan: ClassScan, c: string): boolean | undefined => {
  if ((c === "!" || c === "^") && scan.i === scan.pos + 1) {
    scan.negate = true;
    scan.i++;
    return true;
  }
  if (c === "]" && scan.sawStart && !scan.escaping) {
    scan.endPos = scan.i + 1;
    return false;
  }
  scan.sawStart = true;
  if (c === "\\" && !scan.escaping) {
    scan.escaping = true;
    scan.i++;
    return true;
  }
  return undefined;
};

const consumePosixClass = (scan: ClassScan): boolean | undefined => {
  for (const { entry, regexp } of posixClassEntries) {
    regexp.lastIndex = scan.i;
    if (regexp.test(scan.glob)) return applyPosixClass(scan, entry);
  }
  return undefined;
};

const applyPosixClass = (
  scan: ClassScan,
  [cls, [unip, u, neg]]: readonly [string, readonly [translation: string, uFlagRequired: boolean, negated?: boolean]]
): boolean => {
  if (scan.rangeStart !== "") {
    scan.posixClassInsideRangePoisonsGlob = true;
    return false;
  }
  scan.i += cls.length;
  if (neg === true) scan.negs.push(unip);
  else scan.ranges.push(unip);
  scan.uflag = scan.uflag || u;
  return true;
};

const classCharacter = (scan: ClassScan, c: string): void => {
  scan.escaping = false;
  if (scan.rangeStart !== "") {
    closeRange(scan, c);
    return;
  }
  if (scan.glob[scan.i + 1] === "-" && scan.glob[scan.i + 2] === "]") {
    scan.ranges.push(escapeOnlyTheFewMetacharsBracketsNeed(`${c}-`));
    scan.i += 2;
    return;
  }
  if (scan.glob[scan.i + 1] === "-") {
    scan.rangeStart = c;
    scan.i += 2;
    return;
  }
  scan.ranges.push(escapeOnlyTheFewMetacharsBracketsNeed(c));
  scan.i++;
};

const closeRange = (scan: ClassScan, c: string): void => {
  if (c > scan.rangeStart) {
    scan.ranges.push(
      `${escapeOnlyTheFewMetacharsBracketsNeed(scan.rangeStart)}-${escapeOnlyTheFewMetacharsBracketsNeed(c)}`
    );
  } else if (c === scan.rangeStart) {
    scan.ranges.push(escapeOnlyTheFewMetacharsBracketsNeed(c));
  }
  scan.rangeStart = "";
  scan.i++;
};

const finishClass = (scan: ClassScan): ParseClassResult => {
  const { glob, pos, ranges, negs, endPos } = scan;
  if (scan.posixClassInsideRangePoisonsGlob) return ["$.", false, glob.length - pos, true];
  if (endPos < scan.i) {
    return ["", false, 0, false];
  }
  if (ranges.length === 0 && negs.length === 0) {
    return ["$.", false, glob.length - pos, true];
  }
  return singleLiteralCharClassIsAnEscapeNotMagic(scan) ?? [combinedClass(scan), scan.uflag, endPos - pos, true];
};

const singleLiteralCharClassIsAnEscapeNotMagic = (scan: ClassScan): ParseClassResult | undefined => {
  const { ranges, negs } = scan;
  const soleRange = ranges[0];
  if (negs.length !== 0 || ranges.length !== 1 || soleRange === undefined || scan.negate) return undefined;
  if (!/^\\?.$/.test(soleRange)) return undefined;
  const r = soleRange.length === 2 ? Str.slice(-1)(soleRange) : soleRange;
  return [regexpEscape(r), false, scan.endPos - scan.pos, false];
};

const combinedClass = (scan: ClassScan): string => {
  const { ranges, negs, negate } = scan;
  const sranges = `[${negate ? "^" : ""}${joinAlreadyEscapedRanges(ranges)}]`;
  const snegs = `[${negate ? "" : "^"}${joinAlreadyEscapedRanges(negs)}]`;
  if (ranges.length !== 0 && negs.length !== 0) return `(${sranges}|${snegs})`;
  return ranges.length !== 0 ? sranges : snegs;
};
