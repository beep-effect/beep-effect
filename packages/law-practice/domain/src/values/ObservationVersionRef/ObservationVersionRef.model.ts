/**
 * Version-exact reference to one recorded patent-citation observation.
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { SourceTextDigest } from "@beep/provenance/SourceTextIdentity";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import * as S from "effect/Schema";

const $I = $LawPracticeDomainId.create("values/ObservationVersionRef/ObservationVersionRef.model");

/**
 * Names one exact observation: which event, and which version it carried.
 *
 * **When to use**
 *
 * Use when something must point at an observation *version* rather than at
 * a source or a record that could be re-observed later. Two callers need this:
 * a newer observation declaring which earlier one it supersedes, and an
 * attorney judgment declaring which exact observation it answers.
 *
 * **Details**
 *
 * Both fields are load-bearing. The event id alone names a record, which would
 * let a reference appear to survive a re-observation of the same source; the
 * digest alone names a version without saying whose. Together they are
 * checkable against the target event's own recorded observation, so a
 * reference is honoured only when both halves agree.
 *
 * **Gotchas**
 *
 * A reference whose digest does not match the named event's observation is not
 * repaired and not ignored — it is simply not honoured, which leaves the
 * affected observations without a derivable head and therefore uncovered.
 *
 * **Example** (Point at one exact observation version)
 *
 * ```ts
 * import { ObservationVersionRef } from "@beep/law-practice-domain"
 * import { SourceTextDigest } from "@beep/provenance/SourceTextIdentity"
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 *
 * const ref = ObservationVersionRef.make({
 *   eventId: LawPractice.PatentCitationEventId.make(1),
 *   textDigest: SourceTextDigest.make(
 *     "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 *   ),
 * })
 * console.log(ref.eventId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObservationVersionRef extends S.Class<ObservationVersionRef>($I`ObservationVersionRef`)(
  {
    eventId: LawPractice.PatentCitationEventId.annotateKey({
      description: "Identifier of the exact patent citation event being referenced.",
    }),
    textDigest: SourceTextDigest.annotateKey({
      description: "Extracted-text digest naming the exact observation version that event carried.",
    }),
  },
  $I.annote("ObservationVersionRef", {
    description: "Version-exact reference naming both the referenced event and the observation version it carried.",
  })
) {}
