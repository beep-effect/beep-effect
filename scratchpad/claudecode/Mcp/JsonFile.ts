/**
 * Schemas and loaders for Claude Code MCP configuration files.
 *
 * Project scope uses `.mcp.json`; user and local scopes live in
 * `~/.claude.json`; enterprise deployments may provide a system
 * `managed-mcp.json`. Loaders read through the Effect `FileSystem`
 * service and decode JSON with Effect Schema.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";

import { McpConfigError } from "../Errors.ts";
import { HttpMcpServer, McpOAuth, McpServerConfig, StdioMcpServer } from "./Schema.ts";

const $I = $ScratchpadId.create("claudecode/Mcp/JsonFile");

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/**
 * The full `.mcp.json` / `managed-mcp.json` file shape — a record of
 * named MCP server entries under `mcpServers`.
 *
 * @example
 * ```ts
 * import { Mcp } from "effect-claudecode"
 *
 * const file = Mcp.McpJsonFile.make({ mcpServers: {} })
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class McpJsonFile extends S.Class<McpJsonFile>($I`McpJsonFile`)(
  {
    mcpServers: S.Record(S.String, McpServerConfig),
  },
  $I.annote("McpJsonFile", {
    description: "Named MCP server definitions stored in a Claude configuration file.",
  })
) {}

/**
 * Companion types for {@link McpJsonFile}.
 *
 * @example
 * ```ts
 * import type { Mcp } from "effect-claudecode"
 *
 * const input = { mcpServers: {} } satisfies Mcp.McpJsonFile.Encoded
 * console.log(input.mcpServers)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace McpJsonFile {
  /**
   * Runtime type represented by {@link McpJsonFile}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = McpJsonFile;

  /**
   * JSON representation accepted by {@link McpJsonFile}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof McpJsonFile.Encoded;
}

/**
 * Per-project entry inside `~/.claude.json`.
 *
 * @example
 * ```ts
 * import { Mcp } from "effect-claudecode"
 *
 * const project = Mcp.ClaudeJsonProject.make({})
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ClaudeJsonProject extends S.Class<ClaudeJsonProject>($I`ClaudeJsonProject`)(
  {
    mcpServers: S.OptionFromOptionalKey(S.Record(S.String, McpServerConfig)).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ClaudeJsonProject", {
    description: "Project-scoped MCP configuration inside Claude's user file.",
  })
) {}

/**
 * Companion types for {@link ClaudeJsonProject}.
 *
 * @example
 * ```ts
 * import type { Mcp } from "effect-claudecode"
 *
 * const input = {} satisfies Mcp.ClaudeJsonProject.Encoded
 * console.log(input)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ClaudeJsonProject {
  /**
   * Runtime type represented by {@link ClaudeJsonProject}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = ClaudeJsonProject;

  /**
   * JSON representation accepted by {@link ClaudeJsonProject}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ClaudeJsonProject.Encoded;
}

/**
 * Tolerant schema for the MCP-related portions of `~/.claude.json`.
 *
 * User-scope servers live at top-level `mcpServers`; local-scope
 * servers live under `projects[projectPath].mcpServers`. Other
 * Claude Code keys are intentionally ignored.
 *
 * @example
 * ```ts
 * import { Mcp } from "effect-claudecode"
 *
 * const file = Mcp.ClaudeJsonFile.make({})
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ClaudeJsonFile extends S.Class<ClaudeJsonFile>($I`ClaudeJsonFile`)(
  {
    mcpServers: S.OptionFromOptionalKey(S.Record(S.String, McpServerConfig)).pipe(SchemaUtils.withNoneDefault),
    projects: S.OptionFromOptionalKey(S.Record(S.String, ClaudeJsonProject)).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ClaudeJsonFile", {
    description: "MCP-relevant portions of Claude's user configuration file.",
  })
) {}

/**
 * Companion types for {@link ClaudeJsonFile}.
 *
 * @example
 * ```ts
 * import type { Mcp } from "effect-claudecode"
 *
 * const input = {} satisfies Mcp.ClaudeJsonFile.Encoded
 * console.log(input)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ClaudeJsonFile {
  /**
   * Runtime type represented by {@link ClaudeJsonFile}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = ClaudeJsonFile;

  /**
   * JSON representation accepted by {@link ClaudeJsonFile}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ClaudeJsonFile.Encoded;
}

const McpJsonFileJson = S.fromJsonString(McpJsonFile).pipe(
  $I.annoteSchema("McpJsonFileJson", {
    description: "JSON text codec for a Claude Code MCP configuration file.",
  })
);

const ClaudeJsonFileJson = S.fromJsonString(ClaudeJsonFile).pipe(
  $I.annoteSchema("ClaudeJsonFileJson", {
    description: "JSON text codec for MCP fields in Claude's user configuration.",
  })
);

/**
 * Overrides used while resolving all MCP configuration scopes.
 *
 * @example
 * ```ts
 * import type { Mcp } from "effect-claudecode"
 *
 * const options: Mcp.EffectiveMcpLoadOptions = {
 *   projectMcpPath: "/workspace/.mcp.json"
 * }
 * console.log(options.projectMcpPath)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export interface EffectiveMcpLoadOptions {
  /** Override the `~/.claude.json` path, mainly for tests. */
  readonly claudeJsonPath?: string;
  /** Override the project `.mcp.json` path. */
  readonly projectMcpPath?: string;
  /** Plugin-provided MCP configs, lowest precedence in normal loading. */
  readonly pluginMcpConfigs?: ReadonlyArray<McpJsonFile>;
  /** Override the managed MCP directory, mainly for tests. */
  readonly managedMcpRoot?: string;
  /** Override all candidate managed MCP directories. */
  readonly managedMcpRoots?: ReadonlyArray<string>;
}

