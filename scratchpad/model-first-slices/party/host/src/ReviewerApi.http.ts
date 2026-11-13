import * as DomainHttp from "@alchemy.run/domain/Http";
import { ReviewerApi } from "@proto/party/ReviewerApi.api";
import * as Http from "alchemy/Http";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as HttpRouter from "effect/http/HttpRouter";
import * as Layer from "effect/Layer";

/**
 * The ReviewerApi as plain HTTP for internal tools: a command is
 * `POST /<Command>`, a view read is `GET /<View>/<key>`. Only the listed
 * calls are published.
 *
 * **Example** (The OpenAPI group)
 * ```ts
 * import { ReviewerHttp } from "@proto/party-host/ReviewerApi.http";
 *
 * const api = ReviewerHttp.api;
 * ```
 *
 * @category http
 * @since 0.0.0
 */
export const ReviewerHttp = DomainHttp.toHttpApi(ReviewerApi, {
  expose: ["AcceptClaim", "RetractClaim", "ClaimReview.get", "EffectiveParty.get", "FindParties"],
});

/**
 * The `fetch` a front serves, built once the hosted model's Layer is provided.
 *
 * **Example** (Serve it from a container)
 * ```ts
 * import { reviewerFetch } from "@proto/party-host/ReviewerApi.http";
 *
 * const fetch = reviewerFetch;
 * ```
 *
 * @category http
 * @since 0.0.0
 */
export const reviewerFetch = HttpRouter.toHttpEffect(
  HttpApiBuilder.layer(ReviewerHttp.api, { openapiPath: "/openapi.json" }).pipe(
    Layer.provide(ReviewerHttp.layer),
    Layer.provide(Http.Platform),
  ),
);
