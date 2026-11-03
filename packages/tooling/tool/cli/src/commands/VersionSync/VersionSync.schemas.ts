/**
 * Data types and tagged errors for the version-sync command.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { RunMode, RunModeMatch } from "@beep/repo-cli-kit/cli/RunMode";
import { LiteralKit } from "@beep/schema";
import { ArrayKeyDefaultEmpty } from "@beep/schema/SchemaUtils/withKeyDefaults";
import { A } from "@beep/utils";
import * as Effect from "effect/Effect";
import * as F from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import type { RunMode as RunModeValue } from "@beep/repo-cli-kit/cli/RunMode";

/**
 * Public version-sync error exports.
 *
 * @category errors
 * @since 0.0.0
 */
export { NetworkUnavailableError, VersionSyncDriftError, VersionSyncError } from "./VersionSync.errors.ts";

const $I = $RepoCliId.create("commands/VersionSync/VersionSync.schemas");

// ── Errors ──────────────────────────────────────────────────────────────────

// ── Report model ────────────────────────────────────────────────────────────

/**
 * A single version pin location with its current and expected values.
 *
 * **Example** (Import VersionDriftItem schema)
 *
 * ```ts
 * import { VersionDriftItem } from "@beep/repo-cli/commands/VersionSync/VersionSync.schemas"
 *
 * console.log(typeof VersionDriftItem !== "undefined") // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VersionDriftItem extends S.Opaque<VersionDriftItem, { readonly brand: unique symbol }>()(
  S.Struct({
    file: S.String,
    field: S.String,
    current: S.String,
    expected: S.String,
    line: S.Option(S.Finite),
  }).pipe(
    $I.annoteSchema("VersionDriftItem", {
      description: "A single version pin location with its current and expected values",
    })
  )
) {}

/**
 * Version category for grouping drift items.
 *
 * @category models
 * @since 0.0.0
 */
const VersionCategoryKit = LiteralKit(["bun", "node", "docker", "biome", "effect", "turbo"]);
/**
 * Version category for grouping drift items.
 *
 * **Example** (Annotate VersionCategory type)
 *
 * ```ts
 * import type { VersionCategory } from "@beep/repo-cli/commands/VersionSync/VersionSync.schemas"
 *
 * const example: VersionCategory | undefined = undefined
 * console.log(example === undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VersionCategory = VersionCategoryKit.pipe(
  $I.annoteSchema("VersionCategory", {
    description: "Version category for grouping drift items",
  })
);
/**
 * Literal option tuple for version categories.
 *
 * **Example** (Import category options tuple)
 *
 * ```ts
 * import { VersionCategoryOptions } from "@beep/repo-cli/commands/VersionSync/VersionSync.schemas"
 *
 * console.log(typeof VersionCategoryOptions !== "undefined") // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VersionCategoryOptions = VersionCategoryKit.literals;
/**
 * Version category for grouping drift items.
 *
 * **Example** (Annotate VersionCategory type)
 *
 * ```ts
 * import type { VersionCategory } from "@beep/repo-cli/commands/VersionSync/VersionSync.schemas"
 *
 * const example: VersionCategory | undefined = undefined
 * console.log(example === undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type VersionCategory = typeof VersionCategory.Type;
/**
 * Status of a version category.
 *
 * @category models
 * @since 0.0.0
 */
