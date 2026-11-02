/**
 * Write-mode update application service for version-sync.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { A, Str } from "@beep/utils";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { constant, dual, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { updateBiomeSchema } from "../resolvers/BiomeResolver.ts";
import { EFFECT_SOURCE_FIELD_PREFIX } from "../resolvers/EffectResolver.ts";
import { TURBO_SCHEMA_FIELD } from "../resolvers/TurboResolver.ts";
import { updateJsoncSchemaUrl } from "../updaters/JsoncSchemaUpdater.ts";
import {
  updateCatalogEntry,
  updateEffectSourceField,
  updatePackageManagerField,
} from "../updaters/PackageJsonUpdater.ts";
import { updatePlainTextFile } from "../updaters/PlainTextUpdater.ts";
import { updateVercelBunVersion } from "../updaters/VercelJsonUpdater.ts";
import { replaceNodeVersionWithFile, updateYamlValue } from "../updaters/YamlFileUpdater.ts";
import type * as FileSystem from "effect/FileSystem";
import type {
  VersionCategoryReport,
  VersionDriftItem,
  VersionSyncError,
  VersionSyncResolution,
} from "../../VersionSync.schemas.ts";

const $I = $RepoCliId.create("commands/VersionSync/internal/services/UpdateApplierService");
const VersionCategoryName = LiteralKit(["bun", "node", "docker", "biome", "effect", "turbo"]).pipe(
  $I.annoteSchema("VersionCategoryName", {
    description: "Supported update categories for write-mode version-sync application.",
  })
);
const versionCategoryNameEquivalence = S.toEquivalence(VersionCategoryName);

type UpdateApplierEnvironment = FileSystem.FileSystem | Path.Path;
type CategoryReportUpdater = (
  repoRoot: string,
  report: VersionCategoryReport
) => Effect.Effect<number, VersionSyncError, UpdateApplierEnvironment>;

const noChanges = Effect.succeed(0);
const noChangesThunk = () => noChanges;

const countChangedFile = (count: number, changed: boolean): number => Num.sum(count, changed ? 1 : 0);

/**
 * Run one updater per drift item, in report order, and count the items whose
 * updater changed a file.
 *
 * **Details**
 *
 * Items run sequentially; an updater answering `false` (unmatched or already
 * correct) adds nothing. The first failing updater fails the whole run and
 * later items are not attempted.
 *
 * **Example** (Count changed items)
 *
 * ```ts
 * import { countItemUpdates, VersionCategoryReport, VersionDriftItem } from "@beep/repo-cli/test/VersionSync"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const item = (field: string) =>
 *   VersionDriftItem.make({ file: "package.json", field, current: "1", expected: "2", line: O.none() })
 * const report = VersionCategoryReport.cases.effect.make({ status: "drift", items: [item("a"), item("b")] })
 *
 * console.log(Effect.runSync(countItemUpdates(report, (entry) => Effect.succeed(entry.field === "a")))) // 1
 * ```
 *
 * @param report - The category report whose drift items are applied.
 * @param updateItem - Applies one item and answers whether a file changed.
 * @returns The number of items that changed a file.
 * @category utilities
 * @since 0.0.0
 */
export const countItemUpdates: {
  <E, R>(
    updateItem: (item: VersionDriftItem) => Effect.Effect<boolean, E, R>
  ): (report: VersionCategoryReport) => Effect.Effect<number, E, R>;
  <E, R>(
    report: VersionCategoryReport,
    updateItem: (item: VersionDriftItem) => Effect.Effect<boolean, E, R>
  ): Effect.Effect<number, E, R>;
} = dual(
  2,
  <E, R>(
    report: VersionCategoryReport,
    updateItem: (item: VersionDriftItem) => Effect.Effect<boolean, E, R>
  ): Effect.Effect<number, E, R> =>
    Effect.reduce(report.items, constant(0), (count, item) =>
      Effect.map(updateItem(item), (changed) => countChangedFile(count, changed))
    )
);

/**
 * Service contract for applying report-driven file updates.
 *
 * @category models
 * @since 0.0.0
 */
export type UpdateApplierServiceShape = {
  readonly apply: (
    repoRoot: string,
    resolution: VersionSyncResolution
  ) => Effect.Effect<number, VersionSyncError, UpdateApplierEnvironment>;
};

