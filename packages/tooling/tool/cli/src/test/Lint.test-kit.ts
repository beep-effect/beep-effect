/**
 * Source-only test kit for lint command internals.
 *
 * @internal
 * @since 0.0.0
 */

export * from "@beep/repo-cli/commands/Lint";
/**
 * Schema-first rendering adapter, exposed so tests can drive fallback render paths directly.
 *
 * @category testing
 * @since 0.0.0
 */
export { SchemaFirstRender } from "../commands/Lint/SchemaFirst.render.ts";
