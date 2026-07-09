/**
 * Workspace table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { EntityTable } from "@beep/drizzle";
import { Workspace } from "@beep/workspace-domain/entities/Workspace";

/**
 * Workspace persistence table.
 *
 * @category tables
 * @since 0.0.0
 */
export const Table = EntityTable.pgTableFrom(Workspace);
