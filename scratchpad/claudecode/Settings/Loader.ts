/**
 * Effect-native loader for Claude Code `settings.json` files.
 *
 * **Details**
 *
 * Each source is parsed and validated independently, then merged in Claude
 * Code precedence order. Scalars use the higher-priority value, arrays are
 * concatenated and de-duplicated, and objects are merged recursively.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import * as O from "@beep/utils/Option";
import { Config, Effect, FileSystem, Order, Path } from "effect";
import * as A from "effect/Array";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { SettingsDecodeError, SettingsParseError, SettingsReadError } from "../Errors.ts";
import { SettingsFile, SettingsRaw } from "./Schema.ts";

const $I = $ScratchpadId.create("claudecode/Settings/Loader");

/**
 * Optional source overrides accepted by {@link load}.
 *
 * **Gotchas**
 *
 * `managedSettingsRoots` replaces the default managed roots
 * (`/Library/Application Support/ClaudeCode`, `/etc/claude-code`,
 * `C:\Program Files\ClaudeCode`) and ignores `managedSettingsRoot`.
 * `managedSettingsRoot` is consulted only when `managedSettingsRoots` is
 * absent.
 *
 * **Example** (Configure an explicit settings source)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { Settings } from "effect-claudecode"
 *
 * const options = Settings.LoadOptions.make({
 *   settingsPath: O.some("/tmp/session-settings.json")
 * })
 * console.log(O.getOrUndefined(options.settingsPath)) // "/tmp/session-settings.json"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class LoadOptions extends S.Class<LoadOptions>($I`LoadOptions`)(
  {
    settingsPath: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    managedSettingsRoot: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    managedSettingsRoots: S.OptionFromOptionalKey(S.String.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("LoadOptions", {
    description: "Optional settings and managed-policy source overrides.",
  })
) {}

/**
 * Companion types for {@link LoadOptions}.
 *
 * **Example** (Inspect encoded options)
 *
 * ```ts
 * import type { Settings } from "effect-claudecode"
 *
 * const options = {
 *   settingsPath: "/tmp/session-settings.json"
 * } satisfies Settings.LoadOptions.Encoded
 *
 * console.log(options.settingsPath) // "/tmp/session-settings.json"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace LoadOptions {
  /**
   * Runtime type represented by {@link LoadOptions}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = LoadOptions;
  /**
   * Plain object accepted by {@link load}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof LoadOptions.Encoded;
}

interface LoadedSource {
  readonly path: string;
  readonly content: O.Option<string>;
}

const defaultManagedSettingsRoots = [
  "/Library/Application Support/ClaudeCode",
  "/etc/claude-code",
  "C:\\Program Files\\ClaudeCode",
] as const;

const homeDirectory = Config.string("HOME").pipe(
  Config.orElse(() => Config.string("USERPROFILE")),
  Config.withDefault("/")
);

const readOptionalFile = (path: string): Effect.Effect<LoadedSource, SettingsReadError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const exists = yield* fs.exists(path).pipe(Effect.mapError((cause) => SettingsReadError.make({ path, cause })));
    if (!exists) {
      return { path, content: O.none() };
    }
    const content = yield* fs
      .readFileString(path)
      .pipe(Effect.mapError((cause) => SettingsReadError.make({ path, cause })));
    return { path, content: O.some(content) };
  });

const readDirectoryIfExists = (
  path: string
): Effect.Effect<ReadonlyArray<string>, SettingsReadError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const exists = yield* fs.exists(path).pipe(Effect.mapError((cause) => SettingsReadError.make({ path, cause })));
    if (!exists) {
      return [];
    }
    return yield* fs.readDirectory(path).pipe(Effect.mapError((cause) => SettingsReadError.make({ path, cause })));
  });

const decodeSettingsSource = (
  path: string,
  content: string
): Effect.Effect<SettingsRaw, SettingsParseError | SettingsDecodeError> =>
  Effect.gen(function* () {
    const parsed = yield* UnknownFromJsonString.decodeEffect(content).pipe(
      Effect.mapError((cause) => SettingsParseError.make({ path, cause }))
    );
    const raw = yield* S.decodeUnknownEffect(SettingsRaw)(parsed).pipe(
      Effect.mapError((cause) => SettingsDecodeError.make({ path, cause }))
    );
    yield* S.decodeUnknownEffect(SettingsFile)(parsed).pipe(
      Effect.mapError((cause) => SettingsDecodeError.make({ path, cause }))
    );
    return raw;
  });

const encodeUnknownJson = UnknownFromJsonString.encodeUnknownSync;

const isUnknownRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  P.isObject(value) && !A.isArray(value);

const unknownEquivalence = (left: unknown, right: unknown): boolean =>
  Str.Equivalence(encodeUnknownJson(left), encodeUnknownJson(right));

const mergeSettingsValue = (base: unknown, override: unknown): unknown => {
  if (A.isArray(base) && A.isArray(override)) {
    return A.dedupeWith(unknownEquivalence)(A.appendAll(base, override));
  }
  if (isUnknownRecord(base) && isUnknownRecord(override)) {
    return R.union(base, override, mergeSettingsValue);
  }
  return override;
};

const mergeSettingsRaw = (base: SettingsRaw, override: SettingsRaw): SettingsRaw =>
  R.union(base, override, mergeSettingsValue);

const materializeSettings = (raw: SettingsRaw): Effect.Effect<SettingsFile, SettingsDecodeError> =>
  S.decodeEffect(SettingsFile)(raw).pipe(
    Effect.mapError((cause) => SettingsDecodeError.make({ path: "<merged settings>", cause })),
    Effect.map((settings) =>
      SettingsFile.make({
        ...settings,
        raw: O.some(raw),
      })
    )
  );

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

/**
 * Resolve the canonical user settings path.
 *
 * **Example** (Resolve the user settings file)
 *
 * ```ts
 * import { Settings } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 * import * as Path from "effect/Path"
 * import * as Str from "effect/String"
 *
 * const path = Effect.runSync(
 *   Effect.provide(Settings.userSettingsPath, Path.layer)
 * )
 *
 * console.log(Str.endsWith("/.claude/settings.json")(path)) // true
 * ```
 *
 * @effects Reads the `HOME` or `USERPROFILE` configuration value and requires `Path.Path` to join the path segments.
 * @category configuration
 * @since 0.0.0
 */
