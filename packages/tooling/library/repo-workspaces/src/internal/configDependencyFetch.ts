import { $RepoWorkspacesId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import { dual, flow, identity } from "effect/Function";
// The fetch rung of the config-dependency ladder: when neither
// `node_modules/.pnpm-config` nor any discovered store holds the version a
// side DECLARES, have pnpm put exactly that version into the store, verified
// against the integrity the declaring side recorded.
//
// Only `ConfigDependencyHooks.layerSubprocess` wires this rung; every other
// replaying layer fails typed with `reason: "notInstalled"` instead. The
// subprocess goes through `@beep/commands`' `Run` over core's
// `ChildProcessSpawner`, the same seam the replay itself uses.
//
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

// How the fetch is verified. pnpm is run in a SCRATCH workspace whose
// `pnpm-workspace.yaml` declares the config dependency as a bare version and
// whose `pnpm-lock.yaml` env preamble records it with the expected integrity,
// under `install --frozen-lockfile`. pnpm then checks the tarball against that
// integrity itself, and refuses on a mismatch even when the store already
// holds a copy (probed on pnpm 11.27.1 and 12.6.0). The integrity is decided
// here, BEFORE the spawn, fail-closed: the inline `<version>+<integrity>` spec
// when present, the declaring side's lockfile preamble otherwise, and a typed
// failure when the two disagree or neither exists. Nothing is ever fetched
// unverified.
//
// The declaring workspace's registry config comes along. pnpm reads a
// workspace's registry and auth from `<root>/.npmrc` and its `registry` /
// `registries` keys from `<root>/pnpm-workspace.yaml`, and a scratch under
// the OS temp dir sees neither, so a config dependency resolved through a
// scoped registry, a mirror or repo-level auth would fetch from the public
// registry and fail. The rung copies `<root>/.npmrc` into the scratch as-is
// (never read, never logged; `${VAR}` references stay verbatim for pnpm to
// expand) and carries those two yaml keys into the scratch
// `pnpm-workspace.yaml` (probed on pnpm 11.27.1 and 12.6.0: both keys are
// read from the workspace yaml; `npmrcAuthFile` is ignored there and auth
// lives only in `.npmrc`). `root` is the CURRENT workspace root for both
// sides of a diff: the base ref's `.npmrc` is not read through git, since
// registry config describes where this checkout fetches from, not what a ref
// declared.
//
// Every read and write goes through the caller's `FileSystem` and `Path`
// services, like the rest of the ladder: the scratch workspace and the store
// are real directories, so the replaying layer that wires this rung needs a
// real `FileSystem` for pnpm to see them.

import { Run } from "@beep/commands";
import { IntegrityHash } from "@beep/npm-spec/IntegrityHash";
import * as NodePath from "@beep/utils/Path";
import { Yaml } from "@beep/yaml";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import { HookReplayContext } from "../ConfigDependencyReplay.ts";
import { carries, manifestVersion, messageOf, sideLabel } from "./configDependencyShared.ts";
import { splitConfigDependencySpec } from "./configDependencySpecGrammar.ts";
import type { ConfigDependencyLock, LockfileFramingError, LockfileParseError } from "@beep/lockfiles";
import type * as PlatformError from "effect/PlatformError";

const $I = $RepoWorkspacesId.create("internal/configDependencyFetch");

const JsonString = S.fromJsonString(S.String).pipe(
  $I.annoteSchema("JsonString", { description: "A JSON-quoted YAML scalar retaining dependency and registry text." })
);
const quote = flow(S.encodeResult(JsonString), Result.getOrThrowWith(identity));

/**
 * The config dependencies the declaring side's `pnpm-lock.yaml` env preamble
 * records, decoded at most once per replay and shared by every fetch in it:
 * `undefined` when that side has no lockfile.
 *
 * @category type-level
 * @since 0.0.0
 */
export type RecordedLocks = Effect.Effect<
  HashMap.HashMap<string, ConfigDependencyLock> | undefined,
  LockfileParseError | LockfileFramingError
>;

/**
 * One config dependency the ladder could not find, handed to the fetch rung
 * beside the declaring side's {@link RecordedLocks}.
 *
 * **Example** (Describe a config dependency to fetch)
 *
 * ```ts
 * import { FetchRequest } from "@beep/repo-workspaces/internal/configDependencyFetch"
 *
 * const request = FetchRequest.make({
 *   root: "/repo",
 *   name: "workspace-config",
 *   version: "1.0.0",
 *   spec: "1.0.0",
 *   stores: [],
 *   side: {},
 * })
 * console.log(request.version) // 1.0.0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FetchRequest extends S.Opaque<FetchRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The config dependency's name, already `..`-checked. */
    name: S.String.pipe($I.annoteKey("FetchRequest.name", { description: "The config dependency's name." })),
    /**
     * The current workspace root, whose `.npmrc` and registry keys the scratch
     * workspace inherits — for both sides of a diff.
     */
    root: S.String.pipe(
      $I.annoteKey("FetchRequest.root", {
        description: "The current workspace root whose registry configuration the scratch workspace inherits.",
      })
    ),
    /** What the declaring side recorded. */
    side: HookReplayContext,
    /** The declared spec verbatim, `<version>` or the legacy `<version>+<integrity>`. */
    spec: S.String.pipe($I.annoteKey("FetchRequest.spec", { description: "The declared spec verbatim." })),
    /** The stores the ladder searched, in discovery order; the first is where the fetch writes. */
    stores: S.Array(S.String).pipe(
      $I.annoteKey("FetchRequest.stores", {
        description: "The stores the ladder searched, in discovery order; the fetch writes into the first.",
      })
    ),
    /** The declared version. */
    version: S.String.pipe($I.annoteKey("FetchRequest.version", { description: "The declared version." })),
  }).pipe(
    $I.annoteSchema("FetchRequest", {
      description: "One config dependency the resolution ladder could not find, handed to the fetch rung.",
    })
  )
) {}