/**
 * Service tag for write-mode update application.
 *
 * @category ports
 * @since 0.0.0
 */
export class UpdateApplierService extends Context.Service<UpdateApplierService, UpdateApplierServiceShape>()(
  $I`UpdateApplierService`
) {}

type ItemUpdates = Readonly<Record<string, () => Effect.Effect<boolean, VersionSyncError, UpdateApplierEnvironment>>>;

// Applies each drift item through the updater keyed by `<file>:<field>`;
// items without an updater count as unchanged.
const applyKeyedUpdates = (
  updatesFor: (repoRoot: string, path: Path.Path, item: VersionDriftItem) => ItemUpdates
): CategoryReportUpdater =>
  Effect.fn(function* (repoRoot, report) {
    const path = yield* Path.Path;

    return yield* countItemUpdates(report, (item) =>
      O.match(R.get(updatesFor(repoRoot, path, item), `${item.file}:${item.field}`), {
        onNone: () => Effect.succeed(false),
        onSome: (update) => update(),
      })
    );
  });

const applyBunUpdates = applyKeyedUpdates((repoRoot, path, item) => ({
  ".bun-version:version": () => updatePlainTextFile(path.join(repoRoot, ".bun-version"), item.expected),
  "package.json:packageManager": () =>
    updatePackageManagerField(path.join(repoRoot, "package.json"), Str.replace(/^bun@/, "")(item.expected)),
  "apps/oip-web/vercel.json:installCommand Bun version": () =>
    updateVercelBunVersion(path.join(repoRoot, "apps", "oip-web", "vercel.json"), "installCommand", item.expected),
  "apps/oip-web/vercel.json:buildCommand Bun version": () =>
    updateVercelBunVersion(path.join(repoRoot, "apps", "oip-web", "vercel.json"), "buildCommand", item.expected),
  ".bun-linux-x64.sha256:bun-linux-x64.zip sha256": () =>
    updatePlainTextFile(path.join(repoRoot, ".bun-linux-x64.sha256"), item.expected),
}));

const applyNodeUpdates = Effect.fn(function* (
  repoRoot: string,
  locations: ReadonlyArray<{ readonly file: string; readonly yamlPath: ReadonlyArray<string | number> }>
) {
  const path = yield* Path.Path;
  const grouped = MutableHashMap.empty<string, Array<{ readonly yamlPath: ReadonlyArray<string | number> }>>();
  let filesChanged = 0;

  for (const location of locations) {
    const yamlLocation = { yamlPath: location.yamlPath };
    MutableHashMap.set(
      grouped,
      location.file,
      pipe(
        MutableHashMap.get(grouped, location.file),
        O.map(A.append(yamlLocation)),
        O.getOrElse(() => A.of(yamlLocation))
      )
    );
  }

  for (const [file, yamlLocations] of grouped) {
    const changed = yield* replaceNodeVersionWithFile(path.join(repoRoot, file), yamlLocations);
    filesChanged = countChangedFile(filesChanged, changed);
  }

  return filesChanged;
});

const applyDockerUpdates = Effect.fn(function* (repoRoot: string, report: VersionCategoryReport) {
  const path = yield* Path.Path;
  const composePath = path.join(repoRoot, "docker-compose.yml");
  let filesChanged = 0;

  for (const item of report.items) {
    if (Str.includes("<pin to")(item.expected)) {
      continue;
    }

    const colonIdx = O.getOrElse(Str.lastIndexOf(":")(item.expected), () => -1);
    if (colonIdx < 0) {
      continue;
    }

    const serviceName = O.flatMap(Str.match(/\(([^)]+)\)/)(item.field), (match) => O.fromUndefinedOr(match[1]));
    if (O.isNone(serviceName)) {
      continue;
    }

    const changed = yield* updateYamlValue(composePath, ["services", serviceName.value, "image"], {
      value: item.expected,
    });
    filesChanged = countChangedFile(filesChanged, changed);
  }

  return filesChanged;
});

const applyBiomeUpdates = applyKeyedUpdates((repoRoot, path, item) => ({
  "biome.jsonc:$schema version": () => updateBiomeSchema(path.join(repoRoot, "biome.jsonc"), item.expected),
}));

