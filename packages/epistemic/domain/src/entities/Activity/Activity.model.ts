/**
 * Activity entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { EpistemicFixtureKey } from "@beep/epistemic-domain/values";
import { $EpistemicDomainId } from "@beep/identity/packages";
import { UnknownRecord } from "@beep/schema";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import * as Epistemic from "@beep/shared-domain/identity/Epistemic";

const $I = $EpistemicDomainId.create("entities/Activity/Activity.model");
const pg = ProductEntity.pg;

/**
 * Provenance activity captured for an epistemic runtime proof.
 *
 * **Example** (Decoding Activity from data)
 *
 * ```ts
 * import { Activity } from "@beep/epistemic-domain"
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 * import * as S from "effect/Schema"
 *
 * const activity = S.decodeUnknownSync(Activity)({
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: Epistemic.ActivityId.entityType,
 *   fixtureKey: "runtime-proof:turn-1",
 *   id: 1,
 *   orgId: 1,
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   snapshot: { status: "completed" },
 *   source: "System",
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" }
 * })
 *
 * console.log(activity.fixtureKey)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class Activity extends ProductEntity.Entity<Activity>()(Epistemic.ActivityId)(
  {
    fixtureKey: EpistemicFixtureKey.annotateKey({
      description: "Stable fixture key for the provenance activity.",
    }).pipe(pg.text(), pg.columnName("fixture_key")),
    snapshot: UnknownRecord.pipe(pg.jsonb()),
  },
  $I.annote("Activity", {
    description: "Provenance activity produced by the runtime proof.",
  })
) {}
