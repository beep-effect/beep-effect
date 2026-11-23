// Ported from minimatch@10.2.5 (https://github.com/isaacs/minimatch)
// Copyright: Isaac Z. Schlueter and Contributors
// License: BlueOak-1.0.0 (https://blueoakcouncil.org/license/1.0.0)
//
// Port notes, the deliberate changes from upstream index.ts:
// - NO ambient environment detection: defaultPlatform (process.platform and
//   the __MINIMATCH_TESTING_PLATFORM__ env read) is deleted; platform is an
//   explicit option defaulting to "posix". All win32 handling (UNC, drive
//   letters, backslash splitting, windowsNoMagicRoot) is kept behind it.
// - Dropped surface: the minimatch() convenience function, filter, match,
//   defaults(), sep, the nonull option (only meaningful for match lists),
//   the debug option and its console.error wiring (the no-op debug() method
//   and its call sites are kept so the bodies diff cleanly against
//   upstream), and the deprecated allowWindowsEscape.
// - maxGlobstarRecursion is validated by assertCap (a NaN or non-integer cap
//   is a wiring bug and dies as an InvalidCap defect). The
//   #matchGlobStarBodySections limit check is kept verbatim: exceeding it is
//   upstream's intentional false negative — an acceptable break in
//   correctness for security — and must never throw; match() stays total.
// - braceExpand keeps the CVE-2022-3517 ReDoS-safe pre-check regex verbatim
//   (credit: Yeting Li). Budget exhaustion inside the expander throws the
//   typed guard signal instead of silently truncating (see
//   braceExpansion.ts).
// - The fs-walk optimizer passes (adjascentGlobstarOptimize, spelled as
//   upstream spells it, levelOneOptimize, levelTwoFileOptimize,
//   firstPhasePreProcess, secondPhasePreProcess, partsMatch) are kept
//   unchanged behind optimizationLevel.

