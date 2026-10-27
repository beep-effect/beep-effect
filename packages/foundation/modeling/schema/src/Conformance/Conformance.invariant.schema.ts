/**
 * Specification-backed invariant models and enforcement evidence.
 *
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
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

/**
 * Evidence that a TypeScript or schema type excludes invalid constructions.
 *
 * **Example** (Record that the type system rules out a bad shape)
 *
 * ```ts
 * import { Enforcement, TypeLevelEnforcement } from "@beep/schema/Conformance"
 *
 * const evidence = TypeLevelEnforcement.make({ mechanism: "Heading.depth is the literal union 1 | 2 | 3 | 4 | 5 | 6" })
 *
 * console.log(evidence.kind) // => "typeLevel"
 * console.log(Enforcement.guards.typeLevel(evidence)) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TypeLevelEnforcement extends S.Opaque<TypeLevelEnforcement, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("typeLevel"),
    mechanism: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("TypeLevelEnforcement", {
      description: "Evidence that a TypeScript or schema type excludes invalid constructions.",
    })
  )
) {}

const RuntimeValidatorIdentifier = S.String.check(
  S.isPattern(
    /^[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*$/u,
    $I.annote("RuntimeValidatorIdentifierPattern", {
      title: "Runtime validator identifier",
      description: "An executable JavaScript identifier or dot-separated property path naming one runtime validator.",
      message: "Expected one executable validator identifier such as inspectConformance or Heading.validateOutline",
    })
  )
).pipe(
  $I.annoteSchema("RuntimeValidatorIdentifier", {
    description: "Executable JavaScript identifier or property path naming one runtime conformance validator.",
  })
);

/**
 * Evidence that runtime schema decoding or validation checks an invariant.
 *
 * **Example** (Name the validator that checks an invariant at runtime)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { RuntimeEnforcement } from "@beep/schema/Conformance"
 *
 * const decode = S.decodeUnknownSync(RuntimeEnforcement)
 * const evidence = decode({ kind: "runtime", validator: "Heading.validateOutline" })
 *
 * console.log(evidence.validator) // => "Heading.validateOutline"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RuntimeEnforcement extends S.Opaque<RuntimeEnforcement, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("runtime"),
    validator: RuntimeValidatorIdentifier,
  }).pipe(
    $I.annoteSchema("RuntimeEnforcement", {
      description: "Evidence that runtime schema decoding or validation checks an invariant.",
    })
  )
) {}

/**
 * Evidence that a named static-analysis rule checks an invariant.
 *
 * **Example** (Point at the lint rule that enforces an invariant)
 *
 * ```ts
 * import { StaticAnalysisEnforcement } from "@beep/schema/Conformance"
 *
 * const evidence = StaticAnalysisEnforcement.make({ tool: "oxlint", rule: "beep/no-native-set" })
 *
 * console.log(`${evidence.tool}:${evidence.rule}`) // => "oxlint:beep/no-native-set"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StaticAnalysisEnforcement extends S.Opaque<StaticAnalysisEnforcement, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("staticAnalysis"),
    tool: S.NonEmptyString,
    rule: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("StaticAnalysisEnforcement", {
      description: "Evidence that a named static-analysis rule checks an invariant.",
    })
  )
) {}

/**
 * Evidence that a named test suite checks an invariant against an oracle.
 *
 * **Example** (Cite the suite and oracle that check an invariant)
 *
 * ```ts
 * import { Enforcement, TestEnforcement } from "@beep/schema/Conformance"
 *
 * const evidence = TestEnforcement.make({ suite: "md/test/commonmark-spec.test.ts", oracle: "CommonMark 0.31.2 spec examples" })
 *
 * console.log(Enforcement.isAnyOf(["test", "runtime"])(evidence)) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TestEnforcement extends S.Opaque<TestEnforcement, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("test"),
    suite: S.NonEmptyString,
    oracle: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("TestEnforcement", {
      description: "Evidence that a named test suite checks an invariant against an oracle.",
    })
  )
) {}

/**
 * Documentation-only treatment for an invariant that cannot be mechanically decided here.
 *
 * **Example** (Explain why an invariant is documented rather than checked)
 *
 * ```ts
 * import { DocumentedEnforcement } from "@beep/schema/Conformance"
 *
 * const evidence = DocumentedEnforcement.make({
 *   rationale: "Link reference resolution depends on the full document, which the per-node codec never sees."
 * })
 *
 * console.log(evidence.kind) // => "documented"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocumentedEnforcement extends S.Opaque<DocumentedEnforcement, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("documented"),
    rationale: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("DocumentedEnforcement", {
      description: "Documentation-only treatment for an invariant that cannot be mechanically decided here.",
    })
  )
) {}

/**
 * Explicit evidence that an invariant still has an enforcement gap.
 *
 * **Example** (Record a known enforcement gap)
 *
 * ```ts
 * import { Enforcement, NotEnforced } from "@beep/schema/Conformance"
 *
 * const gap = NotEnforced.make({ gap: "Tab stops inside list items are not normalized yet." })
 *
 * const summary = Enforcement.match(gap, {
 *   typeLevel: () => "types",
 *   runtime: () => "runtime",
 *   staticAnalysis: () => "lint",
 *   test: () => "tests",
 *   documented: () => "documented",
 *   notEnforced: (evidence) => `gap: ${evidence.gap}`
 * })
 *
 * console.log(summary) // => "gap: Tab stops inside list items are not normalized yet."
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NotEnforced extends S.Opaque<NotEnforced, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("notEnforced"),
    gap: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("NotEnforced", {
      description: "Explicit evidence that an invariant still has an enforcement gap.",
    })
  )
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
 * import * as Result from "effect/Result";
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
    toEquivalenceArray: schema.pipe(S.Array, S.toEquivalence),
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

const invariantDescriptorFieldsTestIdsDefault = A.empty<string>();
const InvariantDescriptorFields = S.Struct({
  id: S.NonEmptyString,
  title: S.NonEmptyString,
  statement: S.NonEmptyString,
  strength: RequirementStrength,
  scope: InvariantScope,
  decidability: InvariantDecidability,
  enforcement: S.NonEmptyArray(InvariantEnforcement),
  references: S.NonEmptyArray(SpecificationReference),
  testIds: S.Array(S.NonEmptyString).pipe(
    S.withConstructorDefault(Effect.succeed(invariantDescriptorFieldsTestIdsDefault)),
    S.withDecodingDefaultType(Effect.succeed(invariantDescriptorFieldsTestIdsDefault))
  ),
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
    InvariantDecidability.match({
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
  $I.annote("InvariantDescriptorConsistency", {
    title: "Invariant enforcement consistency",
    description:
      "Test identifiers, exact references, and enforcement evidence are unique, and enforcement agrees with the invariant's decidability boundary.",
    message: "Expected unique testIds, references, and enforcement evidence coherent with decidability",
  })
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
 * import * as Result from "effect/Result";
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
export class InvariantDescriptor extends S.Opaque<InvariantDescriptor, { readonly brand: unique symbol }>()(
  InvariantDescriptorValue.pipe(
    $I.annoteSchema("InvariantDescriptor", {
      description: "Specification-backed statement of one semantic or structural invariant.",
    })
  )
) {}
