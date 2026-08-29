/**
 * Concept-local value objects for attorney candor dispositions.
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";

const $I = $LawPracticeDomainId.create("entities/CandorDisposition/CandorDisposition.values");
const CandorJudgmentBase = LiteralKit(["Submit", "DoNotSubmit"]);
const CandorDispositionLifecycleBase = LiteralKit(["active", "superseded", "withdrawn"]);

/**
 * What an attorney decided to do about one recorded occurrence.
 *
 * **When to use**
 *
 * Use to record a decision a human made. Never derive a member of this
 * vocabulary from evidence, similarity, or any other signal.
 *
 * **Details**
 *
 * The vocabulary stays deliberately minimal at this rung: two members that
 * record an action, not a legal conclusion. Nothing here encodes materiality,
 * cumulativeness, intent, or duty satisfaction, and no rule in this package
 * computes a value of this type.
 *
 * **Gotchas**
 *
 * `DoNotSubmit` is a recorded decision, not a finding that the reference was
 * immaterial. The distinction matters: the system records that an attorney
 * decided, never that the law would agree.
 *
 * **Example** (Narrow a recorded judgment)
 *
 * ```ts
 * import { CandorJudgment } from "@beep/law-practice-domain"
 *
 * console.log(CandorJudgment.is.Submit("Submit")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CandorJudgment = CandorJudgmentBase.pipe(
  $I.annoteSchema("CandorJudgment", {
    description: "Minimal recorded attorney decision about one patent citation event.",
  }),
  SchemaUtils.withLiteralKitStatics(CandorJudgmentBase)
);

/**
 * Runtime type for {@link CandorJudgment}.
 *
 * @see {@link CandorJudgment} for the runtime schema and the no-computed-judgment rule.
 * @category models
 * @since 0.0.0
 */
export type CandorJudgment = typeof CandorJudgment.Type;

/**
 * Standing of one recorded disposition within its append-only history.
 *
 * **When to use**
 *
 * Use to declare what a newly appended disposition record is: a live judgment,
 * an explicit retirement of an earlier one, or a withdrawal.
 *
 * **Details**
 *
 * A recorded disposition is never edited, so lifecycle is the declared kind of
 * the record being appended rather than a mutable status. Effective standing is
 * derived: a disposition covers its event only when it declares `active` and no
 * other disposition supersedes it. A stored `superseded` marker can therefore
 * only ever remove coverage, never grant it, which keeps the derived head and
 * the stored value from ever contradicting each other.
 *
 * **Example** (Narrow a declared lifecycle)
 *
 * ```ts
 * import { CandorDispositionLifecycle } from "@beep/law-practice-domain"
 *
 * console.log(CandorDispositionLifecycle.is.withdrawn("withdrawn")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CandorDispositionLifecycle = CandorDispositionLifecycleBase.pipe(
  $I.annoteSchema("CandorDispositionLifecycle", {
    description: "Declared standing of one appended candor disposition record.",
  }),
  SchemaUtils.withLiteralKitStatics(CandorDispositionLifecycleBase)
);

/**
 * Runtime type for {@link CandorDispositionLifecycle}.
 *
 * @see {@link CandorDispositionLifecycle} for the runtime schema and derivation rule.
 * @category models
 * @since 0.0.0
 */
export type CandorDispositionLifecycle = typeof CandorDispositionLifecycle.Type;
