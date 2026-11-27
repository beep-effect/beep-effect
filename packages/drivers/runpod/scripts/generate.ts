#!/usr/bin/env bun

import { GenerateConfig, runGenerateCli } from "@beep/codegen-kit";
import * as OpenApiPatch from "@effect/openapi-generator/OpenApiPatch";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import openApiSource from "../openapi.json" with { type: "json" };
import openApiPatchInput from "../openapi.patch.json" with { type: "json" };
import { closedObjectPatch } from "./openapi.lowering.ts";
import { renderRunpodOperations } from "./operations.renderer.ts";

const packageRoot = `${import.meta.dirname}/..`;
const patchDocumentOrEmpty: OpenApiPatch.JsonPatchDocument = pipe(
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
  dialect: "openapi-3.1",
  patches: [
    { source: "openapi.patch.json", patch: patchDocumentOrEmpty },
    { source: "openapi.lowering.ts", patch: closedObjectPatch(openApiSource) },
  ],
  transforms: ["stripExamples"],
  format: "schemas",
  output: {
    path: `${packageRoot}/src/_generated/Runpod.models.gen.ts`,
    exampleImport: "@beep/runpod",
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
