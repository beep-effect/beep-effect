/**
 * Activity entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { EpistemicFixtureKey } from "@beep/epistemic-domain/values";
import { $EpistemicDomainId } from "@beep/identity/packages";
import { UnknownRecord } from "@beep/schema";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { BaseEntity } from "@beep/shared-domain/entity/BaseEntity";
import * as Epistemic from "@beep/shared-domain/identity/Epistemic";

const $I = $EpistemicDomainId.create("entities/Activity/Activity.model");

/**
 * Provenance activity captured for an epistemic runtime proof.
 *
 * @example
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
export class Activity extends BaseEntity.Class<Activity>($I`Activity`)(
  Epistemic.ActivityId,
  {
    fields: {
      fixtureKey: EpistemicFixtureKey.annotateKey({
        description: "Stable fixture key for the provenance activity.",
      }),
      snapshot: UnknownRecord,
    },
    persisted: {
      fixtureKey: EntitySchema.persist.text({
        columnName: "fixture_key",
      }),
      snapshot: EntitySchema.persist.jsonb({
        columnName: "snapshot",
      }),
    },
  },
  $I.annote("Activity", {
    description: "Provenance activity produced by the runtime proof.",
  })
) {}
