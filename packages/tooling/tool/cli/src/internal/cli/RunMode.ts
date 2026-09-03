/**
 * Shared `check | write | dry-run` run-mode literal domain and a
 * precedence-based flags-to-mode resolver for repo-cli command adapters.
 *
 * **Details**
 *
 * This kit's literal set is designed to represent, without loss, the
 * `VersionSyncModeKit`, `SyncDataRunModeKit`, and raw `SkillsRunMode` union
 * that each command currently maintains in isolation, plus their duplicated
 * `resolveMode` helpers. {@link resolveRunMode} reproduces the
 * `O.firstSomeOf` precedence that every existing resolver uses; commands that
 * treat two flags as mutually exclusive gate on {@link runModeFlagsConflict}
 * before resolving so they keep raising their own tagged error.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { A, O, P, pipe } from "@beep/utils";
import { dual } from "effect/Function";

const $I = $RepoCliId.create("internal/cli/RunMode");

const RunModeKit = LiteralKit(["check", "write", "dry-run"]);

/**
 * Command execution mode shared by check/write/dry-run style commands.
 *
 * **Example** (Decode dry-run mode)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { RunMode } from "@beep/repo-cli/internal/cli/RunMode"
 *
 * console.log(S.decodeUnknownSync(RunMode)("dry-run"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RunMode = RunModeKit.pipe(
  $I.annoteSchema("RunMode", {
    description: "Command execution mode: check, write, or dry-run.",
  })
);

/**
 * Literal option tuple for {@link RunMode}.
 *
 * **Example** (Includes write option)
 *
 * ```ts
 * import { RunModeOptions } from "@beep/repo-cli/internal/cli/RunMode"
 *
 * console.log(RunModeOptions.includes("write")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RunModeOptions = RunModeKit.Options;

/**
 * Pattern-matching helper for {@link RunMode} literals.
 *
 * **Example** (Match write mode handlers)
 *
 * ```ts
 * import { RunModeMatch } from "@beep/repo-cli/internal/cli/RunMode"
 *
 * console.log(RunModeMatch("write", { check: () => 0, write: () => 1, "dry-run": () => 2 }))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RunModeMatch = RunModeKit.$match;

/**
 * Thunk helpers returning each {@link RunMode} literal.
 *
 * **Example** (Invoke write mode thunk)
 *
 * ```ts
 * import { RunModeThunk } from "@beep/repo-cli/internal/cli/RunMode"
 *
 * console.log(RunModeThunk.write())
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RunModeThunk = RunModeKit.thunk;

/**
 * Enum mapping for {@link RunMode} literals.
 *
 * **Example** (Lookup dry-run enum value)
 *
 * ```ts
 * import { RunModeEnum } from "@beep/repo-cli/internal/cli/RunMode"
 *
 * console.log(RunModeEnum["dry-run"])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RunModeEnum = RunModeKit.Enum;

/**
 * Derived per-literal guards for {@link RunMode}.
 *
 * **Example** (Test write mode guard)
 *
 * ```ts
 * import { RunModeIs } from "@beep/repo-cli/internal/cli/RunMode"
 *
 * console.log(RunModeIs.write("write"))
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const RunModeIs = RunModeKit.is;

/**
 * Command execution mode: check, write, or dry-run.
 *
 * @category models
 * @since 0.0.0
 */
export type RunMode = typeof RunMode.Type;

/**
 * Resolve a run mode from ordered flag candidates, taking the first enabled
 * candidate and falling back when none are set.
 *
 * **Details**
 *
 * Reproduces the `O.firstSomeOf` precedence shared by every existing
 * `resolveMode` helper. Order the candidates by priority; the first `true`
 * flag wins.
 *
 * **Example** (Resolve first enabled mode)
 *
 * ```ts
 * import { resolveRunMode } from "@beep/repo-cli/internal/cli/RunMode"
 *
 * // first enabled candidate wins; here `write` is set, so it beats the fallback
 * console.log(resolveRunMode([[false, "dry-run"], [true, "write"]], "check"))
 * console.log(resolveRunMode("check")([[false, "dry-run"], [true, "write"]]))
 * ```
 *
 * @param candidates - Ordered `[enabled, mode]` pairs, highest priority first.
 * @param fallback - Mode returned when no candidate flag is set.
 * @returns The resolved run mode.
 * @category resolution
 * @since 0.0.0
 */
type RunModeCandidates = ReadonlyArray<readonly [enabled: boolean, mode: RunMode]>;

export const resolveRunMode: {
  (fallback: RunMode): (candidates: RunModeCandidates) => RunMode;
  (candidates: RunModeCandidates, fallback: RunMode): RunMode;
} = dual(
  2,
  (candidates: RunModeCandidates, fallback: RunMode): RunMode =>
    pipe(
      A.map(candidates, ([enabled, mode]) => pipe(enabled, O.liftPredicate(P.isTruthy), O.as(mode))),
      O.firstSomeOf,
      O.getOrElse(() => fallback)
    )
);

/**
 * True when two mutually-exclusive run-mode flags are both set.
 *
 * **Details**
 *
 * Commands that forbid combining two mode flags (for example `--check` with
 * `--dry-run`) gate on this before {@link resolveRunMode} so they can raise
 * their own tagged conflict error.
 *
 * **Example** (Detect both flags set)
 *
 * ```ts
 * import { runModeFlagsConflict } from "@beep/repo-cli/internal/cli/RunMode"
 *
 * console.log(runModeFlagsConflict(true, true))
 * console.log(runModeFlagsConflict(false)(true))
 * ```
 *
 * @param first - The first mode flag.
 * @param second - The second mode flag.
 * @returns `true` when both flags are set.
 * @category resolution
 * @since 0.0.0
 */
export const runModeFlagsConflict: {
  (first: boolean, second: boolean): boolean;
  (second: boolean): (first: boolean) => boolean;
} = dual(2, (first: boolean, second: boolean): boolean => first && second);
