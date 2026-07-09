/**
 * Workspace row converters.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

import { Workspace } from "@beep/workspace-domain/entities/Workspace";
import * as S from "effect/Schema";
import type { Table } from "./Workspace.table.ts";

/**
 * Workspace table select row type.
 *
 * @category tables
 * @since 0.0.0
 */
export type WorkspaceRow = typeof Table.$inferSelect;

/**
 * Workspace table insert row type.
 *
 * @category tables
 * @since 0.0.0
 */
export type WorkspaceInsert = typeof Table.$inferInsert;

const encodeWorkspace = S.encodeSync(Workspace);
const decodeWorkspaceRow = S.decodeUnknownSync(Workspace);

/**
 * Converts a workspace domain model into a table insert row.
 *
 * @category tables
 * @since 0.0.0
 */
export const toWorkspaceInsert = (workspace: Workspace): WorkspaceInsert => {
  const encoded = encodeWorkspace(workspace);

  return {
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
  } satisfies WorkspaceInsert;
};

/**
 * Converts a workspace table row into the workspace domain model.
 *
 * @category tables
 * @since 0.0.0
 */
export const fromWorkspaceRow = (row: WorkspaceRow): Workspace => decodeWorkspaceRow(row);
