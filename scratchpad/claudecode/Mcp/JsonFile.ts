/**
 * Schemas and loaders for Claude Code MCP configuration files.
 *
 * **Details**
 *
 * Project scope uses `.mcp.json`; user and local scopes live in
 * `~/.claude.json`; enterprise deployments may provide a system
 * `managed-mcp.json`. Loaders read through the Effect `FileSystem`
 * service and decode JSON with Effect Schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as O from "@beep/utils/Option";
import { Config, Effect, FileSystem, Path } from "effect";
import * as A from "effect/Array";
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
 * **Example** (Create an empty MCP file)
 *
 * ```ts
 * import { Mcp } from "effect-claudecode"
 *
 * const file = Mcp.McpJsonFile.make({ mcpServers: {} })
 *
 * console.log(file.mcpServers) // {}
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
 * **Example** (Create an empty project entry)
 *
 * ```ts
 * import { Mcp } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const project = Mcp.ClaudeJsonProject.make({})
 *
 * console.log(O.isNone(project.mcpServers)) // true
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
 * **Details**
 *
 * User-scope servers live at top-level `mcpServers`; local-scope
 * servers live under `projects[projectPath].mcpServers`. Other
 * Claude Code keys are intentionally ignored.
 *
 * **Example** (Create an empty user configuration)
 *
 * ```ts
 * import { Mcp } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const file = Mcp.ClaudeJsonFile.make({})
 *
 * console.log(O.isNone(file.projects)) // true
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
 * **Example** (Override the project MCP path)
 *
 * ```ts
 * import { Mcp } from "effect-claudecode"
 *
 * const options = Mcp.EffectiveMcpLoadOptions.make({ projectMcpPath: "/repo/.mcp.json" })
 * console.log(options.projectMcpPath) // /repo/.mcp.json
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class EffectiveMcpLoadOptions extends S.Class<EffectiveMcpLoadOptions>($I`EffectiveMcpLoadOptions`)(
  {
    claudeJsonPath: S.String.pipe(S.optionalKey),
    projectMcpPath: S.String.pipe(S.optionalKey),
    pluginMcpConfigs: S.Array(McpJsonFile).pipe(S.optionalKey),
    managedMcpRoot: S.String.pipe(S.optionalKey),
    managedMcpRoots: S.Array(S.String).pipe(S.optionalKey),
  },
  $I.annote("EffectiveMcpLoadOptions", {
    description: "Optional path and plugin overrides used while resolving every MCP configuration scope.",
  })
) {}

/**
 * Overrides used while discovering enterprise-managed MCP configuration.
 *
 * **Example** (Override managed roots)
 *
 * ```ts
 * import { Mcp } from "effect-claudecode"
 *
 * const options = Mcp.ManagedMcpLoadOptions.make({ managedMcpRoots: ["/managed"] })
 * console.log(options.managedMcpRoots?.[0]) // /managed
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class ManagedMcpLoadOptions extends S.Class<ManagedMcpLoadOptions>($I`ManagedMcpLoadOptions`)(
  {
    managedMcpRoot: S.String.pipe(S.optionalKey),
    managedMcpRoots: S.Array(S.String).pipe(S.optionalKey),
  },
  $I.annote("ManagedMcpLoadOptions", {
    description: "Optional directory overrides for enterprise-managed MCP configuration discovery.",
  })
) {}

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
 * **Example** (Resolve the user configuration path)
 *
 * ```ts
 * import { Mcp } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 * import * as Path from "effect/Path"
 * import * as Str from "effect/String"
 *
 * const path = Effect.runSync(
 *   Effect.provide(Mcp.userClaudeJsonPath, Path.layer)
 * )
 *
 * console.log(Str.endsWith("/.claude.json")(path)) // true
 * ```
 *
 * @effects Reads the `HOME` or `USERPROFILE` configuration value and requires `Path.Path` to join the path segments.
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
 * **Example** (Resolve a project MCP path)
 *
 * ```ts
 * import { Mcp } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 * import * as Path from "effect/Path"
 *
 * const path = Effect.runSync(
 *   Effect.provide(Mcp.projectMcpJsonPath("/workspace"), Path.layer)
 * )
 *
 * console.log(path) // "/workspace/.mcp.json"
 * ```
 *
 * @effects Requires `Path.Path` to join the project-relative path without accessing the filesystem.
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
  options.pipe(
    O.flatMap((value) => O.fromNullishOr(value.managedMcpRoots)),
    O.orElse(() =>
      options.pipe(
        O.flatMap((value) => O.fromNullishOr(value.managedMcpRoot)),
        O.map(A.make)
      )
    ),
    O.getOrElse(() => defaultManagedMcpRoots)
  );

/**
 * Resolve candidate system `managed-mcp.json` paths.
 *
 * **Example** (Resolve managed MCP candidate paths)
 *
 * ```ts
 * import { Mcp } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 * import * as Path from "effect/Path"
 *
 * const paths = Effect.runSync(
 *   Effect.provide(
 *     Mcp.managedMcpJsonPaths({
 *       managedMcpRoots: ["/etc/claude-code", "/opt/claude-code"]
 *     }),
 *     Path.layer
 *   )
 * )
 *
 * console.log(paths)
 * // ["/etc/claude-code/managed-mcp.json", "/opt/claude-code/managed-mcp.json"]
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
const serverEndpointKey = (server: McpServerConfig): string => {
  if (S.is(StdioMcpServer)(server)) {
    return `command:${server.command}\u0000${A.join(O.getOrElse(server.args, A.empty<string>), "\u0000")}`;
  }
  return `url:${server.url}`;
};

/** @internal */
const removeEndpointDuplicates = (
  servers: Readonly<Record<string, McpServerConfig>>,
  server: McpServerConfig
): Record<string, McpServerConfig> =>
  R.filter(servers, (candidate) => serverEndpointKey(candidate) !== serverEndpointKey(server));

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
 * **Details**
 *
 * Later files replace earlier files by server name and also remove any
 * lower-precedence server with the same URL or stdio command/arguments.
 * Fields inside an individual server entry are never merged.
 *
 * **Example** (Later files win by name and endpoint)
 *
 * ```ts
 * import { Mcp } from "effect-claudecode"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const user = Mcp.McpJsonFile.make({
 *   mcpServers: {
 *     filesystem: Mcp.StdioMcpServer.make({
 *       command: "npx",
 *       args: O.some(["-y", "@modelcontextprotocol/server-filesystem"])
 *     }),
 *     docs: Mcp.HttpMcpServer.make({
 *       type: "http",
 *       url: "https://mcp.example.test/docs"
 *     })
 *   }
 * })
 * const project = Mcp.McpJsonFile.make({
 *   mcpServers: {
 *     filesystem: Mcp.StdioMcpServer.make({
 *       command: "npx",
 *       args: O.some(["-y", "@modelcontextprotocol/server-filesystem", "/repo"])
 *     }),
 *     docsV2: Mcp.HttpMcpServer.make({
 *       type: "http",
 *       url: "https://mcp.example.test/docs"
 *     })
 *   }
 * })
 * const merged = Mcp.mergeMcpJsonFiles([user, project])
 * const filesystem = merged.mcpServers.filesystem
 *
 * console.log(Object.keys(merged.mcpServers).sort()) // ["docsV2", "filesystem"]
 * console.log(S.is(Mcp.StdioMcpServer)(filesystem) ? filesystem.args : undefined)
 * // { _tag: "Some", value: ["-y", "@modelcontextprotocol/server-filesystem", "/repo"] }
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
      withoutReservedServerNames(McpJsonFile.make({ mcpServers }), source).pipe(Effect.asSome),
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
 * **Details**
 *
 * The result contains only fields represented by the current MCP transport
 * schemas and omits the reserved `workspace` server name.
 *
 * **Example** (Create to claude code json)
 *
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
 * **Details**
 *
 * Missing files are errors for this strict loader; use `loadEffective`
 * or `loadManagedMcp` for optional discovery. A server named
 * `workspace` is skipped with a warning because Claude Code reserves
 * that name internally.
 *
 * **Example** (Load a project MCP file and skip reserved names)
 *
 * ```ts
 * import { Mcp, Testing } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const fileSystem = Testing.makeMockFileSystem({
 *   "/workspace/.mcp.json": JSON.stringify({
 *     mcpServers: {
 *       docs: { command: "npx", args: ["-y", "docs-mcp"] },
 *       workspace: { command: "reserved" }
 *     }
 *   })
 * })
 * const file = await Effect.runPromise(
 *   Effect.provide(Mcp.loadJson("/workspace/.mcp.json"), fileSystem.layer)
 * )
 *
 * console.log(Object.keys(file.mcpServers)) // ["docs"]
 * ```
 *
 * @effects Reads and decodes the file through `FileSystem.FileSystem`, logging reserved names and failing with `McpConfigError` on read or decode errors.
 * @category decoding
 * @since 0.0.0
 */
export const loadJson = Effect.fn("Mcp.loadJson")(function* (
  path: string
): Effect.fn.Return<McpJsonFile, McpConfigError, FileSystem.FileSystem> {
  yield* Effect.annotateCurrentSpan("mcp.path", path);
  yield* Effect.logDebug("loading MCP config").pipe(Effect.annotateLogs({ path }));
  const raw = yield* readFileString(path);
  const decoded = yield* S.decodeEffect(McpJsonFileJson)(raw).pipe(
    Effect.mapError((cause) => McpConfigError.make({ path, cause }))
  );
  return yield* withoutReservedServerNames(decoded, path);
});

/**
 * Read a `~/.claude.json` file and decode the MCP-related sections.
 *
 * **Example** (Decode MCP sections from user Claude JSON)
 *
 * ```ts
 * import { Mcp, Testing } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const fileSystem = Testing.makeMockFileSystem({
 *   "/home/user/.claude.json": JSON.stringify({
 *     theme: "dark",
 *     mcpServers: { docs: { command: "user-docs" } }
 *   })
 * })
 * const file = await Effect.runPromise(
 *   Effect.provide(Mcp.loadClaudeJson("/home/user/.claude.json"), fileSystem.layer)
 * )
 *
 * console.log(O.map(file.mcpServers, (servers) => Object.keys(servers)))
 * // { _tag: "Some", value: ["docs"] }
 * ```
 *
 * @effects Reads the file through `FileSystem.FileSystem` and fails with `McpConfigError` when reading or decoding fails.
 * @category decoding
 * @since 0.0.0
 */
export const loadClaudeJson = Effect.fn("Mcp.loadClaudeJson")(function* (
  path: string
): Effect.fn.Return<ClaudeJsonFile, McpConfigError, FileSystem.FileSystem> {
  yield* Effect.annotateCurrentSpan("mcp.claudeJsonPath", path);
  const raw = yield* readFileString(path);
  return yield* S.decodeEffect(ClaudeJsonFileJson)(raw).pipe(
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
 * **Details**
 *
 * Claude Code treats this file as exclusive enterprise control: when it
 * exists, user, project, local, and plugin MCP configs are suppressed.
 *
 * **Example** (Discover the first managed MCP file)
 *
 * ```ts
 * import { Mcp, Testing } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const fileSystem = Testing.makeMockFileSystem({
 *   "/etc/claude-code/managed-mcp.json": JSON.stringify({
 *     mcpServers: { enterprise: { command: "enterprise-mcp" } }
 *   })
 * })
 * const managed = await Effect.runPromise(
 *   Effect.provide(
 *     Mcp.loadManagedMcp({ managedMcpRoots: ["/etc/claude-code"] }),
 *     fileSystem.layer
 *   )
 * )
 * const missing = await Effect.runPromise(
 *   Effect.provide(
 *     Mcp.loadManagedMcp({ managedMcpRoots: ["/no-such-root"] }),
 *     fileSystem.layer
 *   )
 * )
 *
 * console.log(O.map(managed, (file) => Object.keys(file.mcpServers)))
 * // { _tag: "Some", value: ["enterprise"] }
 * console.log(O.isNone(missing)) // true
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
    O.map((value) =>
      O.getSomesStruct({
        managedMcpRoot: O.fromUndefinedOr(value.managedMcpRoot),
        managedMcpRoots: O.fromUndefinedOr(value.managedMcpRoots),
      })
    ),
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
  const localMcp = yield* O.match(
    claudeJson.pipe(O.flatMap((file) => projectClaudeJsonEntry(file, cwd, resolvedCwd))),
    {
      onNone: () => Effect.succeed(O.none<McpJsonFile>()),
      onSome: (project) => mcpFileFromServers(project.mcpServers, `${claudePath}:projects.${resolvedCwd}`),
    }
  );

  return mergeMcpJsonFiles([...sanitizedPluginConfigs, ...A.getSomes([userMcp, projectMcp, localMcp])]);
});

