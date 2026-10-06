#!/usr/bin/env bun

/**
 * Offline compiled-binary smoke for the practice KG MCP host.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import { $PracticeKgMcpId } from "@beep/identity/packages";
import { buildPracticeKgBundle, PracticeKgOptions, PracticeKgToolkit } from "@beep/law-practice-server";
import { Effect, FileSystem, flow, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { runEntrypoint } from "./entrypoint.ts";
import { SmokeFailure } from "./PracticeKgMcp.errors.ts";
import { loadPracticeKgBundleContext } from "./runtime/Host.ts";
import { makePracticeKgBuildLayer } from "./runtime/Layer.ts";
import { PracticeKgSelfCheckReport } from "./runtime/SelfCheck.ts";

const $I = $PracticeKgMcpId.create("smoke");
const FixtureDigest = `sha256:${Str.repeat(64)("a")}`;
const ExpectedTools = R.keys(PracticeKgToolkit.tools);

class SmokeTool extends S.Class<SmokeTool>($I`SmokeTool`)(
  { name: S.String },
  $I.annote("SmokeTool", { description: "Tool name returned by the compiled MCP host." })
) {}

class SmokeToolsResult extends S.Class<SmokeToolsResult>($I`SmokeToolsResult`)(
  { tools: S.Array(SmokeTool) },
  $I.annote("SmokeToolsResult", { description: "Tool-list payload returned by the compiled MCP host." })
) {}

class SmokeToolsResponse extends S.Class<SmokeToolsResponse>($I`SmokeToolsResponse`)(
  { result: SmokeToolsResult },
  $I.annote("SmokeToolsResponse", { description: "Tool-list JSON-RPC response from the compiled MCP host." })
) {}

class SmokeServerInfo extends S.Class<SmokeServerInfo>($I`SmokeServerInfo`)(
  { name: S.Literal("beep-practice-kg") },
  $I.annote("SmokeServerInfo", { description: "Server identity returned by MCP initialization." })
) {}

// The 2026-07-28 `server/discover` result carries serverInfo under a `_meta`
// key (`SERVER_INFO_META_KEY` in `@beep/mcp-kit/client`); the smoke inlines the
// key so the compiled app keeps its dependency set.
const SERVER_INFO_META_KEY = "io.modelcontextprotocol/serverInfo";
const PROTOCOL_VERSION_META_KEY = "io.modelcontextprotocol/protocolVersion";
const CLIENT_CAPABILITIES_META_KEY = "io.modelcontextprotocol/clientCapabilities";
const CLIENT_INFO_META_KEY = "io.modelcontextprotocol/clientInfo";
const MCP_PROTOCOL_VERSION = "2026-07-28";
class SmokeDiscoverMeta extends S.Class<SmokeDiscoverMeta>($I`SmokeDiscoverMeta`)(
  { [SERVER_INFO_META_KEY]: SmokeServerInfo },
  $I.annote("SmokeDiscoverMeta", { description: "Discover result metadata carrying the server identity." })
) {}
class SmokeDiscoverResult extends S.Class<SmokeDiscoverResult>($I`SmokeDiscoverResult`)(
  { _meta: SmokeDiscoverMeta, supportedVersions: S.Array(S.String) },
  $I.annote("SmokeDiscoverResult", { description: "Initialization payload returned by the compiled MCP host." })
) {}

class SmokeDiscoverResponse extends S.Class<SmokeDiscoverResponse>($I`SmokeDiscoverResponse`)(
  { result: SmokeDiscoverResult },
  $I.annote("SmokeDiscoverResponse", { description: "Initialization JSON-RPC response from the compiled MCP host." })
) {}

class SmokeManifestEnv extends S.Class<SmokeManifestEnv>($I`SmokeManifestEnv`)(
  {
    BUNDLE_DIR: S.String,
    NODE_PATH: S.String,
    PRACTICE_KG_CORPUS_ROOT: S.String,
  },
  $I.annote("SmokeManifestEnv", {
    description: "Env contract Claude Desktop applies when spawning the compiled host.",
  })
) {}

class SmokeManifestMcpConfig extends S.Class<SmokeManifestMcpConfig>($I`SmokeManifestMcpConfig`)(
  { command: S.String, env: SmokeManifestEnv },
  $I.annote("SmokeManifestMcpConfig", { description: "Launch-configuration slice of the MCPB manifest." })
) {}

class SmokeManifestServer extends S.Class<SmokeManifestServer>($I`SmokeManifestServer`)(
  { mcp_config: SmokeManifestMcpConfig },
  $I.annote("SmokeManifestServer", { description: "Server block of the MCPB manifest." })
) {}

class SmokeManifest extends S.Class<SmokeManifest>($I`SmokeManifest`)(
  { server: SmokeManifestServer },
  $I.annote("SmokeManifest", {
    description: "Manifest slice the smoke replays to spawn the compiled host exactly as Claude Desktop does.",
  })
) {}

class SmokeCallContent extends S.Class<SmokeCallContent>($I`SmokeCallContent`)(
  { text: S.String, type: S.Literal("text") },
  $I.annote("SmokeCallContent", { description: "Text content item returned by a compiled-host tool call." })
) {}

class SmokeCallResult extends S.Class<SmokeCallResult>($I`SmokeCallResult`)(
  { content: S.Array(SmokeCallContent) },
  $I.annote("SmokeCallResult", { description: "Tool-call payload returned by the compiled MCP host." })
) {}

class SmokeCallResponse extends S.Class<SmokeCallResponse>($I`SmokeCallResponse`)(
  { result: SmokeCallResult },
  $I.annote("SmokeCallResponse", { description: "Tool-call JSON-RPC response from the compiled MCP host." })
) {}

const decodeDiscover = S.decodeUnknownEffect(S.fromJsonString(SmokeDiscoverResponse));
const decodeTools = S.decodeUnknownEffect(S.fromJsonString(SmokeToolsResponse));
const decodeCall = S.decodeUnknownEffect(S.fromJsonString(SmokeCallResponse));
const decodeManifest = S.decodeUnknownEffect(S.fromJsonString(SmokeManifest));

const substituteManifestTokens = (exeDir: string, bundleOut: string) =>
  flow(
    Str.replace("${__dirname}", exeDir),
    Str.replace("${user_config.bundle_dir}", bundleOut),
    Str.replace("${user_config.corpus_root}", "")
  );

const makeCatalog = Effect.fn("PracticeKgSmoke.makeCatalog")(function* (databasePath: string) {
  const catalogLayer = DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath }));
  const populateCatalog = Effect.gen(function* () {
    const db = yield* DuckDb;
    yield* db.run(`
      CREATE TABLE corpus_source_files (
        run_label VARCHAR, source_label VARCHAR, relative_path VARCHAR, size_bytes BIGINT,
        mtime_iso VARCHAR, digest VARCHAR
      );
      CREATE TABLE corpus_organized (
        digest VARCHAR, source_label VARCHAR, source_relative_path VARCHAR, category VARCHAR,
        client VARCHAR, docket VARCHAR, docket_family VARCHAR, organized_relative_path VARCHAR,
        effective_name VARCHAR, restored BOOLEAN
      );
      CREATE TABLE corpus_enrichment (
        candidate VARCHAR, status VARCHAR, application_number VARCHAR, patent_number VARCHAR,
        invention_title VARCHAR, first_applicant_name VARCHAR, first_inventor_name VARCHAR,
        docket_families VARCHAR, parent_application_numbers VARCHAR
      );
    `);
    yield* db.run(
      "INSERT INTO corpus_source_files VALUES ('base', 'smoke', 'fixture.txt', 13, '2026-01-02T03:04:05.000Z', $1)",
      [FixtureDigest]
    );
    yield* db.run(
      "INSERT INTO corpus_organized VALUES ($1, 'smoke', 'fixture.txt', 'docket', 'fixture-client', '20001US01', '20001', 'dockets/20001/20001US01/fixture.txt', 'fixture.txt', FALSE)",
      [FixtureDigest]
    );
  });
  yield* Effect.scoped(Layer.build(Layer.effectDiscard(populateCatalog).pipe(Layer.provide(catalogLayer))));
});

/**
 * Build the one-document fixture bundle the compiled-host smoke serves.
 *
 * **Details**
 *
 * The bundle is written to `<root>/bundle` from a corpus created under
 * `<root>/corpus`, through the same build layer `practice-kg-build` uses.
 *
 * **Example** (Build the fixture bundle)
 *
 * ```ts
 * import { makePracticeKgSmokeBundle } from "../../src/smoke.ts"
 * import { Effect } from "effect"
 *
 * const building = makePracticeKgSmokeBundle("/work/practice-kg-smoke")
 * console.log(Effect.isEffect(building)) // true
 * ```
 *
 * @param root - Empty directory that receives the fixture corpus and bundle.
 * @category testing
 * @since 0.0.0
 */
