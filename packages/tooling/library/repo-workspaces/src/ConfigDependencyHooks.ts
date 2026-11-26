/**
 * The opt-in pnpmfile `configDependencies` hook-replay seam.
 *
 * **Details**
 *
 * pnpm's config dependencies (declared under `configDependencies:` in
 * `pnpm-workspace.yaml`) install to `node_modules/.pnpm-config/<name>` and may
 * ship a `pnpmfile.cjs` whose `updateConfig` hook mutates the resolved config —
 * catalogs included. This service replays those hooks over an inline-catalog
 * seed so hook-injected catalogs land in assembly.
 *
 * This executes arbitrary code loaded from a config dependency, so it is **never**
 * wired by the default `WorkspaceCatalogs.layer`. Every replaying layer is
 * opt-in and runtime-coupled, the same shape as the other Node-only overlays in
 * this package. `layerLive` and `layerFrom` load each pnpmfile in process
 * through a dynamic `import()`. `layerSubprocess` replays the same hooks in a
 * `node` child process (`node --input-type=module -e`), which keeps computed
 * imports out of a bundled consumer and config-dependency code out of the
 * caller's process. `layerNoop` returns the seed untouched and is the safe
 * default for tests and consumers who want the topology without the execution.
 *
 * Every replaying layer loads the pnpmfile of the version each entry DECLARES,
 * not whatever `node_modules/.pnpm-config` holds right now: the resolution
 * ladder in `internal/configDependencyResolution.ts` checks the installed copy
 * first and falls back to the pnpm store, which keeps every version ever
 * installed. That is what lets `WorkspaceSnapshots.at(ref)` replay a past
 * ref's hooks at that ref's pinned version. `layerSubprocess` adds one more
 * rung, a verified fetch into the store (`internal/configDependencyFetch.ts`),
 * for the version this checkout never installed — the base side of a diff
 * across a config-dependency bump.
 *
 * `internal/catalogs.ts` stays the only `@pnpm/catalogs.*` importer: the shape
 * hooks operate on is the plain `catalog name → dependency → range` record, and
 * the only normalization borrowed here is the prototype-safe `normalize`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Run } from "@beep/commands";
import { $RepoWorkspacesId } from "@beep/identity/packages";
import { CatalogAssemblyError } from "@beep/npm-spec/CatalogAssemblyError";
import { PartialReleaseAgeGate } from "@beep/npm-spec/ReleaseAgeGate";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { HookReplay } from "./ConfigDependencyReplay.ts";
import { normalize } from "./internal/catalogs.ts";
import { makeFetchConfigDependency } from "./internal/configDependencyFetch.ts";
import { lookupPnpmfiles, resolvePnpmfiles } from "./internal/configDependencyResolution.ts";
import { isPlainObject, JsonObject } from "./PackageManagerName.ts";
import type * as FileSystem from "effect/FileSystem";
import type { HookReplayContext } from "./ConfigDependencyReplay.ts";
import type { CatalogEntries } from "./internal/catalogs.ts";
import type { ResolvedPnpmfile } from "./internal/configDependencyResolution.ts";

const $I = $RepoWorkspacesId.create("ConfigDependencyHooks");

class ConfigDependencyReplayError extends S.TaggedError<ConfigDependencyReplayError, { readonly brand: unique symbol }>(
  $I`ConfigDependencyReplayError`
)(
  "ConfigDependencyReplayError",
  { message: S.String },
  $I.annoteError<ConfigDependencyReplayError>("ConfigDependencyReplayError", {
    description: "A replay failure reconstructed from the subprocess protocol.",
  })
) {}

const JsonValue = S.fromJsonString(S.Unknown);

/**
 * pnpm's `peerDependencyRules` block — the suppression policy pnpm applies
 * **after** computing peer violations, in pnpm's own shape.
 *
 * **Details**
 *
 * The shape is pnpm's own, because that is what comes back off the threaded
 * config: a replayed hook returns `{ allowedVersions, ignoreMissing, allowAny }`
 * intact, needing no reshaping.
 *
 * All three axes are consumed by `PeerCheck`, matching `pnpm peers check`.
 * `ignoreMissing` and `allowAny` are lists of **peer-name patterns** in pnpm's `@pnpm/matcher`
 * grammar (`*` wildcard, leading `!` negation) — not `parent>peer` keys, which
 * match nothing on those two axes. `ignoreMissing` hides only a required peer
 * that resolved to nothing; `allowAny` hides only a peer that resolved outside
 * its wanted range; the two never cross.
 *
 * `allowedVersions` keys come in two spellings in the wild, and both must be
 * handled: parent-versioned (`"@effect/ai-anthropic@4.0.0>effect"`, as
 * `pnpm:export` materializes them into `pnpm-workspace.yaml`) and unversioned
 * (`"@effect/vitest>vitest"`, as a config-dependency plugin injects them).
 *
 * **Example** (Construct independent peer suppression axes)
 *
 * ```ts
 * import { PeerDependencyRules } from "@beep/repo-workspaces/ConfigDependencyHooks";
 *
 * const rules = PeerDependencyRules.make({ allowedVersions: {}, ignoreMissing: ["react"], allowAny: [] });
 * console.log(rules.ignoreMissing.join(",")) // react
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class PeerDependencyRules extends S.Opaque<PeerDependencyRules, { readonly brand: unique symbol }>()(
  S.Struct({
    /** `parent>peer` → the peer version or range the rule permits. */
    allowedVersions: S.Record(S.String, S.String).pipe(
      $I.annoteKey("PeerDependencyRules.allowedVersions", {
        description: "Parent and peer selectors mapped to allowed peer ranges.",
      })
    ),
    /** Peer-name patterns whose absence pnpm does not report (a required peer that resolved to nothing). */
    ignoreMissing: S.Array(S.String).pipe(
      $I.annoteKey("PeerDependencyRules.ignoreMissing", {
        description: "Peer-name patterns whose missing required peer is ignored.",
      })
    ),
    /** Peer-name patterns for which any resolved version is accepted. */
    allowAny: S.Array(S.String).pipe(
      $I.annoteKey("PeerDependencyRules.allowAny", {
        description: "Peer-name patterns accepting any resolved version.",
      })
    ),
  }).pipe(
    $I.annoteSchema("PeerDependencyRules", {
      description: "The three independent pnpm peer-suppression axes threaded through replayed hooks.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PeerDependencyRules {
  /**
   * The plain, unbranded encoded shape of a {@link PeerDependencyRules}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof PeerDependencyRules.Encoded;
}

const HookConfig = S.Struct({
  catalog: S.mutableKey(JsonObject).pipe(
    $I.annoteKey("HookConfig.catalog", { description: "The default catalog slice exposed to hooks." })
  ),
  catalogs: S.mutableKey(JsonObject).pipe(
    $I.annoteKey("HookConfig.catalogs", { description: "The named catalog slices exposed to hooks." })
  ),
  minimumReleaseAge: S.Finite.pipe(
    S.UndefinedOr,
    S.mutableKey,
    $I.annoteKey("HookConfig.minimumReleaseAge", {
      description: "A finite age in minutes, undefined until a hook sets it.",
    })
  ),
  minimumReleaseAgeExclude: S.String.pipe(
    S.Array,
    S.UndefinedOr,
    S.mutableKey,
    $I.annoteKey("HookConfig.minimumReleaseAgeExclude", {
      description: "Exempt name patterns, undefined until a hook sets them.",
    })
  ),
  peerDependencyRules: PeerDependencyRules.pipe(
    S.UndefinedOr,
    S.mutableKey,
    $I.annoteKey("HookConfig.peerDependencyRules", {
      description: "Workspace rules threaded through hook contributions.",
    })
  ),
}).pipe(
  $I.annoteSchema("HookConfig", {
    description: "The plain mutable pnpm updateConfig surface, tolerantly threaded one valid field at a time.",
  })
);

type HookConfig = typeof HookConfig.Type;

/**
 * The empty {@link PeerDependencyRules}: every axis present and empty.
 *
 * **Details**
 *
 * Exported so that "I assert this workspace's rules are empty" is **one token**
 * rather than three hand-written empty axes. That matters where the distinction
 * is load-bearing — supplying rules asserts they were looked up, while omitting
 * them asserts nothing — and a caller spelling the object out by hand will
 * eventually fill two of the three axes and mean the third.
 *
 * Readonly through the schema-derived type, since it is shared.
 *
 * **Example** (Inspect an explicitly empty suppression policy)
 *
 * ```ts
 * import { NoPeerDependencyRules } from "@beep/repo-workspaces/ConfigDependencyHooks";
 *
 * console.log(NoPeerDependencyRules.ignoreMissing.length) // 0
 * console.log(NoPeerDependencyRules.allowAny.length) // 0
 * ```
 *
 * @public
 * @category constants
 * @since 0.0.0
 */
export const NoPeerDependencyRules: PeerDependencyRules = PeerDependencyRules.make({
  allowedVersions: R.fromEntries([]),
  ignoreMissing: [],
  allowAny: [],
});

const NO_PEER_RULES: PeerDependencyRules = NoPeerDependencyRules;

/**
 * The result of replaying a workspace's `configDependencies` hooks: the catalogs
 * the hooks yield, and the release-age gate contribution they leave on the
 * config (pnpm's `minimumReleaseAge` / `minimumReleaseAgeExclude`).
 *
 * **Details**
 *
 * `releaseAge` is a `PartialReleaseAgeGate` — the age, the exclude list,
 * both, or neither, depending on what the replayed hooks set. It is deliberately
 * a *partial* contribution: a consumer folds it into an effective gate with
 * `ReleaseAgeGate.combine` alongside inline `pnpm-workspace.yaml` values. Hooks
 * that set no release-age keys contribute an empty gate (`{}`).
 *
 * **Example** (Construct an empty replay result)
 *
 * ```ts
 * import { HookInjection, NoPeerDependencyRules } from "@beep/repo-workspaces/ConfigDependencyHooks";
 *
 * const injection = HookInjection.make({ catalogs: {}, releaseAge: {}, peerDependencyRules: NoPeerDependencyRules, replays: {} });
 * console.log(injection.peerDependencyRules.ignoreMissing.length) // 0
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class HookInjection extends S.Opaque<HookInjection, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The catalogs the replayed hooks yield, as `catalog name → dependency → range`. */
    catalogs: S.Record(S.String, S.Record(S.String, S.String)).pipe(
      $I.annoteKey("HookInjection.catalogs", {
        description: "Catalog names mapped to dependency ranges after hook replay.",
      })
    ),
    /** The release-age gate contribution the replayed hooks leave on the config. */
    releaseAge: PartialReleaseAgeGate.pipe(
      $I.annoteKey("HookInjection.releaseAge", {
        description: "The partial release-age contribution left by the hooks.",
      })
    ),
    /**
     * The **effective** peer-dependency rules: the seeded workspace-file rules
     * with every replayed hook's contribution threaded over them.
     *
     * **Details**
     *
     * Effective rather than hook-only because the rules are **seeded** into the
     * threaded config and the hooks merge onto them, exactly as pnpm seeds its
     * own config and takes back what the hooks return, so there is no second
     * merge implementation to drift from pnpm's threading.
     *
     * A plugin whose hook *overwrites* the seeded rules rather than merging
     * onto them replaces them here exactly as it does under pnpm.
     */
    peerDependencyRules: PeerDependencyRules,
    /**
     * Which version each declared config dependency was replayed from, keyed
     * by name — every dependency the layer resolved, including one that ships
     * no pnpmfile (resolved, contributed nothing). `{}` under
     * {@link ConfigDependencyHooks.layerNoop}, which resolves nothing.
     */
    replays: S.Record(S.String, HookReplay).pipe(
      $I.annoteKey("HookInjection.replays", {
        description: "Version and source of every resolved config dependency, including those without hooks.",
      })
    ),
  }).pipe(
    $I.annoteSchema("HookInjection", {
      description:
        "Plain replay results containing normalized catalogs, release-age contribution, effective peer rules and per-dependency provenance.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace HookInjection {
  /**
   * The plain, unbranded encoded shape of a {@link HookInjection}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof HookInjection.Encoded;
}

/**
 * The {@link ConfigDependencyHooks} service shape.
 *
 * **Details**
 *
 * `inject` is given the workspace root, the manifest's `configDependencies`
 * (name → version+integrity), and the inline-catalog seed as a plain
 * `catalog name → dependency name → range` record, and produces a
 * {@link HookInjection}: the catalogs the replayed hooks yield **and** the
 * release-age gate contribution they leave on the config. The default (no-op)
 * implementation returns the seed catalogs unchanged, contributes an empty
 * release-age gate, and loads nothing.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface ConfigDependencyHooksShape {
  /**
   * Replay each config dependency's `updateConfig` hook over `seed`, in
   * declaration order, and return both the resulting catalogs and the
   * release-age gate contribution the hooks leave behind.
   *
   * **Details**
   *
   * The hooks are replayed once over a single threaded config object, exactly
   * as pnpm does — so catalogs and the release-age keys
   * (`minimumReleaseAge` / `minimumReleaseAgeExclude`) are both read off that
   * one final object, and the config-dependency code executes only once. When
   * two hooks both set a release-age key the **later hook wins** (it rewrites
   * the threaded value); a hook that returns a malformed value for a key leaves
   * the prior threaded value in place (tolerant threading, matching the catalog
   * slice). A hook failing to load or replay fails typed with a
   * `hooks`-source `CatalogAssemblyError`, never a silent skip.
   *
   * @param root - The workspace root; config dependencies resolve under
   *   `<root>/node_modules/.pnpm-config/<name>` when that holds the declared
   *   version, else through the pnpm store.
   * @param configDependencies - The `configDependencies` map (name →
   *   `<version>+<integrity>`, or a bare `<version>`) declared in the
   *   `pnpm-workspace.yaml` being read — the live one, or the one at a ref.
   *   The replaying layers load the pnpmfile of the DECLARED version.
   * @param seed - The inline catalogs, as `catalog name → dependency → range`.
   * @param rules - The workspace file's `peerDependencyRules`, seeded into the
   *   threaded config so hooks merge onto them rather than replacing them.
   *   Omitted means "the workspace file declares none", which is different
   *   from "nobody looked" — the caller owns that distinction.
   * @param context - What the declaring side recorded beyond the map: its
   *   lockfile, which verifies a fetched version, and its ref, which names it
   *   in errors. Only {@link ConfigDependencyHooks.layerSubprocess} reads the
   *   lockfile; omitting the context never changes which version is replayed.
   */
  readonly inject: {
    (
      root: string,
      configDependencies: Readonly<Record<string, string>>,
      seed: Readonly<Record<string, Readonly<Record<string, string>>>>,
      rules?: PeerDependencyRules.Encoded,
      context?: HookReplayContext.Encoded
    ): Effect.Effect<HookInjection, CatalogAssemblyError>;
    (
      configDependencies: Readonly<Record<string, string>>,
      seed: Readonly<Record<string, Readonly<Record<string, string>>>>,
      rules?: PeerDependencyRules.Encoded,
      context?: HookReplayContext.Encoded
    ): (root: string) => Effect.Effect<HookInjection, CatalogAssemblyError>;
  };
}

/**
 * One `inject` call that has config dependencies to replay.
 *
 * @internal
 */
interface ReplayRequest {
  readonly configDependencies: Readonly<Record<string, string>>;
  readonly context: HookReplayContext.Encoded | undefined;
  readonly root: string;
  readonly rules: PeerDependencyRules.Encoded | undefined;
  readonly seed: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

/**
 * The `inject` of a replaying layer.
 *
 * **Details**
 *
 * An empty `configDependencies` returns the seed untouched, rules included,
 * without resolving or replaying anything; any other call runs `replay` over
 * the services the layer captured.
 *
 * @param services - The services the layer captured.
 * @param replay - What the layer does with a non-empty request.
 * @returns The service's `inject`.
 * @internal
 */
const replayingInject = <Services>(
  services: Context.Context<Services>,
  replay: (request: ReplayRequest) => Effect.Effect<HookInjection, CatalogAssemblyError, Services>
): ConfigDependencyHooksShape["inject"] =>
  dual(
    (args) => P.isString(args[0]),
    Effect.fn("ConfigDependencyHooks.inject")(
      (
        root: string,
        configDependencies: Readonly<Record<string, string>>,
        seed: Readonly<Record<string, Readonly<Record<string, string>>>>,
        rules?: PeerDependencyRules.Encoded,
        context?: HookReplayContext.Encoded
      ): Effect.Effect<HookInjection, CatalogAssemblyError, Services> =>
        R.keys(configDependencies).length === 0
          ? Effect.succeed(untouched(seed, rules))
          : replay({ root, configDependencies, seed, rules, context }),
      Effect.provide(services)
    )
  );

const seedToConfig: {
  (
    seed: Readonly<Record<string, Readonly<Record<string, string>>>>,
    rules: PeerDependencyRules.Encoded | undefined
  ): HookConfig;
  (
    rules: PeerDependencyRules.Encoded | undefined
  ): (seed: Readonly<Record<string, Readonly<Record<string, string>>>>) => HookConfig;
} = dual(
  2,
  (
    seed: Readonly<Record<string, Readonly<Record<string, string>>>>,
    rules: PeerDependencyRules.Encoded | undefined
  ): HookConfig => {
    const catalog = O.match(R.get(seed, "default"), {
      onNone: () => R.fromEntries([]),
      onSome: (entries) => R.fromEntries(R.toEntries(entries)),
    });
    const catalogs = R.fromEntries(
      pipe(
        R.toEntries(seed),
        A.filter(([name]) => name !== "default"),
        A.map(([name, entries]) => [name, R.fromEntries(R.toEntries(entries))] as const)
      )
    );
    return {
      catalog,
      catalogs,
      minimumReleaseAge: undefined,
      minimumReleaseAgeExclude: undefined,
      peerDependencyRules: rules === undefined ? undefined : PeerDependencyRules.make(rules),
    };
  }
);

const isFiniteNumber = S.is(S.Finite);
const isHookObject = S.is(HookConfig.fields.catalog);

const finiteNumberOr: {
  (value: unknown, fallback: number | undefined): number | undefined;
  (fallback: number | undefined): (value: unknown) => number | undefined;
} = dual(2, (value: unknown, fallback: number | undefined): number | undefined =>
  isFiniteNumber(value) ? value : fallback
);

const stringArrayOr: {
  (value: unknown, fallback: readonly string[] | undefined): readonly string[] | undefined;
  (fallback: readonly string[] | undefined): (value: unknown) => readonly string[] | undefined;
} = dual(2, (value: unknown, fallback: readonly string[] | undefined): readonly string[] | undefined =>
  A.isArray(value) && A.every(value, P.isString) ? value : fallback
);

const configOf: {
  (value: unknown, fallback: HookConfig): HookConfig;
  (fallback: HookConfig): (value: unknown) => HookConfig;
} = dual(2, (value: unknown, fallback: HookConfig): HookConfig => {
  if (!isPlainObject(value)) return fallback;
  return {
    catalog: isHookObject(value.catalog) ? value.catalog : fallback.catalog,
    catalogs: isHookObject(value.catalogs) ? value.catalogs : fallback.catalogs,
    minimumReleaseAge: finiteNumberOr(value.minimumReleaseAge, fallback.minimumReleaseAge),
    minimumReleaseAgeExclude: stringArrayOr(value.minimumReleaseAgeExclude, fallback.minimumReleaseAgeExclude),
    peerDependencyRules: peerRulesOr(value.peerDependencyRules, fallback.peerDependencyRules),
  };
});

const stringRecordOr: {
  (
    value: unknown,
    fallback: Readonly<Record<string, string>> | undefined
  ): Readonly<Record<string, string>> | undefined;
  (
    fallback: Readonly<Record<string, string>> | undefined
  ): (value: unknown) => Readonly<Record<string, string>> | undefined;
} = dual(
  2,
  (
    value: unknown,
    fallback: Readonly<Record<string, string>> | undefined
  ): Readonly<Record<string, string>> | undefined => (isStringRecord(value) ? value : fallback)
);

const isStringRecord = S.is(PeerDependencyRules.fields.allowedVersions);

const peerRulesOr: {
  (value: unknown, fallback: PeerDependencyRules | undefined): PeerDependencyRules | undefined;
  (fallback: PeerDependencyRules | undefined): (value: unknown) => PeerDependencyRules | undefined;
} = dual(2, (value: unknown, fallback: PeerDependencyRules | undefined): PeerDependencyRules | undefined =>
  isPlainObject(value) ? threadedPeerRules(value, fallback) : fallback
);

const threadedPeerRules = (
  value: { readonly [key: string]: unknown },
  fallback: PeerDependencyRules | undefined
): PeerDependencyRules | undefined => {
  const allowed = stringRecordOr(value.allowedVersions, fallback?.allowedVersions);
  const ignoreMissing = stringArrayOr(value.ignoreMissing, fallback?.ignoreMissing);
  const allowAny = stringArrayOr(value.allowAny, fallback?.allowAny);
  if (allowed === undefined && ignoreMissing === undefined && allowAny === undefined) return fallback;
  return rulesWithEmptyAxes(allowed, ignoreMissing, allowAny);
};

const rulesWithEmptyAxes = (
  allowed: Readonly<Record<string, string>> | undefined,
  ignoreMissing: ReadonlyArray<string> | undefined,
  allowAny: ReadonlyArray<string> | undefined
): PeerDependencyRules =>
  PeerDependencyRules.make({
    allowedVersions: allowed ?? R.fromEntries([]),
    ignoreMissing: ignoreMissing ?? [],
    allowAny: allowAny ?? [],
  });

const peerRulesOf = (config: HookConfig): PeerDependencyRules => config.peerDependencyRules ?? NO_PEER_RULES;

const releaseAgeOf = (config: HookConfig): PartialReleaseAgeGate =>
  PartialReleaseAgeGate.make({
    ...O.getSomesStruct({ ageMinutes: O.fromUndefinedOr(config.minimumReleaseAge) }),
    ...O.getSomesStruct({ exclude: O.fromUndefinedOr(config.minimumReleaseAgeExclude) }),
  });

const configToEntries = (config: HookConfig): CatalogEntries => {
  const raw = R.fromEntries(R.toEntries(config.catalogs));
  if (R.keys(config.catalog).length === 0) return normalize(raw);
  const priorDefault = O.getOrElse(O.filter(R.get(raw, "default"), isPlainObject), () => R.fromEntries([]));
  return normalize(
    R.fromEntries([
      ...R.toEntries(raw),
      ["default", R.fromEntries([...R.toEntries(priorDefault), ...R.toEntries(config.catalog)])],
    ])
  );
};

type UpdateConfig = (config: HookConfig) => unknown;

const updateConfigOf = (mod: Readonly<Record<string, unknown>>): UpdateConfig | undefined => {
  for (const candidate of [mod, mod.default]) {
    if (!P.isObject(candidate)) continue;
    const hooks = candidate.hooks;
    if (P.isObject(hooks) && P.isFunction(hooks.updateConfig)) {
      const updateConfig = hooks.updateConfig;
      return (config) => updateConfig(config);
    }
    if (P.isFunction(candidate.updateConfig)) {
      const updateConfig = candidate.updateConfig;
      return (config) => updateConfig(config);
    }
  }
  return undefined;
};

const leadsWithSeedNeverRulesBlock = (args: IArguments): boolean =>
  isPlainObject(args[0]) && !S.is(PeerDependencyRules)(args[0]);

const untouched: {
  (
    seed: Readonly<Record<string, Readonly<Record<string, string>>>>,
    rules: PeerDependencyRules.Encoded | undefined,
    replays?: Readonly<Record<string, HookReplay>>
  ): HookInjection;
  (
    rules: PeerDependencyRules.Encoded | undefined,
    replays?: Readonly<Record<string, HookReplay>>
  ): (seed: Readonly<Record<string, Readonly<Record<string, string>>>>) => HookInjection;
} = dual(
  leadsWithSeedNeverRulesBlock,
  (
    seed: Readonly<Record<string, Readonly<Record<string, string>>>>,
    rules: PeerDependencyRules.Encoded | undefined,
    replays: Readonly<Record<string, HookReplay>> = {}
  ): HookInjection =>
    HookInjection.make({ catalogs: seed, releaseAge: {}, peerDependencyRules: rules ?? NO_PEER_RULES, replays })
);

const replaysOf = (pnpmfiles: ReadonlyArray<ResolvedPnpmfile>): Readonly<Record<string, HookReplay>> =>
  R.fromEntries(A.map(pnpmfiles, ({ name, version, source }) => [name, HookReplay.make({ version, source })] as const));

const injectionOf: {
  (config: HookConfig, pnpmfiles: ReadonlyArray<ResolvedPnpmfile>): HookInjection;
  (pnpmfiles: ReadonlyArray<ResolvedPnpmfile>): (config: HookConfig) => HookInjection;
} = dual(
  2,
  (config: HookConfig, pnpmfiles: ReadonlyArray<ResolvedPnpmfile>): HookInjection =>
    HookInjection.make({
      catalogs: configToEntries(config),
      releaseAge: releaseAgeOf(config),
      peerDependencyRules: peerRulesOf(config),
      replays: replaysOf(pnpmfiles),
    })
);

const fileUrlOf: {
  (name: string, path: string): Effect.Effect<string, CatalogAssemblyError, Path.Path>;
  (path: string): (name: string) => Effect.Effect<string, CatalogAssemblyError, Path.Path>;
} = dual(
  2,
  Effect.fnUntraced(function* (name: string, path: string): Effect.fn.Return<string, CatalogAssemblyError, Path.Path> {
    const paths = yield* Path.Path;
    const url = yield* paths
      .toFileUrl(path)
      .pipe(Effect.mapError((cause) => CatalogAssemblyError.make({ source: "hooks", path: name, cause })));
    return url.href;
  })
);

const importRuntimePathUnbundled = (url: string): Promise<Readonly<Record<string, unknown>>> =>
  import(/* webpackIgnore: true */ url);

const replayInProcess: {
  (
    pnpmfiles: ReadonlyArray<ResolvedPnpmfile>,
    seed: Readonly<Record<string, Readonly<Record<string, string>>>>,
    rules: PeerDependencyRules.Encoded | undefined
  ): Effect.Effect<HookInjection, CatalogAssemblyError, Path.Path>;
  (
    seed: Readonly<Record<string, Readonly<Record<string, string>>>>,
    rules: PeerDependencyRules.Encoded | undefined
  ): (pnpmfiles: ReadonlyArray<ResolvedPnpmfile>) => Effect.Effect<HookInjection, CatalogAssemblyError, Path.Path>;
} = dual(
  3,
  Effect.fn("ConfigDependencyHooks.replayInProcess")(function* (
    pnpmfiles: ReadonlyArray<ResolvedPnpmfile>,
    seed: Readonly<Record<string, Readonly<Record<string, string>>>>,
    rules: PeerDependencyRules.Encoded | undefined
  ): Effect.fn.Return<HookInjection, CatalogAssemblyError, Path.Path> {
    let config = seedToConfig(seed, rules);
    for (const { name, path } of pnpmfiles) {
      if (path === undefined) continue;
      const url = yield* fileUrlOf(name, path);
      const loaded = yield* Effect.tryPromise({
        try: () => importRuntimePathUnbundled(url),
        catch: (cause) => CatalogAssemblyError.make({ source: "hooks", path: name, cause }),
      });
      const updateConfig = updateConfigOf(loaded);
      if (updateConfig === undefined) continue;
      const currentConfig = config;
      config = yield* Effect.try({
        try: () => configOf(updateConfig(currentConfig), currentConfig),
        catch: (cause) => CatalogAssemblyError.make({ source: "hooks", path: name, cause }),
      });
    }
    return injectionOf(config, pnpmfiles);
  })
);

/**
 * The positional argument the subprocess replay passes before its three
 * payloads.
 *
 * @internal
 */
const BUN_SHIM_SCRIPT_NAME_SLOT = "beep-replay";

const REPLAY_SCRIPT = `
const [seedJson, rulesJson, entriesJson] = process.argv.slice(-3);
const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const finiteNumberOr = (value, fallback) => (typeof value === "number" && Number.isFinite(value) ? value : fallback);
const stringArrayOr = (value, fallback) =>
	Array.isArray(value) && value.every((entry) => typeof entry === "string") ? value : fallback;
const stringRecordOr = (value, fallback) =>
	isObject(value) && Object.values(value).every((entry) => typeof entry === "string") ? value : fallback;
const peerRulesOr = (value, fallback) => {
	if (!isObject(value)) return fallback;
	const allowed = stringRecordOr(value.allowedVersions, fallback && fallback.allowedVersions);
	const ignoreMissing = stringArrayOr(value.ignoreMissing, fallback && fallback.ignoreMissing);
	const allowAny = stringArrayOr(value.allowAny, fallback && fallback.allowAny);
	if (allowed === undefined && ignoreMissing === undefined && allowAny === undefined) return fallback;
	return { allowedVersions: allowed || {}, ignoreMissing: ignoreMissing || [], allowAny: allowAny || [] };
};
const configOf = (value, fallback) =>
	isObject(value)
		? {
				catalog: isObject(value.catalog) ? value.catalog : fallback.catalog,
				catalogs: isObject(value.catalogs) ? value.catalogs : fallback.catalogs,
				minimumReleaseAge: finiteNumberOr(value.minimumReleaseAge, fallback.minimumReleaseAge),
				minimumReleaseAgeExclude: stringArrayOr(value.minimumReleaseAgeExclude, fallback.minimumReleaseAgeExclude),
				peerDependencyRules: peerRulesOr(value.peerDependencyRules, fallback.peerDependencyRules),
			}
		: fallback;
const failure = (name, cause) => ({
	ok: false,
	name,
	message: cause instanceof Error ? cause.message : String(cause),
	...(cause instanceof Error && typeof cause.stack === "string" ? { stack: cause.stack } : {}),
});
const replay = async () => {
	let catalog = {};
	const catalogEntries = [];
	for (const [name, entries] of Object.entries(JSON.parse(seedJson))) {
		if (name === "default") catalog = { ...entries };
		else catalogEntries.push([name, { ...entries }]);
	}
	const catalogs = Object.fromEntries(catalogEntries);
	let config = {
		catalog,
		catalogs,
		minimumReleaseAge: undefined,
		minimumReleaseAgeExclude: undefined,
		peerDependencyRules: JSON.parse(rulesJson),
	};
	for (const [name, url] of JSON.parse(entriesJson)) {
		let loaded;
		try {
			loaded = await import(url);
		} catch (cause) {
			return failure(name, cause);
		}
		let hook;
		for (const candidate of [loaded, isObject(loaded) ? loaded.default : undefined]) {
			if (!isObject(candidate)) continue;
			if (isObject(candidate.hooks) && typeof candidate.hooks.updateConfig === "function") {
				hook = candidate.hooks.updateConfig;
				break;
			}
			if (typeof candidate.updateConfig === "function") {
				hook = candidate.updateConfig;
				break;
			}
		}
		if (hook === undefined) continue;
		try {
			config = configOf(hook(config), config);
		} catch (cause) {
			return failure(name, cause);
		}
	}
	return { ok: true, config };
};
const payload = await replay();
process.stdout.write("\\n" + JSON.stringify(payload) + "\\n", () => process.exit(0));
`;

const REPLAY_TIMEOUT = Duration.seconds(30);

const ReplayPayload = S.Union([
  S.Struct({
    ok: S.tag(true).pipe(
      $I.annoteKey("ReplayPayload.ok", { description: "The child completed hook replay successfully." })
    ),
    config: S.Unknown.pipe(
      $I.annoteKey("ReplayPayload.config", {
        description: "Hook-returned config data, normalized tolerantly by the parent.",
      })
    ),
  }),
  S.Struct({
    ok: S.tag(false).pipe(
      $I.annoteKey("ReplayPayload.ok", { description: "The child failed to load or replay a hook." })
    ),
    name: S.optionalKey(S.String).pipe(
      $I.annoteKey("ReplayPayload.name", { description: "The config dependency whose hook failed, when identified." })
    ),
    message: S.optionalKey(S.String).pipe(
      $I.annoteKey("ReplayPayload.message", { description: "The child-side failure message, when available." })
    ),
    stack: S.optionalKey(S.String).pipe(
      $I.annoteKey("ReplayPayload.stack", { description: "The child-side failure stack, when available." })
    ),
  }),
]).pipe(
  $I.annoteSchema("ReplayPayload", {
    description: "The subprocess hook replay success or failure envelope, with tolerant success config data.",
  })
);

const replayFailureCause = (payload: { readonly message?: string; readonly stack?: string }): Error => {
  const error = ConfigDependencyReplayError.make({
    message: payload.message ?? "config dependency hook replay failed",
  });
  if (payload.stack !== undefined) error.stack = payload.stack;
  return error;
};

/**
 * Replays a workspace's `configDependencies` `updateConfig` hooks over the inline
 * catalogs — the opt-in seam that lets hook-injected catalogs participate in
 * assembly.
 *
 * **Details**
 *
 * A contract-only service: it declares the shape and ships layers, never a
 * baked-in default. {@link ConfigDependencyHooks.layerNoop} executes no
 * config-dependency code (it returns the seed untouched) and is what the default
 * {@link WorkspaceCatalogs} layer wires; {@link ConfigDependencyHooks.layerLive}
 * dynamically imports each pnpmfile and replays it, and is wired only by the
 * explicit `WorkspaceCatalogs.layerWithConfigDependencies` opt-in;
 * {@link ConfigDependencyHooks.layerSubprocess} is its bundler-safe twin; and
 * {@link ConfigDependencyHooks.layerFrom} is the hermetic test seam that
 * replays caller-supplied files with no resolution.
 *
 * Every replaying layer replays the pnpmfile of the version each
 * `configDependencies` entry **declares** — `layerLive` and `layerSubprocess`
 * resolve it through `node_modules/.pnpm-config` and then the pnpm store,
 * failing closed when neither holds that version — so a snapshot read at a
 * past ref replays that ref's pinned hook, not today's.
 *
 * **Example** (Replay a seed without executing hooks)
 *
 * ```ts
 * import { ConfigDependencyHooks } from "@beep/repo-workspaces/ConfigDependencyHooks";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const hooks = yield* ConfigDependencyHooks;
 *   const result = yield* hooks.inject("/repo", {}, { default: { effect: "^4.0.0" } });
 *   return result.catalogs.default?.effect;
 * }).pipe(Effect.provide(ConfigDependencyHooks.layerNoop));
 * console.log(Effect.runSync(program)) // ^4.0.0
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class ConfigDependencyHooks extends Context.Service<ConfigDependencyHooks, ConfigDependencyHooksShape>()(
  $I`ConfigDependencyHooks`
) {
  /**
   * The no-op layer: `inject` returns the seed unchanged and never touches a
   * config dependency. The default {@link WorkspaceCatalogs} layer wires this, so
   * the default catalog path provably executes no config-dependency code.
   *
   * **Example** (Preserve seed catalogs through the no-op layer)
   *
   * ```ts
   * import { ConfigDependencyHooks } from "@beep/repo-workspaces/ConfigDependencyHooks";
   * import * as Effect from "effect/Effect";
   *
   * const program = Effect.gen(function* () {
   *   const hooks = yield* ConfigDependencyHooks;
   *   const result = yield* hooks.inject("/repo", {}, { default: { effect: "^4.0.0" } });
   *   return result.catalogs.default?.effect;
   * }).pipe(Effect.provide(ConfigDependencyHooks.layerNoop));
   * console.log(Effect.runSync(program)) // ^4.0.0
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerNoop: Layer.Layer<ConfigDependencyHooks> = Layer.succeed(ConfigDependencyHooks, {
    inject: dual(
      (args) => P.isString(args[0]),
      Effect.fn("ConfigDependencyHooks.inject")(
        (
          _root: string,
          _configDependencies: Readonly<Record<string, string>>,
          seed: Readonly<Record<string, Readonly<Record<string, string>>>>,
          rules: PeerDependencyRules.Encoded | undefined
        ) => Effect.succeed(untouched(seed, rules))
      )
    ),
  });

  /**
   * The live layer: resolves each config dependency to the pnpmfile of its
   * **declared** version, dynamically imports it (in process, no subprocess)
   * and replays its `updateConfig` hook over the seed, in declaration order.
   * A dependency that ships no pnpmfile contributes nothing; a dependency
   * whose declared version is installed nowhere, or whose file fails to load
   * or replay, fails typed with a `hooks`-source `CatalogAssemblyError`, never
   * a silent skip.
   *
   * **Details**
   *
   * Resolution is a ladder, fail-closed, with no registry fetch ever:
   * `<root>/node_modules/.pnpm-config/<name>` when its `package.json`
   * `version` equals the declared version (the text before the first `+` of
   * the `configDependencies` value), else the pnpm store's
   * `links/<name>/<declared>/*\/node_modules/<name>` (the store is located
   * from `node_modules/.modules.yaml`, the realpath of any `.pnpm-config`
   * entry, then `$PNPM_HOME` / `$XDG_DATA_HOME` / the platform default), else
   * a typed error with `reason: "notInstalled"` naming the package, the
   * declared version, what is installed, the stores searched, and the
   * remediation (`pnpm add --config <name>@<version>` in a throwaway
   * workspace, or the subprocess layer, which fetches). In the
   * chosen directory the first of `pnpmfile.mjs`, `pnpmfile.cjs`,
   * `pnpmfile.js` present in one directory listing is loaded; a listed but
   * unreadable file fails typed at import time, never as "ships no hook".
   *
   * Runtime-coupled by design, not node-exclusive. The `import()` loads
   * **and executes** a config dependency's pnpmfile in-process — code execution,
   * not IO, so no `FileSystem` / `Path` service abstracts it. The ladder reads
   * through the `FileSystem` and `Path` the layer is built with, so replaying
   * a real workspace needs a real `FileSystem`: on a virtual one the store is
   * not found and the replay fails typed. Only ever wired by
   * `WorkspaceCatalogs.layerWithConfigDependencies` and the `Workspaces`
   * composites of the same name.
   *
   * **Example** (Construct the in-process replay layer)
   *
   * ```ts
   * import { ConfigDependencyHooks } from "@beep/repo-workspaces/ConfigDependencyHooks";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(ConfigDependencyHooks.layerLive)) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerLive: Layer.Layer<ConfigDependencyHooks, never, FileSystem.FileSystem | Path.Path> =
    Layer.effect(
      ConfigDependencyHooks,
      Effect.gen(function* () {
        const services = yield* Effect.context<FileSystem.FileSystem | Path.Path>();
        return {
          inject: replayingInject(
            services,
            Effect.fnUntraced(function* (request: ReplayRequest) {
              const pnpmfiles = yield* resolvePnpmfiles(request.root, request.configDependencies, request.context);
              return yield* replayInProcess(pnpmfiles, request.seed, request.rules);
            })
          ),
        };
      })
    );

  /**
   * The hermetic layer: replays caller-supplied pnpmfiles, keyed
   * `"<name>@<version>"` → absolute path, with **no resolution** — it consults
   * neither `node_modules/.pnpm-config` nor the pnpm store, and never the
   * effect `FileSystem` service, so it works unchanged under an
   * `@beep/memfs` volume.
   *
   * **Details**
   *
   * The test seam for anything that replays hooks: a suite can pin what
   * `at(ref)` replays for a ref declaring `plugin@1.0.0` versus one declaring
   * `plugin@2.0.0` by mapping both keys to fixture files, with no store on
   * disk. The version half of the key is the declared version — the text
   * before the first `+` of the `configDependencies` value — so a
   * `<version>+<integrity>` spec and a bare `<version>` spec look up the same
   * entry.
   *
   * Same typed semantics as {@link ConfigDependencyHooks.layerLive} past the
   * lookup: the same in-process `import()`, the same hook-locator shapes, the
   * same tolerant threading, the same `hooks`-source attribution. A declared
   * `(name, version)` with no entry fails closed, the same shape as an
   * uninstalled version under `layerLive`; an empty `configDependencies`
   * returns the seed untouched. A `..` segment in a name is refused before
   * any lookup.
   *
   * **Example** (Map plugin versions to fixture pnpmfiles)
   *
   * ```ts
   * import { ConfigDependencyHooks } from "@beep/repo-workspaces/ConfigDependencyHooks";
   * import * as Layer from "effect/Layer";
   *
   * const hooks = ConfigDependencyHooks.layerFrom({
   *   "@scope/plugin@1.0.0": "/fixtures/plugin-1/pnpmfile.mjs",
   *   "@scope/plugin@2.0.0": "/fixtures/plugin-2/pnpmfile.mjs",
   * });
   * console.log(Layer.isLayer(hooks)) // true
   * ```
   *
   * @param entries - `"<name>@<version>"` → the absolute path of the pnpmfile
   *   to replay for that declared version.
   * @category layers
   * @since 0.0.0
   */
  static readonly layerFrom = (
    entries: Readonly<Record<string, string>>
  ): Layer.Layer<ConfigDependencyHooks, never, Path.Path> =>
    Layer.effect(
      ConfigDependencyHooks,
      Effect.gen(function* () {
        const services = yield* Effect.context<Path.Path>();
        return {
          inject: replayingInject(
            services,
            Effect.fnUntraced(function* (request: ReplayRequest) {
              const pnpmfiles = yield* lookupPnpmfiles(entries, request.configDependencies);
              return yield* replayInProcess(pnpmfiles, request.seed, request.rules);
            })
          ),
        };
      })
    );

  /**
   * The subprocess layer: replays each config dependency's pnpmfile in a `node`
   * child process instead of an in-process dynamic `import()`, with identical
   * typed semantics to {@link ConfigDependencyHooks.layerLive} — the two are
   * drop-in interchangeable.
   *
   * **Details**
   *
   * `layerLive` computes the `import()` path at runtime, and a bundler (rspack,
   * for one) compiles a *computed* dynamic import into a context module that
   * throws `Cannot find module 'file:///…'` at runtime — so in any bundled
   * consumer, a GitHub Action above all, the in-process replay is unreachable.
   * This layer keeps every computed load out of the bundle graph: the replay
   * program is a **static** string constant passed via argv
   * (`node --input-type=module -e <script> <seed> <rules> <entries>`), and the
   * child process performs the computed imports where no bundler rewrote them.
   * A subprocess also keeps config-dependency code out of the consumer's own
   * process.
   *
   * The declared-version resolution is the PARENT's: the same ladder as
   * `layerLive` (`.pnpm-config` when it holds the declared version, else the
   * pnpm store) runs here, and the child receives the resolved
   * `[name, fileUrl]` pairs as one JSON argv argument.
   *
   * One rung more than `layerLive`: a version held nowhere is FETCHED into
   * the store rather than failing, so a diff whose base side declares a
   * version this checkout never installed still replays that version. pnpm
   * runs `install --frozen-lockfile` in a scratch workspace (removed
   * afterwards) whose lockfile pins the integrity the declaring side recorded
   * — the inline `<version>+<integrity>` spec, else that side's
   * `pnpm-lock.yaml` env preamble ({@link HookReplayContext.lockfile}) — so
   * pnpm itself refuses a download that does not match. It writes to the
   * first store the ladder searched, so the next replay finds the version
   * there. The replay records `source: "fetched"`. Fail-closed: two recorded
   * integrities that disagree fail with `reason: "integrityMismatch"`, none
   * with `reason: "integrityUnavailable"` — nothing is fetched in either case
   * — and a fetch that fails with `reason: "fetchFailed"`, keeping the
   * not-installed remediation. The fetch needs `pnpm` 11 or 12 on `PATH` and
   * registry access, and is bounded at two minutes.
   *
   * The scratch workspace fetches through the same registries a
   * `pnpm install` in the workspace would: the workspace root's `.npmrc` (scoped
   * registries, mirrors, auth) is copied into it as-is, with `${VAR}`
   * references left for pnpm to expand, never read or logged, and removed
   * with the scratch; and the root `pnpm-workspace.yaml`'s `registry` and
   * `registries` keys are carried into the scratch's. That is the CURRENT
   * checkout's registry config for both sides of a diff — a base ref's
   * `.npmrc` is not read through git — and relative paths inside the `.npmrc`
   * (a `cafile=./ca.pem`) resolve against the scratch, not the root.
   *
   * An empty `configDependencies`, or one whose dependencies all
   * ship no pnpmfile, returns the seed without spawning anything; a `..` path
   * segment in a dependency name fails typed **before** any spawn; a
   * load failure in the child — a syntax error, a throwing top level, an
   * `ERR_MODULE_NOT_FOUND` for a module the pnpmfile itself imports — and a
   * hook that throws when called are serialized back per-name and surface
   * typed as a `hooks`-source `CatalogAssemblyError` naming that dependency.
   * A hook's returned *data* stays tolerantly threaded (last well-formed write
   * wins), never fatal. Spawn and transport failures — `node` absent, a
   * non-zero exit without a result payload, unparseable output — fail typed
   * too, never a defect and never a silent skip.
   *
   * Two bounds this layer imposes that `layerLive` cannot: the replay is
   * given thirty seconds (a pnpmfile that loops or awaits forever fails typed
   * instead of hanging the memoized assemble pass — a subprocess is killable,
   * while `layerLive`'s in-process synchronous hook call is not interruptible
   * by any means, so the asymmetry is inherent, not a parity violation), and
   * the child's stdout is captured under `Run.jsonLine`'s 16 MiB default
   * ceiling (a hook that logs more than that fails typed as `tooLarge`, where
   * `layerLive` — which captures nothing — would succeed).
   *
   * Catalog folding and normalization stay in the **parent** (the same
   * `@pnpm/catalogs`-derived path `layerLive` uses); the child returns only the
   * raw threaded config slice, since the script cannot import kit code.
   *
   * Requires core's `ChildProcessSpawner`, resolved when the layer is built —
   * the consumer provides it once at the edge (`@effect/platform-node`'s
   * `NodeServices.layer`), the same discharge `@beep/git` uses. Wired by
   * `WorkspaceCatalogs.layerWithConfigDependenciesSubprocess` /
   * `Workspaces.layerWithConfigDependenciesSubprocess`.
   *
   * **Example** (Construct the subprocess replay layer)
   *
   * ```ts
   * import { ConfigDependencyHooks } from "@beep/repo-workspaces/ConfigDependencyHooks";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(ConfigDependencyHooks.layerSubprocess)) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerSubprocess: Layer.Layer<
    ConfigDependencyHooks,
    never,
    ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
  > = Layer.effect(
    ConfigDependencyHooks,
    Effect.gen(function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const services = yield* Effect.context<FileSystem.FileSystem | Path.Path>();
      const fetch = makeFetchConfigDependency(spawner);
      return {
        inject: replayingInject(
          services,
          Effect.fnUntraced(function* ({ root, configDependencies, seed, rules, context }: ReplayRequest) {
            const pnpmfiles = yield* resolvePnpmfiles(root, configDependencies, context, fetch);
            const loadable = yield* Effect.forEach(
              A.flatMap(pnpmfiles, ({ name, path }) => (path === undefined ? [] : [{ name, path }])),
              ({ name, path }) => Effect.map(fileUrlOf(name, path), (url) => [name, url] as const),
              { concurrency: 1 }
            );
            if (loadable.length === 0) return untouched(seed, rules, replaysOf(pnpmfiles));

            const command = ChildProcess.make("node", [
              "--input-type=module",
              "-e",
              REPLAY_SCRIPT,
              BUN_SHIM_SCRIPT_NAME_SLOT,
              Result.getOrThrow(S.encodeResult(JsonValue)(seed)),
              Result.getOrThrow(S.encodeResult(JsonValue)(rules ?? NO_PEER_RULES)),
              Result.getOrThrow(S.encodeResult(JsonValue)(loadable)),
            ]);
            const payload = yield* Run.jsonLine(command, ReplayPayload, { timeout: REPLAY_TIMEOUT }).pipe(
              Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
              Effect.mapError((cause) => CatalogAssemblyError.make({ source: "hooks", path: root, cause }))
            );

            if (payload.ok === false) {
              return yield* CatalogAssemblyError.make({
                source: "hooks",
                path: payload.name ?? root,
                cause: replayFailureCause(payload),
              });
            }

            return injectionOf(configOf(payload.config, seedToConfig(seed, rules)), pnpmfiles);
          })
        ),
      };
    })
  );
}
