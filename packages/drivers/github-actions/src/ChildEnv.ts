/**
 * Child-process environments: `PATH` prepends and the platform's command-launch rules.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $GithubActionsId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $GithubActionsId.create("ChildEnv");
/**
 * The environment additions {@link ChildEnv.prependPath} builds: exactly one
 * entry, keyed by `PATH` on POSIX or the base's own spelling on Windows.
 *
 * **Example** (Validate PathPrependEnv)
 *
 * ```ts
 * import { PathPrependEnv } from "@beep/github-actions/ChildEnv";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(PathPrependEnv)({ env: { PATH: "/tools" }, extendEnv: true })) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class PathPrependEnv extends S.Opaque<PathPrependEnv, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The additions to hand a child, ready to merge over the parent's block. */
    env: S.Record(S.String, S.String).pipe(
      $I.annoteKey("PathPrependEnv.env", { description: "The additions to merge over the parent environment." })
    ),
    /**
     * Always `true`, and part of the answer on purpose: `env` **without**
     * `extendEnv: true` silently replaces the child's entire environment with
     * this one entry. See {@link ChildEnv.prependPath}.
     */
    extendEnv: S.tag(true).pipe(
      $I.annoteKey("PathPrependEnv.extendEnv", {
        description: "Merge additions rather than replacing the child environment.",
      })
    ),
  }).pipe(
    $I.annoteSchema("PathPrependEnv", {
      description: "Plain-object PATH additions paired with the required environment merge flag.",
    })
  )
) {}

/**
 * The environment additions type accepted by {@link PathPrependEnv}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PathPrependEnv {
  /**
   * The plain object a {@link PathPrependEnv} decodes from and encodes to.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof PathPrependEnv.Encoded;
}

/**
 * What {@link ChildEnv.prependPath} derives the additions from.
 *
 * **Example** (Validate PathPrependOptions)
 *
 * ```ts
 * import { PathPrependOptions } from "@beep/github-actions/ChildEnv";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(PathPrependOptions)({ base: {}, platform: "linux" })) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class PathPrependOptions extends S.Opaque<PathPrependOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * The environment the child will inherit — on a runner, `process.env`.
     *
     * **Details**
     *
     * Explicit rather than defaulted, per the package rule stated on
     * {@link ChildEnv} — which is also what makes the Windows casing branch
     * exercisable from a test on any host.
     */
    base: S.Record(S.String, S.UndefinedOr(S.String)).pipe(
      $I.annoteKey("PathPrependOptions.base", {
        description: "The explicitly supplied parent environment, including undefined values.",
      })
    ),
    /**
     * The platform the child runs on, `process.platform`-shaped. Decides the
     * `PATH` entry delimiter: `;` on `win32`, `:` everywhere else.
     */
    platform: S.String.pipe(
      $I.annoteKey("PathPrependOptions.platform", {
        description: "The platform selecting PATH casing and its entry delimiter.",
      })
    ),
  }).pipe(
    $I.annoteSchema("PathPrependOptions", {
      description: "Plain-object inputs for constructing child PATH additions without ambient defaults.",
    })
  )
) {}

/**
 * The options type accepted by {@link PathPrependOptions}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PathPrependOptions {
  /**
   * The plain object a {@link PathPrependOptions} decodes from and encodes to.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof PathPrependOptions.Encoded;
}

/**
 * Child-process environment construction: prepending directories to `PATH`
 * without falling into three cross-platform traps.
 *
 * **Gotchas**
 *
 * Spawning a child with directories prepended to `PATH` is one tiny concern
 * with three sharp edges, and every one of them fails silently or only on
 * Windows:
 *
 * 1. **`env` without `extendEnv: true` strips the child's environment.**
 *    Core's `ChildProcess.CommandOptions.env` *replaces* the block unless
 *    `extendEnv` says to merge, so a bare `{ env }` costs the child everything
 *    — including the very `PATH` being extended.
 * 2. **Windows spells it `Path`, and casing decides who wins.** The
 *    environment block is case-insensitive on win32, and Node de-duplicates a
 *    merged block by keeping the **lexicographically first** spelling — an
 *    undocumented internal that happens to favour `PATH` over an inherited
 *    `Path`, and that nothing obliges Node to keep. Writing through the
 *    inherited key's own casing means never depending on it.
 * 3. **`.cmd` shims need a shell since CVE-2024-27980.** See
 *    {@link ChildEnv.needsShell}.
 *
 * The first two live in {@link ChildEnv.prependPath}; the third is a separate
 * predicate because it belongs on the spawn call, not in the environment.
 *
 * This class is total and pure — no service, no `R`, nothing read from the
 * ambient process — the same species as `Secret`'s statics, one concern per
 * member.
 *
 * **The package rule, stated once: ambient process state is never read behind
 * a caller's back.** `process.env`, `process.arch` and `process.platform` are
 * read by `ActionEnvironment` (once, at layer construction) and otherwise
 * taken as an argument — which is what makes every platform branch
 * exercisable from a test on any host. The sanctioned exceptions are
 * *defaults a caller can override by passing the value*: `ActionInput.provider`'s
 * `env = process.env` and `DetachedProcess.spawn`'s `base`.
 *
 * **Example** (Build a child PATH without losing inherited entries)
 *
 * ```ts
 * import { ChildEnv } from "@beep/github-actions/ChildEnv";
 *
 * const additions = ChildEnv.prependPath(["/opt/pnpm/bin"], {
 *   base: { PATH: "/usr/bin" },
 *   platform: "linux",
 * });
 * console.log(additions.env.PATH) // /opt/pnpm/bin:/usr/bin
 * ```
 *
 * @public
 * @category utilities
 * @since 0.0.0
 */
