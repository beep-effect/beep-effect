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
import { BunRuntime } from "@effect/platform-bun";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Effect, FileSystem, flow, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { makePracticeKgBuildLayer } from "./runtime/Layer.ts";

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

class SmokeInitializeResult extends S.Class<SmokeInitializeResult>($I`SmokeInitializeResult`)(
  { serverInfo: SmokeServerInfo },
  $I.annote("SmokeInitializeResult", { description: "Initialization payload returned by the compiled MCP host." })
) {}

class SmokeInitializeResponse extends S.Class<SmokeInitializeResponse>($I`SmokeInitializeResponse`)(
  { result: SmokeInitializeResult },
  $I.annote("SmokeInitializeResponse", { description: "Initialization JSON-RPC response from the compiled MCP host." })
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

class SmokeFailure extends S.TaggedError<SmokeFailure>($I`SmokeFailure`)(
  "SmokeFailure",
  {
    cause: S.optionalKey(S.Defect({ includeStack: true })),
    message: S.NonEmptyString,
  },
  $I.annote("SmokeFailure", { description: "Sanitized compiled-host smoke failure." })
) {}

const decodeInitialize = S.decodeUnknownEffect(S.fromJsonString(SmokeInitializeResponse));
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
        effective_name VARCHAR
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
      "INSERT INTO corpus_organized VALUES ($1, 'smoke', 'fixture.txt', 'docket', 'fixture-client', '20001US01', '20001', 'dockets/20001/20001US01/fixture.txt', 'fixture.txt')",
      [FixtureDigest]
    );
  });
  yield* Effect.scoped(Layer.build(Layer.effectDiscard(populateCatalog).pipe(Layer.provide(catalogLayer))));
});

const makeFixtureBundle = Effect.fn("PracticeKgSmoke.makeFixtureBundle")(function* (root: string) {
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
  const pipeScript =
    `{ printf '%s\\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"compiled-smoke","version":"0.0.0"}}}'; sleep 2; ` +
    `printf '%s\\n' '{"jsonrpc":"2.0","method":"notifications/initialized"}'; sleep 1; ` +
    `printf '%s\\n' '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'; sleep 1; ` +
    `printf '%s\\n' '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"corpus_search_text","arguments":{"query":"fixture"}}}'; sleep 3; } ` +
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
  const initializeLine = yield* responseLine(0, "initialize");
  const toolsLine = yield* responseLine(1, "tools/list");
  // Server-name mismatch fails here too: SmokeServerInfo.name is a literal.
  const initialize = yield* decodeInitialize(initializeLine).pipe(
    Effect.mapError((cause) => SmokeFailure.make({ cause, message: "Initialize response was invalid." }))
  );
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
    initialize: initialize.result.serverInfo.name,
    toolCount: names.length,
    tools: A.join(names, ","),
  });
});

const program = Effect.scoped(
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const root = yield* fs.makeTempDirectoryScoped({ prefix: "practice-kg-compiled-smoke-" });
    const bundleOut = yield* makeFixtureBundle(root);
    const executable = path.resolve(import.meta.dir, "..", "dist", "mcpb", "linux-x64", "practice-kg-mcp");
    if (!(yield* fs.exists(executable))) {
      return yield* SmokeFailure.make({
        message: `Compiled Linux host is missing at "${executable}"; run the package:mcpb:linux script first.`,
      });
    }
    yield* runCompiledHost(executable, bundleOut, root);
  })
);
const main = Effect.scoped(Layer.build(Layer.effectDiscard(program).pipe(Layer.provide(BunServices.layer))));

if (import.meta.main) {
  BunRuntime.runMain(main);
}