const applyTurboUpdates = Effect.fn(function* (repoRoot: string, report: VersionCategoryReport) {
  const path = yield* Path.Path;

  return yield* countItemUpdates(report, (item) =>
    Str.equivalence(item.field, TURBO_SCHEMA_FIELD)
      ? updateJsoncSchemaUrl(path.join(repoRoot, item.file), item.expected)
      : Effect.succeed(false)
  );
});

const EFFECT_CATALOG_FIELD_PREFIX = "catalog.";

// An errored report means the release commit is unknown, so its
// `config.effectSource` items are skipped: writing the version alone would
// pair it with a stale commit.
const updateEffectSourceItem = (packageJsonPath: string, report: VersionCategoryReport, item: VersionDriftItem) =>
  O.isSome(report.error)
    ? Effect.succeed(false)
    : updateEffectSourceField(packageJsonPath, Str.slice(EFFECT_SOURCE_FIELD_PREFIX.length)(item.field), item.expected);

const updateEffectCatalogItem = (packageJsonPath: string, item: VersionDriftItem) => {
  const dependencyName = Str.startsWith(EFFECT_CATALOG_FIELD_PREFIX)(item.field)
    ? Str.slice(EFFECT_CATALOG_FIELD_PREFIX.length)(item.field)
    : "";

  return Str.isEmpty(dependencyName)
    ? Effect.succeed(false)
    : updateCatalogEntry(packageJsonPath, dependencyName, { versionSpecifier: item.expected });
};

const applyEffectUpdates = Effect.fn(function* (repoRoot: string, report: VersionCategoryReport) {
  const path = yield* Path.Path;
  const packageJsonPath = path.join(repoRoot, "package.json");

  return yield* countItemUpdates(report, (item) =>
    Str.startsWith(EFFECT_SOURCE_FIELD_PREFIX)(item.field)
      ? updateEffectSourceItem(packageJsonPath, report, item)
      : updateEffectCatalogItem(packageJsonPath, item)
  );
});

const applyReportUpdates = (
  repoRoot: string,
  reportOption: O.Option<VersionCategoryReport>,
  updateReport: CategoryReportUpdater
) =>
  pipe(
    reportOption,
    O.map((report) =>
      A.match(report.items, {
        onEmpty: noChangesThunk,
        onNonEmpty: () => updateReport(repoRoot, report),
      })
    ),
    O.getOrElse(noChangesThunk)
  );

const apply: UpdateApplierServiceShape["apply"] = Effect.fn(function* (repoRoot, resolution) {
  const bunReport = A.findFirst(resolution.report.categories, (category) =>
    versionCategoryNameEquivalence(category.category, "bun")
  );
  const dockerReport = A.findFirst(resolution.report.categories, (category) =>
    versionCategoryNameEquivalence(category.category, "docker")
  );
  const biomeReport = A.findFirst(resolution.report.categories, (category) =>
    versionCategoryNameEquivalence(category.category, "biome")
  );
  const effectReport = A.findFirst(resolution.report.categories, (category) =>
    versionCategoryNameEquivalence(category.category, "effect")
  );
  const turboReport = A.findFirst(resolution.report.categories, (category) =>
    versionCategoryNameEquivalence(category.category, "turbo")
  );

  const bunChanges = yield* applyReportUpdates(repoRoot, bunReport, applyBunUpdates);

  const nodeChanges = yield* A.match(resolution.nodeLocations, {
    onEmpty: noChangesThunk,
    onNonEmpty: (locations) =>
      applyNodeUpdates(
        repoRoot,
        A.map(locations, (location) => ({ file: location.file, yamlPath: location.yamlPath }))
      ),
  });

  const dockerChanges = yield* applyReportUpdates(repoRoot, dockerReport, applyDockerUpdates);
  const biomeChanges = yield* applyReportUpdates(repoRoot, biomeReport, applyBiomeUpdates);
  const effectChanges = yield* applyReportUpdates(repoRoot, effectReport, applyEffectUpdates);
  const turboChanges = yield* applyReportUpdates(repoRoot, turboReport, applyTurboUpdates);

  return Num.sumAll([bunChanges, nodeChanges, dockerChanges, biomeChanges, effectChanges, turboChanges]);
});

/**
 * Live layer for update application.
 *
 * @category configuration
 * @since 0.0.0
 */
export const UpdateApplierServiceLive = Layer.succeed(
  UpdateApplierService,
  UpdateApplierService.of({
    apply,
  })
);
