/**
 * Decides which requests may reach the library over loopback HTTP.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SocialMapperId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Headers from "effect/http/Headers";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import type * as Layer from "effect/Layer";

const $I = $SocialMapperId.create("server/Guard");

/**
 * **Details**
 *
 * `foreign` is a request a browser sent from a page of another site, and
 * `unsigned` one that does not carry this launch's token.
 *
 * **Example** (Recognise a refusal)
 *
 * ```ts
 * import { Verdict } from "./Guard.ts"
 *
 * Verdict.is.foreign("foreign") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Verdict = LiteralKit(["allowed", "foreign", "unsigned"]).pipe(
  $I.annoteSchema("Verdict", { description: "Whether a request may reach the library, and why not." })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type Verdict = typeof Verdict.Type;

/**
 * Who may call the library.
 *
 * @category models
 * @since 0.0.0
 */
export interface Admission {
  readonly origins: ReadonlyArray<string>;
  readonly token: Redacted.Redacted;
}

/**
 * Judges one request by its headers.
 *
 * **Details**
 *
 * The library opens browser windows and writes files, so a page of any
 * other site must not be able to drive it. A browser names the page that
 * sent a request in `Origin`; one from outside the listed origins is
 * refused whatever else it carries. Every request must also carry the
 * token made for this launch, which keeps out other programs on the
 * machine that find the port.
 *
 * **Example** (Refuse a page of another site)
 *
 * ```ts
 * import * as Headers from "effect/http/Headers"
 * import * as Redacted from "effect/Redacted"
 * import { judge } from "./Guard.ts"
 *
 * const admission = { token: Redacted.make("launch"), origins: ["http://app.localhost"] }
 * const headers = Headers.fromInput({ origin: "https://elsewhere.example", authorization: "Bearer launch" })
 * judge(headers, admission) // => "foreign"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const judge: {
  (admission: Admission): (headers: Headers.Headers) => Verdict;
  (headers: Headers.Headers, admission: Admission): Verdict;
} = dual(
  2,
  (headers: Headers.Headers, { origins, token }: Admission): Verdict =>
    O.exists(Headers.get(headers, "origin"), (origin) => !A.contains(origins, origin))
      ? "foreign"
      : O.contains(Headers.get(headers, "authorization"), `Bearer ${Redacted.value(token)}`)
        ? "allowed"
        : "unsigned"
);

const refusal = Verdict.match({
  allowed: () => 200,
  foreign: () => 403,
  unsigned: () => 401,
});

/**
 * Applies {@link judge} to every route of the router.
 *
 * **Example** (Guard a router)
 *
 * ```ts
 * import * as Redacted from "effect/Redacted"
 * import { layer } from "./Guard.ts"
 *
 * const guarded = layer({ token: Redacted.make("launch"), origins: [] })
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layer = (admission: Admission): Layer.Layer<never, never, HttpRouter.HttpRouter> =>
  HttpRouter.middleware(
    (served) =>
      Effect.flatMap(HttpServerRequest.HttpServerRequest, ({ headers }) => {
        const verdict = judge(headers, admission);
        return Verdict.is.allowed(verdict)
          ? served
          : Effect.succeed(HttpServerResponse.empty({ status: refusal(verdict) }));
      }),
    { global: true }
  );
