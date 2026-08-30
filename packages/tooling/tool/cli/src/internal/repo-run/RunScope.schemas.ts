/**
 * Schema-first records for systemd-backed admission run scopes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("internal/repo-run/RunScope.schemas");

const RunScopeUnitName = S.String.pipe(
  S.check(S.isPattern(/^agent-run-[a-zA-Z0-9:_.-]+\.scope$/u)),
  $I.annoteSchema("RunScopeUnitName", {
    description: "Safe systemd scope unit name generated for one admitted repository run.",
  })
);

/**
 * Availability state for systemd user-manager run scopes.
 *
 * **Example** (Recognize active support)
 *
 * ```ts
 * import { RunScopeSupport } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(RunScopeSupport.is.active("active")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RunScopeSupport = LiteralKit(["active", "unsupported", "disabled", "failed"]).pipe(
  $I.annoteSchema("RunScopeSupport", {
    description: "Availability state for systemd user-manager run scopes.",
  })
);

/**
 * Availability state for systemd user-manager run scopes.
 *
 * @category type-level
 * @since 0.0.0
 */
export type RunScopeSupport = typeof RunScopeSupport.Type;

/**
 * Optional accounting values read from one systemd run scope.
 *
 * **Example** (Construct a telemetry sample)
 *
 * ```ts
 * import { RunScopeTelemetry } from "@beep/repo-cli/test/RepoRun"
 *
 * const telemetry = RunScopeTelemetry.make({ memoryPeakBytes: 4096, tasksPeak: 3 })
 * console.log(telemetry.memoryPeakBytes) // 4096
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RunScopeTelemetry extends S.Class<RunScopeTelemetry>($I`RunScopeTelemetry`)(
  {
    memoryPeakBytes: S.optionalKey(S.Finite),
    tasksPeak: S.optionalKey(S.Int),
  },
  $I.annote("RunScopeTelemetry", {
    description: "Optional accounting values read from one systemd run scope.",
  })
) {}

/**
 * Scope attachment and accounting state retained on an admission lease.
 *
 * **Example** (Construct an active scope record)
 *
 * ```ts
 * import { RunScopeRecord } from "@beep/repo-cli/test/RepoRun"
 *
 * const record = RunScopeRecord.make({
 *   unitName: "agent-run-d0a7b0dc.scope",
 *   support: "active",
 *   attachedPid: 1234,
 *   attachedAt: "2026-08-29T12:00:00.000Z"
 * })
 * console.log(record.support) // "active"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RunScopeRecord extends S.Class<RunScopeRecord>($I`RunScopeRecord`)(
  {
    unitName: RunScopeUnitName,
    support: RunScopeSupport,
    attachedPid: S.Int,
    attachedAt: S.String,
    memoryPeakBytes: S.optionalKey(S.Finite),
    tasksPeak: S.optionalKey(S.Int),
    warning: S.optionalKey(S.String),
  },
  $I.annote("RunScopeRecord", {
    description: "Scope attachment and optional accounting state retained on an admission lease.",
  })
) {}
