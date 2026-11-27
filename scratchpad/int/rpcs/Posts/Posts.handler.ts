import type * as Rpc from "effect/rpc/Rpc"
import { posts } from "../../content.ts"
import type { Contract } from "./Posts.contract.ts"

export const Handler = (({ locator }) => posts(locator)) satisfies Rpc.ToHandlerFn<typeof Contract>
