/**
 * Value objects describing the candor gate's derived verdict.
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { CitingApplicationIdentity } from "@beep/law-practice-domain";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import * as Shared from "@beep/shared-domain/identity/Shared";
import * as A from "effect/Array";
import * as S from "effect/Schema";

const $I = $LawPracticeUseCasesId.create("CandorPolicy/CandorPolicy.values");
const UncoveredReasonBase = LiteralKit([
  "no-disposition",
  "disposition-not-effective",
  "disposition-author-not-user",
  "no-rule56-judgment",
  "ambiguous-lineage",
  "quarantined",
  "possible-duplicate",
  "source-unresolved",
  "anchor-unverified",
]);

/**
 * The exact filing a candor question is asked about, inside one tenant.
 *
 * **When to use**
 *
 * Use as the key for every read of recorded candor material and as the subject
 * of every verdict. Nothing in this package reads records by citing
 * application alone.
 *
 * **Details**
 *
 * `orgId` is not decoration. Two organizations can prosecute filings that carry
 * the same application number, and their records live in the same tables. A
 * read keyed only by citing application would return both tenants' rows, which
 * means one tenant's attorney disposition could release another tenant's
 * promotion block. Pairing the organization with the filing makes that
 * boundary impossible to forget at a call site.
 *
 * **Gotchas**
 *
 * The scope is the caller's tenant, not the row's. Filtering on a row's own
 * `orgId` would be circular — it would only prove the row agrees with itself.
 *
 * **Example** (Scope a candor question to one tenant's filing)
 *
 * ```ts
 * import { CandorFilingScope } from "@beep/law-practice-use-cases/CandorPolicy"
 * import { CitingApplicationIdentity, UsptoNormalizedApplicationNumber } from "@beep/law-practice-domain"
 * import * as Shared from "@beep/shared-domain/identity/Shared"
 *
 * const scope = CandorFilingScope.make({
 *   citingApplication: CitingApplicationIdentity.make({
 *     applicationNumber: UsptoNormalizedApplicationNumber.make("16138242"),
 *     kind: "UsptoNormalized",
 *   }),
 *   orgId: Shared.OrganizationId.make(1),
 * })
 * console.log(scope.citingApplication.kind) // "UsptoNormalized"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CandorFilingScope extends S.Class<CandorFilingScope>($I`CandorFilingScope`)(
  {
    citingApplication: CitingApplicationIdentity.annotateKey({
      description: "Filing the candor question is asked about.",
    }),
    orgId: Shared.OrganizationId.annotateKey({
      description: "Organization whose records may be read; never inferred from a row.",
    }),
  },
  $I.annote("CandorFilingScope", {
    description: "Tenant-scoped filing key for every candor record read and every verdict.",
  })
) {}

/**
 * Why one recorded event is not covered by an attorney judgment.
 *
 * **When to use**
 *
 * Use to explain a blocking verdict to a human. Every member is a fail-closed
 * branch: each one describes a condition under which the gate declines to say
 * an event is covered, never a legal conclusion about the event.
 *
 * **Details**
 *
 * The vocabulary is exhaustive over the reasons this package can reach, and
 * each member is exercised by the policy test. `ambiguous-lineage` covers the
 * cases where currency cannot be derived at all — no head, two unsuperseded
 * observations of one source, or a supersession reference whose digest does not
 * match the event it names.
 *
 * **Gotchas**
 *
 * `source-unresolved` and `anchor-unverified` are reported rather than raised.
 * A source that will not resolve or an anchor that will not re-verify leaves
 * its event uncovered, which blocks; it never skips the check.
 *
 * **Example** (Narrow an uncovered reason)
 *
 * ```ts
 * import { UncoveredReason } from "@beep/law-practice-use-cases/CandorPolicy"
 *
 * console.log(UncoveredReason.is["no-disposition"]("no-disposition")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UncoveredReason = UncoveredReasonBase.pipe(
  $I.annoteSchema("UncoveredReason", {
    description: "Fail-closed reason one recorded citation event is not covered by an attorney judgment.",
  }),
  SchemaUtils.withLiteralKitStatics(UncoveredReasonBase)
);

/**
 * Runtime type for {@link UncoveredReason}.
 *
 * @see {@link UncoveredReason} for the runtime schema and member meanings.
 * @category models
 * @since 0.0.0
 */
export type UncoveredReason = typeof UncoveredReason.Type;

