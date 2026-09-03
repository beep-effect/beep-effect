/**
 * `Plugin.define` + `Plugin.write` — the ergonomic builder for
 * Claude Code plugins.
 *
 * **Details**
 *
 * `Plugin.define` validates a plugin manifest and bundles it with the
 * component files (commands, agents, skills, output styles) plus
 * optional hooks/MCP inline configs. `Plugin.write` materializes a
 * definition to a destination directory via the injected `FileSystem`
 * and `Path` services. When the manifest and entries do not override paths,
 * it produces the default directory layout:
 *
 * ```text
 * destDir/
 * ├── .claude-plugin/
 * │   └── plugin.json
 * ├── commands/<name>.md
 * ├── agents/<name>.md
 * ├── skills/<name>/SKILL.md
 * ├── output-styles/<name>.md
 * ├── hooks/hooks.json          (if hooksConfig provided)
 * ├── .mcp.json                 (if mcpConfig provided)
 * ├── .lsp.json                 (preserved when loaded from disk)
 * ├── themes/                   (preserved when loaded from disk)
 * ├── monitors/                 (preserved when loaded from disk)
 * ├── bin/                      (preserved when loaded from disk)
 * └── settings.json             (preserved when loaded from disk)
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import { Effect, FileSystem, Path } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { PluginDefinitionError, PluginWriteError } from "../Errors.ts";
import {
  CommandFrontmatter,
  OutputStyleFrontmatter,
  renderCommand,
  renderOutputStyle,
  renderSkill,
  renderSubagent,
  SkillFrontmatter,
  SubagentFrontmatter,
} from "../Frontmatter.ts";
import { McpJsonFile, toClaudeCodeJson } from "../Mcp.ts";
import { HooksSection, type HooksSectionEncoded } from "../Settings/HooksSection.ts";
import {
  isJsonFilePath,
  isMarkdownFilePath,
  isSafePluginPath,
  isSkillFilePath,
  normalizeManifestPath,
  pathSpecs,
  syncManifest,
} from "./Layout.ts";
import { PluginManifest } from "./Manifest.ts";

const $I = $ScratchpadId.create("claudecode/Plugin/Define");

const isStringArray = (value: unknown): value is ReadonlyArray<string> =>
  A.isArray(value) && A.every(value, P.isString);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A typed slash-command entry to be written to `commands/<name>.md`.
 *
 * **Example** (Construct a command entry)
 *
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * const entry = Plugin.command({ name: "review", body: "Review the change." })
 * console.log(entry.name) // review
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PluginCommandEntry extends S.Class<PluginCommandEntry>($I`PluginCommandEntry`)(
  {
    name: S.String,
    path: S.String.pipe(S.optionalKey),
    frontmatter: CommandFrontmatter,
    body: S.String,
  },
  $I.annote("PluginCommandEntry", {
    description: "Slash-command content and frontmatter mapped to a plugin-relative path.",
  })
) {}

/**
 * A typed subagent entry to be written to `agents/<name>.md`.
 *
 * **Example** (Construct a subagent entry)
 *
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * const entry = Plugin.agent({
 *   name: "reviewer",
 *   description: "Reviews changes",
 *   body: "Review changes."
 * })
 * console.log(entry.frontmatter.name) // reviewer
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PluginAgentEntry extends S.Class<PluginAgentEntry>($I`PluginAgentEntry`)(
  {
    name: S.String,
    path: S.String.pipe(S.optionalKey),
    frontmatter: SubagentFrontmatter,
    body: S.String,
  },
  $I.annote("PluginAgentEntry", {
    description: "Subagent content and frontmatter mapped to a plugin-relative path.",
  })
) {}

/**
 * A typed skill entry to be written to `skills/<name>/SKILL.md`.
 *
 * **Example** (Construct a skill entry)
 *
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * const entry = Plugin.skill({ name: "review", body: "Review changes." })
 * console.log(entry.name) // review
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PluginSkillEntry extends S.Class<PluginSkillEntry>($I`PluginSkillEntry`)(
  {
    name: S.String,
    path: S.String.pipe(S.optionalKey),
    frontmatter: SkillFrontmatter,
    body: S.String,
  },
  $I.annote("PluginSkillEntry", {
    description: "Skill content and frontmatter mapped to a plugin-relative path.",
  })
) {}

/**
 * A typed output-style entry to be written to `output-styles/<name>.md`.
 *
 * **Example** (Construct an output-style entry)
 *
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * const entry = Plugin.outputStyle({ name: "concise", body: "Be concise." })
 * console.log(entry.name) // concise
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PluginOutputStyleEntry extends S.Class<PluginOutputStyleEntry>($I`PluginOutputStyleEntry`)(
  {
    name: S.String,
    path: S.String.pipe(S.optionalKey),
    frontmatter: OutputStyleFrontmatter,
    body: S.String,
  },
  $I.annote("PluginOutputStyleEntry", {
    description: "Output-style content and frontmatter mapped to a plugin-relative path.",
  })
) {}

/**
 * Encoded input accepted by {@link command}.
 *
 * @category configuration
 * @since 0.0.0
 */
