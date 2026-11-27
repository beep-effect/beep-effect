import * as S from "effect/Schema"
import { $ScratchpadId } from "@beep/identity/packages"
import { Locator, MapFailure } from "../../locator.ts"
import { Profile } from "../../content.ts"
import * as Rpc from "effect/rpc/Rpc"

const $I = $ScratchpadId.create("int/rpcs/Profile")

export class Payload extends S.Opaque<Payload, {
  readonly brand: unique symbol
}>()(
  S.Struct({
    locator: Locator
  }).pipe($I.annoteSchema("Payload", { description: "The locator whose profile is read." }))
) {
}

export class Success extends Profile {
}

export class Failure extends MapFailure {
}


export const Contract = Rpc.make("Profile", {
  payload: Payload,
  success: Success,
  error: Failure
})