/**
 * One event the gate declines to treat as covered, and why.
 *
 * **Example** (Report an uncovered event)
 *
 * ```ts
 * import { UncoveredEvent } from "@beep/law-practice-use-cases/CandorPolicy"
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 *
 * const uncovered = UncoveredEvent.make({
 *   eventId: LawPractice.PatentCitationEventId.make(1),
 *   reason: "no-disposition",
 * })
 * console.log(uncovered.reason) // "no-disposition"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UncoveredEvent extends S.Class<UncoveredEvent>($I`UncoveredEvent`)(
  {
    eventId: LawPractice.PatentCitationEventId.annotateKey({
      description: "Identifier of the recorded event that is not covered.",
    }),
    reason: UncoveredReason.annotateKey({
      description: "Fail-closed reason this event is not covered.",
    }),
  },
  $I.annote("UncoveredEvent", {
    description: "One recorded citation event the gate declines to treat as covered, with its reason.",
  })
) {}

/**
 * The gate's recomputed answer for one filing.
 *
 * **When to use**
 *
 * Use as the whole output of a candor evaluation. Callers decide whether to
 * proceed by asking {@link CandorGateVerdict.isBlocked}, never by reading a
 * stored flag.
 *
 * **Details**
 *
 * Blocked-ness is derived from `uncovered` rather than carried as a field, so
 * no "duty satisfied" state exists anywhere — not in storage, and not even for
 * the lifetime of this value. A verdict is a statement about the material that
 * was readable at evaluation time and nothing more.
 *
 * **Gotchas**
 *
 * An empty `uncovered` list means the gate found nothing blocking in the
 * material it could read. It is not a finding that the duty of candor has been
 * discharged, and nothing in this package computes that.
 *
 * **Example** (Ask whether promotion is blocked)
 *
 * ```ts
 * import { CandorFilingScope, CandorGateVerdict } from "@beep/law-practice-use-cases/CandorPolicy"
 * import { CitingApplicationIdentity, UsptoNormalizedApplicationNumber } from "@beep/law-practice-domain"
 * import * as Shared from "@beep/shared-domain/identity/Shared"
 *
 * const verdict = CandorGateVerdict.make({
 *   scope: CandorFilingScope.make({
 *     citingApplication: CitingApplicationIdentity.make({
 *       applicationNumber: UsptoNormalizedApplicationNumber.make("16138242"),
 *       kind: "UsptoNormalized",
 *     }),
 *     orgId: Shared.OrganizationId.make(1),
 *   }),
 *   uncovered: [],
 * })
 * console.log(CandorGateVerdict.isBlocked(verdict)) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CandorGateVerdict extends S.Class<CandorGateVerdict>($I`CandorGateVerdict`)(
  {
    scope: CandorFilingScope.annotateKey({
      description: "Tenant-scoped filing this verdict was recomputed for.",
    }),
    uncovered: S.Array(UncoveredEvent).annotateKey({
      description: "Every recorded event the gate declines to treat as covered, with its reason.",
    }),
  },
  $I.annote("CandorGateVerdict", {
    description: "Recomputed candor answer for one filing, carrying only the uncovered events it found.",
  })
) {
  /**
   * Derive whether promotion is candor-blocked for this verdict.
   *
   * **Details**
   *
   * Blocked-ness is a function of the uncovered list, never a stored value.
   * Keeping the derivation here rather than at each call site is what makes
   * "no stored closure state" mechanically true instead of a convention.
   *
   * **Example** (Branch on a blocking verdict)
   *
   * ```ts
   * import { CandorFilingScope, CandorGateVerdict, UncoveredEvent } from "@beep/law-practice-use-cases/CandorPolicy"
   * import { CitingApplicationIdentity, UsptoNormalizedApplicationNumber } from "@beep/law-practice-domain"
   * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
   * import * as Shared from "@beep/shared-domain/identity/Shared"
   *
   * const verdict = CandorGateVerdict.make({
   *   scope: CandorFilingScope.make({
   *     citingApplication: CitingApplicationIdentity.make({
   *       applicationNumber: UsptoNormalizedApplicationNumber.make("16138242"),
   *       kind: "UsptoNormalized",
   *     }),
   *     orgId: Shared.OrganizationId.make(1),
   *   }),
   *   uncovered: [
   *     UncoveredEvent.make({
   *       eventId: LawPractice.PatentCitationEventId.make(1),
   *       reason: "no-disposition",
   *     }),
   *   ],
   * })
   * console.log(CandorGateVerdict.isBlocked(verdict)) // true
   * ```
   *
   * @param verdict - A recomputed candor verdict.
   * @returns Whether at least one recorded event is uncovered.
   * @category predicates
   * @since 0.0.0
   */
  static readonly isBlocked = (verdict: CandorGateVerdict): boolean => A.isReadonlyArrayNonEmpty(verdict.uncovered);
}
