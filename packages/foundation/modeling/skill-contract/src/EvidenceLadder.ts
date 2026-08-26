/**
 * Monotonic evidence-ladder schemas and immediate-forward transitions.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $SkillContractId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { Tuple } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { EvidenceSubject } from "./EvidenceReceipt.ts";
import { EvidencePredicateType } from "./Gate.ts";

const $I = $SkillContractId.create("EvidenceLadder");
const predicateTypeEquivalence = S.toEquivalence(EvidencePredicateType);

/**
 * Digest-bound reference to an evidence receipt used by one ladder rung.
 *
 * **Example** (Inspect receipt reference fields)
 *
 * ```ts import.meta.vitest name="Inspect receipt reference fields"
 * import { EvidenceReceiptReference } from "@beep/skill-contract"
 *
 * EvidenceReceiptReference.fields.predicateType !== undefined // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EvidenceReceiptReference extends S.Class<EvidenceReceiptReference>($I`EvidenceReceiptReference`)(
  {
    predicateType: EvidencePredicateType,
    receipt: EvidenceSubject,
    subjects: S.NonEmptyArray(EvidenceSubject),
  },
  $I.annote("EvidenceReceiptReference", {
    description: "Predicate identity, receipt digest, and covered subjects proving one evidence-ladder rung.",
  })
) {}

/**
 * Predicate-type demands for all four evidence-ladder rungs.
 *
 * **Example** (Inspect ladder receipt bindings)
 *
 * ```ts import.meta.vitest name="Inspect ladder receipt bindings"
 * import { EvidenceLadderReceiptTypes } from "@beep/skill-contract"
 *
 * EvidenceLadderReceiptTypes.fields.semanticallyApplied !== undefined // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EvidenceLadderReceiptTypes extends S.Class<EvidenceLadderReceiptTypes>($I`EvidenceLadderReceiptTypes`)(
  {
    accepted: EvidencePredicateType,
    delivered: EvidencePredicateType,
    persisted: EvidencePredicateType,
    semanticallyApplied: EvidencePredicateType,
  },
  $I.annote("EvidenceLadderReceiptTypes", {
    description: "Versioned predicate identities demanded by each evidence-ladder rung.",
  })
) {}

/**
 * Lowest evidence rung, proving only transport acceptance.
 *
 * **Example** (Inspect accepted evidence)
 *
 * ```ts import.meta.vitest name="Inspect accepted evidence"
 * import { Accepted } from "@beep/skill-contract"
 *
 * Accepted.fields.accepted !== undefined // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Accepted extends S.Class<Accepted>($I`Accepted`)(
  {
    accepted: EvidenceReceiptReference,
    rung: S.tag("Accepted"),
  },
  $I.annote("Accepted", {
    description: "Lowest ladder rung proving only that transport accepted the operation.",
  })
) {
  static readonly thunkThis = () => this;
}

/**
 * Evidence rung proving acceptance and persistence.
 *
 * **Example** (Inspect persistence evidence)
 *
 * ```ts import.meta.vitest name="Inspect persistence evidence"
 * import { Persisted } from "@beep/skill-contract"
 *
 * Persisted.fields.persisted !== undefined // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Persisted extends S.Class<Persisted>($I`Persisted`)(
  {
    accepted: EvidenceReceiptReference,
    persisted: EvidenceReceiptReference,
    rung: S.tag("Persisted"),
  },
  $I.annote("Persisted", {
    description: "Ladder rung proving transport acceptance and durable persistence.",
  })
) {
  static readonly thunkThis = () => this;
}

/**
 * Evidence rung proving acceptance, persistence, and delivery.
 *
 * **Example** (Inspect delivery evidence)
 *
 * ```ts import.meta.vitest name="Inspect delivery evidence"
 * import { Delivered } from "@beep/skill-contract"
 *
 * Delivered.fields.delivered !== undefined // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Delivered extends S.Class<Delivered>($I`Delivered`)(
  {
    accepted: EvidenceReceiptReference,
    delivered: EvidenceReceiptReference,
    persisted: EvidenceReceiptReference,
    rung: S.tag("Delivered"),
  },
  $I.annote("Delivered", {
    description: "Ladder rung proving acceptance, persistence, and delivery.",
  })
) {
  static readonly thunkThis = () => this;
}

/**
 * Highest evidence rung, proving the delivered result was semantically applied.
 *
 * **Example** (Inspect semantic-application evidence)
 *
 * ```ts import.meta.vitest name="Inspect semantic-application evidence"
 * import { SemanticallyApplied } from "@beep/skill-contract"
 *
 * SemanticallyApplied.fields.semanticallyApplied !== undefined // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SemanticallyApplied extends S.Class<SemanticallyApplied>($I`SemanticallyApplied`)(
  {
    accepted: EvidenceReceiptReference,
    delivered: EvidenceReceiptReference,
    persisted: EvidenceReceiptReference,
    rung: S.tag("SemanticallyApplied"),
    semanticallyApplied: EvidenceReceiptReference,
  },
  $I.annote("SemanticallyApplied", {
    description: "Highest ladder rung proving the delivered result was semantically applied.",
  })
) {
  static readonly thunkThis = () => this;
}

/**
 * Four-rung structural evidence state with cumulative lower-rung demands.
 *
 * **Example** (Inspect evidence rungs)
 *
 * ```ts
 * import { EvidenceLadderState } from "@beep/skill-contract"
 *
 * console.log(EvidenceLadderState.discriminants)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EvidenceLadderState = LiteralKit(["Accepted", "Persisted", "Delivered", "SemanticallyApplied"])
  .mapMembers(
    Tuple.evolve([Accepted.thunkThis, Persisted.thunkThis, Delivered.thunkThis, SemanticallyApplied.thunkThis])
  )
  .pipe(
    S.toTaggedUnion("rung"),
    $I.annoteSchema("EvidenceLadderState", {
      description: "Monotonic evidence state whose higher rungs retain every lower-rung receipt.",
    })
  );

/**
 * Runtime type decoded by {@link EvidenceLadderState}.
 *
 * @category models
 * @since 0.0.0
 */
