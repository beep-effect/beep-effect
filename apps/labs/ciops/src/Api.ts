/**
 * Health contract for the CI-operations projection lab.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $CiopsId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

// fallow-ignore-next-line code-duplication -- labs health-endpoint scaffold intentionally mirrors apps/labs/api-docs; shared extraction is graduation-time work
const $I = $CiopsId.create("Api");

/**
 * Schema-backed response returned by the CI-operations health endpoint.
 *
 * **Example** (Create a healthy response)
 *
 * ```ts
 * import { Health } from "@/Api"
 *
 * const health = Health.make({ status: "ok" })
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
const ApiGroup = HttpApiGroup.make("ciops").add(HttpApiEndpoint.get("health", "/health", { success: Health }));

/**
 * Top-level `HttpApi` contract for the CI-operations lab health endpoint.
 *
 * **Example** (Inspect the API identifier)
 *
 * ```ts
 * import { Api } from "@/Api"
 *
 * console.log(Api.identifier) // "ciops-api"
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const Api = HttpApi.make("ciops-api").add(ApiGroup);
