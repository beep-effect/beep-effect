import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FOREIGN_PREFIX_SET } from "./internal/vocabulary.ts";
import { type JsonLdDocument, type JsonLdNode, referencesOf } from "./JsonLdDocument.ts";
import { Vocabulary } from "./Vocabulary.ts";

const $I = $ScratchpadId.create("effected/schema-org/Conformance");

/**
 * Which kind of term a {@link UnknownTerm} issue is about.
 *
 * **Example** (Decode a property term kind)
 *
 * ```ts
 * import { TermKind } from "@beep/scratchpad/effected/schema-org/Conformance";
 * import * as S from "effect/Schema";
 *
 * console.log(S.decodeUnknownSync(TermKind)("property")); // property
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const TermKind = LiteralKit(["type", "property"]).pipe($I.annoteSchema("TermKind", { description: "Which kind of term a UnknownTerm issue is about." }));

/**
 * Which kind of term a {@link UnknownTerm} issue is about.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type TermKind = typeof TermKind.Type;

/**
 * A term the vendored schema.org vocabulary does not define at all.
 *
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
 * import { UnknownTerm } from "@beep/scratchpad/effected/schema-org/Conformance";
 *
 * const issue = UnknownTerm.make({ nodeId: "#source", nodeType: "SoftwareSourceCode", term: "typo", kind: "property" });
 * console.log(issue._tag); // UnknownTerm
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class UnknownTerm extends S.TaggedClass<UnknownTerm>($I`UnknownTerm`)("UnknownTerm", {
	/** The `@id` of the node carrying the term. */
	nodeId: S.String.annotateKey({ description: "The `@id` of the node carrying the term." }),
	/** The `@type` of the node carrying the term. */
	nodeType: S.String.annotateKey({ description: "The `@type` of the node carrying the term." }),
	/** The unrecognized term. */
	term: S.String.annotateKey({ description: "The unrecognized term." }),
	/** Whether the term was used as a type or as a property. */
	kind: TermKind.annotateKey({ description: "Whether the term was used as a type or as a property." }),
}, $I.annote("UnknownTerm", { description: "A term the vendored schema.org vocabulary does not define at all." })) {
	/**
	 * A one-line description of the issue.
	 *
	 * **Example** (Read the UnknownTerm message)
	 *
	 * ```ts
	 * import { UnknownTerm } from "@beep/scratchpad/effected/schema-org/Conformance";
	 * import { Vocabulary } from "@beep/scratchpad/effected/schema-org/Vocabulary";
	 *
	 * const issue = UnknownTerm.make({ nodeId: "#source", nodeType: "SoftwareSourceCode", term: "typo", kind: "property" });
	 * console.log(issue.message === `#source: schema.org ${Vocabulary.version} defines no property "typo"`); // true
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	get message(): string {
		return `${this.nodeId}: schema.org ${Vocabulary.version} defines no ${this.kind} ${JSON.stringify(this.term)}`;
	}
}

/**
 * A property schema.org defines, used on a type it is not legal on.
 *
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
 * import { PropertyNotOnType } from "@beep/scratchpad/effected/schema-org/Conformance";
 *
 * const issue = PropertyNotOnType.make({ nodeId: "#source", nodeType: "SoftwareSourceCode", property: "softwareVersion" });
 * console.log(issue._tag); // PropertyNotOnType
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class PropertyNotOnType extends S.TaggedClass<PropertyNotOnType>($I`PropertyNotOnType`)("PropertyNotOnType", {
	/** The `@id` of the node carrying the property. */
	nodeId: S.String.annotateKey({ description: "The `@id` of the node carrying the property." }),
	/** The `@type` of the node carrying the property. */
	nodeType: S.String.annotateKey({ description: "The `@type` of the node carrying the property." }),
	/** The property that is not legal on that type. */
	property: S.String.annotateKey({ description: "The property that is not legal on that type." }),
}, $I.annote("PropertyNotOnType", { description: "A property schema.org defines, used on a type it is not legal on." })) {
	/**
	 * A one-line description of the issue.
	 *
	 * **Example** (Read the PropertyNotOnType message)
	 *
	 * ```ts
	 * import { PropertyNotOnType } from "@beep/scratchpad/effected/schema-org/Conformance";
	 *
	 * const issue = PropertyNotOnType.make({ nodeId: "#source", nodeType: "SoftwareSourceCode", property: "softwareVersion" });
	 * console.log(issue.message); // #source: schema.org does not define "softwareVersion" on SoftwareSourceCode
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	get message(): string {
		return `${this.nodeId}: schema.org does not define ${JSON.stringify(this.property)} on ${this.nodeType}`;
	}
}

/**
 * A node whose `@type` schema.org has deprecated.
 *
 * **Details**
 *
 * Deprecated terms are **valid but flagged, never rejected**. The default gate
 * does not fail on this.
 *
 * **Example** (Construct DeprecatedType issue)
 *
 * ```ts
 * import { DeprecatedType } from "@beep/scratchpad/effected/schema-org/Conformance";
 *
 * const issue = DeprecatedType.make({ nodeId: "#page", nodeType: "UserInteraction", supersededBy: "InteractionCounter" });
 * console.log(issue._tag); // DeprecatedType
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class DeprecatedType extends S.TaggedClass<DeprecatedType>($I`DeprecatedType`)("DeprecatedType", {
	/** The `@id` of the node. */
	nodeId: S.String.annotateKey({ description: "The `@id` of the node." }),
	/** The deprecated `@type`. */
	nodeType: S.String.annotateKey({ description: "The deprecated `@type`." }),
	/** The type schema.org replaced it with. */
	supersededBy: S.String.annotateKey({ description: "The type schema.org replaced it with." }),
}, $I.annote("DeprecatedType", { description: "A node whose `@type` schema.org has deprecated." })) {
	/**
	 * A one-line description of the issue.
	 *
	 * **Example** (Read the DeprecatedType message)
	 *
	 * ```ts
	 * import { DeprecatedType } from "@beep/scratchpad/effected/schema-org/Conformance";
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
 * A property schema.org has deprecated. Valid but flagged, exactly as
 * {@link DeprecatedType} is.
 *
 * **Example** (Construct DeprecatedProperty issue)
 *
 * ```ts
 * import { DeprecatedProperty } from "@beep/scratchpad/effected/schema-org/Conformance";
 *
 * const issue = DeprecatedProperty.make({ nodeId: "#person", nodeType: "Person", property: "actors", supersededBy: "actor" });
 * console.log(issue._tag); // DeprecatedProperty
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class DeprecatedProperty extends S.TaggedClass<DeprecatedProperty>($I`DeprecatedProperty`)("DeprecatedProperty", {
	/** The `@id` of the node carrying the property. */
	nodeId: S.String.annotateKey({ description: "The `@id` of the node carrying the property." }),
	/** The `@type` of the node carrying the property. */
	nodeType: S.String.annotateKey({ description: "The `@type` of the node carrying the property." }),
	/** The deprecated property. */
	property: S.String.annotateKey({ description: "The deprecated property." }),
	/** The property schema.org replaced it with. */
	supersededBy: S.String.annotateKey({ description: "The property schema.org replaced it with." }),
}, $I.annote("DeprecatedProperty", { description: "A property schema.org has deprecated. Valid but flagged, exactly as DeprecatedType is." })) {
	/**
	 * A one-line description of the issue.
	 *
	 * **Example** (Read the DeprecatedProperty message)
	 *
	 * ```ts
	 * import { DeprecatedProperty } from "@beep/scratchpad/effected/schema-org/Conformance";
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
 * A reference to an `@id` no node in the graph defines.
 *
 * **Details**
 *
 * Not an error, and reported rather than failed by default: pointing at an
 * organization described on another page is legal, common and often correct.
 * A consumer whose graph is meant to be closed opts into gating on it.
 *
 * **Example** (Construct DanglingReference issue)
 *
 * ```ts
 * import { DanglingReference } from "@beep/scratchpad/effected/schema-org/Conformance";
 *
 * const issue = DanglingReference.make({ nodeId: "#source", nodeType: "SoftwareSourceCode", property: "author", reference: "#author" });
 * console.log(issue._tag); // DanglingReference
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class DanglingReference extends S.TaggedClass<DanglingReference>($I`DanglingReference`)("DanglingReference", {
	/** The `@id` of the node holding the reference. */
	nodeId: S.String.annotateKey({ description: "The `@id` of the node holding the reference." }),
	/** The `@type` of the node holding the reference. */
	nodeType: S.String.annotateKey({ description: "The `@type` of the node holding the reference." }),
	/** The property the reference sits in. */
	property: S.String.annotateKey({ description: "The property the reference sits in." }),
	/** The `@id` that no node in this graph defines. */
	reference: S.String.annotateKey({ description: "The `@id` that no node in this graph defines." }),
}, $I.annote("DanglingReference", { description: "A reference to an `@id` no node in the graph defines." })) {
	/**
	 * A one-line description of the issue.
	 *
	 * **Example** (Read the DanglingReference message)
	 *
	 * ```ts
	 * import { DanglingReference } from "@beep/scratchpad/effected/schema-org/Conformance";
	 *
	 * const issue = DanglingReference.make({ nodeId: "#source", nodeType: "SoftwareSourceCode", property: "author", reference: "#author" });
	 * console.log(issue.message); // #source: author references "#author", which this graph does not define
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	get message(): string {
		return `${this.nodeId}: ${this.property} references ${JSON.stringify(this.reference)}, which this graph does not define`;
	}
}

/**
 * Anything {@link Conformance.check} can report.
 *
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
 * import { ConformanceIssue, UnknownTerm } from "@beep/scratchpad/effected/schema-org/Conformance";
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
 * Anything {@link Conformance.check} can report.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type ConformanceIssue = typeof ConformanceIssue.Type;

/**
 * Indicates that a graph carries at least one conformance issue of a kind the
 * gate was configured to fail on.
 *
 * **Details**
 *
 * The error carries **every** issue the check found, not only the failing
 * ones, so a caller rendering it never has to run the check a second time to
 * see the rest.
 *
 * **Example** (Construct a graph conformance error)
 *
 * ```ts
 * import { NonConformantGraphError } from "@beep/scratchpad/effected/schema-org/Conformance";
 *
 * const issue = NonConformantGraphError.make({ issues: [] });
 * console.log(issue._tag); // NonConformantGraphError
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class NonConformantGraphError extends S.TaggedError<NonConformantGraphError>($I`NonConformantGraphError`)("NonConformantGraphError", {
	/** Every issue found in the graph, failing or not. */
	issues: S.Array(ConformanceIssue).annotateKey({ description: "Every issue found in the graph, failing or not." }),
}, $I.annote("NonConformantGraphError", { description: "Indicates that a graph carries at least one conformance issue of a kind the gate was configured to fail on." })) {
	/**
	 * Summarizes graph nonconformance with the vocabulary version, the first issue and the count of remaining issues.
	 *
	 * **Example** (Read the NonConformantGraphError message)
	 *
	 * ```ts
	 * import { NonConformantGraphError } from "@beep/scratchpad/effected/schema-org/Conformance";
	 * import { Vocabulary } from "@beep/scratchpad/effected/schema-org/Vocabulary";
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
	$I.annoteSchema("UnknownTermPolicy", { description: "Whether unknown terms fail the gate." }),
);
const DeprecationPolicy = LiteralKit(["ignore", "report"]).pipe(
	$I.annoteSchema("DeprecationPolicy", { description: "Whether deprecated terms fail the gate." }),
);
const DanglingReferencePolicy = LiteralKit(["ignore", "report"]).pipe(
	$I.annoteSchema("DanglingReferencePolicy", { description: "Whether dangling references fail the gate." }),
);

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
 * import { ConformanceOptions } from "@beep/scratchpad/effected/schema-org/Conformance";
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
export const ConformanceOptions = S.Struct({
	/**
	 * `"report"` (the default) surfaces an {@link UnknownTerm} without failing;
	 * `"fail"` is strict mode, for a closed-world caller who controls every
	 * term in their graph and wants an invented one to break the build.
	 */
	unknownTerms: UnknownTermPolicy.pipe(
		S.withDecodingDefault(Effect.succeed(UnknownTermPolicy.Enum.report)),
	).annotateKey({ description: "Unknown-term gate policy; defaults to report." }),
	/**
	 * `"ignore"` (the default) keeps {@link DeprecatedType} and
	 * {@link DeprecatedProperty} out of the gate; `"report"` makes them fail it.
	 */
	deprecations: DeprecationPolicy.pipe(
		S.withDecodingDefault(Effect.succeed(DeprecationPolicy.Enum.ignore)),
	).annotateKey({ description: "Deprecation gate policy; defaults to ignore." }),
	/**
	 * `"ignore"` (the default) keeps {@link DanglingReference} out of the gate;
	 * `"report"` makes an open graph fail, which is what a consumer whose graph
	 * is meant to be closed wants.
	 */
	danglingReferences: DanglingReferencePolicy.pipe(
		S.withDecodingDefault(Effect.succeed(DanglingReferencePolicy.Enum.ignore)),
	).annotateKey({ description: "Graph-closure gate policy; defaults to ignore." }),
}).pipe($I.annoteSchema("ConformanceOptions", { description: "Optional gate policies with safe defaults when decoded." }));

