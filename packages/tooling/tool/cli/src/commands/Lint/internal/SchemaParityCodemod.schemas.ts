/**
 * Data model for the schema-parity codemod engine: rule identifiers, planned
 * source edits, import requirements, residue, quarantine and run reports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { A } from "@beep/utils";
import { Effect } from "effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type { SourceFile } from "ts-morph";

const $I = $RepoCliId.create("commands/Lint/internal/SchemaParityCodemod.schemas");

/**
 * Registered codemod rule identifiers.
 *
 * **Details**
 *
 * Each identifier names one entry in the engine's rule registry. P2 of
 * `goals/effect-schema-parity` ships `literal-kit-facets`; later retirement
 * groups add identifiers here and register a rule under the same id.
 *
 * **Example** (Check a rule id)
 *
 * ```ts
 * import { SchemaParityCodemodRuleId } from "@beep/repo-cli/test/Lint"
 *
 * console.log(SchemaParityCodemodRuleId.is["literal-kit-facets"]("literal-kit-facets")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SchemaParityCodemodRuleId = LiteralKit(["literal-kit-facets", "schema-default-helpers"]).pipe(
  $I.annoteSchema("SchemaParityCodemodRuleId", {
    description: "Identifier of a registered schema-parity codemod rule.",
  })
);

/**
 * Identifier of a registered schema-parity codemod rule.
 *
 * @category type-level
 * @since 0.0.0
 */
export type SchemaParityCodemodRuleId = typeof SchemaParityCodemodRuleId.Type;

/**
 * Whether a codemod run only reports or also writes files.
 *
 * **Example** (Check a run mode)
 *
 * ```ts
 * import { SchemaParityCodemodMode } from "@beep/repo-cli/test/Lint"
 *
 * console.log(SchemaParityCodemodMode.Enum["dry-run"]) // "dry-run"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SchemaParityCodemodMode = LiteralKit(["dry-run", "write"]).pipe(
  $I.annoteSchema("SchemaParityCodemodMode", {
    description: "Whether a schema-parity codemod run only reports or also writes files.",
  })
);

/**
 * Whether a schema-parity codemod run only reports or also writes files.
 *
 * @category type-level
 * @since 0.0.0
 */
export type SchemaParityCodemodMode = typeof SchemaParityCodemodMode.Type;

const SourceOffset = S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("SchemaParityCodemodSourceOffset", {
    description: "Zero-based UTF-16 offset into a source file's text.",
  })
);

const SourcePosition = S.Int.check(S.isGreaterThanOrEqualTo(1)).pipe(
  $I.annoteSchema("SchemaParityCodemodSourcePosition", {
    description: "One-based line or column of a source location.",
  })
);

const SiteCount = S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("SchemaParityCodemodSiteCount", {
    description: "Non-negative count of codemod sites or files.",
  })
);

/**
 * One text replacement planned against a file's original text.
 *
 * **Details**
 *
 * `start === end` is an insertion. Edits planned for one file must not
 * overlap; the engine quarantines the file when they do instead of guessing
 * an order.
 *
 * **Example** (Plan a rename)
 *
 * ```ts
 * import { SchemaParityCodemodEdit } from "@beep/repo-cli/test/Lint"
 *
 * const edit = SchemaParityCodemodEdit.make({ start: 7, end: 14, text: "literals" })
 * console.log(edit.end - edit.start) // 7
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SchemaParityCodemodEdit extends S.Class<SchemaParityCodemodEdit>($I`SchemaParityCodemodEdit`)(
  {
    start: SourceOffset,
    end: SourceOffset,
    text: S.String,
  },
  $I.annote("SchemaParityCodemodEdit", {
    description: "One text replacement planned against a file's original text.",
  })
) {}

/**
 * Import a rewrite needs the file to carry.
 *
 * **Details**
 *
 * `NamespaceImport` adds `import * as <alias> from "<moduleSpecifier>"`.
 * `NamedImport` adds `<name>` to the file's existing value import from
 * `<moduleSpecifier>`, or a new named import when there is none. Rules pick the
 * variant after reading the file's existing imports, so the engine only
 * applies what a rule asked for.
 *
 * **Example** (Require the Function namespace)
 *
 * ```ts
 * import { SchemaParityCodemodImport } from "@beep/repo-cli/test/Lint"
 *
 * const requirement = SchemaParityCodemodImport.cases.NamespaceImport.make({
 *   moduleSpecifier: "effect/Function",
 *   alias: "F",
 * })
 * console.log(requirement._tag) // "NamespaceImport"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SchemaParityCodemodImport = S.TaggedUnion({
  NamespaceImport: {
    moduleSpecifier: S.NonEmptyString,
    alias: S.NonEmptyString,
  },
  NamedImport: {
    moduleSpecifier: S.NonEmptyString,
    name: S.NonEmptyString,
  },
}).pipe(
  $I.annoteSchema("SchemaParityCodemodImport", {
    description: "Import a codemod rewrite needs the rewritten file to carry.",
  })
);

/**
 * Import a codemod rewrite needs the rewritten file to carry.
 *
 * @category type-level
 * @since 0.0.0
 */
