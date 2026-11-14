import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import { HttpServerRequest } from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as Str from "effect/String";
import { app } from "@proto/conformance-upstream/app";
import { ConformanceLive } from "@proto/conformance-upstream/model";
import { Slot, TwoRunnersModel, Write } from "./TwoRunners.model.ts";

/**
 * The conformance models on a cluster: upstream's conformance model (served
 * at the front's root by upstream's own `app`) and the two-runners slot
 * (`/tworunners/write?slot=&label=&hold=` and `/tworunners/state?slot=`).
 *
 * @category cluster
 * @since 0.0.0
 */
export const ConformanceCluster = <ROut, E, R>(platform: Layer.Layer<ROut, E, R>) => {
  const upstream = ConformanceLive.pipe(Layer.provide(platform));
  const twoRunners = TwoRunnersModel.layer(Layer.empty).pipe(Layer.provide(platform));
  // The route, over the slot's client: a write, timed, or the slot's state.
  const slots = Effect.map(Effect.service(Slot), (slot) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest;
      const url = new URL(request.url, "http://front");
      const param = (name: string) => url.searchParams.get(name) ?? "";
      if (pipe(url.pathname, Str.endsWith("/state"))) {
        const state = yield* slot.get(param("slot"));
        return yield* HttpServerResponse.json(state);
      }
      const started = yield* Clock.currentTimeMillis;
      // An absent `hold` reads as 0, as `Number("")` does.
      const receipt = yield* slot.send(param("slot"), Write.make({ label: param("label"), holdMs: Number(param("hold")) }));
      const ended = yield* Clock.currentTimeMillis;
      return yield* HttpServerResponse.json({ version: receipt.version, ms: ended - started });
    }),
  );
  return {
    parts: {
      Conformance: Layer.effectDiscard(Effect.void).pipe(Layer.provide(Layer.merge(upstream, twoRunners))),
    },
    // Built into the caller's scope, as the other contexts' Apis are (D39): they serve requests
    // long after this effect returns.
    apis: Effect.gen(function* () {
      const context = yield* Layer.build(Layer.merge(upstream, twoRunners));
      return yield* Effect.gen(function* () {
        return { "": yield* app, tworunners: yield* slots };
      }).pipe(Effect.provideContext(context));
    }),
  };
};
