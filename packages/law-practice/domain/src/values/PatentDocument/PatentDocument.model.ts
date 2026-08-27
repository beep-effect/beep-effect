/**
 * Schema-first patent-application section and claim models.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit, PosInt, SchemaUtils } from "@beep/schema";
import { Number as Num } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import { flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $LawPracticeDomainId.create("values/PatentDocument/PatentDocument.model");

/**
 * Closed section-role domain in the preferred order of 37 CFR 1.77(b).
 *
 * **Details**
 *
 * The order of `Options` is normative. Applications may omit inapplicable
 * sections, while decoded section collections must retain this relative order.
 *
 * **Example** (Inspect the first and last roles)
 *
 * ```ts
 * import { PatentApplicationSectionRole } from "@beep/law-practice-domain/values/PatentDocument"
 *
 * console.log(PatentApplicationSectionRole.Options[0]) // "title-of-invention"
 * console.log(PatentApplicationSectionRole.Options[12]) // "sequence-listing"
 * ```
 *
 * @see {@link https://www.ecfr.gov/current/title-37/section-1.77} for the controlling section order.
 * @see {@link https://www.uspto.gov/web/offices/pac/mpep/s608.html} for USPTO heading guidance and accepted aliases.
 * @category value-objects
 * @since 0.0.0
 */
export const PatentApplicationSectionRole = LiteralKit([
  "title-of-invention",
  "cross-reference-to-related-applications",
  "federally-sponsored-research",
  "joint-research-agreement-parties",
  "incorporation-by-reference",
  "prior-inventor-disclosures",
  "background",
  "summary",
  "drawings-description",
  "detailed-description",
  "claims",
  "abstract",
  "sequence-listing",
]).pipe(
  $I.annoteSchema("PatentApplicationSectionRole", {
    description: "Closed patent specification section roles in the preferred order of 37 CFR 1.77(b).",
  })
);

/**
 * Runtime section-role type produced by {@link PatentApplicationSectionRole}.
 *
 * @see {@link PatentApplicationSectionRole} for the ordered runtime schema.
 * @category value-objects
 * @since 0.0.0
 */
export type PatentApplicationSectionRole = typeof PatentApplicationSectionRole.Type;

/**
 * Transitional phrases preserved between a claim preamble and body.
 *
 * **Example** (Check an open transition)
 *
 * ```ts
 * import { PatentClaimTransition } from "@beep/law-practice-domain/values/PatentDocument"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(PatentClaimTransition)("comprising")) // true
 * ```
 *
 * @see {@link https://www.uspto.gov/web/offices/pac/mpep/s2111.html} for USPTO treatment of claim transition phrases.
 * @category value-objects
 * @since 0.0.0
 */
export const PatentClaimTransition = LiteralKit([
  "comprising",
  "consisting of",
  "consisting essentially of",
  "including",
  "having",
  "wherein",
]).pipe(
  $I.annoteSchema("PatentClaimTransition", {
    description: "Canonical transition phrase separating a patent claim preamble from its body.",
  })
);

/**
 * Runtime transition type produced by {@link PatentClaimTransition}.
 *
 * @see {@link PatentClaimTransition} for the runtime schema and supported phrases.
 * @category value-objects
 * @since 0.0.0
 */
export type PatentClaimTransition = typeof PatentClaimTransition.Type;

const PatentClaimType = LiteralKit(["independent", "dependent"]).annotate(
  $I.annote("PatentClaimType", {
    description: "Independent and dependent patent claim variants.",
  })
);

const PatentClaimFields = {
  claimNumber: PosInt.annotateKey({
    description: "Consecutive Arabic claim number, aligned with ST.96 ClaimNumber.",
  }),
  claimText: S.NonEmptyString.annotateKey({
    description: "Complete claim content, excluding its separate claim number, aligned with ST.96 ClaimText.",
  }),
  preamble: S.NonEmptyString.annotateKey({
    description: "Claim language preceding the transition phrase.",
  }),
  transition: PatentClaimTransition.annotateKey({
    description: "Canonical transition phrase separating the preamble and body.",
  }),
  body: S.NonEmptyString.annotateKey({
    description: "Claim limitations following the transition phrase.",
  }),
};