export const userSettingsPath = Effect.gen(function* () {
  const path = yield* Path.Path;
  const home = yield* homeDirectory;
  return path.join(home, ".claude", "settings.json");
});

/**
 * Resolve the shared project settings path for a working directory.
 *
 * **Example** (Resolve the project settings file)
 *
 * ```ts
 * import { Settings } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 * import * as Path from "effect/Path"
 *
 * const path = Effect.runSync(
 *   Effect.provide(Settings.projectSettingsPath("/repo"), Path.layer)
 * )
 *
 * console.log(path) // "/repo/.claude/settings.json"
 * ```
 *
 * @effects Requires `Path.Path` to join the project-relative path without accessing the filesystem.
 * @category configuration
 * @since 0.0.0
 */
export const projectSettingsPath = (cwd: string): Effect.Effect<string, never, Path.Path> =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    return path.join(cwd, ".claude", "settings.json");
  });

/**
 * Resolve the local, normally gitignored settings path.
 *
 * **Example** (Resolve the local settings file)
 *
 * ```ts
 * import { Settings } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 * import * as Path from "effect/Path"
 *
 * const path = Effect.runSync(
 *   Effect.provide(Settings.localSettingsPath("/repo"), Path.layer)
 * )
 *
 * console.log(path) // "/repo/.claude/settings.local.json"
 * ```
 *
 * @effects Requires `Path.Path` to join the project-relative path without accessing the filesystem.
 * @category configuration
 * @since 0.0.0
 */
export const localSettingsPath = (cwd: string): Effect.Effect<string, never, Path.Path> =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    return path.join(cwd, ".claude", "settings.local.json");
  });

const managedRoots = (options: LoadOptions): ReadonlyArray<string> =>
  options.managedSettingsRoots.pipe(
    O.orElse(() => O.map(options.managedSettingsRoot, A.make)),
    O.getOrElse(() => defaultManagedSettingsRoots)
  );

