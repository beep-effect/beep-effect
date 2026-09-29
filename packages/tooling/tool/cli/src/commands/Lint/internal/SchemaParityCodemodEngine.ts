/**
 * Schema-parity codemod engine: rule registry, per-file planner, import
 * application and the dry-run / write pipeline.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { FsUtils } from "@beep/repo-utils/FsUtils";
import { A, Str } from "@beep/utils";
import { Console, Effect, FileSystem, HashMap, HashSet, Inspectable, Layer, Order, Path, pipe, Result } from "effect";
import * as Context from "effect/Context";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import { Project } from "ts-morph";
import { formatJsonc, writeArtifact } from "../../../internal/artifacts/index.ts";
import { runCaptured } from "../../../internal/process/index.ts";
import { createRepoTsMorphProject } from "../../../internal/tsmorph/index.ts";
import { SchemaParityCodemodError } from "../Lint.errors.ts";
import {
  SchemaParityCodemodFacetCount,
  SchemaParityCodemodFileOutcome,
  SchemaParityCodemodImport,
  SchemaParityCodemodQuarantine,
  SchemaParityCodemodReport,
  SchemaParityCodemodRuleContext,
  SchemaParityCodemodRulePlan,
} from "./SchemaParityCodemod.schemas.ts";
import { schemaDefaultHelpersRule } from "./SchemaParityCodemodDefaultsRule.ts";
import { findSchemaParityCodemodEditOverlap, renderSchemaParityCodemodEdits } from "./SchemaParityCodemodEdits.ts";
import { schemaParityCodemodValueImports } from "./SchemaParityCodemodImports.ts";
import { literalKitFacetsRule } from "./SchemaParityCodemodLiteralKitRule.ts";
import type * as Crypto from "effect/Crypto";
import type { ChildProcessSpawner } from "effect/process";
import type { SourceFile } from "ts-morph";
import type {
  SchemaParityCodemodOptions,
  SchemaParityCodemodResidue,
  SchemaParityCodemodRule,
  SchemaParityCodemodRuleId,
  SchemaParityCodemodSite,
} from "./SchemaParityCodemod.schemas.ts";

const $I = $RepoCliId.create("commands/Lint/internal/SchemaParityCodemodEngine");

/**
 * Registry of codemod rules keyed by rule id.
 *
 * **Details**
 *
 * The engine only reads this registry; adding a retirement group means adding
 * its id to `SchemaParityCodemodRuleId` and one entry here.
 *
 * **Example** (Look up the LiteralKit rule)
 *
 * ```ts
 * import { SchemaParityCodemodRules } from "@beep/repo-cli/test/Lint"
 * import * as HashMap from "effect/HashMap"
 * import * as O from "effect/Option"
 *
 * console.log(O.isSome(HashMap.get(SchemaParityCodemodRules, "literal-kit-facets"))) // true
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const SchemaParityCodemodRules: HashMap.HashMap<SchemaParityCodemodRuleId, SchemaParityCodemodRule> =
  HashMap.make(
    [literalKitFacetsRule.id, literalKitFacetsRule],
    [schemaDefaultHelpersRule.id, schemaDefaultHelpersRule]
  );

const importKey = SchemaParityCodemodImport.match({
  NamespaceImport: (requirement) => `namespace:${requirement.moduleSpecifier}:${requirement.alias}`,
  NamedImport: (requirement) => `named:${requirement.moduleSpecifier}:${requirement.name}`,
});

const dedupeImports = (imports: ReadonlyArray<SchemaParityCodemodImport>): ReadonlyArray<SchemaParityCodemodImport> =>
  A.reduce(
    imports,
    { seen: HashSet.empty<string>(), kept: A.empty<SchemaParityCodemodImport>() },
    (state, requirement) =>
      HashSet.has(state.seen, importKey(requirement))
        ? state
        : { seen: HashSet.add(state.seen, importKey(requirement)), kept: A.append(state.kept, requirement) }
  ).kept;

const applyImport = (sourceFile: SourceFile, requirement: SchemaParityCodemodImport): void =>
  SchemaParityCodemodImport.match(requirement, {
    NamespaceImport: ({ alias, moduleSpecifier }) => {
      const present = A.some(
        schemaParityCodemodValueImports(sourceFile, moduleSpecifier),
        (declaration) => declaration.getNamespaceImport()?.getText() === alias
      );
      if (!present) {
        sourceFile.addImportDeclaration({ moduleSpecifier, namespaceImport: alias });
      }
    },
    NamedImport: ({ moduleSpecifier, name }) => {
      const declarations = A.filter(
        schemaParityCodemodValueImports(sourceFile, moduleSpecifier),
        (declaration) => declaration.getNamespaceImport() === undefined && declaration.getDefaultImport() === undefined
      );
      const present = A.some(declarations, (declaration) =>
        A.some(declaration.getNamedImports(), (specifier) => !specifier.isTypeOnly() && specifier.getName() === name)
      );
      if (present) {
        return;
      }
      pipe(
        A.head(declarations),
        O.match({
          onNone: () => void sourceFile.addImportDeclaration({ moduleSpecifier, namedImports: [name] }),
          onSome: (declaration) => void declaration.addNamedImport(name),
        })
      );
    },
  });

const scratchProject = (): Project => new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });

/**
 * Add the imports a plan requires to rendered source text.
 *
 * **Details**
 *
 * Requirements are deduplicated and skipped when the file already carries
 * them. New declarations are appended after the last import; the write
 * pipeline's biome pass sorts them.
 *
 * **Example** (Add a namespace import)
 *
 * ```ts
 * import { applySchemaParityCodemodImports, SchemaParityCodemodImport } from "@beep/repo-cli/test/Lint"
 *
 * const next = applySchemaParityCodemodImports("example.ts", 'import * as S from "effect/Schema";\n', [
 *   SchemaParityCodemodImport.cases.NamespaceImport.make({ moduleSpecifier: "effect/Function", alias: "F" }),
 * ])
 * console.log(next.includes('import * as F from "effect/Function"')) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const applySchemaParityCodemodImports: {
  (text: string, imports: ReadonlyArray<SchemaParityCodemodImport>): (filePath: string) => string;
  (filePath: string, text: string, imports: ReadonlyArray<SchemaParityCodemodImport>): string;
} = dual(3, (filePath: string, text: string, imports: ReadonlyArray<SchemaParityCodemodImport>): string => {
  const unique = dedupeImports(imports);
  if (A.isReadonlyArrayEmpty(unique)) {
    return text;
  }
  const sourceFile = scratchProject().createSourceFile(`/${filePath}`, text, { overwrite: true });
  A.forEach(unique, (requirement) => applyImport(sourceFile, requirement));
  return sourceFile.getFullText();
});

const syntaxErrors = (filePath: string, text: string): ReadonlyArray<string> => {
  const project = scratchProject();
  const sourceFile = project.createSourceFile(`/${filePath}`, text, { overwrite: true });
  return A.map(project.getProgram().getSyntacticDiagnostics(sourceFile), (diagnostic) => {
    const message = diagnostic.getMessageText();
    return `${diagnostic.getLineNumber() ?? 0}: ${P.isString(message) ? message : message.getMessageText()}`;
  });
};

const mergePlans = (plans: ReadonlyArray<SchemaParityCodemodRulePlan>): SchemaParityCodemodRulePlan =>
  SchemaParityCodemodRulePlan.make({
    edits: A.flatMap(plans, (plan) => plan.edits),
    imports: dedupeImports(A.flatMap(plans, (plan) => plan.imports)),
    sites: A.flatMap(plans, (plan) => plan.sites),
    residue: A.flatMap(plans, (plan) => plan.residue),
  });

const quarantined = (
  filePath: string,
  reason: string,
  residue: ReadonlyArray<SchemaParityCodemodResidue>
): SchemaParityCodemodFileOutcome =>
  SchemaParityCodemodFileOutcome.cases.Quarantined.make({
    quarantine: SchemaParityCodemodQuarantine.make({ filePath, reason }),
    residue,
  });

const planFile = (
  sourceFile: SourceFile,
  rules: ReadonlyArray<SchemaParityCodemodRule>,
  filePath: string
): SchemaParityCodemodFileOutcome => {
  const context = SchemaParityCodemodRuleContext.make({ filePath });
  const planned = Result.try({
    try: () => mergePlans(A.map(rules, (rule) => rule.plan(sourceFile, context))),
    catch: (cause) => `rule planning threw: ${Inspectable.toStringUnknown(cause, 0)}`,
  });
  if (Result.isFailure(planned)) {
    return quarantined(filePath, planned.failure, A.empty());
  }
  const plan = planned.success;
  if (A.isReadonlyArrayEmpty(plan.sites) && A.isReadonlyArrayEmpty(plan.residue)) {
    return SchemaParityCodemodFileOutcome.cases.Unchanged.make({ filePath });
  }
  const overlap = findSchemaParityCodemodEditOverlap(plan.edits);
  if (O.isSome(overlap)) {
    const [previous, next] = overlap.value;
    return quarantined(
      filePath,
      `overlapping edits [${previous.start}, ${previous.end}) and [${next.start}, ${next.end})`,
      plan.residue
    );
  }
  const original = sourceFile.getFullText();
  const nextText = applySchemaParityCodemodImports(
    filePath,
    renderSchemaParityCodemodEdits(original, 0, original.length, plan.edits),
    plan.imports
  );
  const errors = syntaxErrors(filePath, nextText);
  if (A.isReadonlyArrayNonEmpty(errors)) {
    return quarantined(filePath, `rewritten text has syntax errors: ${A.join(A.take(errors, 3), "; ")}`, plan.residue);
  }
  return SchemaParityCodemodFileOutcome.cases.Planned.make({ filePath, nextText, plan });
};

/**
 * Plan every rule against one source file and render its next text.
 *
 * **Details**
 *
 * Pure with respect to the file system: rules read the ts-morph source file
 * and its type checker; nothing is written. A rule that throws, edits that
 * overlap, or rendered text with syntax errors quarantine the file. Residue
 * alone yields a `Planned` outcome whose next text equals the original.
 *
 * **Example** (Plan a file with no matches)
 *
 * ```ts
 * import { literalKitFacetsRule, planSchemaParityCodemodFile } from "@beep/repo-cli/test/Lint"
 * import { Project } from "ts-morph"
 *
 * const project = new Project({ useInMemoryFileSystem: true })
 * const sourceFile = project.createSourceFile("/a.ts", "export const a = 1;\n")
 * const outcome = planSchemaParityCodemodFile(sourceFile, [literalKitFacetsRule], "a.ts")
 * console.log(outcome._tag) // "Unchanged"
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const planSchemaParityCodemodFile: {
  (
    rules: ReadonlyArray<SchemaParityCodemodRule>,
    filePath: string
  ): (sourceFile: SourceFile) => SchemaParityCodemodFileOutcome;
  (
    sourceFile: SourceFile,
    rules: ReadonlyArray<SchemaParityCodemodRule>,
    filePath: string
  ): SchemaParityCodemodFileOutcome;
} = dual(3, planFile);

const resolveRules = Effect.fn("SchemaParityCodemod.resolveRules")(function* (
  ids: ReadonlyArray<SchemaParityCodemodRuleId>
): Effect.fn.Return<ReadonlyArray<SchemaParityCodemodRule>, SchemaParityCodemodError> {
  return yield* Effect.forEach(A.dedupe(ids), (id) =>
    Effect.fromOption(HashMap.get(SchemaParityCodemodRules, id), () =>
      SchemaParityCodemodError.new(`No codemod rule is registered under ${id}.`)
    )
  );
});

const discoverSources = Effect.fn("SchemaParityCodemod.discoverSources")(function* (
  repoRoot: string,
  roots: ReadonlyArray<string>
): Effect.fn.Return<ReadonlyArray<string>, SchemaParityCodemodError, FsUtils> {
  const fsUtils = yield* FsUtils;
  const files = yield* fsUtils
    .globFiles(
      A.map(roots, (root) => `${Str.replace(/\/+$/u, "")(root)}/**/*.{ts,tsx}`),
      {
        absolute: true,
        cwd: repoRoot,
        ignore: ["**/node_modules/**", "**/dist/**", "**/docs/**", "**/build/**", "**/.turbo/**", "**/*.d.ts"],
      }
    )
    .pipe(SchemaParityCodemodError.mapError("Failed to discover codemod source files."));
  return A.sort(A.dedupe(files), Order.String);
});

const matchesAnyRule =
  (rules: ReadonlyArray<SchemaParityCodemodRule>) =>
  (text: string): boolean =>
    A.some(rules, (rule) => rule.candidatePattern.test(text));

const formatTouchedFiles = Effect.fn("SchemaParityCodemod.formatTouchedFiles")(function* (
  repoRoot: string,
  files: ReadonlyArray<string>
): Effect.fn.Return<void, SchemaParityCodemodError, Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner> {
  for (const chunk of A.chunksOf(files, 50)) {
    const step = yield* runCaptured({
      command: "bun",
      args: [
        "x",
        "biome",
        "check",
        "--write",
        "--linter-enabled=false",
        "--files-ignore-unknown=true",
        "--no-errors-on-unmatched",
        ...chunk,
      ],
      cwd: repoRoot,
    }).pipe(SchemaParityCodemodError.mapError("Failed to run biome check --write."));
    if (step.exitCode !== 0) {
      return yield* SchemaParityCodemodError.new(
        `biome check --write exited ${step.exitCode}: ${Str.slice(0, 2000)(step.output)}`
      );
    }
  }
});

type PlannedWrite = {
  readonly filePath: string;
  readonly nextText: string;
};

const STAGED_SUFFIX = ".schema-parity-codemod-staged";

/**
 * Write planned files atomically with respect to formatting.
 *
 * Every rewrite is first written next to its destination under a staged name
 * that keeps the extension (so biome applies the same configuration), biome
 * formats the staged files, and only when every chunk exits 0 are they renamed
 * over their destinations. A staging or format failure leaves every
 * destination untouched; staged files are always removed.
 */
const applyPlannedWrites = Effect.fn("SchemaParityCodemod.applyPlannedWrites")(function* (
  repoRoot: string,
  writes: ReadonlyArray<PlannedWrite>,
  format: boolean
): Effect.fn.Return<
  void,
  SchemaParityCodemodError,
  FileSystem.FileSystem | Path.Path | Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const staged = A.map(writes, (write) => {
    const extension = path.extname(write.filePath);
    const stem = Str.slice(0, write.filePath.length - extension.length)(write.filePath);
    return { ...write, stagedPath: `${stem}${STAGED_SUFFIX}${extension}` };
  });
  const removeStaged = Effect.forEach(
    staged,
    (entry) => fs.remove(path.join(repoRoot, entry.stagedPath), { force: true }).pipe(Effect.ignore),
    { concurrency: 8, discard: true }
  );
  yield* Effect.gen(function* () {
    yield* Effect.forEach(
      staged,
      (entry) =>
        fs
          .writeFileString(path.join(repoRoot, entry.stagedPath), entry.nextText)
          .pipe(SchemaParityCodemodError.mapError(`Failed to stage ${entry.filePath}.`)),
      { concurrency: 8, discard: true }
    );
    if (format) {
      yield* formatTouchedFiles(
        repoRoot,
        A.map(staged, (entry) => entry.stagedPath)
      );
    }
    yield* Effect.forEach(
      staged,
      (entry) =>
        fs
          .rename(path.join(repoRoot, entry.stagedPath), path.join(repoRoot, entry.filePath))
          .pipe(SchemaParityCodemodError.mapError(`Failed to move the rewrite of ${entry.filePath} into place.`)),
      { concurrency: 8, discard: true }
    );
  }).pipe(Effect.ensuring(removeStaged));
});

const facetCounts = (sites: ReadonlyArray<SchemaParityCodemodSite>): ReadonlyArray<SchemaParityCodemodFacetCount> =>
  pipe(
    R.values(A.groupBy(sites, (site) => `${site.ruleId}\u0000${site.facet}`)),
    A.map((group) => {
      const first = A.headNonEmpty(group);
      return SchemaParityCodemodFacetCount.make({ ruleId: first.ruleId, facet: first.facet, sites: group.length });
    }),
    A.sort(
      Order.combine(
        Order.mapInput(Order.String, (count: SchemaParityCodemodFacetCount) => count.ruleId),
        Order.mapInput(Order.String, (count: SchemaParityCodemodFacetCount) => count.facet)
      )
    )
  );

const renderReportLines = (report: SchemaParityCodemodReport): ReadonlyArray<string> => [
  `[schema-parity-codemod] ${report.mode}: scanned=${report.filesScanned} candidates=${report.candidateFiles} changed=${report.filesChanged.length} residue=${report.residue.length} quarantined=${report.quarantines.length}`,
  ...A.map(report.facetCounts, (count) => `  ${count.ruleId} ${count.facet}: ${count.sites}`),
  ...A.map(
    report.residue,
    (entry) =>
      `  residue ${entry.filePath}:${entry.line}:${entry.column} ${entry.facet} (${entry.reason}) ${entry.text}`
  ),
  ...A.map(report.quarantines, (entry) => `  quarantined ${entry.filePath}: ${entry.reason}`),
];

type RunServices =
  | FileSystem.FileSystem
  | Path.Path
  | FsUtils
  | Crypto.Crypto
  | ChildProcessSpawner.ChildProcessSpawner;

/**
 * Run the codemod: discover, prefilter, plan, and (with `write`) apply.
 *
 * **Details**
 *
 * Files are prefiltered by each rule's `candidatePattern`, loaded into one
 * ts-morph project configured from `options.tsconfig` (the repository
 * `tsconfig.json` by default, so `@beep/*` aliases resolve to source), and
 * planned with
 * {@link planSchemaParityCodemodFile}. A dry run writes nothing. A write run
 * stages every planned file whose text changed next to its destination, runs
 * biome's formatter and import organizer over the staged files unless
 * `format` is off, and renames them into place only after biome succeeds, so
 * a failed format leaves the tree untouched. The report is printed and, with
 * `report`, written as JSONC, after the write completes.
 *
 * **Example** (Build a dry-run Effect)
 *
 * ```ts
 * import { runSchemaParityCodemod, SchemaParityCodemodOptions } from "@beep/repo-cli/test/Lint"
 * import { Effect } from "effect"
 *
 * const program = runSchemaParityCodemod(SchemaParityCodemodOptions.make({ rules: ["literal-kit-facets"] }))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const runSchemaParityCodemod = Effect.fn("SchemaParityCodemod.run")(function* (
  options: SchemaParityCodemodOptions
): Effect.fn.Return<SchemaParityCodemodReport, SchemaParityCodemodError, RunServices> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* pipe(
    O.fromNullishOr(options.root),
    O.match({
      onNone: () => findRepoRoot().pipe(SchemaParityCodemodError.mapError("Failed to locate repository root.")),
      onSome: (root) => Effect.succeed(path.resolve(root)),
    })
  );
  const rules = yield* resolveRules(options.rules);
  const scanned = yield* discoverSources(repoRoot, options.paths);
  const isCandidate = matchesAnyRule(rules);
  const candidates = A.getSomes(
    yield* Effect.forEach(
      scanned,
      (filePath) =>
        fs.readFileString(filePath).pipe(
          SchemaParityCodemodError.mapError(`Failed to read ${filePath}.`),
          Effect.map((text) => (isCandidate(text) ? O.some(filePath) : O.none()))
        ),
      { concurrency: 16 }
    )
  );

  const project = createRepoTsMorphProject({
    tsConfigFilePath: path.resolve(repoRoot, options.tsconfig),
    sourceFileGlobs: A.empty(),
  });
  const sourceFiles = A.map(candidates, (filePath) => project.addSourceFileAtPath(filePath));
  const outcomes = A.map(sourceFiles, (sourceFile) =>
    planSchemaParityCodemodFile(sourceFile, rules, path.relative(repoRoot, sourceFile.getFilePath()))
  );

  const planned = A.filter(outcomes, SchemaParityCodemodFileOutcome.guards.Planned);
  const changed = A.filter(planned, (outcome) =>
    pipe(
      A.findFirst(sourceFiles, (sourceFile) => path.relative(repoRoot, sourceFile.getFilePath()) === outcome.filePath),
      O.exists((sourceFile) => sourceFile.getFullText() !== outcome.nextText)
    )
  );
  const quarantinedOutcomes = A.filter(outcomes, SchemaParityCodemodFileOutcome.guards.Quarantined);

  if (options.write && A.isReadonlyArrayNonEmpty(changed)) {
    yield* applyPlannedWrites(repoRoot, changed, options.format);
  }

  const report = SchemaParityCodemodReport.make({
    mode: options.write ? "write" : "dry-run",
    rules: A.map(rules, (rule) => rule.id),
    paths: options.paths,
    filesScanned: scanned.length,
    candidateFiles: candidates.length,
    filesChanged: A.map(changed, (outcome) => outcome.filePath),
    facetCounts: facetCounts(A.flatMap(planned, (outcome) => outcome.plan.sites)),
    sites: A.flatMap(planned, (outcome) => outcome.plan.sites),
    residue: A.appendAll(
      A.flatMap(planned, (outcome) => outcome.plan.residue),
      A.flatMap(quarantinedOutcomes, (outcome) => outcome.residue)
    ),
    quarantines: A.map(quarantinedOutcomes, (outcome) => outcome.quarantine),
  });

  if (options.report !== undefined) {
    const jsonc = yield* formatJsonc(report).pipe(
      SchemaParityCodemodError.mapError("Failed to format the codemod report.")
    );
    yield* writeArtifact({
      path: path.resolve(repoRoot, options.report),
      body: jsonc,
      onError: (cause) =>
        SchemaParityCodemodError.new(
          `Failed to write ${options.report ?? "the codemod report"}: ${Inspectable.toStringUnknown(cause, 0)}`
        ),
    });
  }
  yield* Console.log(A.join(renderReportLines(report), "\n"));
  return report;
});

/**
 * Service contract for the schema-parity codemod.
 *
 * **Details**
 *
 * `run` is the only operation; the layer captures the file-system, glob,
 * process and crypto services it needs so callers depend on the contract.
 *
 * @category services
 * @since 0.0.0
 */
