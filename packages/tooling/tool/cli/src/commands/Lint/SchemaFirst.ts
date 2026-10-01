/**
 * Schema-first inventory and enforcement command.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect } from "effect";
import { Command, Flag } from "effect/cli";
import { dual } from "effect/Function";
import { SchemaFirstDetectors } from "./internal/SchemaFirstDetectors.ts";
import { runSchemaFirstLint } from "./internal/SchemaFirstScan.ts";
import { SchemaFirstLintOptions } from "./Lint.schemas.ts";
import type * as Crypto from "effect/Crypto";
import type * as O from "effect/Option";
import type { CallExpression, SourceFile } from "ts-morph";
import type { FunctionLikeDeclarationNode } from "./internal/SchemaFirstDetectors.ts";
import type { SchemaFirstInventoryReadError } from "./Lint.errors.ts";
import type { SchemaFirstInventoryEntry } from "./Lint.schemas.ts";

type SchemaFirstDetectorContext = Pick<SchemaFirstInventoryEntry, "file" | "owner">;

/**
 * Literal member equality helper used by schema catalog detection.
 *
 * **Example** (Literal member equality check)
 *
 * ```ts
 * import { literalMemberEquals } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(literalMemberEquals(["draft", "published"], "published")) // true
 * console.log(literalMemberEquals(["draft", "published"], "archived")) // false
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
/**
 * Detect schema-derived arbitrary property coverage in source text.
 *
 * **Example** (Detect schema arbitrary coverage)
 *
 * ```ts
 * import { sourceTextHasSchemaArbitraryPropertyCoverage } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(sourceTextHasSchemaArbitraryPropertyCoverage("assertSchemaArbitraryDecodesToSelf(Worker);")) // true
 * console.log(sourceTextHasSchemaArbitraryPropertyCoverage("fc.property(fc.string(), (value) => value.length >= 0);")) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export {
  literalMemberEquals,
  sourceTextHasSchemaArbitraryPropertyCoverage,
} from "./internal/SchemaFirstArbitraryCoverage.ts";
/**
 * Diff live parity entries against the committed backlog by occurrence membership.
 *
 * **Example** (Diff an empty scan against an empty backlog)
 *
 * ```ts
 * import { diffSchemaFirstParity } from "@beep/repo-cli/commands/Lint"
 *
 * const findings = diffSchemaFirstParity([], [])
 * console.log(findings.introduced.length, findings.resolved.length) // 0 0
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
/**
 * Group live parity entries into the compact backlog rows committed with `--write`.
 *
 * **Example** (Group parity entries into backlog rows)
 *
 * ```ts
 * import { toSchemaFirstBacklog } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(toSchemaFirstBacklog([]).length) // 0
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export { diffSchemaFirstParity, toSchemaFirstBacklog } from "./internal/SchemaFirstParity.ts";
/**
 * Schema-crispening policy exemption predicate.
 *
 * **Example** (No-policy exemption check)
 *
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
 *
 * @category utilities
 * @since 0.0.0
 */
/**
 * Resolve a source file to its schema-crispening policy family.
 *
 * **Example** (Resolve file policy family)
 *
 * ```ts
 * import { schemaCrispeningFamilyForFile } from "@beep/repo-cli/commands/Lint"
 * import * as O from "effect/Option"
 *
 * console.log(schemaCrispeningFamilyForFile("packages/drivers/postgres/src/Foo.ts")) // Option.some("drivers")
 * console.log(O.isNone(schemaCrispeningFamilyForFile("README.md"))) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export { isSchemaCrispeningPolicyExempt, schemaCrispeningFamilyForFile } from "./internal/SchemaFirstPolicy.ts";
/**
 * Schema-first owner resolver factory.
 *
 * **Example** (Create owner resolver effect)
 *
 * ```ts
 * import { makeSchemaFirstOwnerResolver } from "@beep/repo-cli/commands/Lint"
 * import { Effect } from "effect"
 *
 * // Resolves package owners from a workspace root; provide FileSystem/Path to run it.
 * const program = makeSchemaFirstOwnerResolver("/repo")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
/**
 * Schema-first ts-morph project factory.
 *
 * **Example** (Create project factory effect)
 *
 * ```ts
 * import { makeSchemaFirstProject } from "@beep/repo-cli/commands/Lint"
 * import { Effect } from "effect"
 *
 * const program = makeSchemaFirstProject()
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export { makeSchemaFirstOwnerResolver, makeSchemaFirstProject } from "./internal/SchemaFirstProject.ts";
/**
 * Run schema-first inventory verification.
 *
 * **Example** (Run inventory verification)
 *
 * ```ts
 * import { runSchemaFirstLint, SchemaFirstLintOptions } from "@beep/repo-cli/commands/Lint"
 * import { Effect } from "effect"
 *
 * const program = runSchemaFirstLint(SchemaFirstLintOptions.make({ write: false }))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export { runSchemaFirstLint } from "./internal/SchemaFirstScan.ts";
/**
 * Schema-crispening family policy schema.
 *
 * **Example** (Make family policy)
 *
 * ```ts
 * import { SchemaCrispeningFamilyPolicy } from "@beep/repo-cli/commands/Lint"
 *
 * const policy = SchemaCrispeningFamilyPolicy.make({ blocking: true })
 * console.log(policy.blocking) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
/**
 * Schema-crispening policy document schema.
 *
 * **Example** (Make policy document)
 *
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
 *
 * @category models
 * @since 0.0.0
 */
