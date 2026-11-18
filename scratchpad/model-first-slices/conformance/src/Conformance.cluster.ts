import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import { HttpServerRequest } from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as Str from "@beep/utils/Str";
import { app } from "@proto/conformance-upstream/app";
import { ConformanceLive } from "@proto/conformance-upstream/model";
import * as O from "@beep/utils/Option";
import { Slot, SlotTally, TwoRunnersModel, Write } from "./TwoRunners.model.ts";
import { thunk0 } from "@beep/utils"

/**
 * The conformance models on a cluster: upstream's conformance model (served
 * at the front's root by upstream's own `app`) and the two-runners slot
 * (`/tworunners/write?slot=&label=&hold=`, with `&command=` for a command id since phase 12,
 * `/tworunners/state?slot=` and, since phase 10, `/tworunners/tally`, every write counted).
 *
 * @category cluster
 * @since 0.0.0
 */
export const ConformanceCluster = <ROut, E, R>(platform: Layer.Layer<ROut, E, R>) => {
  const upstream = ConformanceLive.pipe(Layer.provide(platform));
  const twoRunners = TwoRunnersModel.layer(Layer.empty).pipe(Layer.provide(platform));
  // The route, over the slot's client: a write, timed, or the slot's state.
  const slots = Effect.map(Effect.all({ slot: Effect.service(Slot), tally: Effect.service(SlotTally) }, { concurrency: 1 }), ({ slot, tally }) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest;
      const url = new URL(request.url, "http://front");
      const param = (name: string) => url.searchParams.get(name) ?? "";
      if (pipe(url.pathname, Str.endsWith("/tally"))) {
        // A read without `atLeast` does not wait, so it never times out.
        const counted = yield* tally.get("all").pipe(Effect.orDie);
        return yield* HttpServerResponse.json({ writes: O.match(counted, { onNone: thunk0, onSome: (view) => view.writes }) });
      }
      if (pipe(url.pathname, Str.endsWith("/state"))) {
        const state = yield* slot.get(param("slot"));
        return yield* HttpServerResponse.json(state);
      }
      const started = yield* Clock.currentTimeMillis;
      // An absent `hold` reads as 0, as `Number("")` does; an absent `command` sends without an id.
      const command = param("command");
      const receipt = yield* slot.send(
        param("slot"),
        Write.make({ label: param("label"), holdMs: Number(param("hold")) }),
        Str.isEmpty(command) ? undefined : { commandId: command },
      );
      const ended = yield* Clock.currentTimeMillis;
      return yield* HttpServerResponse.json({ version: receipt.version, stream: receipt.stream, ms: ended - started });
    }),
  );
  return {
    parts: {
      Conformance: Layer.effectDiscard(Effect.void).pipe(Layer.provide(Layer.merge(upstream, twoRunners))),
    },
    // Built into the caller's scope, as the other contexts' Apis are (D39): they serve requests
    // long after this effect returns. Each model gets its own context: a hosted model provides its
    // `Model.Internals`, so one context merged from two would route every Api to the second model.
    apis: Effect.gen(function* () {
      const conformanceModel = yield* Layer.build(upstream);
      const slotModel = yield* Layer.build(twoRunners);
      const root = yield* Effect.provideContext(app, conformanceModel);
      const tworunners = yield* Effect.provideContext(slots, slotModel);
      return { "": root, tworunners };
    }),
  };
};
