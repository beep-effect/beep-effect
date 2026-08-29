/**
 * Legal position relator entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { Principal } from "@beep/shared-domain/entity/Principal";
import * as ProductEntity from "@beep/shared-domain/entity/ProductEntity";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import { AdvantagePositionKind } from "../../values/HohfeldPositionKind/index.ts";
import { LegalActContent } from "../../values/LegalActContent/index.ts";
import { LegalRole } from "../../values/LegalRole/index.ts";
import { LegalScopeContext } from "../../values/LegalScopeContext/index.ts";
import { SourceNormRef } from "../../values/SourceNormRef/index.ts";
import { LegalPositionGrounding } from "./LegalPositionRelator.values.ts";

const $I = $LawPracticeDomainId.create("entities/LegalPositionRelator/LegalPositionRelator.model");
const pg = ProductEntity.pg;

/**
 * One stored advantage-side legal relation between two roles.
 *
 * **When to use**
 *
 * Use to record that some norm puts one party in some position against another,
 * about some act, within some scope. Every other reading of that relation — the
 * counterparty's correlative and either party's opposite — is derived from this
 * one record and presented as a view.
 *
 * **Details**
 *
 * Exactly one relation is stored, and it is always the advantage side. The
 * correlative end is not a second record: persisting both lets one be
 * superseded while the other stands, leaving the store asserting a duty that no
 * claim backs. One stored relation makes that state unreachable rather than
 * merely discouraged.
 *
 * `positionKind` and `content` are separate fields because only a separate
 * field can carry the advantage-side narrowing, while a derived view ranges
 * over all eight kinds. They are read together as a position when a view is
 * derived, and the derivations only accept the pair.
 *
 * Every field below is required, and each answers a question a relation cannot
 * be read without: which position, held by whom against whom, about what act,
 * under which norm, arising from which exercise lineage, within which scope,
 * and on whose reading. `assertingInterpreter` is the last of those — a
 * determination with no attributed interpreter behind it is an assertion the
 * system would be making on its own account, which it never does.
 *
 * **Gotchas**
 *
 * There is no `result` field, and adding one would be a defect. A standing
 * position has no outcome; requiring one forces every record to carry a
 * placeholder that later reads as a real answer. Outcomes belong to the
 * exercise events that change positions, where they are genuinely required.
 *
 * That a relation is recorded is never a finding that it obtains in law. The
 * norm may not say what the interpreter read it to say, and nothing here
 * checks that it does.
 *
 * **Example** (Inspect the stored relation surface)
 *
 * ```ts
 * import { LegalPositionRelator } from "@beep/law-practice-domain"
 *
 * console.log(LegalPositionRelator.fields.positionKind !== undefined) // true
 * console.log(Object.hasOwn(LegalPositionRelator.fields, "result")) // false
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class LegalPositionRelator extends ProductEntity.Entity<LegalPositionRelator>()(
  LawPractice.LegalPositionRelatorId
)(
  {
    assertingInterpreter: Principal.annotateKey({
      description: "Principal whose attributed reading this relation is recorded under.",
    }).pipe(pg.jsonb(), pg.columnName("asserting_interpreter")),
    bearer: LegalRole.annotateKey({
      description: "Role holding the advantage-side position.",
    }).pipe(pg.jsonb()),
    content: LegalActContent.annotateKey({
      description: "Act the position is about, carrying the polarity the opposite derivation negates.",
    }).pipe(pg.jsonb()),
    counterparty: LegalRole.annotateKey({
      description: "Role the position is held against, whose correlative view is derived and never stored.",
    }).pipe(pg.jsonb()),
    grounding: LegalPositionGrounding.annotateKey({
      description: "Exercise lineage this relation rests on, recorded as a lineage rather than one event.",
    }).pipe(pg.jsonb()),
    positionKind: AdvantagePositionKind.annotateKey({
      description: "Stored position kind, canonicalised to the advantage side so the stored form is unique.",
    }).pipe(pg.text(), pg.columnName("position_kind")),
    scope: LegalScopeContext.annotateKey({
      description: "The five recorded axes this relation is held to apply within.",
    }).pipe(pg.jsonb()),
    sourceNorm: SourceNormRef.annotateKey({
      description: "Opaque reference to the norm this relation is recorded as resting on.",
    }).pipe(pg.jsonb(), pg.columnName("source_norm")),
  },
  $I.annote("LegalPositionRelator", {
    description: "One stored advantage-side legal relation from which every other view of it is derived.",
  })
) {}
