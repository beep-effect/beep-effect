/**
 * Health contract for the API documentation lab.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ApiDocsId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

const $I = $ApiDocsId.create("Api");

/**
 * Schema-backed response returned by the API docs health endpoint.
 *
 * **Example** (Create a healthy response)
 *
 * ```ts
 * import { Health } from "@beep/api-docs/src/Api"
 *
 * const health = Health.make({})
 *
 * console.log(health.status) // "ok"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class Health extends S.Class<Health>($I`Health`)(
  {
    status: S.tag("ok"),
  },
  $I.annote("Health", {
    description: "Service health snapshot returned by GET /health.",
  })
) {}

// Not exported: `Api` is the only consumer, and a lab-local export with no
// importer trips fallow's unused-export gate the first time the lab lands.
const ApiGroup = HttpApiGroup.make("api-docs").add(HttpApiEndpoint.get("health", "/health", { success: Health }));

/**
 * Top-level `HttpApi` contract for the API docs lab health endpoint.
 *
 * **Example** (Inspect the API identifier)
 *
 * ```ts
 * import { Api } from "@beep/api-docs/src/Api"
 *
 * console.log(Api.identifier) // "api-docs-api"
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const Api = HttpApi.make("api-docs-api").add(ApiGroup);