/**
 * Companion types for {@link FetchRequest}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace FetchRequest {
  /**
   * The plain, unbranded encoded shape of a {@link FetchRequest}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof FetchRequest.Encoded;
}

/**
 * Why the fetch rung failed: the public `CatalogAssemblyError` reasons it can report.
 *
 * **Example** (Recognize an integrity refusal)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { FetchFailureReason } from "@beep/repo-workspaces/internal/configDependencyFetch";
 *
 * console.log(S.is(FetchFailureReason)("integrityMismatch")) // true
 * console.log(S.is(FetchFailureReason)(null)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FetchFailureReason = LiteralKit(["fetchFailed", "integrityMismatch", "integrityUnavailable"]).pipe(
  $I.annoteSchema("FetchFailureReason", {
    description: "The reason a verified config-dependency fetch could not complete.",
  })
);

/**
 * Identifies why a verified config-dependency fetch could not complete.
 *
 * @category type-level
 * @since 0.0.0
 */
export type FetchFailureReason = typeof FetchFailureReason.Type;

/**
 * The fetch rung's internal failure record. The ladder, not the rung, builds
 * the one public `CatalogAssemblyError` from it, folding `message` into the
 * not-installed diagnosis and keeping `cause` on the chain.
 *
 * **Example** (Validate a fetch refusal without a foreign cause)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { FetchFailure } from "@beep/repo-workspaces/internal/configDependencyFetch";
 *
 * console.log(S.is(FetchFailure)({ reason: "fetchFailed", message: "The registry request failed." })) // true
 * console.log(S.is(FetchFailure)(null)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class FetchFailure extends S.Opaque<FetchFailure, { readonly brand: unique symbol }>()(
  S.Struct({
    reason: FetchFailureReason.pipe(
      $I.annoteKey("FetchFailure.reason", {
        description: "The public catalog-assembly reason reported by the fetch rung.",
      })
    ),
    /** The complete sentence(s) the ladder splices into its message. */
    message: S.String.pipe(
      $I.annoteKey("FetchFailure.message", {
        description: "The complete diagnosis the resolution ladder includes in its message.",
      })
    ),
    /** The underlying failure, when there is one. */
    cause: S.optionalKey(S.Unknown).pipe(
      $I.annoteKey("FetchFailure.cause", { description: "The underlying failure, omitted when there is none." })
    ),
  }).pipe(
    $I.annoteSchema("FetchFailure", {
      description: "A plain internal fetch failure retained by the resolution ladder.",
    })
  )
) {}

