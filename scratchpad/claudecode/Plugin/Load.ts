/**
 * Plugin directory scanning and loading.
 *
 * **Details**
 *
 * Complements `Plugin.write` with the inverse operations for existing plugin
 * directories: `scan` inspects canonical component locations and infers a
 * normalized manifest, `load` parses the discovered files into a typed
 * `PluginDefinition`, and `sync` preserves explicit layout choices while
 * filling in the default paths that `Plugin.write` uses when a manifest field
 * is omitted.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { Effect, FileSystem, Order, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { PluginLoadError } from "../Errors.ts";
import { parseCommandFile, parseOutputStyleFile, parseSkillFile, parseSubagentFile } from "../Frontmatter.ts";
import { loadJson as loadMcpJson, McpJsonFile } from "../Mcp.ts";
import { HooksSection } from "../Settings/HooksSection.ts";
import {
  define,
  type PluginAgentEntry,
  type PluginCommandEntry,
  PluginDefinition,
  type PluginOutputStyleEntry,
  type PluginSkillEntry,
} from "./Define.ts";
import { isJsonFilePath, isMarkdownFilePath, isSkillFilePath, pathSpecs, syncManifest } from "./Layout.ts";
import { ExperimentalSpec, PluginManifest } from "./Manifest.ts";

const $I = $ScratchpadId.create("claudecode/Plugin/Load");

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

/**
 * Paths discovered during a plugin directory scan.
 *
 * **Example** (Name a scan result)
 *
 * ```ts
 * import type { Plugin } from "effect-claudecode"
 *
 * type Scan = Plugin.PluginScan
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PluginScan extends S.Class<PluginScan>($I`PluginScan`)(
  {
    rootDir: S.String,
    manifestPath: S.Option(S.String),
    sourceManifest: S.Option(PluginManifest),
    commandPaths: S.Array(S.String),
    agentPaths: S.Array(S.String),
    skillPaths: S.Array(S.String),
    outputStylePaths: S.Array(S.String),
    hooksPaths: S.Array(S.String),
    inlineHooksConfig: S.Option(HooksSection),
    mcpPaths: S.Array(S.String),
    inlineMcpConfig: S.Option(McpJsonFile),
    lspPaths: S.Array(S.String),
    themePaths: S.Array(S.String),
    monitorPaths: S.Array(S.String),
    binPaths: S.Array(S.String),
    settingsPath: S.Option(S.String),
    inferredManifest: PluginManifest,
  },
  $I.annote("PluginScan", {
    description: "Normalized paths and optional inline configuration discovered during a plugin directory scan.",
  })
) {}

/**
 * A fully loaded plugin directory.
 *
 * **Example** (Name a loaded plugin)
 *
 * ```ts
 * import type { Plugin } from "effect-claudecode"
 *
 * type Loaded = Plugin.LoadedPlugin
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LoadedPlugin extends S.Class<LoadedPlugin>($I`LoadedPlugin`)(
  {
    ...PluginDefinition.fields,
    rootDir: S.String,
    sourceManifest: S.Option(PluginManifest),
    inferredManifest: PluginManifest,
  },
  $I.annote("LoadedPlugin", {
    description: "Validated plugin definition paired with its source root and manifest provenance.",
  })
) {}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const manifestFileName = "plugin.json";
const sortStrings = Order.String;

const listSorted = (paths: ReadonlyArray<string>): ReadonlyArray<string> => A.sort(paths, sortStrings);

const readOptionalStringFile = (
  path: string
): Effect.Effect<O.Option<string>, PluginLoadError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const exists = yield* fs.exists(path).pipe(Effect.mapError((cause) => PluginLoadError.make({ path, cause })));
    if (!exists) {
      return O.none();
    }
    const content = yield* fs
      .readFileString(path)
      .pipe(Effect.mapError((cause) => PluginLoadError.make({ path, cause })));
    return O.some(content);
  });

const readOptionalManifest = (
  path: string
): Effect.Effect<O.Option<PluginManifest>, PluginLoadError, FileSystem.FileSystem> =>
  readOptionalStringFile(path).pipe(
    Effect.flatMap((maybeContent) =>
      O.isNone(maybeContent)
        ? Effect.succeedNone
        : S.decodeEffect(PluginManifestJson)(maybeContent.value).pipe(
            Effect.asSome,
            Effect.mapError((cause) => PluginLoadError.make({ path, cause }))
          )
    )
  );

class HooksFile extends S.Class<HooksFile>($I`HooksFile`)(
  { hooks: HooksSection },
  $I.annote("HooksFile", {
    description: "A documented plugin hooks file wrapping its hook section.",
  })
) {}

const PluginManifestJson = S.fromJsonString(PluginManifest).pipe(
  $I.annoteSchema("PluginManifestJson", {
    description: "JSON text codec for a Claude Code plugin manifest.",
  })
);

const HooksFileJson = S.fromJsonString(HooksFile).pipe(
  $I.annoteSchema("HooksFileJson", {
    description: "JSON text codec for a Claude Code hooks file.",
  })
);

const missingDeclaredPath = (path: string): PluginLoadError =>
  PluginLoadError.make({
    path,
    cause: "Declared manifest path does not exist",
  });

const readStringFile = (path: string): Effect.Effect<string, PluginLoadError, FileSystem.FileSystem> =>
  readOptionalStringFile(path).pipe(
    Effect.flatMap((maybeContent) =>
      Effect.fromOption(maybeContent, () => missingDeclaredPath(path))
    )
  );

const readHooksFile = (path: string): Effect.Effect<HooksSection, PluginLoadError, FileSystem.FileSystem> =>
  readStringFile(path).pipe(
    Effect.flatMap((content) =>
      S.decodeEffect(HooksFileJson)(content).pipe(
        Effect.map((file) => file.hooks),
        Effect.mapError((cause) => PluginLoadError.make({ path, cause }))
      )
    )
  );

const readMcpFile = (path: string): Effect.Effect<McpJsonFile, PluginLoadError, FileSystem.FileSystem> =>
  loadMcpJson(path).pipe(Effect.mapError((cause) => PluginLoadError.make({ path, cause })));

const readDirectoryIfExists = (
  dirPath: string
): Effect.Effect<ReadonlyArray<string>, PluginLoadError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const exists = yield* fs
      .exists(dirPath)
      .pipe(Effect.mapError((cause) => PluginLoadError.make({ path: dirPath, cause })));
    if (!exists) {
      return [];
    }
    const entries = yield* fs
      .readDirectory(dirPath)
      .pipe(Effect.mapError((cause) => PluginLoadError.make({ path: dirPath, cause })));
    return listSorted(entries);
  });

const requireExistingPath = (path: string): Effect.Effect<void, PluginLoadError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const exists = yield* fs.exists(path).pipe(Effect.mapError((cause) => PluginLoadError.make({ path, cause })));
    if (!exists) {
      return yield* missingDeclaredPath(path);
    }
  });

const markdownFilePaths = (dirPath: string, entries: ReadonlyArray<string>, path: Path.Path): ReadonlyArray<string> =>
  listSorted(A.map(A.filter(entries, Str.endsWith(".md")), (entry) => path.join(dirPath, entry)));

const jsonFilePaths = (dirPath: string, entries: ReadonlyArray<string>, path: Path.Path): ReadonlyArray<string> =>
  listSorted(A.map(A.filter(entries, Str.endsWith(".json")), (entry) => path.join(dirPath, entry)));

const filePathIfExists = (filePath: string): Effect.Effect<O.Option<string>, PluginLoadError, FileSystem.FileSystem> =>
  readOptionalStringFile(filePath).pipe(
    Effect.map((maybeContent) => (O.isSome(maybeContent) ? O.some(filePath) : O.none()))
  );

const relativeManifestPaths = (spec: O.Option<string | ReadonlyArray<string>>): ReadonlyArray<string> =>
  pathSpecs(spec);

const expandMarkdownPathSpec = (options: {
  readonly rootDir: string;
  readonly spec: O.Option<string | ReadonlyArray<string>>;
  readonly fallbackDir: string;
}): Effect.Effect<ReadonlyArray<string>, PluginLoadError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const declared = relativeManifestPaths(options.spec);
    if (declared.length === 0) {
      const dirPath = path.join(options.rootDir, options.fallbackDir);
      const entries = yield* readDirectoryIfExists(dirPath);
      return markdownFilePaths(dirPath, entries, path);
    }

    const resolved = yield* Effect.forEach(
      declared,
      (relativePath) =>
        Effect.gen(function* () {
          const absolutePath = path.join(options.rootDir, relativePath);
          yield* requireExistingPath(absolutePath);
          if (isMarkdownFilePath(relativePath)) {
            return [absolutePath];
          }
          const entries = yield* readDirectoryIfExists(absolutePath);
          return markdownFilePaths(absolutePath, entries, path);
        }),
      { concurrency: 1 }
    );

    return listSorted(resolved.flat());
  });

const expandSkillPathSpec = (options: {
  readonly rootDir: string;
  readonly spec: O.Option<string | ReadonlyArray<string>>;
  readonly fallbackDir: string;
}): Effect.Effect<ReadonlyArray<string>, PluginLoadError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const declared = relativeManifestPaths(options.spec);
    const defaultDirPath = path.join(options.rootDir, options.fallbackDir);
    const defaultEntries = yield* readDirectoryIfExists(defaultDirPath);
    const defaultDiscovered = yield* Effect.forEach(
      defaultEntries,
      (entry) =>
        Effect.gen(function* () {
          const skillPath = path.join(defaultDirPath, entry, "SKILL.md");
          const exists = yield* fs
            .exists(skillPath)
            .pipe(Effect.mapError((cause) => PluginLoadError.make({ path: skillPath, cause })));
          return exists ? O.some(skillPath) : O.none<string>();
        }),
      { concurrency: 1 }
    );
    const defaultSkillPaths = A.getSomes(defaultDiscovered);

    if (declared.length === 0) {
      if (defaultSkillPaths.length > 0) {
        return listSorted(defaultSkillPaths);
      }
      const rootSkill = path.join(options.rootDir, "SKILL.md");
      const rootSkillExists = yield* fs
        .exists(rootSkill)
        .pipe(Effect.mapError((cause) => PluginLoadError.make({ path: rootSkill, cause })));
      return rootSkillExists ? [rootSkill] : [];
    }

    const resolved = yield* Effect.forEach(
      declared,
      (relativePath) =>
        Effect.gen(function* () {
          const absolutePath = path.join(options.rootDir, relativePath);
          yield* requireExistingPath(absolutePath);
          if (isSkillFilePath(relativePath)) {
            return [absolutePath];
          }
          const entries = yield* readDirectoryIfExists(absolutePath);
          const directSkill = path.join(absolutePath, "SKILL.md");
          const directExists = yield* fs
            .exists(directSkill)
            .pipe(Effect.mapError((cause) => PluginLoadError.make({ path: directSkill, cause })));
          const nestedSkills = yield* Effect.forEach(
            entries,
            (entry) =>
              Effect.gen(function* () {
                const nestedSkill = path.join(absolutePath, entry, "SKILL.md");
                const exists = yield* fs
                  .exists(nestedSkill)
                  .pipe(Effect.mapError((cause) => PluginLoadError.make({ path: nestedSkill, cause })));
                return exists ? O.some(nestedSkill) : O.none<string>();
              }),
            { concurrency: 1 }
          );
          return listSorted([...(directExists ? [directSkill] : []), ...A.getSomes(nestedSkills)]);
        }),
      { concurrency: 1 }
    );

    return listSorted(A.dedupe([...defaultSkillPaths, ...resolved.flat()]));
  });

const expandJsonPathSpec = (options: {
  readonly rootDir: string;
  readonly spec: O.Option<string | ReadonlyArray<string>>;
  readonly fallbackPath: string;
}): Effect.Effect<ReadonlyArray<string>, PluginLoadError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const declared = relativeManifestPaths(options.spec);
    if (declared.length === 0) {
      const fallback = path.join(options.rootDir, options.fallbackPath);
      const maybeContent = yield* readOptionalStringFile(fallback);
      return O.isSome(maybeContent) ? [fallback] : [];
    }

    return yield* Effect.forEach(
      declared,
      (relativePath) =>
        Effect.gen(function* () {
          const absolutePath = path.join(options.rootDir, relativePath);
          yield* requireExistingPath(absolutePath);
          if (!isJsonFilePath(relativePath)) {
            return yield* PluginLoadError.make({
              path: absolutePath,
              cause: "Manifest JSON config path must point to a file",
            });
          }
          return absolutePath;
        }),
      { concurrency: 1 }
    );
  });

const expandJsonFilePathSpec = (options: {
  readonly rootDir: string;
  readonly spec: O.Option<string | ReadonlyArray<string>>;
  readonly fallbackDir: string;
}): Effect.Effect<ReadonlyArray<string>, PluginLoadError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const declared = relativeManifestPaths(options.spec);
    if (declared.length === 0) {
      const dirPath = path.join(options.rootDir, options.fallbackDir);
      const entries = yield* readDirectoryIfExists(dirPath);
      return jsonFilePaths(dirPath, entries, path);
    }

    const resolved = yield* Effect.forEach(
      declared,
      (relativePath) =>
        Effect.gen(function* () {
          const absolutePath = path.join(options.rootDir, relativePath);
          yield* requireExistingPath(absolutePath);
          if (isJsonFilePath(relativePath)) {
            return [absolutePath];
          }
          const entries = yield* readDirectoryIfExists(absolutePath);
          return jsonFilePaths(absolutePath, entries, path);
        }),
      { concurrency: 1 }
    );

    return listSorted(resolved.flat());
  });

const isPathSpec = (input: unknown): input is string | ReadonlyArray<string> =>
  P.isString(input) || (A.isArray(input) && A.every(input, P.isString));

const inlineHooksConfigFromManifest = (manifest: O.Option<PluginManifest>): O.Option<HooksSection> =>
  O.flatMap(manifest, ({ hooks }) => O.filter(hooks, S.is(HooksSection)));

const inlineMcpSpecFromManifest = (manifest: O.Option<PluginManifest>): O.Option<R.ReadonlyRecord<string, unknown>> =>
  O.flatMap(manifest, ({ mcpServers }) =>
    O.flatMap(mcpServers, (spec) => (isPathSpec(spec) ? O.none() : O.some(R.fromEntries(R.toEntries(spec)))))
  );

const inferredManifest = (input: {
  readonly pluginName: string;
  readonly sourceManifest: O.Option<PluginManifest>;
  readonly commandsSpec: PluginManifest["commands"];
  readonly agentsSpec: PluginManifest["agents"];
  readonly skillsSpec: PluginManifest["skills"];
  readonly outputStylesSpec: PluginManifest["outputStyles"];
  readonly hooksSpec: PluginManifest["hooks"];
  readonly mcpSpec: PluginManifest["mcpServers"];
  readonly lspSpec: PluginManifest["lspServers"];
  readonly themeSpec: ExperimentalSpec["themes"];
  readonly monitorSpec: ExperimentalSpec["monitors"];
  readonly commandCount: number;
  readonly agentCount: number;
  readonly skillCount: number;
  readonly outputStyleCount: number;
  readonly hasHooks: boolean;
  readonly hasMcp: boolean;
  readonly hasLsp: boolean;
  readonly hasThemes: boolean;
  readonly hasMonitors: boolean;
}): PluginManifest => {
  const source = O.getOrElse(input.sourceManifest, () => PluginManifest.make({ name: input.pluginName }));
  const sourceExperimental = O.getOrElse(source.experimental, () => ExperimentalSpec.make({}));

  const inferredExperimental =
    input.hasThemes || input.hasMonitors
      ? O.some(
          ExperimentalSpec.make({
            themes: input.hasThemes ? O.orElse(input.themeSpec, () => O.some("themes")) : sourceExperimental.themes,
            monitors: input.hasMonitors
              ? O.orElse(input.monitorSpec, () => O.some("monitors/monitors.json"))
              : sourceExperimental.monitors,
          })
        )
      : source.experimental;

  return PluginManifest.make({
    name: source.name,
    $schema: source.$schema,
    version: source.version,
    description: source.description,
    displayName: source.displayName,
    defaultEnabled: source.defaultEnabled,
    author: source.author,
    homepage: source.homepage,
    repository: source.repository,
    license: source.license,
    keywords: source.keywords,
    dependencies: source.dependencies,
    experimental: inferredExperimental,
    userConfig: source.userConfig,
    channels: source.channels,
    commands: input.commandCount > 0 ? O.orElse(input.commandsSpec, () => O.some("commands")) : O.none(),
    agents: input.agentCount > 0 ? O.orElse(input.agentsSpec, () => O.some("agents")) : O.none(),
    skills: input.skillCount > 0 ? O.orElse(input.skillsSpec, () => O.some("skills")) : O.none(),
    outputStyles:
      input.outputStyleCount > 0 ? O.orElse(input.outputStylesSpec, () => O.some("output-styles")) : O.none(),
    hooks: input.hasHooks ? O.orElse(input.hooksSpec, () => O.some("hooks/hooks.json")) : O.none(),
    mcpServers: input.hasMcp ? O.orElse(input.mcpSpec, () => O.some(".mcp.json")) : O.none(),
    lspServers: input.hasLsp ? O.orElse(input.lspSpec, () => O.some(".lsp.json")) : O.none(),
  });
};

const toPluginConfig = (input: {
  readonly manifest: PluginManifest;
  readonly commands: ReadonlyArray<PluginCommandEntry>;
  readonly agents: ReadonlyArray<PluginAgentEntry>;
  readonly skills: ReadonlyArray<PluginSkillEntry>;
  readonly outputStyles: ReadonlyArray<PluginOutputStyleEntry>;
  readonly hooksConfig: O.Option<HooksSection>;
  readonly mcpConfig: O.Option<McpJsonFile>;
}) => ({
  manifest: input.manifest,
  commands: input.commands,
  agents: input.agents,
  skills: input.skills,
  outputStyles: input.outputStyles,
  ...(O.isSome(input.hooksConfig) ? { hooksConfig: S.encodeSync(HooksSection)(input.hooksConfig.value) } : {}),
  ...(O.isSome(input.mcpConfig) ? { mcpConfig: S.encodeSync(McpJsonFile)(input.mcpConfig.value) } : {}),
});

const loadCommandEntries = (
  rootDir: string,
  paths: ReadonlyArray<string>
): Effect.Effect<ReadonlyArray<PluginCommandEntry>, PluginLoadError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    return yield* Effect.forEach(
      paths,
      (filePath) =>
        parseCommandFile(filePath).pipe(
          Effect.map((parsed) => ({
            name: path.basename(filePath, ".md"),
            path: path.relative(rootDir, filePath),
            frontmatter: parsed.frontmatter,
            body: parsed.body,
          })),
          Effect.mapError((cause) => PluginLoadError.make({ path: filePath, cause }))
        ),
      { concurrency: 1 }
    );
  });

const loadAgentEntries = (
  rootDir: string,
  paths: ReadonlyArray<string>
): Effect.Effect<ReadonlyArray<PluginAgentEntry>, PluginLoadError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    return yield* Effect.forEach(
      paths,
      (filePath) =>
        parseSubagentFile(filePath).pipe(
          Effect.map((parsed) => ({
            name: parsed.frontmatter.name,
            path: path.relative(rootDir, filePath),
            frontmatter: parsed.frontmatter,
            body: parsed.body,
          })),
          Effect.mapError((cause) => PluginLoadError.make({ path: filePath, cause }))
        ),
      { concurrency: 1 }
    );
  });

const loadSkillEntries = (
  rootDir: string,
  paths: ReadonlyArray<string>
): Effect.Effect<ReadonlyArray<PluginSkillEntry>, PluginLoadError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    return yield* Effect.forEach(
      paths,
      (filePath) =>
        parseSkillFile(filePath).pipe(
          Effect.map((parsed) => ({
            name: O.getOrElse(parsed.frontmatter.name, () => path.basename(path.dirname(filePath))),
            path: path.relative(rootDir, filePath),
            frontmatter: parsed.frontmatter,
            body: parsed.body,
          })),
          Effect.mapError((cause) => PluginLoadError.make({ path: filePath, cause }))
        ),
      { concurrency: 1 }
    );
  });

const loadOutputStyleEntries = (
  rootDir: string,
  paths: ReadonlyArray<string>
): Effect.Effect<ReadonlyArray<PluginOutputStyleEntry>, PluginLoadError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    return yield* Effect.forEach(
      paths,
      (filePath) =>
        parseOutputStyleFile(filePath).pipe(
          Effect.map((parsed) => ({
            name: O.getOrElse(parsed.frontmatter.name, () => path.basename(filePath, ".md")),
            path: path.relative(rootDir, filePath),
            frontmatter: parsed.frontmatter,
            body: parsed.body,
          })),
          Effect.mapError((cause) => PluginLoadError.make({ path: filePath, cause }))
        ),
      { concurrency: 1 }
    );
  });

const mergeHooksConfigs = (configs: ReadonlyArray<HooksSection>): HooksSection => {
  const merged: Record<string, Array<unknown>> = {};
  for (const config of configs) {
    for (const [eventName, groups] of R.toEntries(config)) {
      merged[eventName] = [...(merged[eventName] ?? []), ...groups];
    }
  }
  return S.decodeUnknownSync(HooksSection)(merged);
};

const mergeMcpConfigs = (configs: ReadonlyArray<McpJsonFile>): McpJsonFile =>
  McpJsonFile.make({
    mcpServers: R.fromEntries(A.flatMap(configs, (config) => R.toEntries(config.mcpServers))),
  });

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Inspect a plugin directory and infer the canonical manifest paths for the
 * discovered component files.
 *
 * **Example** (Scan a plugin written in memory)
 *
 * ```ts
 * import { Plugin, Testing } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const definition = Plugin.define({
 *   manifest: { name: "review-tools" },
 *   commands: [Plugin.command({ name: "hi", body: "# /hi\n" })]
 * })
 * const fileSystem = await Effect.runPromise(Testing.writePluginToMemory(definition))
 * const scanned = await Effect.runPromise(
 *   Effect.provide(Plugin.scan("/plugin"), fileSystem.layer)
 * )
 *
 * console.log(scanned.inferredManifest.name) // "review-tools"
 * console.log(O.isSome(scanned.manifestPath)) // true
 * console.log(scanned.commandPaths) // ["/plugin/commands/hi.md"]
 * ```
 *
 * @effects Reads the plugin manifest and component directories through `FileSystem.FileSystem` and resolves paths with `Path.Path`.
 * @category decoding
 * @since 0.0.0
 */
