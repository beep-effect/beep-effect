/**
 * Runtime layers of the review hub: one MCP endpoint behind an independent
 * bearer credential and Tailscale login allow-list, bound to loopback.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { makeReviewFilesLayer, ReviewFilesConfig } from "@beep/law-practice-server/ReviewFiles";
import { QuestionQueueLive } from "@beep/law-practice-use-cases/QuestionQueue";
import { ReviewHub, ReviewHubLive, ReviewHubToolkit } from "@beep/law-practice-use-cases/ReviewHub";
import { ReviewQueueLive } from "@beep/law-practice-use-cases/ReviewQueue";
import { sanitizedToolkit, statelessMcpProtocols } from "@beep/mcp-kit";
import * as BunHttpServer from "@effect/platform-bun/BunHttpServer";
import * as McpServer from "effect/ai/McpServer";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Headers from "effect/http/Headers";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Str from "effect/String";
import type { ReviewHubConfig } from "../Config.ts";

/**
 * Header `tailscale serve` sets to the caller's tailnet login.
 *
 * **Example** (Read the caller's login header)
 *
 * ```ts
 * import { TAILSCALE_LOGIN_HEADER } from "@/runtime/Layer"
 *
 * console.log(TAILSCALE_LOGIN_HEADER) // "tailscale-user-login"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const TAILSCALE_LOGIN_HEADER = "tailscale-user-login";

const FORBIDDEN = 403;

const loginAllowList = (allowedLogins: ReadonlyArray<string>, apiToken: Redacted.Redacted<string>) => {
  const expected = Buffer.from(`Bearer ${Redacted.value(apiToken)}`);
  const authenticated = (authorization: string) => {
    if (Str.length(authorization) > 1_024) return false;
    const supplied = Buffer.from(authorization);
    return supplied.byteLength === expected.byteLength && globalThis.crypto.timingSafeEqual(supplied, expected);
  };
  const allowed = HashSet.fromIterable(allowedLogins);
  return HttpRouter.middleware(
    (httpEffect) =>
      Effect.flatMap(HttpServerRequest.HttpServerRequest, (request) =>
        O.exists(Headers.get(request.headers, "authorization"), authenticated) &&
        O.exists(Headers.get(request.headers, TAILSCALE_LOGIN_HEADER), (login) => HashSet.has(allowed, login))
          ? httpEffect
          : Effect.succeed(HttpServerResponse.empty({ status: FORBIDDEN }))
      ),
    { global: true }
  );
};

const ReviewHubToolsLive = ReviewHubToolkit.toLayer(
  Effect.map(ReviewHub, (hub) => ({
    review_lock_batch: hub.lockBatch,
    review_open_items: hub.openItems,
    review_record_answer: hub.recordAnswer,
    review_record_verdict: hub.recordVerdict,
  }))
);

const makeReviewHubLayerInternal = (allowedLogins: ReadonlyArray<string>, apiToken: Redacted.Redacted<string>) =>
  Layer.merge(
    sanitizedToolkit(ReviewHubToolkit).pipe(
      Layer.provide(ReviewHubToolsLive),
      Layer.provide(ReviewHubLive),
      Layer.provide(Layer.merge(ReviewQueueLive, QuestionQueueLive))
    ),
    loginAllowList(allowedLogins, apiToken)
  ).pipe(
    // `layerHttp` fails only on a malformed path or an empty protocol list, both literals here.
    Layer.provideMerge(
      McpServer.layerHttp({
        name: "practice-review-hub",
        version: "0.0.0",
        path: "/mcp",
        protocols: statelessMcpProtocols,
      }).pipe(Layer.orDie)
    )
  );

/**
 * The hub's MCP endpoint at `/mcp`, behind the login allow-list, over the
 * stores the caller provides.
 *
 * **Details**
 *
 * A request without a `Tailscale-User-Login` header, or with a login not on
 * `allowedLogins`, or without the independent bearer credential, gets an
 * empty 403 before any tool runs. The endpoint speaks
 * the stateless MCP revision from `@beep/mcp-kit`. It needs an `HttpRouter`
 * and the three review stores.
 *
 * **Example** (Make the hub layer)
 *
 * ```ts
 * import * as Layer from "effect/Layer"
 * import * as Redacted from "effect/Redacted"
 * import { makeReviewHubLayer } from "@/runtime/Layer"
 *
 * console.log(Layer.isLayer(makeReviewHubLayer(["attorney@example.test"], Redacted.make("synthetic-test-token-with-32-characters")))) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeReviewHubLayer: {
  (
    apiToken: Redacted.Redacted<string>
  ): (allowedLogins: ReadonlyArray<string>) => ReturnType<typeof makeReviewHubLayerInternal>;
  (
    allowedLogins: ReadonlyArray<string>,
    apiToken: Redacted.Redacted<string>
  ): ReturnType<typeof makeReviewHubLayerInternal>;
} = dual(2, makeReviewHubLayerInternal);

/**
 * The hub served on `127.0.0.1` at the configured port, over JSONL stores in
 * the configured data directory.
 *
 * **Details**
 *
 * The hub never listens on another interface: `tailscale serve` exposes the
 * loopback port on the tailnet and sets the login header. Clients must also
 * provide the independent bearer credential; loopback does not authenticate
 * other local OS accounts.
 *
 * **Example** (Make the hub server)
 *
 * ```ts
 * import * as Layer from "effect/Layer"
 * import * as Redacted from "effect/Redacted"
 * import * as S from "effect/Schema"
 * import * as Effect from "effect/Effect"
 * import { ReviewHubConfig } from "@/Config"
 * import { makeReviewHubServer } from "@/runtime/Layer"
 *
 * const config = S.decodeUnknownEffect(ReviewHubConfig)({
 *   apiToken: Redacted.make("synthetic-test-token-with-32-characters"),
 *   allowedLogins: ["attorney@example.test"],
 *   dataDirectory: "/var/lib/practice-review-hub",
 *   port: 8787
 * })
 * Effect.runPromise(Effect.map(config, makeReviewHubServer))
 *   .then((server) => console.log(Layer.isLayer(server))) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeReviewHubServer = (config: ReviewHubConfig) =>
  HttpRouter.serve(makeReviewHubLayer(config.allowedLogins, config.apiToken)).pipe(
    Layer.provide(makeReviewFilesLayer(ReviewFilesConfig.make({ dataDirectory: config.dataDirectory }))),
    Layer.provide(BunHttpServer.layer({ hostname: "127.0.0.1", port: config.port }))
  );
