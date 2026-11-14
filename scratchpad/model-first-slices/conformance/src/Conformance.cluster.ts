import * as Effect from "effect/Effect";
import { HttpServerRequest } from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import { Slot, TwoRunnersModel, Write } from "./TwoRunners.model.ts";
import { app } from "./upstream/app.ts";
import { ConformanceLive } from "./upstream/model.ts";

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
  const slots = Effect.gen(function* () {
    const slot = yield* Slot;
    return Effect.gen(function* () {
      const request = yield* HttpServerRequest;
      const url = new URL(request.url, "http://front");
      const param = (name: string) => url.searchParams.get(name) ?? "";
      if (url.pathname.endsWith("/state")) return yield* HttpServerResponse.json(yield* slot.get(param("slot")));
      const started = Date.now();
      const receipt = yield* slot.send(param("slot"), new Write({ label: param("label"), holdMs: Number(param("hold") || "0") }));
      return yield* HttpServerResponse.json({ version: receipt.version, ms: Date.now() - started });
    });
  });
  return {
    parts: {
      Conformance: Layer.effectDiscard(Effect.void).pipe(Layer.provide(Layer.merge(upstream, twoRunners))),
    },
    apis: Effect.gen(function* () {
      return { "": yield* app, tworunners: yield* Effect.provide(slots, twoRunners) };
    }).pipe(Effect.provide(upstream)),
  };
};