export const scan = Effect.fn("Plugin.scan")(function* (
  rootDir: string
): Effect.fn.Return<PluginScan, PluginLoadError, FileSystem.FileSystem | Path.Path> {
  yield* Effect.annotateCurrentSpan("plugin.rootDir", rootDir);
  const path = yield* Path.Path;
  const manifestPath = path.join(rootDir, ".claude-plugin", manifestFileName);

  const sourceManifest = yield* readOptionalManifest(manifestPath);
  const componentSpec = (
    select: (manifest: PluginManifest) => O.Option<string | ReadonlyArray<string>>
  ): O.Option<string | ReadonlyArray<string>> => O.flatMap(sourceManifest, select);
  const commandSpec = componentSpec((manifest) => manifest.commands);
  const agentSpec = componentSpec((manifest) => manifest.agents);
  const skillSpec = componentSpec((manifest) => manifest.skills);
  const outputStyleSpec = componentSpec((manifest) => manifest.outputStyles);
  const commandPaths = yield* expandMarkdownPathSpec({
    rootDir,
    spec: commandSpec,
    fallbackDir: "commands",
  });
  const agentPaths = yield* expandMarkdownPathSpec({
    rootDir,
    spec: agentSpec,
    fallbackDir: "agents",
  });
  const skillPaths = yield* expandSkillPathSpec({
    rootDir,
    spec: skillSpec,
    fallbackDir: "skills",
  });
  const outputStylePaths = yield* expandMarkdownPathSpec({
    rootDir,
    spec: outputStyleSpec,
    fallbackDir: "output-styles",
  });

  const hooksSpec = O.flatMap(sourceManifest, (manifest) => manifest.hooks);
  const hooksPathSpec = O.filter(hooksSpec, isPathSpec);
  const inlineHooksConfig = inlineHooksConfigFromManifest(sourceManifest);
  const hooksPaths = O.isSome(inlineHooksConfig)
    ? A.empty<string>()
    : yield* expandJsonPathSpec({
        rootDir,
        spec: hooksPathSpec,
        fallbackPath: "hooks/hooks.json",
      });

  const mcpSpec = O.flatMap(sourceManifest, (manifest) => manifest.mcpServers);
  const mcpPathSpec = O.filter(mcpSpec, isPathSpec);
  const inlineMcpSpec = inlineMcpSpecFromManifest(sourceManifest);
  const inlineMcpConfig = O.isSome(inlineMcpSpec)
    ? O.some(
        yield* S.decodeUnknownEffect(McpJsonFile)({
          mcpServers: inlineMcpSpec.value,
        }).pipe(Effect.mapError((cause) => PluginLoadError.make({ path: manifestPath, cause })))
      )
    : O.none<McpJsonFile>();
  const mcpPaths = O.isSome(inlineMcpConfig)
    ? A.empty<string>()
    : yield* expandJsonPathSpec({
        rootDir,
        spec: mcpPathSpec,
        fallbackPath: ".mcp.json",
      });

  const lspSpec = O.flatMap(sourceManifest, (manifest) => manifest.lspServers);
  const lspPaths = O.exists(lspSpec, (spec) => !isPathSpec(spec))
    ? A.empty<string>()
    : yield* expandJsonPathSpec({
        rootDir,
        spec: O.filter(lspSpec, isPathSpec),
        fallbackPath: ".lsp.json",
      });
  const experimental = O.flatMap(sourceManifest, (manifest) => manifest.experimental);
  const themeSpec = O.flatMap(experimental, (experimentalSpec) => experimentalSpec.themes);
  const monitorSpec = O.flatMap(experimental, (experimentalSpec) => experimentalSpec.monitors);
  const themePaths = yield* expandJsonFilePathSpec({
    rootDir,
    spec: themeSpec,
    fallbackDir: "themes",
  });
  const monitorPaths = yield* expandJsonPathSpec({
    rootDir,
    spec: monitorSpec,
    fallbackPath: "monitors/monitors.json",
  });
  const binEntries = yield* readDirectoryIfExists(path.join(rootDir, "bin"));
  const binPaths = A.map(binEntries, (entry) => path.join(rootDir, "bin", entry));
  const settingsPath = yield* filePathIfExists(path.join(rootDir, "settings.json"));
  const pluginName = O.match(sourceManifest, {
    onNone: () => path.basename(rootDir),
    onSome: (manifest) => manifest.name,
  });

  return PluginScan.make({
    rootDir,
    manifestPath: O.isSome(sourceManifest) ? O.some(manifestPath) : O.none(),
    sourceManifest,
    commandPaths,
    agentPaths,
    skillPaths,
    outputStylePaths,
    hooksPaths,
    inlineHooksConfig,
    mcpPaths,
    inlineMcpConfig,
    lspPaths,
    themePaths,
    monitorPaths,
    binPaths,
    settingsPath,
    inferredManifest: inferredManifest({
      pluginName,
      sourceManifest,
      commandsSpec: commandSpec,
      agentsSpec: agentSpec,
      skillsSpec: skillSpec,
      outputStylesSpec: outputStyleSpec,
      hooksSpec,
      mcpSpec,
      lspSpec,
      themeSpec,
      monitorSpec,
      commandCount: A.length(commandPaths),
      agentCount: A.length(agentPaths),
      skillCount: A.length(skillPaths),
      outputStyleCount: A.length(outputStylePaths),
      hasHooks: O.isSome(inlineHooksConfig) || A.isReadonlyArrayNonEmpty(hooksPaths),
      hasMcp: O.isSome(inlineMcpConfig) || A.isReadonlyArrayNonEmpty(mcpPaths),
      hasLsp: O.exists(lspSpec, (spec) => !isPathSpec(spec)) || A.isReadonlyArrayNonEmpty(lspPaths),
      hasThemes: A.isReadonlyArrayNonEmpty(themePaths),
      hasMonitors: A.isReadonlyArrayNonEmpty(monitorPaths),
    }),
  });
});

