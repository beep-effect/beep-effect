/**
 * Scans source text for `process` reads, forbidden imports, stdout writes and console use.
 *
 * **Details**
 *
 * One lexer pass separates code from comments, strings, template text and
 * regex bodies, so prose and embedded scripts never count. `check` reports
 * one file's offences, `scan` walks a tree with per-file and per-rule
 * waivers, and `verifyFixtures` proves the scanner still flags and spares
 * what its shipped controls say. Part of the `./testing` subpath.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { GlobSet } from "@beep/glob";
import { $RepoWorkspacesId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  codePointAt,
  codePointBefore,
  cookIdentifier,
  identifierAt,
  identifierTokens,
  isIdentifierChar,
  lex,
  locate,
  references,
  skipSpaceBack,
  skipSpaceForward,
  specifierLiterals,
  unitAt,
} from "./internal/sourceText.ts";
import type { SourceLiteral } from "./internal/sourceText.ts";

const $I = $RepoWorkspacesId.create("SourceBoundary");

/**
 * The rules that need no configuration: the global `process` and `console`
 * references, `node:process` imports and stdout writes (see {@link BoundaryRule}).
 *
 * **Example** (Recognize a global rule name)
 *
 * ```ts
 * import { GlobalRule } from "@beep/repo-workspaces/SourceBoundary";
 *
 * console.log(GlobalRule.is["stdout-write"]("stdout-write")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const GlobalRule = LiteralKit(["process", "node:process", "stdout-write", "console", "console-stdout"]).pipe(
  $I.annoteSchema("GlobalRule", { description: "A boundary rule that needs no configuration." })
);
/**
 * Decoded representation accepted by {@link GlobalRule}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GlobalRule = typeof GlobalRule.Type;

/**
 * Forbids imports whose specifier equals an entry, is a subpath of one, or
 * starts with an entry's text before a trailing `*` (see {@link BoundaryRule}).
 *
 * **Example** (Forbid the platform packages)
 *
 * ```ts
 * import { ForbidImportsRule } from "@beep/repo-workspaces/SourceBoundary";
 *
 * const rule = ForbidImportsRule.make({ forbidImports: ["@effect/platform*"] });
 * console.log(rule.forbidImports.length) // 1
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class ForbidImportsRule extends S.Opaque<ForbidImportsRule, { readonly brand: unique symbol }>()(
  S.Struct({
    forbidImports: S.Array(S.String).pipe(
      $I.annoteKey("BoundaryRule.forbidImports", { description: "Forbidden module names or prefixes." })
    ),
  }).pipe($I.annoteSchema("ForbidImportsRule", { description: "A rule forbidding module specifiers." }))
) {}

/**
 * Companion types for {@link ForbidImportsRule}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ForbidImportsRule {
  /**
   * The plain, unbranded encoded shape of a {@link ForbidImportsRule}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ForbidImportsRule.Encoded;
}

/**
 * Forbids each entry's exact text wherever it appears in code (see
 * {@link SourceBoundary.check} for how a token is matched).
 *
 * **Example** (Forbid the build-time version token)
 *
 * ```ts
 * import { ForbidTokensRule } from "@beep/repo-workspaces/SourceBoundary";
 *
 * const rule = ForbidTokensRule.make({ forbidTokens: ["process.env.__PACKAGE_VERSION__"] });
 * console.log(rule.forbidTokens[0]) // process.env.__PACKAGE_VERSION__
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class ForbidTokensRule extends S.Opaque<ForbidTokensRule, { readonly brand: unique symbol }>()(
  S.Struct({
    forbidTokens: S.Array(S.String).pipe(
      $I.annoteKey("BoundaryRule.forbidTokens", { description: "Exact forbidden code tokens." })
    ),
  }).pipe($I.annoteSchema("ForbidTokensRule", { description: "A rule forbidding exact code tokens." }))
) {}

/**
 * Companion types for {@link ForbidTokensRule}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ForbidTokensRule {
  /**
   * The plain, unbranded encoded shape of a {@link ForbidTokensRule}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ForbidTokensRule.Encoded;
}

/**
 * One rule a source file must keep.
 *
 * **Details**
 *
 * `"process"` forbids a read of the global `process`. `"node:process"` forbids
 * importing `node:process` or `process`. `"stdout-write"` forbids a
 * `stdout.write` on anything, and a `stdout.end(chunk)`, which writes its
 * chunk before closing; an `end()` with no chunk is spared. It matches the
 * name `stdout`, so a renamed receiver (`const { stdout: o } = process`) is
 * not seen: the `"process"` rule is what backstops it, so waiving `"process"`
 * for a file waives that backstop too. `"console"` forbids any reference to the
 * global `console`. `"console-stdout"` forbids a reference to the global
 * `console` except a member access to one of the methods Node's console
 * writes to stderr: `error`, `warn`, `trace` and `assert`. A bare or aliased
 * reference (`const c = console`, `f(console)`, `console[m]`) is still
 * flagged, since it can reach the stdout methods. Neither console rule flags
 * core's `Console` service. `{ forbidImports }` forbids an import whose specifier
 * equals an entry, is a subpath of one, or starts with an entry's text before a
 * trailing `*` (so `"node:*"` and `"@effect/platform*"` are prefixes).
 * `{ forbidTokens }` forbids each entry's exact text wherever it appears in
 * code (see {@link SourceBoundary.check} for how a token is matched).
 *
 * To confine a token to named files rather than forbid it everywhere, forbid
 * it and waive the rule for those files through
 * {@link ScanOptions.allowRules}: the `"forbidTokens"` key names the files, and
 * `SourceScan.waived` then reports every use inside them, so a
 * confinement that no longer matches anything shows up there. The house rule
 * "`process.env.__PACKAGE_VERSION__` only in `version.ts`" is
 * `rules: [{ forbidTokens: ["process.env.__PACKAGE_VERSION__"] }]` with
 * `allowRules: { forbidTokens: ["version.ts"] }`.
 *
 * `"node:*"` matches only the `node:` spelling: a bare built-in such as `"fs"`
 * is not caught. To forbid both, spread Node's own list from the test file,
 * `{ forbidImports: ["node:*", ...builtinModules] }` with `builtinModules`
 * from `node:module`. That also forbids npm packages that share a built-in's
 * name (`events`, `buffer`, `punycode`). No built-in list ships here: it
 * would drift with Node releases.
 *
 * **Example** (Validate a global boundary rule)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { BoundaryRule } from "@beep/repo-workspaces/SourceBoundary";
 *
 * console.log(S.is(BoundaryRule)("process")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const BoundaryRule = S.Union([GlobalRule, ForbidImportsRule, ForbidTokensRule]).pipe(
  $I.annoteSchema("BoundaryRule", { description: "One rule a source file must keep." })
);
/**
 * Decoded representation accepted by {@link BoundaryRule}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type BoundaryRule = typeof BoundaryRule.Type;

/**
 * Companion types for {@link BoundaryRule}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace BoundaryRule {
  /**
   * The plain encoded rule: a global rule name, or an unbranded `{ forbidImports }` or `{ forbidTokens }` record.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof BoundaryRule.Encoded;
}

/**
 * Controls which exact tokens are exempt from the `process` rule.
 *
 * **Example** (Keep process exemptions optional)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { ReferenceOptions } from "@beep/repo-workspaces/SourceBoundary";
 *
 * console.log(S.is(ReferenceOptions)({ ignoreTokens: [] })) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class ReferenceOptions extends S.Opaque<ReferenceOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * Exact tokens exempt from the `process` rule, each starting at the
     * reference (`"process.env.MY_CONSTANT"`). `process.env.__PACKAGE_VERSION__`
     * is always exempt: the bundler substitutes it at build time. To hold such a
     * token to named files, forbid it with a `{ forbidTokens }` rule as well (see
     * {@link BoundaryRule}).
     */
    ignoreTokens: S.String.pipe(
      S.Array,
      S.optionalKey,
      $I.annoteKey("ReferenceOptions.ignoreTokens", {
        description: "Exact process-reference tokens to exempt, in addition to the build-time version token.",
      })
    ),
  }).pipe(
    $I.annoteSchema("ReferenceOptions", {
      description: "Optional exact-token exemptions for the process rule, resolved only when checking references.",
    })
  )
) {}

