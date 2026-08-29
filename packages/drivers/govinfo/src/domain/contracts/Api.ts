/**
 * The assembled GovInfo `HttpApi` contract.
 *
 * Wires the hand-authored `Search` endpoint into a single top-level group so the
 * generated `HttpApiClient` exposes `client.search(...)` directly. This is the
 * contract surface consumed by `Govinfo.service`; transport concerns stay in the
 * shared transformer applied via `HttpApiClient.make`'s `transformClient` seam.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { HttpApi, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";
import * as Search from "./Search/index.ts";

/**
 * Top-level GovInfo API group carrying the search endpoint.
 *
 * **Example** (Logging group identifier)
 *
 * ```ts
 * import { GovinfoApiGroup } from "@beep/govinfo"
 *
 * console.log(GovinfoApiGroup.identifier)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const GovinfoApiGroup = HttpApiGroup.make("govinfo", { topLevel: true }).add(Search.Http);

/**
 * The assembled GovInfo `HttpApi`.
 *
 * **Example** (Logging API identifier)
 *
 * ```ts
 * import { GovinfoApi } from "@beep/govinfo"
 *
 * console.log(GovinfoApi.identifier)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const GovinfoApi = HttpApi.make("govinfo")
  .annotate(OpenApi.Title, "GovInfo API (search contract)")
  .annotate(OpenApi.Version, "2.0")
  .annotate(OpenApi.Description, "Hand-written subset of the GovInfo API contract covering only document search.")
  .add(GovinfoApiGroup);
