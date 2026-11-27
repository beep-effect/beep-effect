/**
 * The reader contract declared as data: each operation names the
 * schemas of what it takes, what it yields and how it fails.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as RpcGroup from "effect/rpc/RpcGroup"
import type { Locator } from "./locator.ts"
import {
  Connections,
  Download,
  InventoryList,
  Items,
  MapRun,
  MapStop,
  MapWatch,
  Posts,
  Profile,
  SessionList,
  SessionOpen
} from "./rpcs/index.ts"
import * as Operation from "./rpcs/Operation.ts"

/**
 * The four things any locator can be asked for, on every platform.
 *
 * **Details**
 *
 * The payload is a whole {@link Locator}, so one group covers every platform
 * and the platform is read from the value. `Items`, `Posts` and `Connections` are
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
export const ReaderRpcs = RpcGroup.make(...Operation.contracts({ Items, Posts, Profile, Connections }))
/**
 * What a user does with listings they keep: map them, watch and stop the
 * runs, sign in, and save the files.
 *
 * **Details**
 *
 * Where {@link ReaderRpcs} answers a question about a locator and forgets
 * it, these operations act on state that outlives the call: the records a
 * run fills, the run itself, and the kept sign-ins. `MapRun` answers at
 * once and the run goes on; `MapWatch` is the stream to follow it by, so a
 * client never polls.
 *
 * **Example** (Find the operation that follows a run)
 *
 * ```ts import.meta.vitest name="Find the operation that follows a run"
 * import { LibraryRpcs } from "@beep/scratchpad/int/protocol"
 * import * as O from "effect/Option"
 * import * as RpcSchema from "effect/rpc/RpcSchema"
 *
 * const watch = O.fromNullishOr(LibraryRpcs.requests.get("MapWatch"))
 * O.map(watch, ({ successSchema }) => RpcSchema.isStreamSchema(successSchema)) // => O.some(true)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const LibraryRpcs = RpcGroup.make(
  ...Operation.contracts({ MapRun, MapWatch, MapStop, InventoryList, SessionList, SessionOpen, Download })
)