/**
 * Companion types for {@link ReferenceOptions}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ReferenceOptions {
  /**
   * The plain, unbranded encoded shape of a {@link ReferenceOptions}, which the checks take.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ReferenceOptions.Encoded;
}

/**
 * A snippet with the verdict one rule must reach on it.
 *
 * **Example** (Validate a scanner control snippet)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { BoundaryFixture } from "@beep/repo-workspaces/SourceBoundary";
 *
 * console.log(S.is(BoundaryFixture)({ name: "read", source: "process.cwd()", rule: "process", flagged: true })) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class BoundaryFixture extends S.Opaque<BoundaryFixture, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String.pipe($I.annoteKey("BoundaryFixture.name", { description: "What the snippet exercises." })),
    source: S.String.pipe($I.annoteKey("BoundaryFixture.source", { description: "The source text." })),
    rule: BoundaryRule.pipe($I.annoteKey("BoundaryFixture.rule", { description: "The rule it is checked against." })),
    flagged: S.Boolean.pipe(
      $I.annoteKey("BoundaryFixture.flagged", { description: "Whether that rule must flag it." })
    ),
  }).pipe($I.annoteSchema("BoundaryFixture", { description: "A snippet with the verdict one rule must reach on it." }))
) {}

/**
 * Companion types for {@link BoundaryFixture}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace BoundaryFixture {
  /**
   * The plain, unbranded encoded shape of a {@link BoundaryFixture}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof BoundaryFixture.Encoded;
}

/**
 * The rule an {@link Offence} names: every string {@link BoundaryRule}, plus
 * `"forbidImports"` for any `{ forbidImports }` rule and `"forbidTokens"` for
 * any `{ forbidTokens }` rule. These are the keys of
 * {@link ScanOptions.allowRules}.
 *
 * **Example** (Validate a token offence key)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { OffenceRule } from "@beep/repo-workspaces/SourceBoundary";
 *
 * console.log(S.is(OffenceRule)("forbidTokens")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const OffenceRule = LiteralKit([
  "process",
  "node:process",
  "stdout-write",
  "console",
  "console-stdout",
  "forbidImports",
  "forbidTokens",
]).pipe(
  $I.annoteSchema("OffenceRule", { description: "The rule an offence names, including import and token rules." })
);
/**
 * Decoded representation accepted by {@link OffenceRule}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type OffenceRule = typeof OffenceRule.Type;

/**
 * One place a source file breaks a {@link BoundaryRule}.
 *
 * **Example** (Format a boundary offence)
 *
 * ```ts
 * import { Offence } from "@beep/repo-workspaces/SourceBoundary";
 *
 * const offence = Offence.make({ file: "a.ts", line: 1, column: 1, rule: "process", detail: "process" });
 * console.log(offence.label) // a.ts:1:1 process process
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class Offence extends S.Class<Offence, { readonly brand: unique symbol }>($I`Offence`)(
  {
    /** The file, relative to the scanned root, with `/` separators. */
    file: S.String.pipe(
      $I.annoteKey("Offence.file", { description: "The file, relative to the scanned root, with `/` separators." })
    ),
    /** The 1-based line. */
    line: S.Finite.pipe($I.annoteKey("Offence.line", { description: "The 1-based line." })),
    /** The 1-based column, in UTF-16 code units. */
    column: S.Finite.pipe($I.annoteKey("Offence.column", { description: "The 1-based column, in UTF-16 code units." })),
    /** The rule broken. */
    rule: OffenceRule.pipe($I.annoteKey("Offence.rule", { description: "The rule broken." })),
    /** What matched: the identifier, the call, the import specifier, or the token. */
    detail: S.String.pipe(
      $I.annoteKey("Offence.detail", {
        description: "What matched: the identifier, the call, the import specifier, or the token.",
      })
    ),
  },
  $I.annote("Offence", { description: "One place a source file breaks a BoundaryRule." })
) {
  /**
   * `file:line:column rule detail`, the form an assertion message reads best in.
   *
   * **Example** (Read an assertion label)
   *
   * ```ts
   * import { Offence } from "@beep/repo-workspaces/SourceBoundary";
   *
   * const offence = Offence.make({ file: "a.ts", line: 2, column: 3, rule: "console", detail: "console" });
   * console.log(offence.label) // a.ts:2:3 console console
   * ```
   *
   * @returns The offence as `file:line:column rule detail`.
   * @category getters
   * @since 0.0.0
   */
  get label(): string {
    return `${this.file}:${this.line}:${this.column} ${this.rule} ${this.detail}`;
  }
}

