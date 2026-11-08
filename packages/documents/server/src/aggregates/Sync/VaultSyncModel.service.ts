/**
 * Hosting services the vault-sync Model needs from its host: ownership, provenance, roots.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import { BoxMirrorUnavailable } from "@beep/documents-use-cases/aggregates/VaultSync";
import { $DocumentsServerId } from "@beep/identity/packages";
import { SystemPrincipal } from "@beep/shared-domain/entity/Principal";
import * as Shared from "@beep/shared-domain/identity/Shared";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";
import { VaultSyncRoot } from "./BoxMirror.ts";
import { LegacySyncAudit } from "./LegacySync.projection.ts";
import { workspaceDestinationId } from "./SyncGenesis.service.ts";

const $I = $DocumentsServerId.create("aggregates/Sync/VaultSyncModel.service");

/**
 * Authoritative organization ownership of a workspace.
 *
 * **Details**
 *
 * The desktop sidecar hosts a single local organization; a multi-tenant host
 * resolves it from its workspace directory. Never infer it from legacy rows,
 * whose `org_id` was hard-coded.
 *
 * **Example** (Provide a single-organization owner)
 *
 * ```ts
 * import { VaultSyncOwnership } from "@beep/documents-server/aggregates/Sync"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const ownership = Layer.succeed(VaultSyncOwnership, { orgOf: () => Effect.succeed(1) })
 * void ownership
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class VaultSyncOwnership extends Context.Service<
  VaultSyncOwnership,
  { readonly orgOf: (workspaceId: number) => Effect.Effect<number> }
>()($I`VaultSyncOwnership`) {}

/**
 * Box mirror root folder name shared by genesis naming and new destinations.
 *
 * **Example** (Provide the mirror root name)
 *
 * ```ts
 * import { VaultSyncMirrorRoot } from "@beep/documents-server/aggregates/Sync"
 * import * as Layer from "effect/Layer"
 *
 * const root = Layer.succeed(VaultSyncMirrorRoot, { name: "beep-vault" })
 * void root
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class VaultSyncMirrorRoot extends Context.Service<VaultSyncMirrorRoot, { readonly name: string }>()(
  $I`VaultSyncMirrorRoot`
) {}

const encodePrincipal = S.encodeEffect(S.fromJsonString(SystemPrincipal));
const systemPrincipal = encodePrincipal(SystemPrincipal.make({ component: "Sync", kind: "System" })).pipe(Effect.orDie);
const migrationPrincipal = encodePrincipal(SystemPrincipal.make({ component: "Migration", kind: "System" })).pipe(
  Effect.orDie
);

const EventProvenance = S.Array(S.Struct({ principal: S.NullOr(S.String), source_kind: S.NullOr(S.String) }));
const Ownership = S.Array(S.Struct({ workspace_id: S.Int }));

/**
 * Production {@link LegacySyncAudit}: provenance from the stored event row and
 * ownership from the owning destination.
 *
 * **Details**
 *
 * The principal and source columns come from the event the projection is
 * applying, falling back to the Sync system principal when a command carried
 * no request context. The workspace is the destination's; the organization is
 * {@link VaultSyncOwnership}'s. Genesis import streams resolve to the
 * Migration system principal and the workspace named in the stream.
 *
 * **Example** (Inspect the layer)
 *
 * ```ts
 * import { LegacySyncAuditLive } from "@beep/documents-server/aggregates/Sync"
 *
 * void LegacySyncAuditLive
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const LegacySyncAuditLive = Layer.effect(
  LegacySyncAudit,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const ownership = yield* VaultSyncOwnership;
    const fallback = yield* systemPrincipal;
    const migration = yield* migrationPrincipal;
    const genesisWorkspace = Effect.fnUntraced(function* (stream: string) {
      const workspaceId = pipe(Str.split(stream, "/"), A.get(2), O.flatMap(S.decodeUnknownOption(S.FiniteFromString)));
      const id = O.getOrElse(workspaceId, () => 0);
      const orgId = yield* ownership.orgOf(id);
      return { orgId, workspaceId: id, principal: migration, source: "System" };
    });
    const live = Effect.fnUntraced(function* (stream: string, seq: number) {
      const events = yield* sql`SELECT principal, source_kind FROM alchemy_aggregate_event
        WHERE model = 'VaultSync' AND aggregate || '/' || id = ${stream} AND seq = ${seq}`.pipe(
        Effect.flatMap(S.decodeUnknownEffect(EventProvenance))
      );
      const owner = yield* sql`WITH source AS (
          SELECT aggregate, id, state FROM alchemy_aggregate_instance
          WHERE model = 'VaultSync' AND aggregate || '/' || id = ${stream}),
        destination AS (
          SELECT CASE source.aggregate
            WHEN 'SyncDestination' THEN source.id
            WHEN 'SyncItem' THEN source.state -> 'observation' ->> 'destinationId'
            WHEN 'SyncOperation' THEN source.state -> 'input' ->> 'destinationId'
            ELSE source.state ->> 'destinationId' END AS id FROM source)
        SELECT (d.state ->> 'workspaceId')::int AS workspace_id FROM destination
        JOIN alchemy_aggregate_instance d
          ON d.model = 'VaultSync' AND d.aggregate = 'SyncDestination' AND d.id = destination.id`.pipe(
        Effect.flatMap(S.decodeUnknownEffect(Ownership))
      );
      const workspaceId = pipe(
        A.head(owner),
        O.map((row) => row.workspace_id),
        O.getOrElse(() => 0)
      );
      const orgId = yield* ownership.orgOf(workspaceId);
      const event = A.head(events);
      return {
        orgId,
        workspaceId,
        principal: pipe(
          event,
          O.flatMap((row) => O.fromNullOr(row.principal)),
          O.getOrElse(() => fallback)
        ),
        source: pipe(
          event,
          O.flatMap((row) => O.fromNullOr(row.source_kind)),
          O.getOrElse(() => "System")
        ),
      };
    });
    return LegacySyncAudit.of({
      resolve: Effect.fn("LegacySyncAudit.resolve")((stream, seq) =>
        (Str.startsWith("genesis/")(stream) ? genesisWorkspace(stream) : live(stream, seq)).pipe(
          // A projection cannot proceed without provenance; the driver redelivers after a defect.
          Effect.orDie
        )
      ),
    });
  })
);

/**
 * Authorized vault root of a workspace, from the host's workspace configuration.
 *
 * **Example** (Provide a fixed root)
 *
 * ```ts
 * import { VaultSyncWorkspaceRoots } from "@beep/documents-server/aggregates/Sync"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as O from "effect/Option"
 *
 * const roots = Layer.succeed(VaultSyncWorkspaceRoots, { rootOf: () => Effect.succeed(O.some("/vault")) })
 * void roots
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class VaultSyncWorkspaceRoots extends Context.Service<
  VaultSyncWorkspaceRoots,
  { readonly rootOf: (workspaceId: number) => Effect.Effect<O.Option<string>> }
>()($I`VaultSyncWorkspaceRoots`) {}

const DestinationWorkspace = S.Array(S.Struct({ workspace_id: S.Int }));

/**
 * {@link VaultSyncRoot} that resolves a destination's workspace and asks the
 * authorized workspace configuration for its vault root on every call.
 *
 * **Details**
 *
 * A pass resumed after a restart resolves the root again; no absolute path is
 * stored in events, workflow results or sync tables. A destination without a
 * configured vault fails as a non-retryable local-root error.
 *
 * **Example** (Inspect the layer)
 *
 * ```ts
 * import { VaultSyncRootFromWorkspaceLive } from "@beep/documents-server/aggregates/Sync"
 *
 * void VaultSyncRootFromWorkspaceLive
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const VaultSyncRootFromWorkspaceLive = Layer.effect(
  VaultSyncRoot,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const roots = yield* VaultSyncWorkspaceRoots;
    const missing = () =>
      BoxMirrorUnavailable.make({
        retryable: false,
        disconnectReason: null,
        operation: "resolveRoot",
        stage: "local-root",
      });
    return VaultSyncRoot.of({
      resolve: Effect.fn($I`resolveRoot`)(function* (destinationId) {
        const rows = yield* sql`SELECT (state ->> 'workspaceId')::int AS workspace_id FROM alchemy_aggregate_instance
          WHERE model = 'VaultSync' AND aggregate = 'SyncDestination' AND id = ${destinationId}`.pipe(
          Effect.flatMap(S.decodeUnknownEffect(DestinationWorkspace)),
          Effect.mapError(missing)
        );
        const workspace = yield* Effect.fromOption(A.head(rows)).pipe(Effect.mapError(missing));
        const root = yield* roots.rootOf(workspace.workspace_id);
        return yield* Effect.fromOption(root).pipe(Effect.mapError(missing));
      }),
    });
  })
);

/**
 * Registers a workspace's Box destination once; later calls are no-ops.
 *
 * **Details**
 *
 * Reads the same workspace binding genesis records, so a workspace with legacy
 * rows keeps its imported destination and a fresh workspace mints one opaque id. The fixed command id makes a repeated
 * bootstrap harmless. Requires the Model's `SyncDestination` aggregate.
 *
 * **Example** (Prepare a bootstrap)
 *
 * ```ts
 * import { ensureLegacyBoxDestination } from "@beep/documents-server/aggregates/Sync"
 *
 * void ensureLegacyBoxDestination(1)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const ensureLegacyBoxDestination = Effect.fn($I`ensureLegacyBoxDestination`)(function* (workspaceId: number) {
  const destinations = yield* V.SyncDestination;
  const ownership = yield* VaultSyncOwnership;
  const mirrorRoot = yield* VaultSyncMirrorRoot;
  const destinationId = yield* workspaceDestinationId(workspaceId);
  const state = yield* destinations.state(destinationId);
  if (state._tag === "Registered") return destinationId;
  const orgId = yield* ownership.orgOf(workspaceId);
  yield* destinations.send(
    destinationId,
    V.RegisterDestination.make({ orgId, workspaceId, name: `${mirrorRoot.name} (${workspaceId})` }),
    { commandId: `register/${destinationId}` }
  );
  return destinationId;
});

/**
 * Seeds one active owner membership for a host's signed-in user, once.
 *
 * **Details**
 *
 * The vault-sync session adapters read grants from active, undeleted
 * `shared_membership` rows on every call and deny without one. A single-user
 * host such as the desktop sidecar seeds its signed-in user here at startup.
 * The public id is derived from the pair and the insert is skipped once that
 * row exists, so repeated startups add nothing. A row the operator
 * soft-deleted stays deleted: revocation is never undone by a restart.
 *
 * **Example** (Prepare the desktop seed)
 *
 * ```ts
 * import { ensureVaultSyncOwnerMembership } from "@beep/documents-server/aggregates/Sync"
 *
 * void ensureVaultSyncOwnerMembership(1, 1)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const ensureVaultSyncOwnerMembership = Effect.fn($I`ensureVaultSyncOwnerMembership`)(function* (
  userId: number,
  orgId: number
) {
  const sql = yield* SqlClient.SqlClient;
  const principal = yield* encodePrincipal(SystemPrincipal.make({ component: "Runtime", kind: "System" }));
  const publicId = `shared_membership_a${bytesToHex(sha256(new TextEncoder().encode(`owner/${orgId}/${userId}`)))}`;
  const at = yield* Clock.currentTimeMillis;
  yield* sql`INSERT INTO shared_membership (created_at, updated_at, created_by_principal, updated_by_principal,
      schema_version, source, org_id, role, status, user_id, entity_type, public_id)
    SELECT ${at}, ${at}, ${principal}::jsonb, ${principal}::jsonb, '0.1.0', 'System', ${orgId}, 'owner', 'active',
      ${userId}, ${Shared.MembershipId.entityType}, ${publicId}
    WHERE NOT EXISTS (SELECT 1 FROM shared_membership WHERE public_id = ${publicId})`;
});
