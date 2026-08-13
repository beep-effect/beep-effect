/**
 * Epistemic entity table namespaces.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * CandidateClaim table metadata namespace.
 *
 * **Example** (Log CandidateClaim table name)
 *
 * ```ts
 * import { CandidateClaim } from "@beep/epistemic-tables/entities"
 *
 * console.log(CandidateClaim.Table.definition.tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * as CandidateClaim from "./CandidateClaim/index.ts";
/**
 * ClaimDisposition table metadata namespace.
 *
 * **Example** (Log ClaimDisposition table name)
 *
 * ```ts
 * import { ClaimDisposition } from "@beep/epistemic-tables/entities"
 *
 * console.log(ClaimDisposition.Table.definition.tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * as ClaimDisposition from "./ClaimDisposition/index.ts";
/**
 * Contradiction table metadata namespace.
 *
 * **Example** (Log Contradiction candidate table)
 *
 * ```ts
 * import { Contradiction } from "@beep/epistemic-tables/entities"
 *
 * console.log(Contradiction.candidateTable.definition.tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * as Contradiction from "./Contradiction/index.ts";
/**
 * EdgeVersion table metadata namespace.
 *
 * **Example** (Log EdgeVersion table name)
 *
 * ```ts
 * import { EdgeVersion } from "@beep/epistemic-tables/entities"
 *
 * console.log(EdgeVersion.Table.definition.tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * as EdgeVersion from "./EdgeVersion/index.ts";
/**
 * Evidence table metadata namespace.
 *
 * **Example** (Log Evidence table name)
 *
 * ```ts
 * import { Evidence } from "@beep/epistemic-tables/entities"
 *
 * console.log(Evidence.Table.definition.tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * as Evidence from "./Evidence/index.ts";
/**
 * EvidenceVerification table metadata namespace.
 *
 * **Example** (Log EvidenceVerification table name)
 *
 * ```ts
 * import { EvidenceVerification } from "@beep/epistemic-tables/entities"
 *
 * console.log(EvidenceVerification.Table.definition.tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * as EvidenceVerification from "./EvidenceVerification/index.ts";
/**
 * UsageRecord table metadata namespace.
 *
 * **Example** (Log UsageRecord table name)
 *
 * ```ts
 * import { UsageRecord } from "@beep/epistemic-tables/entities"
 *
 * console.log(UsageRecord.TABLE_NAME)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * as UsageRecord from "./UsageRecord/index.ts";