export type EvidenceLadderState = typeof EvidenceLadderState.Type;

const ladderMatchesReceiptTypes = (types: EvidenceLadderReceiptTypes, state: EvidenceLadderState): boolean =>
  EvidenceLadderState.match(state, {
    Accepted: ({ accepted }) => predicateTypeEquivalence(accepted.predicateType, types.accepted),
    Delivered: ({ accepted, delivered, persisted }) =>
      predicateTypeEquivalence(accepted.predicateType, types.accepted) &&
      predicateTypeEquivalence(persisted.predicateType, types.persisted) &&
      predicateTypeEquivalence(delivered.predicateType, types.delivered),
    Persisted: ({ accepted, persisted }) =>
      predicateTypeEquivalence(accepted.predicateType, types.accepted) &&
      predicateTypeEquivalence(persisted.predicateType, types.persisted),
    SemanticallyApplied: ({ accepted, delivered, persisted, semanticallyApplied }) =>
      predicateTypeEquivalence(accepted.predicateType, types.accepted) &&
      predicateTypeEquivalence(persisted.predicateType, types.persisted) &&
      predicateTypeEquivalence(delivered.predicateType, types.delivered) &&
      predicateTypeEquivalence(semanticallyApplied.predicateType, types.semanticallyApplied),
  });

/**
 * Refines the ladder ADT against one contract's per-rung predicate bindings.
 *
 * **Example** (Bind ladder receipt identities)
 *
 * ```ts import.meta.vitest name="Bind ladder receipt identities"
 * import { EvidenceLadderReceiptTypes, EvidencePredicateType, evidenceLadderFor } from "@beep/skill-contract"
 *
 * const type = EvidencePredicateType.make("https://example.test/evidence/rung/v1")
 * const Ladder = evidenceLadderFor(EvidenceLadderReceiptTypes.make({
 *   accepted: type,
 *   delivered: type,
 *   persisted: type,
 *   semanticallyApplied: type
 * }))
 * Ladder.ast !== undefined // => true
 * ```
 *
 * @param types - Predicate identities demanded by each rung.
 * @returns A distinctly identified ladder schema that rejects mismatched receipt types.
 * @category factories
 * @since 0.0.0
 */