/**
 * What a scan read and found.
 *
 * **Example** (Inspect a clean scan)
 *
 * ```ts
 * import { SourceScan } from "@beep/repo-workspaces/SourceBoundary";
 *
 * const scan = SourceScan.make({ files: ["a.ts"], allowed: [], offences: [], waived: [] });
 * console.log(scan.violations.length) // 0
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class SourceScan extends S.Class<SourceScan, { readonly brand: unique symbol }>($I`SourceScan`)(
  {
    /** Every source file visited, relative to the root with `/` separators, sorted. Assert it is non-empty. */
    files: S.Array(S.String).pipe(
      $I.annoteKey("SourceScan.files", {
        description:
          "Every source file visited, relative to the root with `/` separators, sorted. Assert it is non-empty.",
      })
    ),
    /** The visited files an `allow` glob exempted from every rule. */
    allowed: S.Array(S.String).pipe(
      $I.annoteKey("SourceScan.allowed", { description: "The visited files an `allow` glob exempted from every rule." })
    ),
    /** Every offence, sorted by file, then line, then column. */
    offences: S.Array(Offence).pipe(
      $I.annoteKey("SourceScan.offences", { description: "Every offence, sorted by file, then line, then column." })
    ),
    /**
     * Every offence an `allowRules` glob waived, sorted like `offences`. Assert
     * it is exactly what you meant to waive: a waiver that no longer waives
     * anything, or waives more than intended, shows up here.
     */
    waived: S.Array(Offence).pipe(
      $I.annoteKey("SourceScan.waived", {
        description:
          "Every offence an `allowRules` glob waived, sorted like `offences`. Assert it is exactly what you meant to waive: a waiver that no longer waives anything, or waives more than intended, shows up here.",
      })
    ),
  },
  $I.annote("SourceScan", { description: "What a scan read and found." })
) {
  /**
   * One `file:line:column rule detail` label per offence: `[]` means clean.
   *
   * **Example** (Read formatted violations)
   *
   * ```ts
   * import { SourceScan, Offence } from "@beep/repo-workspaces/SourceBoundary";
   *
   * const offence = Offence.make({ file: "a.ts", line: 1, column: 1, rule: "process", detail: "process" });
   * const scan = SourceScan.make({ files: ["a.ts"], allowed: [], offences: [offence], waived: [] });
   * console.log(scan.violations.join("\n")) // a.ts:1:1 process process
   * ```
   *
   * @returns One label per offence, in offence order.
   * @category getters
   * @since 0.0.0
   */
  get violations(): ReadonlyArray<string> {
    return A.map(this.offences, (offence) => offence.label);
  }
}

/**
 * Configures source selection and rule waivers for {@link SourceBoundary.scan}.
 *
 * **Example** (Configure a plain-object scanner input)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { ScanOptions } from "@beep/repo-workspaces/SourceBoundary";
 *
 * console.log(S.is(ScanOptions)({ root: "/repo/src", rules: ["process"], allowRules: { process: ["generated/**"] } })) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class ScanOptions extends S.Opaque<ScanOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    ...ReferenceOptions.fields,
    /** The directory to scan. */
    root: S.String.pipe($I.annoteKey("ScanOptions.root", { description: "The directory to scan." })),
    /** The rules every non-allowed file must keep. */
    rules: S.Array(BoundaryRule).pipe(
      $I.annoteKey("ScanOptions.rules", {
        description: "The rules every non-allowed file must keep, in evaluation order.",
      })
    ),
    /** Globs, relative to `root` with `/` separators, naming files exempt from every rule. */
    allow: S.String.pipe(
      S.Array,
      S.optionalKey,
      $I.annoteKey("ScanOptions.allow", {
        description: "Root-relative globs exempting files from every rule; omitted means no exemptions.",
      })
    ),
    /**
     * Globs per rule, matched like `allow`, naming files exempt from that one
     * rule. A matching file is still checked against every other rule, and
     * each offence a glob waives is reported in `SourceScan.waived`
     * rather than dropped. The `"forbidImports"` key covers every
     * `{ forbidImports }` rule, and the `"forbidTokens"` key every
     * `{ forbidTokens }` rule, which is how a token is confined to named files.
     * A file `allow` matches is exempt from every rule, so nothing in it is
     * waived.
     */
    allowRules: S.Record(OffenceRule, S.String.pipe(S.Array, S.optionalKey)).pipe(
      S.optionalKey,
      $I.annoteKey("ScanOptions.allowRules", {
        description: "Optional per-rule root-relative waiver globs; an absent entry waives nothing.",
      })
    ),
    /**
     * File extensions to scan. Defaults to `.ts`, `.mts`, `.cts`, `.js`,
     * `.mjs` and `.cjs`; declaration files are always skipped.
     */
    extensions: S.String.pipe(
      S.Array,
      S.optionalKey,
      $I.annoteKey("ScanOptions.extensions", {
        description:
          "Source extensions to scan; omitted uses the scanner defaults and declaration files are always skipped.",
      })
    ),
  }).pipe(
    $I.annoteSchema("ScanOptions", {
      description: "Source selection, rules and waivers whose defaults are resolved lazily by the scan.",
    })
  )
) {}

/**
 * Companion types for {@link ScanOptions}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ScanOptions {
  /**
   * The plain, unbranded encoded shape of a {@link ScanOptions}, which {@link SourceBoundary.scan} takes.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ScanOptions.Encoded;
}

const DEFAULT_EXTENSIONS: ReadonlyArray<string> = [".ts", ".mts", ".cts", ".js", ".mjs", ".cjs"];
const DECLARATION = /\.d\.[cm]?ts$/;
const byCodeUnit = Str.Order;
const byPosition = Order.combine(
  Order.mapInput(Str.Order, (o: Offence) => o.file),
  Order.combine(
    Order.mapInput(Num.Order, (o: Offence) => o.line),
    Order.mapInput(Num.Order, (o: Offence) => o.column)
  )
);

const EXEMPT: ReadonlyArray<string> = ["process.env.__PACKAGE_VERSION__"];
/**
 * The console methods Node writes to stderr. nodejs.org/api/console.html has
 * `error` and `trace` print to stderr and `warn` alias `error`; it names no
 * stream for `assert`, and a probe over a `Console` built on two capturing
 * streams sent a failing `assert` to stderr. Everything else that writes
 * (`log`, `info`, `debug`, `dir`, `dirxml`, `table`, `count`, `group`,
 * `time`) writes to stdout.
 */
