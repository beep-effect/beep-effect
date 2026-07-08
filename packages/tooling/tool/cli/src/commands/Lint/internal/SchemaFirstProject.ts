/**
 * Project and owner-resolution adapters for schema-first lint scans.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { isExcludedTypeScriptSourcePath } from "@beep/repo-utils/schemas/TypeScriptSourceExclusions";
import { Effect, Path } from "effect";
import { createRepoTsMorphProject, createWorkspaceOwnerResolver } from "../../../internal/tsmorph/index.js";
import { SchemaFirstSourceFileGlobs } from "../Lint.schemas.js";

/**
 * Create the package-owner resolver used by schema-first repository scans.
 *
 * @example
 * ```ts
 * import { makeSchemaFirstOwnerResolver } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(makeSchemaFirstOwnerResolver)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const makeSchemaFirstOwnerResolver = Effect.fn("makeSchemaFirstOwnerResolver")(function* (
  root?: undefined | string
) {
  const base = root ?? process.cwd();
  return yield* createWorkspaceOwnerResolver({
    root: base,
    fallbackOwner: "@beep/root",
    fallbackPrefixes: [{ prefix: "infra/", owner: "@beep/infra" }],
  });
});

/**
 * Create a ts-morph project loaded with the schema-first scan source globs.
 *
 * @example
 * ```ts
 * import { makeSchemaFirstProject } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(makeSchemaFirstProject)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const makeSchemaFirstProject = Effect.fn("makeSchemaFirstProject")(function* () {
  const path = yield* Path.Path;
  return createRepoTsMorphProject({
    tsConfigFilePath: path.join(process.cwd(), "tsconfig.json"),
    sourceFileGlobs: SchemaFirstSourceFileGlobs,
  });
});

/**
 * Predicate for source paths excluded from schema-first scans.
 *
 * @example
 * ```ts
 * import { isSchemaFirstExcludedFile } from "@beep/repo-cli/test/Lint"
 *
 * console.log(isSchemaFirstExcludedFile("packages/demo/dist/index.ts"))
 * ```
 * @category predicates
 * @since 0.0.0
 */
export const isSchemaFirstExcludedFile = isExcludedTypeScriptSourcePath;
