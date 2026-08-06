#!/usr/bin/env node

/**
 * Offline generator for the checked-in gov-legal MCP tool-name report.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ProductionToolNameCollisionReport, renderToolNameCollisionReport } from "@beep/gov-legal-mcp/ToolNames";
import { $GovLegalMcpId } from "@beep/identity/packages";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as S from "effect/Schema";

const $I = $GovLegalMcpId.create("generate");

const PackageMetadata = S.Struct({ version: S.NonEmptyString }).pipe(
  $I.annoteSchema("PackageMetadata", {
    description: "Release metadata read from the gov-legal-mcp package manifest during generation.",
  })
);

const renderVersionModule = (encodedVersion: string): string => `/**
 * Generated release version for the gov-legal MCP package.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Package release version synchronized from package.json.
 *
 * **Example** (Read the gov-legal MCP package version)
 *
 * \`\`\`ts
 * import { VERSION } from "@beep/gov-legal-mcp"
 *
 * console.log(typeof VERSION)
 * // "string"
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const VERSION = ${encodedVersion};
`;

const generateToolNameCollisionReport = Effect.fn("GovLegalMcp.generateToolNameCollisionReport")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const generatedDirectory = path.join(import.meta.dirname, "..", "src", "_generated");
  const packagePath = path.join(import.meta.dirname, "..", "package.json");
  const reportPath = path.join(generatedDirectory, "tool-name-collision-report.json");
  const versionPath = path.join(generatedDirectory, "version.ts");
  const packageMetadata = yield* fs
    .readFileString(packagePath)
    .pipe(Effect.flatMap(S.decodeUnknownEffect(S.fromJsonString(PackageMetadata))));
  const encodedVersion = yield* S.encodeUnknownEffect(S.fromJsonString(S.Unknown))(packageMetadata.version);

  yield* fs.makeDirectory(generatedDirectory, { recursive: true });
  yield* fs.writeFileString(reportPath, renderToolNameCollisionReport(ProductionToolNameCollisionReport));
  yield* fs.writeFileString(versionPath, renderVersionModule(encodedVersion));
  yield* Effect.log(`Generated ${reportPath} and ${versionPath}`);
});

const program = Effect.scoped(
  Layer.build(NodeServices.layer).pipe(
    Effect.flatMap((context) => generateToolNameCollisionReport().pipe(Effect.provide(context)))
  )
);

NodeRuntime.runMain(program);
