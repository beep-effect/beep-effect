/**
 * Shared deterministic environments for coverage execution and source discovery.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { turboCachePullRequestPosture } from "../../../internal/cli/TurboCache.ts";

const $I = $RepoCliId.create("commands/Quality/internal/CoverageEnvironment");

/**
 * Child-process environment overrides for a coverage run.
 *
 * **Details**
 *
 * Each entry is spread over the inherited environment at spawn time. A string
 * value sets the variable; an `undefined` value clears an inherited one, so
 * the record itself is always present and only its values may be absent.
 *
 * **Example** (Accept a clearing override)
 *
 * ```ts
 * import { CoverageEnvironment } from "@beep/repo-cli/commands/Quality/internal/CoverageEnvironment"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CoverageEnvironment)({ CI: "true", TERM_PROGRAM: undefined })) // true
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export const CoverageEnvironment = S.Record(S.String, S.UndefinedOr(S.String)).pipe(
  $I.annoteSchema("CoverageEnvironment", {
    description: "Environment overrides for a coverage child process; an undefined value clears an inherited variable.",
  })
);

/**
 * Decoded {@link CoverageEnvironment} value.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type CoverageEnvironment = typeof CoverageEnvironment.Type;

const DEFAULT_COVERAGE_FAST_CHECK_SEED = "20260708";
const COVERAGE_NODE_OPTIONS_ARG = "--no-experimental-webstorage";

const coverageNodeOptions = (): string =>
  pipe(
    O.fromUndefinedOr(Bun.env.NODE_OPTIONS),
    O.map(Str.trim),
    O.filter(Str.isNonEmpty),
    O.map((nodeOptions) =>
      Str.includes(COVERAGE_NODE_OPTIONS_ARG)(nodeOptions) ? nodeOptions : `${nodeOptions} ${COVERAGE_NODE_OPTIONS_ARG}`
    ),
    O.getOrElse(() => COVERAGE_NODE_OPTIONS_ARG)
  );

// Coverage compares instrumentation metrics across runs, so its default seed
// is reproducible. Callers can override it for additional exploration, while
// the unseeded nightly property-law sweep remains responsible for breadth.
const coverageFastCheckSeed = (): string =>
  pipe(
    O.fromUndefinedOr(Bun.env.BEEP_FC_SEED),
    O.map(Str.trim),
    O.filter(Str.isNonEmpty),
    O.getOrElse(() => DEFAULT_COVERAGE_FAST_CHECK_SEED)
  );

// Coverage is a hosted ratchet. Pin its CI identity, remove desktop terminal
// metadata, and reduce the Turbo remote-cache quad to the pull-request posture
// so local baseline generation, PR jobs, and main pushes all exercise the same
// branches: a workstation's 1Password-backed TURBO_TOKEN and a main push's
// literal token each reach arms of internal/cli/EnvConfig.ts that a PR job's
// blank quad never does (ship-velocity B9). Step env wins over
// turboEnvOverrides at spawn time, and the prebuild step never receives this
// record, so main pushes keep their remote-cache reads for the build graph.
/**
 * Preserve the deterministic environment of the standalone coverage ratchet.
 *
 * **Example** (Inspect standalone ratchet mode)
 * ```ts
 * import { coverageEnvironment } from "@beep/repo-cli/commands/Quality/internal/CoverageEnvironment"
 * console.log(coverageEnvironment().VITEST_COVERAGE_RATCHET) // "1"
 * ```
 *
 * **Details**
 *
 * The return type is the {@link CoverageEnvironment} override record. An undefined
 * entry explicitly clears an inherited variable; the returned environment object is always present.
 *
 * @returns Deterministic hosted environment overrides with the standalone coverage ratchet enabled.
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const coverageEnvironment = (): CoverageEnvironment => ({
  BEEP_FC_SEED: coverageFastCheckSeed(),
  CI: "true",
  GITHUB_ACTIONS: "true",
  NODE_OPTIONS: coverageNodeOptions(),
  TERM_PROGRAM: undefined,
  TERM_PROGRAM_VERSION: undefined,
  ...turboCachePullRequestPosture,
  VITEST_COVERAGE_RATCHET: "1",
});

/**
 * Deterministic environment for tests that also produce CI coverage evidence.
 *
 * **Details**
 *
 * The legacy standalone coverage flag skips cases that ordinary unit jobs must
 * execute. Clear it for the combined producer: explicit Vitest coverage arguments
 * enable instrumentation, and the separate artifact consumer enforces the ratchet.
 *
 * **Example** (Inspect the pinned seed)
 * ```ts
 * import { coverageProducerEnvironment } from "@beep/repo-cli/commands/Quality/Tasks"
 * console.log(coverageProducerEnvironment().VITEST_COVERAGE_RATCHET) // undefined
 * ```
 * @returns Deterministic coverage overrides that keep ordinary unit test cases enabled.
 * @category utilities
 * @since 0.0.0
 */
export const coverageProducerEnvironment = (): CoverageEnvironment => ({
  ...coverageEnvironment(),
  VITEST_COVERAGE_RATCHET: undefined,
});
