/**
 * Epistemic Evidence table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { toPgTable } from "@beep/effect-drizzle/pg";
import { EpistemicFixtureKey } from "@beep/epistemic-domain/values";
import { Confidence } from "@beep/epistemics/Confidence";
import { EvidencePosition } from "@beep/epistemics/EvidencePosition.schema";
import { $EpistemicTablesId } from "@beep/identity/packages";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import * as Epistemic from "@beep/shared-domain/identity/Epistemic";
import * as S from "effect/Schema";

const $I = $EpistemicTablesId.create("entities/Evidence/Evidence.table");
const pg = ProductEntity.pg;
class FrozenPosition extends S.Opaque<FrozenPosition, { readonly brand: unique symbol }>()(
  S.Struct({
    confidence: Confidence,
    endChar: S.Natural,
    quote: S.String,
    startChar: S.Natural,
  }).pipe(
    $I.annoteSchema("FrozenPosition", {
      description: "Frozen pre-v2 evidence position payload, retaining inconsistent widths and empty quotes.",
    })
  )
) {}

const StoredPosition = S.Union([EvidencePosition, FrozenPosition]).pipe(
  $I.annoteSchema("StoredPosition", { description: "Current and frozen evidence JSON column formats." })
);
class StoredEvidence extends ProductEntity.Entity<StoredEvidence>()(Epistemic.EvidenceId)(
  {
    artifactFixtureKey: EpistemicFixtureKey.pipe(pg.text(), pg.columnName("artifact_fixture_key")),
    spanFixtureKey: EpistemicFixtureKey.pipe(pg.text(), pg.columnName("span_fixture_key")),
    span: StoredPosition.pipe(pg.jsonb()),
  },
  $I.annote("StoredEvidence", { description: "Persistence row with explicitly versioned evidence column formats." })
) {}

/**
 * PGLite/Postgres Drizzle table for the epistemic Evidence entity.
 *
 * **Example** (Log Evidence table name)
 *
 * ```ts
 * import { Evidence } from "@beep/epistemic-tables/entities"
 * import { getTableName } from "drizzle-orm"
 *
 * console.log(getTableName(Evidence.Table))
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const Table = toPgTable(StoredEvidence);