export const makePracticeKgSmokeBundle = Effect.fn("PracticeKgSmoke.makeFixtureBundle")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const corpusRoot = path.join(root, "corpus");
  const catalogRoot = path.join(corpusRoot, "catalog");
  const extractRoot = path.join(corpusRoot, "staging", "extract");
  const textRoot = path.join(extractRoot, "text");
  const bundleOut = path.join(root, "bundle");
  yield* fs.makeDirectory(catalogRoot, { recursive: true });
  yield* fs.makeDirectory(textRoot, { recursive: true });
  yield* fs.makeDirectory(bundleOut, { recursive: true });
  yield* makeCatalog(path.join(catalogRoot, "corpus.duckdb"));
  yield* fs.writeFileString(
    path.join(extractRoot, "sources.jsonl"),
    `{"artifactId":"artifact-smoke","digest":"${FixtureDigest}","engine":"tika","format":"text","operationId":"operation:smoke","relativePath":"text/operation:smoke.txt","sizeBytes":13,"status":"succeeded"}\n`
  );
  yield* fs.writeFileString(path.join(textRoot, "operation:smoke.txt"), "smoke fixture");
  const buildLayer = makePracticeKgBuildLayer(path.join(bundleOut, "kg.pglite"));
  const buildBundle = buildPracticeKgBundle(
    PracticeKgOptions.make({
      bundleOut,
      corpusRoot,
      includeRefresh: false,
      overwrite: false,
      skipEmails: true,
    })
  );
  yield* Effect.scoped(Layer.build(Layer.effectDiscard(buildBundle).pipe(Layer.provide(buildLayer))));
  return bundleOut;
});

