/**
 * Data types and tagged errors for the version-sync command.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { A } from "@beep/utils";
import { Effect, Tuple } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { RunMode, RunModeMatch } from "../../internal/cli/RunMode.js";
import type { RunMode as RunModeValue } from "../../internal/cli/RunMode.js";

/**
 * Public version-sync error exports.
 *
 * @category errors
 * @since 0.0.0
 */
export { NetworkUnavailableError, VersionSyncDriftError, VersionSyncError } from "./VersionSync.errors.js";

const $I = $RepoCliId.create("commands/VersionSync/VersionSync.schemas");

// ── Errors ──────────────────────────────────────────────────────────────────

// ── Report model ────────────────────────────────────────────────────────────

/**
 * A single version pin location with its current and expected values.
 *
 * @category models
 * @since 0.0.0
 */
export class VersionDriftItem extends S.Class<VersionDriftItem>($I`VersionDriftItem`)(
  {
    file: S.String,
    field: S.String,
    current: S.String,
    expected: S.String,
    line: S.Option(S.Finite),
  },
  $I.annote("VersionDriftItem", {
    description: "A single version pin location with its current and expected values",
  })
) {}

/**
 * Version category for grouping drift items.
 *
 * @category models
 * @since 0.0.0
 */
const VersionCategoryKit = LiteralKit(["bun", "node", "docker", "biome", "effect"]);
/**
 * Version category for grouping drift items.
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
 * @category models
 * @since 0.0.0
 */
export const VersionCategoryOptions = VersionCategoryKit.Options;
/**
 * Version category for grouping drift items.
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
 * @category models
 * @since 0.0.0
 */
export const VersionCategoryStatusMatch = VersionCategoryStatusKit.$match;
/**
 * Enum mapping for version category status literals.
 *
 * @category models
 * @since 0.0.0
 */
export const VersionCategoryStatusEnum = VersionCategoryStatusKit.Enum;
/**
 * Thunk helpers for version category status literals.
 *
 * @category models
 * @since 0.0.0
 */
export const VersionCategoryStatusThunk = VersionCategoryStatusKit.thunk;
/**
 * Status of a version category.
 *
 * @category models
 * @since 0.0.0
 */
export type VersionCategoryStatus = typeof VersionCategoryStatus.Type;

class VersionCategoryReportBun extends S.Class<VersionCategoryReportBun>($I`VersionCategoryReportBun`)(
  {
    category: S.tag("bun"),
    status: VersionCategoryStatus,
    items: S.Array(VersionDriftItem).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<VersionDriftItem>())),
      S.withDecodingDefault(Effect.succeed(A.empty<VersionDriftItem>()))
    ),
    error: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
    latest: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
  },
  $I.annote("VersionCategoryReportBun", {
    description: "Version report entry for Bun category.",
  })
) {}

class VersionCategoryReportNode extends S.Class<VersionCategoryReportNode>($I`VersionCategoryReportNode`)(
  {
    category: S.tag("node"),
    status: VersionCategoryStatus,
    items: S.Array(VersionDriftItem).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<VersionDriftItem>())),
      S.withDecodingDefault(Effect.succeed(A.empty<VersionDriftItem>()))
    ),
    error: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
    latest: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
  },
  $I.annote("VersionCategoryReportNode", {
    description: "Version report entry for Node category.",
  })
) {}

class VersionCategoryReportDocker extends S.Class<VersionCategoryReportDocker>($I`VersionCategoryReportDocker`)(
  {
    category: S.tag("docker"),
    status: VersionCategoryStatus,
    items: S.Array(VersionDriftItem).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<VersionDriftItem>())),
      S.withDecodingDefault(Effect.succeed(A.empty<VersionDriftItem>()))
    ),
    error: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
    latest: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
  },
  $I.annote("VersionCategoryReportDocker", {
    description: "Version report entry for Docker category.",
  })
) {}

class VersionCategoryReportBiome extends S.Class<VersionCategoryReportBiome>($I`VersionCategoryReportBiome`)(
  {
    category: S.tag("biome"),
    status: VersionCategoryStatus,
    items: S.Array(VersionDriftItem).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<VersionDriftItem>())),
      S.withDecodingDefault(Effect.succeed(A.empty<VersionDriftItem>()))
    ),
    error: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
    latest: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
  },
  $I.annote("VersionCategoryReportBiome", {
    description: "Version report entry for Biome category.",
  })
) {}

class VersionCategoryReportEffect extends S.Class<VersionCategoryReportEffect>($I`VersionCategoryReportEffect`)(
  {
    category: S.tag("effect"),
    status: VersionCategoryStatus,
    items: S.Array(VersionDriftItem).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<VersionDriftItem>())),
      S.withDecodingDefault(Effect.succeed(A.empty<VersionDriftItem>()))
    ),
    error: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
    latest: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeed(O.none<string>()))),
  },
  $I.annote("VersionCategoryReportEffect", {
    description: "Version report entry for Effect catalog packages.",
  })
) {}

