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
 * @public
 */
export const TermKind = LiteralKit(["type", "property"]).pipe($I.annoteSchema("TermKind", { description: "Which kind of term a UnknownTerm issue is about." }));

/**
 * Which kind of term a {@link UnknownTerm} issue is about.
 *
 * @public
 */
export type TermKind = typeof TermKind.Type;

/**
 * A term the vendored schema.org vocabulary does not define at all.
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
 * @public
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
	/** A one-line description of the issue. */
	get message(): string {
		return `${this.nodeId}: schema.org ${Vocabulary.version} defines no ${this.kind} ${JSON.stringify(this.term)}`;
	}
}

/**
 * A property schema.org defines, used on a type it is not legal on.
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
 * @public
 */
export class PropertyNotOnType extends S.TaggedClass<PropertyNotOnType>($I`PropertyNotOnType`)("PropertyNotOnType", {
	/** The `@id` of the node carrying the property. */
	nodeId: S.String.annotateKey({ description: "The `@id` of the node carrying the property." }),
	/** The `@type` of the node carrying the property. */
	nodeType: S.String.annotateKey({ description: "The `@type` of the node carrying the property." }),
	/** The property that is not legal on that type. */
	property: S.String.annotateKey({ description: "The property that is not legal on that type." }),
}, $I.annote("PropertyNotOnType", { description: "A property schema.org defines, used on a type it is not legal on." })) {
	/** A one-line description of the issue. */
	get message(): string {
		return `${this.nodeId}: schema.org does not define ${JSON.stringify(this.property)} on ${this.nodeType}`;
	}
}

/**
 * A node whose `@type` schema.org has deprecated.
 *
 * Deprecated terms are **valid but flagged, never rejected**. The default gate
 * does not fail on this.
 *
 * @public
 */
export class DeprecatedType extends S.TaggedClass<DeprecatedType>($I`DeprecatedType`)("DeprecatedType", {
	/** The `@id` of the node. */
	nodeId: S.String.annotateKey({ description: "The `@id` of the node." }),
	/** The deprecated `@type`. */
	nodeType: S.String.annotateKey({ description: "The deprecated `@type`." }),
	/** The type schema.org replaced it with. */
	supersededBy: S.String.annotateKey({ description: "The type schema.org replaced it with." }),
}, $I.annote("DeprecatedType", { description: "A node whose `@type` schema.org has deprecated." })) {
	/** A one-line description of the issue. */
	get message(): string {
		return `${this.nodeId}: ${this.nodeType} is superseded by ${this.supersededBy}`;
	}
}

/**
 * A property schema.org has deprecated. Valid but flagged, exactly as
 * {@link DeprecatedType} is.
 *
 * @public
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
	/** A one-line description of the issue. */
	get message(): string {
		return `${this.nodeId}: ${this.property} is superseded by ${this.supersededBy}`;
	}
}

/**
 * A reference to an `@id` no node in the graph defines.
 *
 * Not an error, and reported rather than failed by default: pointing at an
 * organization described on another page is legal, common and often correct.
 * A consumer whose graph is meant to be closed opts into gating on it.
 *
 * @public
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
	/** A one-line description of the issue. */
	get message(): string {
		return `${this.nodeId}: ${this.property} references ${JSON.stringify(this.reference)}, which this graph does not define`;
	}
}

/**
 * Anything {@link Conformance.check} can report.
 *
 * Issues carry **no severity field**. Severity is the consumer's policy, not a
 * fact about the graph — a dangling reference is a build failure in a closed
 * graph and correct in an open one — so the gate's options decide which kinds
 * fail, and a lint host is free to render them however it likes.
 *
 * @public
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
 */
export type ConformanceIssue = typeof ConformanceIssue.Type;

/**
 * Indicates that a graph carries at least one conformance issue of a kind the
 * gate was configured to fail on.
 *
 * The error carries **every** issue the check found, not only the failing
 * ones, so a caller rendering it never has to run the check a second time to
 * see the rest.
 *
 * @public
 */
export class NonConformantGraphError extends S.TaggedError<NonConformantGraphError>($I`NonConformantGraphError`)("NonConformantGraphError", {
	/** Every issue found in the graph, failing or not. */
	issues: S.Array(ConformanceIssue).annotateKey({ description: "Every issue found in the graph, failing or not." }),
}, $I.annote("NonConformantGraphError", { description: "Indicates that a graph carries at least one conformance issue of a kind the gate was configured to fail on." })) {
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
 * Every kind is always *reported* by {@link Conformance.check}; these options
 * only decide which ones close the gate.
 *
 * @public
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

/** Plain-object policy input, including omitted and explicitly undefined fields. */
export type ConformanceOptions = typeof ConformanceOptions.Encoded;

/** The `@context` prefix for schema.org's own terms. */
const SCHEMA_PREFIX = "schema:";

/**
 * Resolve a written term to the schema.org term it asserts, or `Option.none()`
 * when it belongs to a vocabulary this package does not police.
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
 * **This is not a Google rich-results checker.** Google requires properties
 * schema.org does not, forbids nothing schema.org allows, and changes its
 * policy on its own schedule. A clean graph here says schema.org defines your
 * terms; it says nothing about whether a rich result will appear.
 *
 * @example
 * ```ts
 * import { JsonLdDocument, SoftwareSourceCode } from "./index.ts";
 * import { Conformance } from "./conformance-entry.ts";
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
 * for (const issue of Conformance.check(graph)) console.log(issue.message);
 * // => https://example.com/pkg#source: schema.org does not define "softwareVersion" on SoftwareSourceCode
 * ```
 *
 * @public
 */
export class Conformance {
	/**
	 * Every conformance issue in `graph`, in node order. **Total: it never
	 * fails and never throws.**
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
	 * This is the synchronous primitive, and it is defined in terms of {@link Conformance.check} — the list and
	 * the gate cannot disagree about what is wrong with a graph.
	 *
	 * By default only the structural kinds close the gate:
	 * {@link PropertyNotOnType} fails, an {@link UnknownTerm} is reported,
	 * and deprecations and dangling references are left to the caller's policy.
	 * {@link ConformanceOptions} widens it.
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
	 * so the two cannot drift. Nothing here is asynchronous and nothing does
	 * IO, so the `Effect` carries only the span and the error channel.
	 */
	static readonly validate = Effect.fn("Conformance.validate")((graph: JsonLdDocument, options?: ConformanceOptions) =>
		Effect.fromResult(Conformance.validateResult(graph, options)),
	);
}
