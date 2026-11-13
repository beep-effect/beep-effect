/**
 * Resolution of the per-repository fleet discovery roots.
 *
 * Precedence: `BEEP_FLEET_ROOTS` (a `:`-separated path list, for tests and
 * timer units), then `<state>/beep/fleet/<repo-key>/roots.json`, where
 * `<repo-key>` is the session ledger's `host__owner__name` key. With neither
 * set the resolver returns `O.none()` and every caller keeps the root it
 * derived before the list existed, so `beep worktree fleet --json` stays
 * byte-identical.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { constant, flow, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { resolveWorkstationStateDir } from "../../../internal/state/WorkstationState.ts";
import { canonicalRepositoryIdentity } from "../../Yeet/internal/ArtifactPaths.ts";
import { PrRepository } from "../../Yeet/internal/Provenance.ts";
import { WorktreeCommandError } from "../Worktree.errors.ts";
import { ConfiguredFleetRoots, FleetRootEntry, FleetRootsDocument } from "./FleetRoots.schemas.ts";
import type * as PlatformError from "effect/PlatformError";

const $I = $RepoCliId.create("commands/Worktree/internal/FleetRoots");

/**
 * Environment variable that overrides `roots.json`.
 *
 * @category constants
 * @since 0.0.0
 */
export const FLEET_ROOTS_ENV = "BEEP_FLEET_ROOTS";

/**
 * Environment variable that relocates the fleet state directory (tests).
 *
 * @category constants
 * @since 0.0.0
 */
export const FLEET_STATE_ROOT_ENV = "BEEP_FLEET_STATE_ROOT";

// `/p/beep-effect*` is the root `/p` with prefix `beep-effect`; any other entry is an unfiltered root.
// Entries stay in encoded form: `readConfiguredFleetRoots` decodes them, which refuses a relative path.
const parseRootEntry = (entry: string): typeof FleetRootEntry.Encoded =>
  pipe(
    Str.lastIndexOf("/")(entry),
    O.filter((slash) => slash > 0 && Str.endsWith("*")(entry)),
    O.match({
      onNone: () => ({ path: entry }),
      onSome: (slash) => ({ path: Str.slice(0, slash)(entry), namePrefix: Str.slice(slash + 1, -1)(entry) }),
    })
  );

/**
 * Parse a `BEEP_FLEET_ROOTS` path list.
 *
 * **Details**
 *
 * Entries are `:`-separated and trimmed; empty entries are dropped. An entry
 * whose last segment ends in `*` names a prefix-matched root: `/p/beep-effect*`
 * is the root `/p` admitting only children named `beep-effect…`.
 *
 * **Example** (The workstation's three roots)
 *
 * ```ts
 * import { parseFleetRootsPathList } from "@beep/repo-cli/test/Worktree"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 *
 * const roots = parseFleetRootsPathList("/p/beep-effect*:/p/beep/seats:/p/beep/lanes")
 * const prefixes = O.map(roots, A.map((entry) => entry.namePrefix ?? "*"))
 * console.log(O.getOrElse(prefixes, A.empty)) // ["beep-effect", "*", "*"]
 * ```
 *
 * @param value - Raw `BEEP_FLEET_ROOTS` value.
 * @returns The parsed, not yet validated roots, or `O.none()` when the list holds no entry.
 * @category parsing
 * @since 0.0.0
 */
export const parseFleetRootsPathList = (
  value: string
): O.Option<A.NonEmptyReadonlyArray<typeof FleetRootEntry.Encoded>> => {
  const entries = pipe(Str.split(value, ":"), A.map(Str.trim), A.filter(Str.isNonEmpty), A.map(parseRootEntry));
  return A.isReadonlyArrayNonEmpty(entries) ? O.some(entries) : O.none();
};

/**
 * The repository key every per-repository state file shares with the
 * session ledger: `host__owner__name`.
 *
 * **Example** (Key the main repository)
 *
 * ```ts
 * import { fleetRepositoryKey } from "@beep/repo-cli/test/Worktree"
 *
 * console.log(fleetRepositoryKey({ host: "github.com", owner: "beep-effect", name: "beep-effect" }))
 * // "github.com__beep-effect__beep-effect"
 * ```
 *
 * @param repository - The repository the fleet belongs to.
 * @returns The state-directory key.
 * @category formatting
 * @since 0.0.0
 */
export const fleetRepositoryKey = (repository: PrRepository): string =>
  `${repository.host}__${repository.owner}__${repository.name}`;

