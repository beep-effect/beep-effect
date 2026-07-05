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

import { HttpApi, HttpApiGroup } from "effect/unstable/httpapi";
import * as Search from "./Search/index.ts";

/**
 * Top-level GovInfo API group carrying the search endpoint.
 *
 * @example
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
 * @example
 * ```ts
 * import { GovinfoApi } from "@beep/govinfo"
 *
 * console.log(GovinfoApi.identifier)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const GovinfoApi = HttpApi.make("govinfo").add(GovinfoApiGroup);
