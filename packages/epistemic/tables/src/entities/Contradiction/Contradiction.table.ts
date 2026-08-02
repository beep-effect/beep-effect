/**
 * Contradiction-candidate table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { EntityTable } from "@beep/drizzle";
import {
  ContradictionCandidate,
  ContradictionDisposition,
  ContradictionReceipt,
} from "@beep/epistemic-domain/entities/Contradiction";

/**
 * PGLite/Postgres table for immutable contradiction candidates.
 *
 * The raw SQL migration owns organization-scoped candidate-key uniqueness,
 * digest checks, the tenant reference key, and append-only triggers; Drizzle
 * metadata projects the schema-first columns and generated indexes only.
 *
 * @example
 * ```ts
 * import { candidateTable } from "@beep/epistemic-tables/entities/Contradiction"
 *
 * console.log(candidateTable.definition.tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const candidateTable = EntityTable.pgTableFrom(ContradictionCandidate);

/**
 * PGLite/Postgres table for contradiction-submission receipts.
 *
 * The raw SQL migration owns the tenant-bound candidate foreign key,
 * organization-scoped receipt-key uniqueness, receipt digest check, and
 * append-only triggers.
 *
 * @example
 * ```ts
 * import { receiptTable } from "@beep/epistemic-tables/entities/Contradiction"
 *
 * console.log(receiptTable.definition.tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const receiptTable = EntityTable.pgTableFrom(ContradictionReceipt);

/**
 * PGLite/Postgres table for contradiction dispositions.
 *
 * The raw SQL migration owns the tenant-bound candidate foreign key, bounded
 * status check, and append-only triggers.
 *
 * @example
 * ```ts
 * import { dispositionTable } from "@beep/epistemic-tables/entities/Contradiction"
 *
 * console.log(dispositionTable.definition.tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const dispositionTable = EntityTable.pgTableFrom(ContradictionDisposition);