export type PluginCommandConfig = CommandFrontmatter.Encoded & {
  readonly name: string;
  readonly path?: string;
  readonly body: string;
};

/**
 * Encoded input accepted by {@link agent}.
 *
 * @category configuration
 * @since 0.0.0
 */
export type PluginAgentConfig = Omit<SubagentFrontmatter.Encoded, "name"> & {
  readonly name: string;
  readonly path?: string;
  readonly body: string;
};

/**
 * Encoded input accepted by {@link skill}.
 *
 * @category configuration
 * @since 0.0.0
 */
export type PluginSkillConfig = Omit<SkillFrontmatter.Encoded, "name"> & {
  readonly name: string;
  readonly path?: string;
  readonly body: string;
};

/**
 * Encoded input accepted by {@link outputStyle}.
 *
 * @category configuration
 * @since 0.0.0
 */
export type PluginOutputStyleConfig = Omit<OutputStyleFrontmatter.Encoded, "name"> & {
  readonly name: string;
  readonly path?: string;
  readonly body: string;
};

/**
 * Config passed to `Plugin.define`. The `manifest` field accepts
 * either a `PluginManifest` instance or a plain object that satisfies
 * its constructor; the latter is validated on entry.
 *
 * **Example** (Describe a plugin definition input)
 *
 * ```ts
 * import { Plugin } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const config = S.decodeUnknownSync(Plugin.PluginConfig)({
 *   manifest: { name: "review-tools" },
 *   commands: [Plugin.command({ name: "review", body: "Review changes." })]
 * })
 * console.log(config.manifest)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const PluginConfig = S.Struct({
  manifest: S.Union([S.toType(PluginManifest), S.toEncoded(PluginManifest)]),
  commands: PluginCommandEntry.pipe(S.toType, S.Array, S.optionalKey),
  agents: PluginAgentEntry.pipe(S.toType, S.Array, S.optionalKey),
  skills: PluginSkillEntry.pipe(S.toType, S.Array, S.optionalKey),
  outputStyles: PluginOutputStyleEntry.pipe(S.toType, S.Array, S.optionalKey),
  hooksConfig: S.Union([S.toType(HooksSection), S.toEncoded(HooksSection)]).pipe(S.optionalKey),
  mcpConfig: S.Union([S.toType(McpJsonFile), S.toEncoded(McpJsonFile)]).pipe(S.optionalKey),
}).pipe(
  $I.annoteSchema("PluginConfig", {
    description: "Validated constructor input for a plugin manifest and its optional component definitions.",
  })
);

/**
 * Runtime type decoded by {@link PluginConfig}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PluginConfig = typeof PluginConfig.Type;

/**
 * The fully-formed plugin definition ready to be written. Components
 * default to empty arrays; optional config files default to `None`.
 *
 * **Example** (Define a minimal plugin)
 *
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * const definition = Plugin.define({ manifest: { name: "review-tools" } })
 * console.log(definition.commands.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PluginDefinition extends S.Class<PluginDefinition>($I`PluginDefinition`)(
  {
    manifest: PluginManifest,
    commands: S.Array(PluginCommandEntry),
    agents: S.Array(PluginAgentEntry),
    skills: S.Array(PluginSkillEntry),
    outputStyles: S.Array(PluginOutputStyleEntry),
    hooksConfig: S.Option(HooksSection),
    mcpConfig: S.Option(McpJsonFile),
  },
  $I.annote("PluginDefinition", {
    description: "Validated plugin definition with normalized component arrays and optional configuration files.",
  })
) {}

// ---------------------------------------------------------------------------
// define
// ---------------------------------------------------------------------------

/**
 * Build a typed slash-command entry.
 *
 * **Example** (Inspect command)
 *
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * const entry = Plugin.command({ name: "greet", body: "Say hello." })
 * console.log(entry.frontmatter)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const command = (config: PluginCommandConfig): PluginCommandEntry => {
  const { name, path, body, ...frontmatter } = config;
  return PluginCommandEntry.make({
    name,
    ...O.getSomesStruct({ path: O.fromUndefinedOr(path) }),
    frontmatter: S.decodeSync(CommandFrontmatter)(frontmatter),
    body,
  });
};

/**
 * Build a typed subagent entry.
 *
 * **Example** (Inspect agent)
 *
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * const entry = Plugin.agent({
 *   name: "reviewer",
 *   description: "Reviews changes",
 *   body: "Review the requested changes."
 * })
 * console.log(entry.frontmatter.name)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const agent = (config: PluginAgentConfig): PluginAgentEntry => {
  const { name, path, body, ...frontmatter } = config;
  return PluginAgentEntry.make({
    name,
    ...O.getSomesStruct({ path: O.fromUndefinedOr(path) }),
    frontmatter: S.decodeSync(SubagentFrontmatter)({
      name,
      ...frontmatter,
    }),
    body,
  });
};

/**
 * Build a typed skill entry.
 *
 * **Example** (Inspect skill)
 *
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * const entry = Plugin.skill({ name: "review", body: "Review the changes." })
 * console.log(entry.frontmatter.name)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const skill = (config: PluginSkillConfig): PluginSkillEntry => {
  const { name, path, body, ...frontmatter } = config;
  return PluginSkillEntry.make({
    name,
    ...O.getSomesStruct({ path: O.fromUndefinedOr(path) }),
    frontmatter: S.decodeSync(SkillFrontmatter)({
      name,
      ...frontmatter,
    }),
    body,
  });
};

/**
 * Build a typed output-style entry.
 *
 * **Example** (Inspect output style)
 *
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * const entry = Plugin.outputStyle({ name: "concise", body: "Be concise." })
 * console.log(entry.frontmatter.name)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const outputStyle = (config: PluginOutputStyleConfig): PluginOutputStyleEntry => {
  const { name, path, body, ...frontmatter } = config;
  return PluginOutputStyleEntry.make({
    name,
    ...O.getSomesStruct({ path: O.fromUndefinedOr(path) }),
    frontmatter: S.decodeSync(OutputStyleFrontmatter)({
      name,
      ...frontmatter,
    }),
    body,
  });
};

const normalizeHooksConfig = (hooksConfig: HooksSection | HooksSectionEncoded | undefined): O.Option<HooksSection> =>
  hooksConfig === undefined
    ? O.none()
    : S.is(HooksSection)(hooksConfig)
      ? O.some(hooksConfig)
      : S.decodeOption(HooksSection)(hooksConfig);

const normalizeMcpConfig = (mcpConfig: McpJsonFile | McpJsonFile.Encoded | undefined): O.Option<McpJsonFile> =>
  mcpConfig === undefined
    ? O.none()
    : S.is(McpJsonFile)(mcpConfig)
      ? O.some(mcpConfig)
      : S.decodeOption(McpJsonFile)(mcpConfig);

const validateNamedFrontmatter = (entryName: string, frontmatterName: O.Option<string>, kind: string): void => {
  O.map(frontmatterName, (name) => {
    if (entryName !== name) {
      throw PluginDefinitionError.make({
        kind,
        entryName,
        frontmatterName: name,
      });
    }
  });
};

const normalizeAgentEntry = (entry: PluginAgentEntry): PluginAgentEntry => {
  validateNamedFrontmatter(entry.name, O.some(entry.frontmatter.name), "agent");
  return entry;
};

const normalizeSkillEntry = (entry: PluginSkillEntry): PluginSkillEntry => {
  validateNamedFrontmatter(entry.name, entry.frontmatter.name, "skill");
  return entry;
};

const normalizeOutputStyleEntry = (entry: PluginOutputStyleEntry): PluginOutputStyleEntry => {
  validateNamedFrontmatter(entry.name, entry.frontmatter.name, "output style");
  return entry;
};

const layoutError = (path: string, message: string): PluginWriteError =>
  PluginWriteError.make({ path, cause: message });

const resolveFlatEntryRelativePath = <Entry extends { readonly name: string; readonly path?: string }>(options: {
  readonly destDir: string;
  readonly field: string;
  readonly defaultDir: string;
  readonly spec: O.Option<string | ReadonlyArray<string>>;
  readonly entry: Entry;
}): Effect.Effect<string, PluginWriteError> => {
  if (options.entry.path !== undefined) {
    return isSafePluginPath(options.entry.path)
      ? Effect.succeed(options.entry.path)
      : Effect.fail(layoutError(options.destDir, `${options.field} entry path must stay within the plugin root`));
  }

  const specs = pathSpecs(options.spec);
  if (specs.length === 0) {
    return Effect.succeed(`${options.defaultDir}/${options.entry.name}.md`);
  }
  if (specs.length > 1) {
    return Effect.fail(
      layoutError(
        options.destDir,
        `${options.field} uses multiple target paths; provide explicit entry.path values before writing`
      )
    );
  }

  const [target] = specs;
  if (target === undefined) {
    return Effect.fail(layoutError(options.destDir, `${options.field} target path is missing`));
  }
  return Effect.succeed(isMarkdownFilePath(target) ? target : `${target}/${options.entry.name}.md`);
};

const resolveSkillRelativePath = (options: {
  readonly destDir: string;
  readonly spec: O.Option<string | ReadonlyArray<string>>;
  readonly entry: PluginSkillEntry;
}): Effect.Effect<string, PluginWriteError> => {
  if (options.entry.path !== undefined) {
    return isSafePluginPath(options.entry.path)
      ? Effect.succeed(options.entry.path)
      : Effect.fail(layoutError(options.destDir, "skill entry path must stay within the plugin root"));
  }

  const specs = pathSpecs(options.spec);
  if (specs.length === 0) {
    return Effect.succeed(`skills/${options.entry.name}/SKILL.md`);
  }
  if (specs.length > 1) {
    return Effect.fail(
      layoutError(
        options.destDir,
        "skills uses multiple target paths; provide explicit entry.path values before writing"
      )
    );
  }

  const [target] = specs;
  if (target === undefined) {
    return Effect.fail(layoutError(options.destDir, "skills target path is missing"));
  }
  return Effect.succeed(isSkillFilePath(target) ? target : `${target}/${options.entry.name}/SKILL.md`);
};

const resolveConfigRelativePath = (options: {
  readonly destDir: string;
  readonly field: string;
  readonly fallback: string;
  readonly spec: O.Option<unknown>;
}): Effect.Effect<O.Option<string>, PluginWriteError> => {
  const specs = O.match(options.spec, {
    onNone: () => [],
    onSome: (spec) => (P.isString(spec) || isStringArray(spec) ? pathSpecs(O.some(spec)) : []),
  });
  if (O.isSome(options.spec) && specs.length === 0) {
    return Effect.succeedNone;
  }
  if (specs.length === 0) {
    return Effect.succeedSome(options.fallback);
  }
  if (specs.length > 1) {
    return Effect.fail(
      layoutError(options.destDir, `${options.field} uses multiple target paths; run Plugin.sync(...) before writing`)
    );
  }

  const [target] = specs;
  if (target === undefined) {
    return Effect.fail(layoutError(options.destDir, `${options.field} target path is missing`));
  }
  if (!isJsonFilePath(target)) {
    return Effect.fail(layoutError(options.destDir, `${options.field} target path must be a JSON file path`));
  }
  return Effect.succeedSome(target);
};

/**
 * Build a `PluginDefinition` from a plain config object. If
 * `config.manifest` is a raw object, it is passed through the
 * `PluginManifest` constructor (which enforces the schema) before
 * being stored. Component arrays default to empty; optional config
 * files become `O.none()` when absent.
 *
 * **Example** (Use define)
 *
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * const def = Plugin.define({
 *   manifest: { name: "my-plugin", version: "0.1.0" },
 *   commands: [
 *     Plugin.command({
 *       name: "greet",
 *       description: "Say hi",
 *       body: "# /greet\n\nSay hi.\n"
 *     })
 *   ]
 * })
 * console.log(def.manifest.name)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const define = (config: PluginConfig): PluginDefinition =>
  PluginDefinition.make({
    manifest: S.is(PluginManifest)(config.manifest) ? config.manifest : S.decodeSync(PluginManifest)(config.manifest),
    commands: config.commands ?? [],
    agents: A.map(config.agents ?? [], normalizeAgentEntry),
    skills: A.map(config.skills ?? [], normalizeSkillEntry),
    outputStyles: A.map(config.outputStyles ?? [], normalizeOutputStyleEntry),
    hooksConfig: normalizeHooksConfig(config.hooksConfig),
    mcpConfig: normalizeMcpConfig(config.mcpConfig),
  });

// ---------------------------------------------------------------------------
// write — internal helpers
// ---------------------------------------------------------------------------

const writeFile = (
  filePath: string,
  content: string
): Effect.Effect<void, PluginWriteError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const fs = yield* FileSystem.FileSystem;
    yield* makeDir(path.dirname(filePath));
    yield* fs
      .writeFileString(filePath, content)
      .pipe(Effect.mapError((cause) => PluginWriteError.make({ path: filePath, cause })));
  });

const makeDir = (dirPath: string): Effect.Effect<void, PluginWriteError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    yield* fs
      .makeDirectory(dirPath, { recursive: true })
      .pipe(Effect.mapError((cause) => PluginWriteError.make({ path: dirPath, cause })));
  });

/**
 * Write a flat list of component files into a directory. For each
 * entry, the file name is `${entry.name}${extension}` and the content
 * is written verbatim. If the entry list is empty, the directory is
 * not created.
 *
 * @internal
 */