/**
 * Independent or dependent patent claim with preserved substructure.
 *
 * **Details**
 *
 * Dependent claims carry one or more `claimReferences`, matching ST.96's
 * parent-claim `ClaimReference` concept. Independent claims cannot carry that
 * field, so dependency cardinality is encoded by the tagged union.
 *
 * **Example** (Construct a dependent claim)
 *
 * ```ts
 * import { PatentClaim } from "@beep/law-practice-domain/values/PatentDocument"
 * import { PosInt } from "@beep/schema"
 *
 * const claim = PatentClaim.cases.dependent.make({
 *   body: "the sensor is optical",
 *   claimNumber: PosInt.make(2),
 *   claimReferences: [PosInt.make(1)],
 *   claimText: "The system of claim 1, wherein the sensor is optical.",
 *   preamble: "The system of claim 1,",
 *   transition: "wherein"
 * })
 * console.log(claim.claimType) // "dependent"
 * ```
 *
 * @see {@link https://www.wipo.int/standards/en/st96/v10-0/annex-iv/Index_ClaimType.html} for aligned ClaimNumber and ClaimText names.
 * @see {@link https://www.wipo.int/standards/en/st96/v10-0/annex-iv/Index_ClaimReference.html} for parent-claim references.
 * @see {@link https://www.epo.org/en/legal/guidelines-epc/2026/f_iv_3_4.html} for independent and dependent claim semantics.
 * @category value-objects
 * @since 0.0.0
 */
