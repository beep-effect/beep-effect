/**
 * Write-mode update application service for version-sync.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { Context, Effect, Layer, Match, MutableHashMap, Number as Num, Path, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { updateBiomeSchema } from "../resolvers/BiomeResolver.js";
import { updateCatalogEntry, updatePackageManagerField } from "../updaters/PackageJsonUpdater.js";
import { updatePlainTextFile } from "../updaters/PlainTextUpdater.js";
import { replaceNodeVersionWithFile, updateYamlValue } from "../updaters/YamlFileUpdater.js";
import type { FileSystem } from "effect";
import type { VersionCategoryReport, VersionSyncError, VersionSyncResolution } from "../../VersionSync.schemas.js";

const $I = $RepoCliId.create("commands/VersionSync/internal/services/UpdateApplierService");
const VersionCategoryName = LiteralKit(["bun", "node", "docker", "biome", "effect"]).pipe(
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

const applyBunUpdates = Effect.fn(function* (repoRoot: string, report: VersionCategoryReport) {
  const path = yield* Path.Path;
  let filesChanged = 0;

  for (const item of report.items) {
    const changed = yield* Match.value(`${item.file}:${item.field}`).pipe(
      Match.when(".bun-version:version", () => updatePlainTextFile(path.join(repoRoot, ".bun-version"), item.expected)),
      Match.when("package.json:packageManager", () =>
        updatePackageManagerField(path.join(repoRoot, "package.json"), Str.replace(/^bun@/, "")(item.expected))
      ),
      Match.orElse(() => Effect.succeed(false))
    );

    filesChanged = countChangedFile(filesChanged, changed);
  }

  return filesChanged;
});

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

const applyBiomeUpdates = Effect.fn(function* (repoRoot: string, report: VersionCategoryReport) {
  const path = yield* Path.Path;
  let filesChanged = 0;

  for (const item of report.items) {
    const changed = yield* Match.value(`${item.file}:${item.field}`).pipe(
      Match.when("biome.jsonc:$schema version", () =>
        updateBiomeSchema(path.join(repoRoot, "biome.jsonc"), item.expected)
      ),
      Match.orElse(() => Effect.succeed(false))
    );
    filesChanged = countChangedFile(filesChanged, changed);
  }

  return filesChanged;
});

const EFFECT_CATALOG_FIELD_PREFIX = "catalog.";

const applyEffectUpdates = Effect.fn(function* (repoRoot: string, report: VersionCategoryReport) {
  const path = yield* Path.Path;
  const packageJsonPath = path.join(repoRoot, "package.json");
  let filesChanged = 0;

  for (const item of report.items) {
    if (!Str.startsWith(EFFECT_CATALOG_FIELD_PREFIX)(item.field)) {
      continue;
    }

    const dependencyName = Str.slice(EFFECT_CATALOG_FIELD_PREFIX.length)(item.field);
    if (Str.isEmpty(dependencyName)) {
      continue;
    }

    const changed = yield* updateCatalogEntry(packageJsonPath, dependencyName, {
      versionSpecifier: item.expected,
    });
    filesChanged = countChangedFile(filesChanged, changed);
  }

  return filesChanged;
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

  return Num.sumAll([bunChanges, nodeChanges, dockerChanges, biomeChanges, effectChanges]);
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
