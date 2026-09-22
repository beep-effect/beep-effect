/**
 * Workspace row converters.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

import { Workspace } from "@beep/workspace-domain/entities/Workspace";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { WorkspaceConverterError } from "./Workspace.errors.ts";
import type { Table } from "./Workspace.table.ts";

/**
 * Workspace table select row type.
 *
 * **Example** (Assert select type match)
 *
 * ```ts
 * import type { Table, WorkspaceRow } from "@beep/workspace-tables/entities/Workspace"
 *
 * type RowMatchesTable = WorkspaceRow extends typeof Table.$inferSelect ? true : false
 * const rowMatchesTable: RowMatchesTable = true
 *
 * console.log(rowMatchesTable)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type WorkspaceRow = typeof Table.$inferSelect;

/**
 * Workspace table insert row type.
 *
 * **Example** (Assert insert type match)
 *
 * ```ts
 * import type { Table, WorkspaceInsert } from "@beep/workspace-tables/entities/Workspace"
 *
 * type InsertMatchesTable = WorkspaceInsert extends typeof Table.$inferInsert ? true : false
 * const insertMatchesTable: InsertMatchesTable = true
 *
 * console.log(insertMatchesTable)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type WorkspaceInsert = typeof Table.$inferInsert;

const encodeWorkspace = S.encodeResult(Workspace);
const decodeWorkspaceRow = S.decodeUnknownResult(Workspace);

/**
 * Converts a workspace domain model into a table insert row.
 *
 * **Example** (Convert domain to insert)
 *
 * ```ts
 * import { SystemPrincipal } from "@beep/shared-domain/entity/Principal"
 * import { Workspace } from "@beep/workspace-domain/entities/Workspace"
 * import { toWorkspaceInsert } from "@beep/workspace-tables/entities/Workspace"
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 *
 * const principal = SystemPrincipal.make({ component: "Runtime", kind: "System" })
 * const workspace = Result.getOrThrow(S.decodeUnknownResult(Workspace)({
 *   createdAt: 1,
 *   createdByPrincipal: principal,
 *   entityType: "WorkspaceWorkspace",
 *   fixtureKey: "workspace.default",
 *   id: 1,
 *   name: "Default Workspace",
 *   orgId: 1,
 *   organizationFixtureKey: "organization.default",
 *   ownerPrincipalFixtureKey: "principal.default",
 *   publicId: "workspace_workspace_a1",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "System",
 *   updatedAt: 1,
 *   updatedByPrincipal: principal,
 *   vaultRootPath: null
 * }))
 * const insert = toWorkspaceInsert(workspace)
 * console.log(Result.getOrThrow(insert).name)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const toWorkspaceInsert = (workspace: Workspace): Result.Result<WorkspaceInsert, WorkspaceConverterError> =>
  Result.mapError(
    Result.map(
      encodeWorkspace(workspace),
      (encoded): WorkspaceInsert => ({
        createdAt: encoded.createdAt,
        createdByPrincipal: encoded.createdByPrincipal,
        entityType: encoded.entityType,
        fixtureKey: encoded.fixtureKey,
        name: encoded.name,
        orgId: encoded.orgId,
        organizationFixtureKey: encoded.organizationFixtureKey,
        ownerPrincipalFixtureKey: encoded.ownerPrincipalFixtureKey,
        publicId: encoded.publicId,
        rowVersion: encoded.rowVersion,
        schemaVersion: encoded.schemaVersion,
        source: encoded.source,
        updatedAt: encoded.updatedAt,
        updatedByPrincipal: encoded.updatedByPrincipal,
        vaultRootPath: encoded.vaultRootPath,
      })
    ),
    WorkspaceConverterError.fromSchemaError
  );

/**
 * Converts a workspace table row into the workspace domain model.
 *
 * **Example** (Convert row to domain)
 *
 * ```ts
 * import { SystemPrincipal } from "@beep/shared-domain/entity/Principal"
 * import { fromWorkspaceRow } from "@beep/workspace-tables/entities/Workspace"
 * import type { WorkspaceRow } from "@beep/workspace-tables/entities/Workspace"
 * import * as Result from "effect/Result"
 *
 * const principal = SystemPrincipal.make({ component: "Runtime", kind: "System" })
 * const row = {
 *   createdAt: 1,
 *   createdByPrincipal: principal,
 *   entityType: "WorkspaceWorkspace",
 *   fixtureKey: "workspace.default",
 *   id: 1,
 *   name: "Default Workspace",
 *   orgId: 1,
 *   organizationFixtureKey: "organization.default",
 *   ownerPrincipalFixtureKey: "principal.default",
 *   publicId: "workspace_workspace_a1",
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "System",
 *   updatedAt: 1,
 *   updatedByPrincipal: principal,
 *   vaultRootPath: null
 * } satisfies WorkspaceRow
 *
 * const workspace = fromWorkspaceRow(row)
 * console.log(Result.getOrThrow(workspace).name)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const fromWorkspaceRow = (row: WorkspaceRow): Result.Result<Workspace, WorkspaceConverterError> =>
  Result.mapError(decodeWorkspaceRow(row), WorkspaceConverterError.fromSchemaError);
