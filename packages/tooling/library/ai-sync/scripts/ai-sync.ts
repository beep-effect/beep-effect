#!/usr/bin/env bun

import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Console, Effect, Layer, Match } from "effect";
import * as A from "effect/Array";
import { checkGeneratedArtifacts, checkStrictDrift } from "../src/drift.ts";
import { AiSyncHttpLayer, generateAiSyncArtifacts } from "../src/generator.ts";
import { defaultRepoRoot, validateCurrentCheckoutDogfoodConfigs, validateRepoConfig } from "../src/validation.ts";

const runtimeLayer = Layer.mergeAll(NodeServices.layer, AiSyncHttpLayer);

const readFlag = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  if (index < 0) {
    return undefined;
  }
  return process.argv[index + 1];
};

const reportError = (error: { readonly message: string }) => Console.error(error.message).pipe(Effect.as(1));

const validateCommand = Effect.fnUntraced(function* () {
  const repoRoot = readFlag("--repo-root") ?? (yield* defaultRepoRoot());
  const config = readFlag("--config") ?? ".codex/config.toml";
  const result = yield* validateRepoConfig({ repoRoot, config });
  yield* Console.log(`Validated ${result.relativePath} with ${result.schemaId}.`);
  return 0;
});

const command = process.argv[2] ?? "help";

const driftCommand = Effect.fnUntraced(function* () {
  const report = process.argv.includes("--strict") ? yield* checkStrictDrift() : yield* checkGeneratedArtifacts();

  return A.length(report.findings) > 0
    ? yield* Console.error(`AI sync drift found ${report.findings.length} source(s).`).pipe(Effect.as(1))
    : yield* Console.log(`AI sync ${report.mode} drift check passed.`).pipe(Effect.as(0));
});

const program = Match.value(command).pipe(
  Match.when("generate", () => generateAiSyncArtifacts().pipe(Effect.as(0))),
  Match.when("refresh", () => generateAiSyncArtifacts().pipe(Effect.as(0))),
  Match.when("check", () =>
    checkGeneratedArtifacts().pipe(
      Effect.flatMap(() => validateCurrentCheckoutDogfoodConfigs()),
      Effect.tap((results) =>
        Effect.forEach(results, (result) =>
          Console.log(`Validated ${result.relativePath} with ${result.schemaId} and repo safety policy.`)
        )
      ),
      Effect.as(0)
    )
  ),
  Match.when("drift", () =>
    process.argv.includes("--refresh") ? generateAiSyncArtifacts().pipe(Effect.as(0)) : driftCommand()
  ),
  Match.when("validate", validateCommand),
  Match.orElse(() =>
    Console.log(
      "Usage: ai-sync <generate|refresh|check|drift|validate> [--strict] [--refresh] [--repo-root path] [--config path]"
    ).pipe(Effect.as(0))
  )
);

const main = Effect.scoped(
  Layer.build(runtimeLayer).pipe(
    Effect.flatMap((context) =>
      program.pipe(
        Effect.catchTag("AiSyncError", reportError),
        Effect.flatMap((code) =>
          code === 0
            ? Effect.void
            : Effect.sync(() => {
                process.exitCode = code;
              })
        ),
        Effect.provide(context)
      )
    )
  )
);

NodeRuntime.runMain(main);