const STDERR_METHODS = MutableHashSet.fromIterable(["error", "warn", "trace", "assert"]);
/** An `end(` call that passes a final chunk, which `Writable.end` writes before closing. */
const END_WITH_CHUNK = /^\s*(?:\?\.\s*)?\(\s*[^\s)]/u;

// Whether the reference at `at` is itself a member access (`globalThis.process`), which no ignore token exempts.
const isMemberAccess = (code: string, at: number): boolean => unitAt(code, skipSpaceBack(code, at - 1)) === ".";

// Whether `token` is written whole at `at`: it starts there and no identifier character continues it.
const tokenAt = (code: string, at: number, token: string): boolean =>
  Str.startsWith(token, at)(code) && identifierAt(code, at + token.length) === undefined;

const processReads = (code: string, ignoreTokens: ReadonlyArray<string>): ReadonlyArray<number> =>
  A.filter(
    references(code, "process"),
    (at) => isMemberAccess(code, at) || !A.some(ignoreTokens, (token) => tokenAt(code, at, token))
  );

// The cooked member after the identifier reference at `at` and its raw end offset, through `.` or `?.`.
const memberAfter = (code: string, at: number): O.Option<readonly [member: string, end: number]> =>
  O.flatMap(O.fromUndefinedOr(identifierAt(code, at)), (rawName) => memberFrom(code, at + rawName.length));

// The cooked member a `.` or `?.` at or after `from` opens, with its raw end offset.
const memberFrom = (code: string, from: number): O.Option<readonly [member: string, end: number]> => {
  let j = skipSpaceForward(code, from);
  if (unitAt(code, j) === "?" && unitAt(code, j + 1) === ".") j++;
  if (unitAt(code, j) !== ".") return O.none();
  const start = skipSpaceForward(code, j + 1);
  return O.flatMap(O.fromUndefinedOr(identifierAt(code, start)), (rawMember) =>
    O.map(cookIdentifier(rawMember), (member) => [member, start + rawMember.length] as const)
  );
};

// Whether the member call writes: `write`, or an `end` that passes a chunk.
const writes = (code: string, [method, end]: readonly [member: string, end: number]): boolean =>
  method === "write" || (method === "end" && END_WITH_CHUNK.test(Str.slice(end)(code)));

// The stdout write the identifier token starts, if it is a `stdout` reference followed by a writing call.
const stdoutWriteAt = (
  code: string,
  token: RegExpExecArray
): O.Option<{ readonly at: number; readonly method: string }> => {
  const at = token.index;
  if (!O.contains(cookIdentifier(token[0]), "stdout") || unitAt(code, at - 1) === "#") return O.none();
  return pipe(
    memberAfter(code, at),
    O.filter((member) => writes(code, member)),
    O.map(([method]) => ({ at, method }))
  );
};

const stdoutWrites = (code: string): ReadonlyArray<{ readonly at: number; readonly method: string }> =>
  A.getSomes(A.map(identifierTokens(code), (token) => stdoutWriteAt(code, token)));

// The first offset at or after `from` where `token` occurs in `code`, or `-1`.
const indexFrom = (code: string, token: string, from: number): number =>
  O.match(Str.indexOf(token)(Str.slice(from)(code)), { onNone: () => -1, onSome: (offset) => from + offset });

// Every offset where `token` occurs in `code`, overlapping occurrences included.
const occurrencesOf = (code: string, token: string): ReadonlyArray<number> => {
  const found: Array<number> = [];
  for (let at = indexFrom(code, token, 0); at >= 0; at = indexFrom(code, token, at + 1)) found.push(at);
  return found;
};

// Whether an occurrence at `at` continues an identifier (or follows a private `#`).
const continuesIdentifier = (code: string, at: number): boolean =>
  isIdentifierChar(codePointBefore(code, at)) || unitAt(code, at - 1) === "#";

// Every offset where `token` appears in `code` as whole text: a token that
// starts with an identifier character must not continue one (nor follow `#`),
// and one that ends with an identifier character must not run into another.
const tokenOccurrences = (code: string, token: string): ReadonlyArray<number> => {
  if (Str.isEmpty(token)) return [];
  const guardStart = isIdentifierChar(codePointAt(token, 0));
  const guardEnd = isIdentifierChar(codePointBefore(token, token.length));
  return A.filter(
    occurrencesOf(code, token),
    (at) =>
      !(guardStart && continuesIdentifier(code, at)) &&
      !(guardEnd && identifierAt(code, at + token.length) !== undefined)
  );
};

const forbids: {
  (entry: string, specifier: string): boolean;
  (specifier: string): (entry: string) => boolean;
} = dual(2, (entry: string, specifier: string): boolean =>
  Str.endsWith("*")(entry)
    ? Str.startsWith(Str.slice(0, -1)(entry))(specifier)
    : specifier === entry || Str.startsWith(`${entry}/`)(specifier)
);

const isNodeModule: {
  (specifier: string, module: string): boolean;
  (module: string): (specifier: string) => boolean;
} = dual(2, (specifier: string, module: string): boolean =>
  A.some([module, `node:${module}`], (name) => specifier === name || Str.startsWith(`${name}/`)(specifier))
);

/** One rule's match, before it is located and attributed to a file. */
interface Finding {
  readonly detail: string;
  readonly offset: number;
  readonly rule: OffenceRule;
}

/** What every rule reads from one lexed file. */
interface CheckInput {
  readonly code: string;
  readonly ignoreTokens: ReadonlyArray<string>;
  readonly specifiers: ReadonlyArray<SourceLiteral>;
}

const byOffset = Order.mapInput(Num.Order, (finding: Finding) => finding.offset);

const consoleStdoutFinding = (code: string, offset: number): O.Option<Finding> => {
  const member = O.map(memberAfter(code, offset), ([name]) => name);
  if (O.exists(member, (name) => MutableHashSet.has(STDERR_METHODS, name))) return O.none();
  const detail = O.match(member, { onNone: () => "console", onSome: (name) => `console.${name}` });
  return O.some({ offset, rule: "console-stdout", detail });
};

