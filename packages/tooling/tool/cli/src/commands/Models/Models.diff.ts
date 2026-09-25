/**
 * Pure catalog merging and snapshot diffing for `beep models`.
 *
 * **Details**
 *
 * {@link mergeLayers} folds the upstream manifest and the four availability
 * overlays into one normalized model list; {@link diffSnapshots} reduces two
 * such lists to what an operator has to look at. Neither function performs
 * I/O, so both are exercised directly from fixtures.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, O, pipe, Struct } from "@beep/utils";
import * as Eq from "effect/Equal";
import { dual, flow } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import {
  CatalogAvailability,
  CatalogDiff,
  CatalogLevelsChange,
  CatalogModel,
  EffortLevel,
  ProviderSection,
} from "./Models.catalog.schemas.ts";
import type {
  CatalogSnapshot,
  CatalogSource,
  CodexModelsCache,
  CursorModelList,
  GrokModelsCache,
  ModelId,
  ProxyModelsResponse,
  UpstreamCatalog,
} from "./Models.catalog.schemas.ts";

const isEffortLevel = S.is(EffortLevel);
const isProviderSection = S.is(ProviderSection);

interface CatalogDraft {
  codexCli: boolean;
  codexLevels: ReadonlyArray<string>;
  cursor: boolean;
  grokCli: boolean;
  grokLevels: ReadonlyArray<string>;
  levels: ReadonlyArray<EffortLevel>;
  origin: CatalogSource;
  provider: O.Option<ProviderSection>;
  proxy: boolean;
  upstreamLevels: ReadonlyArray<string>;
}

type Drafts = MutableHashMap.MutableHashMap<string, CatalogDraft>;

const normalizeLevels: (levels: ReadonlyArray<string>) => ReadonlyArray<EffortLevel> = flow(
  A.filter(isEffortLevel),
  A.dedupe
);

const touch = (drafts: Drafts, id: string, origin: CatalogSource): CatalogDraft =>
  pipe(
    MutableHashMap.get(drafts, id),
    O.getOrElse((): CatalogDraft => {
      const draft: CatalogDraft = {
        provider: O.none(),
        origin,
        levels: [],
        upstreamLevels: [],
        codexLevels: [],
        grokLevels: [],
        proxy: false,
        codexCli: false,
        grokCli: false,
        cursor: false,
      };
      MutableHashMap.set(drafts, id, draft);
      return draft;
    })
  );

const mergeUpstream = (drafts: Drafts, upstream: UpstreamCatalog): void => {
  pipe(
    upstream,
    R.toEntries,
    A.forEach(([section, entries]) => {
      A.forEach(entries, (entry) => {
        const draft = touch(drafts, entry.id, "router-for-me");
        if (isProviderSection(section)) {
          draft.provider = O.some(section);
        }
        draft.upstreamLevels = pipe(
          entry.thinking,
          O.fromNullishOr,
          O.flatMap((thinking) => O.fromNullishOr(thinking.levels)),
          O.getOrElse(() => draft.upstreamLevels)
        );
        draft.levels = normalizeLevels(draft.upstreamLevels);
      });
    })
  );
};

const mergeCodex = (drafts: Drafts, cache: CodexModelsCache): void => {
  A.forEach(cache.models, (entry) => {
    const draft = touch(drafts, entry.slug, "codex-cache");
    // A `hide` slug exists in the cache but is not operator-selectable, so it
    // is a member of the catalog without being Codex availability.
    draft.codexCli = entry.visibility !== "hide";
    draft.codexLevels = pipe(
      O.fromNullishOr(entry.supported_reasoning_levels),
      O.map(A.map(Struct.get("effort"))),
      O.getOrElse((): ReadonlyArray<string> => [])
    );
    if (A.isReadonlyArrayEmpty(draft.levels)) {
      draft.levels = normalizeLevels(draft.codexLevels);
    }
  });
};

const mergeGrok = (drafts: Drafts, cache: GrokModelsCache): void => {
  pipe(
    cache.models,
    R.toEntries,
    A.forEach(([id, entry]) => {
      const draft = touch(drafts, id, "grok-cache");
      draft.grokCli = entry.info.hidden !== true;
      draft.grokLevels = pipe(
        O.fromNullishOr(entry.info.reasoning_efforts),
        O.map(A.map(Struct.get("value"))),
        O.getOrElse((): ReadonlyArray<string> => [])
      );
      if (A.isReadonlyArrayEmpty(draft.levels)) {
        draft.levels = normalizeLevels(draft.grokLevels);
      }
    })
  );
};

const mergeCursor = (drafts: Drafts, list: CursorModelList): void => {
  A.forEach(list, (id) => {
    touch(drafts, id, "cursor-agent").cursor = true;
  });
};

const mergeProxy = (drafts: Drafts, listing: ProxyModelsResponse): void => {
  A.forEach(listing.data, (entry) => {
    touch(drafts, entry.id, "proxy-v1-models").proxy = true;
  });
};

/**
 * Fold the catalog layers into one normalized, id-sorted model list.
 *
 * **Details**
 *
 * Layers are applied in the order upstream, Codex cache, Grok cache, Cursor
 * list, proxy listing, and the first layer that reports an id becomes that
 * model's `origin`. An overlay-only id — every Cursor seat, a cache-only Codex
 * slug — is a full catalog member with `provider: None`.
 *
 * **Example** (Merge an upstream-only catalog)
 *
 * ```ts
 * import { mergeLayers } from "@beep/repo-cli/commands/Models"
 * import * as O from "effect/Option"
 *
 * const models = mergeLayers({
 *   upstream: O.some({ xai: [{ id: "grok-4.6" }] }),
 *   codex: O.none(),
 *   grok: O.none(),
 *   cursor: O.none(),
 *   proxy: O.none()
 * })
 * console.log(models.length) // 1
 * console.log(models[0]?.origin) // "router-for-me"
 * ```
 *
 * @param layers - The five raw layers, each `None` when its source did not answer.
 * @returns The merged models, ordered by id.
 * @category mapping
 * @since 0.0.0
 */