export interface SchemaParityCodemodShape {
  readonly run: (
    options: SchemaParityCodemodOptions
  ) => Effect.Effect<SchemaParityCodemodReport, SchemaParityCodemodError>;
}

/**
 * Service tag for the schema-parity codemod.
 *
 * **Example** (Access the service)
 *
 * ```ts
 * import { SchemaParityCodemod } from "@beep/repo-cli/test/Lint"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(Effect.service(SchemaParityCodemod))) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class SchemaParityCodemod extends Context.Service<SchemaParityCodemod, SchemaParityCodemodShape>()(
  $I`SchemaParityCodemod`
) {}

/**
 * Live layer for {@link SchemaParityCodemod}.
 *
 * **Example** (Reference the live layer)
 *
 * ```ts
 * import { SchemaParityCodemodLive } from "@beep/repo-cli/test/Lint"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(SchemaParityCodemodLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const SchemaParityCodemodLive = Layer.effect(
  SchemaParityCodemod,
  Effect.gen(function* () {
    const services = yield* Effect.context<RunServices>();
    return SchemaParityCodemod.of({
      run: Effect.fn("SchemaParityCodemod.service.run")((options: SchemaParityCodemodOptions) =>
        runSchemaParityCodemod(options).pipe(Effect.provide(services))
      ),
    });
  })
);