/**
 * Load an existing plugin directory into a typed `PluginDefinition`.
 *
 * **Example** (Load a plugin written in memory)
 *
 * ```ts
 * import { Plugin, Testing } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const definition = Plugin.define({
 *   manifest: { name: "review-tools" },
 *   commands: [Plugin.command({ name: "hi", body: "# /hi\n" })]
 * })
 * const fileSystem = await Effect.runPromise(Testing.writePluginToMemory(definition))
 * const loaded = await Effect.runPromise(
 *   Effect.provide(Plugin.load("/plugin"), fileSystem.layer)
 * )
 *
 * console.log(loaded.manifest.name) // "review-tools"
 * console.log(loaded.commands.length) // 1
 * console.log(loaded.skills.length) // 0
 * ```
 *
 * @effects Reads and decodes the plugin manifest and referenced components through `FileSystem.FileSystem` and `Path.Path`.
 * @category decoding
 * @since 0.0.0
 */
export const load = Effect.fn("Plugin.load")(function* (
  rootDir: string
): Effect.fn.Return<LoadedPlugin, PluginLoadError, FileSystem.FileSystem | Path.Path> {
  const scanned = yield* scan(rootDir);
  const commands = yield* loadCommandEntries(rootDir, scanned.commandPaths);
  const agents = yield* loadAgentEntries(rootDir, scanned.agentPaths);
  const skills = yield* loadSkillEntries(rootDir, scanned.skillPaths);
  const outputStyles = yield* loadOutputStyleEntries(rootDir, scanned.outputStylePaths);
  const hooksConfig = yield* O.match(scanned.inlineHooksConfig, {
    onSome: (config) => Effect.succeedSome(config),
    onNone: () =>
      A.isReadonlyArrayEmpty(scanned.hooksPaths)
        ? Effect.succeed(O.none<HooksSection>())
        : Effect.forEach(scanned.hooksPaths, readHooksFile, {
            concurrency: 1,
          }).pipe(Effect.map((configs) => O.some(mergeHooksConfigs(configs)))),
  });
  const mcpConfig = yield* O.match(scanned.inlineMcpConfig, {
    onSome: (config) => Effect.succeedSome(config),
    onNone: () =>
      A.isReadonlyArrayEmpty(scanned.mcpPaths)
        ? Effect.succeed(O.none<McpJsonFile>())
        : Effect.forEach(scanned.mcpPaths, readMcpFile, {
            concurrency: 1,
          }).pipe(Effect.map((configs) => O.some(mergeMcpConfigs(configs)))),
  });

  const definition = define(
    toPluginConfig({
      manifest: scanned.inferredManifest,
      commands,
      agents,
      skills,
      outputStyles,
      hooksConfig,
      mcpConfig,
    })
  );

  return LoadedPlugin.make({
    ...definition,
    rootDir,
    sourceManifest: scanned.sourceManifest,
    inferredManifest: scanned.inferredManifest,
  });
});

/**
 * Normalize a plugin definition's manifest by preserving explicit layout
 * choices and filling in default paths for missing component/config entries.
 *
 * **Example** (Preserve custom command paths and collapse multi-file hooks)
 *
 * ```ts
 * import { Plugin } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const normalized = Plugin.sync(
 *   Plugin.define({
 *     manifest: {
 *       name: "review-tools",
 *       commands: "./slash",
 *       hooks: ["./hooks/a.json", "./hooks/b.json"]
 *     },
 *     commands: [Plugin.command({ name: "hi", body: "# /hi\n" })],
 *     hooksConfig: { PostToolUse: [] }
 *   })
 * )
 *
 * console.log(O.getOrUndefined(normalized.manifest.commands)) // "./slash"
 * console.log(O.getOrUndefined(normalized.manifest.hooks)) // "./hooks/hooks.json"
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const sync = (definition: PluginDefinition | LoadedPlugin): PluginDefinition =>
  define(
    toPluginConfig({
      manifest: syncManifest(definition),
      commands: definition.commands,
      agents: definition.agents,
      skills: definition.skills,
      outputStyles: definition.outputStyles,
      hooksConfig: definition.hooksConfig,
      mcpConfig: definition.mcpConfig,
    })
  );