export const PatentClaim = PatentClaimType.toTaggedUnion("claimType")({
  independent: PatentClaimFields,
  dependent: {
    ...PatentClaimFields,
    claimReferences: S.NonEmptyArray(PosInt).annotateKey({
      description: "Parent claim numbers referenced by this dependent claim, aligned with ST.96 ClaimReference.",
    }),
  },
}).pipe(
  $I.annoteSchema("PatentClaim", {
    description:
      "Patent claim preserving ClaimNumber, ClaimText, preamble, transition, body, and dependency relations.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime tagged-union type produced by {@link PatentClaim}.
 *
 * @see {@link PatentClaim} for case constructors and dependency-aware matching.
 * @category value-objects
 * @since 0.0.0
 */
export type PatentClaim = typeof PatentClaim.Type;

const PatentClaimDependencyIssueKind = LiteralKit([
  "duplicate-claim-number",
  "nonconsecutive-claim-number",
  "missing-parent",
  "self-reference",
  "forward-reference",
  "cycle",
]);

/**
 * Typed diagnostics for an invalid patent claim dependency graph.
 *
 * **Example** (Construct a missing-parent diagnostic)
 *
 * ```ts
 * import { PatentClaimDependencyIssue } from "@beep/law-practice-domain/values/PatentDocument"
 * import { PosInt } from "@beep/schema"
 *
 * const issue = PatentClaimDependencyIssue.cases["missing-parent"].make({
 *   claimNumber: PosInt.make(2),
 *   parentClaimNumber: PosInt.make(9)
 * })
 * console.log(issue.kind) // "missing-parent"
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export const PatentClaimDependencyIssue = PatentClaimDependencyIssueKind.toTaggedUnion("kind")({
  "duplicate-claim-number": {
    claimNumber: PosInt,
  },
  "nonconsecutive-claim-number": {
    actualClaimNumber: PosInt,
    expectedClaimNumber: PosInt,
  },
  "missing-parent": {
    claimNumber: PosInt,
    parentClaimNumber: PosInt,
  },
  "self-reference": {
    claimNumber: PosInt,
  },
  "forward-reference": {
    claimNumber: PosInt,
    parentClaimNumber: PosInt,
  },
  cycle: {
    claimNumbers: S.NonEmptyArray(PosInt),
  },
}).pipe(
  $I.annoteSchema("PatentClaimDependencyIssue", {
    description: "Duplicate, discontinuous, missing, forward, self-referential, or cyclic claim dependency diagnostic.",
  })
);

/**
 * Runtime diagnostic type produced by {@link PatentClaimDependencyIssue}.
 *
 * @see {@link PatentClaimDependencyIssue} for the complete diagnostic case set.
 * @category diagnostics
 * @since 0.0.0
 */
export type PatentClaimDependencyIssue = typeof PatentClaimDependencyIssue.Type;

const claimReferencesOf = (claim: PatentClaim): ReadonlyArray<PosInt> =>
  PatentClaim.match(claim, {
    independent: A.empty<PosInt>,
    dependent: ({ claimReferences }) => claimReferences,
  });

const claimByNumber = (claims: ReadonlyArray<PatentClaim>, claimNumber: PosInt): O.Option<PatentClaim> =>
  A.findFirst(claims, (claim) => Num.Equivalence(claim.claimNumber, claimNumber));

const firstSome: <A>(values: ReadonlyArray<O.Option<A>>) => O.Option<A> = flow(A.findFirst(O.isSome), O.flatten);

const cycleFrom = (
  claims: ReadonlyArray<PatentClaim>,
  current: PosInt,
  path: ReadonlyArray<PosInt>
): O.Option<readonly [PosInt, ...PosInt[]]> =>
  pipe(
    A.findFirstIndex(path, (claimNumber) => Num.Equivalence(claimNumber, current)),
    O.match({
      onNone: () =>
        pipe(
          claimByNumber(claims, current),
          O.flatMap((claim) =>
            pipe(
              claimReferencesOf(claim),
              A.map((claimReference) => cycleFrom(claims, claimReference, A.append(path, current))),
              firstSome
            )
          )
        ),
      onSome: (startIndex) => {
        const cycle = A.drop(path, startIndex);
        return A.isReadonlyArrayNonEmpty(cycle) ? O.some(cycle) : O.none();
      },
    })
  );

const dependencyIssueMessage = (issue: PatentClaimDependencyIssue): string =>
  PatentClaimDependencyIssue.match(issue, {
    "duplicate-claim-number": ({ claimNumber }) => `Claim ${claimNumber} is declared more than once.`,
    "nonconsecutive-claim-number": ({ actualClaimNumber, expectedClaimNumber }) =>
      `Expected claim ${expectedClaimNumber}, received claim ${actualClaimNumber}.`,
    "missing-parent": ({ claimNumber, parentClaimNumber }) =>
      `Claim ${claimNumber} references missing parent claim ${parentClaimNumber}.`,
    "self-reference": ({ claimNumber }) => `Claim ${claimNumber} references itself.`,
    "forward-reference": ({ claimNumber, parentClaimNumber }) =>
      `Claim ${claimNumber} references non-prior claim ${parentClaimNumber}.`,
    cycle: ({ claimNumbers }) =>
      `Claim dependency cycle includes ${pipe(claimNumbers, A.map(String), A.join(" -> "))}.`,
  });

/**
 * Inspects claim numbering and dependency edges without throwing.
 *
 * **Details**
 *
 * Diagnostics cover consecutive numbering, duplicate numbers, missing parents,
 * self/forward references, and cycles. Multiple findings are retained so a
 * caller can explain the whole invalid graph in one response.
 *
 * **Example** (Detect a self-reference)
 *
 * ```ts
 * import { PatentClaim, inspectPatentClaimDependencies } from "@beep/law-practice-domain/values/PatentDocument"
 * import { PosInt } from "@beep/schema"
 *
 * const claim = PatentClaim.cases.dependent.make({
 *   body: "a sensor",
 *   claimNumber: PosInt.make(1),
 *   claimReferences: [PosInt.make(1)],
 *   claimText: "The system of claim 1, comprising a sensor.",
 *   preamble: "The system of claim 1,",
 *   transition: "comprising"
 * })
 * console.log(inspectPatentClaimDependencies([claim]).length > 0) // true
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export const inspectPatentClaimDependencies = (
  claims: ReadonlyArray<PatentClaim>
): ReadonlyArray<PatentClaimDependencyIssue> => {
  const numberingIssues = A.flatMap(claims, (claim, index) => {
    const expectedClaimNumber = PosInt.make(Num.increment(index));
    return A.getSomes([
      A.some(A.take(claims, index), (previous) => Num.Equivalence(previous.claimNumber, claim.claimNumber))
        ? O.some(PatentClaimDependencyIssue.cases["duplicate-claim-number"].make({ claimNumber: claim.claimNumber }))
        : O.none(),
      Num.Equivalence(claim.claimNumber, expectedClaimNumber)
        ? O.none()
        : O.some(
            PatentClaimDependencyIssue.cases["nonconsecutive-claim-number"].make({
              actualClaimNumber: claim.claimNumber,
              expectedClaimNumber,
            })
          ),
    ]);
  });

  const referenceIssues = A.flatMap(claims, (claim) =>
    A.flatMap(claimReferencesOf(claim), (parentClaimNumber) =>
      A.getSomes([
        O.isNone(claimByNumber(claims, parentClaimNumber))
          ? O.some(
              PatentClaimDependencyIssue.cases["missing-parent"].make({
                claimNumber: claim.claimNumber,
                parentClaimNumber,
              })
            )
          : O.none(),
        Num.Equivalence(claim.claimNumber, parentClaimNumber)
          ? O.some(PatentClaimDependencyIssue.cases["self-reference"].make({ claimNumber: claim.claimNumber }))
          : O.none(),
        Num.isGreaterThanOrEqualTo(parentClaimNumber, claim.claimNumber)
          ? O.some(
              PatentClaimDependencyIssue.cases["forward-reference"].make({
                claimNumber: claim.claimNumber,
                parentClaimNumber,
              })
            )
          : O.none(),
      ])
    )
  );

  const cycles = A.reduce(claims, A.empty<readonly [PosInt, ...PosInt[]]>(), (found, claim) =>
    pipe(
      cycleFrom(claims, claim.claimNumber, A.empty()),
      O.filter((cycle) => A.every(found, (known) => A.every(cycle, (claimNumber) => !A.contains(known, claimNumber)))),
      O.match({
        onNone: () => found,
        onSome: (cycle) => A.append(found, cycle),
      })
    )
  );
  const cycleIssues = A.map(cycles, (claimNumbers) => PatentClaimDependencyIssue.cases.cycle.make({ claimNumbers }));

  return A.appendAll(A.appendAll(numberingIssues, referenceIssues), cycleIssues);
};

const PatentClaimStructureCheck = S.makeFilter(
  (claims: ReadonlyArray<PatentClaim>): S.FilterOutput =>
    A.map(inspectPatentClaimDependencies(claims), dependencyIssueMessage),
  {
    identifier: $I`PatentClaimStructureCheck`,
    title: "Valid patent claim dependency graph",
    description: "Patent claims are consecutively numbered and form an acyclic graph over existing prior claims.",
  }
);

/**
 * Non-empty, consecutively numbered, acyclic patent claim collection.
 *
 * **Example** (Validate one independent claim)
 *
 * ```ts
 * import { PatentClaim, PatentClaims } from "@beep/law-practice-domain/values/PatentDocument"
 * import { PosInt } from "@beep/schema"
 * import * as S from "effect/Schema"
 *
 * const claim = PatentClaim.cases.independent.make({
 *   body: "a sensor",
 *   claimNumber: PosInt.make(1),
 *   claimText: "A system comprising a sensor.",
 *   preamble: "A system",
 *   transition: "comprising"
 * })
 * console.log(S.is(PatentClaims)([claim])) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const PatentClaims = S.NonEmptyArray(PatentClaim)
  .check(PatentClaimStructureCheck)
  .pipe(
    $I.annoteSchema("PatentClaims", {
      description: "Non-empty patent claims with consecutive numbering and a valid acyclic dependency graph.",
    })
  );

/**
 * Runtime claim collection produced by {@link PatentClaims}.
 *
 * @see {@link PatentClaims} for dependency validation behavior.
 * @category value-objects
 * @since 0.0.0
 */
export type PatentClaims = typeof PatentClaims.Type;

/**
 * One normalized patent application section.
 *
 * **Example** (Construct a claims section)
 *
 * ```ts
 * import { PatentApplicationSection } from "@beep/law-practice-domain/values/PatentDocument"
 *
 * const section = PatentApplicationSection.make({
 *   content: "1. A system comprising a sensor.",
 *   heading: "CLAIMS",
 *   role: "claims"
 * })
 * console.log(section.role) // "claims"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class PatentApplicationSection extends S.Class<PatentApplicationSection>($I`PatentApplicationSection`)(
  {
    role: PatentApplicationSectionRole.annotateKey({
      description: "Closed section role normalized from the Markdown heading.",
    }),
    heading: S.NonEmptyString.annotateKey({
      description: "Original plain-text heading retained for traceability.",
    }),
    content: S.NonEmptyString.annotateKey({
      description: "Plain-text section content projected from the canonical Markdown AST.",
    }),
  },
  $I.annote("PatentApplicationSection", {
    description: "Patent application section normalized from one recognized Markdown heading and its content.",
  })
) {}

const PatentApplicationSectionIssueKind = LiteralKit(["duplicate-section-role", "out-of-order-section"]);

const PatentApplicationSectionIssue = PatentApplicationSectionIssueKind.toTaggedUnion("kind")({
  "duplicate-section-role": {
    role: PatentApplicationSectionRole,
  },
  "out-of-order-section": {
    previousRole: PatentApplicationSectionRole,
    role: PatentApplicationSectionRole,
  },
});

const sectionRoleIndex = (role: PatentApplicationSectionRole): number =>
  pipe(
    A.findFirstIndex(PatentApplicationSectionRole.Options, (candidate) => Eq.equals(candidate, role)),
    O.getOrElse(() => -1)
  );

const inspectPatentApplicationSections = (
  sections: ReadonlyArray<PatentApplicationSection>
): ReadonlyArray<typeof PatentApplicationSectionIssue.Type> =>
  A.flatMap(sections, (section, index) => {
    const previous = pipe(
      A.get(sections, Num.decrement(index)),
      O.filter(() => Num.isGreaterThan(index, 0))
    );
    return A.getSomes([
      A.some(A.take(sections, index), (candidate) => Eq.equals(candidate.role, section.role))
        ? O.some(PatentApplicationSectionIssue.cases["duplicate-section-role"].make({ role: section.role }))
        : O.none(),
      pipe(
        previous,
        O.filter((candidate) =>
          Num.isGreaterThanOrEqualTo(sectionRoleIndex(candidate.role), sectionRoleIndex(section.role))
        ),
        O.map((candidate) =>
          PatentApplicationSectionIssue.cases["out-of-order-section"].make({
            previousRole: candidate.role,
            role: section.role,
          })
        )
      ),
    ]);
  });

const sectionIssueMessage = (issue: typeof PatentApplicationSectionIssue.Type): string =>
  PatentApplicationSectionIssue.match(issue, {
    "duplicate-section-role": ({ role }) => `Section role ${role} is declared more than once.`,
    "out-of-order-section": ({ previousRole, role }) =>
      `Section role ${role} must not follow later role ${previousRole}.`,
  });

const PatentApplicationSectionOrderCheck = S.makeFilter(
  (sections: ReadonlyArray<PatentApplicationSection>): S.FilterOutput =>
    A.map(inspectPatentApplicationSections(sections), sectionIssueMessage),
  {
    identifier: $I`PatentApplicationSectionOrderCheck`,
    title: "Ordered patent application sections",
    description: "Patent application section roles are unique and retain their relative 37 CFR 1.77(b) order.",
  }
);

/**
 * Non-empty patent application sections in their normative relative order.
 *
 * **Example** (Validate an ordered subset)
 *
 * ```ts
 * import { PatentApplicationSection, PatentApplicationSections } from "@beep/law-practice-domain/values/PatentDocument"
 * import * as S from "effect/Schema"
 *
 * const sections = [
 *   PatentApplicationSection.make({ content: "Sensor system", heading: "TITLE OF THE INVENTION", role: "title-of-invention" }),
 *   PatentApplicationSection.make({ content: "1. A system.", heading: "CLAIMS", role: "claims" })
 * ]
 * console.log(S.is(PatentApplicationSections)(sections)) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const PatentApplicationSections = S.NonEmptyArray(PatentApplicationSection)
  .check(PatentApplicationSectionOrderCheck)
  .pipe(
    $I.annoteSchema("PatentApplicationSections", {
      description: "Non-empty unique patent application sections in relative 37 CFR 1.77(b) order.",
    })
  );

/**
 * Runtime section collection produced by {@link PatentApplicationSections}.
 *
 * @see {@link PatentApplicationSections} for order and uniqueness validation.
 * @category value-objects
 * @since 0.0.0
 */
export type PatentApplicationSections = typeof PatentApplicationSections.Type;

const PatentApplicationDocumentFields = S.Struct({
  sections: PatentApplicationSections,
  claims: PatentClaims,
  sourceText: S.NonEmptyString.annotateKey({
    description: "Plain-text projection of the source Markdown document used for claim evidence alignment.",
  }),
});

const PatentApplicationDocumentCoherenceCheck = S.makeFilter(
  (document: typeof PatentApplicationDocumentFields.Type): S.FilterOutput => {
    const hasClaimsSection = A.some(document.sections, (section) => Eq.equals(section.role, "claims"));
    const claimsAlign = A.every(document.claims, (claim) => Str.includes(claim.claimText)(document.sourceText));
    return A.getSomes([
      hasClaimsSection ? O.none<string>() : O.some("Patent application document must include a claims section."),
      claimsAlign ? O.none<string>() : O.some("Every patent claim must align to the normalized source text."),
    ]);
  },
  {
    identifier: $I`PatentApplicationDocumentCoherenceCheck`,
    title: "Coherent patent application document",
    description:
      "A patent application has a claims section and every typed claim aligns to its normalized source text.",
  }
);

/**
 * Normalized Markdown patent application with typed ordered sections and claims.
 *
 * **Example** (Construct a minimal document)
 *
 * ```ts
 * import { PatentApplicationDocument, PatentApplicationSection, PatentClaim } from "@beep/law-practice-domain/values/PatentDocument"
 * import { PosInt } from "@beep/schema"
 *
 * const claim = PatentClaim.cases.independent.make({
 *   body: "a sensor",
 *   claimNumber: PosInt.make(1),
 *   claimText: "A system comprising a sensor.",
 *   preamble: "A system",
 *   transition: "comprising"
 * })
 * const document = PatentApplicationDocument.make({
 *   claims: [claim],
 *   sections: [
 *     PatentApplicationSection.make({ content: "Sensor system", heading: "TITLE", role: "title-of-invention" }),
 *     PatentApplicationSection.make({ content: "1. A system comprising a sensor.", heading: "CLAIMS", role: "claims" })
 *   ],
 *   sourceText: "Sensor system\nCLAIMS\n1. A system comprising a sensor."
 * })
 * console.log(document.claims.length) // 1
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class PatentApplicationDocument extends S.Class<PatentApplicationDocument>($I`PatentApplicationDocument`)(
  PatentApplicationDocumentFields.check(PatentApplicationDocumentCoherenceCheck),
  $I.annote("PatentApplicationDocument", {
    description: "Normalized Markdown patent application with ordered sections and validated claim dependencies.",
  })
) {}
