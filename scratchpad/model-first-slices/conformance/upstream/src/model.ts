// Ported from alchemy-run/alchemy packages/integration-tests/test/Domain/conformance/model.ts
// at 33c10dd55f (2.0.0-beta.87), adapted to this repository's Effect rules; behaviour unchanged.
/**
 * The model every Domain platform runs for the conformance suite: an
 * aggregate that rejects, a view, a policy that starts a saga, a saga that
 * writes to another aggregate, and a policy that schedules and cancels a
 * command. Between them the platform hosts every kind of object and runs
 * its workflow engine and its durable timers.
 */
import * as Domain from "@alchemy.run/domain"
import * as Tuple from "effect/Tuple"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { LiteralKit } from "@beep/schema/LiteralKit"
import * as S from "effect/Schema"
import * as Activity from "effect/workflow/Activity"
import { thunkEffectVoid } from "@beep/utils"
import { $ScratchpadId } from "@beep/identity/packages"
import { pipe } from "effect/Function"

const $I = $ScratchpadId.create("model-first-slices/conformance/upstream/model")

export class Incremented extends Domain.Event("Incremented", { by: S.Int }) {
}

export class TooBig extends S.TaggedError<TooBig, {
  readonly brand: unique symbol
}>()("TooBig", { max: S.Int }) {
}

export class Increment extends Domain.Command("Increment", {
  target: S.String,
  input: { by: S.Int },
  events: [Incremented],
  rejects: [TooBig],
  reply: { total: S.Int }
}) {
}

export class Counter extends Domain.Aggregate("Counter", {
  id: S.String,
  state: S.Struct({ total: S.Int }),
  initial: { total: 0 },
  commands: [Increment],
  decide: {
    Increment: (_, command) =>
      command.by > 10 ? TooBig.make({ max: 10 }) : [Incremented.make({ by: command.by })]
  },
  evolve: {
    Incremented: (state, event) => ({ total: state.total + event.by })
  },
  reply: {
    Increment: (state) => ({ total: state.total })
  }
}) {
}

export class Mirrored extends Domain.Event("Mirrored", { by: S.Int }) {
}

export class Mirror extends Domain.Command("Mirror", {
  target: S.String,
  input: { by: S.Int },
  events: [Mirrored]
}) {
}

/** What the saga writes, so a test can see that it ran. */
export class Echo extends Domain.Aggregate("Echo", {
  id: S.String,
  state: S.Struct({ total: S.Int }),
  initial: { total: 0 },
  commands: [Mirror],
  decide: {
    Mirror: (_, command) => [Mirrored.make({ by: command.by })]
  },
  evolve: {
    Mirrored: (state, event) => ({ total: state.total + event.by })
  }
}) {
}

export class CounterTotal extends Domain.View("CounterTotal", {
  from: [Counter],
  key: Counter,
  state: S.Struct({ total: S.Int, increments: S.Int }),
  initial: { total: 0, increments: 0 },
  evolve: {
    Incremented: (view, event) => ({
      total: view.total + event.by,
      increments: view.increments + 1
    })
  }
}) {
}

/** Mirrors a counter's first increment onto its Echo; one run per counter. */
export class MirrorFirst extends Domain.Saga("MirrorFirst", {
  key: S.String,
  input: { by: S.Int }
}) {
}

const MirrorFirstLive = MirrorFirst.toLayer(
  Effect.gen(function* () {
    const echoes = yield* Echo
    return Effect.fn(function* ({ key, by }) {
      yield* Activity.make({
        name: "mirror",
        execute: echoes.send(key, Mirror.make({ by })).pipe(Effect.orDie)
      })
    })
  })
)

export class StartMirror extends Domain.Policy("StartMirror", {
  from: Counter,
  on: [Incremented]
}) {
}

const StartMirrorLive = StartMirror.toLayer(
  Effect.gen(function* () {
    const mirrors = yield* MirrorFirst
    return Effect.fn(function* ({ source, event }) {
      yield* mirrors.start(source, { by: event.by })
    })
  })
)