/**
 * Overrides used while discovering enterprise-managed MCP configuration.
 *
 * @example
 * ```ts
 * import type { Mcp } from "effect-claudecode"
 *
 * const options: Mcp.ManagedMcpLoadOptions = {
 *   managedMcpRoots: ["/etc/claude-code"]
 * }
 * console.log(options.managedMcpRoots)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export interface ManagedMcpLoadOptions {
  /** Override the managed MCP directory, mainly for tests. */
  readonly managedMcpRoot?: string;
  /** Override all candidate managed MCP directories. */
  readonly managedMcpRoots?: ReadonlyArray<string>;
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const reservedServerName = "workspace";

const defaultManagedMcpRoots = [
  "/Library/Application Support/ClaudeCode",
  "/etc/claude-code",
  "C:\\Program Files\\ClaudeCode",
] as const;

/** @internal */
const homeDirectory = Config.string("HOME").pipe(
  Config.orElse(() => Config.string("USERPROFILE")),
  Config.withDefault("/")
);

/**
 * Resolve the canonical `~/.claude.json` path.
 *
 * @example
 * ```ts
 * import { Mcp } from "effect-claudecode"
 *
 * console.log(Mcp.userClaudeJsonPath)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const userClaudeJsonPath = Effect.gen(function* () {
  const path = yield* Path.Path;
  const home = yield* homeDirectory;
  return path.join(home, ".claude.json");
});

/**
 * Resolve the project `.mcp.json` path for a cwd.
 *
 * @example
 * ```ts
 * import { Mcp } from "effect-claudecode"
 *
 * const program = Mcp.projectMcpJsonPath("/workspace")
 * console.log(program)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const projectMcpJsonPath = (cwd: string): Effect.Effect<string, never, Path.Path> =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    return path.join(cwd, ".mcp.json");
  });

/** @internal */
const managedRoots = (options: O.Option<ManagedMcpLoadOptions>): ReadonlyArray<string> =>
  O.match(options, {
    onNone: () => defaultManagedMcpRoots,
    onSome: (value) =>
      O.match(O.fromNullishOr(value.managedMcpRoots), {
        onNone: () =>
          O.match(O.fromNullishOr(value.managedMcpRoot), {
            onNone: () => defaultManagedMcpRoots,
            onSome: (root) => [root],
          }),
        onSome: (roots) => roots,
      }),
  });

/**
 * Resolve candidate system `managed-mcp.json` paths.
 *
 * @example
 * ```ts
 * import { Mcp } from "effect-claudecode"
 *
 * const program = Mcp.managedMcpJsonPaths({
 *   managedMcpRoots: ["/etc/claude-code"]
 * })
 * console.log(program)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const managedMcpJsonPaths = (
  options?: ManagedMcpLoadOptions
): Effect.Effect<ReadonlyArray<string>, never, Path.Path> =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    return A.map(managedRoots(O.fromNullishOr(options)), (root) => path.join(root, "managed-mcp.json"));
  });

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** @internal */
const readFileString = (path: string): Effect.Effect<string, McpConfigError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    return yield* fs.readFileString(path).pipe(Effect.mapError((cause) => McpConfigError.make({ path, cause })));
  });