const globalRuleFindings = (input: CheckInput, rule: GlobalRule): ReadonlyArray<Finding> =>
  GlobalRule.match(rule, {
    process: () =>
      A.map(processReads(input.code, input.ignoreTokens), (offset) => ({ offset, rule, detail: "process" })),
    "node:process": () =>
      A.map(
        A.filter(input.specifiers, (literal) => isNodeModule(literal.value, "process")),
        (literal) => ({ offset: literal.start, rule, detail: literal.value })
      ),
    "stdout-write": () =>
      A.map(stdoutWrites(input.code), ({ at, method }) => ({ offset: at, rule, detail: `stdout.${method}` })),
    console: () => A.map(references(input.code, "console"), (offset) => ({ offset, rule, detail: "console" })),
    "console-stdout": () =>
      A.getSomes(A.map(references(input.code, "console"), (offset) => consoleStdoutFinding(input.code, offset))),
  });

const tokenFindings = (code: string, tokens: ReadonlyArray<string>): ReadonlyArray<Finding> =>
  A.flatMap(A.fromIterable(MutableHashSet.fromIterable(tokens)), (token) =>
    A.map(tokenOccurrences(code, token), (offset): Finding => ({ offset, rule: "forbidTokens", detail: token }))
  );

const importFindings = (
  specifiers: ReadonlyArray<SourceLiteral>,
  entries: ReadonlyArray<string>
): ReadonlyArray<Finding> =>
  A.map(
    A.filter(specifiers, (literal) => A.some(entries, forbids(literal.value))),
    (literal): Finding => ({ offset: literal.start, rule: "forbidImports", detail: literal.value })
  );

const ruleFindings = (input: CheckInput, rule: BoundaryRule.Encoded): ReadonlyArray<Finding> => {
  if (P.isString(rule)) return globalRuleFindings(input, rule);
  return "forbidTokens" in rule
    ? tokenFindings(input.code, rule.forbidTokens)
    : importFindings(input.specifiers, rule.forbidImports);
};

// What a directory entry is once links are followed; `"Dangling"` for a link to nothing.
const entryType = (fs: FileSystem.FileSystem, full: string) =>
  fs.stat(full).pipe(
    Effect.map((info): FileSystem.File.Type | "Dangling" => info.type),
    // stat follows links, so a dangling one fails NotFound; it has nothing to scan, so skip it.
    // A NotFound on an entry that is not a link still fails: nothing may drop out of the scan silently.
    Effect.catchIf(
      (error) => error.reason._tag === "NotFound",
      (error) =>
        fs.readLink(full).pipe(
          Effect.as("Dangling" as const),
          Effect.mapError(() => error)
        )
    )
  );

// Whether a regular file named `name` is a scanned source: a listed extension and not a declaration file.
const isSourceFile = (name: string, extensions: ReadonlyArray<string>): boolean =>
  !DECLARATION.test(name) && A.some(extensions, (extension) => Str.endsWith(extension)(name));

/** One directory's subdirectories to walk and source files to scan, `node_modules` never entered. */
const listDirectory = Effect.fnUntraced(function* (directory: string, extensions: ReadonlyArray<string>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const names = yield* fs.readDirectory(directory);
  const entries = yield* Effect.forEach(names, (name) => {
    const full = path.join(directory, name);
    return Effect.map(entryType(fs, full), (type) => ({ name, full, type }));
  });
  return {
    directories: A.map(
      A.filter(entries, ({ name, type }) => type === "Directory" && name !== "node_modules"),
      ({ full }) => full
    ),
    files: A.map(
      A.filter(entries, ({ name, type }) => type === "File" && isSourceFile(name, extensions)),
      ({ full }) => full
    ),
  };
});

/**
 * Every source file under `root`, walked with an explicit stack and real-directory ancestry, so an
 * ancestor symlink cycle terminates while distinct logical paths are each listed.
 */
const sourceFiles = Effect.fnUntraced(function* (root: string, extensions: ReadonlyArray<string>) {
  const fs = yield* FileSystem.FileSystem;
  const found: Array<string> = [];
  const pending: Array<{ readonly directory: string; readonly ancestors: ReadonlyArray<string> }> = [
    { directory: root, ancestors: [] },
  ];
  while (A.isArrayNonEmpty(pending)) {
    const { directory, ancestors } = A.lastNonEmpty(pending);
    pending.pop();
    const real = yield* fs.realPath(directory);
    if (A.contains(ancestors, real)) continue;
    const listed = yield* listDirectory(directory, extensions);
    found.push(...listed.files);
    for (const child of listed.directories) pending.push({ directory: child, ancestors: A.append(ancestors, real) });
  }
  return found;
});

/** Every `allowRules` entry compiled to its glob set, keyed by rule. */
const compileWaivers = Effect.fnUntraced(function* (allowRules: Readonly<Record<string, ReadonlyArray<string>>>) {
  const waivers = MutableHashMap.empty<string, GlobSet>();
  for (const [rule, patterns] of R.toEntries(allowRules)) {
    MutableHashMap.set(waivers, rule, yield* GlobSet.compile(patterns));
  }
  return waivers;
});

