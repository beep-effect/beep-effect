/**
 * Legal opposition candidate value objects.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { Principal } from "@beep/shared-domain/entity/Principal";
import * as S from "effect/Schema";
import { LegalVerdictFamily } from "../../values/LegalVerdictFamily/index.ts";

const $I = $LawPracticeDomainId.create("entities/LegalOppositionCandidate/LegalOppositionCandidate.values");

/**
 * One attorney's assignment of a verdict family to a candidate.
 *
 * **When to use**
 *
 * Use wherever a verdict family is recorded. The family never travels without
 * the person who assigned it, because "attorney-assigned" is the whole content
 * of the record: a family with no assigner behind it would read as something
 * the system worked out.
 *
 * **Details**
 *
 * Pairing the two in one value is what lets a candidate carry the assignment as
 * a single optional fact. Two separate optional fields could drift into a
 * family with no assigner, or an assigner with no family, and neither state
 * means anything.
 *
 * **Gotchas**
 *
 * Nothing derives a family. Which of rule conflict, principle collision,
 * interpretation dispute, or factual dispute a candidate belongs to is the
 * attorney's call, and only the *absence* of an assignment is derivable.
 *
 * **Example** (Record an assigned verdict family)
 *
 * ```ts
 * import { LegalVerdictAssignment } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * const assignment = S.decodeUnknownSync(LegalVerdictAssignment)({
 *   assignedBy: { component: "Runtime", kind: "System" },
 *   family: "principle-collision",
 * })
 * console.log(assignment.family) // "principle-collision"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LegalVerdictAssignment extends S.Class<LegalVerdictAssignment>($I`LegalVerdictAssignment`)(
  {
    assignedBy: Principal.annotateKey({
      description: "Principal whose assignment this is; recorded because the family is theirs, not the system's.",
    }),
    family: LegalVerdictFamily.annotateKey({
      description: "Verdict family the attorney assigned, recorded and never derived from the pair.",
    }),
  },
  $I.annote("LegalVerdictAssignment", {
    description: "One attorney's attributed assignment of a legal verdict family to an opposition candidate.",
  })
) {}
