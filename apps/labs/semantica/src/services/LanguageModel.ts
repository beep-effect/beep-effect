import { $SemanticaId } from "@beep/identity/packages";
import { Context } from "effect";
import type { ModelIdentity } from "@/schema/Model";

const $I = $SemanticaId.create("services/LanguageModel");

/**
 * Model identity paired with the active Effect AI language-model Layer.
 *
 * **Details**
 *
 * Keeping this identity in the context prevents callers from selecting a
 * provider without also selecting the exact cache namespace for its model,
 * prompt artifact, and task.
 *
 * **Example** (Read the active identity service)
 *
 * ```ts
 * import { ActiveModelIdentity } from "@/services/LanguageModel"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(ActiveModelIdentity)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ActiveModelIdentity extends Context.Service<ActiveModelIdentity, ModelIdentity>()(
  $I`ActiveModelIdentity`
) {}
