/**
 * Offline conformance checking of a JSON-LD graph against the vendored
 * schema.org vocabulary: the issue taxonomy, the failure error, and the
 * validator options.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaOrgId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FOREIGN_PREFIX_SET } from "./internal/vocabulary.ts";
import { JsonLdDocument, referencesOf } from "./JsonLdDocument.ts";
import { Vocabulary } from "./Vocabulary.ts";
import type { JsonLdNode } from "./JsonLdDocument.ts";

const $I = $SchemaOrgId.create("Conformance");

const JsonString = S.fromJsonString(S.String);

/**
 * **Example** (Decode a property term kind)
 *
 * ```ts
 * import { TermKind } from "@beep/schema-org/Conformance";
 * import * as S from "effect/Schema";
 *
 * console.log(S.decodeUnknownSync(TermKind)("property")); // property
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const TermKind = LiteralKit(["type", "property"]).pipe(
  $I.annoteSchema("TermKind", { description: "Which kind of term a UnknownTerm issue is about." })
);

/**
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type TermKind = typeof TermKind.Type;

/**
 * **Details**
 *
 * This is a typo or an invention, and it is **always reported, never silently
 * passed** — a gate that shrugs at a term it does not recognize is
 * decorative. It is deliberately a different issue from
 * {@link PropertyNotOnType}: that one is a real term in the wrong place, this
 * one is not a term. Different cause, different fix.
 *
 * The distinction is only honest because the whole vocabulary ships. Under a
 * scoped subset "unknown" would be irreducibly ambiguous between *you
 * misspelled it* and *that part was not shipped*.
 *
 * **Example** (Construct UnknownTerm issue)
 *
 * ```ts
 * import { UnknownTerm } from "@beep/schema-org/Conformance";
 *
 * const issue = UnknownTerm.make({ nodeId: "#source", nodeType: "SoftwareSourceCode", term: "typo", kind: "property" });
 * console.log(issue._tag); // UnknownTerm
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class UnknownTerm extends S.TaggedClass<UnknownTerm, { readonly brand: unique symbol }>($I`UnknownTerm`)(
  "UnknownTerm",
  {
    /** The `@id` of the node carrying the term. */
    nodeId: S.String.pipe(
      $I.annoteKey("UnknownTerm.nodeId", { description: "The `@id` of the node carrying the term." })
    ),
    /** The `@type` of the node carrying the term. */
    nodeType: S.String.pipe(
      $I.annoteKey("UnknownTerm.nodeType", { description: "The `@type` of the node carrying the term." })
    ),
    /** The unrecognized term. */
    term: S.String.pipe($I.annoteKey("UnknownTerm.term", { description: "The unrecognized term." })),
    /** Whether the term was used as a type or as a property. */
    kind: TermKind.pipe(
      $I.annoteKey("UnknownTerm.kind", { description: "Whether the term was used as a type or as a property." })
    ),
  },
  $I.annote("UnknownTerm", { description: "A term the vendored schema.org vocabulary does not define at all." })
) {
  /**
   * A one-line description of the issue.
   *
   * **Example** (Read the UnknownTerm message)
   *
   * ```ts
   * import { UnknownTerm } from "@beep/schema-org/Conformance";
   * import { Vocabulary } from "@beep/schema-org/Vocabulary";
   *
   * const issue = UnknownTerm.make({ nodeId: "#source", nodeType: "SoftwareSourceCode", term: "typo", kind: "property" });
   * console.log(issue.message === `#source: schema.org ${Vocabulary.version} defines no property "typo"`); // true
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  get message(): string {
    return `${this.nodeId}: schema.org ${Vocabulary.version} defines no ${this.kind} ${Result.getOrThrow(S.encodeResult(JsonString)(this.term))}`;
  }
}

/**
 * **Details**
 *
 * This is the issue that pays for the package. The authentic example is
 * `softwareVersion` on a `SoftwareSourceCode`: it is a real term, defined on
 * `SoftwareApplication`, it reads correct, it serializes fine, and it is
 * silently ignored by every consumer downstream.
 *
 * Legality here is the full inherited answer — the property's `domainIncludes`
 * set intersected with the node type's ancestor closure — so an inherited
 * property like `license` on a `SoftwareSourceCode` never produces this issue.
 *
 * **Example** (Construct PropertyNotOnType issue)
 *
 * ```ts
 * import { PropertyNotOnType } from "@beep/schema-org/Conformance";
 *
 * const issue = PropertyNotOnType.make({ nodeId: "#source", nodeType: "SoftwareSourceCode", property: "softwareVersion" });
 * console.log(issue._tag); // PropertyNotOnType
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class PropertyNotOnType extends S.TaggedClass<PropertyNotOnType, { readonly brand: unique symbol }>(
  $I`PropertyNotOnType`
)(
  "PropertyNotOnType",
  {
    /** The `@id` of the node carrying the property. */
    nodeId: S.String.pipe(
      $I.annoteKey("PropertyNotOnType.nodeId", { description: "The `@id` of the node carrying the property." })
    ),
    /** The `@type` of the node carrying the property. */
    nodeType: S.String.pipe(
      $I.annoteKey("PropertyNotOnType.nodeType", { description: "The `@type` of the node carrying the property." })
    ),
    /** The property that is not legal on that type. */
    property: S.String.pipe(
      $I.annoteKey("PropertyNotOnType.property", { description: "The property that is not legal on that type." })
    ),
  },
  $I.annote("PropertyNotOnType", { description: "A property schema.org defines, used on a type it is not legal on." })
) {
  /**
   * A one-line description of the issue.
   *
   * **Example** (Read the PropertyNotOnType message)
   *
   * ```ts
   * import { PropertyNotOnType } from "@beep/schema-org/Conformance";
   *
   * const issue = PropertyNotOnType.make({ nodeId: "#source", nodeType: "SoftwareSourceCode", property: "softwareVersion" });
   * console.log(issue.message); // #source: schema.org does not define "softwareVersion" on SoftwareSourceCode
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  get message(): string {
    return `${this.nodeId}: schema.org does not define ${Result.getOrThrow(S.encodeResult(JsonString)(this.property))} on ${this.nodeType}`;
  }
}

/**
 * **Details**
 *
 * Deprecated terms are **valid but flagged, never rejected**. The default gate
 * does not fail on this.
 *
 * **Example** (Construct DeprecatedType issue)
 *
 * ```ts
 * import { DeprecatedType } from "@beep/schema-org/Conformance";
 *
 * const issue = DeprecatedType.make({ nodeId: "#page", nodeType: "UserInteraction", supersededBy: "InteractionCounter" });
 * console.log(issue._tag); // DeprecatedType
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class DeprecatedType extends S.TaggedClass<DeprecatedType, { readonly brand: unique symbol }>(
  $I`DeprecatedType`
)(
  "DeprecatedType",
  {
    /** The `@id` of the node. */
    nodeId: S.String.pipe($I.annoteKey("DeprecatedType.nodeId", { description: "The `@id` of the node." })),
    /** The deprecated `@type`. */
    nodeType: S.String.pipe($I.annoteKey("DeprecatedType.nodeType", { description: "The deprecated `@type`." })),
    /** The type schema.org replaced it with. */
    supersededBy: S.String.pipe(
      $I.annoteKey("DeprecatedType.supersededBy", { description: "The type schema.org replaced it with." })
    ),
  },
  $I.annote("DeprecatedType", { description: "A node whose `@type` schema.org has deprecated." })
) {
  /**
   * A one-line description of the issue.
   *
   * **Example** (Read the DeprecatedType message)
   *
   * ```ts
   * import { DeprecatedType } from "@beep/schema-org/Conformance";
   *
   * const issue = DeprecatedType.make({ nodeId: "#page", nodeType: "UserInteraction", supersededBy: "InteractionCounter" });
   * console.log(issue.message); // #page: UserInteraction is superseded by InteractionCounter
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  get message(): string {
    return `${this.nodeId}: ${this.nodeType} is superseded by ${this.supersededBy}`;
  }
}

/**
 * **Example** (Construct DeprecatedProperty issue)
 *
 * ```ts
 * import { DeprecatedProperty } from "@beep/schema-org/Conformance";
 *
 * const issue = DeprecatedProperty.make({ nodeId: "#person", nodeType: "Person", property: "actors", supersededBy: "actor" });
 * console.log(issue._tag); // DeprecatedProperty
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class DeprecatedProperty extends S.TaggedClass<DeprecatedProperty, { readonly brand: unique symbol }>(
  $I`DeprecatedProperty`
)(
  "DeprecatedProperty",
  {
    /** The `@id` of the node carrying the property. */
    nodeId: S.String.pipe(
      $I.annoteKey("DeprecatedProperty.nodeId", { description: "The `@id` of the node carrying the property." })
    ),
    /** The `@type` of the node carrying the property. */
    nodeType: S.String.pipe(
      $I.annoteKey("DeprecatedProperty.nodeType", { description: "The `@type` of the node carrying the property." })
    ),
    /** The deprecated property. */
    property: S.String.pipe($I.annoteKey("DeprecatedProperty.property", { description: "The deprecated property." })),
    /** The property schema.org replaced it with. */
    supersededBy: S.String.pipe(
      $I.annoteKey("DeprecatedProperty.supersededBy", { description: "The property schema.org replaced it with." })
    ),
  },
  $I.annote("DeprecatedProperty", {
    description: "A property schema.org has deprecated. Valid but flagged, exactly as DeprecatedType is.",
  })
) {
  /**
   * A one-line description of the issue.
   *
   * **Example** (Read the DeprecatedProperty message)
   *
   * ```ts
   * import { DeprecatedProperty } from "@beep/schema-org/Conformance";
   *
   * const issue = DeprecatedProperty.make({ nodeId: "#person", nodeType: "Person", property: "actors", supersededBy: "actor" });
   * console.log(issue.message); // #person: actors is superseded by actor
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  get message(): string {
    return `${this.nodeId}: ${this.property} is superseded by ${this.supersededBy}`;
  }
}

/**
 * **Details**
 *
 * Not an error, and reported rather than failed by default: pointing at an
 * organization described on another page is legal, common and often correct.
 * A consumer whose graph is meant to be closed opts into gating on it.
 *
 * **Example** (Construct DanglingReference issue)
 *
 * ```ts
 * import { DanglingReference } from "@beep/schema-org/Conformance";
 *
 * const issue = DanglingReference.make({ nodeId: "#source", nodeType: "SoftwareSourceCode", property: "author", reference: "#author" });
 * console.log(issue._tag); // DanglingReference
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class DanglingReference extends S.TaggedClass<DanglingReference, { readonly brand: unique symbol }>(
  $I`DanglingReference`
)(
  "DanglingReference",
  {
    /** The `@id` of the node holding the reference. */
    nodeId: S.String.pipe(
      $I.annoteKey("DanglingReference.nodeId", { description: "The `@id` of the node holding the reference." })
    ),
    /** The `@type` of the node holding the reference. */
    nodeType: S.String.pipe(
      $I.annoteKey("DanglingReference.nodeType", { description: "The `@type` of the node holding the reference." })
    ),
    /** The property the reference sits in. */
    property: S.String.pipe(
      $I.annoteKey("DanglingReference.property", { description: "The property the reference sits in." })
    ),
    /** The `@id` that no node in this graph defines. */
    reference: S.String.pipe(
      $I.annoteKey("DanglingReference.reference", { description: "The `@id` that no node in this graph defines." })
    ),
  },
  $I.annote("DanglingReference", { description: "A reference to an `@id` no node in the graph defines." })
) {
  /**
   * A one-line description of the issue.
   *
   * **Example** (Read the DanglingReference message)
   *
   * ```ts
   * import { DanglingReference } from "@beep/schema-org/Conformance";
   *
   * const issue = DanglingReference.make({ nodeId: "#source", nodeType: "SoftwareSourceCode", property: "author", reference: "#author" });
   * console.log(issue.message); // #source: author references "#author", which this graph does not define
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  get message(): string {
    return `${this.nodeId}: ${this.property} references ${Result.getOrThrow(S.encodeResult(JsonString)(this.reference))}, which this graph does not define`;
  }
}

/**
 * **Details**
 *
 * Issues carry **no severity field**. Severity is the consumer's policy, not a
 * fact about the graph — a dangling reference is a build failure in a closed
 * graph and correct in an open one — so the gate's options decide which kinds
 * fail, and a lint host is free to render them however it likes.
 *
 * **Example** (Recognize an unknown term issue)
 *
 * ```ts
 * import { ConformanceIssue, UnknownTerm } from "@beep/schema-org/Conformance";
 * import * as S from "effect/Schema";
 *
 * const issue = UnknownTerm.make({ nodeId: "#source", nodeType: "SoftwareSourceCode", term: "typo", kind: "property" });
 * console.log(S.is(ConformanceIssue)(issue)); // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const ConformanceIssue = S.Union([
  UnknownTerm,
  PropertyNotOnType,
  DeprecatedType,
  DeprecatedProperty,
  DanglingReference,
]).pipe($I.annoteSchema("ConformanceIssue", { description: "Anything Conformance.check can report." }));

/**
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type ConformanceIssue = typeof ConformanceIssue.Type;

/**
 * **Details**
 *
 * The error carries **every** issue the check found, not only the failing
 * ones, so a caller rendering it never has to run the check a second time to
 * see the rest.
 *
 * **Example** (Construct a graph conformance error)
 *
 * ```ts
 * import { NonConformantGraphError } from "@beep/schema-org/Conformance";
 *
 * const issue = NonConformantGraphError.make({ issues: [] });
 * console.log(issue._tag); // NonConformantGraphError
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class NonConformantGraphError extends S.TaggedError<NonConformantGraphError, { readonly brand: unique symbol }>(
  $I`NonConformantGraphError`
)(
  "NonConformantGraphError",
  {
    /** Every issue found in the graph, failing or not. */
    issues: S.Array(ConformanceIssue).pipe(
      $I.annoteKey("NonConformantGraphError.issues", { description: "Every issue found in the graph, failing or not." })
    ),
  },
  $I.annoteError<NonConformantGraphError>("NonConformantGraphError", {
    description:
      "Indicates that a graph carries at least one conformance issue of a kind the gate was configured to fail on.",
  })
) {
  /**
   * Summarizes graph nonconformance with the vocabulary version, the first issue and the count of remaining issues.
   *
   * **Example** (Read the NonConformantGraphError message)
   *
   * ```ts
   * import { NonConformantGraphError } from "@beep/schema-org/Conformance";
   * import { Vocabulary } from "@beep/schema-org/Vocabulary";
   *
   * const issue = NonConformantGraphError.make({ issues: [] });
   * console.log(issue.message === `JsonLdDocument is not conformant with schema.org ${Vocabulary.version}: no detail`); // true
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    const first = this.issues[0];
    const rest = this.issues.length - 1;
    const suffix = rest > 0 ? ` (and ${rest} more)` : "";
    return `JsonLdDocument is not conformant with schema.org ${Vocabulary.version}: ${first?.message ?? "no detail"}${suffix}`;
  }
}

const UnknownTermPolicy = LiteralKit(["report", "fail"]).pipe(
  $I.annoteSchema("UnknownTermPolicy", { description: "Whether unknown terms fail the gate." })
);
const DeprecationPolicy = LiteralKit(["ignore", "report"]).pipe(
  $I.annoteSchema("DeprecationPolicy", { description: "Whether deprecated terms fail the gate." })
);
const DanglingReferencePolicy = LiteralKit(["ignore", "report"]).pipe(
  $I.annoteSchema("DanglingReferencePolicy", { description: "Whether dangling references fail the gate." })
);
const defaultUnknownTermPolicy = UnknownTermPolicy.Enum.report;
const defaultDeprecationPolicy = DeprecationPolicy.Enum.ignore;
const defaultDanglingReferencePolicy = DanglingReferencePolicy.Enum.ignore;

/**
 * Which issue kinds fail {@link Conformance.validateResult}.
 *
 * **Details**
 *
 * Every kind is always *reported* by {@link Conformance.check}; these options
 * only decide which ones close the gate.
 *
 * **Example** (Decode the default gate policies)
 *
 * ```ts
 * import { ConformanceOptions } from "@beep/schema-org/Conformance";
 * import * as S from "effect/Schema";
 *
 * const options = S.decodeUnknownSync(ConformanceOptions)({});
 * console.log(options.unknownTerms, options.deprecations, options.danglingReferences); // report ignore ignore
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class ConformanceOptions extends S.Opaque<ConformanceOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * `"report"` (the default) surfaces an {@link UnknownTerm} without failing;
     * `"fail"` is strict mode, for a closed-world caller who controls every
     * term in their graph and wants an invented one to break the build.
     */
    unknownTerms: UnknownTermPolicy.pipe(
      S.withDecodingDefaultKey(Effect.succeed(defaultUnknownTermPolicy)),
      $I.annoteKey("ConformanceOptions.unknownTerms", { description: "Unknown-term gate policy; defaults to report." })
    ),
    /**
     * `"ignore"` (the default) keeps {@link DeprecatedType} and
     * {@link DeprecatedProperty} out of the gate; `"report"` makes them fail it.
     */
    deprecations: DeprecationPolicy.pipe(
      S.withDecodingDefaultKey(Effect.succeed(defaultDeprecationPolicy)),
      $I.annoteKey("ConformanceOptions.deprecations", { description: "Deprecation gate policy; defaults to ignore." })
    ),
    /**
     * `"ignore"` (the default) keeps {@link DanglingReference} out of the gate;
     * `"report"` makes an open graph fail, which is what a consumer whose graph
     * is meant to be closed wants.
     */
    danglingReferences: DanglingReferencePolicy.pipe(
      S.withDecodingDefaultKey(Effect.succeed(defaultDanglingReferencePolicy)),
      $I.annoteKey("ConformanceOptions.danglingReferences", {
        description: "Graph-closure gate policy; defaults to ignore.",
      })
    ),
  }).pipe(
    $I.annoteSchema("ConformanceOptions", { description: "Optional gate policies with safe defaults when decoded." })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ConformanceOptions {
  /**
   * Plain-object policy input; omit a field rather than passing `undefined` (EF-40).
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ConformanceOptions.Encoded;
}

const isJsonLdDocument = S.is(JsonLdDocument);

/** The `@context` prefix for schema.org's own terms. */
const SCHEMA_PREFIX = "schema:";

/**
 * Resolve a written term to the schema.org term it asserts, or `Option.none()`
 * when it belongs to a vocabulary this package does not police.
 *
 * **Details**
 *
 * Four cases, and the two middle ones are each a way to get this silently
 * wrong:
 *
 * - **Bare** (`license`) — native. Validated.
 * - **`schema:`-prefixed** (`schema:license`) — **also native**, because the
 *   prefixed spelling is legal JSON-LD and must be indistinguishable from the
 *   bare one in the output. A "has a colon, skip it" rule would stop checking
 *   anything a consumer writes in prefixed form, which is a validator
 *   answering a question it never evaluated.
 * - **Prefixed with a namespace the vocabulary document's own `@context`
 *   declares** (`gs1:`, `unece:`, `fibo-…`) — foreign. Skipped in silence: the
 *   consumer opted into a vocabulary schema.org aligns with and this package
 *   does not claim to police, so reporting it would be a false rejection.
 * - **Prefixed with anything else** (`bogus:telephone`) — **reported**, as an
 *   unknown term. An undeclared prefix is no evidence that a real vocabulary
 *   was opted into; it is at least as likely to be a typo in a prefix, and
 *   silence is the expensive direction. The recognized set comes from the
 *   document itself rather than a hand-kept list, so a new alignment
 *   vocabulary becomes recognized exactly when schema.org declares it.
 */
function nativeTerm(term: string): O.Option<string> {
  if (Str.startsWith(SCHEMA_PREFIX)(term)) return O.some(Str.slice(SCHEMA_PREFIX.length)(term));
  return O.match(Str.indexOf(":")(term), {
    onNone: () => O.some(term),
    onSome: (colon) => (MutableHashSet.has(FOREIGN_PREFIX_SET, Str.slice(0, colon)(term)) ? O.none() : O.some(term)),
  });
}

/** The terms a node actually asserts: its typed fields plus its flattened catch-all, minus the JSON-LD keywords. */
function assertedTerms(node: JsonLdNode): ReadonlyArray<string> {
  const { additional, ...typed } = node;
  const terms: Array<string> = [];
  for (const [term, value] of R.toEntries<string, unknown>(typed)) {
    if (term === "@id" || term === "@type" || value === undefined) continue;
    terms.push(term);
  }
  for (const term of R.keys(additional ?? {})) terms.push(term);
  return terms;
}

/**
 * The offline conformance gate: does schema.org define this `@type`, and is
 * every property on it legal for that type?
 *
 * **Details**
 *
 * The failure this exists to catch is not malformed JSON — the serializer
 * cannot produce that — but a plausible property schema.org does not define on
 * that type, which reads correct and is silently ignored downstream. Typed
 * fields are correct by construction; the node's `additional` catch-all is
 * where such a term enters a graph, and it is the reason this validator is
 * worth shipping rather than tautological.
 *
 * Everything here is offline and pinned: the vocabulary is compiled in at
 * `Vocabulary.version`, so the same graph gets the same answer on every
 * machine, forever, with no network.
 *
 * **Gotchas**
 *
 * **This is not a Google rich-results checker.** Google requires properties
 * schema.org does not, forbids nothing schema.org allows, and changes its
 * policy on its own schedule. A clean graph here says schema.org defines your
 * terms; it says nothing about whether a rich result will appear.
 *
 * **Example** (Report an illegal source code property)
 *
 * ```ts
 * import { JsonLdDocument } from "@beep/schema-org/JsonLdDocument";
 * import { SoftwareSourceCode } from "@beep/schema-org/SoftwareSourceCode";
 * import { Conformance } from "@beep/schema-org/Conformance";
 * import * as Result from "effect/Result";
 *
 * const graph = Result.getOrThrow(
 * 	JsonLdDocument.buildResult([
 * 		SoftwareSourceCode.make({
 * 			"@id": "https://example.com/pkg#source",
 * 			// `softwareVersion` is a real term, but not legal on SoftwareSourceCode.
 * 			additional: { softwareVersion: "1.2.3" },
 * 		}),
 * 	]),
 * );
 *
 * console.log(Conformance.check(graph)[0]?.message); // https://example.com/pkg#source: schema.org does not define "softwareVersion" on SoftwareSourceCode
 * ```
 *
 * @public
 * @category validation
 * @since 0.0.0
 */
export class Conformance {
  /**
   * Every conformance issue in `graph`, in node order. **Total: it never
   * fails and never throws.**
   *
   * **Details**
   *
   * Reporting is not a failure mode — a caller that wants every problem at
   * once wants a list, and a lint host wants a function it can simply call.
   * {@link Conformance.validateResult} is the gate, and it is defined in
   * terms of this function so the two cannot drift.
   *
   * Two rules are worth knowing before reading the output:
   *
   * - **A prefixed term is skipped entirely, with no issue.** A consumer
   *   writing `gs1:telephone` in a catch-all has deliberately opted into a
   *   vocabulary this package does not claim to police, and reporting it
   *   would be a false rejection.
   * - **When a node's `@type` is unknown, its properties are not checked for
   *   domain legality** — there is no type to check them against, and
   *   reporting every property as misplaced would bury the one issue that
   *   matters. Unrecognized property terms are still reported.
   *
   * **Example** (Check an empty graph)
   *
   * ```ts
   * import { Conformance } from "@beep/schema-org/Conformance";
   * import { JsonLdDocument } from "@beep/schema-org/JsonLdDocument";
   * import * as Result from "effect/Result";
   *
   * const graph = Result.getOrThrow(JsonLdDocument.buildResult([]));
   * console.log(Conformance.check(graph).length); // 0
   * ```
   *
   * @category validation
   * @since 0.0.0
   */
  static check(graph: JsonLdDocument): ReadonlyArray<ConformanceIssue> {
    const issues: Array<ConformanceIssue> = [];
    const defined = graph.nodeIds;

    for (const node of graph["@graph"]) {
      const nodeId = node["@id"];
      const nodeType: string = node["@type"];
      // A foreign `@type` is not ours to judge, and neither are the
      // properties hanging off it — there is no schema.org type to check
      // them against. References are still checked: graph closure is a
      // question about this document, not about a vocabulary.
      O.match(nativeTerm(nodeType), {
        onNone: () => {},
        onSome: (typeTerm) => {
          const typeKnown = Vocabulary.hasType(typeTerm);
          if (!typeKnown) {
            issues.push(UnknownTerm.make({ nodeId, nodeType, term: nodeType, kind: TermKind.Enum.type }));
          } else {
            O.map(Vocabulary.supersededBy(typeTerm), (supersededBy) => {
              issues.push(DeprecatedType.make({ nodeId, nodeType, supersededBy }));
            });
          }
          for (const written of assertedTerms(node)) {
            O.flatMap(nativeTerm(written), (term) => {
              if (!Vocabulary.hasProperty(term)) {
                issues.push(UnknownTerm.make({ nodeId, nodeType, term: written, kind: TermKind.Enum.property }));
                return O.none();
              }
              if (typeKnown && !Vocabulary.isPropertyOn(term, typeTerm)) {
                issues.push(PropertyNotOnType.make({ nodeId, nodeType, property: written }));
                return O.none();
              }
              return O.map(Vocabulary.supersededBy(term), (supersededBy) => {
                issues.push(DeprecatedProperty.make({ nodeId, nodeType, property: written, supersededBy }));
              });
            });
          }
        },
      });

      for (const [property, reference] of referencesOf(node)) {
        if (!HashSet.has(defined, reference)) {
          issues.push(DanglingReference.make({ nodeId, nodeType, property, reference }));
        }
      }
    }

    return issues;
  }

  /**
   * The gate: the graph back when it conforms, or
   * {@link NonConformantGraphError} carrying every issue when it does not.
   *
   * **Details**
   *
   * This is the synchronous primitive, and it is defined in terms of {@link Conformance.check} — the list and
   * the gate cannot disagree about what is wrong with a graph.
   *
   * By default only the structural kinds close the gate:
   * {@link PropertyNotOnType} fails, an {@link UnknownTerm} is reported,
   * and deprecations and dangling references are left to the caller's policy.
   * {@link ConformanceOptions} widens it.
   *
   * **Example** (Validate an empty graph synchronously)
   *
   * ```ts
   * import { Conformance } from "@beep/schema-org/Conformance";
   * import { JsonLdDocument } from "@beep/schema-org/JsonLdDocument";
   * import * as Result from "effect/Result";
   *
   * const graph = Result.getOrThrow(JsonLdDocument.buildResult([]));
   * console.log(Result.isSuccess(Conformance.validateResult(graph))); // true
   * ```
   *
   * @category validation
   * @since 0.0.0
   */
  static readonly validateResult: {
    (
      graph: JsonLdDocument,
      options?: ConformanceOptions.Encoded
    ): Result.Result<JsonLdDocument, NonConformantGraphError>;
    (
      options?: ConformanceOptions.Encoded
    ): (graph: JsonLdDocument) => Result.Result<JsonLdDocument, NonConformantGraphError>;
  } = dual(
    (args) => isJsonLdDocument(args[0]),
    (
      graph: JsonLdDocument,
      options?: ConformanceOptions.Encoded
    ): Result.Result<JsonLdDocument, NonConformantGraphError> => {
      const unknownTerms = options?.unknownTerms ?? defaultUnknownTermPolicy;
      const deprecations = options?.deprecations ?? defaultDeprecationPolicy;
      const danglingReferences = options?.danglingReferences ?? defaultDanglingReferencePolicy;

      const issues = Conformance.check(graph);
      const fails = A.some(issues, (issue) =>
        Match.valueTags(issue, {
          PropertyNotOnType: () => true,
          UnknownTerm: () => unknownTerms === UnknownTermPolicy.Enum.fail,
          DeprecatedType: () => deprecations === DeprecationPolicy.Enum.report,
          DeprecatedProperty: () => deprecations === DeprecationPolicy.Enum.report,
          DanglingReference: () => danglingReferences === DanglingReferencePolicy.Enum.report,
        })
      );

      return fails ? Result.fail(NonConformantGraphError.make({ issues })) : Result.succeed(graph);
    }
  );

  /**
   * The `Effect` twin of {@link Conformance.validateResult}, derived from it
   * so the two cannot drift.
   *
   * **Details**
   *
   * Nothing here is asynchronous and nothing does IO, so the `Effect` carries
   * only the span and the error channel.
   *
   * **Example** (Run the Effect conformance gate)
   *
   * ```ts
   * import { Conformance } from "@beep/schema-org/Conformance";
   * import { JsonLdDocument } from "@beep/schema-org/JsonLdDocument";
   * import * as Result from "effect/Result";
   * import * as Effect from "effect/Effect";
   *
   * const graph = Result.getOrThrow(JsonLdDocument.buildResult([]));
   * console.log(Effect.runSync(Conformance.validate(graph)) === graph); // true
   * ```
   *
   * @category validation
   * @since 0.0.0
   */
  static readonly validate: {
    (
      graph: JsonLdDocument,
      options?: ConformanceOptions.Encoded
    ): Effect.Effect<JsonLdDocument, NonConformantGraphError>;
    (
      options?: ConformanceOptions.Encoded
    ): (graph: JsonLdDocument) => Effect.Effect<JsonLdDocument, NonConformantGraphError>;
  } = dual(
    (args) => isJsonLdDocument(args[0]),
    Effect.fn("Conformance.validate")(
      (
        graph: JsonLdDocument,
        options?: ConformanceOptions.Encoded
      ): Effect.Effect<JsonLdDocument, NonConformantGraphError> =>
        Effect.fromResult(Conformance.validateResult(graph, options))
    )
  );
}
