/**
 * Aggregate root for one typed skill promise.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $SkillContractId } from "@beep/identity/packages";
import { SemanticVersion } from "@beep/schema/SemanticVersion";
import * as S from "effect/Schema";
import { EvidenceLadderReceiptTypes } from "./EvidenceLadder.ts";
import { EvidenceSubject } from "./EvidenceReceipt.ts";
import { EvidencePredicateType, GateRegistry } from "./Gate.ts";
import { RecoveryPolicy } from "./Recovery.ts";
import { SchemaReference } from "./SchemaReference.ts";

const $I = $SkillContractId.create("SkillContract");

/**
 * Stable identity of one versioned skill contract.
 *
 * **Example** (Construct a contract id)
 *
 * ```ts
 * import { SkillContractId } from "@beep/skill-contract"
 *
 * console.log(SkillContractId.make("qa-inventory-judge"))
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const SkillContractId = S.NonEmptyString.pipe(
  S.brand("SkillContractId"),
  $I.annoteSchema("SkillContractId", {
    description: "Stable identity shared by versions of one skill contract.",
  })
);

/**
 * Runtime type decoded by {@link SkillContractId}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type SkillContractId = typeof SkillContractId.Type;

/**
 * Predicate identities for receipt families spanning multiple gates.
 *
 * **Example** (Inspect receipt bindings)
 *
 * ```ts import.meta.vitest name="Inspect receipt bindings"
 * import { ReceiptTypeBindings } from "@beep/skill-contract"
 *
 * ReceiptTypeBindings.fields.gateSummary !== undefined // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReceiptTypeBindings extends S.Class<ReceiptTypeBindings>($I`ReceiptTypeBindings`)(
  {
    failure: EvidencePredicateType,
    gateSummary: EvidencePredicateType,
    ladder: EvidenceLadderReceiptTypes,
    recoveryAttempt: EvidencePredicateType,
  },
  $I.annote("ReceiptTypeBindings", {
    description: "Versioned predicate identities for cross-gate receipt families and evidence-ladder rungs.",
  })
) {}

/**
 * Aggregate root describing one versioned typed skill promise.
 *
 * **Details**
 *
 * Input, output, and conditional applicability persist schema references only.
 * Runtime consumer modules bind those references to live schema values.
 * Recovery policy is structural; no recovery engine is included.
 *
 * **Example** (Inspect aggregate fields)
 *
 * ```ts import.meta.vitest name="Inspect aggregate fields"
 * import { SkillContract } from "@beep/skill-contract"
 *
 * SkillContract.fields.receiptTypes !== undefined // => true
 * ```
 *
 * @category aggregates
 * @since 0.0.0
 */
export class SkillContract extends S.Class<SkillContract>($I`SkillContract`)(
  {
    evidenceSubject: EvidenceSubject,
    gates: GateRegistry,
    id: SkillContractId,
    input: SchemaReference,
    output: SchemaReference,
    promise: S.NonEmptyString,
    receiptTypes: ReceiptTypeBindings,
    recovery: RecoveryPolicy,
    version: SemanticVersion,
  },
  $I.annote("SkillContract", {
    description:
      "Digest-bound aggregate root for one versioned typed skill promise, its gates, receipts, and recovery policy.",
  })
) {}
