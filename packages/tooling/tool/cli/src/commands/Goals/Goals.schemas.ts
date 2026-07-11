/**
 * Goal-packet manifest schemas (`GoalManifest` v2).
 *
 * Canonical schema surface for `goals/<slug>/ops/manifest.json`: the 5-state
 * lifecycle domain, the normalized phase-status domain, and the lenient
 * {@link GoalManifest} class whose decoder accepts every legacy wire shape
 * observed in the 2026-07-11 census (`initiative-manifest/v1`, `1.0.0`, and
 * version-less manifests) while typing exactly the fields the goals tooling
 * reads. Unknown manifest keys are ignored on decode so bespoke packet fields
 * keep their wire shape.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Goals/Goals.schemas");

/**
 * Canonical goal-packet lifecycle states.
 *
 * `active` packets are executing (and must carry a `GOAL.md` launcher),
 * `paused` packets are intentionally stopped with explicit resume conditions,
 * `completed-retained` packets shipped and remain as evidence, `superseded`
 * packets were replaced by a successor, and `reference` packets are retained
 * research or design precedent.
 *
 * @example
 * ```ts
 * import { GoalStatus } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 *
 * console.log(GoalStatus.is.active("active")) // true
 * console.log(GoalStatus.Options.length) // 5
 * ```
 * @category models
 * @since 0.0.0
 */
export const GoalStatus = LiteralKit(["active", "paused", "completed-retained", "superseded", "reference"]).pipe(
  $I.annoteSchema("GoalStatus", {
    description: "Canonical 5-state goal-packet lifecycle domain.",
  })
);

/**
 * Canonical goal-packet lifecycle state.
 *
 * @example
 * ```ts
 * import type { GoalStatusValue } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 *
 * const status: GoalStatusValue = "completed-retained"
 * console.log(status)
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type GoalStatusValue = typeof GoalStatus.Type;

/**
 * Derived guard for {@link GoalStatus}.
 *
 * @example
 * ```ts
 * import { isGoalStatus } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 *
 * console.log(isGoalStatus("paused")) // true
 * console.log(isGoalStatus("DONE")) // false
 * ```
 * @category guards
 * @since 0.0.0
 */
export const isGoalStatus = S.is(GoalStatus);

/**
 * Canonical normalized phase statuses inside a goal manifest.
 *
 * @example
 * ```ts
 * import { GoalPhaseStatus } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 *
 * console.log(GoalPhaseStatus.is.complete("complete")) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export const GoalPhaseStatus = LiteralKit(["pending", "in-progress", "complete"]).pipe(
  $I.annoteSchema("GoalPhaseStatus", {
    description: "Canonical normalized goal-phase status domain.",
  })
);

/**
 * Canonical normalized goal-phase status.
 *
 * @example
 * ```ts
 * import type { GoalPhaseStatusValue } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 *
 * const status: GoalPhaseStatusValue = "in-progress"
 * console.log(status)
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type GoalPhaseStatusValue = typeof GoalPhaseStatus.Type;

/**
 * Derived guard for {@link GoalPhaseStatus}.
 *
 * @example
 * ```ts
 * import { isGoalPhaseStatus } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 *
 * console.log(isGoalPhaseStatus("pending")) // true
 * console.log(isGoalPhaseStatus("seeded")) // false
 * ```
 * @category guards
 * @since 0.0.0
 */
export const isGoalPhaseStatus = S.is(GoalPhaseStatus);

/**
 * Known goal-manifest schema versions.
 *
 * `initiative-manifest/v2` is canonical; `initiative-manifest/v1` and `1.0.0`
 * are accepted legacy versions that surface an advisory upgrade finding in
 * `beep goals doctor`.
 *
 * @example
 * ```ts
 * import { GoalManifestSchemaVersion } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 *
 * console.log(GoalManifestSchemaVersion.is["initiative-manifest/v2"]("initiative-manifest/v2"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const GoalManifestSchemaVersion = LiteralKit(["initiative-manifest/v2", "initiative-manifest/v1", "1.0.0"]).pipe(
  $I.annoteSchema("GoalManifestSchemaVersion", {
    description: "Known goal-manifest schema versions (v2 canonical, v1 and 1.0.0 legacy).",
  })
);

/**
 * The declared completion gate of a goal packet.
 *
 * Uniform across every manifest in the census: a goal is not achieved until
 * its work ships as a PR driven to mergeable via yeet, unless the packet is
 * `grandfathered` (shipped before the gate was introduced on 2026-06-30).
 *
 * @example
 * ```ts
 * import { GoalCompletionGate } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 *
 * const gate = GoalCompletionGate.make({
 *   operator: "yeet",
 *   requiresPullRequest: true,
 *   requiresMergeable: true,
 *   statement: "Ship via yeet.",
 *   grandfathered: false,
 * })
 * console.log(gate.operator)
 * ```
 * @category models
 * @since 0.0.0
 */
