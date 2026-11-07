/**
 * Schema-first models for the authored fleet registry and its joined views.
 *
 * The registry authors only what git cannot derive: a checkout's seat role,
 * owning seat, drain status and retention exemption. Lane, branch, PR and
 * session state are never authored here; the joined view reads them from the
 * session ledger's latest row for the checkout.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { SessionLedgerRow, SessionLedgerState } from "../../Session/Session.schemas.ts";
import { FleetCheckout, FleetCheckoutKind, FleetLiveness, FleetSnapshot } from "../Worktree.schemas.ts";
import { ConfiguredFleetRoots } from "./FleetRoots.schemas.ts";

const $I = $RepoCliId.create("commands/Worktree/internal/FleetRegistry.schemas");

/**
 * Workload-named seat roles.
 *
 * **Details**
 *
 * `main` is the operator's editor seat, `ops` runs timers, and `review`,
 * `research` and `impl` scope kinds of agent work to a clone. `legacy` and
 * `adopted` are written by the scan: `legacy` for an origin-matched clone in a
 * legacy root, `adopted` for every other checkout seen without a row. An
 * explicit `fleet register` replaces either and survives every rescan.
 *
 * **Example** (Recognize a workload role)
 *
 * ```ts
 * import { FleetSeatRole } from "@beep/repo-cli/test/Worktree"
 *
 * console.log(FleetSeatRole.is.review("review")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FleetSeatRole = LiteralKit(["main", "ops", "review", "research", "impl", "legacy", "adopted"]).pipe(
  $I.annoteSchema("FleetSeatRole", {
    description: "Workload-named role of a fleet checkout; legacy and adopted are written by the scan.",
  })
);

/**
 * Workload-named role of a fleet checkout.
 *
 * @category type-level
 * @since 0.0.0
 */
export type FleetSeatRole = typeof FleetSeatRole.Type;

/**
 * Drain lifecycle of a checkout.
 *
 * **Example** (The default status)
 *
 * ```ts
 * import { FleetDrainStatus } from "@beep/repo-cli/test/Worktree"
 *
 * console.log(FleetDrainStatus.Enum.active) // "active"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FleetDrainStatus = LiteralKit(["active", "draining", "retired"]).pipe(
  $I.annoteSchema("FleetDrainStatus", {
    description: "Drain lifecycle of a fleet checkout; written by legacy-drain, default active.",
  })
);

/**
 * Drain lifecycle of a checkout.
 *
 * @category type-level
 * @since 0.0.0
 */
export type FleetDrainStatus = typeof FleetDrainStatus.Type;