const writeCommandEntries = (
  rootDir: string,
  spec: O.Option<string | ReadonlyArray<string>>,
  entries: ReadonlyArray<PluginCommandEntry>
): Effect.Effect<void, PluginWriteError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    if (entries.length === 0) return;
    const path = yield* Path.Path;
    yield* Effect.forEach(
      entries,
      (entry) =>
        resolveFlatEntryRelativePath({
          destDir: rootDir,
          field: "commands",
          defaultDir: "commands",
          spec,
          entry,
        }).pipe(
          Effect.flatMap((relativePath) =>
            renderCommand(entry.frontmatter, entry.body).pipe(
              Effect.mapError((cause) =>
                PluginWriteError.make({
                  path: path.join(rootDir, relativePath),
                  cause,
                })
              ),
              Effect.flatMap((content) => writeFile(path.join(rootDir, relativePath), content))
            )
          )
        ),
      { concurrency: 1 }
    );
  });

const writeFlatNamedEntries = <Entry extends { readonly name: string; readonly path?: string }, RenderError>(
  rootDir: string,
  spec: O.Option<string | ReadonlyArray<string>>,
  field: string,
  defaultDir: string,
  entries: ReadonlyArray<Entry>,
  renderEntry: (entry: Entry) => Effect.Effect<string, RenderError>
): Effect.Effect<void, PluginWriteError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    if (entries.length === 0) return;
    const path = yield* Path.Path;
    yield* Effect.forEach(
      entries,
      (entry) =>
        resolveFlatEntryRelativePath({
          destDir: rootDir,
          field,
          defaultDir,
          spec,
          entry,
        }).pipe(
          Effect.flatMap((relativePath) =>
            renderEntry(entry).pipe(
              Effect.mapError((cause) =>
                PluginWriteError.make({
                  path: path.join(rootDir, relativePath),
                  cause,
                })
              ),
              Effect.flatMap((content) => writeFile(path.join(rootDir, relativePath), content))
            )
          )
        ),
      { concurrency: 1 }
    );
  });