const VersionCategoryStatusKit = LiteralKit(["ok", "drift", "unpinned", "error"]);
/**
 * Status of a version category.
 *
 * **Example** (Annotate status type)
 *
 * ```ts
 * import type { VersionCategoryStatus } from "@beep/repo-cli/commands/VersionSync/VersionSync.schemas"
 *
 * const example: VersionCategoryStatus | undefined = undefined
 * console.log(example === undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VersionCategoryStatus = VersionCategoryStatusKit.pipe(
  $I.annoteSchema("VersionCategoryStatus", {
    description: "Status of a version category",
  })
);
/**
 * Pattern-matching helper for version category status literals.
 *
 * **Example** (Import status match helper)
 *
 * ```ts
 * import { VersionCategoryStatusMatch } from "@beep/repo-cli/commands/VersionSync/VersionSync.schemas"
 *
 * console.log(typeof VersionCategoryStatusMatch !== "undefined") // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VersionCategoryStatusMatch = VersionCategoryStatusKit.match;
/**
 * Enum mapping for version category status literals.
 *
 * **Example** (Import status enum mapping)
 *
 * ```ts
 * import { VersionCategoryStatusEnum } from "@beep/repo-cli/commands/VersionSync/VersionSync.schemas"
 *
 * console.log(typeof VersionCategoryStatusEnum !== "undefined") // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VersionCategoryStatusEnum = VersionCategoryStatusKit.Enum;
/**
 * Status of a version category.
 *
 * **Example** (Annotate status type)
 *
 * ```ts
 * import type { VersionCategoryStatus } from "@beep/repo-cli/commands/VersionSync/VersionSync.schemas"
 *
 * const example: VersionCategoryStatus | undefined = undefined
 * console.log(example === undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type VersionCategoryStatus = typeof VersionCategoryStatus.Type;

/**
 * Status of a version category from its drift items: `ok` when there are
 * none, `drift` otherwise.
 *
 * **Example** (Derive a status from drift items)
 *
 * ```ts
 * import { versionCategoryStatusFromDrift } from "@beep/repo-cli/commands/VersionSync/VersionSync.schemas"
 *
 * console.log(versionCategoryStatusFromDrift([])) // "ok"
 * console.log(versionCategoryStatusFromDrift(["biome"])) // "drift"
 * ```
 *
 * @param items - Drift items reported for the category.
 * @returns `ok` when there are no items, `drift` otherwise.
 * @category utilities
 * @since 0.0.0
 */
export const versionCategoryStatusFromDrift = (items: ReadonlyArray<unknown>): VersionCategoryStatus =>
  A.match(items, {
    onEmpty: F.constant(VersionCategoryStatusEnum.ok),
    onNonEmpty: F.constant(VersionCategoryStatusEnum.drift),
  });

const versionCategoryReportFields = {
  status: VersionCategoryStatus,
  items: ArrayKeyDefaultEmpty(VersionDriftItem),
  error: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
  latest: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
};

class VersionCategoryReportBun extends S.Opaque<VersionCategoryReportBun, { readonly brand: unique symbol }>()(
  S.Struct({
    category: S.tag("bun"),
    ...versionCategoryReportFields,
  }).pipe(
    $I.annoteSchema("VersionCategoryReportBun", {
      description: "Version report entry for Bun category.",
    })
  )
) {}

class VersionCategoryReportNode extends S.Opaque<VersionCategoryReportNode, { readonly brand: unique symbol }>()(
  S.Struct({
    category: S.tag("node"),
    ...versionCategoryReportFields,
  }).pipe(
    $I.annoteSchema("VersionCategoryReportNode", {
      description: "Version report entry for Node category.",
    })
  )
) {}

class VersionCategoryReportDocker extends S.Opaque<VersionCategoryReportDocker, { readonly brand: unique symbol }>()(
  S.Struct({
    category: S.tag("docker"),
    ...versionCategoryReportFields,
  }).pipe(
    $I.annoteSchema("VersionCategoryReportDocker", {
      description: "Version report entry for Docker category.",
    })
  )
) {}

class VersionCategoryReportBiome extends S.Opaque<VersionCategoryReportBiome, { readonly brand: unique symbol }>()(
  S.Struct({
    category: S.tag("biome"),
    ...versionCategoryReportFields,
  }).pipe(
    $I.annoteSchema("VersionCategoryReportBiome", {
      description: "Version report entry for Biome category.",
    })
  )
) {}

class VersionCategoryReportEffect extends S.Opaque<VersionCategoryReportEffect, { readonly brand: unique symbol }>()(
  S.Struct({
    category: S.tag("effect"),
    ...versionCategoryReportFields,
  }).pipe(
    $I.annoteSchema("VersionCategoryReportEffect", {
      description: "Version report entry for Effect catalog packages.",
    })
  )
) {}

class VersionCategoryReportTurbo extends S.Opaque<VersionCategoryReportTurbo, { readonly brand: unique symbol }>()(
  S.Struct({
    category: S.tag("turbo"),
    ...versionCategoryReportFields,
  }).pipe(
    $I.annoteSchema("VersionCategoryReportTurbo", {
      description: "Version report entry for Turborepo turbo.json schema pins.",
    })
  )
) {}

/**
 * Report for a single version category (bun, node, docker, biome, effect, or turbo).
 *
 * **Example** (Annotate category report type)
 *
 * ```ts
 * import type { VersionCategoryReport } from "@beep/repo-cli/commands/VersionSync/VersionSync.schemas"
 *
 * const example: VersionCategoryReport | undefined = undefined
 * console.log(example === undefined) // true
 * ```
 *
 * @returns Tagged union schema keyed by `category`.
 * @category models
 * @since 0.0.0
 */
