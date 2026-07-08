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
 * console.log(literalMemberEquals(["draft", "published"], "published")) // true
 * console.log(literalMemberEquals(["draft", "published"], "archived")) // false
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
 * console.log(sourceTextHasSchemaArbitraryPropertyCoverage("assertSchemaArbitraryDecodesToSelf(Worker);")) // true
 * console.log(sourceTextHasSchemaArbitraryPropertyCoverage("fc.property(fc.string(), (value) => value.length >= 0);")) // false
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
 * import { isSchemaCrispeningPolicyExempt, SchemaFirstInventoryEntry } from "@beep/repo-cli/commands/Lint"
 * import * as O from "effect/Option"
 *
 * const entry = SchemaFirstInventoryEntry.make({
 *   file: "packages/example/src/Foo.ts",
 *   kind: "exported-interface",
 *   line: 12,
 *   owner: "@beep/example",
 *   reason: "exported schema carries annotations",
 *   status: "candidate",
 *   symbol: "Foo"
 * })
 * // With no policy document loaded, no entry is exempt.
 * console.log(isSchemaCrispeningPolicyExempt(O.none())(entry)) // false
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
 * import * as O from "effect/Option"
 *
 * console.log(schemaCrispeningFamilyForFile("packages/drivers/postgres/src/Foo.ts")) // Option.some("drivers")
 * console.log(O.isNone(schemaCrispeningFamilyForFile("README.md"))) // true
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
 * import { Effect } from "effect"
 *
 * // Resolves package owners from a workspace root; provide FileSystem/Path to run it.
 * const program = makeSchemaFirstOwnerResolver("/repo")
 * console.log(Effect.isEffect(program)) // true
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
 * import { Effect } from "effect"
 *
 * const program = makeSchemaFirstProject()
 * console.log(Effect.isEffect(program)) // true
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
 * import { runSchemaFirstLint, SchemaFirstLintOptions } from "@beep/repo-cli/commands/Lint"
 * import { Effect } from "effect"
 *
 * const program = runSchemaFirstLint(SchemaFirstLintOptions.make({ write: false }))
 * console.log(Effect.isEffect(program)) // true
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
 * const policy = SchemaCrispeningFamilyPolicy.make({ blocking: true })
 * console.log(policy.blocking) // true
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
 * const document = SchemaCrispeningPolicyDocument.make({
 *   schemaVersion: "schema-crispening-policy/v1",
 *   cards: ["SFV4-normalization"],
 *   families: { foundation: { blocking: false } },
 *   ownerOverrides: {}
 * })
 * console.log(document.families.foundation.blocking) // false
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
 * console.log(SchemaFirstIncludedGlobs.includes("packages/**\/*.{ts,tsx}")) // true
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
 * import * as S from "effect/Schema"
 *
 * const entry = SchemaFirstInventoryEntry.make({
 *   file: "packages/example/src/Foo.ts",
 *   kind: "exported-interface",
 *   line: 12,
 *   owner: "@beep/example",
 *   reason: "exported schema carries annotations",
 *   status: "candidate",
 *   symbol: "Foo"
 * })
 * console.log(S.is(SchemaFirstInventoryEntry)(entry)) // true
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
 * console.log(SchemaFirstSourceFileGlobs.includes("!**\/docs/**")) // true
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
 * @param node - The ts-morph function-like declaration to inspect for inline object contracts.
 * @param file - The repo-relative source path recorded on any emitted inventory entry.
 * @param owner - The owning workspace package name recorded on any emitted inventory entry.
 * @returns `Option.some` with the schema-first inventory entry when a violation is found, otherwise `Option.none`.
 * @example
 * ```ts
 * import { fnSchemaEntryFromFunctionLike } from "@beep/repo-cli/commands/Lint"
 * import * as O from "effect/Option"
 * import { Project } from "ts-morph"
 *
 * const project = new Project({ useInMemoryFileSystem: true })
 * const sourceFile = project.createSourceFile("fixture.ts", "export function updateWidget(input: { id: string; name: string }): void {}")
 * const [node] = sourceFile.getFunctions()
 * const entry = fnSchemaEntryFromFunctionLike(node, "fixture.ts", "@beep/test")
 * console.log(O.map(entry, (found) => found.symbol)) // Option.some("updateWidget")
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
 * @param node - The ts-morph function-like declaration to inspect for a nullish return annotation.
 * @param file - The repo-relative source path recorded on any emitted inventory entry.
 * @param owner - The owning workspace package name recorded on any emitted inventory entry.
 * @returns `Option.some` with the schema-first inventory entry when a violation is found, otherwise `Option.none`.
 * @example
 * ```ts
 * import { nullReturnEntryFromFunctionLike } from "@beep/repo-cli/commands/Lint"
 * import * as O from "effect/Option"
 * import { Project } from "ts-morph"
 *
 * const project = new Project({ useInMemoryFileSystem: true })
 * const sourceFile = project.createSourceFile("fixture.ts", "export function findUser(id: string): string | null {\n  return null\n}")
 * const [node] = sourceFile.getFunctions()
 * const entry = nullReturnEntryFromFunctionLike(node, "fixture.ts", "@beep/test")
 * console.log(O.map(entry, (found) => found.symbol)) // Option.some("findUser")
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
 * @param callExpression - The ts-morph call expression to inspect for function-local trim/case normalization.
 * @param file - The repo-relative source path recorded on any emitted inventory entry.
 * @param owner - The owning workspace package name recorded on any emitted inventory entry.
 * @returns `Option.some` with the schema-first inventory entry when a violation is found, otherwise `Option.none`.
 * @example
 * ```ts
 * import { normalizationEntryFromCallExpression } from "@beep/repo-cli/commands/Lint"
 * import * as O from "effect/Option"
 * import { Project, SyntaxKind } from "ts-morph"
 *
 * const project = new Project({ useInMemoryFileSystem: true })
 * const sourceFile = project.createSourceFile("fixture.ts", "export function normalizeName(name: string): string {\n  return name.trim()\n}")
 * const [node] = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
 * const entry = normalizationEntryFromCallExpression(node, "fixture.ts", "@beep/test")
 * console.log(O.map(entry, (found) => found.symbol)) // Option.some("normalizeName.trim")
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
 * @param callExpression - The ts-morph call expression to inspect for `R.getSomes` over an inline Option struct.
 * @param file - The repo-relative source path recorded on any emitted inventory entry.
 * @param owner - The owning workspace package name recorded on any emitted inventory entry.
 * @returns `Option.some` with the schema-first inventory entry when a violation is found, otherwise `Option.none`.
 * @example
 * ```ts
 * import { getsomesStructEntryFromCallExpression } from "@beep/repo-cli/commands/Lint"
 * import * as O from "effect/Option"
 * import { Project, SyntaxKind } from "ts-morph"
 *
 * const project = new Project({ useInMemoryFileSystem: true })
 * const sourceFile = project.createSourceFile("fixture.ts", "export function pickSomes() {\n  return R.getSomes({ a: 1, b: 2 })\n}")
 * const [node] = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
 * const entry = getsomesStructEntryFromCallExpression(node, "fixture.ts", "@beep/test")
 * console.log(O.map(entry, (found) => found.symbol)) // Option.some("pickSomes.R.getSomes")
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