const FIXTURE_INPUTS: ReadonlyArray<BoundaryFixture.Encoded> = [
  {
    name: "node:process: an escaped import",
    source: 'import p from "\\u006eode:process";',
    rule: "node:process",
    flagged: true,
  },
  {
    name: "process: astral identifier prefix",
    source: "const 𝒙process = 1; 𝒙process;",
    rule: "process",
    flagged: false,
  },
  {
    name: "process: astral identifier suffix",
    source: "const process𝒙 = 1; process𝒙;",
    rule: "process",
    flagged: false,
  },
  { name: "process: after a CR line comment", source: "// harmless\rprocess.touch();", rule: "process", flagged: true },
  {
    name: "process: after a line-separator comment",
    source: "// harmless\u2028process.touch();",
    rule: "process",
    flagged: true,
  },
  {
    name: "process: after a paragraph-separator comment",
    source: "// harmless\u2029process.touch();",
    rule: "process",
    flagged: true,
  },

  { name: "process: destructuring", source: "const { env } = process;", rule: "process", flagged: true },
  { name: "process: bracket access", source: 'const env = process["env"];', rule: "process", flagged: true },
  {
    name: "process: a member of globalThis",
    source: "const cwd = globalThis.process?.cwd();",
    rule: "process",
    flagged: true,
  },
  {
    name: "process: a template substitution",
    source: "const where = `cwd: ${process.cwd()}`;",
    rule: "process",
    flagged: true,
  },
  {
    name: "process: after a string holding a comment opener",
    source: 'const open = "/*"; const argv = process.argv; const close = "*/";',
    rule: "process",
    flagged: true,
  },
  {
    name: "process: after a regex holding a quote",
    source: 'const re = /"/; const argv = process.argv; const q = "x";',
    rule: "process",
    flagged: true,
  },
  {
    name: "process: after a division",
    source: "const half = total / 2; const argv = process.argv; const r = 1 / 4;",
    rule: "process",
    flagged: true,
  },
  { name: "process: a comment", source: "// process.exit(1)\n/* process.cwd() */", rule: "process", flagged: false },
  { name: "process: a string", source: 'const label = "process.env";', rule: "process", flagged: false },
  {
    name: "process: template text",
    source: "const help = `run process.exit to quit`;",
    rule: "process",
    flagged: false,
  },
  { name: "process: a regex literal", source: "const re = /process\\.env/g;", rule: "process", flagged: false },
  {
    name: "process: a member of another object",
    source: "const pid = child.process;",
    rule: "process",
    flagged: false,
  },
  {
    name: "process: the build-time version constant",
    source: "const version = process.env.__PACKAGE_VERSION__;",
    rule: "process",
    flagged: false,
  },
  // The lexer-ambiguity corpus: each snippet once hid a real read (or invented one).
  {
    name: "process: the version constant reached through globalThis",
    source: "const version = globalThis.process.env.__PACKAGE_VERSION__;",
    rule: "process",
    flagged: true,
  },
  {
    name: "process: after a non-null assertion divided",
    source: "const y = x! / 2; const a = process.argv; const b = 1 / 4;",
    rule: "process",
    flagged: true,
  },
  {
    name: "process: after a postfix increment divided",
    source: "const y = i++ / 2; const a = process.argv; const b = 1 / 4;",
    rule: "process",
    flagged: true,
  },
  {
    name: "process: after a call divided",
    source: "const y = f(x) / 2; const a = process.argv; const b = 1 / 4;",
    rule: "process",
    flagged: true,
  },
  {
    name: "process: after a regex that follows an if condition",
    source: "if (x) /\\/*/.test(s);\nconst a = process.argv;\n/* c */",
    rule: "process",
    flagged: true,
  },
  { name: "process: a ternary branch", source: "const p = ok ? process : fallback;", rule: "process", flagged: true },
  { name: "process: an object-literal key", source: "const o = { process: 1 };", rule: "process", flagged: false },
  { name: "process: a type member", source: "interface I { process?: string }", rule: "process", flagged: false },
  {
    name: "node:process: a static import",
    source: 'import { env } from "node:process";',
    rule: "node:process",
    flagged: true,
  },
  {
    name: "node:process: a dynamic import",
    source: 'const p = await import("process");',
    rule: "node:process",
    flagged: true,
  },
  {
    name: "node:process: a string that is not a specifier",
    source: 'const s = "node:process";',
    rule: "node:process",
    flagged: false,
  },
  {
    name: "node:process: an unrelated specifier",
    source: 'import * as ChildProcess from "effect/process/ChildProcess";',
    rule: "node:process",
    flagged: false,
  },
  { name: "stdout-write: a direct write", source: 'process.stdout.write("x");', rule: "stdout-write", flagged: true },
  {
    name: "stdout-write: an end with a chunk",
    source: 'process.stdout.end("x");',
    rule: "stdout-write",
    flagged: true,
  },
  {
    name: "stdout-write: an end without a chunk",
    source: "process.stdout.end();",
    rule: "stdout-write",
    flagged: false,
  },
  { name: "stdout-write: a string", source: 'const s = "stdout.write";', rule: "stdout-write", flagged: false },
  { name: "console: console.log", source: 'console.log("x");', rule: "console", flagged: true },
  { name: "console: console.error", source: "console.error(e);", rule: "console", flagged: true },
  {
    name: "console: the Console service",
    source: "const current = yield* Console.Console;",
    rule: "console",
    flagged: false,
  },
  { name: "console-stdout: console.log", source: 'console.log("x");', rule: "console-stdout", flagged: true },
  { name: "console-stdout: a bare alias", source: "const c = console;", rule: "console-stdout", flagged: true },
  { name: "console-stdout: console.error", source: "console.error(e);", rule: "console-stdout", flagged: false },
  {
    name: "console-stdout: a stderr method through globalThis",
    source: 'globalThis.console.warn("x");',
    rule: "console-stdout",
    flagged: false,
  },
  {
    name: "console-stdout: the Console service",
    source: "const current = yield* Console.Console;",
    rule: "console-stdout",
    flagged: false,
  },
  {
    name: "forbidImports: a platform package",
    source: 'import { NodeServices } from "@effect/platform-node";',
    rule: { forbidImports: ["@effect/platform*"] },
    flagged: true,
  },
  {
    name: "forbidImports: a commented-out import",
    source: '// import { NodeServices } from "@effect/platform-node";',
    rule: { forbidImports: ["@effect/platform*"] },
    flagged: false,
  },
  {
    name: "forbidTokens: the build-time version constant",
    source: "export const version = process.env.__PACKAGE_VERSION__;",
    rule: { forbidTokens: ["process.env.__PACKAGE_VERSION__"] },
    flagged: true,
  },
  {
    name: "forbidTokens: the token reached through globalThis",
    source: "const version = globalThis.process.env.__PACKAGE_VERSION__;",
    rule: { forbidTokens: ["process.env.__PACKAGE_VERSION__"] },
    flagged: true,
  },
  {
    name: "forbidTokens: a string and a comment",
    source: 'const s = "process.env.__PACKAGE_VERSION__"; // process.env.__PACKAGE_VERSION__',
    rule: { forbidTokens: ["process.env.__PACKAGE_VERSION__"] },
    flagged: false,
  },
  {
    name: "forbidTokens: a longer identifier",
    source: "const v = process.env.__PACKAGE_VERSION__X;",
    rule: { forbidTokens: ["process.env.__PACKAGE_VERSION__"] },
    flagged: false,
  },
  {
    name: "forbidTokens: the tail of a longer identifier",
    source: "const v = xprocess.env.__PACKAGE_VERSION__;",
    rule: { forbidTokens: ["process.env.__PACKAGE_VERSION__"] },
    flagged: false,
  },
  {
    name: "forbidTokens: after a variable named of, divided",
    source: "const of = 8; const x = of / 2; const v = process.env.__PACKAGE_VERSION__; const y = 8 / 2;",
    rule: { forbidTokens: ["process.env.__PACKAGE_VERSION__"] },
    flagged: true,
  },
  {
    name: "forbidTokens: a private field",
    source: "const v = this.#process.env.__PACKAGE_VERSION__;",
    rule: { forbidTokens: ["process.env.__PACKAGE_VERSION__"] },
    flagged: false,
  },
];