/**
 * Loads the effective MCP configuration for a Claude Code project.
 *
 * **Details**
 *
 * Normal precedence is local (`~/.claude.json` project entry) > project
 * (`.mcp.json`) > user (`~/.claude.json` top-level) > plugins. Whole
 * server entries override lower scopes; fields are not merged. If a
 * system `managed-mcp.json` exists, it has exclusive control and the
 * returned config contains only managed servers.
 *
 * **Example** (Merge local over project over user MCP servers)
 *
 * ```ts
 * import { Mcp, Testing } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const fileSystem = Testing.makeMockFileSystem({
 *   "/home/user/.claude.json": JSON.stringify({
 *     mcpServers: {
 *       docs: { command: "user-docs" },
 *       search: { command: "user-search" }
 *     },
 *     projects: {
 *       "/workspace": {
 *         mcpServers: { docs: { command: "local-docs" } }
 *       }
 *     }
 *   }),
 *   "/workspace/.mcp.json": JSON.stringify({
 *     mcpServers: { search: { command: "project-search" } }
 *   })
 * })
 * const effective = await Effect.runPromise(
 *   Effect.provide(
 *     Mcp.loadEffective("/workspace", {
 *       claudeJsonPath: "/home/user/.claude.json",
 *       managedMcpRoots: ["/no-managed-mcp"]
 *     }),
 *     fileSystem.layer
 *   )
 * )
 * const docs = effective.mcpServers.docs
 * const search = effective.mcpServers.search
 *
 * console.log(Object.keys(effective.mcpServers).sort()) // ["docs", "search"]
 * console.log(S.is(Mcp.StdioMcpServer)(docs) ? docs.command : undefined) // "local-docs"
 * console.log(S.is(Mcp.StdioMcpServer)(search) ? search.command : undefined) // "project-search"
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- The required cwd plus optional scope overrides make a one-argument direct call indistinguishable from a curried overload.
export const loadEffective = (
  cwd: string,
  options?: EffectiveMcpLoadOptions
): Effect.Effect<McpJsonFile, McpConfigError, FileSystem.FileSystem | Path.Path> =>
  loadEffectiveWithOptions(cwd, O.fromNullishOr(options));