export const VersionCategoryReport = VersionCategory.mapMembers(
  Tuple.evolve([
    () => VersionCategoryReportBun,
    () => VersionCategoryReportNode,
    () => VersionCategoryReportDocker,
    () => VersionCategoryReportBiome,
    () => VersionCategoryReportEffect,
    () => VersionCategoryReportTurbo,
  ])
).pipe(
  $I.annoteSchema("VersionCategoryReport", {
    description: "Report for a single version category, including its status, items, and error",
  }),
  S.toTaggedUnion("category")
);
/**
 * Report for a single version category (bun, node, docker, biome, effect, or turbo).
 *
 * **Example** (Annotate category report type)
 *
 * ```ts
 * import type { VersionCategoryReport } from "@beep/repo-cli/commands/VersionSync/VersionSync.schemas"
 *
 * const example: VersionCategoryReport | undefined = undefined
 * console.log(example === undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type VersionCategoryReport = typeof VersionCategoryReport.Type;

/**
 * Full version sync report across all categories.
 *
 * **Example** (Import full sync report)
 *
 * ```ts
 * import { VersionSyncReport } from "@beep/repo-cli/commands/VersionSync/VersionSync.schemas"
 *
 * console.log(typeof VersionSyncReport !== "undefined") // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VersionSyncReport extends S.Opaque<VersionSyncReport, { readonly brand: unique symbol }>()(
  S.Struct({
    categories: S.Array(VersionCategoryReport),
    hasDrift: S.Boolean,
  }).pipe(
    $I.annoteSchema("VersionSyncReport", {
      description: "Full version sync report across all categories, including their statuses and errors",
    })
  )
) {}

/**
 * Command execution mode.
 *
 * **Example** (Annotate sync mode type)
 *
 * ```ts
 * import type { VersionSyncMode } from "@beep/repo-cli/commands/VersionSync/VersionSync.schemas"
 *
 * const example: VersionSyncMode | undefined = undefined
 * console.log(example === undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VersionSyncMode = RunMode;

/**
 * Pattern-matching helper for version-sync mode literals.
 *
 * **Example** (Import mode match helper)
 *
 * ```ts
 * import { VersionSyncModeMatch } from "@beep/repo-cli/commands/VersionSync/VersionSync.schemas"
 *
 * console.log(typeof VersionSyncModeMatch !== "undefined") // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const VersionSyncModeMatch = RunModeMatch;

/**
 * Command execution mode.
 *
 * **Example** (Annotate sync mode type)
 *
 * ```ts
 * import type { VersionSyncMode } from "@beep/repo-cli/commands/VersionSync/VersionSync.schemas"
 *
 * const example: VersionSyncMode | undefined = undefined
 * console.log(example === undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type VersionSyncMode = RunModeValue;

const DefaultedVersionSyncFlag = S.Boolean.pipe(
  S.withConstructorDefault(Effect.succeed(false)),
  S.withDecodingDefaultKey(Effect.succeed(false))
);

class VersionSyncOptionsCheck extends S.Opaque<VersionSyncOptionsCheck, { readonly brand: unique symbol }>()(
  S.Struct({
    mode: S.tag("check"),
    skipNetwork: DefaultedVersionSyncFlag,
    bunOnly: DefaultedVersionSyncFlag,
    nodeOnly: DefaultedVersionSyncFlag,
    dockerOnly: DefaultedVersionSyncFlag,
    biomeOnly: DefaultedVersionSyncFlag,
    effectOnly: DefaultedVersionSyncFlag,
    turboOnly: DefaultedVersionSyncFlag,
  }).pipe(
    $I.annoteSchema("VersionSyncOptionsCheck", {
      description: "Resolved option set for check mode.",
    })
  )
) {}

/**
 * Resolved option set for write mode.
 *
 * **Example** (Write only the Bun pin)
 *
 * ```ts
 * import { VersionSyncOptions, VersionSyncOptionsWrite } from "@beep/repo-cli/commands/VersionSync/VersionSync.schemas"
 *
 * const options = VersionSyncOptionsWrite.make({ bunOnly: true, skipNetwork: true })
 *
 * console.log(options.mode) // => "write"
 * console.log(options.nodeOnly) // => false
 * console.log(VersionSyncOptions.guards.write(options)) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VersionSyncOptionsWrite extends S.Opaque<VersionSyncOptionsWrite, { readonly brand: unique symbol }>()(
  S.Struct({
    mode: S.tag("write"),
    skipNetwork: DefaultedVersionSyncFlag,
    bunOnly: DefaultedVersionSyncFlag,
    nodeOnly: DefaultedVersionSyncFlag,
    dockerOnly: DefaultedVersionSyncFlag,
    biomeOnly: DefaultedVersionSyncFlag,
    effectOnly: DefaultedVersionSyncFlag,
    turboOnly: DefaultedVersionSyncFlag,
  }).pipe(
    $I.annoteSchema("VersionSyncOptionsWrite", {
      description: "Resolved option set for write mode.",
    })
  )
) {}

class VersionSyncOptionsDryRun extends S.Opaque<VersionSyncOptionsDryRun, { readonly brand: unique symbol }>()(
  S.Struct({
    mode: S.tag("dry-run"),
    skipNetwork: DefaultedVersionSyncFlag,
    bunOnly: DefaultedVersionSyncFlag,
    nodeOnly: DefaultedVersionSyncFlag,
    dockerOnly: DefaultedVersionSyncFlag,
    biomeOnly: DefaultedVersionSyncFlag,
    effectOnly: DefaultedVersionSyncFlag,
    turboOnly: DefaultedVersionSyncFlag,
  }).pipe(
    $I.annoteSchema("VersionSyncOptionsDryRun", {
      description: "Resolved option set for dry-run mode.",
    })
  )
) {}

/**
 * Resolved command options after flag parsing.
 *
 * **Example** (Annotate options type)
 *
 * ```ts
 * import type { VersionSyncOptions } from "@beep/repo-cli/commands/VersionSync/VersionSync.schemas"
 *
 * const example: VersionSyncOptions | undefined = undefined
 * console.log(example === undefined) // true
 * ```
 *
 * @returns Tagged union schema keyed by `mode`.
 * @category models
 * @since 0.0.0
 */
