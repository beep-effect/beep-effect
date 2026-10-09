import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { CreativeWorkFields } from "./CreativeWork.ts";
import { NodeRef } from "./NodeRef.ts";

const $I = $ScratchpadId.create("effected/schema-org/SoftwareSourceCode");

/**
 * A schema.org `SoftwareSourceCode` — the node describing a package's source.
 *
 * **Details**
 *
 * Note that the version property is `version`, inherited from `CreativeWork`.
 * `softwareVersion` reads like the right name and is **not** legal here:
 * schema.org defines it on `SoftwareApplication`. It serializes fine and is
 * silently ignored downstream, which is exactly the failure the conformance
 * validator exists to catch.
 *
 * **Example** (Describe package source code and its version)
 *
 * ```ts
 * import { NodeRef } from "@beep/scratchpad/effected/schema-org/NodeRef";
 * import { SoftwareSourceCode } from "@beep/scratchpad/effected/schema-org/SoftwareSourceCode";
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
 *
 * console.log(pkg.version) // 1.2.3
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class SoftwareSourceCode extends S.Class<SoftwareSourceCode>($I`SoftwareSourceCode`)({
	...CreativeWorkFields,
	/**
	 * The JSON-LD type discriminator, populated automatically.
	 *
	 * @since 0.0.0
	 */
	"@type": S.tag("SoftwareSourceCode").annotateKey({ description: "The JSON-LD type discriminator, populated automatically." }),
	/**
	 * The repository the code lives in. Single-valued.
	 *
	 * @since 0.0.0
	 */
	codeRepository: S.optional(S.String).annotateKey({ description: "The repository the code lives in. Single-valued." }),
	/**
	 * The languages the code is written in. Repeatable.
	 *
	 * @since 0.0.0
	 */
	programmingLanguage: S.String.pipe(S.Array, S.optional).annotateKey({ description: "The languages the code is written in. Repeatable." }),
	/**
	 * Runtime platforms the code targets. Repeatable.
	 *
	 * @since 0.0.0
	 */
	runtimePlatform: S.String.pipe(S.Array, S.optional).annotateKey({ description: "Runtime platforms the code targets. Repeatable." }),
	/**
	 * Products this code produces, by reference. Repeatable.
	 *
	 * @since 0.0.0
	 */
	targetProduct: NodeRef.pipe(S.Array, S.optional).annotateKey({ description: "Products this code produces, by reference. Repeatable." }),
}, $I.annote("SoftwareSourceCode", { description: "A schema.org `SoftwareSourceCode` — the node describing a package's source." })) {}
