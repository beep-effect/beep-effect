/**
 * The layer that serves the reader contract, kept apart from the contract so
 * that a client importing the protocol never loads a handler.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { ReaderRpcs } from "./protocol.ts"
import * as Handlers from "./rpcs/handlers.ts"

/**
 * Serves {@link ReaderRpcs} from whatever readers are provided.
 *
 * **Details**
 *
 * Each handler is the dispatcher of the same name, which picks the reader of
 * the locator's platform, so the layer needs all fourteen readers and existing
 * reader implementations serve the protocol unchanged.
 *
 * **Example** (Count the operations the layer serves)
 *
 * ```ts import.meta.vitest name="Count the operations the layer serves"
 * import { ReaderRpcs } from "@beep/scratchpad/int/protocol"
 * import { ReaderHandlers } from "@beep/scratchpad/int/protocol.handler"
 * import * as Layer from "effect/Layer"
 *
 * Layer.isLayer(ReaderHandlers) // => true
 * ReaderRpcs.requests.size // => 3
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ReaderHandlers = ReaderRpcs.toLayer({
  Posts: Handlers.Posts,
  Profile: Handlers.Profile,
  Connections: Handlers.Connections
})
