#!/usr/bin/env bun

import { GenerateConfig, runGenerateCli } from "@beep/codegen-kit";
import * as OpenApiPatch from "@effect/openapi-generator/OpenApiPatch";
import { pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import openApiPatchInput from "../openapi.patch.json" with { type: "json" };
import { renderRunpodOperations } from "./internal/operations.renderer.ts";

const packageRoot = `${import.meta.dirname}/..`;
// The extra renderer decodes this input as an Effect and fails before writes.
// This fallback only keeps synchronous GenerateConfig construction total.
const patchDocument: OpenApiPatch.JsonPatchDocument = pipe(
  S.decodeUnknownOption(OpenApiPatch.JsonPatchDocument)(openApiPatchInput),
  O.getOrElse(() => [])
);

const config = GenerateConfig.make({
  packageName: "@beep/runpod",
  identity: {
    composer: "$RunpodId",
    moduleId: "Runpod.generated",
  },
  source: {
    _tag: "file",
    path: `${packageRoot}/openapi.json`,
  },
  dialect: "openapi-3.0",
  patches: [{ source: "openapi.patch.json", patch: patchDocument }],
  transforms: ["stripExamples"],
  format: "schemas",
  schemaStyle: "class",
  output: {
    path: `${packageRoot}/src/_generated/Runpod.models.gen.ts`,
  },
  extraModules: [
    {
      renderer: "runpod-operations",
      path: `${packageRoot}/src/_generated/Runpod.operations.gen.ts`,
    },
  ],
});

runGenerateCli(config, {
  extraRenderers: { "runpod-operations": renderRunpodOperations },
});
