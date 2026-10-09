import { Schema } from "effect";
import { CreativeWorkFields } from "./CreativeWork.ts";
import { NodeRef } from "./NodeRef.ts";

/**
 * A schema.org `SoftwareSourceCode` — the node describing a package's source.
 *
 * Note that the version property is `version`, inherited from `CreativeWork`.
 * `softwareVersion` reads like the right name and is **not** legal here:
 * schema.org defines it on `SoftwareApplication`. It serializes fine and is
 * silently ignored downstream, which is exactly the failure the conformance
 * validator exists to catch.
 *
 * @example
 * ```ts
 * import { NodeRef, SoftwareSourceCode } from "./index.ts";
 *
 * const pkg = SoftwareSourceCode.make({
 * 	"@id": "https://example.com/pkg#source",
 * 	name: "example",
 * 	version: "1.2.3",
 * 	codeRepository: "https://github.com/example/example",
 * 	programmingLanguage: ["TypeScript"],
 * 	license: ["https://spdx.org/licenses/MIT"],
 * 	author: [NodeRef.to("https://example.com/#alice")],
 * });
 * ```
 *
 * @public
 */
export class SoftwareSourceCode extends Schema.Class<SoftwareSourceCode>("SoftwareSourceCode")({
	...CreativeWorkFields,
	/** The JSON-LD type discriminator, populated automatically. */
	"@type": Schema.tag("SoftwareSourceCode"),
	/** The repository the code lives in. Single-valued. */
	codeRepository: Schema.optional(Schema.String),
	/** The languages the code is written in. Repeatable. */
	programmingLanguage: Schema.optional(Schema.Array(Schema.String)),
	/** Runtime platforms the code targets. Repeatable. */
	runtimePlatform: Schema.optional(Schema.Array(Schema.String)),
	/** Products this code produces, by reference. Repeatable. */
	targetProduct: Schema.optional(Schema.Array(NodeRef)),
}) {}