/** How long a hold lasts before it expires, unless it is released first. */
export const HOLD_WINDOW = "4 seconds"
/** The command id a hold's expiry is scheduled under. */
export const EXPIRY = "expire"

export class HoldPlaced extends Domain.Event("HoldPlaced") {
}

export class HoldReleased extends Domain.Event("HoldReleased") {
}

export class HoldExpired extends Domain.Event("HoldExpired") {
}

export class PlaceHold extends Domain.Command("PlaceHold", {
  target: S.String,
  events: [HoldPlaced]
}) {
}

export class ReleaseHold extends Domain.Command("ReleaseHold", {
  target: S.String,
  events: [HoldReleased]
}) {
}

export class ExpireHold extends Domain.Command("ExpireHold", {
  target: S.String,
  events: [HoldExpired]
}) {
}

export const HoldStateTag = LiteralKit(
  [
    "none",
    "held",
    "released",
    "expired"
  ]
).pipe(
  S.annotate({
    description: "Literal value representing the state of a hold"
  })
)

export const HoldState = HoldStateTag.mapMembers((members) => {
  const make = <T extends typeof HoldStateTag.Type>({ literal }: S.Literal<T>) => S.Struct({
    status: S.tag(literal)
  })
  return pipe(
    members,
    Tuple.evolve(
      [
        make,
        make,
        make,
        make
      ]
    )
  )
}).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("HoldState", {
    description: "The Hold State Object representing the state of a hold"
  })
)

export type HoldState = typeof HoldState.Type;

export declare namespace HoldState {
  export type Encoded =
    | { readonly status: "none" }
    | { readonly status: "held" }
    | { readonly status: "released" }
    | { readonly status: "expired" }
}

export class Hold extends Domain.Aggregate("Hold", {
  id: S.String,
  // state: S.Struct({ status: S.Literals(["none", "held", "released", "expired"]) }),
  state: HoldState,
  initial: HoldState.cases.none.make({}),
  commands: [PlaceHold, ReleaseHold, ExpireHold],
  decide: {
    PlaceHold: () => [HoldPlaced.make({})],
    ReleaseHold: () => [HoldReleased.make({})],
    ExpireHold: () => [HoldExpired.make({})]
  },
  evolve: {
    HoldPlaced: () => HoldState.cases.held.make({}),
    HoldReleased: () => HoldState.cases.released.make({}),
    HoldExpired: () => HoldState.cases.expired.make({})
  }
}) {
}

/** Schedules a hold's expiry when it is placed, and cancels it when it is released. */
export class HoldDeadline extends Domain.Policy("HoldDeadline", {
  from: Hold,
  on: [HoldPlaced, HoldReleased]
}) {
}

const HoldDeadlineLive = HoldDeadline.toLayer(
  Effect.gen(function* () {
    const holds = yield* Hold
    return Effect.fn(function* ({ source, event }) {
      if (S.is(HoldPlaced)(event)) {
        yield* holds.schedule(source, ExpireHold.make({}), {
          after: HOLD_WINDOW,
          commandId: EXPIRY
        })
      } else {
        yield* holds
          .unschedule(source, EXPIRY)
          .pipe(
            Effect.catchTag(
              ["AlreadyExecuted", "AlreadyCancelled", "NotScheduled"],
              thunkEffectVoid
            )
          )
      }
    })
  })
)

export class Conformance extends Domain.Model("Conformance", {
  aggregates: [Counter, Echo, Hold],
  views: [CounterTotal],
  policies: [StartMirror, HoldDeadline],
  sagas: [MirrorFirst]
}) {
}

/** The model's Api: its counter and view, served at the front's `/api`. */
export class ConformanceApi extends Domain.Api("ConformanceApi", {
  model: Conformance,
  commands: ["Increment"],
  views: ["CounterTotal"]
}) {
}

/** The model's Layer, given the platform it runs on. */
export const ConformanceLive = Conformance.layer(
  Layer.mergeAll(StartMirrorLive, MirrorFirstLive, HoldDeadlineLive)
)
