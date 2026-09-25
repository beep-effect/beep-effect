/**
 * The `beep models` check orchestrator, the composed default layer, and the
 * facade over the group's service modules.
 *
 * **Details**
 *
 * The catalog, manifest, and locator services live in their own role files;
 * this module composes them into one `check` run and re-exports them so
 * callers keep a single import surface. Slice 1 is read-only — no service
 * writes a projection target.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A, O, pipe } from "@beep/utils";
import { Effect, FileSystem, Layer, Match } from "effect";
import * as Context from "effect/Context";
import * as HashMap from "effect/HashMap";
import * as S from "effect/Schema";
import { CatalogDiff } from "./Models.catalog.schemas.ts";
import {
  ModelsCatalog,
  ModelsCatalogLive,
  ModelsCatalogOptions,
  ModelsCatalogSourcesLive,
  ModelsLedger,
  ModelsLedgerLive,
} from "./Models.catalog.service.ts";
import { catalogModelsById, diffSnapshots } from "./Models.diff.ts";
import { ModelsCommandError } from "./Models.errors.ts";
import { ModelsLocatorReader, ModelsLocatorReaderLive } from "./Models.locator.service.ts";
import { isEffortAllowedOnSurface } from "./Models.manifest.schemas.ts";
import { ModelsManifestStore, ModelsManifestStoreLive } from "./Models.manifest.service.ts";
import { ModelsTargetFile, ModelsTargetLocation, resolveTargetPath } from "./Models.paths.ts";
import { expectedLocatorValue, renderGeneratedBlockBody } from "./Models.render.ts";
import { DriftFinding, ModelsCheckReport } from "./Models.report.schemas.ts";
import type { Crypto, Path } from "effect";
import type { HttpClient } from "effect/http";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { CatalogModel, CatalogSource, ModelId } from "./Models.catalog.schemas.ts";
import type { ModelsCatalogSources } from "./Models.catalog.service.ts";
import type {
  ModelsCatalogError,
  ModelsLedgerError,
  ModelsLocatorError,
  ModelsManifestError,
} from "./Models.errors.ts";
import type { ModelsLocatorReaderShape } from "./Models.locator.service.ts";
import type {
  Locator,
  LocatorBinding,
  ModelBinding,
  ModelSyncTarget,
  ModelsManifest,
  RoutingSurface,
} from "./Models.manifest.schemas.ts";
import type { DriftKind } from "./Models.report.schemas.ts";

const $I = $RepoCliId.create("commands/Models/Models.service");

/**
 * Catalog-side services: the I/O seam, the layered catalog, and the ledger.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./Models.catalog.service.ts";
/**
 * Per-grammar locator readers.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./Models.locator.service.ts";
/**
 * The operator-manifest store.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./Models.manifest.service.ts";
/**
 * Paths, path-shaped constants, and shared file access.
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./Models.paths.ts";

// ── Check orchestration ─────────────────────────────────────────────────────

/**
 * Options one `beep models check` run executes under.
 *
 * **Example** (Describe one check run)
 *
 * ```ts
 * import { ModelsCheckOptions } from "@beep/repo-cli/commands/Models"
 *
 * const options = ModelsCheckOptions.make({
 *   home: "/home/op",
 *   repo: "/repo",
 *   manifestPath: "/home/op/.config/beep/models.yaml",
 *   offline: false
 * })
 * console.log(options.repo) // "/repo"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ModelsCheckOptions extends S.Class<ModelsCheckOptions>($I`ModelsCheckOptions`)(
  {
    home: S.NonEmptyString,
    repo: S.NonEmptyString,
    manifestPath: S.NonEmptyString,
    offline: S.Boolean,
  },
  $I.annote("ModelsCheckOptions", {
    description: "Both trees, the manifest path, and the offline flag one check run executes under.",
  })
) {}

/**
 * Orchestrates manifest, catalog, diff, and drift into one report.
 *
 * @category services
 * @since 0.0.0
 */