/**
 * Included source globs for schema-first scans.
 *
 * **Example** (Check included source globs)
 *
 * ```ts
 * import { SchemaFirstIncludedGlobs } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(SchemaFirstIncludedGlobs.includes("packages/**\/*.{ts,tsx}")) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
/**
 * Schema-first inventory entry schema.
 *
 * **Example** (Make inventory entry)
 *
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
 *
 * @category models
 * @since 0.0.0
 */
/**
 * Source file globs for schema-first ts-morph projects.
 *
 * **Example** (Check source file globs)
 *
 * ```ts
 * import { SchemaFirstSourceFileGlobs } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(SchemaFirstSourceFileGlobs.includes("!**\/docs/**")) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export {
  SchemaCrispeningFamilyPolicy,
  SchemaCrispeningPolicyDocument,
  SchemaFirstIncludedGlobs,
  SchemaFirstInventoryEntry,
  SchemaFirstSourceFileGlobs,
} from "./Lint.schemas.ts";

/**
 * Detect an exported function or arrow function with inline object contracts.
 *
 * **Example** (Detect inline object contracts)
 *
 * ```ts
 * import { fnSchemaEntryFromFunctionLike } from "@beep/repo-cli/commands/Lint"
 * import * as O from "effect/Option"
 * import { Project } from "ts-morph"
 *
 * const project = new Project({ useInMemoryFileSystem: true })
 * const sourceFile = project.createSourceFile("fixture.ts", "export function updateWidget(input: { id: string; name: string }): void {}")
 * const [node] = sourceFile.getFunctions()
 * const entry = fnSchemaEntryFromFunctionLike(node, { file: "fixture.ts", owner: "@beep/test" })
 * console.log(O.map(entry, (found) => found.symbol)) // Option.some("updateWidget")
 * ```
 *
 * @param node - The ts-morph function-like declaration to inspect for inline object contracts.
 * @param context - Repo-relative source path and owning package recorded on any emitted inventory entry.
 * @returns `Option.some` with the schema-first inventory entry when a violation is found, otherwise `Option.none`.
 * @category utilities
 * @since 0.0.0
 */
export const fnSchemaEntryFromFunctionLike: {
  (context: SchemaFirstDetectorContext): (node: FunctionLikeDeclarationNode) => O.Option<SchemaFirstInventoryEntry>;
  (node: FunctionLikeDeclarationNode, context: SchemaFirstDetectorContext): O.Option<SchemaFirstInventoryEntry>;
} = dual(2, (node: FunctionLikeDeclarationNode, context: SchemaFirstDetectorContext) =>
  SchemaFirstDetectors.fnSchemaEntryFromFunctionLike(node, context.file, context.owner)
);