/**
 * Write skill entries, each into its own subdirectory with a
 * `SKILL.md` file. This matches Claude Code's canonical skill
 * layout: `skills/<name>/SKILL.md`.
 *
 * @internal
 */
const writeSkillEntries = (
  rootDir: string,
  spec: O.Option<string | ReadonlyArray<string>>,
  entries: ReadonlyArray<PluginSkillEntry>
): Effect.Effect<void, PluginWriteError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    if (entries.length === 0) return;
    const path = yield* Path.Path;
    yield* Effect.forEach(
      entries,
      (entry) =>
        resolveSkillRelativePath({
          destDir: rootDir,
          spec,
          entry,
        }).pipe(
          Effect.flatMap((relativePath) =>
            renderSkill(entry.frontmatter, entry.body).pipe(
              Effect.mapError((cause) =>
                PluginWriteError.make({
                  path: path.join(rootDir, relativePath),
                  cause,
                })
              ),
              Effect.flatMap((content) => writeFile(path.join(rootDir, relativePath), content))
            )
          )
        ),
      { concurrency: 1 }
    );
  });

/**
 * Serialize a JSON-serializable value to a pretty-printed string
 * with a trailing newline. Plugin manifests, `hooks/hooks.json`, and
 * `.mcp.json` all go through here to keep formatting consistent.
 *
 * @internal
 */