/**
 * Companion types for {@link FetchFailure}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace FetchFailure {
  /**
   * The plain, unbranded encoded shape of a {@link FetchFailure}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof FetchFailure.Encoded;
}

const fetchFailure: {
  (reason: FetchFailureReason, message: string, cause?: unknown): FetchFailure;
  (message: string, cause?: unknown): (reason: FetchFailureReason) => FetchFailure;
} = dual(
  (args) => S.is(FetchFailureReason)(args[0]),
  (reason: FetchFailureReason, message: string, cause?: unknown): FetchFailure =>
    FetchFailure.make(cause === undefined ? { reason, message } : { reason, message, cause })
);

/**
 * The fetch rung: put `<name>@<version>` into the store, verified, and answer
 * the store directory pnpm linked. Fails with a {@link FetchFailure} and never
 * returns an unverified copy.
 *
 * @category type-level
 * @since 0.0.0
 */
export type FetchConfigDependency = (
  request: FetchRequest,
  locks: RecordedLocks
) => Effect.Effect<string, FetchFailure, FileSystem.FileSystem | Path.Path>;

/**
 * The ceiling on one fetch. It downloads one small tarball; two minutes covers
 * a slow registry without letting a hung pnpm stall catalog assembly forever.
 */
const FETCH_TIMEOUT = Duration.minutes(2);