// fallow-ignore-next-line complexity -- stdio smoke harness; IS the coverage for the compiled artifact
const runCompiledHost = Effect.fn("PracticeKgSmoke.runCompiledHost")(function* (
  executable: string,
  bundleOut: string,
  neutralCwd: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const exeDir = path.dirname(executable);
  const manifestText = yield* fs
    .readFileString(path.join(exeDir, "manifest.json"))
    .pipe(
      Effect.mapError((cause) => SmokeFailure.make({ cause, message: "Failed reading the staged manifest.json." }))
    );
  // Decoding the manifest slice is the contract check: dropping NODE_PATH from
  // mcp_config.env fails the smoke here, before the host even spawns.
  const manifest = yield* decodeManifest(manifestText).pipe(
    Effect.mapError((cause) =>
      SmokeFailure.make({ cause, message: "Staged manifest.json broke the mcp_config contract." })
    )
  );
  const substitute = substituteManifestTokens(exeDir, bundleOut);
  // bin.ts resolves PRACTICE_KG_BUNDLE_DIR ahead of the manifest's BUNDLE_DIR, so an ambient
  // value in a developer or CI shell would aim the compiled host at another bundle and let the
  // smoke pass without proving the staged artifact. Dropping both higher-precedence overrides
  // also leaves PRACTICE_KG_CORPUS_ROOT unset, mirroring the pointer-only install.
  const ambientEnv: Record<string, string | undefined> = { ...Bun.env };
  const hostEnv = R.remove(R.remove(ambientEnv, "PRACTICE_KG_BUNDLE_DIR"), "PRACTICE_KG_CORPUS_ROOT");
  // 2026-07-28 framing: no initialize handshake; every request carries the
  // protocol version, client capabilities and client info in `_meta`.
  const requestMeta = `{"${PROTOCOL_VERSION_META_KEY}":"${MCP_PROTOCOL_VERSION}","${CLIENT_CAPABILITIES_META_KEY}":{},"${CLIENT_INFO_META_KEY}":{"name":"compiled-smoke","version":"0.0.0"}}`;
  const frame = (id: number, method: string, params: string): string =>
    `{"jsonrpc":"2.0","id":${id},"method":"${method}","params":${params}}`;
  const pipeScript =
    `{ printf '%s\\n' '${frame(1, "server/discover", `{"_meta":${requestMeta}}`)}'; sleep 2; ` +
    `printf '%s\\n' '${frame(2, "tools/list", `{"_meta":${requestMeta}}`)}'; sleep 1; ` +
    `printf '%s\\n' '${frame(3, "tools/call", `{"name":"corpus_search_text","arguments":{"query":"fixture"},"_meta":${requestMeta}}`)}'; sleep 3; } ` +
    `| "$1"`;
  const child = yield* Effect.try({
    try: () =>
      // Desktop-faithful spawn: a neutral cwd (Desktop never launches from the extension
      // dir, so resolution must not lean on cwd-adjacent node_modules) and configuration
      // through the manifest env alone.
      Bun.spawn(["sh", "-c", pipeScript, "practice-kg-smoke", executable], {
        cwd: neutralCwd,
        env: {
          ...hostEnv,
          BUNDLE_DIR: substitute(manifest.server.mcp_config.env.BUNDLE_DIR),
          NODE_PATH: substitute(manifest.server.mcp_config.env.NODE_PATH),
        },
        stderr: "inherit",
        stdout: "pipe",
      }),
    catch: (cause) => SmokeFailure.make({ cause, message: "Compiled host stdio smoke failed." }),
  });
  const responseText = yield* Effect.tryPromise({
    try: () => new Response(child.stdout).text(),
    catch: (cause) => SmokeFailure.make({ cause, message: "Failed reading compiled host responses." }),
  });
  const exitCode = yield* Effect.tryPromise({
    try: () => child.exited,
    catch: (cause) => SmokeFailure.make({ cause, message: "Failed waiting for the compiled host." }),
  });
  if (exitCode !== 0 && exitCode !== 130) {
    return yield* SmokeFailure.make({ message: `Compiled host exited with code ${exitCode}.` });
  }
  const lines = A.filter(Str.split("\n")(Str.trim(responseText)), Str.isNonEmpty);
  const responseLine = (index: number, what: string) =>
    A.get(lines, index).pipe(
      O.match({
        onNone: () => SmokeFailure.make({ message: `Compiled host returned no ${what} response.` }),
        onSome: Effect.succeed,
      })
    );
  const discoverLine = yield* responseLine(0, "server/discover");
  const toolsLine = yield* responseLine(1, "tools/list");
  // Server-name mismatch fails here too: SmokeServerInfo.name is a literal.
  const discover = yield* decodeDiscover(discoverLine).pipe(
    Effect.mapError((cause) => SmokeFailure.make({ cause, message: "server/discover response was invalid." }))
  );
  if (!A.contains(discover.result.supportedVersions, MCP_PROTOCOL_VERSION)) {
    return yield* SmokeFailure.make({
      message: `Compiled host does not advertise ${MCP_PROTOCOL_VERSION}: ${A.join(discover.result.supportedVersions, ", ")}`,
    });
  }
  const tools = yield* decodeTools(toolsLine).pipe(
    Effect.mapError((cause) => SmokeFailure.make({ cause, message: "Tools/list response was invalid." }))
  );
  const names = A.map(tools.result.tools, (tool) => tool.name);
  if (names.length !== A.length(ExpectedTools) || !A.every(ExpectedTools, (name) => A.contains(names, name))) {
    return yield* SmokeFailure.make({
      message: `Compiled host did not list the expected toolkit tools: ${A.join(names, ", ")}`,
    });
  }
  const callLine = yield* responseLine(2, "corpus_search_text");
  const call = yield* decodeCall(callLine).pipe(
    Effect.mapError((cause) => SmokeFailure.make({ cause, message: "corpus_search_text response was invalid." }))
  );
  // Every tool result carries bundle_version; its presence proves the DuckDB-backed
  // query path executed inside the compiled host, not just the JSON-RPC plumbing.
  const callText = A.head(call.result.content).pipe(
    O.map((item) => item.text),
    O.getOrElse(() => "")
  );
  if (!Str.includes("bundle_version")(callText)) {
    return yield* SmokeFailure.make({ message: "corpus_search_text result did not include bundle_version." });
  }
  yield* Effect.logInfo("COMPILED_SMOKE_OK", {
    discover: discover.result._meta[SERVER_INFO_META_KEY].name,
    toolCount: names.length,
    tools: A.join(names, ","),
  });
});