const toJsonFileContent = (value: unknown): string =>
  // eslint-disable-next-line avoid-direct-json -- writing the manifest IS
  // the whole purpose of Plugin.write; there's no Schema-level pretty
  // printer that preserves 2-space indent.
  `${JSON.stringify(value, null, 2)}\n`;

const sourceRootDir = (definition: PluginDefinition): O.Option<string> => {
  const candidate: unknown = definition;
  if (!P.hasProperty(candidate, "rootDir")) {
    return O.none();
  }
  return P.isString(candidate.rootDir) ? O.some(candidate.rootDir) : O.none();
};

const copyPathIfExists = (
  fromPath: string,
  toPath: string
): Effect.Effect<void, PluginWriteError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const exists = yield* fileSystem
      .exists(fromPath)
      .pipe(Effect.mapError((cause) => PluginWriteError.make({ path: fromPath, cause })));
    if (!exists || fromPath === toPath) {
      return;
    }
    yield* fileSystem
      .copy(fromPath, toPath, { overwrite: true })
      .pipe(Effect.mapError((cause) => PluginWriteError.make({ path: fromPath, cause })));
  });

const staticPathSpecs = (spec: O.Option<unknown>, fallback: string): ReadonlyArray<string> =>
  O.match(spec, {
    onNone: () => [fallback],
    onSome: (value) => (P.isString(value) || isStringArray(value) ? pathSpecs(O.some(value)) : []),
  });