export const evidenceLadderFor = (types: EvidenceLadderReceiptTypes) => {
  const identifier = `EvidenceLadderFor(${A.join(
    [types.accepted, types.persisted, types.delivered, types.semanticallyApplied],
    "|"
  )})`;
  const ReceiptTypeCheck = S.makeFilter((state: EvidenceLadderState) => ladderMatchesReceiptTypes(types, state), {
    identifier: $I.create(identifier).make("ReceiptTypeCheck"),
    title: "Evidence ladder receipt types",
    description: "Every cumulative rung receipt must match the contract's named predicate identity.",
    message: "Evidence ladder receipt predicate types do not match the contract bindings",
  });

  return EvidenceLadderState.check(ReceiptTypeCheck).pipe(
    $I.annoteSchema(identifier, {
      description: "Evidence ladder refined by one contract's per-rung predicate identities.",
    })
  );
};

/**
 * Treats a transport-level completed result as acceptance only.
 *
 * **Example** (Map transport completion to the lowest rung)
 *
 * ```ts import.meta.vitest name="Map transport completion to the lowest rung"
 * import { transportCompleted } from "@beep/skill-contract"
 *
 * typeof transportCompleted // => "function"
 * ```
 *
 * @param evidence - Receipt reference proving transport acceptance.
 * @returns The lowest evidence rung.
 * @category constructors
 * @since 0.0.0
 */
export const transportCompleted = (evidence: EvidenceReceiptReference): Accepted =>
  Accepted.make({ accepted: evidence });

/**
 * Advances accepted evidence to persistence while retaining acceptance proof.
 *
 * **Example** (Inspect persistence transition)
 *
 * ```ts import.meta.vitest name="Inspect persistence transition"
 * import { advanceToPersisted } from "@beep/skill-contract"
 *
 * typeof advanceToPersisted // => "function"
 * ```
 *
 * @param state - Accepted state that must precede persistence.
 * @param evidence - Receipt reference proving persistence.
 * @returns The cumulative persisted state.
 * @category constructors
 * @since 0.0.0
 */
export const advanceToPersisted: {
  (evidence: EvidenceReceiptReference): (state: Accepted) => Persisted;
  (state: Accepted, evidence: EvidenceReceiptReference): Persisted;
} = dual(
  2,
  (state: Accepted, evidence: EvidenceReceiptReference): Persisted =>
    Persisted.make({ accepted: state.accepted, persisted: evidence })
);

/**
 * Advances persisted evidence to delivery while retaining lower-rung proof.
 *
 * **Example** (Inspect delivery transition)
 *
 * ```ts import.meta.vitest name="Inspect delivery transition"
 * import { advanceToDelivered } from "@beep/skill-contract"
 *
 * typeof advanceToDelivered // => "function"
 * ```
 *
 * @param state - Persisted state that must precede delivery.
 * @param evidence - Receipt reference proving delivery.
 * @returns The cumulative delivered state.
 * @category constructors
 * @since 0.0.0
 */
export const advanceToDelivered: {
  (evidence: EvidenceReceiptReference): (state: Persisted) => Delivered;
  (state: Persisted, evidence: EvidenceReceiptReference): Delivered;
} = dual(
  2,
  (state: Persisted, evidence: EvidenceReceiptReference): Delivered =>
    Delivered.make({ accepted: state.accepted, delivered: evidence, persisted: state.persisted })
);

/**
 * Advances delivered evidence to semantic application while retaining all proof.
 *
 * **Example** (Inspect semantic transition)
 *
 * ```ts import.meta.vitest name="Inspect semantic transition"
 * import { advanceToSemanticallyApplied } from "@beep/skill-contract"
 *
 * typeof advanceToSemanticallyApplied // => "function"
 * ```
 *
 * @param state - Delivered state that must precede semantic application.
 * @param evidence - Receipt reference proving semantic application.
 * @returns The cumulative semantically-applied state.
 * @category constructors
 * @since 0.0.0
 */
export const advanceToSemanticallyApplied: {
  (evidence: EvidenceReceiptReference): (state: Delivered) => SemanticallyApplied;
  (state: Delivered, evidence: EvidenceReceiptReference): SemanticallyApplied;
} = dual(
  2,
  (state: Delivered, evidence: EvidenceReceiptReference): SemanticallyApplied =>
    SemanticallyApplied.make({
      accepted: state.accepted,
      delivered: state.delivered,
      persisted: state.persisted,
      semanticallyApplied: evidence,
    })
);