const FIXTURES: ReadonlyArray<BoundaryFixture> = A.map(FIXTURE_INPUTS, (fixture) => BoundaryFixture.make(fixture));

/**
 * Source-text boundary checks: which files read `process`, import a forbidden
 * module, or write to stdout or the console.
 *
 * **Details**
 *
 * Every check runs over one lexer pass that separates code from comments,
 * strings, template text and regex bodies, so `process` in prose, in a string
 * or in an embedded script's template text never counts, and a `/*` inside a
 * string never hides the code behind it. A `/` after an operand divides (an
 * identifier, `)`, `]`, a postfix `++`/`--` or a non-null `!`), while one after
 * an operator, a keyword or the `)` of an `if`/`while`/`for`/`with` condition
 * opens a regex. An object-literal key or type member named `process`
 * (`{ process: 1 }`) is not a read.
 *
 * **Gotchas**
 *
 * It is a lexer, not a type checker, and these misses are known:
 *
 * - there is no scope analysis, so ANY local binding named `process` or
 *   `console` is flagged like the global: a parameter
 *   (`(process: Handle) => process.kill()`), a variable, a label, or an
 *   unannotated class field (`process = 1`). An annotated class field
 *   (`process: T`) reads as a type member and is spared. Prefer renaming the
 *   binding; otherwise waive that one rule for the file with an
 *   `allowRules` glob, which leaves every other rule in force and reports
 *   what it waived. An `allow` glob exempts the file from every rule;
 *
 * - a computed access through a string key (`globalThis["process"]`) and a
 *   destructuring of a global (`const { process: p } = globalThis`) are not seen;
 *
 * - a regex literal directly after a block-closing `}` reads as a division, so
 *   a quote or `/*` inside it can hide the code after it;
 *
 * - JSX text reads as code;
 *
 * - a variable named `yield` or `await` in a sloppy-mode script reads as the
 *   keyword, so a `/` after it opens a regex (module and strict code reserve
 *   both words);
 *
 * - `forbidImports: ["node:*"]` does not catch a bare built-in such as
 *   `"fs"` (see {@link BoundaryRule}).
 *
 * Assert on {@link SourceBoundary.verifyFixtures} beside your own scan: it
 * proves the scanner you are trusting still flags what it must and spares
 * what it must.
 *
 * **Example** (Detect a process reference and verify scanner fixtures)
 *
 * ```ts
 * import { SourceBoundary } from "@beep/repo-workspaces/SourceBoundary";
 *
 * const offences = SourceBoundary.check("src/a.ts", "const { env } = process;", ["process"]);
 * const clean = SourceBoundary.verifyFixtures().length === 0;
 * console.log(offences.map((offence) => offence.label).join(","), clean); // src/a.ts:1:17 process process true
 * ```
 *
 * @public
 * @category utilities
 * @since 0.0.0
 */
export class SourceBoundary {
  private constructor() {}

  /**
   * `text` with every comment blanked to spaces; strings, templates and regexes untouched, length and line breaks kept.
   *
   * **Example** (Blank a trailing comment)
   *
   * ```ts
   * import { SourceBoundary } from "@beep/repo-workspaces/SourceBoundary";
   *
   * console.log(SourceBoundary.stripComments("x//hi") === "x    ") // true
   * ```
   *
   * @category utilities
   * @since 0.0.0
   */
  static readonly stripComments = (text: string): string => lex(text).withoutComments;

  /**
   * Whether `text` reads the global `process` in code (see {@link BoundaryRule}).
   *
   * **Example** (Detect a global process read)
   *
   * ```ts
   * import { SourceBoundary } from "@beep/repo-workspaces/SourceBoundary";
   *
   * console.log(SourceBoundary.referencesProcess("process.cwd()")) // true
   * ```
   *
   * @category predicates
   * @since 0.0.0
   */
  static readonly referencesProcess: {
    (text: string, options?: ReferenceOptions.Encoded): boolean;
    (options?: ReferenceOptions.Encoded): (text: string) => boolean;
  } = dual(
    (args) => P.isString(args[0]),
    (text: string, options?: ReferenceOptions.Encoded): boolean =>
      A.isReadonlyArrayNonEmpty(processReads(lex(text).code, A.appendAll(EXEMPT, options?.ignoreTokens ?? [])))
  );

  /**
   * Every module specifier `text` imports: static, side-effect, re-export, type-only, `import(...)` with a literal, and `require(...)`.
   *
   * **Example** (Extract a Node import specifier)
   *
   * ```ts
   * import { SourceBoundary } from "@beep/repo-workspaces/SourceBoundary";
   *
   * console.log(SourceBoundary.importSpecifiers('import "node:fs";').join(",")) // node:fs
   * ```
   *
   * @category parsing
   * @since 0.0.0
   */
  static readonly importSpecifiers = (text: string): ReadonlyArray<string> =>
    A.map(specifierLiterals(lex(text)), (literal) => literal.value);

  /**
   * Whether `text` imports the Node built-in `module`, in either its `node:` or bare form.
   *
   * **Example** (Recognize a bare Node built-in import)
   *
   * ```ts
   * import { SourceBoundary } from "@beep/repo-workspaces/SourceBoundary";
   *
   * console.log(SourceBoundary.importsNode('import "fs";', "fs")) // true
   * ```
   *
   * @category predicates
   * @since 0.0.0
   */
  static readonly importsNode: {
    (text: string, module: string): boolean;
    (module: string): (text: string) => boolean;
  } = dual(2, (text: string, module: string): boolean =>
    A.some(SourceBoundary.importSpecifiers(text), isNodeModule(module))
  );

