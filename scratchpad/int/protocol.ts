/**
 * The reader contract declared as data: each operation names the
 * schemas of what it takes, what it yields and how it fails.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as RpcGroup from "effect/rpc/RpcGroup"
import type { Locator } from "./locator.ts"
import { Connections, Posts, Profile } from "./rpcs/index.ts"

/**
 * The three things any locator can be asked for, on every platform.
 *
 * **Details**
 *
 * The payload is a whole {@link Locator}, so one group covers every platform
 * and the platform is read from the value. `Posts` and `Connections` are
 * streams, so their failures travel in the stream and keep their tags. A
 * caller reaches them through a client built from this group; where the
 * handlers run is the client's concern, in this process or behind a transport.
 *
 * **Example** (Find an operation and whether it streams)
 *
 * ```ts import.meta.vitest name="Find an operation and whether it streams"
 * import { ReaderRpcs } from "@beep/scratchpad/int/protocol"
 * import * as O from "effect/Option"
 * import * as RpcSchema from "effect/rpc/RpcSchema"
 *
 * const posts = O.fromNullishOr(ReaderRpcs.requests.get("Posts"))
 * O.map(posts, ({ successSchema }) => RpcSchema.isStreamSchema(successSchema)) // => O.some(true)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const ReaderRpcs = RpcGroup.make(
  Posts.Contract,
  Profile.Contract,
  Connections.Contract
)

