/**
 * Law admission values: the refusals and the result of one attorney admission.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { AdmissionRefused } from "@beep/epistemics/Admission";
import { ClaimId } from "@beep/epistemics/ClaimCore";
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { LawAdmission } from "@beep/law-practice-domain/values/LawClaim";
import * as S from "effect/Schema";

const $I = $LawPracticeUseCasesId.create("LawAdmission/LawAdmission.values");

/**
 * Why an attorney admission wrote nothing: the assessment gate did not pass,
 * no proposal carries the claim, or the epistemics admission refused.
 *
 * **Example** (Refuse a failed gate)
 *
 * ```ts
 * import { LawAdmissionRefused } from "@beep/law-practice-use-cases/LawAdmission"
 * import { ClaimId } from "@beep/epistemics/ClaimCore"
 *
 * const claim = ClaimId.make(`sha256:${"a".repeat(64)}`)
 * console.log(LawAdmissionRefused.cases.GateNotPassed.make({ claim })._tag) // "GateNotPassed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LawAdmissionRefused = S.TaggedUnion({
  GateNotPassed: { claim: ClaimId },
  UnknownClaim: { claim: ClaimId },
  Admission: { refusal: AdmissionRefused },
}).pipe($I.annoteSchema("LawAdmissionRefused", { description: "Why an attorney admission wrote nothing." }));

/**
 * @category models
 * @since 0.0.0
 */
export type LawAdmissionRefused = typeof LawAdmissionRefused.Type;

/**
 * **Example** (Read the result cases)
 *
 * ```ts
 * import { LawAdmissionResult } from "@beep/law-practice-use-cases/LawAdmission"
 *
 * console.log(Object.keys(LawAdmissionResult.cases)) // ["Admitted", "Refused"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LawAdmissionResult = S.TaggedUnion({
  Admitted: { admission: LawAdmission },
  Refused: { refusal: LawAdmissionRefused },
}).pipe($I.annoteSchema("LawAdmissionResult", { description: "The stored admission, or why none was written." }));

/**
 * @category models
 * @since 0.0.0
 */
export type LawAdmissionResult = typeof LawAdmissionResult.Type;