export type SchemaParityCodemodImport = typeof SchemaParityCodemodImport.Type;

/**
 * One rewritten occurrence, reported with its before and after text.
 *
 * **Example** (Record a rename site)
 *
 * ```ts
 * import { SchemaParityCodemodSite } from "@beep/repo-cli/test/Lint"
 *
 * const site = SchemaParityCodemodSite.make({
 *   ruleId: "literal-kit-facets",
 *   facet: "Options",
 *   filePath: "packages/example/src/Status.ts",
 *   line: 4,
 *   column: 9,
 *   before: "Status.Options",
 *   after: "Status.literals",
 * })
 * console.log(site.after) // "Status.literals"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SchemaParityCodemodSite extends S.Class<SchemaParityCodemodSite>($I`SchemaParityCodemodSite`)(
  {
    ruleId: SchemaParityCodemodRuleId,
    facet: S.NonEmptyString,
    filePath: S.String,
    line: SourcePosition,
    column: SourcePosition,
    before: S.String,
    after: S.String,
  },
  $I.annote("SchemaParityCodemodSite", {
    description: "One occurrence a codemod rule rewrites, with its before and after text.",
  })
) {}

/**
 * An occurrence a rule matched but cannot rewrite mechanically.
 *
 * **Details**
 *
 * Residue leaves the rest of the file's rewrites intact and names the site for
 * a hand edit, for example a retired facet read off a decorated schema whose
 * underlying kit is not in scope.
 *
 * **Example** (Record a residue site)
 *
 * ```ts
 * import { SchemaParityCodemodResidue } from "@beep/repo-cli/test/Lint"
 *
 * const residue = SchemaParityCodemodResidue.make({
 *   ruleId: "literal-kit-facets",
 *   facet: "thunk",
 *   filePath: "packages/example/src/Mode.ts",
 *   line: 12,
 *   column: 3,
 *   text: "ModeKit.thunk",
 *   reason: "thunk-used-as-value",
 * })
 * console.log(residue.reason) // "thunk-used-as-value"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SchemaParityCodemodResidue extends S.Class<SchemaParityCodemodResidue>($I`SchemaParityCodemodResidue`)(
  {
    ruleId: SchemaParityCodemodRuleId,
    facet: S.NonEmptyString,
    filePath: S.String,
    line: SourcePosition,
    column: SourcePosition,
    text: S.String,
    reason: S.NonEmptyString,
  },
  $I.annote("SchemaParityCodemodResidue", {
    description: "An occurrence a codemod rule matched but cannot rewrite mechanically.",
  })
) {}

/**
 * A file the engine refused to write.
 *
 * **Details**
 *
 * Quarantine is per file: planning threw, edits overlapped, or the rewritten
 * text no longer parses. The original file is left untouched.
 *
 * **Example** (Record a quarantined file)
 *
 * ```ts
 * import { SchemaParityCodemodQuarantine } from "@beep/repo-cli/test/Lint"
 *
 * const quarantine = SchemaParityCodemodQuarantine.make({
 *   filePath: "packages/example/src/Broken.ts",
 *   reason: "rewritten text has syntax errors",
 * })
 * console.log(quarantine.filePath) // "packages/example/src/Broken.ts"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SchemaParityCodemodQuarantine extends S.Class<SchemaParityCodemodQuarantine>(
  $I`SchemaParityCodemodQuarantine`
)(
  {
    filePath: S.String,
    reason: S.NonEmptyString,
  },
  $I.annote("SchemaParityCodemodQuarantine", {
    description: "A file the schema-parity codemod engine refused to write.",
  })
) {}

/**
 * Everything one rule planned for one file.
 *
 * **Example** (Build an empty plan)
 *
 * ```ts
 * import { SchemaParityCodemodRulePlan } from "@beep/repo-cli/test/Lint"
 *
 * const plan = SchemaParityCodemodRulePlan.make({})
 * console.log(plan.edits.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SchemaParityCodemodRulePlan extends S.Class<SchemaParityCodemodRulePlan>($I`SchemaParityCodemodRulePlan`)(
  {
    edits: S.Array(SchemaParityCodemodEdit).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<SchemaParityCodemodEdit>()))
    ),
    imports: S.Array(SchemaParityCodemodImport).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<SchemaParityCodemodImport>()))
    ),
    sites: S.Array(SchemaParityCodemodSite).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<SchemaParityCodemodSite>()))
    ),
    residue: S.Array(SchemaParityCodemodResidue).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<SchemaParityCodemodResidue>()))
    ),
  },
  $I.annote("SchemaParityCodemodRulePlan", {
    description: "Edits, imports, rewritten sites and residue one codemod rule planned for one file.",
  })
) {}

/**
 * Planning outcome for one candidate file.
 *
 * **Details**
 *
 * `Planned` carries the fully rendered next text (edits applied, imports
 * added, not yet formatted); `Unchanged` means no rule matched a site;
 * `Quarantined` means the file must not be written.
 *
 * **Example** (Match a file outcome)
 *
 * ```ts
 * import { SchemaParityCodemodFileOutcome } from "@beep/repo-cli/test/Lint"
 *
 * const outcome = SchemaParityCodemodFileOutcome.cases.Unchanged.make({ filePath: "packages/example/src/A.ts" })
 * console.log(SchemaParityCodemodFileOutcome.guards.Unchanged(outcome)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SchemaParityCodemodFileOutcome = S.TaggedUnion({
  Unchanged: {
    filePath: S.String,
  },
  Planned: {
    filePath: S.String,
    nextText: S.String,
    plan: SchemaParityCodemodRulePlan,
  },
  Quarantined: {
    quarantine: SchemaParityCodemodQuarantine,
    residue: S.Array(SchemaParityCodemodResidue),
  },
}).pipe(
  $I.annoteSchema("SchemaParityCodemodFileOutcome", {
    description: "Planning outcome of the schema-parity codemod for one candidate file.",
  })
);

/**
 * Planning outcome of the schema-parity codemod for one candidate file.
 *
 * @category type-level
 * @since 0.0.0
 */
