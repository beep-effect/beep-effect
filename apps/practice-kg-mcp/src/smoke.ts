#!/usr/bin/env bun
// @effect-diagnostics strictEffectProvide:skip-file

/**
 * Offline compiled-binary smoke for the practice KG MCP host.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import { $PracticeKgMcpId } from "@beep/identity/packages";
import { buildPracticeKgBundle, PracticeKgOptions, PracticeKgToolkit } from "@beep/law-practice-server";
import { NonNegativeInt, TaggedErrorClass } from "@beep/schema";
import { BunRuntime } from "@effect/platform-bun";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Effect, FileSystem, Layer, Path } from "effect";
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
  { name: S.String },
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

class SmokeFailure extends TaggedErrorClass<SmokeFailure>($I`SmokeFailure`)(
  "SmokeFailure",
  {
    cause: S.optionalKey(S.Defect({ includeStack: true })),
    message: S.NonEmptyString,
  },
  $I.annote("SmokeFailure", { description: "Sanitized compiled-host smoke failure." })
) {}

const decodeInitialize = S.decodeUnknownEffect(S.fromJsonString(SmokeInitializeResponse));
const decodeTools = S.decodeUnknownEffect(S.fromJsonString(SmokeToolsResponse));

const makeCatalog = Effect.fn("PracticeKgSmoke.makeCatalog")(function* (databasePath: string) {
  yield* Effect.gen(function* () {
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
  }).pipe(Effect.provide(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath }))), Effect.scoped);
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
    `{"artifactId":"artifact-smoke","digest":"${FixtureDigest}","engine":"tika","format":"text","operationId":"smoke","relativePath":"text/operation:smoke.txt","sizeBytes":13,"status":"succeeded"}\n`
  );
  yield* fs.writeFileString(path.join(textRoot, "operation:smoke.txt"), "smoke fixture");
  yield* Effect.scoped(
    Layer.build(makePracticeKgBuildLayer(path.join(bundleOut, "kg.pglite"))).pipe(
      Effect.flatMap((context) =>
        buildPracticeKgBundle(
          PracticeKgOptions.make({
            bundleOut,
            corpusRoot,
            includeRefresh: false,
            maxTextBytes: NonNegativeInt.make(2_097_152),
            overwrite: false,
            skipEmails: true,
          })
        ).pipe(Effect.provide(context))
      )
    )
  );
  return bundleOut;
});

// fallow-ignore-next-line complexity -- stdio smoke harness; IS the coverage for the compiled artifact
const runCompiledHost = Effect.fn("PracticeKgSmoke.runCompiledHost")(function* (executable: string, bundleOut: string) {
  const path = yield* Path.Path;
  const pipeScript =
    `{ printf '%s\\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"compiled-smoke","version":"0.0.0"}}}'; sleep 1; ` +
    `printf '%s\\n' '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'; sleep 1; } ` +
    `| "$1" --bundle-dir "$2"`;
  const child = yield* Effect.try({
    try: () =>
      Bun.spawn(["sh", "-c", pipeScript, "practice-kg-smoke", executable, bundleOut], {
        cwd: path.dirname(executable),
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
  const initializeLine = yield* A.get(lines, 0).pipe(
    O.match({
      onNone: () => SmokeFailure.make({ message: "Compiled host returned no initialize response." }),
      onSome: Effect.succeed,
    })
  );
  const toolsLine = yield* A.get(lines, 1).pipe(
    O.match({
      onNone: () => SmokeFailure.make({ message: "Compiled host returned no tools/list response." }),
      onSome: Effect.succeed,
    })
  );
  const initialize = yield* decodeInitialize(initializeLine).pipe(
    Effect.mapError((cause) => SmokeFailure.make({ cause, message: "Initialize response was invalid." }))
  );
  const tools = yield* decodeTools(toolsLine).pipe(
    Effect.mapError((cause) => SmokeFailure.make({ cause, message: "Tools/list response was invalid." }))
  );
  const names = A.map(tools.result.tools, (tool) => tool.name);
  if (initialize.result.serverInfo.name !== "beep-practice-kg") {
    return yield* SmokeFailure.make({ message: "Compiled host returned the wrong server name." });
  }
  if (names.length !== A.length(ExpectedTools) || !A.every(ExpectedTools, (name) => A.contains(names, name))) {
    return yield* SmokeFailure.make({
      message: `Compiled host did not list the expected toolkit tools: ${A.join(names, ", ")}`,
    });
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
    yield* runCompiledHost(executable, bundleOut);
  })
).pipe(Effect.provide(BunServices.layer));

if (import.meta.main) {
  BunRuntime.runMain(program);
}
