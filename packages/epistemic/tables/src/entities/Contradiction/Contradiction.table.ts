/**
 * Contradiction-candidate table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { toPgTable } from "@beep/effect-drizzle/pg";
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
 * import { getTableName } from "drizzle-orm"
 *
 * console.log(getTableName(candidateTable))
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const candidateTable = toPgTable(ContradictionCandidate);

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
 * import { getTableName } from "drizzle-orm"
 *
 * console.log(getTableName(receiptTable))
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const receiptTable = toPgTable(ContradictionReceipt);

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
 * import { getTableName } from "drizzle-orm"
 *
 * console.log(getTableName(dispositionTable))
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const dispositionTable = toPgTable(ContradictionDisposition);
