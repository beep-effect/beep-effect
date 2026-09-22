/**
 * Data model for the `beep models` command group.
 *
 * **Details**
 *
 * The group's schemas are sharded by which truth they describe, and this file
 * is the single import surface over all three:
 *
 * - `Models.catalog.schemas.ts` — external truth, decoded permissively from
 *   the upstream manifest and the three availability overlays.
 * - `Models.manifest.schemas.ts` — operator truth, decoded strictly from
 *   `$HOME/.config/beep/models.yaml`.
 * - `Models.report.schemas.ts` — what a check run found.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Catalog-side schemas: upstream manifest, availability overlays, snapshots.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./Models.catalog.schemas.ts";
/**
 * Manifest-side schemas: roles, surfaces, bindings, locators, targets.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./Models.manifest.schemas.ts";
/**
 * Report-side schemas: run mode, drift findings, check report.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./Models.report.schemas.ts";