/**
 * Detect an exported function or arrow function with nullish return annotation.
 *
 * **Example** (Detect nullish return annotation)
 *
 * ```ts
 * import { nullReturnEntryFromFunctionLike } from "@beep/repo-cli/commands/Lint"
 * import * as O from "effect/Option"
 * import { Project } from "ts-morph"
 *
 * const project = new Project({ useInMemoryFileSystem: true })
 * const sourceFile = project.createSourceFile("fixture.ts", "export function findUser(id: string): string | null {\n  return null\n}")
 * const [node] = sourceFile.getFunctions()
 * const entry = nullReturnEntryFromFunctionLike(node, { file: "fixture.ts", owner: "@beep/test" })
 * console.log(O.map(entry, (found) => found.symbol)) // Option.some("findUser")
 * ```
 *
 * @param node - The ts-morph function-like declaration to inspect for a nullish return annotation.
 * @param context - Repo-relative source path and owning package recorded on any emitted inventory entry.
 * @returns `Option.some` with the schema-first inventory entry when a violation is found, otherwise `Option.none`.
 * @category utilities
 * @since 0.0.0
 */
export const nullReturnEntryFromFunctionLike: {
  (context: SchemaFirstDetectorContext): (node: FunctionLikeDeclarationNode) => O.Option<SchemaFirstInventoryEntry>;
  (node: FunctionLikeDeclarationNode, context: SchemaFirstDetectorContext): O.Option<SchemaFirstInventoryEntry>;
} = dual(2, (node: FunctionLikeDeclarationNode, context: SchemaFirstDetectorContext) =>
  SchemaFirstDetectors.nullReturnEntryFromFunctionLike(node, context.file, context.owner)
);

/**
 * Detect function-local trim/case normalization in schema-modeled files.
 *
 * **Example** (Detect local trim normalization)
 *
 * ```ts
 * import { normalizationEntryFromCallExpression } from "@beep/repo-cli/commands/Lint"
 * import * as O from "effect/Option"
 * import { Project, SyntaxKind } from "ts-morph"
 *
 * const project = new Project({ useInMemoryFileSystem: true })
 * const sourceFile = project.createSourceFile("fixture.ts", "export function normalizeName(name: string): string {\n  return name.trim()\n}")
 * const [node] = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
 * const entry = normalizationEntryFromCallExpression(node, { file: "fixture.ts", owner: "@beep/test" })
 * console.log(O.map(entry, (found) => found.symbol)) // Option.some("normalizeName.trim")
 * ```
 *
 * @param callExpression - The ts-morph call expression to inspect for function-local trim/case normalization.
 * @param context - Repo-relative source path and owning package recorded on any emitted inventory entry.
 * @returns `Option.some` with the schema-first inventory entry when a violation is found, otherwise `Option.none`.
 * @category utilities
 * @since 0.0.0
 */
export const normalizationEntryFromCallExpression: {
  (context: SchemaFirstDetectorContext): (callExpression: CallExpression) => O.Option<SchemaFirstInventoryEntry>;
  (callExpression: CallExpression, context: SchemaFirstDetectorContext): O.Option<SchemaFirstInventoryEntry>;
} = dual(2, (callExpression: CallExpression, context: SchemaFirstDetectorContext) =>
  SchemaFirstDetectors.normalizationEntryFromCallExpression(callExpression, context.file, context.owner)
);

/**
 * Detect R.getSomes over an inline heterogeneous Option struct.
 *
 * **Example** (Detect getSomes Option struct)
 *
 * ```ts
 * import { getsomesStructEntryFromCallExpression } from "@beep/repo-cli/commands/Lint"
 * import * as O from "effect/Option"
 * import { Project, SyntaxKind } from "ts-morph"
 *
 * const project = new Project({ useInMemoryFileSystem: true })
 * const sourceFile = project.createSourceFile("fixture.ts", "export function pickSomes() {\n  return R.getSomes({ a: 1, b: 2 })\n}")
 * const [node] = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
 * const entry = getsomesStructEntryFromCallExpression(node, { file: "fixture.ts", owner: "@beep/test" })
 * console.log(O.map(entry, (found) => found.symbol)) // Option.some("pickSomes.R.getSomes")
 * ```
 *
 * @param callExpression - The ts-morph call expression to inspect for `R.getSomes` over an inline Option struct.
 * @param context - Repo-relative source path and owning package recorded on any emitted inventory entry.
 * @returns `Option.some` with the schema-first inventory entry when a violation is found, otherwise `Option.none`.
 * @category utilities
 * @since 0.0.0
 */