/**
 * Resolve `<state>/beep/fleet/<repo-key>`, honoring `BEEP_FLEET_STATE_ROOT`.
 *
 * **Example** (Build the resolver effect)
 *
 * ```ts
 * import { fleetStateDirectory } from "@beep/repo-cli/test/Worktree"
 * import * as Effect from "effect/Effect"
 *
 * const dir = fleetStateDirectory({ host: "github.com", owner: "beep-effect", name: "beep-effect" })
 * console.log(Effect.isEffect(dir)) // true
 * ```
 *
 * @param repository - The repository the fleet belongs to.
 * @returns The absolute directory holding `roots.json` and `registry.json`.
 * @category utilities
 * @since 0.0.0
 */
export const fleetStateDirectory = Effect.fn("FleetRoots.stateDirectory")(function* (repository: PrRepository) {
  const root = yield* resolveWorkstationStateDir({ override: FLEET_STATE_ROOT_ENV, store: "fleet" }).pipe(
    Effect.mapError(WorktreeCommandError.new("Failed to resolve the fleet state directory."))
  );
  return `${root}/${fleetRepositoryKey(repository)}`;
});

const decodeRootsDocument = S.decodeUnknownEffect(S.fromJsonString(FleetRootsDocument));
const decodeRootEntries = S.decodeUnknownEffect(S.NonEmptyArray(FleetRootEntry));

/**
 * Read a fleet state file; a missing file is `O.none()`, any other failure is typed.
 *
 * **Example** (Build the read)
 *
 * ```ts
 * import { readOptionalFleetStateFile } from "@beep/repo-cli/test/Worktree"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(readOptionalFleetStateFile("/state/fleet/x/roots.json"))) // true
 * ```
 *
 * @param file - Absolute path of the state file.
 * @returns The file's text, or `O.none()` when it does not exist.
 * @category utilities
 * @since 0.0.0
 */
export const readOptionalFleetStateFile = Effect.fn("FleetRoots.readOptionalStateFile")(function* (file: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFileString(file).pipe(
    Effect.asSome,
    Effect.catchTag("PlatformError", (error) =>
      error.reason._tag === "NotFound"
        ? Effect.succeedNone
        : Effect.fail(WorktreeCommandError.make({ message: `Failed to read ${file}.`, path: file, cause: error }))
    )
  );
});

const readRootsFile = Effect.fn("FleetRoots.readFile")(function* (repository: PrRepository) {
  const path = yield* Path.Path;
  const directory = yield* fleetStateDirectory(repository);
  const file = path.join(directory, "roots.json");
  const content = yield* readOptionalFleetStateFile(file);
  if (O.isNone(content)) {
    return O.none<ConfiguredFleetRoots>();
  }
  const document = yield* decodeRootsDocument(content.value).pipe(
    Effect.mapError(WorktreeCommandError.new(`Failed to decode ${file} as a fleet roots document.`, { path: file }))
  );
  return O.some(ConfiguredFleetRoots.make({ source: "file", roots: document.roots }));
});

/**
 * Read the configured roots list: `BEEP_FLEET_ROOTS`, then `roots.json`.
 *
 * **Details**
 *
 * `O.none()` means "not configured": the caller keeps its derived root. A
 * `roots.json` that exists but does not decode fails loudly instead of
 * silently shrinking the fleet. Without a repository identity (a local-path
 * origin) only the environment is consulted.
 *
 * **Example** (Build the read)
 *
 * ```ts
 * import { readConfiguredFleetRoots } from "@beep/repo-cli/test/Worktree"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * console.log(Effect.isEffect(readConfiguredFleetRoots(O.none()))) // true
 * ```
 *
 * @param repository - The repository whose `roots.json` is consulted, when known.
 * @returns The configured roots and their source, or `O.none()`.
 * @category utilities
 * @since 0.0.0
 */
export const readConfiguredFleetRoots = Effect.fn("FleetRoots.readConfigured")(function* (
  repository: O.Option<PrRepository>
): Effect.fn.Return<O.Option<ConfiguredFleetRoots>, WorktreeCommandError, FileSystem.FileSystem | Path.Path> {
  const fromEnv = yield* Config.option(Config.String(FLEET_ROOTS_ENV)).pipe(
    Effect.mapError(WorktreeCommandError.new(`Failed to read ${FLEET_ROOTS_ENV}.`))
  );
  const envRoots = O.flatMap(fromEnv, parseFleetRootsPathList);
  if (O.isSome(envRoots)) {
    const roots = yield* decodeRootEntries(envRoots.value).pipe(
      Effect.mapError(WorktreeCommandError.new(`${FLEET_ROOTS_ENV} must list absolute directories.`))
    );
    return O.some(ConfiguredFleetRoots.make({ source: "env", roots }));
  }
  return O.isSome(repository) ? yield* readRootsFile(repository.value) : O.none();
});

