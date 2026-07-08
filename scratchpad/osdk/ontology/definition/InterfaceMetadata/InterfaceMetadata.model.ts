/**
 * TODO:MODULE_DESCRIPTION
 * 
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("ontology/definition/InterfaceMetadata/InterfaceMetadata.model");

/**
 * TODO:DESCRIPTION
 * 
 * **When to use**
 * 
 * TODO:WHEN_TO_USE
 * 
 * **Gotchas**
 * 
 * TODO:GOTCHAS
 * 
 * **Example** (TODO:EXAMPLE_DESCRIPTION)
 * 
 * ```ts
 * import * as InterfaceMetadata from "@beep/osdk/ontology/definition/InterfaceMetadata/InterfaceMetadata.model";
 * 
 * const thing = InterfaceMetadata.Model.make();
 * 
 * console.log(thing);
 * ```
 * 
 * @category models
 * @since 0.0.0
 */
export class Model extends S.Class<Model>($I`Model`)(
	{},
	$I.annote("Model", {
		description: ""
	})
) {}