export const getsomesStructEntryFromCallExpression: {
  (context: SchemaFirstDetectorContext): (callExpression: CallExpression) => O.Option<SchemaFirstInventoryEntry>;
  (callExpression: CallExpression, context: SchemaFirstDetectorContext): O.Option<SchemaFirstInventoryEntry>;
} = dual(2, (callExpression: CallExpression, context: SchemaFirstDetectorContext) =>
  SchemaFirstDetectors.getsomesStructEntryFromCallExpression(callExpression, context.file, context.owner)
);

/**
 * Detect every upstream-parity occurrence in one source file.
 *
 * **Details**
 *
 * Runs `SFV4-default-wrapper` and `SFV4-opaque-wrapper` over the file. A
 * reference counts only when its binding resolves to the `@beep/schema`
 * declaration of that export. Each entry carries a content anchor
 * (`<lexical path>::<export>@<hash>`), which is the membership key the
 * committed parity backlog ratchets on; hashing needs the `Crypto` service.
 *
 * **Example** (Detect a SchemaUtils default wrapper)
 *
 * ```ts
 * import { schemaFirstParityEntriesFromSourceFile } from "@beep/repo-cli/commands/Lint"
 * import * as Effect from "effect/Effect"
 * import { Project } from "ts-morph"
 *
 * const project = new Project({ useInMemoryFileSystem: true })
 * const sourceFile = project.createSourceFile(
 *   "Widget.ts",
 *   'import { SchemaUtils } from "@beep/schema"\nexport const Widget = S.Struct({ title: S.String.pipe(SchemaUtils.withEncodeDefault) })'
 * )
 * const program = schemaFirstParityEntriesFromSourceFile(sourceFile, { file: "Widget.ts", owner: "@beep/test" })
 * // Provide Crypto (for example NodeServices.layer) to run it; the entry's symbol is "Widget.title".
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param sourceFile - The ts-morph source file to scan.
 * @param context - Repo-relative source path and owning package recorded on every emitted entry.
 * @returns An effect with one advisory entry per parity occurrence, in document order.
 * @category utilities
 * @since 0.0.0
 */
export const schemaFirstParityEntriesFromSourceFile: {
  (
    context: SchemaFirstDetectorContext
  ): (
    sourceFile: SourceFile
  ) => Effect.Effect<ReadonlyArray<SchemaFirstInventoryEntry>, SchemaFirstInventoryReadError, Crypto.Crypto>;
  (
    sourceFile: SourceFile,
    context: SchemaFirstDetectorContext
  ): Effect.Effect<ReadonlyArray<SchemaFirstInventoryEntry>, SchemaFirstInventoryReadError, Crypto.Crypto>;
} = dual(2, (sourceFile: SourceFile, context: SchemaFirstDetectorContext) =>
  SchemaFirstDetectors.parityEntriesFromSourceFile(sourceFile, context.file, context.owner)
);

/**
 * Repo-wide schema-first lint command.
 *
 * **Example** (Run schema-first command)
 *
 * ```ts
 * import { lintSchemaFirstCommand } from "@beep/repo-cli/commands/Lint"
 * import { Command } from "effect/cli"
 * import { Effect } from "effect"
 *
 * const run = Command.run(lintSchemaFirstCommand, { version: "0.0.0" })
 * console.log(Effect.isEffect(run)) // true
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const lintSchemaFirstCommand = Command.make(
  "schema-first",
  {
    write: Flag.Boolean("write").pipe(
      Flag.withDefault(false),
      Flag.withDescription(
        "Refresh standards/schema-first.inventory.jsonc; the parity backlog only drops resolved occurrences"
      )
    ),
    admitParityBacklog: Flag.Boolean("admit-parity-backlog").pipe(
      Flag.withDefault(false),
      Flag.withDescription(
        "With --write, also admit new upstream-parity occurrences into the backlog (initial capture only)"
      )
    ),
    reportScannedFiles: Flag.Boolean("report-scanned-files").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Print the files the scan ran its detectors over as one [schema-first:scanned] JSON line")
    ),
  },
  Effect.fn(function* ({ write, admitParityBacklog, reportScannedFiles }) {
    yield* runSchemaFirstLint(SchemaFirstLintOptions.make({ write, admitParityBacklog, reportScannedFiles }));
  })
).pipe(Command.withDescription("Verify the repo-wide schema-first inventory baseline"));
