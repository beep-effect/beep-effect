/**
 * Specification-backed invariant models and enforcement evidence.
 *
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { LiteralKit } from "../LiteralKit/index.ts";
import * as SchemaUtils from "../SchemaUtils/index.ts";
import { SpecificationReference } from "./Conformance.source.schema.ts";

const $I = $SchemaId.create("Conformance/invariant");

/**
 * RFC-style requirement strength carried by a conformance invariant.
 *
 * **Example** (Recognize a mandatory prohibition)
 *
 * ```ts import.meta.vitest name="Recognize a mandatory prohibition"
 * import { RequirementStrength } from "@beep/schema/Conformance"
 *
 * RequirementStrength.is.mustNot("mustNot") // => true
 * RequirementStrength.is.mustNot("sometimes") // => false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RequirementStrength = LiteralKit(["must", "mustNot", "should", "shouldNot", "may"]).pipe(
  $I.annoteSchema("RequirementStrength", {
    description: "RFC-style requirement strength carried by a conformance invariant.",
  })
);

/**
 * Runtime value accepted by {@link RequirementStrength}.
 *
 * @see {@link RequirementStrength} for membership helpers and decoding.
 * @category models
 * @since 0.0.0
 */
export type RequirementStrength = typeof RequirementStrength.Type;

/**
 * Structural region governed by a conformance invariant.
 *
 * **Example** (Recognize document scope)
 *
 * ```ts import.meta.vitest name="Recognize document scope"
 * import { InvariantScope } from "@beep/schema/Conformance"
 *
 * InvariantScope.is.document("document") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const InvariantScope = LiteralKit([
  "value",
  "node",
  "children",
  "attributes",
  "subtree",
  "document",
  "serialization",
  "conversion",
]).pipe(
  $I.annoteSchema("InvariantScope", {
    description: "Structural region governed by a conformance invariant.",
  })
);

/**
 * Runtime value accepted by {@link InvariantScope}.
 *
 * @see {@link InvariantScope} for membership helpers and decoding.
 * @category models
 * @since 0.0.0
 */
export type InvariantScope = typeof InvariantScope.Type;

/**
 * Strongest boundary at which an invariant can be decided.
 *
 * **Example** (Recognize contextual runtime decidability)
 *
 * ```ts import.meta.vitest name="Recognize contextual runtime decidability"
 * import { InvariantDecidability } from "@beep/schema/Conformance"
 *
 * InvariantDecidability.is.contextualRuntime("contextualRuntime") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const InvariantDecidability = LiteralKit([
  "typeLevel",
  "localRuntime",
  "contextualRuntime",
  "externalAuthority",
  "undecidable",
]).pipe(
  $I.annoteSchema("InvariantDecidability", {
    description: "Strongest boundary at which an invariant can be decided.",
  })
);

/**
 * Runtime value accepted by {@link InvariantDecidability}.
 *
 * @see {@link InvariantDecidability} for membership helpers and decoding.
 * @category models
 * @since 0.0.0
 */
export type InvariantDecidability = typeof InvariantDecidability.Type;

const InvariantEnforcementKind = LiteralKit([
  "typeLevel",
  "runtime",
  "staticAnalysis",
  "test",
  "documented",
  "notEnforced",
]);

class TypeLevelEnforcement extends S.Class<TypeLevelEnforcement>($I`TypeLevelEnforcement`)(
  {
    kind: S.tag("typeLevel"),
    mechanism: S.NonEmptyString,
  },
  $I.annote("TypeLevelEnforcement", {
    description: "Evidence that a TypeScript or schema type excludes invalid constructions.",
  })
) {}

class RuntimeEnforcement extends S.Class<RuntimeEnforcement>($I`RuntimeEnforcement`)(
  {
    kind: S.tag("runtime"),
    validator: S.NonEmptyString,
  },
  $I.annote("RuntimeEnforcement", {
    description: "Evidence that runtime schema decoding or validation checks an invariant.",
  })
) {}