/**
 * The integrity the fetched copy must match, decided before anything is
 * spawned: the inline spec integrity (legacy) and the declaring side's
 * lockfile preamble entry for exactly `<name>@<version>`. Both present and
 * different, neither present, an inline integrity that is not SRI, or a
 * lockfile that cannot be read all fail typed. A lockfile that records the
 * name at a different version is not a source for this version.
 *
 * **Gotchas**
 *
 * An unreadable lockfile fails closed even when the spec carries an inline
 * integrity: the lockfile is the declaring side's own checksum store, and a
 * store that cannot be read cannot be confirmed to agree with the inline pin.
 *
 * **Example** (Reject a fetch without a recorded checksum)
 *
 * ```ts
 * import { expectedIntegrity } from "@beep/repo-workspaces/internal/configDependencyFetch"
 * import * as Effect from "effect/Effect"
 *
 * const program = expectedIntegrity(
 *   { name: "workspace-config", version: "1.0.0", spec: "1.0.0", side: {} },
 *   Effect.succeed(undefined)
 * )
 *
 * console.log(Effect.runSync(Effect.flip(program)).reason) // integrityUnavailable
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const expectedIntegrity: {
  (
    locks: RecordedLocks
  ): (request: Pick<FetchRequest.Encoded, "name" | "version" | "spec" | "side">) => Effect.Effect<string, FetchFailure>;
  (
    request: Pick<FetchRequest.Encoded, "name" | "version" | "spec" | "side">,
    locks: RecordedLocks
  ): Effect.Effect<string, FetchFailure>;
} = dual(
  2,
  Effect.fn("ConfigDependencyFetch.expectedIntegrity")(function* (
    request: Pick<FetchRequest.Encoded, "name" | "version" | "spec" | "side">,
    locks: RecordedLocks
  ): Effect.fn.Return<string, FetchFailure> {
    const { name, version, side } = request;
    const key = `${name}@${version}`;
    const inline = splitConfigDependencySpec(request.spec).integrity;
    if (inline !== undefined && !IntegrityHash.isSri(inline)) {
      return yield* Effect.fail(
        fetchFailure(
          "integrityUnavailable",
          `config dependency ${key} declared by ${sideLabel(side)} carries an inline integrity that is not an SRI hash, ` +
            "so a fetched copy cannot be verified and nothing was fetched."
        )
      );
    }
    const recorded = yield* locks.pipe(
      Effect.mapError((cause) =>
        fetchFailure(
          "integrityUnavailable",
          `config dependency ${key} must be fetched, but the pnpm-lock.yaml of ${sideLabel(side)} cannot be read ` +
            `(${messageOf(cause)}), so its recorded integrity cannot be checked and nothing was fetched.`,
          cause
        )
      )
    );
    const lock = O.getOrUndefined(O.flatMap(O.fromUndefinedOr(recorded), HashMap.get(name)));
    const locked = lock !== undefined && lock.version === version ? lock.integrity : undefined;
    if (inline !== undefined && locked !== undefined && inline !== locked) {
      return yield* Effect.fail(
        fetchFailure(
          "integrityMismatch",
          `config dependency ${key} declared by ${sideLabel(side)} has two different recorded integrities: ` +
            `pnpm-workspace.yaml pins ${inline} and pnpm-lock.yaml records ${locked}. Nothing was fetched; ` +
            "reconcile the two (a fresh `pnpm install` rewrites the lockfile) before retrying."
        )
      );
    }
    const integrity = inline ?? locked;
    if (integrity === undefined) {
      return yield* Effect.fail(
        fetchFailure(
          "integrityUnavailable",
          `config dependency ${key} must be fetched, but ${sideLabel(side)} records no integrity for it ` +
            "(no inline integrity in pnpm-workspace.yaml and no pnpm-lock.yaml entry for that version), " +
            "so a fetched copy could not be verified and nothing was fetched."
        )
      );
    }
    return integrity;
  })
);

/**
 * The registry settings pnpm reads from a `pnpm-workspace.yaml`: the default
 * `registry` and the per-scope `registries` map. Anything that is not a string
 * is dropped, as pnpm would not use it.
 *
 * **Example** (Validate scoped registry selection)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { RegistrySettings } from "@beep/repo-workspaces/internal/configDependencyFetch";
 *
 * console.log(S.is(RegistrySettings)({ registry: "https://registry.npmjs.org/", registries: { "@x": "https://registry.example.com/" } })) // true
 * console.log(S.is(RegistrySettings)(null)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class RegistrySettings extends S.Opaque<RegistrySettings, { readonly brand: unique symbol }>()(
  S.Struct({
    registry: S.optionalKey(S.String).pipe(
      $I.annoteKey("RegistrySettings.registry", {
        description: "The default registry URL, omitted when none was declared.",
      })
    ),
    registries: S.Record(S.String, S.String).pipe(
      $I.annoteKey("RegistrySettings.registries", { description: "String-valued registry URLs by scope." })
    ),
  }).pipe(
    $I.annoteSchema("RegistrySettings", {
      description: "The plain registry settings retained from a declaring workspace.",
    })
  )
) {}

/**
 * Companion types for {@link RegistrySettings}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace RegistrySettings {
  /**
   * The plain, unbranded encoded shape of a {@link RegistrySettings}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof RegistrySettings.Encoded;
}

/**
 * Extracts the {@link RegistrySettings} from a parsed `pnpm-workspace.yaml` document.
 *
 * **Details**
 *
 * Only string-valued registry URLs are retained; other scope entries are dropped.
 *
 * **Example** (Keep valid scoped registry URLs)
 *
 * ```ts
 * import { registrySettingsOf } from "@beep/repo-workspaces/internal/configDependencyFetch"
 *
 * const settings = registrySettingsOf({
 *   registry: "https://registry.npmjs.org/",
 *   registries: { "@team": "https://packages.example.com/", "@ignored": 42 },
 * })
 *
 * console.log(settings.registries["@team"]) // https://packages.example.com/
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const registrySettingsOf = (document: unknown): RegistrySettings => {
  if (!P.isObject(document)) return RegistrySettings.make({ registries: {} });
  const registries: Record<string, string> = {};
  if (P.isObject(document.registries)) {
    for (const [scope, url] of R.toEntries(document.registries)) {
      if (P.isString(url)) R.assignProperty(registries, scope, url);
    }
  }
  return RegistrySettings.make(
    P.isString(document.registry) ? { registry: document.registry, registries } : { registries }
  );
};

/**
 * The scratch workspace's `pnpm-workspace.yaml`: the one config dependency,
 * plus the declaring workspace's registry settings. Every key and scalar is a
 * JSON-quoted string, which YAML reads verbatim, so no declared text can
 * change the document's structure.
 *
 * **Example** (Quote a config dependency in workspace YAML)
 *
 * ```ts
 * import { scratchWorkspaceYaml } from "@beep/repo-workspaces/internal/configDependencyFetch"
 *
 * const yaml = scratchWorkspaceYaml("workspace-config", "1.0.0")
 *
 * console.log(yaml.split("\n")[1]) //   "workspace-config": "1.0.0"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const scratchWorkspaceYaml: {
  (version: string, settings?: RegistrySettings): (name: string) => string;
  (name: string, version: string, settings?: RegistrySettings): string;
} = dual(
  (args) => P.isString(args[1]),
  (name: string, version: string, settings: RegistrySettings.Encoded = { registries: {} }): string => {
    const lines = ["configDependencies:", `  ${quote(name)}: ${quote(version)}`];
    if (settings.registry !== undefined) lines.push(`registry: ${quote(settings.registry)}`);
    const scopes = R.toEntries(settings.registries);
    if (scopes.length > 0) {
      lines.push("registries:");
      for (const [scope, url] of scopes) lines.push(`  ${quote(scope)}: ${quote(url)}`);
    }
    return `${A.join(lines, "\n")}\n`;
  }
);

/** Whether `error` is a node filesystem "no such file" failure. */
/** `None` when `effect` fails because its target does not exist; any other failure passes through. */
const orAbsent = <A, R>(
  effect: Effect.Effect<A, PlatformError.PlatformError, R>
): Effect.Effect<O.Option<A>, PlatformError.PlatformError, R> =>
  effect.pipe(
    Effect.asSome,
    Effect.catchIf(
      (error) => error.reason._tag === "NotFound",
      () => Effect.succeedNone
    )
  );