// Claude Desktop opens every server with a classic `initialize` handshake. The
// first hand-off of a stateless-only host failed there with "initialize is not
// supported by the configured MCP protocols", so the smoke proves the handshake
// against the compiled artifact as well as the stateless framing above.
const HANDSHAKE_PROTOCOL_VERSION = "2025-11-25";

class SmokeInitializeResult extends S.Class<SmokeInitializeResult>($I`SmokeInitializeResult`)(
  { protocolVersion: S.Literal(HANDSHAKE_PROTOCOL_VERSION), serverInfo: SmokeServerInfo },
  $I.annote("SmokeInitializeResult", { description: "Initialize result negotiated by the compiled MCP host." })
) {}

class SmokeInitializeResponse extends S.Class<SmokeInitializeResponse>($I`SmokeInitializeResponse`)(
  { id: S.Literal(0), result: SmokeInitializeResult },
  $I.annote("SmokeInitializeResponse", { description: "Initialize JSON-RPC response from the compiled MCP host." })
) {}

class SmokeHandshakeToolsResponse extends S.Class<SmokeHandshakeToolsResponse>($I`SmokeHandshakeToolsResponse`)(
  { id: S.Literal(1), result: SmokeToolsResult },
  $I.annote("SmokeHandshakeToolsResponse", { description: "Tool list returned after an initialize handshake." })
) {}