const managedSettingsSourcePaths = (
  options: LoadOptions
): Effect.Effect<ReadonlyArray<string>, SettingsReadError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const perRoot = yield* Effect.forEach(
      managedRoots(options),
      (root) =>
        Effect.gen(function* () {
          const basePath = path.join(root, "managed-settings.json");
          const dropInDir = path.join(root, "managed-settings.d");
          const entries = yield* readDirectoryIfExists(dropInDir);
          const dropIns = A.map(
            A.sort(
              A.filter(entries, (entry) => !Str.startsWith(".")(entry) && Str.endsWith(".json")(entry)),
              Order.String
            ),
            (entry) => path.join(dropInDir, entry)
          );
          return [basePath, ...dropIns];
        }),
      { concurrency: 1 }
    );
    return A.flatten(perRoot);
  });

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

const loadWithOptions = Effect.fn("Settings.load")(function* (cwd: string, options: LoadOptions) {
  yield* Effect.annotateCurrentSpan("settings.cwd", cwd);
  yield* Effect.logDebug("loading Claude Code settings").pipe(Effect.annotateLogs({ cwd }));

  const userPath = yield* userSettingsPath;
  const projectPath = yield* projectSettingsPath(cwd);
  const localPath = yield* localSettingsPath(cwd);
  const managedPaths = yield* managedSettingsSourcePaths(options);
  const sourcePaths = [
    userPath,
    projectPath,
    localPath,
    ...(O.isSome(options.settingsPath) ? [options.settingsPath.value] : []),
    ...managedPaths,
  ];
  const sources = yield* Effect.forEach(sourcePaths, readOptionalFile, {
    concurrency: 1,
  });
  const decoded = yield* Effect.forEach(
    sources,
    (source) =>
      O.match(source.content, {
        onNone: () => Effect.succeed(O.none<SettingsRaw>()),
        onSome: (content) => decodeSettingsSource(source.path, content).pipe(Effect.asSome),
      }),
    { concurrency: 1 }
  );
  const raw = A.reduce(decoded, {} as SettingsRaw, (accumulator, source) =>
    O.match(source, {
      onNone: () => accumulator,
      onSome: (value) => mergeSettingsRaw(accumulator, value),
    })
  );
  return yield* materializeSettings(raw);
});

/**
 * Load and merge Claude Code settings for a working directory.
 *
 * **Details**
 *
 * Priority is user, project, local, optional `--settings`, then managed
 * settings. Files that do not exist are skipped. Malformed JSON and invalid
 * known settings fail with path-aware typed errors.
 *
 * **Gotchas**
 *
 * `managedSettingsRoots` replaces the default managed roots
 * (`/Library/Application Support/ClaudeCode`, `/etc/claude-code`,
 * `C:\Program Files\ClaudeCode`) and ignores `managedSettingsRoot`.
 * Passing both fields is not "root plus extras": the array replaces
 * everything. `managedSettingsRoot` is consulted only when
 * `managedSettingsRoots` is absent.
 *
 * **Example** (Load effective settings)
 *
 * ```ts
 * import { ClaudeRuntime, Settings } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const program = Settings.load("/tmp/example-project").pipe(
 *   Effect.provide(ClaudeRuntime.baseLayer)
 * )
 *
 * Effect.runPromise(program).then((settings) => console.log(settings))
 * ```
 *
 * @effects Reads available settings files in precedence order and resolves configuration and paths through the supplied services.
 * @category configuration
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- The required cwd plus optional load options make a one-argument direct call indistinguishable from a curried overload.
export const load = (
  cwd: string,
  options?: LoadOptions.Encoded
): Effect.Effect<
  SettingsFile,
  Config.ConfigError | SettingsReadError | SettingsParseError | SettingsDecodeError,
  FileSystem.FileSystem | Path.Path
> =>
  loadWithOptions(
    cwd,
    LoadOptions.make({
      settingsPath: O.fromNullishOr(options?.settingsPath),
      managedSettingsRoot: O.fromNullishOr(options?.managedSettingsRoot),
      managedSettingsRoots: O.fromNullishOr(options?.managedSettingsRoots),
    })
  );