export const VersionSyncOptions = VersionSyncMode.mapMembers(
  Tuple.evolve([() => VersionSyncOptionsCheck, () => VersionSyncOptionsWrite, () => VersionSyncOptionsDryRun])
).pipe(
  $I.annoteSchema("VersionSyncOptions", {
    description: "Resolved command options after flag parsing.",
  }),
  S.toTaggedUnion("mode")
);

/**
 * Resolved command options after flag parsing.
 *
 * **Example** (Annotate options type)
 *
 * ```ts
 * import type { VersionSyncOptions } from "@beep/repo-cli/commands/VersionSync/VersionSync.schemas"
 *
 * const example: VersionSyncOptions | undefined = undefined
 * console.log(example === undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type VersionSyncOptions = typeof VersionSyncOptions.Type;

/**
 * YAML location to update in write mode.
 *
 * **Example** (Import update location schema)
 *
 * ```ts
 * import { VersionSyncUpdateLocation } from "@beep/repo-cli/commands/VersionSync/VersionSync.schemas"
 *
 * console.log(typeof VersionSyncUpdateLocation !== "undefined") // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VersionSyncUpdateLocation extends S.Opaque<VersionSyncUpdateLocation, { readonly brand: unique symbol }>()(
  S.Struct({
    file: S.String,
    yamlPath: S.Array(S.Union([S.String, S.Finite])),
  }).pipe(
    $I.annoteSchema("VersionSyncUpdateLocation", {
      description: "YAML location to update in write mode.",
    })
  )
) {}

/**
 * Resolver output consumed by reporting and write-mode services.
 *
 * **Example** (Import resolution schema)
 *
 * ```ts
 * import { VersionSyncResolution } from "@beep/repo-cli/commands/VersionSync/VersionSync.schemas"
 *
 * console.log(typeof VersionSyncResolution !== "undefined") // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VersionSyncResolution extends S.Opaque<VersionSyncResolution, { readonly brand: unique symbol }>()(
  S.Struct({
    report: VersionSyncReport,
    nodeLocations: ArrayKeyDefaultEmpty(VersionSyncUpdateLocation),
  }).pipe(
    $I.annoteSchema("VersionSyncResolution", {
      description: "Resolver output consumed by reporting and write-mode services.",
    })
  )
) {}
