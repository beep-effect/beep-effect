/**
 * Shared command-line entrypoint for package code generators.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Layer } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { Command, Flag } from "effect/unstable/cli";
import { FetchHttpClient } from "effect/unstable/http";
import { CodegenGenerateError } from "./CodegenKit.errors.ts";
import { GenerateConfig as GenerateConfigSchema } from "./CodegenKit.models.ts";
import { CodegenKit } from "./CodegenKit.service.ts";
import type { GenerateConfig } from "./CodegenKit.models.ts";
import type { ExtraRendererRegistry } from "./CodegenKit.service.ts";

/**
 * Options for package-specific generator entrypoints.
 *
 * @category configuration
 * @since 0.0.0
 */
export interface GenerateCliOptions {
  readonly extraRenderers?: ExtraRendererRegistry | undefined;
}

const incompatibleFlags = CodegenGenerateError.make({
  message: "--check is offline and cannot be combined with --refresh",
  cause: "incompatible codegen flags",
});

const isGenerateConfig = S.is(GenerateConfigSchema);

const runCli = (config: GenerateConfig, options: GenerateCliOptions = {}): void => {
  const command = Command.make(
    "generate",
    {
      check: Flag.boolean("check").pipe(Flag.withDefault(false)),
      refresh: Flag.boolean("refresh").pipe(Flag.withDefault(false)),
    },
    Effect.fn("CodegenKit.cli")(function* ({ check, refresh }) {
      if (check && refresh) return yield* incompatibleFlags;
      const kit = yield* CodegenKit;
      yield* kit.run(config, check ? "check" : "write", refresh);
    })
  ).pipe(Command.withDescription("Generate source from a pinned local spec cache."));

  const platform = Layer.merge(NodeServices.layer, FetchHttpClient.layer);
  const kit = CodegenKit.layer(options.extraRenderers).pipe(Layer.provide(platform));
  const runtime = Layer.merge(platform, kit);
  const program = Effect.scoped(
    Layer.build(runtime).pipe(
      Effect.flatMap((context) => Command.run(command, { version: "0.0.0" }).pipe(Effect.provide(context)))
    )
  );
  NodeRuntime.runMain(program);
};

/**
 * Runs a package generator with offline check mode and explicit cache refresh.
 *
 * **Example** (Launch a local generator)
 *
 * ```ts
 * import { GenerateConfig, runGenerateCli } from "@beep/codegen-kit"
 *
 * const config = GenerateConfig.make({
 *   packageName: "@beep/example",
 *   identity: { composer: "$ExampleId", moduleId: "_generated/schema.gen" },
 *   source: { _tag: "file", path: "spec/schema.json" },
 *   dialect: "json-schema-2020-12",
 *   format: "schemas",
 *   output: { path: "src/_generated/schema.gen.ts" }
 * })
 *
 * if (import.meta.main) runGenerateCli(config)
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const runGenerateCli: {
  (options?: GenerateCliOptions): (config: GenerateConfig) => void;
  (config: GenerateConfig, options?: GenerateCliOptions): void;
} = dual(
  (args) => isGenerateConfig(args[0]),
  (config: GenerateConfig, options?: GenerateCliOptions): void => runCli(config, options)
);