export const mergeLayers = (layers: {
  readonly upstream: O.Option<UpstreamCatalog>;
  readonly codex: O.Option<CodexModelsCache>;
  readonly grok: O.Option<GrokModelsCache>;
  readonly cursor: O.Option<CursorModelList>;
  readonly proxy: O.Option<ProxyModelsResponse>;
}): ReadonlyArray<CatalogModel> => {
  const drafts: Drafts = MutableHashMap.empty<string, CatalogDraft>();

  O.map(layers.upstream, (upstream) => mergeUpstream(drafts, upstream));
  O.map(layers.codex, (codex) => mergeCodex(drafts, codex));
  O.map(layers.grok, (grok) => mergeGrok(drafts, grok));
  O.map(layers.cursor, (cursor) => mergeCursor(drafts, cursor));
  O.map(layers.proxy, (proxy) => mergeProxy(drafts, proxy));

  return pipe(
    A.fromIterable(drafts),
    A.map(([id, draft]) =>
      CatalogModel.make({
        id: id as ModelId,
        provider: draft.provider,
        origin: draft.origin,
        levels: draft.levels,
        upstreamLevels: draft.upstreamLevels,
        codexLevels: draft.codexLevels,
        grokLevels: draft.grokLevels,
        availability: CatalogAvailability.make({
          proxy: draft.proxy,
          codexCli: draft.codexCli,
          grokCli: draft.grokCli,
          cursor: draft.cursor,
        }),
      })
    ),
    A.sortWith((model: CatalogModel) => model.id, Order.String)
  );
};