const decodeRepository = S.decodeUnknownOption(PrRepository);
const GITHUB_REPOSITORY = /github\.com[/:]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/u;
// The `[remote "origin"]` section body runs to the next `[` section header or the end of the text.
const ORIGIN_SECTION = /^\s*\[\s*remote\s+"origin"\s*\]\s*$([^[]*)/mu;
const URL_ENTRY = /^\s*url\s*=\s*(.+?)\s*$/mu;

/**
 * Read the `origin` URL from git config text without spawning git.
 *
 * **Example** (A clone's `.git/config`)
 *
 * ```ts
 * import { originUrlFromGitConfig } from "@beep/repo-cli/test/Worktree"
 * import * as O from "effect/Option"
 *
 * const config = '[core]\n\tbare = false\n[remote "origin"]\n\turl = git@github.com:beep-effect/beep-effect.git\n'
 * console.log(O.getOrNull(originUrlFromGitConfig(config))) // "git@github.com:beep-effect/beep-effect.git"
 * ```
 *
 * @param config - The text of a `.git/config` file.
 * @returns The first `url` of the `[remote "origin"]` section, or `O.none()`.
 * @category parsing
 * @since 0.0.0
 */
export const originUrlFromGitConfig = (config: string): O.Option<string> =>
  pipe(
    Str.match(ORIGIN_SECTION)(config),
    O.flatMap((section) => O.fromUndefinedOr(section[1])),
    O.flatMap(Str.match(URL_ENTRY)),
    O.flatMap((entry) => O.fromUndefinedOr(entry[1]))
  );

/**
 * Parse a github.com remote into the repository identity that keys fleet state.
 *
 * **Example** (SCP and HTTPS spellings key the same fleet)
 *
 * ```ts
 * import { fleetRepositoryFromOriginUrl } from "@beep/repo-cli/test/Worktree"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrNull(fleetRepositoryFromOriginUrl("https://github.com/Beep-Effect/beep-effect.git"))?.owner)
 * // "beep-effect"
 * ```
 *
 * @param url - A remote URL.
 * @returns The lowercased github.com identity, or `O.none()` for any other remote.
 * @category parsing
 * @since 0.0.0
 */
export const fleetRepositoryFromOriginUrl = (url: string): O.Option<PrRepository> =>
  pipe(
    Str.match(GITHUB_REPOSITORY)(Str.trim(url)),
    O.flatMap((match) => O.all({ owner: O.fromUndefinedOr(match[1]), name: O.fromUndefinedOr(match[2]) })),
    O.flatMap(({ owner, name }) =>
      decodeRepository({ host: "github.com", owner: Str.toLowerCase(owner), name: Str.toLowerCase(name) })
    )
  );

/**
 * Canonicalize an origin URL for fleet membership: SCP and URL spellings of
 * one remote compare equal, and a local path keeps only its trailing slash and
 * `.git` stripped.
 *
 * **Example** (Two spellings, one origin)
 *
 * ```ts
 * import { canonicalFleetOrigin } from "@beep/repo-cli/test/Worktree"
 *
 * console.log(canonicalFleetOrigin("git@github.com:o/r.git") === canonicalFleetOrigin("https://github.com/o/r"))
 * // true
 * ```
 *
 * @param url - A remote URL, SCP-style remote, or local path.
 * @returns The comparison key for fleet origin matching.
 * @category formatting
 * @since 0.0.0
 */
export const canonicalFleetOrigin = (url: string): string => {
  const trimmed = canonicalRepositoryIdentity(url);
  const withoutSlash = Str.endsWith("/")(trimmed) ? Str.slice(0, -1)(trimmed) : trimmed;
  return Str.endsWith(".git")(withoutSlash) ? Str.slice(0, -4)(withoutSlash) : withoutSlash;
};

// A missing entry, or a path that crosses a file, is absent; any other read failure is an error.
const isAbsentEntryReason = S.is(S.Literals(["NotFound", "BadResource"]));
const optionalWhenAbsent = <A, R>(
  read: Effect.Effect<A, PlatformError.PlatformError, R>
): Effect.Effect<O.Option<A>, PlatformError.PlatformError, R> =>
  read.pipe(
    Effect.asSome,
    Effect.catchIf((error) => isAbsentEntryReason(error.reason._tag), constant(Effect.succeedNone))
  );

// The raw `origin` URL from a clone's `.git/config`, read without spawning git. A
// missing config is `O.none()`; an unreadable one fails.
const readCloneOriginUrlStrict = Effect.fnUntraced(function* (clone: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const config = yield* optionalWhenAbsent(fs.readFileString(path.join(clone, ".git", "config")));
  return O.flatMap(config, originUrlFromGitConfig);
});

// The lenient form fleet readers use: unreadable is `O.none()`.
const readCloneOriginUrl = (clone: string) => readCloneOriginUrlStrict(clone).pipe(Effect.orElseSucceed(O.none));

/**
 * Read a clone's canonical origin from its `.git/config` without spawning git.
 *
 * **Example** (Build the read)
 *
 * ```ts
 * import { readCloneFleetOrigin } from "@beep/repo-cli/test/Worktree"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(readCloneFleetOrigin("/p/beep-effect"))) // true
 * ```
 *
 * @param clone - The clone root (the directory holding `.git/`).
 * @returns The canonical origin, or `O.none()` when the config or its origin is unreadable.
 * @category utilities
 * @since 0.0.0
 */
export const readCloneFleetOrigin = Effect.fn("FleetRoots.readCloneOrigin")(function* (clone: string) {
  const url = yield* readCloneOriginUrl(clone);
  return O.map(url, canonicalFleetOrigin);
});

/**
 * Resolve a clone's fleet repository identity from its `.git/config`.
 *
 * **Details**
 *
 * Filesystem-only, for callers such as Yeet economics that never spawn git.
 * An unreadable config or a non-github origin is `O.none()`, which leaves only
 * `BEEP_FLEET_ROOTS` able to configure the roots.
 *
 * **Example** (Build the read)
 *
 * ```ts
 * import { readCloneFleetRepository } from "@beep/repo-cli/test/Worktree"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(readCloneFleetRepository("/p/beep-effect"))) // true
 * ```
 *
 * @param clone - The clone root (the directory holding `.git/`).
 * @returns The repository identity, when the origin names one.
 * @category utilities
 * @since 0.0.0
 */
export const readCloneFleetRepository = Effect.fn("FleetRoots.readCloneRepository")(function* (clone: string) {
  const url = yield* readCloneOriginUrl(clone);
  return O.flatMap(url, fleetRepositoryFromOriginUrl);
});

const GIT_METADATA_NAME = ".git";
const GIT_WORKTREES_DIRECTORY_NAME = "worktrees";
const GITDIR_PREFIX = "gitdir:";

// A linked worktree's `.git` file holds `gitdir: <clone>/.git/worktrees/<name>`.
const gitDirOfGitFile = (path: Path.Path, checkout: string, content: string): O.Option<string> =>
  pipe(
    A.findFirst(A.map(Str.split(content, "\n"), Str.trim), Str.startsWith(GITDIR_PREFIX)),
    O.map(flow(Str.slice(Str.length(GITDIR_PREFIX)), Str.trim)),
    O.filter(Str.isNonEmpty),
    O.map((target) => path.resolve(checkout, target))
  );

const cloneOfGitDir = (path: Path.Path, gitDir: string): O.Option<string> => {
  const worktrees = path.dirname(gitDir);
  const metadata = path.dirname(worktrees);
  return O.liftPredicate(
    path.dirname(metadata),
    () =>
      Str.Equivalence(path.basename(worktrees), GIT_WORKTREES_DIRECTORY_NAME) &&
      Str.Equivalence(path.basename(metadata), GIT_METADATA_NAME)
  );
};

// The strict clone resolution: a missing `.git` is `O.none()`, an unreadable one fails.
const resolveCheckoutClone = Effect.fnUntraced(function* (checkout: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const gitPath = path.join(checkout, GIT_METADATA_NAME);
  const gitStat = yield* optionalWhenAbsent(fs.stat(gitPath));
  const kind = O.map(gitStat, (info) => info.type);
  if (O.contains(kind, "Directory")) {
    return O.some(checkout);
  }
  const content = O.contains(kind, "File") ? yield* optionalWhenAbsent(fs.readFileString(gitPath)) : O.none<string>();
  return pipe(
    content,
    O.flatMap((text) => gitDirOfGitFile(path, checkout, text)),
    O.flatMap((gitDir) => cloneOfGitDir(path, gitDir))
  );
});

/**
 * Resolve the clone that owns a checkout from its git metadata, without spawning git.
 *
 * **Details**
 *
 * A `.git` directory makes the checkout its own clone; a `.git` file names the
 * clone's `.git/worktrees/<name>`, so a linked worktree resolves to the clone it
 * was added from even after it is renamed. `O.none()` when `.git` is missing,
 * unreadable, or names any other layout.
 *
 * **Example** (Build the read)
 *
 * ```ts
 * import { readCheckoutClone } from "@beep/repo-cli/test/Worktree"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(readCheckoutClone("/p/beep-effect-worktrees/lane"))) // true
 * ```
 *
 * @param checkout - A clone or linked worktree root.
 * @returns The owning clone's root, when the git metadata names one.
 * @category utilities
 * @since 0.0.0
 */
export const readCheckoutClone = Effect.fn("FleetRoots.readCheckoutClone")((checkout: string) =>
  resolveCheckoutClone(checkout).pipe(Effect.orElseSucceed(O.none))
);

/**
 * Resolve a checkout's fleet repository, failing on git metadata it cannot read.
 *
 * **Details**
 *
 * The strict form of {@link readCheckoutClone} then {@link readCloneFleetRepository}:
 * a missing `.git` or `.git/config`, or a path that crosses a file, means no
 * repository (`O.none()`), as does an origin that names no GitHub repository.
 * Any other read failure, such as a permission denial, fails, so a caller that
 * must not lose data can tell "no repository" from "could not tell".
 *
 * **Example** (Build the read)
 *
 * ```ts
 * import { readCheckoutFleetRepository } from "@beep/repo-cli/test/Worktree"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(readCheckoutFleetRepository("/p/beep-effect-worktrees/lane"))) // true
 * ```
 *
 * @param checkout - A clone or linked worktree root.
 * @returns The repository identity of the owning clone, when its origin names one.
 * @category utilities
 * @since 0.0.0
 */
export const readCheckoutFleetRepository = Effect.fn("FleetRoots.readCheckoutRepository")(function* (
  checkout: string
): Effect.fn.Return<O.Option<PrRepository>, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path> {
  const clone = yield* resolveCheckoutClone(checkout);
  const url = yield* readCloneOriginUrlStrict(O.getOrElse(clone, () => checkout));
  return O.flatMap(url, fleetRepositoryFromOriginUrl);
});

/**
 * Service contract for resolving the fleet roots list.
 *
 * @category services
 * @since 0.0.0
 */
export interface FleetRootsStoreShape {
  /**
   * The configured roots for a repository, or `O.none()` when unset.
   *
   * @since 0.0.0
   */
  readonly configured: (
    repository: O.Option<PrRepository>
  ) => Effect.Effect<O.Option<ConfiguredFleetRoots>, WorktreeCommandError>;
}

/**
 * Service tag for the fleet roots resolver.
 *
 * **Example** (Access the service)
 *
 * ```ts
 * import { FleetRootsStore } from "@beep/repo-cli/test/Worktree"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const program = Effect.flatMap(FleetRootsStore.asEffect(), (store) => store.configured(O.none()))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class FleetRootsStore extends Context.Service<FleetRootsStore, FleetRootsStoreShape>()($I`FleetRootsStore`) {}

/**
 * Live layer for {@link FleetRootsStore}: environment, then `roots.json`.
 *
 * **Example** (Reference the live layer)
 *
 * ```ts
 * import { FleetRootsStoreLive } from "@beep/repo-cli/test/Worktree"
 *
 * console.log(typeof FleetRootsStoreLive) // "object"
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const FleetRootsStoreLive: Layer.Layer<FleetRootsStore, never, FileSystem.FileSystem | Path.Path> = Layer.effect(
  FleetRootsStore,
  Effect.gen(function* () {
    // Only the services the store uses: the caller's Clock and ConfigProvider must stay in effect, so a store
    // built under a test clock or one environment never overrides the caller's.
    const runtime = yield* Effect.context<FileSystem.FileSystem | Path.Path>();
    const context = Context.pick(FileSystem.FileSystem, Path.Path)(runtime);
    return FleetRootsStore.of({
      configured: Effect.fn("FleetRootsStore.configured")((repository) =>
        readConfiguredFleetRoots(repository).pipe(Effect.provide(context))
      ),
    });
  })
);