/** @internal */
const fileExists = (path: string): Effect.Effect<boolean, McpConfigError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    return yield* fs.exists(path).pipe(Effect.mapError((cause) => McpConfigError.make({ path, cause })));
  });

/** @internal */
const withoutReservedServerNames = (file: McpJsonFile, source: string): Effect.Effect<McpJsonFile> =>
  R.has(file.mcpServers, reservedServerName)
    ? Effect.logWarning("MCP server name `workspace` is reserved; skipping server.").pipe(
        Effect.annotateLogs({ source, server: reservedServerName }),
        Effect.as(
          McpJsonFile.make({
            mcpServers: R.remove(file.mcpServers, reservedServerName),
          })
        )
      )
    : Effect.succeed(file);

/** @internal */
const loadOptionalJson = <A>(
  path: string,
  load: (path: string) => Effect.Effect<A, McpConfigError, FileSystem.FileSystem>
): Effect.Effect<O.Option<A>, McpConfigError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const exists = yield* fileExists(path);
    if (!exists) return O.none<A>();
    return O.some(yield* load(path));
  });

/** @internal */
const serverEndpointKey = (server: McpServerConfig): O.Option<string> => {
  if (S.is(StdioMcpServer)(server)) {
    return O.some(`command:${server.command}\u0000${A.join(O.getOrElse(server.args, A.empty<string>), "\u0000")}`);
  }
  return O.some(`url:${server.url}`);
};

/** @internal */
const removeEndpointDuplicates = (
  servers: Readonly<Record<string, McpServerConfig>>,
  server: McpServerConfig
): Record<string, McpServerConfig> =>
  O.match(serverEndpointKey(server), {
    onNone: () => ({ ...servers }),
    onSome: (endpoint) =>
      R.filter(servers, (candidate) =>
        O.match(serverEndpointKey(candidate), {
          onNone: () => true,
          onSome: (candidateEndpoint) => candidateEndpoint !== endpoint,
        })
      ),
  });

/** @internal */
const mergeServerRecords = (
  base: Readonly<Record<string, McpServerConfig>>,
  override: Readonly<Record<string, McpServerConfig>>
): Record<string, McpServerConfig> => {
  const initial: Record<string, McpServerConfig> = { ...base };
  return A.reduce(R.toEntries(override), initial, (acc, [name, server]) =>
    R.set(removeEndpointDuplicates(acc, server), name, server)
  );
};

/**
 * Merge MCP config files in increasing precedence order.
 *
 * Later files replace earlier files by server name and also remove any
 * lower-precedence server with the same URL or stdio command/arguments.
 * Fields inside an individual server entry are never merged.
 *
 * @example
 * ```ts
 * import { Mcp } from "effect-claudecode"
 *
 * const merged = Mcp.mergeMcpJsonFiles([
 *   Mcp.McpJsonFile.make({ mcpServers: {} })
 * ])
 * console.log(merged.mcpServers)
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const mergeMcpJsonFiles = (files: ReadonlyArray<McpJsonFile>): McpJsonFile => {
  const initial: Record<string, McpServerConfig> = {};
  return McpJsonFile.make({
    mcpServers: A.reduce(files, initial, (acc, file) => mergeServerRecords(acc, file.mcpServers)),
  });
};

/** @internal */
const mcpFileFromServers = (
  servers: O.Option<Readonly<Record<string, McpServerConfig>>>,
  source: string
): Effect.Effect<O.Option<McpJsonFile>> =>
  O.match(servers, {
    onNone: () => Effect.succeed(O.none<McpJsonFile>()),
    onSome: (mcpServers) =>
      withoutReservedServerNames(McpJsonFile.make({ mcpServers }), source).pipe(Effect.map(O.some)),
  });

/** @internal */
const optionalJsonField = <A>(key: string, value: O.Option<A>): Readonly<Record<string, unknown>> =>
  O.map(value, (fieldValue) => ({ [key]: fieldValue })).pipe(O.getOrElse(() => ({})));

const encodeOAuth = S.encodeSync(McpOAuth);