/**
 * Plain-object policy input, including omitted and explicitly undefined fields.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ConformanceOptions = typeof ConformanceOptions.Encoded;

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
		onSome: (colon) => MutableHashSet.has(FOREIGN_PREFIX_SET, Str.slice(0, colon)(term)) ? O.none() : O.some(term),
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
 * import { JsonLdDocument } from "@beep/scratchpad/effected/schema-org/JsonLdDocument";
 * import { SoftwareSourceCode } from "@beep/scratchpad/effected/schema-org/SoftwareSourceCode";
 * import { Conformance } from "@beep/scratchpad/effected/schema-org/Conformance";
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
	 * import { Conformance } from "@beep/scratchpad/effected/schema-org/Conformance";
	 * import { JsonLdDocument } from "@beep/scratchpad/effected/schema-org/JsonLdDocument";
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
	 * import { Conformance } from "@beep/scratchpad/effected/schema-org/Conformance";
	 * import { JsonLdDocument } from "@beep/scratchpad/effected/schema-org/JsonLdDocument";
	 * import * as Result from "effect/Result";
	 *
	 * const graph = Result.getOrThrow(JsonLdDocument.buildResult([]));
	 * console.log(Result.isSuccess(Conformance.validateResult(graph))); // true
	 * ```
	 *
	 * @category validation
	 * @since 0.0.0
	 */
	static validateResult(
		graph: JsonLdDocument,
		options?: ConformanceOptions,
	): Result.Result<JsonLdDocument, NonConformantGraphError> {
		const unknownTerms = options?.unknownTerms ?? "report";
		const deprecations = options?.deprecations ?? "ignore";
		const danglingReferences = options?.danglingReferences ?? "ignore";

		const issues = Conformance.check(graph);
		const fails = A.some(issues, (issue) => Match.valueTags(issue, {
			PropertyNotOnType: () => true,
			UnknownTerm: () => unknownTerms === "fail",
			DeprecatedType: () => deprecations === "report",
			DeprecatedProperty: () => deprecations === "report",
			DanglingReference: () => danglingReferences === "report",
		}));

		return fails ? Result.fail(NonConformantGraphError.make({ issues })) : Result.succeed(graph);
	}

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
	 * import { Conformance } from "@beep/scratchpad/effected/schema-org/Conformance";
	 * import { JsonLdDocument } from "@beep/scratchpad/effected/schema-org/JsonLdDocument";
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
	static readonly validate = Effect.fn("Conformance.validate")((graph: JsonLdDocument, options?: ConformanceOptions) =>
		Effect.fromResult(Conformance.validateResult(graph, options)),
	);
}
