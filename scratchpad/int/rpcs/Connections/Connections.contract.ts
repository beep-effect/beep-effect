import * as S from "effect/Schema"
import { $ScratchpadId } from "@beep/identity/packages"
import { Locator, MapFailure } from "../../locator.ts"
import { Account, Connection, ConnectionsHidden } from "../../content.ts"
import * as Rpc from "effect/rpc/Rpc"

const $I = $ScratchpadId.create("int/rpcs/Connections")

export class Payload extends S.Opaque<Payload, {
  readonly brand: unique symbol
}>()(
  S.Struct({
    locator: Locator,
    connection: Connection
  }).pipe($I.annoteSchema("Payload", { description: "The locator whose connections are read and the direction to follow." }))
) {
}

export class Success extends Account {
}

export class Failure extends S.Union([MapFailure, ConnectionsHidden]) {
}


export const Contract = Rpc.make("Connections", {
  payload: Payload,
  success: Success,
  error: Failure,
  stream: true
})