/** @internal */
const serializeServerForCurrentClaudeCode = (server: McpServerConfig): Readonly<Record<string, unknown>> => {
  if (S.is(StdioMcpServer)(server)) {
    return {
      ...optionalJsonField("type", server.type),
      command: server.command,
      ...optionalJsonField("args", server.args),
      ...optionalJsonField("env", server.env),
      ...optionalJsonField("timeout", server.timeout),
      ...optionalJsonField("alwaysLoad", server.alwaysLoad),
    };
  }
  if (S.is(HttpMcpServer)(server)) {
    return {
      type: server.type,
      url: server.url,
      ...optionalJsonField("headers", server.headers),
      ...optionalJsonField("headersHelper", server.headersHelper),
      ...optionalJsonField("timeout", server.timeout),
      ...optionalJsonField("alwaysLoad", server.alwaysLoad),
      ...optionalJsonField("oauth", O.map(server.oauth, encodeOAuth)),
    };
  }
  return {
    type: server.type,
    url: server.url,
    ...optionalJsonField("headers", server.headers),
    ...optionalJsonField("headersHelper", server.headersHelper),
    ...optionalJsonField("timeout", server.timeout),
    ...optionalJsonField("alwaysLoad", server.alwaysLoad),
  };
};

/**
 * Convert an MCP config into the current Claude Code JSON shape.
 *
 * The result contains only fields represented by the current MCP transport
 * schemas and omits the reserved `workspace` server name.
 *
 * @example
 * ```ts
 * import { Mcp } from "effect-claudecode"
 *
 * const encoded = Mcp.toClaudeCodeJson(
 *   Mcp.McpJsonFile.make({ mcpServers: {} })
 * )
 * console.log(encoded.mcpServers)
 * ```
 *
 * @category serialization
 * @since 0.0.0
 */
export const toClaudeCodeJson = (
  file: McpJsonFile
): Readonly<{ readonly mcpServers: Readonly<Record<string, unknown>> }> => ({
  mcpServers: R.map(R.remove(file.mcpServers, reservedServerName), serializeServerForCurrentClaudeCode),
});

/** @internal */
const projectClaudeJsonEntry = (file: ClaudeJsonFile, cwd: string, resolvedCwd: string): O.Option<ClaudeJsonProject> =>
  O.flatMap(file.projects, (projects) =>
    O.firstSomeOf([O.fromUndefinedOr(projects[resolvedCwd]), O.fromUndefinedOr(projects[cwd])])
  );

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

/**
 * Read a `.mcp.json` or `managed-mcp.json` file from disk.
 *
 * Missing files are errors for this strict loader; use `loadEffective`
 * or `loadManagedMcp` for optional discovery. A server named
 * `workspace` is skipped with a warning because Claude Code reserves
 * that name internally.
 *
 * @example
 * ```ts
 * import { Mcp } from "effect-claudecode"
 *
 * const program = Mcp.loadJson("/workspace/.mcp.json")
 * console.log(program)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const loadJson = Effect.fn("Mcp.loadJson")(function* (
  path: string
): Effect.fn.Return<McpJsonFile, McpConfigError, FileSystem.FileSystem> {
  yield* Effect.annotateCurrentSpan("mcp.path", path);
  yield* Effect.logDebug("loading MCP config").pipe(Effect.annotateLogs({ path }));
  const raw = yield* readFileString(path);
  const decoded = yield* S.decodeUnknownEffect(McpJsonFileJson)(raw).pipe(
    Effect.mapError((cause) => McpConfigError.make({ path, cause }))
  );
  return yield* withoutReservedServerNames(decoded, path);
});

/**
 * Read a `~/.claude.json` file and decode the MCP-related sections.
 *
 * @example
 * ```ts
 * import { Mcp } from "effect-claudecode"
 *
 * const program = Mcp.loadClaudeJson("/home/user/.claude.json")
 * console.log(program)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const loadClaudeJson = Effect.fn("Mcp.loadClaudeJson")(function* (
  path: string
): Effect.fn.Return<ClaudeJsonFile, McpConfigError, FileSystem.FileSystem> {
  yield* Effect.annotateCurrentSpan("mcp.claudeJsonPath", path);
  const raw = yield* readFileString(path);
  return yield* S.decodeUnknownEffect(ClaudeJsonFileJson)(raw).pipe(
    Effect.mapError((cause) => McpConfigError.make({ path, cause }))
  );
});

/** @internal */
const loadManagedMcpWithOptions = Effect.fn("Mcp.loadManagedMcp")(function* (
  loadOptions: O.Option<ManagedMcpLoadOptions>
): Effect.fn.Return<O.Option<McpJsonFile>, McpConfigError, FileSystem.FileSystem | Path.Path> {
  const paths = yield* managedMcpJsonPaths(loadOptions.pipe(O.getOrUndefined));
  const loaded = yield* Effect.forEach(paths, (path) => loadOptionalJson(path, loadJson), { concurrency: 1 });
  return O.flatten(A.findFirst(loaded, O.isSome));
});