const decodeInitialize = S.decodeUnknownEffect(S.fromJsonString(SmokeInitializeResponse));
const decodeHandshakeTools = S.decodeUnknownEffect(S.fromJsonString(SmokeHandshakeToolsResponse));

const runCompiledHandshake = Effect.fn("PracticeKgSmoke.runCompiledHandshake")(function* (
  executable: string,
  bundleOut: string,
  neutralCwd: string
) {
  const path = yield* Path.Path;
  const initialize = `{"jsonrpc":"2.0","id":0,"method":"initialize","params":{"protocolVersion":"${HANDSHAKE_PROTOCOL_VERSION}","capabilities":{},"clientInfo":{"name":"compiled-smoke","version":"0.0.0"}}}`;
  const pipeScript =
    `{ printf '%s\\n' '${initialize}'; sleep 2; ` +
    `printf '%s\\n' '{"jsonrpc":"2.0","method":"notifications/initialized"}'; sleep 1; ` +
    `printf '%s\\n' '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'; sleep 3; } | "$1"`;
  const responseText = yield* Effect.tryPromise({
    try: () =>
      new Response(
        Bun.spawn(["sh", "-c", pipeScript, "practice-kg-handshake", executable], {
          cwd: neutralCwd,
          env: { ...Bun.env, BUNDLE_DIR: bundleOut, NODE_PATH: path.join(path.dirname(executable), "node_modules") },
          stderr: "inherit",
          stdout: "pipe",
        }).stdout
      ).text(),
    catch: (cause) => SmokeFailure.make({ cause, message: "Compiled host handshake smoke failed." }),
  });
  const lines = A.filter(Str.split("\n")(Str.trim(responseText)), Str.isNonEmpty);
  const handshakeFailure = (message: string) => (cause: unknown) => SmokeFailure.make({ cause, message });
  yield* Effect.fromOption(A.get(lines, 0)).pipe(
    Effect.flatMap(decodeInitialize),
    Effect.mapError(
      handshakeFailure(`Compiled host did not negotiate initialize ${HANDSHAKE_PROTOCOL_VERSION}: ${responseText}`)
    )
  );
  const tools = yield* Effect.fromOption(A.get(lines, 1)).pipe(
    Effect.flatMap(decodeHandshakeTools),
    Effect.mapError(handshakeFailure("Compiled host returned no tool list after the initialize handshake."))
  );
  yield* Effect.succeed(A.length(tools.result.tools)).pipe(
    Effect.filterOrFail(
      (count) => count === A.length(ExpectedTools),
      (count) => SmokeFailure.make({ message: `Handshake session listed ${count} tools.` })
    )
  );
  yield* Effect.logInfo("COMPILED_HANDSHAKE_OK", { protocolVersion: HANDSHAKE_PROTOCOL_VERSION });
});

