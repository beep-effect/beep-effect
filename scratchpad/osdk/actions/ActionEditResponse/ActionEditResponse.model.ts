/**
 * TODO:MODULE_DESCRIPTION
 * 
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("actions/ActionEditResponse/ActionEditResponse.model");

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
 * import * as ActionEditResponse from "@beep/osdk/actions/ActionEditResponse/ActionEditResponse.model";
 * 
 * const thing = ActionEditResponse.Model.make();
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
