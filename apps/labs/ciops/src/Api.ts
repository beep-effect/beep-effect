/**
 * Health contract for the CI-operations projection lab.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $CiopsId } from "@beep/identity/packages";
import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import * as S from "effect/Schema";

// fallow-ignore-next-line code-duplication -- labs health-endpoint scaffold intentionally mirrors apps/labs/api-docs. Owner: @beep/ciops. Exit: replace with a shared labs health endpoint when the lab graduates.
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
export class Health extends S.Opaque<Health, { readonly brand: unique symbol }>()(
  S.Struct({
    status: S.tag("ok"),
  }).pipe(
    $I.annoteSchema("Health", {
      description: "Service health snapshot returned by GET /health.",
    })
  )
) {}

const ApiGroup = HttpApiGroup.make("ciops").add(HttpApiEndpoint.get("health", "/health", { success: Health }));

/**
 * Top-level `HttpApi` contract for the CI-operations lab health endpoint.
 *
 * **Gotchas**
 *
 * Keep ApiGroup private: Api is its only consumer, and exporting an unimported lab group fails the unused-export gate.
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
