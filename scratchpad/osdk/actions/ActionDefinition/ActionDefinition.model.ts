/**
 * TODO:MODULE_DESCRIPTION
 * 
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("actions/ActionDefinition/ActionDefinition.model");

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
 * import * as ActionDefinition from "@beep/osdk/actions/ActionDefinition/ActionDefinition.model";
 * 
 * const thing = ActionDefinition.Model.make();
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