class StaticAnalysisEnforcement extends S.Class<StaticAnalysisEnforcement>($I`StaticAnalysisEnforcement`)(
  {
    kind: S.tag("staticAnalysis"),
    tool: S.NonEmptyString,
    rule: S.NonEmptyString,
  },
  $I.annote("StaticAnalysisEnforcement", {
    description: "Evidence that a named static-analysis rule checks an invariant.",
  })
) {}

class TestEnforcement extends S.Class<TestEnforcement>($I`TestEnforcement`)(
  {
    kind: S.tag("test"),
    suite: S.NonEmptyString,
    oracle: S.NonEmptyString,
  },
  $I.annote("TestEnforcement", {
    description: "Evidence that a named test suite checks an invariant against an oracle.",
  })
) {}

class DocumentedEnforcement extends S.Class<DocumentedEnforcement>($I`DocumentedEnforcement`)(
  {
    kind: S.tag("documented"),
    rationale: S.NonEmptyString,
  },
  $I.annote("DocumentedEnforcement", {
    description: "Documentation-only treatment for an invariant that cannot be mechanically decided here.",
  })
) {}

class NotEnforced extends S.Class<NotEnforced>($I`NotEnforced`)(
  {
    kind: S.tag("notEnforced"),
    gap: S.NonEmptyString,
  },
  $I.annote("NotEnforced", {
    description: "Explicit evidence that an invariant still has an enforcement gap.",
  })
) {}

/**
 * Discriminated evidence describing how an invariant is enforced or why it is not.
 *
 * **Details**
 *
 * Mechanically enforced cases carry their concrete mechanism. Documentation
 * and gap cases require a rationale, preventing an absent implementation from
 * being reported as runtime or type-level enforcement.
 *
 * **Example** (Decode runtime enforcement evidence)
 *
 * ```ts import.meta.vitest name="Decode runtime enforcement evidence"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { Enforcement } from "@beep/schema/Conformance"
 *
 * const result = S.decodeUnknownResult(Enforcement)({
 *   kind: "runtime",
 *   validator: "Heading.validateOutline"
 * })
 *
 * Result.isSuccess(result) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const InvariantEnforcement = InvariantEnforcementKind.mapMembers(
  Tuple.evolve([
    () => TypeLevelEnforcement,
    () => RuntimeEnforcement,
    () => StaticAnalysisEnforcement,
    () => TestEnforcement,
    () => DocumentedEnforcement,
    () => NotEnforced,
  ])
).pipe(
  S.toTaggedUnion("kind"),
  SchemaUtils.withStatics((schema) => ({
    toEquivalenceArray: schema.pipe(S.Array, SchemaUtils.toEquivalence),
  })),
  $I.annoteSchema("InvariantEnforcement", {
    description: "Discriminated evidence describing how an invariant is enforced or why it is not.",
  })
);

/**
 * Runtime enforcement evidence represented by {@link InvariantEnforcement}.
 *
 * @see {@link InvariantEnforcement} for constructors and exhaustive matching.
 * @category models
 * @since 0.0.0
 */
export type InvariantEnforcement = typeof InvariantEnforcement.Type;

const InvariantDescriptorFields = S.Struct({
  id: S.NonEmptyString,
  title: S.NonEmptyString,
  statement: S.NonEmptyString,
  strength: RequirementStrength,
  scope: InvariantScope,
  decidability: InvariantDecidability,
  enforcement: S.NonEmptyArray(InvariantEnforcement),
  references: S.NonEmptyArray(SpecificationReference),
  testIds: S.Array(S.NonEmptyString).pipe(SchemaUtils.withEmptyArrayDefaults<string>()),
}).pipe(
  $I.annoteSchema("InvariantDescriptorFields", {
    description: "Fields of one specification-backed invariant descriptor.",
  })
);