export type SchemaParityCodemodFileOutcome = typeof SchemaParityCodemodFileOutcome.Type;

/**
 * Options accepted by a codemod run.
 *
 * **Details**
 *
 * `paths` are repo-relative roots scanned for `*.ts` / `*.tsx` sources. A run
 * is a dry run unless `write` is set; `format` runs biome's formatter and
 * import organizer over the written files. `tsconfig` names the repo-relative
 * config whose compiler options drive type resolution; pass an app's own
 * config when its sources import through app-local path aliases.
 *
 * **Example** (Configure a dry run)
 *
 * ```ts
 * import { SchemaParityCodemodOptions } from "@beep/repo-cli/test/Lint"
 *
 * const options = SchemaParityCodemodOptions.make({ rules: ["literal-kit-facets"] })
 * console.log(options.write, options.paths) // false [ "packages", "apps" ]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SchemaParityCodemodOptions extends S.Class<SchemaParityCodemodOptions>($I`SchemaParityCodemodOptions`)(
  {
    rules: S.NonEmptyArray(SchemaParityCodemodRuleId),
    paths: S.NonEmptyArray(S.NonEmptyString).pipe(
      S.withConstructorDefault(Effect.succeed<A.NonEmptyReadonlyArray<string>>(["packages", "apps"]))
    ),
    write: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
    format: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(true))),
    tsconfig: S.NonEmptyString.pipe(S.withConstructorDefault(Effect.succeed("tsconfig.json"))),
    root: S.optionalKey(S.NonEmptyString),
    report: S.optionalKey(S.NonEmptyString),
  },
  $I.annote("SchemaParityCodemodOptions", {
    description: "Options accepted by a schema-parity codemod run.",
  })
) {}

/**
 * Rewritten-site count for one rule facet.
 *
 * **Example** (Count Options rewrites)
 *
 * ```ts
 * import { SchemaParityCodemodFacetCount } from "@beep/repo-cli/test/Lint"
 *
 * const count = SchemaParityCodemodFacetCount.make({ ruleId: "literal-kit-facets", facet: "Options", sites: 3 })
 * console.log(count.sites) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SchemaParityCodemodFacetCount extends S.Class<SchemaParityCodemodFacetCount>(
  $I`SchemaParityCodemodFacetCount`
)(
  {
    ruleId: SchemaParityCodemodRuleId,
    facet: S.NonEmptyString,
    sites: SiteCount,
  },
  $I.annote("SchemaParityCodemodFacetCount", {
    description: "Rewritten-site count for one schema-parity codemod rule facet.",
  })
) {}

/**
 * Result of one codemod run.
 *
 * **Example** (Build an empty report)
 *
 * ```ts
 * import { SchemaParityCodemodReport } from "@beep/repo-cli/test/Lint"
 *
 * const report = SchemaParityCodemodReport.make({
 *   mode: "dry-run",
 *   rules: ["literal-kit-facets"],
 *   paths: ["packages"],
 *   filesScanned: 0,
 *   candidateFiles: 0,
 *   filesChanged: [],
 *   facetCounts: [],
 *   sites: [],
 *   residue: [],
 *   quarantines: [],
 * })
 * console.log(report.mode) // "dry-run"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SchemaParityCodemodReport extends S.Class<SchemaParityCodemodReport>($I`SchemaParityCodemodReport`)(
  {
    mode: SchemaParityCodemodMode,
    rules: S.Array(SchemaParityCodemodRuleId),
    paths: S.Array(S.String),
    filesScanned: SiteCount,
    candidateFiles: SiteCount,
    filesChanged: S.Array(S.String),
    facetCounts: S.Array(SchemaParityCodemodFacetCount),
    sites: S.Array(SchemaParityCodemodSite),
    residue: S.Array(SchemaParityCodemodResidue),
    quarantines: S.Array(SchemaParityCodemodQuarantine),
  },
  $I.annote("SchemaParityCodemodReport", {
    description: "Result of one schema-parity codemod run.",
  })
) {}

/**
 * Per-file context a rule receives while planning.
 *
 * **Example** (Build a rule context)
 *
 * ```ts
 * import { SchemaParityCodemodRuleContext } from "@beep/repo-cli/test/Lint"
 *
 * const context = SchemaParityCodemodRuleContext.make({ filePath: "packages/example/src/A.ts" })
 * console.log(context.filePath) // "packages/example/src/A.ts"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SchemaParityCodemodRuleContext extends S.Class<SchemaParityCodemodRuleContext>(
  $I`SchemaParityCodemodRuleContext`
)(
  {
    filePath: S.String,
  },
  $I.annote("SchemaParityCodemodRuleContext", {
    description: "Per-file context a schema-parity codemod rule receives while planning.",
  })
) {}

type SchemaParityCodemodPlanner = (
  sourceFile: SourceFile,
  context: SchemaParityCodemodRuleContext
) => SchemaParityCodemodRulePlan;

const SchemaParityCodemodPlannerFunction = S.declare((input: unknown): input is SchemaParityCodemodPlanner =>
  P.isFunction(input)
).pipe(
  $I.annoteSchema("SchemaParityCodemodPlannerFunction", {
    description: "Planner that reads a ts-morph source file and returns a codemod rule plan.",
  })
);

/**
 * A registered codemod rule: identity, text prefilter and planner.
 *
 * **Details**
 *
 * `candidatePattern` is a cheap text prefilter: files whose text does not
 * match never enter the type-checked project. `plan` reads the ts-morph source
 * file (with its type checker) and returns edits against the file's original
 * text; it must not mutate the source file. A throw quarantines the file.
 *
 * **Example** (Declare a rule that plans nothing)
 *
 * ```ts
 * import { SchemaParityCodemodRule, SchemaParityCodemodRulePlan } from "@beep/repo-cli/test/Lint"
 *
 * const rule = SchemaParityCodemodRule.make({
 *   id: "literal-kit-facets",
 *   description: "No-op rule",
 *   candidatePattern: /never/u,
 *   plan: () => SchemaParityCodemodRulePlan.make({}),
 * })
 * console.log(rule.id) // "literal-kit-facets"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SchemaParityCodemodRule extends S.Class<SchemaParityCodemodRule>($I`SchemaParityCodemodRule`)(
  {
    id: SchemaParityCodemodRuleId,
    description: S.NonEmptyString,
    candidatePattern: S.RegExp,
    plan: SchemaParityCodemodPlannerFunction,
  },
  $I.annote("SchemaParityCodemodRule", {
    description: "A registered schema-parity codemod rule: identity, text prefilter and planner.",
  })
) {}
