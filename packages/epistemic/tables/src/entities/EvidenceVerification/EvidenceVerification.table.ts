/**
 * Epistemic EvidenceVerification table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { toPgTable } from "@beep/effect-drizzle/pg";
import { EvidenceVerification } from "@beep/epistemic-domain/entities/EvidenceVerification";

/**
 * PGLite/Postgres Drizzle table for immutable evidence verification rows.
 *
 * **Details**
 *
 * The raw SQL migration owns the evidence foreign key, append-only trigger, and
 * unique `(org_id, manifestation_key)` constraint; Drizzle metadata projects
 * the schema-first column shape only.
 *
 * **Example** (Log table definition name)
 *
 * ```ts
 * import { EvidenceVerification } from "@beep/epistemic-tables/entities"
 * import { getTableName } from "drizzle-orm"
 *
 * console.log(getTableName(EvidenceVerification.Table))
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const Table = toPgTable(EvidenceVerification);
