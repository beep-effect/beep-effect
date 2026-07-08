/**
 * Schema-first inventory and enforcement command.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { SchemaFirstDetectors } from "./internal/SchemaFirstDetectors.js";
import { runSchemaFirstLint } from "./internal/SchemaFirstScan.js";
import { SchemaFirstLintOptions } from "./Lint.schemas.js";
import type * as O from "effect/Option";
import type { CallExpression } from "ts-morph";
import type { FunctionLikeDeclarationNode } from "./internal/SchemaFirstDetectors.js";
import type { SchemaFirstInventoryEntry } from "./Lint.schemas.js";

/**
 * Literal member equality helper used by schema catalog detection.
 *
 * @example
 * ```ts
 * import { literalMemberEquals } from "@beep/repo-cli/commands/Lint"
 * console.log(literalMemberEquals)
 * ```
 * @category utilities
 * @since 0.0.0
 */
/**
 * Detect schema-derived arbitrary property coverage in source text.
 *
 * @example
 * ```ts
 * import { sourceTextHasSchemaArbitraryPropertyCoverage } from "@beep/repo-cli/commands/Lint"
 * console.log(sourceTextHasSchemaArbitraryPropertyCoverage)
 * ```
 * @category predicates
 * @since 0.0.0
 */
export {
  literalMemberEquals,
  sourceTextHasSchemaArbitraryPropertyCoverage,
} from "./internal/SchemaFirstArbitraryCoverage.js";
/**
 * Schema-crispening policy exemption predicate.
 *
 * @example
 * ```ts
 * import { isSchemaCrispeningPolicyExempt } from "@beep/repo-cli/commands/Lint"
 * console.log(isSchemaCrispeningPolicyExempt)
 * ```
 * @category utilities
 * @since 0.0.0
 */
/**
 * Resolve a source file to its schema-crispening policy family.
 *
 * @example
 * ```ts
 * import { schemaCrispeningFamilyForFile } from "@beep/repo-cli/commands/Lint"
 * console.log(schemaCrispeningFamilyForFile)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export { isSchemaCrispeningPolicyExempt, schemaCrispeningFamilyForFile } from "./internal/SchemaFirstPolicy.js";
/**
 * Schema-first owner resolver factory.
 *
 * @example
 * ```ts
 * import { makeSchemaFirstOwnerResolver } from "@beep/repo-cli/commands/Lint"
 * console.log(makeSchemaFirstOwnerResolver)
 * ```
 * @category utilities
 * @since 0.0.0
 */
/**
 * Schema-first ts-morph project factory.
 *
 * @example
 * ```ts
 * import { makeSchemaFirstProject } from "@beep/repo-cli/commands/Lint"
 * console.log(makeSchemaFirstProject)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export { makeSchemaFirstOwnerResolver, makeSchemaFirstProject } from "./internal/SchemaFirstProject.js";
/**
 * Run schema-first inventory verification.
 *
 * @example
 * ```ts
 * import { runSchemaFirstLint } from "@beep/repo-cli/commands/Lint"
 * console.log(runSchemaFirstLint)
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export { runSchemaFirstLint } from "./internal/SchemaFirstScan.js";
/**
 * Schema-crispening family policy schema.
 *
 * @example
 * ```ts
 * import { SchemaCrispeningFamilyPolicy } from "@beep/repo-cli/commands/Lint"
 * console.log(SchemaCrispeningFamilyPolicy)
 * ```
 * @category models
 * @since 0.0.0
 */
/**
 * Schema-crispening policy document schema.
 *
 * @example
 * ```ts
 * import { SchemaCrispeningPolicyDocument } from "@beep/repo-cli/commands/Lint"
 * console.log(SchemaCrispeningPolicyDocument)
 * ```
 * @category models
 * @since 0.0.0
 */
/**
 * Included source globs for schema-first scans.
 *
 * @example
 * ```ts
 * import { SchemaFirstIncludedGlobs } from "@beep/repo-cli/commands/Lint"
 * console.log(SchemaFirstIncludedGlobs)
 * ```
 * @category configuration
 * @since 0.0.0
 */
/**
 * Schema-first inventory entry schema.
 *
 * @example
 * ```ts
 * import { SchemaFirstInventoryEntry } from "@beep/repo-cli/commands/Lint"
 * console.log(SchemaFirstInventoryEntry)
 * ```
 * @category models
 * @since 0.0.0
 */
/**
 * Source file globs for schema-first ts-morph projects.
 *
 * @example
 * ```ts
 * import { SchemaFirstSourceFileGlobs } from "@beep/repo-cli/commands/Lint"
 * console.log(SchemaFirstSourceFileGlobs)
 * ```
 * @category configuration
 * @since 0.0.0
 */
export {
  SchemaCrispeningFamilyPolicy,
  SchemaCrispeningPolicyDocument,
  SchemaFirstIncludedGlobs,
  SchemaFirstInventoryEntry,
  SchemaFirstSourceFileGlobs,
} from "./Lint.schemas.js";

/**
 * Detect an exported function or arrow function with inline object contracts.
 *
 * @example
 * ```ts
 * import { fnSchemaEntryFromFunctionLike } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(fnSchemaEntryFromFunctionLike)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const fnSchemaEntryFromFunctionLike = (
  node: FunctionLikeDeclarationNode,
  file: string,
  owner: string
): O.Option<SchemaFirstInventoryEntry> => SchemaFirstDetectors.fnSchemaEntryFromFunctionLike(node, file, owner);

/**
 * Detect an exported function or arrow function with nullish return annotation.
 *
 * @example
 * ```ts
 * import { nullReturnEntryFromFunctionLike } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(nullReturnEntryFromFunctionLike)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const nullReturnEntryFromFunctionLike = (
  node: FunctionLikeDeclarationNode,
  file: string,
  owner: string
): O.Option<SchemaFirstInventoryEntry> => SchemaFirstDetectors.nullReturnEntryFromFunctionLike(node, file, owner);

/**
 * Detect function-local trim/case normalization in schema-modeled files.
 *
 * @example
 * ```ts
 * import { normalizationEntryFromCallExpression } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(normalizationEntryFromCallExpression)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const normalizationEntryFromCallExpression = (
  callExpression: CallExpression,
  file: string,
  owner: string
): O.Option<SchemaFirstInventoryEntry> =>
  SchemaFirstDetectors.normalizationEntryFromCallExpression(callExpression, file, owner);

/**
 * Detect R.getSomes over an inline heterogeneous Option struct.
 *
 * @example
 * ```ts
 * import { getsomesStructEntryFromCallExpression } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(getsomesStructEntryFromCallExpression)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const getsomesStructEntryFromCallExpression = (
  callExpression: CallExpression,
  file: string,
  owner: string
): O.Option<SchemaFirstInventoryEntry> =>
  SchemaFirstDetectors.getsomesStructEntryFromCallExpression(callExpression, file, owner);

/**
 * Repo-wide schema-first lint command.
 *
 * @example
 * ```ts
 * import { lintSchemaFirstCommand } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(lintSchemaFirstCommand)
 * ```
 * @category cli-commands
 * @since 0.0.0
 */
export const lintSchemaFirstCommand = Command.make(
  "schema-first",
  {
    write: Flag.boolean("write").pipe(Flag.withDescription("Refresh standards/schema-first.inventory.jsonc")),
  },
  Effect.fn(function* ({ write }) {
    yield* runSchemaFirstLint(SchemaFirstLintOptions.make({ write }));
  })
).pipe(Command.withDescription("Verify the repo-wide schema-first inventory baseline"));