/**
 * The scratch workspace's `pnpm-lock.yaml`: the env preamble pnpm 11 and 12
 * write for a lone config dependency, pinned to `integrity`, followed by the
 * empty lockfile document they write when there are no projects.
 */
const scratchLockfile: {
  (name: string, version: string, integrity: string): string;
  (version: string, integrity: string): (name: string) => string;
} = dual(3, (name: string, version: string, integrity: string): string => {
  const key = quote(`${name}@${version}`);
  return A.join(
    [
      "---",
      "lockfileVersion: '9.0'",
      "",
      "importers:",
      "",
      "  .:",
      "    configDependencies:",
      `      ${quote(name)}:`,
      `        specifier: ${quote(version)}`,
      `        version: ${quote(version)}`,
      "",
      "packages:",
      "",
      `  ${key}:`,
      `    resolution: {integrity: ${quote(integrity)}}`,
      "",
      "snapshots:",
      "",
      `  ${key}: {}`,
      "",
      "---",
      "",
    ],
    "\n"
  );
});

/**
 * The `--store-dir` to hand pnpm so it writes into the store the ladder
 * searched first. Discovered stores are the versioned directories
 * (`<root>/v11`), and pnpm appends that segment itself, so a versioned
 * directory is passed as its parent. `None` (pnpm's own default) when no store
 * was discovered.
 *
 * **Example** (Remove the pnpm store format suffix)
 *
 * ```ts
 * import { storeDirArgument } from "@beep/repo-workspaces/internal/configDependencyFetch"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrUndefined(storeDirArgument(["/pnpm/store/v11"]))) // /pnpm/store
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const storeDirArgument = (stores: ReadonlyArray<string>): O.Option<string> =>
  O.map(A.head(stores), (first) => (/(?:^|[/\\])v\d+$/.test(first) ? NodePath.dirname(first) : first));

/**
 * Builds the pnpm argv for the verified fetch.
 *
 * **Example** (Construct a frozen install using the default store)
 *
 * ```ts
 * import { fetchArgs } from "@beep/repo-workspaces/internal/configDependencyFetch"
 *
 * console.log(fetchArgs("/scratch", []).join(" ")) // install --frozen-lockfile --dir /scratch
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const fetchArgs: {
  (stores: ReadonlyArray<string>): (scratch: string) => ReadonlyArray<string>;
  (scratch: string, stores: ReadonlyArray<string>): ReadonlyArray<string>;
} = dual(2, (scratch: string, stores: ReadonlyArray<string>): ReadonlyArray<string> => {
  const storeDir = storeDirArgument(stores);
  return [
    "install",
    "--frozen-lockfile",
    "--dir",
    scratch,
    ...O.match(storeDir, { onNone: A.empty<string>, onSome: (dir) => ["--store-dir", dir] }),
  ];
});

/** Whether `resolved` sits under a store's `links/<name>/<version>/` tree. */
const isStoreEntry: {
  (resolved: string, name: string, version: string): boolean;
  (name: string, version: string): (resolved: string) => boolean;
} = dual(3, (resolved: string, name: string, version: string): boolean =>
  Str.includes(`/links/${name}/${version}/`)(A.join(Str.split(resolved, /[/\\]/), "/"))
);

