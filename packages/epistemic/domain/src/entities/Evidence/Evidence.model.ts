/**
 * Evidence entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { EpistemicFixtureKey, EvidenceSpan } from "@beep/epistemic-domain/values";
import { $EpistemicDomainId } from "@beep/identity/packages";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { BaseEntity } from "@beep/shared-domain/entity/BaseEntity";
import * as Epistemic from "@beep/shared-domain/identity/Epistemic";

const $I = $EpistemicDomainId.create("entities/Evidence/Evidence.model");

/**
 * Source span evidence reference. Carries the ported v3 {@link EvidenceSpan}
 * char-offset primitive (`startChar`/`endChar`/`quote`/`confidence`) alongside
 * its existing fixture-key refs; the span is persisted as a JSONB column so the
 * fractional `confidence` survives (there is no float storage kind).
 *
 * @example
 * ```ts
 * import { Evidence } from "@beep/epistemic-domain"
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 * import * as S from "effect/Schema"
 *
 * const evidence = S.decodeUnknownSync(Evidence)({
 *   artifactFixtureKey: "artifact:oa-1",
 *   createdAt: 1,
 *   createdByPrincipal: { kind: "System", component: "Runtime" },
 *   entityType: Epistemic.EvidenceId.entityType,
 *   id: 1,
 *   orgId: 1,
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "Agent",
 *   span: {
 *     confidence: 0.92,
 *     endChar: 57,
 *     quote: "a processor configured to receive sensor data",
 *     startChar: 12
 *   },
 *   spanFixtureKey: "span:oa-1:12-57",
 *   updatedAt: 1,
 *   updatedByPrincipal: { kind: "System", component: "Runtime" }
 * })
 *
 * console.log(evidence.span.quote)
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class Evidence extends BaseEntity.Class<Evidence>($I`Evidence`)(
  Epistemic.EvidenceId,
  {
    fields: {
      artifactFixtureKey: EpistemicFixtureKey.annotateKey({
        description: "Stable fixture key for the source artifact.",
      }),
      spanFixtureKey: EpistemicFixtureKey.annotateKey({
        description: "Stable fixture key for the evidence span.",
      }),
      span: EvidenceSpan.annotateKey({ description: "Char-offset evidence span persisted with the evidence row." }),
    },
    persisted: {
      artifactFixtureKey: EntitySchema.persist.text({
        columnName: "artifact_fixture_key",
      }),
      spanFixtureKey: EntitySchema.persist.text({
        columnName: "span_fixture_key",
      }),
      span: EntitySchema.persist.jsonb({
        columnName: "span",
      }),
    },
  },
  $I.annote("Evidence", {
    description: "Source span evidence reference.",
  })
) {}