export class GoalCompletionGate extends S.Class<GoalCompletionGate>($I`GoalCompletionGate`)(
  {
    operator: S.String,
    requiresPullRequest: S.Boolean,
    requiresMergeable: S.Boolean,
    statement: S.String,
    grandfathered: S.Boolean,
    grandfatheredNote: S.optionalKey(S.String),
  },
  $I.annote("GoalCompletionGate", {
    description: "Declared completion gate of a goal packet (yeet PR-to-mergeable unless grandfathered).",
  })
) {}

/**
 * The identity block of a goal manifest.
 *
 * `id` and `status` are the required core; every other field is optional so
 * legacy manifests decode. Unknown keys (for example `supersededBy` or
 * `currentPhase` on some legacy packets) are ignored.
 *
 * @example
 * ```ts
 * import { GoalInitiative } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 *
 * const initiative = GoalInitiative.make({ id: "goals-doctor", status: "active" })
 * console.log(initiative.id)
 * ```
 * @category models
 * @since 0.0.0
 */
export class GoalInitiative extends S.Class<GoalInitiative>($I`GoalInitiative`)(
  {
    id: S.String,
    status: GoalStatus,
    title: S.optionalKey(S.String),
    created: S.optionalKey(S.String),
    updated: S.optionalKey(S.String),
    packetAnchorDocument: S.optionalKey(S.String),
  },
  $I.annote("GoalInitiative", {
    description: "Goal-manifest identity block: required id and canonical status plus optional metadata.",
  })
) {}

/**
 * One phase entry inside a goal manifest.
 *
 * Phases appear both as arrays and as records keyed by phase name in legacy
 * manifests; both shapes share this entry schema. Only `status` is required.
 *
 * @example
 * ```ts
 * import { GoalPhase } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 *
 * const phase = GoalPhase.make({ status: "pending", id: "P0" })
 * console.log(phase.status)
 * ```
 * @category models
 * @since 0.0.0
 */
export class GoalPhase extends S.Class<GoalPhase>($I`GoalPhase`)(
  {
    status: GoalPhaseStatus,
    id: S.optionalKey(S.String),
    name: S.optionalKey(S.String),
    exit: S.optionalKey(S.String),
  },
  $I.annote("GoalPhase", {
    description: "One goal-manifest phase entry with a normalized status.",
  })
) {}

/**
 * Canonical goal-packet manifest (`initiative-manifest/v2`).
 *
 * The decoder is deliberately lenient: only `initiative` (id + canonical
 * status) and `completionGate` are required, matching the documented packet
 * standard, while every typed optional field accepts the post-migration wire
 * shapes. Unknown top-level keys pass through undecoded so bespoke packet
 * fields (task inventories, proof matrices, ...) never block validation.
 *
 * @example
 * ```ts
 * import { GoalManifest } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 *
 * const manifest = GoalManifest.make({
 *   initiative: { id: "goals-doctor", status: "active" },
 *   completionGate: {
 *     operator: "yeet",
 *     requiresPullRequest: true,
 *     requiresMergeable: true,
 *     statement: "Ship via yeet.",
 *     grandfathered: false,
 *   },
 * })
 * console.log(manifest.initiative.id)
 * ```
 * @category models
 * @since 0.0.0
 */
export class GoalManifest extends S.Class<GoalManifest>($I`GoalManifest`)(
  {
    initiative: GoalInitiative,
    completionGate: GoalCompletionGate,
    schemaVersion: S.optionalKey(GoalManifestSchemaVersion),
    lifecycle: S.optionalKey(GoalStatus),
    packetPath: S.optionalKey(S.String),
    executionCapable: S.optionalKey(S.Boolean),
    reflectionRequired: S.optionalKey(S.Boolean),
    mission: S.NullOr(S.String).pipe(S.optionalKey),
    statusNote: S.optionalKey(S.String),
    blockedBy: S.Array(S.String).pipe(S.optionalKey),
    supersededBy: S.optionalKey(S.String),
    supersededNote: S.optionalKey(S.String),
    claimedBy: S.optionalKey(S.String),
    claimedAt: S.optionalKey(S.String),
    discoveredFrom: S.optionalKey(S.String),
    phases: S.Union([S.Array(GoalPhase), S.Record(S.String, GoalPhase)]).pipe(S.optionalKey),
  },
  $I.annote("GoalManifest", {
    description: "Canonical goal-packet manifest with a lenient decoder for legacy wire shapes.",
  })
) {}

/**
 * Decode an unknown parsed JSON value as a {@link GoalManifest}.
 *
 * @example
 * ```ts
 * import { decodeGoalManifest } from "@beep/repo-cli/commands/Goals/Goals.schemas"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(decodeGoalManifest({})))
 * ```
 * @category decoding
 * @since 0.0.0
 */
export const decodeGoalManifest = S.decodeUnknownEffect(GoalManifest);
