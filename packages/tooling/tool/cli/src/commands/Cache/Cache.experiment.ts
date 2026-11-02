/**
 * Disposable local Turbo experiments with bounded captures and no remote credentials.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as Str from "effect/String";
import type { CacheCaptureViolation, CacheSyntheticRun } from "./Cache.experiment.schemas.ts";

// Fixed adversarial data, never an operator credential.
const secretCanary = "QUALIFICATION_SYNTHETIC_SECRET_629a94d2";
const logLimit = 64 * 1024;

/**
 * Detect unsafe or incomplete local capture without returning its contents.
 *
 * **Example** (Reject a truncated capture)
 *
 * ```ts
 * import { inspectCacheFixtureCapture } from "@beep/repo-cli/test/Cache"
 * console.assert(inspectCacheFixtureCapture("ok", true).includes("overflow"))
 * ```
 *
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const inspectCacheFixtureCapture: {
  (truncated: boolean): (text: string) => ReadonlyArray<CacheCaptureViolation>;
  (text: string, truncated: boolean): ReadonlyArray<CacheCaptureViolation>;
} = dual(
  2,
  (text: string, truncated: boolean): ReadonlyArray<CacheCaptureViolation> => [
    ...(truncated || new TextEncoder().encode(text).byteLength > logLimit
      ? A.of<CacheCaptureViolation>("overflow")
      : []),
    ...(Str.includes(secretCanary)(text) ? A.of<CacheCaptureViolation>("synthetic-secret") : []),
    ...(Str.includes("/fixture/")(text) || Str.includes("/fixture-other/")(text)
      ? A.of<CacheCaptureViolation>("absolute-path")
      : []),
  ]
);

/**
 * Compare successful captures only; matching unsafe digests cannot pass.
 *
 * **Example** (Reference the local comparison)
 *
 * ```ts
 * import { equivalentCacheFixtureRuns } from "@beep/repo-cli/test/Cache"
 * console.assert(typeof equivalentCacheFixtureRuns === "function")
 * ```
 *
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const equivalentCacheFixtureRuns: {
  (right: CacheSyntheticRun): (left: CacheSyntheticRun) => boolean;
  (left: CacheSyntheticRun, right: CacheSyntheticRun): boolean;
} = dual(
  2,
  (left: CacheSyntheticRun, right: CacheSyntheticRun): boolean =>
    left.exitCode === 0 &&
    right.exitCode === 0 &&
    A.isReadonlyArrayEmpty(left.violations) &&
    A.isReadonlyArrayEmpty(right.violations) &&
    left.bunSha256 === right.bunSha256 &&
    left.taskHash === right.taskHash &&
    left.outputSha256 === right.outputSha256 &&
    left.logSha256 === right.logSha256
);
