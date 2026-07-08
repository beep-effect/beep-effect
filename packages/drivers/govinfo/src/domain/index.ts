/**
 * Domain entry point for `@beep/govinfo` — re-exports the GovInfo API contracts
 * and the value objects that model GovInfo REST API request and response bodies.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * GovInfo API contract definitions: the assembled `HttpApi` surface and the
 * `Search` endpoint contract (`POST /search` request and response schemas).
 *
 * @since 0.0.0
 * @category models
 */
export * from "./contracts/index.ts";
/**
 * GovInfo value objects: search body, search result, search response, sort
 * directives, and the package, granule, and collection metadata models.
 *
 * @since 0.0.0
 * @category models
 */
export * from "./values/index.ts";
