/**
 * The five recorded scope axes a legal position holds within.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { HashSet as StoredHashSet } from "@beep/schema/HashSet";
import * as S from "effect/Schema";

const $I = $LawPracticeDomainId.create("values/LegalScopeContext/LegalScopeContext.model");

/**
 * One recorded value on a scope axis.
 *
 * **Details**
 *
 * Values are recorded designations, compared exactly. Two axes overlap when
 * they share at least one value, so the vocabulary a recorder uses on an axis
 * is what decides whether two positions are found to overlap on it.
 *
 * **Example** (Record a scope value)
 *
 * ```ts
 * import { LegalScopeValue } from "@beep/law-practice-domain"
 *
 * console.log(LegalScopeValue.make("US-CA"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LegalScopeValue = S.NonEmptyString.pipe(
  $I.annoteSchema("LegalScopeValue", {
    description: "One recorded designation on a legal scope axis, compared exactly.",
  })
);

/**
 * Runtime type for {@link LegalScopeValue}.
 *
 * @see {@link LegalScopeValue} for the runtime schema and its exact-comparison rule.
 * @category models
 * @since 0.0.0
 */
export type LegalScopeValue = typeof LegalScopeValue.Type;

/**
 * The scope a legal position is recorded as holding within, on exactly five
 * axes.
 *
 * **When to use**
 *
 * Use as the recorded scope of a stored relation, so two relations can be asked
 * the set-theoretic question of whether their scopes overlap on every axis.
 *
 * **Details**
 *
 * The five axes are fixed: `material` (the subject matter), `temporal` (when),
 * `territorial` (the jurisdiction or territory), `quantitative` (how much or
 * how many), and `subjective` (whom it is held against or in respect of).
 *
 * Every axis is a set of recorded values rather than a range or an interval,
 * which keeps overlap one operation applied five times: two scopes overlap on
 * an axis when their value sets intersect. Whether the whole scope overlaps is
 * then a conjunction over five identical facts, with no axis-specific algebra
 * to get subtly wrong.
 *
 * Forum, proof standard, and institutional viewpoint are deliberately absent.
 * They belong to the basis for a priority claim, not to where a position holds,
 * and folding them in here would let a scope-overlap answer read as a statement
 * about which position wins.
 *
 * **Gotchas**
 *
 * Overlap on every axis is a set-theoretic fact and nothing more. It is not a
 * finding that two positions are legally comparable, which is attributed human
 * interpretation and is never computed. Presenting an overlap result as
 * comparability is exactly the proxy the never-compute boundary forbids.
 *
 * **Example** (Record a scope on all five axes)
 *
 * ```ts
 * import { LegalScopeContext } from "@beep/law-practice-domain"
 * import * as HashSet from "effect/HashSet"
 *
 * const scope = LegalScopeContext.make({
 *   material: HashSet.make("the demised premises"),
 *   quantitative: HashSet.make("unlimited"),
 *   subjective: HashSet.make("the lessor"),
 *   temporal: HashSet.make("the term of the lease"),
 *   territorial: HashSet.make("US-CA"),
 * })
 * console.log(HashSet.size(scope.territorial)) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LegalScopeContext extends S.Class<LegalScopeContext>($I`LegalScopeContext`)(
  {
    material: StoredHashSet(LegalScopeValue).annotateKey({
      description: "Recorded subject matter the position is about.",
    }),
    quantitative: StoredHashSet(LegalScopeValue).annotateKey({
      description: "Recorded amounts or counts the position is bounded by.",
    }),
    subjective: StoredHashSet(LegalScopeValue).annotateKey({
      description: "Recorded persons or classes the position is held in respect of.",
    }),
    temporal: StoredHashSet(LegalScopeValue).annotateKey({
      description: "Recorded times the position is held to apply within.",
    }),
    territorial: StoredHashSet(LegalScopeValue).annotateKey({
      description: "Recorded jurisdictions or territories the position is held to apply within.",
    }),
  },
  $I.annote("LegalScopeContext", {
    description: "The five recorded scope axes a legal position is held to apply within.",
  })
) {}
