/**
 * Live shared membership and workspace ownership reads for vault sync.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import { $DocumentsServerId } from "@beep/identity/packages";
import * as Membership from "@beep/shared-domain/entities/Membership";
import { WorkspaceId } from "@beep/shared-domain/identity/Workspace";
import { Membership as MembershipTable } from "@beep/shared-tables/entities";
import { getTableName } from "drizzle-orm";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";

const $I = $DocumentsServerId.create("aggregates/Sync/VaultSyncSession.repository");
const Grants = S.Array(S.Struct({ role: Membership.Role, status: Membership.Status }));

/**
 * The narrow live-read boundary; permission is never cached with a session.
 *
 * **Example** (Inspect membership boundary)
 * ```ts
 * import { VaultSyncMembership } from "@beep/documents-server/aggregates/Sync";
 * console.log(VaultSyncMembership.key);
 * ```
 * @category services
 * @since 0.0.0
 */
export class VaultSyncMembership extends Context.Service<
  VaultSyncMembership,
  {
    readonly read: (
      userId: number,
      scope: V.VaultSyncScope
    ) => Effect.Effect<ReadonlyArray<V.VaultSyncGrant>, V.ScopeDenied>;
  }
>()($I`VaultSyncMembership`) {}

/**
 * Reads the owning shared membership table and checks workspace ownership each time.
 *
 * **Details**
 *
 * Only active, undeleted rows grant access; an owner role carries the diagnostics grant that
 * OperationQueue requires. A failed read denies; nothing is cached between calls.
 *
 * **Example** (Inspect live repository)
 * ```ts
 * import { VaultSyncMembershipLive } from "@beep/documents-server/aggregates/Sync";
 * void VaultSyncMembershipLive;
 * ```
 * @category layers
 * @since 0.0.0
 */
export const VaultSyncMembershipLive = Layer.effect(
  VaultSyncMembership,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    return VaultSyncMembership.of({
      read: Effect.fn("VaultSyncMembership.read")(function* (userId, scope) {
        const rows = yield* sql`SELECT m.role, m.status FROM ${sql(getTableName(MembershipTable.Table))} m
        JOIN ${sql(WorkspaceId.tableName)} w ON w.org_id = m.org_id
        WHERE m.user_id = ${userId} AND m.org_id = ${scope.orgId}
          AND w.id = ${scope.workspaceId} AND m.status = 'active' AND m.deleted_at IS NULL`.pipe(
          Effect.flatMap(S.decodeUnknownEffect(Grants)),
          Effect.mapError(() => V.ScopeDenied.make({}))
        );
        return A.map(rows, (row) =>
          V.VaultSyncGrant.make({
            ...scope,
            diagnostic: row.role === "owner",
          })
        );
      }),
    });
  })
);