/**
 * Build the fetch rung over a spawner. Wired only by
 * `ConfigDependencyHooks.layerSubprocess`.
 *
 * **Example** (Construct a fetcher from the subprocess service)
 *
 * ```ts
 * import { makeFetchConfigDependency } from "@beep/repo-workspaces/internal/configDependencyFetch"
 * import * as Effect from "effect/Effect"
 * import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner"
 *
 * const program = Effect.map(ChildProcessSpawner.ChildProcessSpawner, makeFetchConfigDependency)
 *
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeFetchConfigDependency =
  (spawner: ChildProcessSpawner.ChildProcessSpawner["Service"]): FetchConfigDependency =>
  (request, locks) =>
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { name, version } = request;
        const key = `${name}@${version}`;
        const failed = (message: string, cause?: unknown) => fetchFailure("fetchFailed", message, cause);
        const io: {
          <A, R>(
            what: string,
            effect: Effect.Effect<A, PlatformError.PlatformError, R>
          ): Effect.Effect<A, FetchFailure, R>;
          <A, R>(
            effect: Effect.Effect<A, PlatformError.PlatformError, R>
          ): (what: string) => Effect.Effect<A, FetchFailure, R>;
        } = dual(
          2,
          <A, R>(
            what: string,
            effect: Effect.Effect<A, PlatformError.PlatformError, R>
          ): Effect.Effect<A, FetchFailure, R> =>
            Effect.mapError(effect, (cause) => failed(`${what} failed: ${messageOf(cause)}`, cause))
        );

        const integrity = yield* expectedIntegrity(request, locks);
        // The declaring workspace's registry keys, read before anything is
        // spawned. An absent yaml carries none; an unparseable one fails,
        // since fetching past it could reach a registry the workspace
        // never configured.
        const rootYaml = yield* io(
          "reading the workspace pnpm-workspace.yaml",
          orAbsent(fs.readFileString(path.join(request.root, "pnpm-workspace.yaml")))
        );
        const settings = yield* O.match(rootYaml, {
          onNone: () => Effect.succeed(registrySettingsOf(undefined)),
          onSome: (text) =>
            Yaml.parse(text).pipe(
              Effect.mapBoth({
                onFailure: (cause) =>
                  failed(`reading the workspace pnpm-workspace.yaml failed: ${messageOf(cause)}`, cause),
                onSuccess: registrySettingsOf,
              })
            ),
        });
        const scratch = yield* Effect.acquireRelease(
          io("creating a scratch workspace", fs.makeTempDirectory({ prefix: "effected-config-dependency-" })),
          (dir) => Effect.ignore(fs.remove(dir, { recursive: true, force: true }))
        );
        const lockfile = scratchLockfile(name, version, integrity);
        yield* io(
          "writing the scratch workspace",
          Effect.andThen(
            Effect.all([
              fs.writeFileString(
                path.join(scratch, "pnpm-workspace.yaml"),
                scratchWorkspaceYaml(name, version, settings)
              ),
              fs.writeFileString(path.join(scratch, "pnpm-lock.yaml"), lockfile),
            ]),
            // Copied as-is, never read: it may carry auth. The scratch's release
            // removes it with the rest of the directory.
            orAbsent(fs.copyFile(path.join(request.root, ".npmrc"), path.join(scratch, ".npmrc")))
          )
        );

        const command = ChildProcess.make("pnpm", fetchArgs(scratch, request.stores), { cwd: scratch });
        yield* Run.text(command, { timeout: FETCH_TIMEOUT }).pipe(
          Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
          Effect.mapError((cause) =>
            failed(
              `fetching ${key} with \`pnpm ${A.join(fetchArgs("<scratch>", request.stores), " ")}\` failed: ${messageOf(cause)}`,
              cause
            )
          )
        );

        // `--frozen-lockfile` forbids pnpm from rewriting the pin. A pnpm that
        // did anyway (one that does not read the env preamble, say) installed
        // something the pin never verified, so its result is not used.
        const after = yield* io(
          "reading back the scratch lockfile",
          fs.readFileString(path.join(scratch, "pnpm-lock.yaml"))
        );
        if (after !== lockfile) {
          return yield* Effect.fail(
            failed(
              `fetching ${key}: pnpm rewrote the integrity-pinned scratch lockfile instead of installing from it, ` +
                "so the installed copy was not verified against the recorded integrity and is not used."
            )
          );
        }

        // The copy pnpm linked is the one it verified: resolve the scratch
        // workspace's `.pnpm-config` entry to its store directory.
        const linked = path.join(scratch, "node_modules", ".pnpm-config", name);
        const resolved = yield* io(`resolving ${linked}`, fs.realPath(linked));
        const manifest = yield* manifestVersion(name, resolved).pipe(
          Effect.mapError((error) =>
            failed(`the fetched ${key} has an unreadable package.json: ${messageOf(error.cause)}`, error.cause)
          )
        );
        if (!carries(manifest, version) || !isStoreEntry(resolved, name, version)) {
          return yield* Effect.fail(
            failed(
              `fetching ${key}: pnpm linked ${resolved}, which is not a store copy of that version ` +
                `(its manifest reads ${manifest._tag === "version" ? manifest.version : "no version"}).`
            )
          );
        }
        return resolved;
      })
    );
