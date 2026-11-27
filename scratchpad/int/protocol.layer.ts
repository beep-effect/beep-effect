/**
 * The layer that serves the reader contract, kept apart from the contract so
 * that a client importing the protocol never loads a handler.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { ReaderRpcs } from "./protocol.ts"
import * as Operation from "./rpcs/Operation.ts"
import { Connections, Items, Posts, Profile } from "./rpcs/server.ts"

/**
 * Serves {@link ReaderRpcs} from whatever readers and mappers are provided.
 *
 * **Details**
 *
 * Each handler is the dispatcher of the same name, which picks the reader or
 * mapper of the locator's platform, so the layer needs all fourteen readers and
 * all fourteen mappers, and existing implementations serve the protocol
 * unchanged.
 *
 * **Example** (Count the operations the layer serves)
 *
 * ```ts import.meta.vitest name="Count the operations the layer serves"
 * import { ReaderRpcs } from "@beep/scratchpad/int/protocol"
 * import { ReaderHandlers } from "@beep/scratchpad/int/protocol.layer"
 * import * as Layer from "effect/Layer"
 *
 * Layer.isLayer(ReaderHandlers) // => true
 * ReaderRpcs.requests.size // => 4
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ReaderHandlers = ReaderRpcs.toLayer(Operation.handlers({ Items, Posts, Profile, Connections }))