export abstract class ChildEnv {
  /**
   * The key `base` spells `PATH` with — `Path` on a typical Windows block,
   * `PATH` elsewhere, and `PATH` when the base has no entry at all.
   *
   * **Details**
   *
   * The lookup is case-insensitive because the Windows environment block is;
   * the answer preserves the base's own casing because that is the spelling a
   * merged block must write through (trap 2 above).
   *
   * **Example** (Preserve Windows PATH casing)
   *
   * ```ts
   * import { ChildEnv } from "@beep/github-actions/ChildEnv";
   *
   * console.log(ChildEnv.pathKeyOf({ Path: "C:\\Windows" })) // Path
   * ```
   *
   * @category utilities
   * @since 0.0.0
   */
  static pathKeyOf(base: Readonly<Record<string, string | undefined>>): string {
    return O.getOrElse(
      A.findFirst(R.keys(base), (key) => Str.toUpperCase(key) === "PATH"),
      () => "PATH"
    );
  }

  /**
   * The environment additions that prepend `dirs` to the child's `PATH`,
   * paired with the `extendEnv: true` that keeps them a *prepend*.
   *
   * **Details**
   *
   * `dirs` are joined ahead of the inherited value **in the order given** —
   * order is the caller's policy, because the first directory wins any name
   * collision (a package manager's shim directory leads so it beats a runtime
   * of the same name). POSIX uses the exact `PATH` key. On Windows, the
   * entry is written under the base's own `PATH`
   * spelling ({@link ChildEnv.pathKeyOf}), so a Windows child never receives
   * `PATH` beside its inherited `Path`. An absent or empty inherited value
   * appends nothing — deliberately not an empty trailing entry, which both
   * platforms historically read as "the current directory".
   *
   * Two consumers, two compositions, and the difference is exactly trap 1:
   *
   * - A spawner call takes the **whole pair** — spread it into the command
   *   options, as in the example below, so the `extendEnv: true` that makes
   *   `env` a merge rather than a replacement cannot be forgotten.
   * - An API that already merges additions over the parent itself —
   *   `DetachedProcess.spawn`, whose `env` is documented as merged — takes
   *   `.env` alone; `extendEnv` would be meaningless there.
   *
   * On a runner, pass `{ base: process.env, platform: process.platform }`.
   *
   * **Example** (Prepend a pnpm directory to the child environment)
   *
   * ```ts
   * import { ChildEnv } from "@beep/github-actions/ChildEnv";
   * import * as ChildProcess from "effect/process/ChildProcess";
   *
   * const command = ChildProcess.make("pnpm", ["install"], {
   *   ...ChildEnv.prependPath(["/opt/hostedtoolcache/pnpm/10.13.1/x64/bin"], {
   *     base: { PATH: "/usr/bin" },
   *     platform: "linux",
   *   }),
   *   ...(ChildEnv.needsShell("linux") ? { shell: true } : {}),
   * });
   * console.log(command.options.extendEnv) // true
   * ```
   *
   * @category utilities
   * @since 0.0.0
   */
  static readonly prependPath: {
    (dirs: readonly [string, ...ReadonlyArray<string>], options: PathPrependOptions.Encoded): PathPrependEnv;
    (options: PathPrependOptions.Encoded): (dirs: readonly [string, ...ReadonlyArray<string>]) => PathPrependEnv;
  } = dual(
    2,
    (dirs: readonly [string, ...ReadonlyArray<string>], options: PathPrependOptions.Encoded): PathPrependEnv => {
      const delimiter = options.platform === "win32" ? ";" : ":";
      const key = options.platform === "win32" ? ChildEnv.pathKeyOf(options.base) : "PATH";
      const inherited = O.getOrUndefined(R.get(options.base, key));
      const entries = inherited === undefined || inherited === "" ? dirs : [...dirs, inherited];
      return PathPrependEnv.make({ env: { [key]: A.join(entries, delimiter) }, extendEnv: true });
    }
  );

  /**
   * Whether a bare-name command must be launched through a shell on this
   * platform.
   *
   * **Gotchas**
   *
   * On Windows every npm-installed tool on `PATH` is a `.cmd` batch shim, not
   * an executable: `CreateProcess` cannot run one, and since CVE-2024-27980
   * Node refuses to hand `.cmd`/`.bat` files to it at all unless a shell is
   * asked for — so the spawn fails at launch, before the tool ever runs.
   * Under `shell: true`, `cmd.exe` resolves the bare name off the **child's**
   * `PATH` — the one {@link ChildEnv.prependPath} builds — through `PATHEXT`,
   * where `.EXE` precedes `.CMD`, so a real binary of the same name is still
   * found first and the prepends keep working exactly as they do without a
   * shell.
   *
   * POSIX answers `false`: the direct spawn already works, and a shell would
   * only add a quoting hazard between the caller and the exit code. Note the
   * hazard `true` carries: under a shell Node concatenates the command line
   * rather than passing an argv, so arguments must be static literals, never
   * derived from input.
   *
   * **Example** (Choose shell launch behavior by platform)
   *
   * ```ts
   * import { ChildEnv } from "@beep/github-actions/ChildEnv";
   *
   * console.log(ChildEnv.needsShell("win32")) // true
   * console.log(ChildEnv.needsShell("linux")) // false
   * ```
   *
   * @category predicates
   * @since 0.0.0
   */
  static needsShell(platform: string): boolean {
    return platform === "win32";
  }
}