export interface ModelsCheckShape {
  readonly run: (
    options: ModelsCheckOptions
  ) => Effect.Effect<
    ModelsCheckReport,
    ModelsCommandError,
    | ModelsCatalog
    | ModelsLedger
    | ModelsManifestStore
    | ModelsLocatorReader
    | ModelsCatalogSources
    | FileSystem.FileSystem
    | Path.Path
  >;
}

/**
 * The `check` orchestrator.
 *
 * **Gotchas**
 *
 * An offline run suppresses the catalog diff: the availability overlays report
 * different effort ladders than upstream, so a projected diff would be a wall
 * of phantom `levelsChanged`. Such a run returns an empty `diff` and reports
 * `diffScope: "suppressed-offline"` — read that field before treating an empty
 * diff as "no upstream churn".
 *
 * **Example** (Describe a check run)
 *
 * ```ts
 * import { ModelsCheck } from "@beep/repo-cli/commands/Models"
 * import * as Effect from "effect/Effect"
 *
 * const program = ModelsCheck.use((check) =>
 *   check.run({ home: "/home/op", repo: "/repo", manifestPath: "/home/op/models.yaml", offline: true })
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ModelsCheck extends Context.Service<ModelsCheck, ModelsCheckShape>()($I`ModelsCheck`) {}

const bindingKey = (role: string, surface: string): string => `${role}::${surface}`;

const surfaceOverlay = (surface: RoutingSurface): O.Option<CatalogSource> =>
  Match.value(surface).pipe(
    Match.whenOr("codex-cli", "codex-plugin", "jetbrains-codex", () => O.some<CatalogSource>("codex-cache")),
    Match.when("grok-cli", () => O.some<CatalogSource>("grok-cache")),
    Match.when("cursor-seat", () => O.some<CatalogSource>("cursor-agent")),
    Match.when("proxy-workflow", () => O.some<CatalogSource>("proxy-v1-models")),
    // `claude-code` is the one ungated surface: no overlay enumerates the
    // models a direct Anthropic session may select, so availability there is
    // never asserted.
    Match.when("claude-code", O.none<CatalogSource>),
    Match.exhaustive
  );

const availableOnSurface = (model: CatalogModel, surface: RoutingSurface): boolean =>
  Match.value(surface).pipe(
    Match.whenOr("codex-cli", "codex-plugin", "jetbrains-codex", () => model.availability.codexCli),
    Match.when("grok-cli", () => model.availability.grokCli),
    Match.when("cursor-seat", () => model.availability.cursor),
    Match.when("proxy-workflow", () => model.availability.proxy),
    Match.when("claude-code", () => true),
    Match.exhaustive
  );

const finding = (
  target: ModelSyncTarget,
  locator: Locator,
  current: O.Option<string>,
  expected: string,
  kind: DriftKind
): DriftFinding =>
  DriftFinding.make({
    targetId: target.id,
    path: target.path,
    locator,
    current,
    expected,
    kind,
  });

const filterBindings = (
  manifest: ModelsManifest,
  roles: ReadonlyArray<string>,
  surfaces: ReadonlyArray<string>
): ReadonlyArray<ModelBinding> =>
  A.filter(
    manifest.bindings,
    (candidate) =>
      (A.isReadonlyArrayEmpty(roles) || A.contains(roles, candidate.role)) &&
      (A.isReadonlyArrayEmpty(surfaces) || A.contains(surfaces, candidate.surface))
  );

const bindingProblem = (
  binding: ModelBinding,
  reference: LocatorBinding,
  models: HashMap.HashMap<ModelId, CatalogModel>,
  answered: ReadonlyArray<CatalogSource>
): O.Option<DriftKind> => {
  const model = HashMap.get(models, binding.modelId);
  if (O.isNone(model)) {
    // Every layer being absent is "no catalog", not a retirement; an id absent
    // from a catalog that *did* answer is the only retirement signal upstream
    // gives, because removals are hard deletes.
    return A.isReadonlyArrayEmpty(answered) ? O.none<DriftKind>() : O.some<DriftKind>("unknown-model");
  }

  const overlayAnswered = O.exists(surfaceOverlay(binding.surface), (source) => A.contains(answered, source));
  if (overlayAnswered && !availableOnSurface(model.value, binding.surface)) {
    return O.some<DriftKind>("unknown-model");
  }

  const effortInvalid = O.exists(binding.effort, (effort) => !isEffortAllowedOnSurface(binding.surface, effort));
  const effortMissing = reference.field !== "model" && O.isNone(binding.effort);

  return effortInvalid || effortMissing ? O.some<DriftKind>("invalid-effort") : O.none<DriftKind>();
};

interface LocatorCheckInput {
  readonly answered: ReadonlyArray<CatalogSource>;
  readonly bindings: HashMap.HashMap<string, ModelBinding>;
  readonly file: ModelsTargetFile;
  readonly locator: Locator;
  readonly manifest: ModelsManifest;
  readonly models: HashMap.HashMap<ModelId, CatalogModel>;
  readonly reader: ModelsLocatorReaderShape;
  readonly target: ModelSyncTarget;
}

const expectedFor = (input: LocatorCheckInput): O.Option<string> => {
  const locator = input.locator;
  if (locator._tag === "md-generated-block") {
    return O.some(
      renderGeneratedBlockBody(
        filterBindings(input.manifest, locator.filter.roles, locator.filter.surfaces),
        input.manifest.superseded,
        locator.includeSuperseded
      )
    );
  }

  return pipe(
    HashMap.get(input.bindings, bindingKey(locator.binding.role, locator.binding.surface)),
    O.flatMap((binding) => expectedLocatorValue(binding, locator.binding.field, locator.render))
  );
};

const bindingFinding = (input: LocatorCheckInput, expected: O.Option<string>): O.Option<DriftFinding> => {
  const locator = input.locator;
  if (locator._tag === "md-generated-block") {
    return O.none<DriftFinding>();
  }

  const reference = locator.binding;
  const binding = HashMap.get(input.bindings, bindingKey(reference.role, reference.surface));
  if (O.isNone(binding)) {
    return O.some(
      finding(
        input.target,
        input.locator,
        O.none(),
        `a binding for ${reference.role} x ${reference.surface}`,
        "unknown-model"
      )
    );
  }

  return O.map(bindingProblem(binding.value, reference, input.models, input.answered), (kind) =>
    finding(
      input.target,
      input.locator,
      O.none(),
      O.getOrElse(expected, () => binding.value.modelId),
      kind
    )
  );
};

const checkLocator = Effect.fnUntraced(function* (
  input: LocatorCheckInput
): Effect.fn.Return<O.Option<DriftFinding>, ModelsLocatorError> {
  const expected = expectedFor(input);
  const upstreamProblem = bindingFinding(input, expected);
  if (O.isSome(upstreamProblem)) {
    return upstreamProblem;
  }

  if (O.isNone(expected)) {
    return O.some(finding(input.target, input.locator, O.none(), "a renderable binding value", "invalid-effort"));
  }

  const current = yield* input.reader.read(input.file, input.locator);
  if (O.isNone(current)) {
    return O.some(finding(input.target, input.locator, O.none(), expected.value, "missing-locator"));
  }

  return current.value === expected.value
    ? O.none<DriftFinding>()
    : O.some(finding(input.target, input.locator, current, expected.value, "stale"));
});

const makeCheck = (): ModelsCheckShape => ({
  run: Effect.fn("ModelsCheck.run")(
    function* (options: ModelsCheckOptions) {
      const store = yield* ModelsManifestStore;
      const catalog = yield* ModelsCatalog;
      const ledger = yield* ModelsLedger;
      const reader = yield* ModelsLocatorReader;
      const fs = yield* FileSystem.FileSystem;

      const manifest = yield* store.load(options.manifestPath);
      const snapshot = yield* catalog.snapshot(
        ModelsCatalogOptions.make({ home: options.home, offline: options.offline })
      );
      const previous = yield* ledger.latest(options.home);
      // An offline snapshot omits the upstream layer, so recording it would
      // make the next online run report every upstream-only model as `added`
      // and a later offline run report them as `removed`. Only an online
      // snapshot is a baseline.
      if (!options.offline) {
        yield* ledger.record(options.home, snapshot);
      }

      // An offline snapshot has no upstream layer, so comparing it with the
      // online baseline would report every upstream-only model as `removed`.
      // An offline run carries an empty catalog diff instead.
      const diff = options.offline
        ? CatalogDiff.make({ added: [], removed: [], levelsChanged: [] })
        : diffSnapshots(previous, snapshot);
      const models = catalogModelsById(snapshot.models);
      const answered = snapshot.summary.sources;
      const bindings = HashMap.fromIterable(
        A.map(manifest.bindings, (entry) => [bindingKey(entry.role, entry.surface), entry] as const)
      );

      const findings = yield* Effect.forEach(
        manifest.targets,
        Effect.fnUntraced(function* (target: ModelSyncTarget) {
          const resolved = resolveTargetPath(
            ModelsTargetLocation.make({
              root: target.root,
              path: target.path,
              home: options.home,
              repo: options.repo,
            })
          );

          // A path that leaves its declared root is never opened, and the
          // `optional` flag does not excuse it: the manifest is wrong, not the
          // filesystem.
          if (O.isNone(resolved)) {
            return A.map(target.locators, (locator) =>
              finding(target, locator, O.none(), `a path inside the ${target.root} root`, "missing-file")
            );
          }

          const absolutePath = resolved.value;
          const exists = yield* fs.exists(absolutePath).pipe(Effect.orElseSucceed(() => false));

          if (!exists) {
            return target.optional
              ? ([] as ReadonlyArray<DriftFinding>)
              : A.map(target.locators, (locator) => finding(target, locator, O.none(), absolutePath, "missing-file"));
          }

          const content = yield* fs.readFileString(absolutePath).pipe(Effect.orElseSucceed(() => ""));
          const file = ModelsTargetFile.make({ root: target.root, absolutePath, content });

          return yield* Effect.forEach(target.locators, (locator) =>
            checkLocator({ answered, bindings, file, locator, manifest, models, reader, target })
          ).pipe(Effect.map(A.getSomes));
        })
      ).pipe(Effect.map(A.flatten));

      return ModelsCheckReport.make({
        catalog: snapshot.summary,
        diff,
        diffScope: options.offline ? "suppressed-offline" : "full",
        findings,
        hasDrift: A.isReadonlyArrayNonEmpty(findings),
      });
    },
    Effect.catchTags({
      ModelsCatalogError: (error: ModelsCatalogError) => Effect.fail(ModelsCommandError.fromInternal(error)),
      ModelsLedgerError: (error: ModelsLedgerError) => Effect.fail(ModelsCommandError.fromInternal(error)),
      ModelsLocatorError: (error: ModelsLocatorError) => Effect.fail(ModelsCommandError.fromInternal(error)),
      ModelsManifestError: (error: ModelsManifestError) => Effect.fail(ModelsCommandError.fromInternal(error)),
    })
  ),
});

/**
 * Live check orchestrator; every collaborator is supplied per call.
 *
 * **Example** (Confirm the layer)
 *
 * ```ts
 * import { ModelsCheckLive } from "@beep/repo-cli/commands/Models"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(ModelsCheckLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ModelsCheckLive: Layer.Layer<ModelsCheck> = Layer.succeed(ModelsCheck, ModelsCheck.of(makeCheck()));

/**
 * Every live `beep models` service, composed.
 *
 * **Example** (Confirm the composed layer)
 *
 * ```ts
 * import { ModelsLive } from "@beep/repo-cli/commands/Models"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(ModelsLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ModelsLive: Layer.Layer<
  ModelsCatalog | ModelsCatalogSources | ModelsCheck | ModelsLedger | ModelsLocatorReader | ModelsManifestStore,
  never,
  Crypto.Crypto | FileSystem.FileSystem | HttpClient.HttpClient | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> = Layer.mergeAll(
  ModelsCatalogLive,
  ModelsCatalogSourcesLive,
  ModelsCheckLive,
  ModelsLedgerLive,
  ModelsLocatorReaderLive,
  ModelsManifestStoreLive
);