/**
 * Discovers the first system `managed-mcp.json` file that exists.
 *
 * Claude Code treats this file as exclusive enterprise control: when it
 * exists, user, project, local, and plugin MCP configs are suppressed.
 *
 * @example
 * ```ts
 * import { Mcp } from "effect-claudecode"
 *
 * const program = Mcp.loadManagedMcp({
 *   managedMcpRoots: ["/etc/claude-code"]
 * })
 * console.log(program)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const loadManagedMcp = (
  options?: ManagedMcpLoadOptions
): Effect.Effect<O.Option<McpJsonFile>, McpConfigError, FileSystem.FileSystem | Path.Path> =>
  loadManagedMcpWithOptions(O.fromNullishOr(options));

/** @internal */
const loadEffectiveWithOptions = Effect.fn("Mcp.loadEffective")(function* (
  cwd: string,
  loadOptions: O.Option<EffectiveMcpLoadOptions>
): Effect.fn.Return<McpJsonFile, McpConfigError, FileSystem.FileSystem | Path.Path> {
  yield* Effect.annotateCurrentSpan("mcp.cwd", cwd);
  const path = yield* Path.Path;
  const resolvedCwd = path.resolve(cwd);
  const managed = yield* loadOptions.pipe(
    O.map((value) => ({
      ...(value.managedMcpRoot !== undefined ? { managedMcpRoot: value.managedMcpRoot } : {}),
      ...(value.managedMcpRoots !== undefined ? { managedMcpRoots: value.managedMcpRoots } : {}),
    })),
    O.getOrUndefined,
    loadManagedMcp
  );
  if (O.isSome(managed)) return managed.value;

  const claudePath = yield* O.match(
    O.flatMap(loadOptions, (value) => O.fromNullishOr(value.claudeJsonPath)),
    {
      onNone: () =>
        userClaudeJsonPath.pipe(
          Effect.mapError((cause) =>
            McpConfigError.make({
              path: "~/.claude.json",
              cause,
            })
          )
        ),
      onSome: Effect.succeed,
    }
  );
  const projectPath = O.getOrElse(
    O.flatMap(loadOptions, (value) => O.fromNullishOr(value.projectMcpPath)),
    () => path.join(cwd, ".mcp.json")
  );
  const pluginConfigs = O.getOrElse(
    O.flatMap(loadOptions, (value) => O.fromNullishOr(value.pluginMcpConfigs)),
    () => []
  );
  const sanitizedPluginConfigs = yield* Effect.forEach(
    pluginConfigs,
    (config) => withoutReservedServerNames(config, "plugin MCP config"),
    { concurrency: 1 }
  );
  const claudeJson = yield* loadOptionalJson(claudePath, loadClaudeJson);
  const userMcp = yield* O.match(claudeJson, {
    onNone: () => Effect.succeed(O.none<McpJsonFile>()),
    onSome: (file) => mcpFileFromServers(file.mcpServers, claudePath),
  });
  const projectMcp = yield* loadOptionalJson(projectPath, loadJson);
  const localMcp = yield* O.match(claudeJson, {
    onNone: () => Effect.succeed(O.none<McpJsonFile>()),
    onSome: (file) =>
      O.match(projectClaudeJsonEntry(file, cwd, resolvedCwd), {
        onNone: () => Effect.succeed(O.none<McpJsonFile>()),
        onSome: (project) => mcpFileFromServers(project.mcpServers, `${claudePath}:projects.${resolvedCwd}`),
      }),
  });

  return mergeMcpJsonFiles([
    ...sanitizedPluginConfigs,
    ...(O.isSome(userMcp) ? [userMcp.value] : []),
    ...(O.isSome(projectMcp) ? [projectMcp.value] : []),
    ...(O.isSome(localMcp) ? [localMcp.value] : []),
  ]);
});

/**
 * Loads the effective MCP configuration for a Claude Code project.
 *
 * Normal precedence is local (`~/.claude.json` project entry) > project
 * (`.mcp.json`) > user (`~/.claude.json` top-level) > plugins. Whole
 * server entries override lower scopes; fields are not merged. If a
 * system `managed-mcp.json` exists, it has exclusive control and the
 * returned config contains only managed servers.
 *
 * @example
 * ```ts
 * import { Mcp } from "effect-claudecode"
 *
 * const program = Mcp.loadEffective("/workspace")
 * console.log(program)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const loadEffective = (
  cwd: string,
  options?: EffectiveMcpLoadOptions
): Effect.Effect<McpJsonFile, McpConfigError, FileSystem.FileSystem | Path.Path> =>
  loadEffectiveWithOptions(cwd, O.fromNullishOr(options));