/**
 * Index a snapshot's models by id for constant-time lookups.
 *
 * **Example** (Look one model up)
 *
 * ```ts
 * import { catalogModelsById } from "@beep/repo-cli/commands/Models"
 * import * as HashMap from "effect/HashMap"
 *
 * console.log(HashMap.size(catalogModelsById([]))) // 0
 * ```
 *
 * @param models - The snapshot's model list.
 * @returns A hash map from model id to catalog model.
 * @category getters
 * @since 0.0.0
 */
export const catalogModelsById = (models: ReadonlyArray<CatalogModel>): HashMap.HashMap<ModelId, CatalogModel> =>
  HashMap.fromIterable(A.map(models, (model) => [model.id, model] as const));

/**
 * What changed between the previous snapshot and the current one.
 *
 * **Details**
 *
 * The upstream catalog hard-deletes retired ids, so a removal here is the only
 * retirement signal there is; `check` turns a removed id that still backs a
 * binding into an `unknown-model` finding rather than editing anything.
 *
 * **Example** (Diff a snapshot against nothing)
 *
 * ```ts
 * import { CatalogSnapshot, CatalogSnapshotSummary, diffSnapshots } from "@beep/repo-cli/commands/Models"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const snapshot = CatalogSnapshot.make({
 *   summary: CatalogSnapshotSummary.make({
 *     fetchedAt: DateTime.makeUnsafe("2026-09-22T00:00:00Z"),
 *     contentSha256: "0".repeat(64),
 *     sources: ["router-for-me"],
 *     modelCount: 0
 *   }),
 *   models: []
 * })
 * console.log(diffSnapshots(O.none(), snapshot).added.length) // 0
 * ```
 *
 * @param previous - The last recorded snapshot, or `None` on a first run.
 * @param next - The snapshot just assembled.
 * @returns Added, removed, and levels-changed models.
 * @category mapping
 * @since 0.0.0
 */
export const diffSnapshots: {
  (previous: O.Option<CatalogSnapshot>, next: CatalogSnapshot): CatalogDiff;
  (next: CatalogSnapshot): (previous: O.Option<CatalogSnapshot>) => CatalogDiff;
} = dual(2, (previous: O.Option<CatalogSnapshot>, next: CatalogSnapshot): CatalogDiff => {
  const before = catalogModelsById(
    pipe(
      previous,
      O.map(Struct.get("models")),
      O.getOrElse((): ReadonlyArray<CatalogModel> => [])
    )
  );
  const after = catalogModelsById(next.models);

  return CatalogDiff.make({
    added: pipe(
      A.fromIterable(HashMap.keys(after)),
      A.filter((id) => !HashMap.has(before, id)),
      A.sort(Order.String)
    ),
    removed: pipe(
      A.fromIterable(HashMap.keys(before)),
      A.filter((id) => !HashMap.has(after, id)),
      A.sort(Order.String)
    ),
    levelsChanged: pipe(
      A.fromIterable(HashMap.entries(before)),
      A.map(([id, previousModel]) =>
        pipe(
          HashMap.get(after, id),
          O.filter(
            (nextModel) =>
              !Eq.equals(previousModel.levels, nextModel.levels) ||
              !Eq.equals(previousModel.upstreamLevels, nextModel.upstreamLevels) ||
              !Eq.equals(previousModel.codexLevels, nextModel.codexLevels) ||
              !Eq.equals(previousModel.grokLevels, nextModel.grokLevels)
          ),
          O.map((nextModel) =>
            CatalogLevelsChange.make({
              id,
              before: previousModel.levels,
              after: nextModel.levels,
              upstreamBefore: previousModel.upstreamLevels,
              upstreamAfter: nextModel.upstreamLevels,
              codexBefore: previousModel.codexLevels,
              codexAfter: nextModel.codexLevels,
              grokBefore: previousModel.grokLevels,
              grokAfter: nextModel.grokLevels,
            })
          )
        )
      ),
      A.getSomes,
      A.sortWith((change: CatalogLevelsChange) => change.id, Order.String)
    ),
  });
});