const hasCoherentEnforcement = (descriptor: typeof InvariantDescriptorFields.Type): boolean => {
  const typeLevel = A.some(descriptor.enforcement, InvariantEnforcement.guards.typeLevel);
  const runtime = A.some(descriptor.enforcement, InvariantEnforcement.guards.runtime);
  const staticAnalysis = A.some(descriptor.enforcement, InvariantEnforcement.guards.staticAnalysis);
  const documented = A.some(descriptor.enforcement, InvariantEnforcement.guards.documented);
  const notEnforced = A.some(descriptor.enforcement, InvariantEnforcement.guards.notEnforced);
  const mechanicallyEnforced = typeLevel || runtime || staticAnalysis;
  const explicitGap = documented || notEnforced;
  const gapDoesNotContradictMechanicalEvidence = !notEnforced || !mechanicallyEnforced;

  return (
    gapDoesNotContradictMechanicalEvidence &&
    InvariantDecidability.$match({
      typeLevel: () => typeLevel,
      localRuntime: () => runtime || staticAnalysis || explicitGap,
      contextualRuntime: () => runtime || staticAnalysis || explicitGap,
      externalAuthority: () => !mechanicallyEnforced && explicitGap,
      undecidable: () => !mechanicallyEnforced && explicitGap,
    })(descriptor.decidability)
  );
};

const InvariantDescriptorConsistency = S.makeFilter(
  (descriptor: typeof InvariantDescriptorFields.Type) =>
    A.dedupe(descriptor.testIds).length === descriptor.testIds.length &&
    A.dedupe(descriptor.references).length === descriptor.references.length &&
    A.dedupe(descriptor.enforcement).length === descriptor.enforcement.length &&
    hasCoherentEnforcement(descriptor),
  {
    identifier: $I`InvariantDescriptorConsistency`,
    title: "Invariant enforcement consistency",
    description:
      "Test identifiers, exact references, and enforcement evidence are unique, and enforcement agrees with the invariant's decidability boundary.",
    message: "Expected unique testIds, references, and enforcement evidence coherent with decidability",
  }
);

const InvariantDescriptorValue = InvariantDescriptorFields.check(InvariantDescriptorConsistency);

/**
 * Specification-backed statement of one semantic or structural invariant.
 *
 * **Details**
 *
 * Type-level invariants require type-level evidence. Locally or contextually
 * decidable invariants require runtime/static evidence or an explicit gap.
 * External-authority and undecidable invariants require documented or
 * not-enforced evidence and cannot claim mechanical enforcement. Exact
 * duplicate references, enforcement evidence, and test identifiers are rejected.
 *
 * **Example** (Decode a heading-content invariant)
 *
 * ```ts import.meta.vitest name="Decode a heading-content invariant"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { Invariant } from "@beep/schema/Conformance"
 *
 * const result = S.decodeUnknownResult(Invariant)({
 *   id: "html.heading.no-heading-descendants",
 *   title: "Heading descendants exclude headings",
 *   statement: "An HTML heading cannot contain another heading element.",
 *   strength: "mustNot",
 *   scope: "children",
 *   decidability: "typeLevel",
 *   enforcement: [{ kind: "typeLevel", mechanism: "HtmlHeadingChildren" }],
 *   references: [{ sourceId: "whatwg-html", section: "The h1, h2, h3, h4, h5, and h6 elements" }]
 * })
 *
 * Result.isSuccess(result) // => true
 * ```
 *
 * @invariant Test identifiers, exact references, and enforcement evidence are unique and coherent with decidability.
 * @category models
 * @since 0.0.0
 */
export class InvariantDescriptor extends S.Class<InvariantDescriptor>($I`InvariantDescriptor`)(
  InvariantDescriptorValue,
  $I.annote("InvariantDescriptor", {
    description: "Specification-backed statement of one semantic or structural invariant.",
  })
) {
  static readonly toEquivalenceArray = InvariantDescriptor.pipe(S.Array, SchemaUtils.toEquivalence);
}
