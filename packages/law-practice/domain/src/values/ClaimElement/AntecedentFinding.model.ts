/**
 * Advisory 35 U.S.C. 112(b) antecedent-basis findings over claim-element trees.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { PosInt } from "../../internal/PosInt.ts";
import { ClaimTermRef, claimNumberOfPath } from "./ClaimElement.model.ts";

const $I = $LawPracticeDomainId.create("values/ClaimElement/AntecedentFinding.model");

/**
 * Stable identifier of the antecedent rule that produced a finding.
 *
 * **Details**
 *
 * Rule ids are kebab-case and branded rather than a closed literal domain:
 * the rule set grows one rule per determiner fixture, and findings persist as
 * review evidence, so a finding from a renamed or retired rule must still
 * decode.
 *
 * **Example** (Decode a rule id)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AntecedentRuleId } from "@beep/law-practice-domain/values/ClaimElement"
 *
 * const rule = Effect.runSync(S.decodeUnknownEffect(AntecedentRuleId)("definite-without-introduction"))
 * console.log(rule) // "definite-without-introduction"
 * console.log(S.is(AntecedentRuleId)("Definite Rule")) // false
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const AntecedentRuleId = S.String.check(
  S.isPattern(
    /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u,
    $I.annote("AntecedentRuleIdPatternCheck", {
      title: "Kebab-case rule id",
      description: "A lowercase kebab-case antecedent rule identifier.",
      message: "Antecedent rule ids are lowercase kebab-case, e.g. definite-without-introduction.",
    })
  )
).pipe(
  S.brand("AntecedentRuleId"),
  $I.annoteSchema("AntecedentRuleId", {
    description: "Stable kebab-case identifier of the antecedent rule that fired.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type AntecedentRuleId = typeof AntecedentRuleId.Type;

/**
 * Dependency chain one finding was resolved against, from the claim to its root.
 *
 * **Details**
 *
 * A multiple dependent claim has several chains and each must resolve on its
 * own, so the chain is part of the finding: claim 3 depending on claim 1 or 2
 * can carry one finding for `[3, 1]` and another for `[3, 2]`. A claim may
 * only depend on an earlier claim, so claim numbers strictly decrease along
 * the chain, which also rules out repeats.
 *
 * **Example** (Decode a chain)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AntecedentDependencyChain } from "@beep/law-practice-domain/values/ClaimElement"
 *
 * const chain = Effect.runSync(S.decodeUnknownEffect(AntecedentDependencyChain)([3, 2, 1]))
 * console.log(chain[0]) // 3
 * console.log(S.is(AntecedentDependencyChain)([2, 7])) // false
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const AntecedentDependencyChain = S.NonEmptyArray(PosInt)
  .check(
    S.makeFilter(
      (chain: ReadonlyArray<number>) =>
        A.every(A.zip(chain, A.drop(chain, 1)), ([dependent, ancestor]) => ancestor < dependent),
      $I.annote("AntecedentDependencyChainDescendingCheck", {
        title: "Strictly descending dependency chain",
        description: "Each claim number is lower than the one before it, so the chain walks back to its root.",
        message: "Dependency chains list strictly decreasing claim numbers, from the checked claim to its root.",
      })
    )
  )
  .pipe(
    $I.annoteSchema("AntecedentDependencyChain", {
      description: "Claim numbers from the checked claim to its independent root along one dependency chain.",
    })
  );

/**
 * @category type-level
 * @since 0.0.0
 */
export type AntecedentDependencyChain = typeof AntecedentDependencyChain.Type;

