/**
 * schema.org as Effect Schema classes: build a JSON-LD graph of typed nodes,
 * and serialize it safely into a `<script>` element.
 *
 * **Details**
 *
 * Assemble nodes with {@link JsonLdDocument}, link them with {@link NodeRef},
 * and write the result with `toScriptBody()`, the escaped serializer. Offline
 * conformance checking against schema.org's vocabulary lives in the separate
 * `@effected/schema-org/validate` entrypoint so a graph-only consumer never
 * loads the vocabulary table.
 *
 * **Example** (Serialize linked source code and documentation nodes)
 *
 * ```ts
 * import { JsonLdDocument, NodeRef, SoftwareSourceCode, TechArticle } from "./index.ts";
 * import * as Result from "effect/Result";
 *
 * const built = JsonLdDocument.buildResult([
 * 	SoftwareSourceCode.make({ "@id": "https://example.com/pkg#source", name: "example" }),
 * 	TechArticle.make({
 * 		"@id": "https://example.com/pkg/docs#intro",
 * 		headline: "Getting started",
 * 		isPartOf: [NodeRef.to("https://example.com/pkg#source")],
 * 	}),
 * ]);
 *
 * console.log(Result.getOrThrow(built).toScriptBody());
 * ```
 *
 * @packageDocumentation
 */

export { APIReference } from "./APIReference.ts";
export { CreativeWork, CreativeWorkFields } from "./CreativeWork.ts";
export {
	ConflictingTermError,
	DuplicateNodeIdError,
	JsonLdDocument,
	JsonLdNode,
} from "./JsonLdDocument.ts";
export type { HasNodeId } from "./NodeRef.ts";
export { InvalidNodeIdError, NodeId, NodeRef } from "./NodeRef.ts";
export { Organization } from "./Organization.ts";
export { Person } from "./Person.ts";
export { SoftwareSourceCode } from "./SoftwareSourceCode.ts";
export { TechArticle, TechArticleFields } from "./TechArticle.ts";
export { ThingFields } from "./Thing.ts";
