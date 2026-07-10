/**
 * Workspace entity table namespaces.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * CandidateDraft table metadata namespace.
 *
 * @example
 * ```ts
 * import { CandidateDraft } from "@beep/workspace-tables/entities"
 *
 * console.log(CandidateDraft.Table.definition.tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * as CandidateDraft from "./CandidateDraft/index.ts";
/**
 * CandidateProject table metadata namespace.
 *
 * @example
 * ```ts
 * import { CandidateProject } from "@beep/workspace-tables/entities"
 *
 * console.log(CandidateProject.Table.definition.tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * as CandidateProject from "./CandidateProject/index.ts";
/**
 * Message table metadata namespace.
 *
 * @example
 * ```ts
 * import { Message } from "@beep/workspace-tables/entities"
 *
 * console.log(Message.Table.definition.tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * as Message from "./Message/index.ts";
/**
 * Thread table metadata namespace.
 *
 * @example
 * ```ts
 * import { Thread } from "@beep/workspace-tables/entities"
 *
 * console.log(Thread.Table.definition.tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * as Thread from "./Thread/index.ts";
/**
 * Turn table metadata namespace.
 *
 * @example
 * ```ts
 * import { Turn } from "@beep/workspace-tables/entities"
 *
 * console.log(Turn.Table.definition.tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * as Turn from "./Turn/index.ts";
/**
 * Workspace table metadata namespace.
 *
 * @category tables
 * @since 0.0.0
 */
export * as Workspace from "./Workspace/index.ts";