/**
 * One authored registry row, keyed by the checkout's absolute path.
 *
 * **Details**
 *
 * A hand-authored row may omit `owningSeat`, `drainStatus` and
 * `retentionExempt`; decoding fills `null`, `active` and `false`.
 *
 * **Example** (Decode a minimal hand-authored row)
 *
 * ```ts
 * import { FleetRegistryRow } from "@beep/repo-cli/test/Worktree"
 * import * as S from "effect/Schema"
 *
 * const row = S.decodeUnknownSync(FleetRegistryRow)({ checkout: "/fleet/seats/main", seatRole: "main" })
 * console.log(row.drainStatus, row.retentionExempt) // "active" false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetRegistryRow extends S.Opaque<FleetRegistryRow, { readonly brand: unique symbol }>()(
  S.Struct({
    checkout: S.String,
    seatRole: FleetSeatRole,
    owningSeat: S.NullOr(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(null)),
      S.withDecodingDefaultKey(Effect.succeed(null))
    ),
    drainStatus: FleetDrainStatus.pipe(
      S.withConstructorDefault(Effect.succeed(FleetDrainStatus.Enum.active)),
      S.withDecodingDefaultKey(Effect.succeed(FleetDrainStatus.Enum.active))
    ),
    retentionExempt: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultKey(Effect.succeed(false))
    ),
  }).pipe(
    $I.annoteSchema("FleetRegistryRow", {
      description: "Authored facts for one fleet checkout: seat role, owning seat, drain status, retention exemption.",
    })
  )
) {}

/**
 * The authored `registry.json` document: rows sorted by checkout path.
 *
 * **Example** (An empty registry)
 *
 * ```ts
 * import { FleetRegistryDocument } from "@beep/repo-cli/test/Worktree"
 *
 * console.log(FleetRegistryDocument.make({ schemaVersion: "fleet-registry/v1", rows: [] }).rows.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetRegistryDocument extends S.Opaque<FleetRegistryDocument, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("fleet-registry/v1"),
    rows: S.Array(FleetRegistryRow),
  }).pipe(
    $I.annoteSchema("FleetRegistryDocument", {
      description: "Per-repository authored fleet registry, one row per checkout path.",
    })
  )
) {}

/**
 * One compact `fleet --join` row: mirror facts beside registry facts and the
 * session ledger's latest `lane`, `pr` and `state`.
 *
 * **Example** (A checkout with no ledger history)
 *
 * ```ts
 * import { FleetJoinedRow } from "@beep/repo-cli/test/Worktree"
 *
 * const row = FleetJoinedRow.make({
 *   path: "/fleet/beep-effect0",
 *   kind: "clone",
 *   branch: "main",
 *   liveness: "dormant",
 *   dirtyCount: 0,
 *   seatRole: "legacy",
 *   owningSeat: null,
 *   drainStatus: "active",
 *   retentionExempt: false,
 *   lane: null,
 *   pr: null,
 *   state: null,
 * })
 * console.log(row.seatRole) // "legacy"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetJoinedRow extends S.Opaque<FleetJoinedRow, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.String,
    kind: FleetCheckoutKind,
    branch: S.NullOr(S.String),
    liveness: FleetLiveness,
    dirtyCount: S.NullOr(S.Finite),
    seatRole: FleetSeatRole,
    owningSeat: S.NullOr(S.String),
    drainStatus: FleetDrainStatus,
    retentionExempt: S.Boolean,
    lane: S.NullOr(S.String),
    pr: S.NullOr(S.Finite),
    state: S.NullOr(SessionLedgerState),
  }).pipe(
    $I.annoteSchema("FleetJoinedRow", {
      description: "Compact joined fleet row: mirror facts, registry facts and the latest session-ledger facts.",
    })
  )
) {}

/**
 * The `fleet describe <checkout>` expansion of one joined row.
 *
 * **Example** (A description is built from the mirror row, registry row and ledger tail)
 *
 * ```ts
 * import { FleetCheckoutDescription } from "@beep/repo-cli/test/Worktree"
 *
 * console.log(typeof FleetCheckoutDescription.make) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetCheckoutDescription extends S.Opaque<FleetCheckoutDescription, { readonly brand: unique symbol }>()(
  S.Struct({
    checkout: FleetCheckout,
    registry: FleetRegistryRow,
    ledger: S.Array(SessionLedgerRow),
  }).pipe(
    $I.annoteSchema("FleetCheckoutDescription", {
      description: "Full mirror record, registry row and latest session-ledger rows for one fleet checkout.",
    })
  )
) {}

/**
 * One checkout the scan saw, with the role adoption would give it.
 *
 * **Example** (A lane owned by a seat)
 *
 * ```ts
 * import { FleetAdoptionCandidate } from "@beep/repo-cli/test/Worktree"
 *
 * const candidate = FleetAdoptionCandidate.make({
 *   checkout: "/p/beep/lanes/x",
 *   role: "adopted",
 *   owningSeat: "/p/beep/seats/main",
 * })
 * console.log(candidate.role) // "adopted"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetAdoptionCandidate extends S.Opaque<FleetAdoptionCandidate, { readonly brand: unique symbol }>()(
  S.Struct({
    checkout: S.String,
    role: FleetSeatRole,
    owningSeat: S.NullOr(S.String),
  }).pipe(
    $I.annoteSchema("FleetAdoptionCandidate", {
      description: "A scanned checkout with the seat role and owning seat adoption would record for it.",
    })
  )
) {}

/**
 * Everything the joined views read from one scan: the roots, the mirror
 * snapshot, the persisted registry, the rows this scan adopted, and the
 * repository's session-ledger rows.
 *
 * **Example** (Reference the model)
 *
 * ```ts
 * import { FleetJoin } from "@beep/repo-cli/test/Worktree"
 *
 * console.log(typeof FleetJoin.make) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetJoin extends S.Opaque<FleetJoin, { readonly brand: unique symbol }>()(
  S.Struct({
    roots: ConfiguredFleetRoots,
    snapshot: FleetSnapshot,
    registry: FleetRegistryDocument,
    adopted: S.Array(FleetRegistryRow),
    ledger: S.Array(SessionLedgerRow),
  }).pipe(
    $I.annoteSchema("FleetJoin", {
      description: "Roots, mirror snapshot, persisted registry, adopted rows and ledger rows read by one joined scan.",
    })
  )
) {}
