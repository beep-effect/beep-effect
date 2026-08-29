/**
 * Workspace Drizzle schema aggregate.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { CandidateDraft, CandidateProject, Message, Thread, Turn, Workspace } from "./entities/index.ts";

type DbSchemaShape = {
  readonly candidateDraft: typeof CandidateDraft.Table;
  readonly candidateProject: typeof CandidateProject.Table;
  readonly message: typeof Message.Table;
  readonly thread: typeof Thread.Table;
  readonly turn: typeof Turn.Table;
  readonly workspace: typeof Workspace.Table;
};

/**
 * Metadata-only workspace Drizzle schema aggregate.
 *
 * **Example** (Read table and storage kinds)
 *
 * ```ts
 * import { DbSchema } from "@beep/workspace-tables"
 *
 * console.log(DbSchema.message)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const DbSchema: DbSchemaShape = {
  candidateDraft: CandidateDraft.Table,
  candidateProject: CandidateProject.Table,
  message: Message.Table,
  thread: Thread.Table,
  turn: Turn.Table,
  workspace: Workspace.Table,
};

/**
 * Type for {@link DbSchema}.
 *
 * **Example** (Type DbSchema and read turn)
 *
 * ```ts
 * import { DbSchema, type DbSchema as DbSchemaType } from "@beep/workspace-tables"
 *
 * const schema: DbSchemaType = DbSchema
 * console.log(schema.turn)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export type DbSchema = DbSchemaShape;
