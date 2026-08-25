#!/usr/bin/env bun

import { $GovinfoId } from "@beep/identity";
import * as OpenApiGenerator from "@effect/openapi-generator/OpenApiGenerator";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Effect, FileSystem, Layer, pipe, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Command, Flag } from "effect/unstable/cli";
import { FetchHttpClient, HttpClient, HttpClientResponse } from "effect/unstable/http";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import type { OpenAPISpec } from "effect/unstable/httpapi/OpenApi";

const $I = $GovinfoId.create("scripts/generate");
const GOVINFO_SPEC_URL = "https://api.govinfo.gov/api-docs";
const packageRoot = new URL("../", import.meta.url).pathname;
const repoRoot = new URL("../../../../", import.meta.url).pathname;
const openApiPath = new URL("openapi.json", new URL("../", import.meta.url)).pathname;
const generatedDir = new URL("src/_generated/", new URL("../", import.meta.url)).pathname;
const generatedPath = new URL("src/_generated/Govinfo.gen.ts", new URL("../", import.meta.url)).pathname;

const decodeJson = S.decodeUnknownEffect(S.fromJsonString(S.Json));
const encodePrettyJson = S.encodeEffect(S.fromJsonString(S.Json, { space: 2 }));

class GovinfoGeneratorError extends S.TaggedError<GovinfoGeneratorError>($I`GovinfoGeneratorError`)(
  "GovinfoGeneratorError",
  {
    message: S.String,
  },
  $I.annoteError<GovinfoGeneratorError>("GovinfoGeneratorError", {
    description: "A GovInfo drift-oracle generation step failed.",
  })
) {}

const generatedHeader = `/**
 * Generated from the checked-in GovInfo OpenAPI document.
 *
 * This package-private module is a drift oracle for the hand-written GovInfo
 * contracts. Do not import it from package source or edit it by hand.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

`;

const rewriteNumberSchemas = (source: string): string =>
  pipe(
    source,
    Str.replaceAll(
      /Schema\.optionalKey\(Schema\.Array\(Schema\.String\)\)/gu,
      "Schema.String.pipe(Schema.Array, Schema.optionalKey)"
    ),
    Str.replaceAll(
      /Schema\.Number\.annotate\((\{ "format": "int(?:32|64)" \})\)\.check\(Schema\.isInt\(\)\.annotate\(\{ "expected": "an integer" \}\)\)/gu,
      "Schema.Int.annotate($1)"
    ),
    Str.replaceAll(
      /Schema\.Number\.check\(Schema\.isInt\(\)\.annotate\(\{ "expected": "an integer" \}\)\)/gu,
      "Schema.Int"
    ),
    Str.replaceAll(/Schema\.Number\b/gu, "Schema.Finite")
  );

const rewritePipeableSchemas = (source: string): string =>
  pipe(
    source,
    Str.replaceAll(
      /Schema\.optionalKey\(Schema\.Array\((Schema\.Struct\(\{[^\n]*\}\))\)\)/gu,
      "Schema.Array($1).pipe(Schema.optionalKey)"
    ),
    Str.replaceAll(
      /Schema\.optionalKey\(Schema\.Record\(Schema\.String, Schema\.String\)\)/gu,
      "Schema.Record(Schema.String, Schema.String).pipe(Schema.optionalKey)"
    )
  );

const stripUnusedHttpApiImports = (source: string): string =>
  pipe(
    Str.match(/import \{ ([^}]+) \} from "effect\/unstable\/httpapi"/u)(source),
    O.flatMap((match) =>
      O.all({
        importLine: O.fromUndefinedOr(match[0]),
        names: O.fromUndefinedOr(match[1]),
      })
    ),
    O.map(({ importLine, names }) => {
      const body = pipe(source, Str.replace(importLine, ""));
      const usedNames = pipe(
        names,
        Str.split(", "),
        A.filter((name) => pipe(body, Str.includes(name)))
      );
      const replacement = A.isReadonlyArrayEmpty(usedNames)
        ? ""
        : `import { ${pipe(usedNames, A.join(", "))} } from "effect/unstable/httpapi"`;
      return pipe(source, Str.replace(importLine, replacement));
    }),
    O.getOrElse(() => source)
  );

const postProcess = (source: string): string =>
  pipe(
    source,
    rewriteNumberSchemas,
    rewritePipeableSchemas,
    stripUnusedHttpApiImports,
    (body) => generatedHeader + body
  );

