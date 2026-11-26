/**
 * Law admission ports: the attorney attestation and the admission service.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import type { ClaimId } from "@beep/epistemics/ClaimCore";
import type {
  LawAdmission as LawAdmissionRecord,
  LawHumanAdmissionToken,
  LawRevision,
  OfficeActionAssessments,
} from "@beep/law-practice-domain/values/LawClaim";
import type { TextAnchorVerificationReceipt } from "@beep/text/VerifiedTextAnchor";
import type * as Effect from "effect/Effect";
import type { LawClaimStoreError } from "../ClaimStore/index.ts";
import type { LawAdmissionResult } from "./LawAdmission.values.ts";

const $I = $LawPracticeUseCasesId.create("LawAdmission/LawAdmission.ports");

/**
 * Verifies that a human admission token carries a genuine attorney
 * attestation.
 *
 * **Example** (Reference the attestation port)
 *
 * ```ts
 * import { AttorneyAttestation } from "@beep/law-practice-use-cases/LawAdmission"
 *
 * console.log(AttorneyAttestation.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class AttorneyAttestation extends Context.Service<
  AttorneyAttestation,
  { readonly verify: (token: LawAdmissionRecord["token"]) => Effect.Effect<boolean> }
>()($I`AttorneyAttestation`) {}

/**
 * Service shape of attorney admission.
 *
 * **Details**
 *
 * `open` records the binding the authenticated principal opens on a proposed
 * claim at one revision. `admit` checks the profile's gate over the given
 * assessments, then the epistemics admission, and stores an admitted record;
 * every refusal is a value.
 *
 * **Example** (Name an admission method)
 *
 * ```ts
 * import type { LawAdmissionShape } from "@beep/law-practice-use-cases/LawAdmission"
 *
 * const method: keyof LawAdmissionShape = "admit"
 * console.log(method) // "admit"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface LawAdmissionShape {
  /** Check the gate and the admission, and store an admitted record. */
  readonly admit: (request: {
    readonly claim: ClaimId;
    readonly token: LawHumanAdmissionToken;
    readonly grounding: ReadonlyArray<TextAnchorVerificationReceipt>;
    readonly revision: LawRevision;
    readonly assessments: OfficeActionAssessments;
  }) => Effect.Effect<LawAdmissionResult, LawClaimStoreError>;
  /** Open the claim for admission at the revision under the authenticated principal. */
  readonly open: (request: {
    readonly claim: ClaimId;
    readonly revision: LawRevision;
  }) => Effect.Effect<void, LawClaimStoreError>;
}

/**
 * Attorney admission of a proposed law claim.
 *
 * **Example** (Reference the admission service)
 *
 * ```ts
 * import { LawAdmission } from "@beep/law-practice-use-cases/LawAdmission"
 *
 * console.log(LawAdmission.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class LawAdmission extends Context.Service<LawAdmission, LawAdmissionShape>()($I`LawAdmission`) {}
