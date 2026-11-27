import * as Effect from "effect/Effect"
import type * as Rpc from "effect/rpc/Rpc"
import { profile } from "../../content.ts"
import type { Contract, Payload } from "./Profile.contract.ts"

export const Handler = Effect.fn("Profile.Handler")(({ locator }: Payload) =>
  profile(locator)
) satisfies Rpc.ToHandlerFn<typeof Contract>