const formatWithBiome = Effect.fn("GovinfoGenerator.formatWithBiome")(function* (
  source: string,
  filePath: string,
  extraArgs: ReadonlyArray<string> = []
) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const args = pipe(["check", "--write", "--unsafe", "--stdin-file-path", filePath], A.appendAll(extraArgs));
  const formatted = yield* spawner
    .string(
      ChildProcess.make("biome", args, {
        cwd: repoRoot,
        stdin: Stream.make(source).pipe(Stream.encodeText),
        stderr: "inherit",
        stdout: "pipe",
      })
    )
    .pipe(
      Effect.mapError((error) =>
        GovinfoGeneratorError.make({ message: `Biome failed for ${filePath}: ${error.message}` })
      )
    );

  if (Str.isEmpty(formatted)) {
    return yield* GovinfoGeneratorError.make({ message: `Biome returned empty output for ${filePath}.` });
  }
  return formatted;
});

/**
 * Generate the package-private GovInfo drift-oracle source from `openapi.json`.
 *
 * **Example** (Generate without writing)
 *
 * ```ts
 * import { generateGovinfoSource } from "../scripts/generate.ts"
 *
 * const source = generateGovinfoSource()
 * console.log(source)
 * ```
 *
 * @category generation
 * @since 0.0.0
 */
export const generateGovinfoSource = Effect.fn("GovinfoGenerator.generateSource")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const raw = yield* fs.readFileString(openApiPath);
  const spec = yield* decodeJson(raw);
  const generator = yield* OpenApiGenerator.OpenApiGenerator;
  let warnings: ReadonlyArray<OpenApiGenerator.OpenApiGeneratorWarning> = [];
  const source = yield* generator.generate(spec as unknown as OpenAPISpec, {
    name: "Govinfo",
    format: "httpapi",
    onWarning: (warning) => {
      warnings = A.append(warnings, warning);
    },
  });

  if (A.isReadonlyArrayNonEmpty(warnings)) {
    return yield* GovinfoGeneratorError.make({
      message: pipe(
        warnings,
        A.map((warning) => `[${warning.code}] ${warning.message}`),
        A.join("\n")
      ),
    });
  }

  return postProcess(source);
});

const refreshSpec = Effect.fn("GovinfoGenerator.refreshSpec")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const responseText = yield* HttpClient.get(GOVINFO_SPEC_URL).pipe(
    Effect.flatMap(HttpClientResponse.filterStatusOk),
    Effect.flatMap((response) => response.text)
  );
  const spec = yield* decodeJson(responseText);
  const pretty = yield* encodePrettyJson(spec);
  const formatted = yield* formatWithBiome(pretty, openApiPath, ["--expand=never"]);
  yield* fs.writeFileString(openApiPath, formatted);
  yield* Effect.log(`Refreshed ${pipe(openApiPath, Str.replace(packageRoot, ""))}`);
});

const writeOrCheckGenerated = Effect.fn("GovinfoGenerator.writeOrCheckGenerated")(function* (check: boolean) {
  const fs = yield* FileSystem.FileSystem;
  const source = yield* generateGovinfoSource();
  const formatted = yield* formatWithBiome(source, generatedPath);

  if (check) {
    const current = yield* fs.readFileString(generatedPath);
    if (!Str.Equivalence(current, formatted)) {
      return yield* GovinfoGeneratorError.make({
        message: `Generated GovInfo drift oracle is stale: ${pipe(generatedPath, Str.replace(packageRoot, ""))}`,
      });
    }
    return yield* Effect.log(`GovInfo drift oracle is current: ${pipe(generatedPath, Str.replace(packageRoot, ""))}`);
  }

  yield* fs.makeDirectory(generatedDir, { recursive: true });
  yield* fs.writeFileString(generatedPath, formatted);
  yield* Effect.log(`Generated ${pipe(generatedPath, Str.replace(packageRoot, ""))}`);
});

const generateCommand = Command.make(
  "generate",
  {
    check: Flag.boolean("check").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Fail when the checked-in drift oracle differs from regenerated output")
    ),
    refresh: Flag.boolean("refresh").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Refresh openapi.json from the official GovInfo API document before generation")
    ),
  },
  ({ check, refresh }) =>
    Effect.gen(function* () {
      if (refresh) {
        yield* refreshSpec();
      }
      yield* writeOrCheckGenerated(check);
    })
).pipe(Command.withDescription("Generate the package-private GovInfo OpenAPI drift oracle."));

const runtimeLayer = Layer.mergeAll(BunServices.layer, FetchHttpClient.layer, OpenApiGenerator.layerTransformerSchema);

const program = Effect.scoped(
  Layer.build(runtimeLayer).pipe(
    Effect.flatMap(
      Effect.fnUntraced(function* (context) {
        return yield* Command.run(generateCommand, { version: "0.0.0" }).pipe(Effect.provide(context));
      })
    )
  )
);

if (import.meta.main) {
  BunRuntime.runMain(program);
}
