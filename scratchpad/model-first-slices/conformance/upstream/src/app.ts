// Ported from alchemy-run/alchemy packages/integration-tests/test/Domain/conformance/app.ts
// at 33c10dd55f (2.0.0-beta.87), adapted to this repository's Effect rules; behaviour unchanged.
/**
 * The HTTP routes of the Domain conformance suite, served by each
 * platform's front over the conformance model. Every route is a GET that
 * answers JSON.
 *
 * - `/increment/:id?by=n` sends `Increment`; `{ accepted: total }` or `{ rejected: tag }`
 * - `/again/:id?by=n` sends `Increment` twice under one command id
 * - `/counter/:id`, `/echo/:id`, `/total/:id` read the counter, what the saga wrote, the view
 * - `/totals/:id?order=&take=&after=` lists a page of the view's entries
 * - `/place/:id`, `/release/:id`, `/hold/:id` place, release and read a hold
 * - `/api` serves {@link ConformanceApi}: calls over HTTP, live reads over WebSockets
 */
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { HttpServerRequest } from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Str from "effect/String";
import {
  ConformanceApi,
  Counter,
  CounterTotal,
  Echo,
  Hold,
  Increment,
  PlaceHold,
  ReleaseHold,
} from "./model.ts";

/** The front's `fetch`, built once the model's services are provided. */
export const app = Effect.map(
  Effect.all(
    {
      counters: Effect.service(Counter),
      echoes: Effect.service(Echo),
      totals: Effect.service(CounterTotal),
      holds: Effect.service(Hold),
      api: ConformanceApi,
    },
    { concurrency: 1 },
  ),
  ({ counters, echoes, totals, holds, api }) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest;
      const url = new URL(request.url, "http://front");
      const [, action, raw] = Str.split(url.pathname, "/");
      const id = decodeURIComponent(raw ?? "");
      const by = Number(url.searchParams.get("by") ?? "1");
      const increment = (commandId?: string) =>
        counters.send(id, Increment.make({ by }), commandId === undefined ? {} : { commandId }).pipe(
          Effect.map((receipt) => ({ accepted: receipt.reply.total, version: receipt.version })),
          Effect.catchTag("TooBig", (rejection) => Effect.succeed({ rejected: rejection._tag })),
        );
      return yield* Match.value(action).pipe(
        Match.when("api", () => api.fetch),
        Match.when("ready", () => Effect.succeed(HttpServerResponse.text("ok"))),
        Match.when("increment", () => Effect.flatMap(increment(), HttpServerResponse.json)),
        Match.when("again", () =>
          Effect.gen(function* () {
            const first = yield* increment(`again-${id}`);
            const second = yield* increment(`again-${id}`);
            return yield* HttpServerResponse.json({ first, second });
          }),
        ),
        Match.when("counter", () => Effect.flatMap(counters.get(id), HttpServerResponse.json)),
        Match.when("echo", () => Effect.flatMap(echoes.get(id), HttpServerResponse.json)),
        Match.when("total", () =>
          Effect.gen(function* () {
            const total = yield* totals.get(Counter.ref(id)).pipe(Effect.orDie);
            return yield* HttpServerResponse.json(
              Option.getOrElse(total, () => ({ total: 0, increments: 0 })),
            );
          }),
        ),
        Match.when("totals", () =>
          Effect.gen(function* () {
            const order = url.searchParams.get("order");
            const take = url.searchParams.get("take");
            const after = url.searchParams.get("after");
            const page = yield* totals.list(Counter.ref(id), {
              ...(order === "asc" || order === "desc" ? { order } : {}),
              ...(take === null ? {} : { take: Number(take) }),
              ...(after === null ? {} : { after: Number(after) }),
            });
            return yield* HttpServerResponse.json({
              totals: A.map(page.entries, (entry) => entry.state?.total ?? null),
              cursor: page.cursor,
            });
          }),
        ),
        Match.when("place", () =>
          Effect.gen(function* () {
            yield* holds.send(id, PlaceHold.make({}));
            const hold = yield* holds.get(id);
            return yield* HttpServerResponse.json(hold);
          }),
        ),
        Match.when("release", () =>
          Effect.gen(function* () {
            yield* holds.send(id, ReleaseHold.make({}));
            const hold = yield* holds.get(id);
            return yield* HttpServerResponse.json(hold);
          }),
        ),
        Match.when("hold", () => Effect.flatMap(holds.get(id), HttpServerResponse.json)),
        Match.orElse(() => Effect.succeed(HttpServerResponse.text("Not Found", { status: 404 }))),
      );
    }),
);