const decodeSelfCheck = S.decodeUnknownEffect(S.fromJsonString(PracticeKgSelfCheckReport));

// The install proof a person cannot give over SSH: the compiled host opens the
// bundle and both stores and reports them on one line, with stdin closed.
const runCompiledSelfCheck = Effect.fn("PracticeKgSmoke.runCompiledSelfCheck")(function* (
  executable: string,
  bundleOut: string,
  neutralCwd: string
) {
  const path = yield* Path.Path;
  const selfCheckFailure = (message: string) => (cause: unknown) => SmokeFailure.make({ cause, message });
  const expected = yield* loadPracticeKgBundleContext(bundleOut).pipe(
    Effect.mapError(selfCheckFailure("Fixture bundle manifest could not be read for the self-check smoke."))
  );
  const child = yield* Effect.try({
    try: () =>
      Bun.spawn([executable, "--self-check"], {
        cwd: neutralCwd,
        env: { ...Bun.env, BUNDLE_DIR: bundleOut, NODE_PATH: path.join(path.dirname(executable), "node_modules") },
        stderr: "inherit",
        stdin: "ignore",
        stdout: "pipe",
      }),
    catch: selfCheckFailure("Compiled host self-check could not start."),
  });
  const output = yield* Effect.tryPromise({
    try: () => new Response(child.stdout).text(),
    catch: selfCheckFailure("Failed reading the compiled host self-check line."),
  });
  const exitCode = yield* Effect.tryPromise({
    try: () => child.exited,
    catch: selfCheckFailure("Failed waiting for the compiled host self-check."),
  });
  const lines = A.filter(Str.split("\n")(Str.trim(output)), Str.isNonEmpty);
  const report = yield* Effect.succeed(lines).pipe(
    Effect.filterOrFail(
      (printed) => exitCode === 0 && A.length(printed) === 1,
      () => SmokeFailure.make({ message: `Compiled host self-check exited ${exitCode} after printing: ${output}` })
    ),
    Effect.flatMap(flow(A.join("\n"), decodeSelfCheck)),
    Effect.mapError(selfCheckFailure(`Compiled host self-check line was invalid: ${output}`))
  );
  yield* Effect.succeed(report).pipe(
    Effect.filterOrFail(
      (line) => line.bundleVersion === expected.manifest.bundleVersion && line.tools === A.length(ExpectedTools),
      () => SmokeFailure.make({ message: `Compiled host self-check reported another bundle or toolkit: ${output}` })
    )
  );
  yield* Effect.logInfo("COMPILED_SELF_CHECK_OK", { bundleVersion: report.bundleVersion, tools: report.tools });
});

const program = Effect.scoped(
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const root = yield* fs.makeTempDirectoryScoped({ prefix: "practice-kg-compiled-smoke-" });
    const bundleOut = yield* makePracticeKgSmokeBundle(root);
    const executable = path.resolve(import.meta.dir, "..", "dist", "mcpb", "linux-x64", "practice-kg-mcp");
    if (!(yield* fs.exists(executable))) {
      return yield* SmokeFailure.make({
        message: `Compiled Linux host is missing at "${executable}"; run the package:mcpb:linux script first.`,
      });
    }
    yield* runCompiledHost(executable, bundleOut, root);
    yield* runCompiledHandshake(executable, bundleOut, root);
    yield* runCompiledSelfCheck(executable, bundleOut, root);
  })
);
runEntrypoint({ isMain: import.meta.main, program });
