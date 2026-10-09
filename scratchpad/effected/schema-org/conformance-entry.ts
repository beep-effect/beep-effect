/**
 * The offline conformance half of `@effected/schema-org`: the vendored
 * schema.org vocabulary and the validator that reads it.
 *
 * **Details**
 *
 * This is a **separate entrypoint on purpose**. The vocabulary table is the
 * whole of what a graph-only consumer avoids: importing `@effected/schema-org`
 * loads the node classes and the serializer and nothing else, while the table
 * is reachable only from here. An unbundled Node consumer that imported one
 * barrel would otherwise load 73 KB of vocabulary literals it never reads, and
 * validation is the build-time half of a consumer's work — a CI gate — while
 * graph assembly runs in the page render path.
 *
 * The graph types below are re-exported **as types only**, so they are erased
 * at runtime and the split holds: `Conformance.check` takes a `JsonLdDocument`, and its
 * declaration has to be able to name one.
 *
 * **Example** (Read the vocabulary version and check graph conformance)
 *
 * ```ts
 * import { Conformance, Vocabulary } from "@beep/scratchpad/effected/schema-org/conformance-entry";
 * import { JsonLdDocument, SoftwareSourceCode } from "@beep/scratchpad/effected/schema-org/index";
 * import * as Result from "effect/Result";
 *
 * const graph = Result.getOrThrow(
 *   JsonLdDocument.buildResult([SoftwareSourceCode.make({ "@id": "https://example.com/pkg#source", name: "example" })]),
 * );
 *
 * console.log(Vocabulary.version); // => "30.0"
 * for (const issue of Conformance.check(graph)) console.log(issue.message);
 * ```
 *
 * @packageDocumentation
 */

// Type-only: named by the validator's signatures, erased at runtime.
export type { APIReference } from "./APIReference.ts";
export type { ConformanceOptions } from "./Conformance.ts";
export {
	Conformance,
	ConformanceIssue,
	DanglingReference,
	DeprecatedProperty,
	DeprecatedType,
	NonConformantGraphError,
	PropertyNotOnType,
	TermKind,
	UnknownTerm,
} from "./Conformance.ts";
export type { CreativeWork } from "./CreativeWork.ts";
export type { ConflictingTermError, DuplicateNodeIdError, JsonLdNode } from "./JsonLdDocument.ts";
// `JsonLdDocument` is the one VALUE re-export here: it is the parameter type of every
// validator entry point, and API Extractor needs the class itself — not just
// its type — declared by this entrypoint. It costs a conformance consumer
// nothing they were not already holding, and it does not carry the vocabulary
// table in the other direction, which is the cost the split exists to avoid.
export { JsonLdDocument } from "./JsonLdDocument.ts";
export type { HasNodeId, InvalidNodeIdError, NodeRef } from "./NodeRef.ts";
export type { Organization } from "./Organization.ts";
export type { Person } from "./Person.ts";
export type { SoftwareSourceCode } from "./SoftwareSourceCode.ts";
export type { TechArticle } from "./TechArticle.ts";
export { Vocabulary } from "./Vocabulary.ts";
