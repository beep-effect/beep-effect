/**
 * Workspace entity table namespaces.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * CandidateDraft table metadata namespace.
 *
 * **Example** (Log CandidateDraft table name)
 *
 * ```ts
 * import { CandidateDraft } from "@beep/workspace-tables/entities"
 *
 * console.log(CandidateDraft.TABLE_NAME)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * as CandidateDraft from "./CandidateDraft/index.ts";
/**
 * CandidateProject table metadata namespace.
 *
 * **Example** (Log CandidateProject table name)
 *
 * ```ts
 * import { CandidateProject } from "@beep/workspace-tables/entities"
 *
 * console.log(CandidateProject.TABLE_NAME)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * as CandidateProject from "./CandidateProject/index.ts";
/**
 * Message table metadata namespace.
 *
 * **Example** (Log Message table name)
 *
 * ```ts
 * import { Message } from "@beep/workspace-tables/entities"
 *
 * console.log(Message.TABLE_NAME)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * as Message from "./Message/index.ts";
/**
 * Thread table metadata namespace.
 *
 * **Example** (Log Thread table name)
 *
 * ```ts
 * import { Thread } from "@beep/workspace-tables/entities"
 *
 * console.log(Thread.TABLE_NAME)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * as Thread from "./Thread/index.ts";
/**
 * Turn table metadata namespace.
 *
 * **Example** (Log Turn table name)
 *
 * ```ts
 * import { Turn } from "@beep/workspace-tables/entities"
 *
 * console.log(Turn.TABLE_NAME)
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