  /**
   * Every place `text` breaks one of `rules`, in source order, attributed to `file`.
   *
   * **Details**
   *
   * A `{ forbidTokens }` entry matches its exact text in code only: comments,
   * strings, template text and regex bodies are blanked first, so a token that
   * itself contains a string literal never matches, and whitespace inside a
   * token must match byte for byte. A token that starts with an identifier
   * character does not match inside a longer identifier or after `#`, and one
   * that ends with one does not match when an identifier character follows.
   * A member access is still a match: `globalThis.process.env.X` contains the
   * token `process.env.X`. A token listed twice is reported once. A token with
   * no identifier character at either end (`"=>"`, `"?."`) has no edge guard,
   * so it matches inside longer punctuation, and consecutive matches of it can
   * overlap.
   *
   * **Example** (Count a process offence)
   *
   * ```ts
   * import { SourceBoundary } from "@beep/repo-workspaces/SourceBoundary";
   *
   * console.log(SourceBoundary.check("a.ts", "process.cwd()", ["process"]).length) // 1
   * ```
   *
   * @category validation
   * @since 0.0.0
   */
  static readonly check: {
    (
      file: string,
      text: string,
      rules: ReadonlyArray<BoundaryRule.Encoded>,
      options?: ReferenceOptions.Encoded
    ): ReadonlyArray<Offence>;
    (
      text: string,
      rules: ReadonlyArray<BoundaryRule.Encoded>,
      options?: ReferenceOptions.Encoded
    ): (file: string) => ReadonlyArray<Offence>;
  } = dual(
    (args) => P.isString(args[1]),
    (
      file: string,
      text: string,
      rules: ReadonlyArray<BoundaryRule.Encoded>,
      options?: ReferenceOptions.Encoded
    ): ReadonlyArray<Offence> => {
      const lexed = lex(text);
      const at = locate(text);
      const input: CheckInput = {
        code: lexed.code,
        specifiers: specifierLiterals(lexed),
        ignoreTokens: A.appendAll(EXEMPT, options?.ignoreTokens ?? []),
      };
      return pipe(
        rules,
        A.flatMap((rule) => ruleFindings(input, rule)),
        A.sort(byOffset),
        A.map(({ offset, rule, detail }) => Offence.make({ file, ...at(offset), rule, detail }))
      );
    }
  );

  /**
   * Check every source file under `root` against `rules`.
   *
   * **Details**
   *
   * Walks with an explicit stack and real-directory ancestry (via
   * `realPath`), so ancestor symlink cycles terminate while distinct logical
   * paths are each scanned with their own waiver policy. `node_modules` is never entered. Paths come back relative
   * and `/`-separated whatever the platform's separator, and that is also
   * what `allow` globs match against. A missing root fails; it never scans
   * nothing. A dangling symlink under the root is skipped, having nothing to
   * scan; any other entry that cannot be read fails the scan.
   *
   * **Example** (Scan source files for forbidden globals and imports)
   *
   * ```ts
   * import { NodeServices } from "@effect/platform-node";
   * import { SourceBoundary } from "@beep/repo-workspaces/SourceBoundary";
   * import * as Effect from "effect/Effect";
   *
   * const scan = SourceBoundary.scan({
   *   root: "/repo/packages/engine/src",
   *   rules: ["process", "node:process", { forbidImports: ["node:*", "@effect/platform*"] }],
   * }).pipe(Effect.provide(NodeServices.layer));
   * console.log(Effect.isEffect(scan)) // true
   * ```
   *
   * @category validation
   * @since 0.0.0
   */
  static readonly scan = Effect.fn("SourceBoundary.scan")(function* (options: ScanOptions.Encoded) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const allow = yield* GlobSet.compile(options.allow ?? []);
    const waivers = yield* compileWaivers(options.allowRules ?? {});
    const relative = (full: string): string => A.join(Str.split(path.sep)(path.relative(options.root, full)), "/");
    const files = A.map(yield* sourceFiles(options.root, options.extensions ?? DEFAULT_EXTENSIONS), (full) => ({
      full,
      file: relative(full),
    }));
    const checked = A.filter(files, ({ file }) => !allow.matches(file));
    const found = A.flatten(
      yield* Effect.forEach(checked, ({ full, file }) =>
        Effect.map(fs.readFileString(full), (text) => SourceBoundary.check(file, text, options.rules, options))
      )
    );
    const isWaived = (offence: Offence): boolean =>
      O.exists(MutableHashMap.get(waivers, offence.rule), (globs) => globs.matches(offence.file));
    return SourceScan.make({
      files: A.sort(
        A.map(files, ({ file }) => file),
        byCodeUnit
      ),
      allowed: A.sort(
        A.filter(
          A.map(files, ({ file }) => file),
          (file) => allow.matches(file)
        ),
        byCodeUnit
      ),
      offences: A.sort(
        A.filter(found, (offence) => !isWaived(offence)),
        byPosition
      ),
      waived: A.sort(A.filter(found, isWaived), byPosition),
    });
  });

  /**
   * The shipped positive- and negative-control snippets, at least one of each per rule kind.
   *
   * **Example** (Inspect the first control rule)
   *
   * ```ts
   * import { SourceBoundary } from "@beep/repo-workspaces/SourceBoundary";
   *
   * console.log(SourceBoundary.fixtures[0]?.rule) // node:process
   * ```
   *
   * @category fixtures
   * @since 0.0.0
   */
  static readonly fixtures: ReadonlyArray<BoundaryFixture> = FIXTURES;

  /**
   * The names of shipped fixtures the scanner gets wrong; `[]` means it still flags and spares what it must.
   *
   * **Example** (Verify all shipped scanner controls)
   *
   * ```ts
   * import { SourceBoundary } from "@beep/repo-workspaces/SourceBoundary";
   *
   * console.log(SourceBoundary.verifyFixtures().length) // 0
   * ```
   *
   * @category testing
   * @since 0.0.0
   */
  static readonly verifyFixtures = (): ReadonlyArray<string> =>
    pipe(
      FIXTURES,
      A.filter(
        (fixture) =>
          A.isReadonlyArrayNonEmpty(SourceBoundary.check("fixture.ts", fixture.source, [fixture.rule])) !==
          fixture.flagged
      ),
      A.map((fixture) => `${fixture.flagged ? "missed" : "false positive"}: ${fixture.name}`)
    );
}