const copyLoadedStaticLayout = (
  definition: PluginDefinition,
  destDir: string
): Effect.Effect<void, PluginWriteError, FileSystem.FileSystem | Path.Path> =>
  O.match(sourceRootDir(definition), {
    onNone: () => Effect.void,
    onSome: Effect.fn("Plugin.copyLoadedStaticLayout")(function* (rootDir) {
      const path = yield* Path.Path;
      const relativePaths = A.dedupe(
        A.flatten([
          staticPathSpecs(definition.manifest.lspServers, ".lsp.json"),
          staticPathSpecs(
            O.flatMap(definition.manifest.experimental, (experimental) => experimental.themes),
            "themes"
          ),
          staticPathSpecs(
            O.flatMap(definition.manifest.experimental, (experimental) => experimental.monitors),
            "monitors/monitors.json"
          ),
          ["bin", "settings.json"],
        ])
      );
      yield* Effect.forEach(
        relativePaths,
        (relativePath) => {
          const normalized = normalizeManifestPath(relativePath);
          return copyPathIfExists(path.join(rootDir, normalized), path.join(destDir, normalized));
        },
        { concurrency: 1 }
      ).pipe(Effect.asVoid);
    }),
  });

/** @internal */
const manifestForWrite = (manifest: PluginManifest): PluginManifest =>
  O.match(manifest.mcpServers, {
    onNone: () => manifest,
    onSome: (mcpServers) => {
      if (P.isString(mcpServers) || A.isArray(mcpServers)) {
        return manifest;
      }
      return S.decodeUnknownOption(McpJsonFile)({ mcpServers }).pipe(
        O.map((file) =>
          PluginManifest.make({
            ...manifest,
            mcpServers: O.some(toClaudeCodeJson(file).mcpServers),
          })
        ),
        O.getOrElse(() => manifest)
      );
    },
  });

// ---------------------------------------------------------------------------
// write
// ---------------------------------------------------------------------------

