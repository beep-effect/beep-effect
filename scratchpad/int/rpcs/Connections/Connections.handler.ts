import type * as Rpc from "effect/rpc/Rpc"
import { connections } from "../../content.ts"
import type { Contract } from "./Connections.contract.ts"

export const Handler = (({ locator, connection }) => connections(locator, connection)) satisfies Rpc.ToHandlerFn<
  typeof Contract
>
