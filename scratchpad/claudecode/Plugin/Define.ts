/**
 * `Plugin.define` + `Plugin.write` — the ergonomic builder for
 * Claude Code plugins.
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
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
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

const isStringArray = (value: unknown): value is ReadonlyArray<string> =>
  A.isArray(value) && A.every(value, P.isString);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A typed slash-command entry to be written to `commands/<name>.md`.
 *
 * @example
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * const entry = Plugin.command({ name: "greet", body: "Say hello." })
 * console.log(entry.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface PluginCommandEntry {
  readonly name: string;
  readonly path?: string;
  readonly frontmatter: CommandFrontmatter;
  readonly body: string;
}

/**
 * A typed subagent entry to be written to `agents/<name>.md`.
 *
 * @example
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * const entry = Plugin.agent({
 *   name: "reviewer",
 *   description: "Reviews changes",
 *   body: "Review the requested changes."
 * })
 * console.log(entry.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface PluginAgentEntry {
  readonly name: string;
  readonly path?: string;
  readonly frontmatter: SubagentFrontmatter;
  readonly body: string;
}

/**
 * A typed skill entry to be written to `skills/<name>/SKILL.md`.
 *
 * @example
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * const entry = Plugin.skill({ name: "review", body: "Review the changes." })
 * console.log(entry.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface PluginSkillEntry {
  readonly name: string;
  readonly path?: string;
  readonly frontmatter: SkillFrontmatter;
  readonly body: string;
}

/**
 * A typed output-style entry to be written to `output-styles/<name>.md`.
 *
 * @example
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * const entry = Plugin.outputStyle({ name: "concise", body: "Be concise." })
 * console.log(entry.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface PluginOutputStyleEntry {
  readonly name: string;
  readonly path?: string;
  readonly frontmatter: OutputStyleFrontmatter;
  readonly body: string;
}

/**
 * Encoded input accepted by {@link command}.
 *
 * @example
 * ```ts
 * import type { Plugin } from "effect-claudecode"
 *
 * const config = {
 *   name: "greet",
 *   body: "Say hello."
 * } satisfies Plugin.PluginCommandConfig
 * console.log(config.name)
 * ```
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
 * @example
 * ```ts
 * import type { Plugin } from "effect-claudecode"
 *
 * const config = {
 *   name: "reviewer",
 *   description: "Reviews changes",
 *   body: "Review the requested changes."
 * } satisfies Plugin.PluginAgentConfig
 * console.log(config.name)
 * ```
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
 * @example
 * ```ts
 * import type { Plugin } from "effect-claudecode"
 *
 * const config = {
 *   name: "review",
 *   body: "Review the changes."
 * } satisfies Plugin.PluginSkillConfig
 * console.log(config.name)
 * ```
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
 * @example
 * ```ts
 * import type { Plugin } from "effect-claudecode"
 *
 * const config = {
 *   name: "concise",
 *   body: "Be concise."
 * } satisfies Plugin.PluginOutputStyleConfig
 * console.log(config.name)
 * ```
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
 * @example
 * ```ts
 * import type { Plugin } from "effect-claudecode"
 *
 * const config = {
 *   manifest: { name: "example-plugin" }
 * } satisfies Plugin.PluginConfig
 * console.log(config.manifest.name)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export interface PluginConfig {
  readonly manifest: PluginManifest | PluginManifest.Encoded;
  readonly commands?: ReadonlyArray<PluginCommandEntry>;
  readonly agents?: ReadonlyArray<PluginAgentEntry>;
  readonly skills?: ReadonlyArray<PluginSkillEntry>;
  readonly outputStyles?: ReadonlyArray<PluginOutputStyleEntry>;
  readonly hooksConfig?: HooksSection | HooksSectionEncoded;
  readonly mcpConfig?: McpJsonFile | McpJsonFile.Encoded;
}

/**
 * The fully-formed plugin definition ready to be written. Components
 * default to empty arrays; optional config files default to `None`.
 *
 * @example
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * const definition = Plugin.define({
 *   manifest: { name: "example-plugin" }
 * })
 * console.log(definition.commands)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface PluginDefinition {
  readonly manifest: PluginManifest;
  readonly commands: ReadonlyArray<PluginCommandEntry>;
  readonly agents: ReadonlyArray<PluginAgentEntry>;
  readonly skills: ReadonlyArray<PluginSkillEntry>;
  readonly outputStyles: ReadonlyArray<PluginOutputStyleEntry>;
  readonly hooksConfig: O.Option<HooksSection>;
  readonly mcpConfig: O.Option<McpJsonFile>;
}

// ---------------------------------------------------------------------------
// define
// ---------------------------------------------------------------------------

/**
 * Build a typed slash-command entry.
 *
 * @example
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
  return {
    name,
    ...(path !== undefined ? { path } : {}),
    frontmatter: S.decodeUnknownSync(CommandFrontmatter)(frontmatter),
    body,
  };
};

/**
 * Build a typed subagent entry.
 *
 * @example
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
  return {
    name,
    ...(path !== undefined ? { path } : {}),
    frontmatter: S.decodeUnknownSync(SubagentFrontmatter)({
      name,
      ...frontmatter,
    }),
    body,
  };
};

/**
 * Build a typed skill entry.
 *
 * @example
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
  return {
    name,
    ...(path !== undefined ? { path } : {}),
    frontmatter: S.decodeUnknownSync(SkillFrontmatter)({
      name,
      ...frontmatter,
    }),
    body,
  };
};

/**
 * Build a typed output-style entry.
 *
 * @example
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
  return {
    name,
    ...(path !== undefined ? { path } : {}),
    frontmatter: S.decodeUnknownSync(OutputStyleFrontmatter)({
      name,
      ...frontmatter,
    }),
    body,
  };
};

const normalizeHooksConfig = (hooksConfig: HooksSection | HooksSectionEncoded | undefined): O.Option<HooksSection> =>
  hooksConfig === undefined
    ? O.none()
    : S.is(HooksSection)(hooksConfig)
      ? O.some(hooksConfig)
      : S.decodeUnknownOption(HooksSection)(hooksConfig);

const normalizeMcpConfig = (mcpConfig: McpJsonFile | McpJsonFile.Encoded | undefined): O.Option<McpJsonFile> =>
  mcpConfig === undefined
    ? O.none()
    : S.is(McpJsonFile)(mcpConfig)
      ? O.some(mcpConfig)
      : S.decodeUnknownOption(McpJsonFile)(mcpConfig);

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
    onSome: (spec) => (typeof spec === "string" || isStringArray(spec) ? pathSpecs(O.some(spec)) : []),
  });
  if (O.isSome(options.spec) && specs.length === 0) {
    return Effect.succeed(O.none());
  }
  if (specs.length === 0) {
    return Effect.succeed(O.some(options.fallback));
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
  return Effect.succeed(O.some(target));
};

/**
 * Build a `PluginDefinition` from a plain config object. If
 * `config.manifest` is a raw object, it is passed through the
 * `PluginManifest` constructor (which enforces the schema) before
 * being stored. Component arrays default to empty; optional config
 * files become `O.none()` when absent.
 *
 * @example
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
export const define = (config: PluginConfig): PluginDefinition => ({
  manifest: S.is(PluginManifest)(config.manifest)
    ? config.manifest
    : S.decodeUnknownSync(PluginManifest)(config.manifest),
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
    onSome: (value) => (typeof value === "string" || isStringArray(value) ? pathSpecs(O.some(value)) : []),
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
      if (typeof mcpServers === "string" || A.isArray(mcpServers)) {
        return manifest;
      }
      return O.match(S.decodeUnknownOption(McpJsonFile)({ mcpServers }), {
        onNone: () => manifest,
        onSome: (file) =>
          PluginManifest.make({
            ...manifest,
            mcpServers: O.some(toClaudeCodeJson(file).mcpServers),
          }),
      });
    },
  });

// ---------------------------------------------------------------------------
// write
// ---------------------------------------------------------------------------

/**
 * Materialize a `PluginDefinition` to a destination directory.
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
 * @example
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * const def = Plugin.define({
 *   manifest: { name: "my-plugin" },
 *   commands: [
 *     Plugin.command({ name: "hi", body: "# /hi\n" })
 *   ]
 * })
 *
 * const program = Plugin.write(def, "/tmp/my-plugin")
 * console.log(program)
 * ```
 *
 * @category serialization
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
export const write = (
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
  });
