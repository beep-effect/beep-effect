/**
 * Project and owner-resolution adapters for schema-first lint scans.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { isExcludedTypeScriptSourcePath } from "@beep/repo-utils/schemas/TypeScriptSourceExclusions";
import { Effect, Path } from "effect";
import { createRepoTsMorphProject, createWorkspaceOwnerResolver } from "../../../internal/tsmorph/index.ts";
import { isEcosystemMemberSourcePath } from "../../Laws/internal/LawScan.ts";
import { SchemaFirstSourceFileGlobs } from "../Lint.schemas.ts";

/**
 * Create the package-owner resolver used by schema-first repository scans.
 *
 * **Example** (Wrap owner resolver in Effect)
 *
 * ```ts
 * import { makeSchemaFirstOwnerResolver } from "@beep/repo-cli/commands/Lint"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(makeSchemaFirstOwnerResolver)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
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
 * **Example** (Wrap project factory in Effect)
 *
 * ```ts
 * import { makeSchemaFirstProject } from "@beep/repo-cli/commands/Lint"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(makeSchemaFirstProject)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
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
 * **Details**
 *
 * Ecosystem members (`packages/ecosystem/<member>/...`) are excluded alongside
 * the generic TypeScript source exclusions: published-package standards
 * supersede the repo's schema-first style law inside that family
 * (`standards/architecture/14-ecosystem-packages.md`, Style-Law Scoping).
 *
 * **Example** (Check excluded dist path)
 *
 * ```ts
 * import { isSchemaFirstExcludedFile } from "@beep/repo-cli/test/Lint"
 *
 * console.log(isSchemaFirstExcludedFile("packages/demo/dist/index.ts"))
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isSchemaFirstExcludedFile = (filePath: string): boolean =>
  isEcosystemMemberSourcePath(filePath) || isExcludedTypeScriptSourcePath(filePath);
