/**
 * Read scopes for the legal position record repository.
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import * as Shared from "@beep/shared-domain/identity/Shared";
import * as S from "effect/Schema";

const $I = $LawPracticeUseCasesId.create("LegalPositionRecord/LegalPositionRecord.values");

/**
 * Tenant key for every read of the records a matter accumulates on its own.
 *
 * **When to use**
 *
 * Use as the scope for the three record kinds that stand on their own — stored
 * relations, recorded frames, and screened candidates. Each is read for one
 * organization and nothing narrower, because none of them hangs off another
 * record.
 *
 * **Gotchas**
 *
 * The organization is always supplied by the caller and never inferred from a
 * row. Two tenants may record positions about the same norm and the same act,
 * and a scope-free read would merge them into one legal picture.
 *
 * **Example** (Scope a read to one organization)
 *
 * ```ts
 * import { LegalPositionRecordScope } from "@beep/law-practice-use-cases/LegalPositionRecord"
 * import * as Shared from "@beep/shared-domain/identity/Shared"
 *
 * const scope = LegalPositionRecordScope.make({ orgId: Shared.OrganizationId.make(1) })
 * console.log(scope.orgId) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LegalPositionRecordScope extends S.Class<LegalPositionRecordScope>($I`LegalPositionRecordScope`)(
  {
    orgId: Shared.OrganizationId.annotateKey({
      description: "Organization whose records may be read; never inferred from a row.",
    }),
  },
  $I.annote("LegalPositionRecordScope", {
    description: "Tenant key for every legal position record read that is not keyed by a frame.",
  })
) {}

/**
 * Tenant-scoped frame key for the two reads that hang off one recorded frame.
 *
 * **When to use**
 *
 * Use to read the exercises attempted under one frame and the corrections made
 * to it. Both point at a frame by construction, so neither is meaningful
 * without one.
 *
 * **Details**
 *
 * The organization comes first and the frame second, in the same order the
 * candor filing scope puts tenant before filing: a frame id alone would let one
 * tenant's exercises be read under another tenant's request.
 *
 * **Example** (Scope a read to one recorded frame)
 *
 * ```ts
 * import { ActFrameRecordScope } from "@beep/law-practice-use-cases/LegalPositionRecord"
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 * import * as Shared from "@beep/shared-domain/identity/Shared"
 *
 * const scope = ActFrameRecordScope.make({
 *   frame: LawPractice.ActFrameId.make(1),
 *   orgId: Shared.OrganizationId.make(1),
 * })
 * console.log(scope.frame) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ActFrameRecordScope extends S.Class<ActFrameRecordScope>($I`ActFrameRecordScope`)(
  {
    frame: LawPractice.ActFrameId.annotateKey({
      description: "Recorded act frame the exercises or corrections being read belong to.",
    }),
    orgId: Shared.OrganizationId.annotateKey({
      description: "Organization whose records may be read; never inferred from a row.",
    }),
  },
  $I.annote("ActFrameRecordScope", {
    description: "Tenant-scoped frame key for reading the exercises and corrections that cite one frame.",
  })
) {}
