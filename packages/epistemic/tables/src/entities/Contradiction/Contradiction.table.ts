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
 * **Details**
 *
 * The raw SQL migration owns organization-scoped candidate-key uniqueness,
 * digest checks, the tenant reference key, and append-only triggers; Drizzle
 * metadata projects the schema-first columns and generated indexes only.
 *
 * **Example** (Log candidate table name)
 *
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
 * **Details**
 *
 * The raw SQL migration owns the tenant-bound candidate foreign key,
 * organization-scoped receipt-key uniqueness, receipt digest check, and
 * append-only triggers.
 *
 * **Example** (Log receipt table name)
 *
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
 * **Details**
 *
 * The raw SQL migration owns the tenant-bound candidate foreign key, bounded
 * status check, and append-only triggers.
 *
 * **Example** (Log disposition table name)
 *
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