/**
 * **Example** (Inspect finding kinds)
 *
 * ```ts
 * import { AntecedentFindingKind } from "@beep/law-practice-domain/values/ClaimElement"
 *
 * console.log(AntecedentFindingKind.is["pattern-not-covered"]("pattern-not-covered")) // true
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export const AntecedentFindingKind = LiteralKit([
  "missing-antecedent",
  "ambiguous-antecedent",
  "antecedent-outside-chain",
  "number-mismatch",
  "pattern-not-covered",
]).pipe(
  $I.annoteSchema("AntecedentFindingKind", {
    description:
      "Missing, ambiguous, out-of-chain, or number-mismatched antecedent, or a pattern the rules do not cover.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type AntecedentFindingKind = typeof AntecedentFindingKind.Type;

const ruleField = AntecedentRuleId.annotateKey({
  description: "Rule that fired.",
});

const referringField = ClaimTermRef.annotateKey({
  description: "Referring term the finding is about; always present.",
});

const chainField = AntecedentDependencyChain.annotateKey({
  description: "Dependency chain the referring term was resolved against.",
});

const AntecedentFindingCases = AntecedentFindingKind.toTaggedUnion("kind")({
  "missing-antecedent": {
    rule: ruleField,
    referring: referringField,
    chain: chainField,
  },
  "ambiguous-antecedent": {
    rule: ruleField,
    referring: referringField,
    chain: chainField,
    candidates: S.TupleWithRest(S.Tuple([ClaimTermRef, ClaimTermRef]), [ClaimTermRef])
      .check(
        S.isUnique(
          $I.annote("AntecedentCandidatesUniqueCheck", {
            title: "Distinct candidates",
            description: "No candidate introduction is listed twice.",
            message: "Ambiguous-antecedent candidates must be distinct term references.",
          })
        )
      )
      .annotateKey({
        description: "Two or more distinct introducing terms the referring term could resolve to.",
      }),
  },
  "antecedent-outside-chain": {
    rule: ruleField,
    referring: referringField,
    chain: chainField,
    introducing: ClaimTermRef.annotateKey({
      description: "Introduction found only in a claim outside the dependency chain.",
    }),
  },
  "number-mismatch": {
    rule: ruleField,
    referring: referringField,
    chain: chainField,
    introducing: ClaimTermRef.annotateKey({
      description: "Introduction whose grammatical number disagrees with the referring term.",
    }),
  },
  "pattern-not-covered": {
    rule: ruleField,
    referring: referringField,
  },
});

const chainStartsAtReferringClaim = ({
  chain,
  referring,
}: {
  readonly chain: AntecedentDependencyChain;
  readonly referring: Pick<ClaimTermRef, "path">;
}): boolean => A.headNonEmpty(chain) === claimNumberOfPath(referring.path);

const AntecedentFindingChainCheck = S.makeFilter(
  (finding: typeof AntecedentFindingCases.Type): boolean =>
    AntecedentFindingCases.match(finding, {
      "missing-antecedent": chainStartsAtReferringClaim,
      "ambiguous-antecedent": chainStartsAtReferringClaim,
      "antecedent-outside-chain": chainStartsAtReferringClaim,
      "number-mismatch": chainStartsAtReferringClaim,
      "pattern-not-covered": () => true,
    }),
  $I.annote("AntecedentFindingChainCheck", {
    title: "Chain starts at the referring claim",
    description: "A finding's dependency chain starts at the claim that recites the referring term.",
    message: "The first claim of a finding's chain must be the claim of its referring term.",
  })
);

/**
 * Advisory antecedent-basis diagnostic, discriminated by `kind`.
 *
 * **Details**
 *
 * Every case carries the rule that fired and the referring-term span; every
 * case except `pattern-not-covered` also carries the dependency chain it was
 * resolved against, which starts at the referring term's claim.
 * Introducing-term spans appear only where a candidate exists:
 *
 * - `missing-antecedent`: no introduction anywhere in the chain;
 * - `ambiguous-antecedent`: two or more distinct candidate introductions;
 * - `antecedent-outside-chain`: the introduction sits in a claim outside the
 *   dependency chain, such as a sibling claim;
 * - `number-mismatch`: the introduction disagrees in grammatical number, e.g.
 *   "a plurality of sensors" followed by "the sensor";
 * - `pattern-not-covered`: no rule covers the phrasing, so the term is
 *   surfaced rather than silently passed.
 *
 * Findings are advisory; no case carries a blocking severity.
 *
 * **Example** (Decode a missing-antecedent finding)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AntecedentFinding } from "@beep/law-practice-domain/values/ClaimElement"
 *
 * const finding = Effect.runSync(
 *   S.decodeUnknownEffect(AntecedentFinding)({
 *     kind: "missing-antecedent",
 *     rule: "definite-without-introduction",
 *     referring: { path: "2", anchor: { startChar: 31, endChar: 40, quote: "the lever" } },
 *     chain: [2, 1]
 *   })
 * )
 * console.log(finding.referring.anchor.quote) // "the lever"
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export const AntecedentFinding = S.toTaggedUnion("kind")(
  AntecedentFindingCases.check(AntecedentFindingChainCheck)
).pipe(
  $I.annoteSchema("AntecedentFinding", {
    description:
      "Advisory antecedent-basis finding with the rule that fired, the referring span, and any candidate introductions.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type AntecedentFinding = typeof AntecedentFinding.Type;