/**
 * Materialize a `PluginDefinition` to a destination directory.
 *
 * **Details**
 *
 * The write order is deterministic: manifest first, then component
 * directories in the order `commands`, `agents`, `skills`,
 * `outputStyles`, then (optionally) `hooks/hooks.json`, then
 * (optionally) `.mcp.json`. Any filesystem error is wrapped in a
 * `PluginWriteError` carrying the offending path.
 *
 * Requires `FileSystem` and `Path` services in the environment; pick
 * your preferred platform layer at the call site (for example
 * `NodeFileSystem.layer` + `NodePath.layer` under Node).
 *
 * **Example** (Write a plugin tree in memory)
 *
 * ```ts
 * import { Plugin, Testing } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const definition = Plugin.define({
 *   manifest: { name: "my-plugin" },
 *   commands: [Plugin.command({ name: "hi", body: "# /hi\n" })]
 * })
 * const fileSystem = await Effect.runPromise(
 *   Testing.writePluginToMemory(definition, "/tmp/my-plugin")
 * )
 *
 * console.log(fileSystem.exists("/tmp/my-plugin/.claude-plugin/plugin.json")) // true
 * console.log(fileSystem.exists("/tmp/my-plugin/commands/hi.md")) // true
 * ```
 *
 * @category serialization
 * @since 0.0.0
 */
export const write: {
  (
    destDir: string
  ): (definition: PluginDefinition) => Effect.Effect<void, PluginWriteError, FileSystem.FileSystem | Path.Path>;
  (
    definition: PluginDefinition,
    destDir: string
  ): Effect.Effect<void, PluginWriteError, FileSystem.FileSystem | Path.Path>;
} = dual(
  2,
  (
    definition: PluginDefinition,
    destDir: string
  ): Effect.Effect<void, PluginWriteError, FileSystem.FileSystem | Path.Path> =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const manifest = syncManifest(definition);
      const emittedManifest = manifestForWrite(manifest);

      // .claude-plugin/plugin.json
      const claudePluginDir = path.join(destDir, ".claude-plugin");
      const manifestPath = path.join(claudePluginDir, "plugin.json");
      const encodedManifest = yield* S.encodeEffect(PluginManifest)(emittedManifest).pipe(
        Effect.mapError((cause) => PluginWriteError.make({ path: manifestPath, cause }))
      );
      yield* makeDir(claudePluginDir);
      yield* writeFile(manifestPath, toJsonFileContent(encodedManifest));

      // commands/<name>.md
      yield* writeCommandEntries(destDir, manifest.commands, definition.commands);

      // agents/<name>.md
      yield* writeFlatNamedEntries(destDir, manifest.agents, "agents", "agents", definition.agents, (entry) =>
        renderSubagent(entry.frontmatter, entry.body)
      );

      // skills/<name>/SKILL.md
      yield* writeSkillEntries(destDir, manifest.skills, definition.skills);

      // output-styles/<name>.md
      yield* writeFlatNamedEntries(
        destDir,
        manifest.outputStyles,
        "outputStyles",
        "output-styles",
        definition.outputStyles,
        (entry) => renderOutputStyle(entry.frontmatter, entry.body)
      );

      // hooks/hooks.json
      if (O.isSome(definition.hooksConfig)) {
        const hooksPath = yield* resolveConfigRelativePath({
          destDir,
          field: "hooks",
          fallback: "hooks/hooks.json",
          spec: manifest.hooks,
        });
        if (O.isSome(hooksPath)) {
          const outputPath = path.join(destDir, hooksPath.value);
          const encodedHooks = yield* S.encodeEffect(HooksSection)(definition.hooksConfig.value).pipe(
            Effect.mapError((cause) => PluginWriteError.make({ path: outputPath, cause }))
          );
          yield* writeFile(outputPath, toJsonFileContent({ hooks: encodedHooks }));
        }
      }

      // .mcp.json
      if (O.isSome(definition.mcpConfig)) {
        const mcpPath = yield* resolveConfigRelativePath({
          destDir,
          field: "mcpServers",
          fallback: ".mcp.json",
          spec: manifest.mcpServers,
        });
        if (O.isSome(mcpPath)) {
          yield* writeFile(
            path.join(destDir, mcpPath.value),
            toJsonFileContent(toClaudeCodeJson(definition.mcpConfig.value))
          );
        }
      }

      yield* copyLoadedStaticLayout(definition, destDir);
    })
);
