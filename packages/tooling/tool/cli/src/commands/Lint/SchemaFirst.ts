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
 *
 * const example = literalMemberEquals
 * console.log(typeof example !== "undefined") // true
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
 *
 * const example = sourceTextHasSchemaArbitraryPropertyCoverage
 * console.log(typeof example !== "undefined") // true
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
 *
 * const example = isSchemaCrispeningPolicyExempt
 * console.log(typeof example !== "undefined") // true
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
 *
 * const example = schemaCrispeningFamilyForFile
 * console.log(typeof example !== "undefined") // true
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
 *
 * const example = makeSchemaFirstOwnerResolver
 * console.log(typeof example !== "undefined") // true
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
 *
 * const example = makeSchemaFirstProject
 * console.log(typeof example !== "undefined") // true
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
 *
 * const example = runSchemaFirstLint
 * console.log(typeof example !== "undefined") // true
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
 *
 * const example = SchemaCrispeningFamilyPolicy
 * console.log(typeof example !== "undefined") // true
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
 *
 * const example = SchemaCrispeningPolicyDocument
 * console.log(typeof example !== "undefined") // true
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
 *
 * const example = SchemaFirstIncludedGlobs
 * console.log(typeof example !== "undefined") // true
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
 *
 * const example = SchemaFirstInventoryEntry
 * console.log(typeof example !== "undefined") // true
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
 *
 * const example = SchemaFirstSourceFileGlobs
 * console.log(typeof example !== "undefined") // true
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
 * const example = fnSchemaEntryFromFunctionLike
 * console.log(typeof example !== "undefined") // true
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
 * const example = nullReturnEntryFromFunctionLike
 * console.log(typeof example !== "undefined") // true
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
 * const example = normalizationEntryFromCallExpression
 * console.log(typeof example !== "undefined") // true
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
 * const example = getsomesStructEntryFromCallExpression
 * console.log(typeof example !== "undefined") // true
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
 * import { Command } from "effect/unstable/cli"
 * import { Effect } from "effect"
 *
 * const run = Command.run(lintSchemaFirstCommand, { version: "0.0.0" })
 * console.log(Effect.isEffect(run)) // true
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