import { $GlobId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { assertValidPattern } from "./assertValidPattern.ts";
import { AST } from "./ast.ts";
import { expand } from "./braceExpansion.ts";
import { assertCap, EXPANSION_MAX, GuardExceeded, MAX_GLOBSTAR_RECURSION } from "./limits.ts";
import { GLOBSTAR } from "./types.ts";
import type { EngineOptionsInput, MMRegExp, ParseReturn, ParseReturnFiltered, Platform } from "./types.ts";

export { escape } from "./escape.ts";
export { unescape } from "./unescape.ts";
export { GLOBSTAR };
export type { EngineOptionsInput, MMRegExp, ParseReturn, ParseReturnFiltered, Platform } from "./types.ts";

const $I = $GlobId.create("internal/minimatch");

/**
 * An invariant violation in the internal minimatch engine.
 *
 * **Example** (Describe an engine invariant violation)
 *
 * ```ts
 * import { MinimatchError } from "@beep/glob/internal/minimatch"
 *
 * const error = MinimatchError.make({ message: "Unexpected matching state" })
 * console.log(error.message) // Unexpected matching state
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class MinimatchError extends S.TaggedError<MinimatchError, { readonly brand: unique symbol }>(
  $I`MinimatchError`
)(
  "MinimatchError",
  {
    message: S.String.pipe(
      $I.annoteKey("MinimatchError.message", {
        description: "Describes the internal matching invariant that was violated.",
      })
    ),
  },
  $I.annoteError<MinimatchError>("MinimatchError", {
    description:
      "Programmer error raised when the internal matcher reaches an impossible state while matching a path against a compiled pattern.",
  })
) {}

const starDotExtRE = /^\*+([^+@!?*[(]*)$/;
const starDotExtTest = (ext: string) => (f: string) => !Str.startsWith(".")(f) && Str.endsWith(ext)(f);
const starDotExtTestDot = (ext: string) => (f: string) => Str.endsWith(ext)(f);
const starDotExtTestNocase = (ext: string) => {
  const lower = Str.toLowerCase(ext);
  return (f: string) => !Str.startsWith(".")(f) && Str.endsWith(lower)(Str.toLowerCase(f));
};
const starDotExtTestNocaseDot = (ext: string) => {
  const lower = Str.toLowerCase(ext);
  return (f: string) => Str.endsWith(lower)(Str.toLowerCase(f));
};
const starDotStarRE = /^\*+\.\*+$/;
const starDotStarTest = (f: string) => !Str.startsWith(".")(f) && Str.includes(".")(f);
const starDotStarTestDot = (f: string) => f !== "." && f !== ".." && Str.includes(".")(f);
const dotStarRE = /^\.\*+$/;
const dotStarTest = (f: string) => f !== "." && f !== ".." && Str.startsWith(".")(f);
const starRE = /^\*+$/;
const starTest = (f: string) => f.length !== 0 && !Str.startsWith(".")(f);
const starTestDot = (f: string) => f.length !== 0 && f !== "." && f !== "..";
const qmarksRE = /^\?+([^+@!?*[(]*)?$/;
const qmarksTestNocase = ([$0, ext = ""]: RegExpMatchArray) => {
  const noext = qmarksTestNoExt([$0]);
  if (ext === "") return noext;
  const lower = Str.toLowerCase(ext);
  return (f: string) => noext(f) && Str.endsWith(lower)(Str.toLowerCase(f));
};
const qmarksTestNocaseDot = ([$0, ext = ""]: RegExpMatchArray) => {
  const noext = qmarksTestNoExtDot([$0]);
  if (ext === "") return noext;
  const lower = Str.toLowerCase(ext);
  return (f: string) => noext(f) && Str.endsWith(lower)(Str.toLowerCase(f));
};
const qmarksTestDot = ([$0, ext = ""]: RegExpMatchArray) => {
  const noext = qmarksTestNoExtDot([$0]);
  return ext === "" ? noext : (f: string) => noext(f) && Str.endsWith(ext)(f);
};
const qmarksTest = ([$0, ext = ""]: RegExpMatchArray) => {
  const noext = qmarksTestNoExt([$0]);
  return ext === "" ? noext : (f: string) => noext(f) && Str.endsWith(ext)(f);
};
const qmarksTestNoExt = ([$0]: [string]) => {
  const len = $0.length;
  return (f: string) => f.length === len && !Str.startsWith(".")(f);
};
const qmarksTestNoExtDot = ([$0]: [string]) => {
  const len = $0.length;
  return (f: string) => f.length === len && f !== "." && f !== "..";
};

const anyCharButSlashUnescapedSinceNewRegExpTakesSlashLiterally = "[^/]";

const star = `${anyCharButSlashUnescapedSinceNewRegExpTakesSlashLiterally}*?`;

const twoStarAnySegmentsButDotOrDotDot = "(?:(?!(?:\\/|^)(?:\\.{1,2})($|\\/)).)*?";

const twoStarNoSegmentStartingWithDot = "(?:(?!(?:\\/|^)\\.).)*?";

const reDoSSafeBraceSetProbe = /\{(?:(?!\{).)*}/;

/**
 * Expands brace alternatives and numeric ranges into concrete glob patterns.
 *
 * **Details**
 *
 * Invalid brace sets remain unexpanded. With `nobrace`, the original pattern is returned
 * as the only result. Expansion budgets are passed to the guarded brace expander.
 *
 * **Example** (Expand file extensions)
 *
 * ```ts
 * import { braceExpand } from "@beep/glob/internal/minimatch"
 *
 * console.log(braceExpand("file.{ts,js}").join(",")) // file.ts,file.js
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const braceExpand: {
  (options?: EngineOptionsInput): (pattern: string) => Array<string>;
  (pattern: string, options?: EngineOptionsInput): Array<string>;
} = dual(
  (args) => P.isString(args[0]),
  (pattern: string, options: EngineOptionsInput = {}): Array<string> => {
    assertValidPattern(pattern);

    if (options.nobrace === true || !reDoSSafeBraceSetProbe.test(pattern)) {
      return [pattern];
    }

    const opts = options.braceExpandMax === undefined ? {} : { max: options.braceExpandMax };
    return expand(pattern, opts);
  }
);

const squeezeEmptyAndDotParts = (parts: Array<string>): boolean => {
  const squeezed = squeezeInteriorParts(parts);
  return collapseLoneDotPair(parts) || squeezed;
};

const isEmptyOrDot = (p: string | undefined): boolean => p === "." || p === "";

const squeezeInteriorParts = (parts: Array<string>): boolean => {
  let didSomething = false;
  for (let i = 1; i < parts.length - 1; i++) {
    const isUncLead = i === 1 && parts[i] === "" && parts[0] === "";
    if (!isUncLead && isEmptyOrDot(parts[i])) {
      didSomething = true;
      parts.splice(i, 1);
      i--;
    }
  }
  return didSomething;
};

const collapseLoneDotPair = (parts: Array<string>): boolean => {
  if (parts[0] !== "." || parts.length !== 2 || !isEmptyOrDot(parts[1])) return false;
  parts.pop();
  return true;
};

const nonCollapsibleParents = HashSet.make("", ".", "..", "**");
const isCollapsibleParent = (p: string | undefined): p is string =>
  p !== undefined && !HashSet.has(nonCollapsibleParents, p);

const collapseParentSegments = (
  parts: Array<string>,
  removedPairInPlace: (dotDotIndex: number, parent: string) => boolean
): boolean => {
  let didSomething = false;
  let dd = parts.indexOf("..", 1);
  while (dd !== -1) {
    const p = parts[dd - 1];
    if (isCollapsibleParent(p) && removedPairInPlace(dd, p)) {
      didSomething = true;
      const resumeTwoPlacesBackAfterRemoval = dd - 2;
      dd = resumeTwoPlacesBackAfterRemoval;
    }
    dd = parts.indexOf("..", dd + 1);
  }
  return didSomething;
};

const globMagic = /[?*]|[+@!]\(.*?\)|\[|]/;
const regExpEscape = Str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");

const fastTestForMostCommonPartShapesFirstMatchWins = (
  pattern: string,
  options: EngineOptionsInput
): null | ((f: string) => boolean) => {
  if (starRE.test(pattern)) return options.dot === true ? starTestDot : starTest;
  const mStarDotExt = O.getOrNull(Str.match(starDotExtRE)(pattern));
  if (mStarDotExt !== null) return mStarDotExt[1] === undefined ? null : starDotExtTestFor(options)(mStarDotExt[1]);
  return selectLaterFastTest(pattern, options);
};

const selectLaterFastTest = (pattern: string, options: EngineOptionsInput): null | ((f: string) => boolean) => {
  const mQmarks = O.getOrNull(Str.match(qmarksRE)(pattern));
  if (mQmarks !== null) return qmarksTestFor(options)(mQmarks);
  if (starDotStarRE.test(pattern)) return options.dot === true ? starDotStarTestDot : starDotStarTest;
  return dotStarRE.test(pattern) ? dotStarTest : null;
};

const starDotExtTestFor = (options: EngineOptionsInput): ((ext: string) => (f: string) => boolean) => {
  if (options.nocase === true) return options.dot === true ? starDotExtTestNocaseDot : starDotExtTestNocase;
  return options.dot === true ? starDotExtTestDot : starDotExtTest;
};

const qmarksTestFor = (options: EngineOptionsInput): ((m: RegExpMatchArray) => (f: string) => boolean) => {
  if (options.nocase === true) return options.dot === true ? qmarksTestNocaseDot : qmarksTestNocase;
  return options.dot === true ? qmarksTestDot : qmarksTest;
};

const demoteGlobstars = (globParts: Array<Array<string>>): void => {
  for (const partset of globParts) {
    for (let j = 0; j < partset.length; j++) {
      if (partset[j] === "**") partset[j] = "*";
    }
  }
};

const isUncHostPart = (p: string | undefined): boolean => p === "?" || (p !== undefined && !globMagic.test(p));

const isUncRootWithoutMagicInHostOrShare = (s: ReadonlyArray<string>): boolean =>
  s[0] === "" && s[1] === "" && isUncHostPart(s[2]) && s[3] !== undefined && !globMagic.test(s[3]);

const isDriveLetter = (p: unknown): boolean => P.isString(p) && /^[a-z]:$/i.test(p);

const isUncDriveSetWithLiteralQuestionHost = (
  p: ReadonlyArray<ParseReturnFiltered>,
  rawGlobParts: ReadonlyArray<string> | undefined
): boolean => p[0] === "" && p[1] === "" && rawGlobParts?.[2] === "?" && isDriveLetter(p[3]);

const driveLetterIndexOfPlainOrUncDrivePath = (parts: ReadonlyArray<ParseReturn>): number | undefined => {
  if (isDriveLetter(parts[0])) return 0;
  return parts[0] === "" && parts[1] === "" && parts[2] === "?" && isDriveLetter(parts[3]) ? 3 : undefined;
};

const startAtSharedDriveLetterCaseInsensitivelyAdoptingFileSpelling = (
  file: Array<string>,
  pattern: Array<ParseReturn>
): readonly [number, number] => {
  const fdi = driveLetterIndexOfPlainOrUncDrivePath(file);
  const pdi = driveLetterIndexOfPlainOrUncDrivePath(pattern);
  if (fdi === undefined || pdi === undefined) return [0, 0];
  const fd = file[fdi];
  const pd = pattern[pdi];
  if (!P.isString(fd) || !P.isString(pd) || Str.toLowerCase(fd) !== Str.toLowerCase(pd)) return [0, 0];
  pattern[pdi] = fd;
  return [fdi, pdi];
};

const emptyOrDots = HashSet.make("", ".", "..");
const isNamedSegment = (p: string | undefined): boolean => p !== undefined && !HashSet.has(emptyOrDots, p);

const dedupeGlobstarRun = (parts: Array<string>, gs: number): void => {
  let lastGlobstarOfRun = gs;
  while (parts[lastGlobstarOfRun + 1] === "**") lastGlobstarOfRun++;
  const redundantGlobstarsAfterFirst = lastGlobstarOfRun - gs;
  if (redundantGlobstarsAfterFirst > 0) parts.splice(gs + 1, redundantGlobstarsAfterFirst);
};

// decision: minimatch-optimizer-rewrites
const splitGlobstarParents = (parts: Array<string>, globParts: Array<Array<string>>, max: number): boolean => {
  let didSomething = false;
  let gs = parts.indexOf("**");
  while (gs !== -1) {
    dedupeGlobstarRun(parts, gs);
    if (parts[gs + 1] === ".." && isNamedSegment(parts[gs + 2]) && isNamedSegment(parts[gs + 3])) {
      if (globParts.length >= max) {
        throw GuardExceeded.fromReason("ExpansionBudgetExceeded", max, globParts.length + 1);
      }
      didSomething = true;
      parts.splice(gs, 1);
      const other = parts.slice(0);
      other[gs] = "**";
      globParts.push(other);
      gs--;
    }
    gs = parts.indexOf("**", gs + 1);
  }
  return didSomething;
};

const collapseFirstPhaseParent = (parts: Array<string>, dd: number): boolean => {
  const needDot = dd === 1 && parts[dd + 1] === "**";
  const splin = needDot ? ["."] : [];
  parts.splice(dd - 1, 2, ...splin);
  if (parts.length === 0) parts.push("");
  return true;
};

interface PartsMatchMergeCursor {
  ai: number;
  bi: number;
  readonly result: Array<string>;
  sideAStarAlreadyCovered: "" | "a" | "b";
}

const skipEmptyGlobstar = (
  merge: PartsMatchMergeCursor,
  a: Array<string>,
  b: Array<string>,
  av: string,
  bv: string
): boolean => {
  if (av === "**" && bv === a[merge.ai + 1]) {
    merge.result.push(av);
    merge.ai++;
    return true;
  }
  if (bv === "**" && av === b[merge.bi + 1]) {
    merge.result.push(bv);
    merge.bi++;
    return true;
  }
  return false;
};

const claimEqual = (merge: PartsMatchMergeCursor, av: string, bv: string): boolean => {
  merge.result.push(merge.sideAStarAlreadyCovered === "b" ? bv : av);
  merge.ai++;
  merge.bi++;
  return true;
};

const claimStar = (merge: PartsMatchMergeCursor, side: "a" | "b", star: string): boolean => {
  if (merge.sideAStarAlreadyCovered === (side === "a" ? "b" : "a")) return false;
  merge.sideAStarAlreadyCovered = side;
  merge.result.push(star);
  merge.ai++;
  merge.bi++;
  return true;
};

const matchOneRemainder = (file: Array<string>, fi: number, pi: number, partial: boolean, pl: number): boolean => {
  const fl = file.length;
  const ranOutOfPatternAndFileTogether = fi === fl && pi === pl;
  if (ranOutOfPatternAndFileTogether) return true;
  const ranOutOfFileWithPatternLeftOkOnlyMidFsWalk = fi === fl;
  if (ranOutOfFileWithPatternLeftOkOnlyMidFsWalk) return partial;
  const patternExhaustedSoOnlyATrailingSlashSegmentMayRemainLikeAbSlashUnderAStar = fi === fl - 1 && file[fi] === "";
  return patternExhaustedSoOnlyATrailingSlashSegmentMayRemainLikeAbSlashUnderAStar;
};

interface GlobstarSections {
  readonly body: Array<ParseReturn>;
  readonly head: Array<ParseReturn>;
  readonly tail: Array<ParseReturn>;
}

const globstarSections = (pattern: Array<ParseReturn>, patternIndex: number, partial: boolean): GlobstarSections => {
  const firstgs = pattern.indexOf(GLOBSTAR, patternIndex);
  const lastgs = pattern.lastIndexOf(GLOBSTAR);
  const head = pattern.slice(patternIndex, firstgs);
  return partial
    ? { head, body: pattern.slice(firstgs + 1), tail: [] }
    : { head, body: pattern.slice(firstgs + 1, lastgs), tail: pattern.slice(lastgs + 1) };
};

type BodySection = [section: Array<ParseReturn>, lastPossibleFileIndex: number];

const globstarBodySegments = (body: Array<ParseReturn>, searchableFileLength: number): Array<BodySection> => {
  let currentBody: BodySection = [[], 0];
  const bodySegments: Array<BodySection> = [currentBody];
  let nonGsParts = 0;
  const nonGsPartsSums: Array<number> = [0];
  for (const b of body) {
    if (b === GLOBSTAR) {
      nonGsPartsSums.push(nonGsParts);
      currentBody = [[], 0];
      bodySegments.push(currentBody);
    } else {
      currentBody[0].push(b);
      nonGsParts++;
    }
  }
  for (const [b, nonGlobstarPartsAfter] of A.zip(bodySegments, A.reverse(nonGsPartsSums))) {
    b[1] = searchableFileLength - (nonGlobstarPartsAfter + b[0].length);
  }
  return bodySegments;
};

interface BodySectionSearch {
  readonly bodySegments: Array<BodySection>;
  readonly file: Array<string>;
  readonly partial: boolean;
  readonly sawTail: boolean;
}

const regExpSourceOfPartCollectingFlags = (
  p: ParseReturnFiltered,
  flags: MutableHashSet.MutableHashSet<string>
): string | typeof GLOBSTAR | undefined => {
  if (p instanceof RegExp) {
    for (const f of p.flags) MutableHashSet.add(flags, f);
  }
  return P.isString(p) ? regExpEscape(p) : p === GLOBSTAR ? GLOBSTAR : p._src;
};

const rewriteGlobstarAt = (
  pp: Array<string | typeof GLOBSTAR | undefined>,
  p: string | typeof GLOBSTAR | undefined,
  i: number,
  twoStar: string
): void => {
  const next = pp[i + 1];
  const prev = pp[i - 1];
  if (p !== GLOBSTAR || prev === GLOBSTAR) return;
  if (prev === undefined) {
    rewriteLeadingGlobstar(pp, i, next, twoStar);
    return;
  }
  if (next === undefined) {
    pp[i - 1] = `${prev}(?:\\/|\\/${twoStar})?`;
  } else if (next !== GLOBSTAR) {
    pp[i - 1] = `${prev}(?:\\/|\\/${twoStar}\\/)${next}`;
    pp[i + 1] = GLOBSTAR;
  }
};

const rewriteLeadingGlobstar = (
  pp: Array<string | typeof GLOBSTAR | undefined>,
  i: number,
  next: string | typeof GLOBSTAR | undefined,
  twoStar: string
): void => {
  if (next !== undefined && next !== GLOBSTAR) {
    pp[i + 1] = `(?:\\/|${twoStar}\\/)?${next}`;
  } else {
    pp[i] = twoStar;
  }
};

const progressivelyLongerPrefixAlternativesForPartialMatch = (filtered: Array<string>): string => {
  const prefixes: Array<string> = [];
  for (let i = 1; i <= filtered.length; i++) {
    prefixes.push(A.join(filtered.slice(0, i), "/"));
  }
  return `(?:${A.join(prefixes, "|")})`;
};

const lastNonEmptySegment = (ff: Array<string>): string => {
  let filename = "";
  for (const segment of ff) {
    if (segment !== "") filename = segment;
  }
  return filename;
};

const PAIRWISE_DEDUPE_CEILING_AVOIDING_QUADRATIC_WORK = 1000;

const isNonEmptyAlternativeDroppingSparseHolesNativeFilterSkipped = (gs: Array<string> | undefined): boolean =>
  gs !== undefined && gs.length > 0;

const presentLikeNativeFilterSkippingSparseHoles = (array: ReadonlyArray<unknown>, i: number): boolean => i in array;

const undefinedAsEmptyLikeNativeJoin = (p: string | undefined): string => p ?? "";

const ROOT_SLASH_IS_A_PARTIAL_PREFIX_OF_EVERY_PATTERN = "\\/";

const regExpCompileFailureShouldBeImpossible = (): false => false;

const defineOwnTestSinceAssigningOverAFrozenPrototypeThrows = (re: object, fastTest: (f: string) => boolean): void => {
  Reflect.defineProperty(re, "test", { value: fastTest });
};

type MatchedOrFalseToKeepWalkingOrNullToGiveUp = boolean | null;

/**
 * Compiles a glob pattern once for repeated path matching and pattern inspection.
 *
 * **Details**
 *
 * The platform defaults explicitly to `posix`; Windows path handling requires `platform: "win32"`.
 * The globstar recursion cap bounds matching work; reaching it yields a false negative
 * instead of throwing, preserving the upstream security tradeoff.
 *
 * **Example** (Match a nested TypeScript path)
 *
 * ```ts
 * import { Minimatch } from "@beep/glob/internal/minimatch"
 *
 * const matcher = new Minimatch(["src", "**", "*.ts"].join("/"))
 * console.log(matcher.match("src/internal/parser.ts")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Minimatch {
  /**
   * The engine options supplied when this matcher was constructed.
   *
   * **Example** (Inspect options)
   *
   * ```ts
   * import { Minimatch } from "@beep/glob/internal/minimatch"
   *
   * const matcher = new Minimatch("*.ts", { dot: true })
   * console.log(matcher.options.dot) // true
   * ```
   *
   * @category configuration
   * @since 0.0.0
   */
  options: EngineOptionsInput;
  /**
   * The compiled segment alternatives retained after parsing and validation.
   *
   * **Example** (Inspect set)
   *
   * ```ts
   * import { Minimatch } from "@beep/glob/internal/minimatch"
   *
   * const matcher = new Minimatch("*.ts", {})
   * console.log(matcher.set.length) // 1
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  set: Array<Array<ParseReturnFiltered>>;
  /**
   * The working pattern after path normalization and leading-negation parsing.
   *
   * **Example** (Inspect pattern)
   *
   * ```ts
   * import { Minimatch } from "@beep/glob/internal/minimatch"
   *
   * const matcher = new Minimatch("!file.ts", {})
   * console.log(matcher.pattern) // file.ts
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  pattern: string;

  /**
   * Whether backslashes in the input pattern are treated as path separators.
   *
   * **Example** (Inspect windowsPathsNoEscape)
   *
   * ```ts
   * import { Minimatch } from "@beep/glob/internal/minimatch"
   *
   * const matcher = new Minimatch("file.ts", { windowsPathsNoEscape: true })
   * console.log(matcher.windowsPathsNoEscape) // true
   * ```
   *
   * @category configuration
   * @since 0.0.0
   */
  windowsPathsNoEscape: boolean;
  /**
   * Whether leading negation markers remain literal pattern content.
   *
   * **Example** (Inspect nonegate)
   *
   * ```ts
   * import { Minimatch } from "@beep/glob/internal/minimatch"
   *
   * const matcher = new Minimatch("file.ts", { nonegate: true })
   * console.log(matcher.nonegate) // true
   * ```
   *
   * @category configuration
   * @since 0.0.0
   */
  nonegate: boolean;
  /**
   * Whether the parsed pattern has an odd number of leading negation markers.
   *
   * **Example** (Inspect negate)
   *
   * ```ts
   * import { Minimatch } from "@beep/glob/internal/minimatch"
   *
   * const matcher = new Minimatch("!file.ts", {})
   * console.log(matcher.negate) // true
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  negate: boolean;
  /**
   * Whether the pattern was recognized as a comment rather than a matching pattern.
   *
   * **Example** (Inspect comment)
   *
   * ```ts
   * import { Minimatch } from "@beep/glob/internal/minimatch"
   *
   * const matcher = new Minimatch("#comment", {})
   * console.log(matcher.comment) // true
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  comment: boolean;
  /**
   * Whether the matcher was initialized with an empty pattern.
   *
   * **Example** (Inspect empty)
   *
   * ```ts
   * import { Minimatch } from "@beep/glob/internal/minimatch"
   *
   * const matcher = new Minimatch("", {})
   * console.log(matcher.empty) // true
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  empty: boolean;
  /**
   * Whether splitting and optimization preserve repeated path separators.
   *
   * **Example** (Inspect preserveMultipleSlashes)
   *
   * ```ts
   * import { Minimatch } from "@beep/glob/internal/minimatch"
   *
   * const matcher = new Minimatch("file.ts", { preserveMultipleSlashes: true })
   * console.log(matcher.preserveMultipleSlashes) // true
   * ```
   *
   * @category configuration
   * @since 0.0.0
   */
  preserveMultipleSlashes: boolean;
  /**
   * The default prefix-matching mode used by path matching.
   *
   * **Example** (Inspect partial)
   *
   * ```ts
   * import { Minimatch } from "@beep/glob/internal/minimatch"
   *
   * const matcher = new Minimatch("file.ts", { partial: true })
   * console.log(matcher.partial) // true
   * ```
   *
   * @category configuration
   * @since 0.0.0
   */
  partial: boolean;
  /**
   * The deduplicated brace-expanded patterns before segment preprocessing.
   *
   * **Example** (Inspect globSet)
   *
   * ```ts
   * import { Minimatch } from "@beep/glob/internal/minimatch"
   *
   * const matcher = new Minimatch("file.{ts,js}", {})
   * console.log(matcher.globSet.join(",")) // file.ts,file.js
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  globSet: Array<string>;
  /**
   * The preprocessed path-segment alternatives used to build the compiled set.
   *
   * **Example** (Inspect globParts)
   *
   * ```ts
   * import { Minimatch } from "@beep/glob/internal/minimatch"
   *
   * const matcher = new Minimatch("src/file.ts", {})
   * console.log(matcher.globParts[0]?.join("/")) // src/file.ts
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  globParts: Array<Array<string>>;
  /**
   * Whether pattern compilation uses case-insensitive matching.
   *
   * **Example** (Inspect nocase)
   *
   * ```ts
   * import { Minimatch } from "@beep/glob/internal/minimatch"
   *
   * const matcher = new Minimatch("file.ts", { nocase: true })
   * console.log(matcher.nocase) // true
   * ```
   *
   * @category configuration
   * @since 0.0.0
   */
  nocase: boolean;

  /**
   * Whether the explicitly selected platform enables Windows path handling.
   *
   * **Example** (Inspect isWindows)
   *
   * ```ts
   * import { Minimatch } from "@beep/glob/internal/minimatch"
   *
   * const matcher = new Minimatch("file.ts", { platform: "win32" })
   * console.log(matcher.isWindows) // true
   * ```
   *
   * @category configuration
   * @since 0.0.0
   */
  isWindows: boolean;
  /**
   * The explicit path platform, defaulting to POSIX without ambient detection.
   *
   * **Example** (Inspect platform)
   *
   * ```ts
   * import { Minimatch } from "@beep/glob/internal/minimatch"
   *
   * const matcher = new Minimatch("file.ts", {})
   * console.log(matcher.platform) // posix
   * ```
   *
   * @category configuration
   * @since 0.0.0
   */
  platform: Platform;
  /**
   * Whether Windows drive and UNC roots are kept literal during pattern compilation.
   *
   * **Example** (Inspect windowsNoMagicRoot)
   *
   * ```ts
   * import { Minimatch } from "@beep/glob/internal/minimatch"
   *
   * const matcher = new Minimatch("file.ts", { platform: "win32", nocase: true })
   * console.log(matcher.windowsNoMagicRoot) // true
   * ```
   *
   * @category configuration
   * @since 0.0.0
   */
  windowsNoMagicRoot: boolean;
  /**
   * The validated recursion cap used when matching globstar body sections.
   *
   * **Example** (Inspect maxGlobstarRecursion)
   *
   * ```ts
   * import { Minimatch } from "@beep/glob/internal/minimatch"
   *
   * const matcher = new Minimatch("file.ts", { maxGlobstarRecursion: 5 })
   * console.log(matcher.maxGlobstarRecursion) // 5
   * ```
   *
   * @category configuration
   * @since 0.0.0
   */
  maxGlobstarRecursion: number;

  /**
   * The cached whole-pattern regular expression, initially null and false when compilation fails.
   *
   * **Example** (Inspect regexp)
   *
   * ```ts
   * import { Minimatch } from "@beep/glob/internal/minimatch"
   *
   * const matcher = new Minimatch("file.ts", {})
   * console.log(matcher.regexp) // null
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  regexp: false | null | MMRegExp;
  /**
   * Validates and compiles a pattern using explicit engine options.
   *
   * **Example** (Construct a case-insensitive matcher)
   *
   * ```ts
   * import { Minimatch } from "@beep/glob/internal/minimatch"
   *
   * const matcher = new Minimatch("*.TS", { nocase: true })
   * console.log(matcher.match("file.ts")) // true
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  constructor(pattern: string, options: EngineOptionsInput = {}) {
    assertValidPattern(pattern);

    this.options = options;
    this.maxGlobstarRecursion = assertCap(
      "maxGlobstarRecursion",
      options.maxGlobstarRecursion ?? MAX_GLOBSTAR_RECURSION
    );
    this.pattern = pattern;
    this.platform = options.platform ?? "posix";
    this.isWindows = this.platform === "win32";
    this.windowsPathsNoEscape = options.windowsPathsNoEscape === true;
    if (this.windowsPathsNoEscape) {
      this.pattern = Str.replace(/\\/g, "/")(this.pattern);
    }
    this.preserveMultipleSlashes = options.preserveMultipleSlashes === true;
    this.regexp = null;
    this.negate = false;
    this.nonegate = options.nonegate === true;
    this.comment = false;
    this.empty = false;
    this.partial = options.partial === true;
    this.nocase = this.options.nocase === true;
    this.windowsNoMagicRoot =
      options.windowsNoMagicRoot !== undefined ? options.windowsNoMagicRoot : !!(this.isWindows && this.nocase);

    this.globSet = [];
    this.globParts = [];
    this.set = [];

    this.make();
  }

  /**
   * Detects whether compiled path segments contain glob syntax.
   *
   * **Details**
   *
   * Brace alternatives count as magic only when `magicalBraces` is enabled.
   *
   * **Example** (Distinguish a literal path from a glob)
   *
   * ```ts
   * import { Minimatch } from "@beep/glob/internal/minimatch"
   *
   * console.log(new Minimatch("file.ts").hasMagic()) // false
   * console.log(new Minimatch("*.ts").hasMagic()) // true
   * ```
   *
   * @category predicates
   * @since 0.0.0
   */
  hasMagic(): boolean {
    if (this.options.magicalBraces === true && this.set.length > 1) {
      return true;
    }
    for (const pattern of this.set) {
      for (const part of pattern) {
        if (!P.isString(part)) return true;
      }
    }
    return false;
  }

  /**
   * Accepts engine diagnostic calls without producing output.
   *
   * **Details**
   *
   * The upstream debug option and console wiring are dropped; call sites remain for fidelity.
   *
   * **Example** (Observe the no-op diagnostic return)
   *
   * ```ts
   * import { Minimatch } from "@beep/glob/internal/minimatch"
   *
   * const matcher = new Minimatch("*.ts")
   * console.log(matcher.debug("inspection")) // undefined
   * ```
   *
   * @category diagnostics
   * @since 0.0.0
   */
  debug(..._args: Array<unknown>) {
    // no-op: the upstream debug option and its console.error wiring are
    // dropped; call sites are kept for diffability against upstream.
  }

  /**
   * Builds the compiled alternatives and path segments used by this matcher.
   *
   * **Example** (Compile a replacement pattern)
   *
   * ```ts
   * import { Minimatch } from "@beep/glob/internal/minimatch"
   *
   * const matcher = new Minimatch("*.ts")
   * matcher.pattern = "*.js"
   * matcher.make()
   * console.log(matcher.match("file.js")) // true
   * ```
   *
   * @category parsing
   * @since 0.0.0
   */
  make() {
    if (this.#markTrivial()) return;

    this.parseNegate();

    this.globSet = A.dedupe(this.braceExpand());

    this.debug(this.pattern, this.globSet);

    const rawGlobParts = A.map(this.globSet, (s) => this.slashSplit(s));
    this.globParts = this.preprocess(rawGlobParts);
    this.debug(this.pattern, this.globParts);

    const set = A.map(this.globParts, (s) => this.#compileGlobParts(s));

    this.debug(this.pattern, set);

    this.set = A.filter(set, (s): s is Array<ParseReturnFiltered> => A.every(s, (p) => p !== false));

    if (this.isWindows) this.#restoreLiteralUncQuestionMarks();

    this.debug(this.pattern, this.set);
  }

  #markTrivial(): boolean {
    if (this.options.nocomment !== true && this.pattern[0] === "#") {
      this.comment = true;
      return true;
    }
    if (this.pattern === "") {
      this.empty = true;
      return true;
    }
    return false;
  }

  #compileGlobParts(s: Array<string>): Array<ParseReturn> {
    const rooted = this.isWindows && this.windowsNoMagicRoot ? this.#compileRootedParts(s) : undefined;
    return rooted ?? A.map(s, (ss) => this.parse(ss));
  }

  #compileRootedParts(s: Array<string>): Array<ParseReturn> | undefined {
    const root = s[0];
    if (isUncRootWithoutMagicInHostOrShare(s)) {
      return [...s.slice(0, 4), ...A.map(s.slice(4), (ss) => this.parse(ss))];
    }
    if (root !== undefined && /^[a-z]:/i.test(root)) {
      return [root, ...A.map(s.slice(1), (ss) => this.parse(ss))];
    }
    return undefined;
  }

  #restoreLiteralUncQuestionMarks(): void {
    for (let i = 0; i < this.set.length; i++) {
      const p = this.set[i];
      if (p !== undefined && isUncDriveSetWithLiteralQuestionHost(p, this.globParts[i])) {
        p[2] = "?";
      }
    }
  }

  // decision: minimatch-optimizer-rewrites
  /**
   * Simplifies split pattern alternatives using the configured optimization level.
   *
   * **Details**
   *
   * The transformations prepare patterns for faster filesystem walking. Some passes mutate
   * the supplied segment arrays, and `noglobstar` replaces globstars with single stars.
   *
   * **Example** (Collapse adjacent globstars during preprocessing)
   *
   * ```ts
   * import { Minimatch } from "@beep/glob/internal/minimatch"
   *
   * const matcher = new Minimatch("*", { optimizationLevel: 0 })
   * const parts = matcher.preprocess([["src", "**", "**", "file.ts"]])
   * console.log(JSON.stringify(parts[0])) // ["src","**","file.ts"]
   * ```
   *
   * @category normalization
   * @since 0.0.0
   */
  preprocess(globPartsInput: Array<Array<string>>) {
    if (this.options.noglobstar === true) demoteGlobstars(globPartsInput);
    return this.#optimizeGlobParts(globPartsInput);
  }

  #optimizeGlobParts(globParts: Array<Array<string>>): Array<Array<string>> {
    const { optimizationLevel = 1 } = this.options;
    if (optimizationLevel >= 2) {
      return this.secondPhasePreProcess(this.firstPhasePreProcess(globParts));
    }
    if (optimizationLevel >= 1) {
      return this.levelOneOptimize(globParts);
    }
    return this.adjascentGlobstarOptimize(globParts);
  }

  /**
   * Collapses consecutive globstar segments in each pattern alternative.
   *
   * **Details**
   *
   * Segment arrays are edited in place. The method name preserves the upstream spelling.
   *
   * **Example** (Collapse repeated globstars)
   *
   * ```ts
   * import { Minimatch } from "@beep/glob/internal/minimatch"
   *
   * const matcher = new Minimatch("*")
   * const parts = matcher.adjascentGlobstarOptimize([["**", "**", "file.ts"]])
   * console.log(JSON.stringify(parts[0])) // ["**","file.ts"]
   * ```
   *
   * @category normalization
   * @since 0.0.0
   */
  adjascentGlobstarOptimize(globParts: Array<Array<string>>) {
    return A.map(globParts, (parts) => {
      let gs = parts.indexOf("**");
      while (gs !== -1) {
        let i = gs;
        while (parts[i + 1] === "**") {
          i++;
        }
        if (i !== gs) {
          parts.splice(gs, i - gs);
        }
        gs = parts.indexOf("**", gs + 1);
      }
      return parts;
    });
  }

  /**
   * Collapses adjacent globstars and resolves reducible parent-directory segments.
   *
   * **Example** (Resolve a parent segment)
   *
   * ```ts
   * import { Minimatch } from "@beep/glob/internal/minimatch"
   *
   * const matcher = new Minimatch("*")
   * const parts = matcher.levelOneOptimize([["src", "internal", "..", "file.ts"]])
   * console.log(parts[0]?.join("/")) // src/file.ts
   * ```
   *
   * @category normalization
   * @since 0.0.0
   */
  levelOneOptimize(globParts: Array<Array<string>>) {
    return A.map(globParts, (partsInput) => {
      const parts = A.reduce(partsInput, [] as Array<string>, (set: Array<string>, part) => {
        const prev = set[set.length - 1];
        if (part === "**" && prev === "**") {
          return set;
        }
        if (part === "..") {
          if (prev !== undefined && prev !== "" && prev !== ".." && prev !== "." && prev !== "**") {
            set.pop();
            return set;
          }
        }
        set.push(part);
        return set;
      });
      return parts.length === 0 ? [""] : parts;
    });
  }

  /**
   * Normalizes candidate path segments for level-two matching.
   *
   * **Details**
   *
   * Array inputs are mutated. UNC roots and Windows drive roots are preserved;
   * `preserveMultipleSlashes` disables removal of interior empty and dot segments.
   *
   * **Example** (Normalize a candidate path)
   *
   * ```ts
   * import { Minimatch } from "@beep/glob/internal/minimatch"
   *
   * const matcher = new Minimatch("*")
   * console.log(matcher.levelTwoFileOptimize("src/./internal/../file.ts").join("/")) // src/file.ts
   * ```
   *
   * @category normalization
   * @since 0.0.0
   */
  levelTwoFileOptimize(partsInput: string | Array<string>) {
    const parts = A.isArray(partsInput) ? partsInput : this.slashSplit(partsInput);
    let didSomething = false;

    do {
      didSomething = false;
      if (!this.preserveMultipleSlashes && squeezeEmptyAndDotParts(parts)) didSomething = true;

      const collapsed = collapseParentSegments(parts, (dd, p) => {
        if (this.isWindows && /^[a-z]:$/i.test(p)) return false;
        parts.splice(dd - 1, 2);
        return true;
      });
      if (collapsed) didSomething = true;
    } while (didSomething);
    return parts.length === 0 ? [""] : parts;
  }

  /**
   * Simplifies individual pattern alternatives for aggressive filesystem-walk optimization.
   *
   * **Details**
   *
   * This pass mutates its input and can append alternatives while reducing globstar-parent combinations.
   *
   * **Example** (Simplify an individual pattern)
   *
   * ```ts
   * import { Minimatch } from "@beep/glob/internal/minimatch"
   *
   * const matcher = new Minimatch("*")
   * const parts = matcher.firstPhasePreProcess([["src", ".", "file.ts"]])
   * console.log(parts[0]?.join("/")) // src/file.ts
   * ```
   *
   * @category normalization
   * @since 0.0.0
   */
  firstPhasePreProcess(globParts: Array<Array<string>>) {
    const max = assertCap("braceExpandMax", this.options.braceExpandMax ?? EXPANSION_MAX);
    if (globParts.length > max) {
      throw GuardExceeded.fromReason("ExpansionBudgetExceeded", max, globParts.length);
    }
    let didSomething = false;
    do {
      didSomething = false;
      for (const parts of globParts) {
        if (this.#firstPhasePassOverOneAlternativeChanged(parts, globParts, max)) didSomething = true;
      }
    } while (didSomething);

    return globParts;
  }

  #firstPhasePassOverOneAlternativeChanged(
    parts: Array<string>,
    globParts: Array<Array<string>>,
    max: number
  ): boolean {
    let didSomething = splitGlobstarParents(parts, globParts, max);

    if (!this.preserveMultipleSlashes && squeezeEmptyAndDotParts(parts)) didSomething = true;

    if (collapseParentSegments(parts, (dd) => collapseFirstPhaseParent(parts, dd))) didSomething = true;
    return didSomething;
  }

  /**
   * Merges redundant pattern alternatives after individual-pattern simplification.
   *
   * **Details**
   *
   * Up to 1,000 input alternatives are edited before the retained alternatives
   * are returned. Larger sets skip pairwise deduplication and retain every
   * alternative, preserving the same matching language.
   *
   * **Example** (Deduplicate pattern alternatives)
   *
   * ```ts
   * import { Minimatch } from "@beep/glob/internal/minimatch"
   *
   * const matcher = new Minimatch("*")
   * const parts = matcher.secondPhasePreProcess([["src", "file.ts"], ["src", "file.ts"]])
   * console.log(parts.length) // 1
   * ```
   *
   * @category normalization
   * @since 0.0.0
   */
  secondPhasePreProcess(globParts: Array<Array<string>>): Array<Array<string>> {
    if (globParts.length > PAIRWISE_DEDUPE_CEILING_AVOIDING_QUADRATIC_WORK) return globParts;
    for (let i = 0; i < globParts.length - 1; i++) this.#mergeIntoFirstLaterMatch(globParts, i);
    return A.filter(globParts, isNonEmptyAlternativeDroppingSparseHolesNativeFilterSkipped);
  }

  #mergeIntoFirstLaterMatch(globParts: Array<Array<string>>, i: number): void {
    for (let j = i + 1; j < globParts.length; j++) {
      const a = globParts[i];
      const b = globParts[j];
      if (a === undefined || b === undefined) continue;
      const matched = this.partsMatch(a, b, !this.preserveMultipleSlashes);
      if (matched !== false) {
        globParts[i] = [];
        globParts[j] = matched;
        return;
      }
    }
  }

  /**
   * Finds a shared pattern that covers two compatible segment arrays.
   *
   * **Details**
   *
   * Incompatible alternatives return `false`. Empty globstar matches are considered only
   * when `emptyGSMatch` is enabled, and the final alternatives must have equal lengths.
   *
   * **Example** (Cover a literal with a wildcard pattern)
   *
   * ```ts
   * import { Minimatch } from "@beep/glob/internal/minimatch"
   *
   * const matcher = new Minimatch("*")
   * const parts = matcher.partsMatch(["src", "*"], ["src", "file.ts"])
   * console.log(parts === false ? "incompatible" : parts.join("/")) // src/*
   * ```
   *
   * @category normalization
   * @since 0.0.0
   */
  partsMatch(a: Array<string>, b: Array<string>, emptyGSMatch = false): false | Array<string> {
    const merge: PartsMatchMergeCursor = { ai: 0, bi: 0, sideAStarAlreadyCovered: "", result: [] };
    while (merge.ai < a.length && merge.bi < b.length) {
      if (!this.#partsMatchStep(merge, a, b, emptyGSMatch)) return false;
    }
    const identicalOnceLoopEndsIfLengthsMatch = a.length === b.length;
    return identicalOnceLoopEndsIfLengthsMatch && merge.result;
  }

  #partsMatchStep(merge: PartsMatchMergeCursor, a: Array<string>, b: Array<string>, emptyGSMatch: boolean): boolean {
    const av = a[merge.ai];
    const bv = b[merge.bi];
    if (av === undefined || bv === undefined) return false;
    if (av === bv) return claimEqual(merge, av, bv);
    if (emptyGSMatch && skipEmptyGlobstar(merge, a, b, av, bv)) return true;
    if (this.#starCovers(av, bv)) return claimStar(merge, "a", av);
    if (this.#starCovers(bv, av)) return claimStar(merge, "b", bv);
    return false;
  }

  #starCovers(star: string, other: string): boolean {
    return star === "*" && other !== "" && (this.options.dot === true || !Str.startsWith(".")(other)) && other !== "**";
  }

  /**
   * Consumes leading negation markers and records their parity.
   *
   * **Details**
   *
   * With `nonegate`, the pattern is left untouched. Otherwise the consumed markers
   * are removed from `pattern`; each marker toggles the negation flag.
   *
   * **Example** (Parse a replacement negated pattern)
   *
   * ```ts
   * import { Minimatch } from "@beep/glob/internal/minimatch"
   *
   * const matcher = new Minimatch("file.ts")
   * matcher.pattern = "!file.js"
   * matcher.parseNegate()
   * console.log(matcher.negate) // true
   * ```
   *
   * @category parsing
   * @since 0.0.0
   */
  parseNegate() {
    if (this.nonegate) return;

    const pattern = this.pattern;
    let negate = false;
    let negateOffset = 0;

    for (let i = 0; i < pattern.length && pattern[i] === "!"; i++) {
      negate = !negate;
      negateOffset++;
    }

    if (negateOffset !== 0) this.pattern = Str.slice(negateOffset)(pattern);
    this.negate = negate;
  }

  /**
   * Matches candidate path segments against one compiled pattern alternative.
   *
   * **Details**
   *
   * Partial matching accepts an exhausted candidate when all its segments matched,
   * even if the pattern still has segments remaining.
   *
   * **Example** (Match literal path segments)
   *
   * ```ts
   * import { Minimatch } from "@beep/glob/internal/minimatch"
   *
   * const matcher = new Minimatch("src/file.ts")
   * console.log(matcher.matchOne(["src", "file.ts"], ["src", "file.ts"])) // true
   * ```
   *
   * @category predicates
   * @since 0.0.0
   */
  matchOne(fileInput: Array<string>, pattern: Array<ParseReturn>, partial = false) {
    const [fileStartIndex, patternStartIndex] = this.isWindows
      ? startAtSharedDriveLetterCaseInsensitivelyAdoptingFileSpelling(fileInput, pattern)
      : [0, 0];

    const { optimizationLevel = 1 } = this.options;
    const file = optimizationLevel >= 2 ? this.levelTwoFileOptimize(fileInput) : fileInput;

    if (pattern.includes(GLOBSTAR)) {
      return this.#matchGlobstar(file, pattern, partial, fileStartIndex, patternStartIndex);
    }

    return this.#matchOne(file, pattern, partial, fileStartIndex, patternStartIndex);
  }

  /**
   * Matches globstar-delimited head, body, and tail sections against candidate segments.
   *
   * **Example** (Match a globstar between literal segments)
   *
   * ```ts
   * import { Minimatch } from "@beep/glob/internal/minimatch"
   *
   * const matcher = new Minimatch(["src", "**", "file.ts"].join("/"))
   * console.log(matcher.match("src/internal/file.ts")) // true
   * ```
   *
   * @category predicates
   * @since 0.0.0
   */
  #matchGlobstar(
    file: Array<string>,
    pattern: Array<ParseReturn>,
    partial: boolean,
    fileIndexInput: number,
    patternIndex: number
  ) {
    const { head, body, tail } = globstarSections(pattern, patternIndex, partial);

    if (
      head.length !== 0 &&
      !this.#matchOne(file.slice(fileIndexInput, fileIndexInput + head.length), head, partial, 0, 0)
    ) {
      return false;
    }
    const fileIndex = fileIndexInput + head.length;

    const fileTailMatch = this.#fileSegmentsANonEmptyTailConsumesAtFileEnd(file, tail, partial, fileIndex);
    if (fileTailMatch === undefined) return false;

    const sawTail = fileTailMatch !== 0 && !Number.isNaN(fileTailMatch);
    if (body.length === 0) {
      return this.#emptyBodyHasNoBadDotsAndSomethingAfterHeadUnlessTailed(
        file,
        fileIndex,
        fileTailMatch,
        partial,
        sawTail
      );
    }

    const search: BodySectionSearch = {
      file,
      bodySegments: globstarBodySegments(body, file.length - fileTailMatch),
      partial,
      sawTail,
    };
    return this.#matchGlobStarBodySections(search, fileIndex, 0, 0) === true;
  }

  #fileSegmentsANonEmptyTailConsumesAtFileEnd(
    file: Array<string>,
    tail: Array<ParseReturn>,
    partial: boolean,
    fileIndex: number
  ): number | undefined {
    if (tail.length === 0) return 0;
    const headPlusTailOverrunFile = tail.length + fileIndex > file.length;
    if (headPlusTailOverrunFile) return undefined;

    const tailStart = file.length - tail.length;
    if (this.#matchOne(file, tail, partial, tailStart, 0)) return tail.length;
    const retryWithoutTrailingEmptySegmentSoABSlashMatchesAGlobstarStar =
      file[file.length - 1] === "" && fileIndex + tail.length !== file.length;
    if (!retryWithoutTrailingEmptySegmentSoABSlashMatchesAGlobstarStar) return undefined;
    return this.#matchOne(file, tail, partial, tailStart - 1, 0) ? tail.length + 1 : undefined;
  }

  #emptyBodyHasNoBadDotsAndSomethingAfterHeadUnlessTailed(
    file: Array<string>,
    fileIndex: number,
    fileTailMatch: number,
    partial: boolean,
    sawTail: boolean
  ): boolean {
    let sawSome = sawTail;
    for (let i = fileIndex; i < file.length - fileTailMatch; i++) {
      sawSome = true;
      if (this.#isSegmentAGlobstarNeverCrosses(String(file[i]))) return false;
    }
    return partial || sawSome;
  }

  #isSegmentAGlobstarNeverCrosses(f: string): boolean {
    return f === "." || f === ".." || (this.options.dot !== true && Str.startsWith(".")(f));
  }

  /**
   * Searches ordered globstar body sections within their remaining candidate bounds.
   *
   * **Example** (Match multiple globstar body sections)
   *
   * ```ts
   * import { Minimatch } from "@beep/glob/internal/minimatch"
   *
   * const matcher = new Minimatch(["src", "**", "lib", "**", "file.ts"].join("/"))
   * console.log(matcher.match("src/internal/lib/nested/file.ts")) // true
   * ```
   *
   * @category predicates
   * @since 0.0.0
   */
  #matchGlobStarBodySections(
    search: BodySectionSearch,
    fileIndexInput: number,
    bodyIndex: number,
    globStarDepth: number
  ): MatchedOrFalseToKeepWalkingOrNullToGiveUp {
    const bs = search.bodySegments[bodyIndex];
    if (bs === undefined) return this.#trailingSegmentsClean(search, fileIndexInput);

    const [body, lastPossibleFileIndex] = bs;
    for (let fileIndex = fileIndexInput; fileIndex <= lastPossibleFileIndex; fileIndex++) {
      const sub = this.#matchBodySectionAt(search, body, fileIndex, bodyIndex, globStarDepth);
      if (sub !== false) return sub;
      const f = search.file[fileIndex];
      if (f !== undefined && this.#isSegmentAGlobstarNeverCrosses(f)) return false;
    }
    return search.partial || null;
  }

  #trailingSegmentsClean(search: BodySectionSearch, fileIndex: number): boolean {
    let sawTail = search.sawTail;
    for (let i = fileIndex; i < search.file.length; i++) {
      sawTail = true;
      const f = search.file[i];
      if (f === undefined || this.#isSegmentAGlobstarNeverCrosses(f)) return false;
    }
    return sawTail;
  }

  #matchBodySectionAt(
    search: BodySectionSearch,
    body: Array<ParseReturn>,
    fileIndex: number,
    bodyIndex: number,
    globStarDepth: number
  ): MatchedOrFalseToKeepWalkingOrNullToGiveUp {
    const m = this.#matchOne(search.file.slice(0, fileIndex + body.length), body, search.partial, fileIndex, 0);
    const recursionCapHitIsAnIntentionalFalseNegativeForSecurity = globStarDepth >= this.maxGlobstarRecursion;
    if (!m || recursionCapHitIsAnIntentionalFalseNegativeForSecurity) return false;
    return this.#matchGlobStarBodySections(search, fileIndex + body.length, bodyIndex + 1, globStarDepth + 1);
  }

  /**
   * Compares non-globstar segments from the supplied file and pattern offsets.
   *
   * **Example** (Match a literal segment sequence)
   *
   * ```ts
   * import { Minimatch } from "@beep/glob/internal/minimatch"
   *
   * const matcher = new Minimatch(["src", "file.ts"].join("/"))
   * console.log(matcher.match("src/file.ts")) // true
   * ```
   *
   * @category predicates
   * @since 0.0.0
   */
  #matchOne(
    file: Array<string>,
    pattern: Array<ParseReturn>,
    partial: boolean,
    fileIndex: number,
    patternIndex: number
  ) {
    const fl = file.length;
    const pl = pattern.length;
    let fi = fileIndex;
    let pi = patternIndex;
    for (; fi < fl && pi < pl; fi++, pi++) {
      this.debug("matchOne loop");
      if (!this.#segmentHit(pattern, pattern[pi], file[fi])) return false;
    }
    return matchOneRemainder(file, fi, pi, partial, pl);
  }

  #segmentHit(pattern: Array<ParseReturn>, p: ParseReturn | undefined, f: string | undefined): boolean {
    if (p === undefined || f === undefined) return false;

    this.debug(pattern, p, f);

    const unreachableSinceMakeFiltersFalseAndGlobstarsSplitFirst = p === false || p === GLOBSTAR;
    if (unreachableSinceMakeFiltersFalseAndGlobstarsSplitFirst) {
      return false;
    }

    if (P.isString(p)) {
      const hit = f === p;
      this.debug("string match", p, f, hit);
      return hit;
    }
    const hit = p._matchSegment !== undefined ? p._matchSegment(f) : p.test(f);
    this.debug("pattern match", p, f, hit);
    return hit;
  }

  /**
   * Expands brace alternatives using this matcher’s current pattern and options.
   *
   * **Example** (Expand the matcher pattern)
   *
   * ```ts
   * import { Minimatch } from "@beep/glob/internal/minimatch"
   *
   * const matcher = new Minimatch("file.{ts,js}")
   * console.log(matcher.braceExpand().join(",")) // file.ts,file.js
   * ```
   *
   * @category parsing
   * @since 0.0.0
   */
  braceExpand() {
    return braceExpand(this.pattern, this.options);
  }

  /**
   * Compiles one path segment into a literal, regular expression, or globstar marker.
   *
   * **Details**
   *
   * Common star and question-mark patterns receive optimized test functions.
   * An invalid compiled segment can return `false`.
   *
   * **Example** (Identify a globstar segment)
   *
   * ```ts
   * import { GLOBSTAR, Minimatch } from "@beep/glob/internal/minimatch"
   *
   * const matcher = new Minimatch("*")
   * console.log(matcher.parse("**") === GLOBSTAR) // true
   * ```
   *
   * @category parsing
   * @since 0.0.0
   */
  parse(pattern: string): ParseReturn {
    assertValidPattern(pattern);

    const options = this.options;

    if (pattern === "**") return GLOBSTAR;
    if (pattern === "") return "";

    const fastTest = fastTestForMostCommonPartShapesFirstMatchWins(pattern, options);

    const re = AST.fromGlob(pattern, this.options).toMMPattern();
    if (fastTest !== null && P.isObjectKeyword(re) && !P.isFunction(re)) {
      defineOwnTestSinceAssigningOverAFrozenPrototypeThrows(re, fastTest);
    }
    return re;
  }

  /**
   * Builds and caches a regular expression for the compiled alternatives.
   *
   * **Details**
   *
   * Prefer `match` for path matching; this method is convenient when a regular
   * expression is needed. It returns `false` when there are no compiled alternatives
   * or regular-expression construction fails.
   *
   * **Example** (Test a compiled regular expression)
   *
   * ```ts
   * import { Minimatch } from "@beep/glob/internal/minimatch"
   *
   * const matcher = new Minimatch("*.ts")
   * const regexp = matcher.makeRe()
   * console.log(regexp === false ? false : regexp.test("file.ts")) // true
   * ```
   *
   * @category parsing
   * @since 0.0.0
   */
  makeRe() {
    if (this.regexp !== null) return this.regexp;

    const set = this.set;

    if (set.length === 0) {
      this.regexp = false;
      return this.regexp;
    }
    const options = this.options;

    const twoStar =
      options.noglobstar === true
        ? star
        : options.dot === true
          ? twoStarAnySegmentsButDotOrDotDot
          : twoStarNoSegmentStartingWithDot;
    const flags = MutableHashSet.fromIterable(options.nocase === true ? ["i"] : []);

    let re = pipe(
      set,
      A.map((pattern) => this.#alternativeSource(pattern, flags, twoStar)),
      A.join("|")
    );

    re = this.#anchorWholePath(re, set.length > 1);

    this.regexp = Result.getOrElse(
      Result.try(() => new RegExp(re, A.join(flags, ""))),
      regExpCompileFailureShouldBeImpossible
    );
    return this.regexp;
  }

  #alternativeSource(
    pattern: Array<ParseReturnFiltered>,
    flags: MutableHashSet.MutableHashSet<string>,
    twoStar: string
  ): string {
    const pp: Array<string | typeof GLOBSTAR | undefined> = A.map(pattern, (p) =>
      regExpSourceOfPartCollectingFlags(p, flags)
    );
    A.forEach(pp, (p, i) => rewriteGlobstarAt(pp, p, i, twoStar));
    const filtered = pipe(
      pp,
      A.filter((p, i): p is string | undefined => p !== GLOBSTAR && presentLikeNativeFilterSkippingSparseHoles(pp, i)),
      A.map(undefinedAsEmptyLikeNativeJoin)
    );

    if (this.partial && filtered.length >= 1) return progressivelyLongerPrefixAlternativesForPartialMatch(filtered);

    return A.join(filtered, "/");
  }

  #anchorWholePath(source: string, alternationNeedsGroupSoAnchorsSpanEveryBranch: boolean): string {
    const [open, close] = alternationNeedsGroupSoAnchorsSpanEveryBranch ? ["(?:", ")"] : ["", ""];
    let re = `^${open}${source}${close}$`;

    if (this.partial) {
      re = `^(?:${ROOT_SLASH_IS_A_PARTIAL_PREFIX_OF_EVERY_PATTERN}|${open}${Str.slice(1, -1)(re)}${close})$`;
    }

    return this.negate ? `^(?!${re}).+$` : re;
  }

  /**
   * Splits a path into segments while respecting slash-preservation and Windows roots.
   *
   * **Details**
   *
   * Windows UNC paths keep their leading double slash. Other repeated slashes are
   * coalesced unless `preserveMultipleSlashes` is enabled.
   *
   * **Example** (Coalesce repeated path separators)
   *
   * ```ts
   * import { Minimatch } from "@beep/glob/internal/minimatch"
   *
   * const matcher = new Minimatch("*")
   * console.log(matcher.slashSplit("src//file.ts").join("/")) // src/file.ts
   * ```
   *
   * @category parsing
   * @since 0.0.0
   */
  slashSplit(p: string) {
    if (this.preserveMultipleSlashes) {
      return Str.split("/")(p);
    }
    const windowsUncLeadKeepsItsDoubleSlash = this.isWindows && /^\/\/[^/]+/.test(p);
    if (windowsUncLeadKeepsItsDoubleSlash) {
      const emptySegmentTheCoalescingSplitLoses = "";
      return [emptySegmentTheCoalescingSplitLoses, ...Str.split(/\/+/)(p)];
    }
    return Str.split(/\/+/)(p);
  }

  /**
   * Tests a candidate path against the compiled alternatives and negation options.
   *
   * **Details**
   *
   * Comment patterns reject candidates; empty patterns match only an empty candidate.
   * Windows candidates normalize backslashes. With `matchBase`, a single-segment
   * pattern is tested against the candidate basename; partial matching permits prefixes.
   *
   * **Example** (Match a TypeScript file)
   *
   * ```ts
   * import { Minimatch } from "@beep/glob/internal/minimatch"
   *
   * const matcher = new Minimatch("*.ts")
   * console.log(matcher.match("file.ts")) // true
   * console.log(matcher.match("file.js")) // false
   * ```
   *
   * @category predicates
   * @since 0.0.0
   */
  match(fInput: string, partial = this.partial) {
    this.debug("match", fInput, this.pattern);
    const trivial = this.#trivialMatch(fInput, partial);
    if (trivial !== undefined) return trivial;

    const options = this.options;

    const forwardSlashedSinceSegmentsSplitOnSlashOnly = this.isWindows ? A.join(Str.split("\\")(fInput), "/") : fInput;

    const ff = this.slashSplit(forwardSlashedSinceSegmentsSplitOnSlashOnly);
    this.debug(this.pattern, "split", ff);

    const set = this.set;
    this.debug(this.pattern, "set", set);

    if (this.#anyAlternativeMatches(ff, partial)) return options.flipNegate === true || !this.negate;

    return options.flipNegate !== true && this.negate;
  }

  #anyAlternativeMatches(ff: Array<string>, partial: boolean): boolean {
    const filename = lastNonEmptySegment(ff);
    for (const pattern of this.set) {
      const file = this.options.matchBase === true && pattern.length === 1 ? [filename] : ff;
      if (this.matchOne(file, pattern, partial)) return true;
    }
    return false;
  }

  #trivialMatch(fInput: string, partial: boolean): boolean | undefined {
    if (this.comment) return false;
    if (this.empty) return fInput === "";
    if (fInput === "/" && partial) return true;
    return undefined;
  }
}