/**
 * Report for a single version category (bun, node, docker, biome, or effect).
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
  ])
).pipe(
  $I.annoteSchema("VersionCategoryReport", {
    description: "Report for a single version category, including its status, items, and error",
  }),
  S.toTaggedUnion("category")
);
/**
 * Report for a single version category (bun, node, docker, or biome).
 *
 * @category models
 * @since 0.0.0
 */
export type VersionCategoryReport = typeof VersionCategoryReport.Type;

/**
 * Full version sync report across all categories.
 *
 * @category models
 * @since 0.0.0
 */
export class VersionSyncReport extends S.Class<VersionSyncReport>($I`VersionSyncReport`)(
  {
    categories: S.Array(VersionCategoryReport),
    hasDrift: S.Boolean,
  },
  $I.annote("VersionSyncReport", {
    description: "Full version sync report across all categories, including their statuses and errors",
  })
) {}

/**
 * Command execution mode.
 *
 * @category models
 * @since 0.0.0
 */
export const VersionSyncMode = RunMode;

/**
 * Pattern-matching helper for version-sync mode literals.
 *
 * @category models
 * @since 0.0.0
 */
export const VersionSyncModeMatch = RunModeMatch;

/**
 * Command execution mode.
 *
 * @category models
 * @since 0.0.0
 */
export type VersionSyncMode = RunModeValue;

const DefaultedVersionSyncFlag = S.Boolean.pipe(
  S.withConstructorDefault(Effect.succeed(false)),
  S.withDecodingDefault(Effect.succeed(false))
);

class VersionSyncOptionsCheck extends S.Class<VersionSyncOptionsCheck>($I`VersionSyncOptionsCheck`)(
  {
    mode: S.tag("check"),
    skipNetwork: DefaultedVersionSyncFlag,
    bunOnly: DefaultedVersionSyncFlag,
    nodeOnly: DefaultedVersionSyncFlag,
    dockerOnly: DefaultedVersionSyncFlag,
    biomeOnly: DefaultedVersionSyncFlag,
    effectOnly: DefaultedVersionSyncFlag,
  },
  $I.annote("VersionSyncOptionsCheck", {
    description: "Resolved option set for check mode.",
  })
) {}

class VersionSyncOptionsWrite extends S.Class<VersionSyncOptionsWrite>($I`VersionSyncOptionsWrite`)(
  {
    mode: S.tag("write"),
    skipNetwork: DefaultedVersionSyncFlag,
    bunOnly: DefaultedVersionSyncFlag,
    nodeOnly: DefaultedVersionSyncFlag,
    dockerOnly: DefaultedVersionSyncFlag,
    biomeOnly: DefaultedVersionSyncFlag,
    effectOnly: DefaultedVersionSyncFlag,
  },
  $I.annote("VersionSyncOptionsWrite", {
    description: "Resolved option set for write mode.",
  })
) {}

class VersionSyncOptionsDryRun extends S.Class<VersionSyncOptionsDryRun>($I`VersionSyncOptionsDryRun`)(
  {
    mode: S.tag("dry-run"),
    skipNetwork: DefaultedVersionSyncFlag,
    bunOnly: DefaultedVersionSyncFlag,
    nodeOnly: DefaultedVersionSyncFlag,
    dockerOnly: DefaultedVersionSyncFlag,
    biomeOnly: DefaultedVersionSyncFlag,
    effectOnly: DefaultedVersionSyncFlag,
  },
  $I.annote("VersionSyncOptionsDryRun", {
    description: "Resolved option set for dry-run mode.",
  })
) {}

/**
 * Resolved command options after flag parsing.
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
 * @category models
 * @since 0.0.0
 */
export type VersionSyncOptions = typeof VersionSyncOptions.Type;

/**
 * YAML location to update in write mode.
 *
 * @category models
 * @since 0.0.0
 */
export class VersionSyncUpdateLocation extends S.Class<VersionSyncUpdateLocation>($I`VersionSyncUpdateLocation`)(
  {
    file: S.String,
    yamlPath: S.Array(S.Union([S.String, S.Finite])),
  },
  $I.annote("VersionSyncUpdateLocation", {
    description: "YAML location to update in write mode.",
  })
) {}

/**
 * Resolver output consumed by reporting and write-mode services.
 *
 * @category models
 * @since 0.0.0
 */
export class VersionSyncResolution extends S.Class<VersionSyncResolution>($I`VersionSyncResolution`)(
  {
    report: VersionSyncReport,
    nodeLocations: S.Array(VersionSyncUpdateLocation).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<VersionSyncUpdateLocation>())),
      S.withDecodingDefault(Effect.succeed(A.empty<VersionSyncUpdateLocation>()))
    ),
  },
  $I.annote("VersionSyncResolution", {
    description: "Resolver output consumed by reporting and write-mode services.",
  })
) {}
