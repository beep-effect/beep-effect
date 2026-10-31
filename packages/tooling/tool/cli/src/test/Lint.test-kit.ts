/**
 * Source-only test kit for lint command internals.
 *
 * @internal
 * @since 0.0.0
 */

export * from "@beep/repo-cli/commands/Lint";
/**
 * Policy fingerprint graph internals, for focused tests.
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export {
  makePolicyGraph,
  moduleSyntax,
  renderClosureInputs,
  resolvePackageSubpath,
} from "../commands/Lint/internal/PolicyFingerprintGraph.ts";
/**
 * Schema-first inventory merge, exposed so tests can drive `--write` regeneration on fixture documents.
 *
 * @category testing
 * @since 0.0.0
 */
export { mergeSchemaFirstInventory } from "../commands/Lint/internal/SchemaFirstScan.ts";
/**
 * Schema-class shape detectors (brand and plain-data kinds), exposed so tests can drive them on fixtures.
 *
 * @category testing
 * @since 0.0.0
 */
export { SchemaFirstSchemaClass } from "../commands/Lint/internal/SchemaFirstSchemaClass.ts";
/**
 * Schema-first rendering adapter, exposed so tests can drive fallback render paths directly.
 *
 * @category testing
 * @since 0.0.0
 */
export { SchemaFirstRender } from "../commands/Lint/SchemaFirst.render.ts";
/**
 * Policy fingerprint JSON rendering, for focused tests.
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export { renderJsonDocument } from "../commands/Lint/internal/PolicyFingerprintJson.ts";
