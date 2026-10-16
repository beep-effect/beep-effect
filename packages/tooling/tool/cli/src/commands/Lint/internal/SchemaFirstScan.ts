/**
 * Scan orchestration for schema-first inventory enforcement.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { toPosixPath } from "@beep/repo-utils/schemas/TypeScriptSourceExclusions";
import { A, Str } from "@beep/utils";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import { Node, SyntaxKind } from "ts-morph";
import { failWithReportedExit } from "../../../internal/cli/ExitCodeError.ts";
import { todayYmd } from "../../../internal/cli/Timing.ts";
import { diffMembership, enforceRatchet } from "../../../internal/ratchet/index.ts";
import { createRepoTsMorphProject } from "../../../internal/tsmorph/index.ts";
import {
  isActiveSchemaFirstRuleAdvisory,
  LiteralKitConstAssertionViolation,
  makeSchemaFirstEntryKey,
  SchemaFirstIncludedGlobs,
  SchemaFirstInventoryDocument,
  SchemaFirstInventoryEntry,
  SchemaFirstSourceFileGlobs,
  schemaFirstEntryOrder,
  sortSchemaFirstEntries,
} from "../Lint.schemas.ts";
import { SchemaFirstRender } from "../SchemaFirst.render.ts";
import { SchemaFirstArbitraryCoverage } from "./SchemaFirstArbitraryCoverage.ts";
import { SchemaFirstDetectors } from "./SchemaFirstDetectors.ts";
import { diffSchemaFirstParity, toSchemaFirstBacklog } from "./SchemaFirstParity.ts";
import { isSchemaCrispeningPolicyExempt } from "./SchemaFirstPolicy.ts";
import { isSchemaFirstExcludedFile, makeSchemaFirstOwnerResolver } from "./SchemaFirstProject.ts";
import { SchemaFirstSchemaClass } from "./SchemaFirstSchemaClass.ts";
import {
  readCrispeningPolicyDocument,
  readSchemaFirstInventoryDocument,
  writeSchemaFirstInventoryDocument,
} from "./SchemaFirstStore.ts";
import type { CallExpression, SourceFile } from "ts-morph";
import type {
  SchemaCrispeningPolicyDocument,
  SchemaFirstBacklogRow,
  SchemaFirstEntryKind,
  SchemaFirstLintOptions,
  SchemaFirstParityFindings,
} from "../Lint.schemas.ts";
import type { SchemaFirstLintFindings } from "../SchemaFirst.render.ts";
import type { FunctionLikeDeclarationNode } from "./SchemaFirstDetectors.ts";
import type { SchemaClassDeclaration } from "./SchemaFirstSchemaClass.ts";

const isLiteralKitConstAssertionArgument = (argument: Node): boolean =>
  Node.isAsExpression(argument) &&
  Node.isArrayLiteralExpression(argument.getExpression()) &&
  argument.getTypeNode()?.getText() === "const";

const appendLiteralKitConstAssertionViolations = (
  violations: Array<LiteralKitConstAssertionViolation>,
  sourceFile: SourceFile,
  filePath: string
): void => {
  for (const callExpression of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (callExpression.getExpression().getText() !== "LiteralKit") {
      continue;
    }

    const args = callExpression.getArguments();
    A.forEach(args, (argument, argumentIndex) => {
      if (!isLiteralKitConstAssertionArgument(argument)) {
        return;
      }

      A.appendInPlace(
        violations,
        LiteralKitConstAssertionViolation.make({
          file: filePath,
          line: sourceFile.getLineAndColumnAtPos(argument.getStart()).line,
          argument: argumentIndex + 1,
        })
      );
    });
  }
};

const schemaFirstSourceContext = Effect.fn("schemaFirstSourceContext")(function* () {
  const path = yield* Path.Path;
  const project = createRepoTsMorphProject({
    tsConfigFilePath: path.join(process.cwd(), "tsconfig.json"),
    sourceFileGlobs: [],
  });
  const sourcePaths = A.sort(project.getFileSystem().globSync(SchemaFirstSourceFileGlobs), Order.String);
  return { project, sourcePaths };
});

const collectArbitraryCoverageEntries = Effect.fn("collectArbitraryCoverageEntries")(function* () {
  const path = yield* Path.Path;
  const ownerResolver = yield* makeSchemaFirstOwnerResolver();
  const { project, sourcePaths } = yield* schemaFirstSourceContext();
  const entries = A.empty<SchemaFirstInventoryEntry>();
  const referencedClassNames = MutableHashSet.empty<string>();
  // Arbitrary coverage is syntax-only. Keep its full existing source/test corpus
  // while avoiding test roots in the production semantic program.
  for (const filePath of sourcePaths) {
    const sourceFile = project.addSourceFileAtPathIfExists(filePath);
    if (sourceFile === undefined) continue;
    const relativePath = toPosixPath(path.relative(process.cwd(), filePath));
    appendArbitraryEntries(entries, sourceFile, relativePath, ownerResolver(filePath));
    // Include references from excluded test roots without retaining their ASTs.
    A.forEach(SchemaFirstSchemaClass.scanSourceFile(sourceFile.compilerNode).referencedNames, (name) =>
      MutableHashSet.add(referencedClassNames, name)
    );
    sourceFile.forget();
  }
  return { entries, referencedClassNames };
});

const appendOptionEntry = (entries: Array<SchemaFirstInventoryEntry>, entry: O.Option<SchemaFirstInventoryEntry>) => {
  if (O.isSome(entry)) A.appendInPlace(entries, entry.value);
};

const appendCandidate = (
  entries: Array<SchemaFirstInventoryEntry>,
  file: string,
  symbol: string,
  kind: SchemaFirstEntryKind,
  reason: string,
  owner: string
) => {
  A.appendInPlace(entries, SchemaFirstInventoryEntry.make({ file, symbol, kind, status: "candidate", reason, owner }));
};

const appendArbitraryEntries = (
  entries: Array<SchemaFirstInventoryEntry>,
  sourceFile: SourceFile,
  filePath: string,
  owner: string
) => {
  appendOptionEntry(
    entries,
    SchemaFirstArbitraryCoverage.arbitraryTestsEntryFromSourceFile(sourceFile, filePath, owner)
  );
};

const appendInterfaceEntries = (
  entries: Array<SchemaFirstInventoryEntry>,
  sourceFile: SourceFile,
  filePath: string,
  owner: string
) => {
  for (const declaration of sourceFile.getInterfaces()) {
    const symbol = SchemaFirstDetectors.declarationSymbol(declaration, declaration.getName());
    if (!SchemaFirstDetectors.isEffectivelyExported(declaration, symbol)) continue;
    if (!SchemaFirstDetectors.isInterfaceSchemaFirstCandidate(declaration)) continue;
    appendCandidate(
      entries,
      filePath,
      symbol,
      "exported-interface",
      "Exported pure-data interface should be modeled as an annotated schema.",
      owner
    );
  }
};

const appendTypeAliasEntries = (
  entries: Array<SchemaFirstInventoryEntry>,
  sourceFile: SourceFile,
  filePath: string,
  owner: string
) => {
  for (const declaration of sourceFile.getTypeAliases()) {
    const symbol = SchemaFirstDetectors.declarationSymbol(declaration, declaration.getName());
    if (!SchemaFirstDetectors.isEffectivelyExported(declaration, symbol)) continue;
    const typeNode = declaration.getTypeNode();
    if (typeNode === undefined || typeNode.getKind() !== SyntaxKind.TypeLiteral) continue;
    if (!SchemaFirstDetectors.isTypeAliasSchemaFirstCandidate(declaration)) continue;
    appendCandidate(
      entries,
      filePath,
      symbol,
      "exported-type-literal",
      "Exported pure-data type alias should be modeled as an annotated schema.",
      owner
    );
  }
};

const appendSignaledCallEntries = (
  entries: Array<SchemaFirstInventoryEntry>,
  callExpression: CallExpression,
  filePath: string,
  owner: string,
  hasNormalizationSignal: boolean,
  hasGetSomesSignal: boolean
) => {
  if (hasNormalizationSignal) {
    appendOptionEntry(
      entries,
      SchemaFirstDetectors.normalizationEntryFromCallExpression(callExpression, filePath, owner)
    );
  }
  if (hasGetSomesSignal) {
    appendOptionEntry(
      entries,
      SchemaFirstDetectors.getsomesStructEntryFromCallExpression(callExpression, filePath, owner)
    );
  }
};

const appendStructOrBoundaryEntry = (
  entries: Array<SchemaFirstInventoryEntry>,
  callExpression: CallExpression,
  filePath: string,
  owner: string
) => {
  if (callExpression.getExpression().getText() !== "S.Struct") {
    if (SchemaFirstDetectors.isJsonParseCallExpression(callExpression)) {
      A.appendInPlace(entries, SchemaFirstDetectors.boundaryCodecEntryFromJsonParse(callExpression, filePath, owner));
    }
    return;
  }
  if (!SchemaFirstDetectors.isStructSchemaFirstCandidate(callExpression)) return;
  appendCandidate(
    entries,
    filePath,
    SchemaFirstDetectors.inferStructSymbol(callExpression),
    "object-struct-schema",
    "Exported bare S.Struct schema should be a branded S.Opaque over that S.Struct with $I.annoteSchema metadata (D1).",
    owner
  );
};

type PlainDataSchemaClassCandidate = {
  readonly declaration: SchemaClassDeclaration;
  readonly file: string;
  readonly owner: string;
};

// Records every class name the file references (tests included, so `instanceof` assertions keep a class) and, for
// scanned files, the brand findings plus the plain-data candidates that are resolved once the whole project is read.
const appendSchemaClassEntries = (
  entries: Array<SchemaFirstInventoryEntry>,
  plainDataCandidates: Array<PlainDataSchemaClassCandidate>,
  referencedNames: MutableHashSet.MutableHashSet<string>,
  sourceFile: SourceFile,
  filePath: string,
  owner: string,
  scanned: boolean
) => {
  const scan = SchemaFirstSchemaClass.scanSourceFile(sourceFile.compilerNode);
  A.forEach(scan.referencedNames, (name) => MutableHashSet.add(referencedNames, name));
  if (!scanned) return;
  const plainDataEligible =
    SchemaFirstSchemaClass.isPlainDataEligibleFilePath(filePath) &&
    !SchemaFirstSchemaClass.isGeneratedSourceText(sourceFile.getFullText());
  for (const declaration of scan.declarations) {
    appendOptionEntry(entries, SchemaFirstSchemaClass.unbrandedEntry(declaration, filePath, owner));
    if (plainDataEligible) A.appendInPlace(plainDataCandidates, { declaration, file: filePath, owner });
  }
};

const appendPlainDataSchemaClassEntries = (
  entries: Array<SchemaFirstInventoryEntry>,
  plainDataCandidates: ReadonlyArray<PlainDataSchemaClassCandidate>,
  referencedNames: MutableHashSet.MutableHashSet<string>
) => {
  const names = HashSet.fromIterable(referencedNames);
  for (const { declaration, file, owner } of plainDataCandidates) {
    appendOptionEntry(entries, SchemaFirstSchemaClass.plainDataEntry(declaration, file, owner, names));
  }
};

const appendCallEntries = (
  entries: Array<SchemaFirstInventoryEntry>,
  sourceFile: SourceFile,
  filePath: string,
  owner: string
) => {
  const hasNormalizationSignal = SchemaFirstDetectors.sourceHasNormalizationSignal(sourceFile);
  const hasGetSomesSignal = SchemaFirstDetectors.sourceHasGetSomesSignal(sourceFile);
  for (const callExpression of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    appendSignaledCallEntries(entries, callExpression, filePath, owner, hasNormalizationSignal, hasGetSomesSignal);
    appendStructOrBoundaryEntry(entries, callExpression, filePath, owner);
  }
};

const appendFunctionEntries = (
  entries: Array<SchemaFirstInventoryEntry>,
  sourceFile: SourceFile,
  filePath: string,
  owner: string
) => {
  const candidates: ReadonlyArray<FunctionLikeDeclarationNode> = [
    ...A.filter(sourceFile.getFunctions(), (declaration) => {
      const symbol = SchemaFirstDetectors.declarationSymbol(declaration, declaration.getName());
      return SchemaFirstDetectors.isEffectivelyExported(declaration, symbol);
    }),
    ...SchemaFirstDetectors.sourceExportedArrowFunctions(sourceFile),
  ];
  const inspectFnSchema =
    SchemaFirstDetectors.sourceHasFnSchemaSignal(sourceFile) &&
    SchemaFirstDetectors.isFnSchemaEligibleFilePath(filePath);
  const inspectNullReturn = SchemaFirstDetectors.isNullReturnEligibleFilePath(filePath);
  for (const functionLike of candidates) {
    if (inspectFnSchema) {
      appendOptionEntry(entries, SchemaFirstDetectors.fnSchemaEntryFromFunctionLike(functionLike, filePath, owner));
    }
    if (inspectNullReturn) {
      appendOptionEntry(entries, SchemaFirstDetectors.nullReturnEntryFromFunctionLike(functionLike, filePath, owner));
    }
  }
};

const appendPropertyEntries = (
  entries: Array<SchemaFirstInventoryEntry>,
  sourceFile: SourceFile,
  filePath: string,
  owner: string
) => {
  for (const property of sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
    appendOptionEntry(entries, SchemaFirstDetectors.numericDomainEntryFromProperty(property, filePath, owner));
    appendOptionEntry(entries, SchemaFirstDetectors.precisionAuditEntryFromProperty(property, filePath, owner));
  }
};

const appendStaticApiEntries = (
  entries: Array<SchemaFirstInventoryEntry>,
  sourceFile: SourceFile,
  filePath: string,
  owner: string
) => {
  if (!SchemaFirstDetectors.sourceHasStaticApiSchemaSignal(sourceFile)) return;
  for (const statement of sourceFile.getDescendantsOfKind(SyntaxKind.SwitchStatement)) {
    appendOptionEntry(entries, SchemaFirstDetectors.staticApiEntryFromSwitch(statement, filePath, owner));
  }
};

const appendDefaultsEntries = (
  entries: Array<SchemaFirstInventoryEntry>,
  sourceFile: SourceFile,
  filePath: string,
  owner: string
) => {
  if (!SchemaFirstDetectors.sourceHasDefaultsSchemaSignal(sourceFile)) return;
  for (const parameter of sourceFile.getDescendantsOfKind(SyntaxKind.Parameter)) {
    appendOptionEntry(entries, SchemaFirstDetectors.defaultsEntryFromParameter(parameter, filePath, owner));
  }
};

const appendEquivalenceEntries = (
  entries: Array<SchemaFirstInventoryEntry>,
  sourceFile: SourceFile,
  filePath: string,
  owner: string
) => {
  if (!SchemaFirstDetectors.sourceHasEquivalenceSchemaSignal(sourceFile)) return;
  for (const declaration of sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    appendOptionEntry(
      entries,
      SchemaFirstDetectors.equivalenceEntryFromVariableDeclaration(declaration, filePath, owner)
    );
  }
};

const scanSchemaFirstInventory = Effect.fn(function* () {
  const path = yield* Path.Path;
  const ownerResolver = yield* makeSchemaFirstOwnerResolver();
  const coverage = yield* collectArbitraryCoverageEntries();
  const entries = A.fromIterable(coverage.entries);
  const { project, sourcePaths } = yield* schemaFirstSourceContext();
  // Production checks need the shared checker. Keep relevant ambient roots too;
  // imported dependencies still resolve normally through the compiler options.
  for (const filePath of sourcePaths) {
    const relativePath = toPosixPath(path.relative(process.cwd(), filePath));
    const ambientProductionRoot =
      Str.endsWith(".d.ts")(relativePath) && !isSchemaFirstExcludedFile(Str.replace(/\.d\.ts$/u, ".ts")(relativePath));
    if (!isSchemaFirstExcludedFile(relativePath) || ambientProductionRoot) {
      project.addSourceFileAtPathIfExists(filePath);
    }
  }

  const literalKitConstAssertionViolations = A.empty<LiteralKitConstAssertionViolation>();
  const scannedFiles = A.empty<string>();
  const parityEntries = A.empty<SchemaFirstInventoryEntry>();
  const plainDataCandidates = A.empty<PlainDataSchemaClassCandidate>();
  const referencedClassNames = coverage.referencedClassNames;

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = toPosixPath(path.relative(process.cwd(), sourceFile.getFilePath()));
    const owner = ownerResolver(sourceFile.getFilePath());
    const excluded = isSchemaFirstExcludedFile(filePath);
    appendSchemaClassEntries(
      entries,
      plainDataCandidates,
      referencedClassNames,
      sourceFile,
      filePath,
      owner,
      !excluded
    );
    if (excluded) continue;
    appendLiteralKitConstAssertionViolations(literalKitConstAssertionViolations, sourceFile, filePath);
    A.appendInPlace(scannedFiles, filePath);
    A.appendAllInPlace(
      parityEntries,
      yield* SchemaFirstDetectors.parityEntriesFromSourceFile(sourceFile, filePath, owner)
    );
    appendInterfaceEntries(entries, sourceFile, filePath, owner);
    appendTypeAliasEntries(entries, sourceFile, filePath, owner);
    appendCallEntries(entries, sourceFile, filePath, owner);
    appendFunctionEntries(entries, sourceFile, filePath, owner);
    appendPropertyEntries(entries, sourceFile, filePath, owner);
    appendStaticApiEntries(entries, sourceFile, filePath, owner);
    appendDefaultsEntries(entries, sourceFile, filePath, owner);
    appendEquivalenceEntries(entries, sourceFile, filePath, owner);
    // Keep the semantic program and source roots for cross-file resolution,
    // but release this file's completed syntax-wrapper graph.
    sourceFile.forgetDescendants();
  }
  appendPlainDataSchemaClassEntries(entries, plainDataCandidates, referencedClassNames);

  return {
    document: SchemaFirstInventoryDocument.make({
      version: 1,
      generatedOn: todayYmd(),
      scope: A.fromIterable(SchemaFirstIncludedGlobs),
      entries: sortSchemaFirstEntries(
        A.dedupeWith(entries, (left, right) => makeSchemaFirstEntryKey(left) === makeSchemaFirstEntryKey(right))
      ),
      backlog: toSchemaFirstBacklog(parityEntries),
    }),
    parityEntries,
    literalKitConstAssertionViolations,
    scannedFiles: A.sort(scannedFiles, Order.String),
  };
});

// The parity backlog only shrinks on `--write`: occurrences the committed backlog does not
// already track stay out unless `--admit-parity-backlog` explicitly admits them.
const parityBacklogToWrite = (
  options: SchemaFirstLintOptions,
  parityEntries: ReadonlyArray<SchemaFirstInventoryEntry>,
  parity: SchemaFirstParityFindings
): ReadonlyArray<SchemaFirstBacklogRow> => {
  const introducedKeys = HashSet.fromIterable(A.map(parity.introduced, makeSchemaFirstEntryKey));
  return toSchemaFirstBacklog(
    options.admitParityBacklog
      ? parityEntries
      : A.filter(parityEntries, (entry) => !HashSet.has(introducedKeys, makeSchemaFirstEntryKey(entry)))
  );
};

const mergeInventory = (
  liveDocument: SchemaFirstInventoryDocument,
  existingDocument: O.Option<SchemaFirstInventoryDocument>,
  backlog: ReadonlyArray<SchemaFirstBacklogRow>
): SchemaFirstInventoryDocument => {
  const existingByKey = pipe(
    existingDocument,
    O.map((document) =>
      HashMap.fromIterable(
        A.map(document.entries, (entry): readonly [string, SchemaFirstInventoryEntry] => [
          makeSchemaFirstEntryKey(entry),
          entry,
        ])
      )
    ),
    O.getOrElse(HashMap.empty<string, SchemaFirstInventoryEntry>)
  );

  const mergedEntries = A.map(liveDocument.entries, (entry) =>
    O.getOrElse(HashMap.get(existingByKey, makeSchemaFirstEntryKey(entry)), () => entry)
  );

  return SchemaFirstInventoryDocument.make({
    version: 1,
    generatedOn: liveDocument.generatedOn,
    scope: liveDocument.scope,
    entries: sortSchemaFirstEntries(mergedEntries),
    backlog,
  });
};

const collectSchemaFirstLintFindings = (
  liveDocument: SchemaFirstInventoryDocument,
  parity: SchemaFirstParityFindings,
  existingDocument: O.Option<SchemaFirstInventoryDocument>,
  mergedDocument: SchemaFirstInventoryDocument,
  policyDocument: O.Option<SchemaCrispeningPolicyDocument>
): SchemaFirstLintFindings => {
  const isExempt = isSchemaCrispeningPolicyExempt(policyDocument);
  const membershipDiff = diffMembership({
    current: liveDocument.entries,
    baseline: pipe(
      existingDocument,
      O.map((document) => document.entries),
      O.getOrElse(A.empty<SchemaFirstInventoryEntry>)
    ),
    equivalence: (left, right) => makeSchemaFirstEntryKey(left) === makeSchemaFirstEntryKey(right),
    order: schemaFirstEntryOrder,
  });
  const missingEntries = A.filter(membershipDiff.introduced, (entry) => !isExempt(entry));
  const staleEntries = A.filter(membershipDiff.resolved, (entry) => !isExempt(entry));
  const policyFilteredEntries = A.filter(mergedDocument.entries, (entry) => !isExempt(entry));
  const policyExemptCount = A.filter(mergedDocument.entries, isExempt).length;
  const boundaryCodecAdvisories = A.filter(
    policyFilteredEntries,
    isActiveSchemaFirstRuleAdvisory("SFV4-boundary-codec")
  );
  const defaultsAdvisories = A.filter(policyFilteredEntries, isActiveSchemaFirstRuleAdvisory("SFV4-defaults"));
  const staticApiAdvisories = A.filter(policyFilteredEntries, isActiveSchemaFirstRuleAdvisory("SFV4-static-api"));
  const equivalenceAdvisories = A.filter(policyFilteredEntries, isActiveSchemaFirstRuleAdvisory("SFV4-equivalence"));
  const precisionAuditAdvisories = A.filter(
    policyFilteredEntries,
    isActiveSchemaFirstRuleAdvisory("SFV4-precision-audit")
  );
  const arbitraryTestsAdvisories = A.filter(
    policyFilteredEntries,
    isActiveSchemaFirstRuleAdvisory("SFV4-arbitrary-tests")
  );
  const numericDomainAdvisories = A.filter(
    policyFilteredEntries,
    isActiveSchemaFirstRuleAdvisory("SFV4-numeric-domain")
  );
  const fnSchemaAdvisories = A.filter(policyFilteredEntries, isActiveSchemaFirstRuleAdvisory("SFV4-fn-schema"));
  const normalizationAdvisories = A.filter(
    policyFilteredEntries,
    isActiveSchemaFirstRuleAdvisory("SFV4-normalization")
  );
  const nullReturnAdvisories = A.filter(policyFilteredEntries, isActiveSchemaFirstRuleAdvisory("SFV4-null-return"));
  const getsomesStructAdvisories = A.filter(
    policyFilteredEntries,
    isActiveSchemaFirstRuleAdvisory("SFV4-getsomes-struct")
  );

  return {
    missingEntries,
    staleEntries,
    enforcedCandidates: A.filter(policyFilteredEntries, (entry) => entry.status === "candidate"),
    boundaryCodecAdvisories,
    defaultsAdvisories,
    staticApiAdvisories,
    equivalenceAdvisories,
    precisionAuditAdvisories,
    arbitraryTestsAdvisories,
    numericDomainAdvisories,
    fnSchemaAdvisories,
    normalizationAdvisories,
    nullReturnAdvisories,
    getsomesStructAdvisories,
    activeAdvisories: [
      ...boundaryCodecAdvisories,
      ...defaultsAdvisories,
      ...staticApiAdvisories,
      ...equivalenceAdvisories,
      ...precisionAuditAdvisories,
      ...arbitraryTestsAdvisories,
      ...numericDomainAdvisories,
      ...fnSchemaAdvisories,
      ...normalizationAdvisories,
      ...nullReturnAdvisories,
      ...getsomesStructAdvisories,
    ],
    parity,
    policyExemptCount,
  };
};

const schemaFirstLintHasFailures = (
  options: SchemaFirstLintOptions,
  findings: SchemaFirstLintFindings,
  literalKitConstAssertionViolations: ReadonlyArray<LiteralKitConstAssertionViolation>
): boolean =>
  A.some(
    [
      findings.enforcedCandidates.length,
      literalKitConstAssertionViolations.length,
      findings.activeAdvisories.length,
      ...(options.write ? [] : [findings.missingEntries.length, findings.staleEntries.length]),
    ],
    (count) => count > 0
  );

/**
 * Run schema-first inventory verification against the committed baseline.
 *
 * **Example** (Log schema-first lint name)
 *
 * ```ts
 * console.log("runSchemaFirstLint")
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const runSchemaFirstLint = Effect.fn("runSchemaFirstLint")(function* (options: SchemaFirstLintOptions) {
  const {
    document: liveDocument,
    parityEntries,
    scannedFiles,
    literalKitConstAssertionViolations,
  } = yield* scanSchemaFirstInventory();
  const existingDocument = yield* readSchemaFirstInventoryDocument();
  const parity = diffSchemaFirstParity(
    parityEntries,
    pipe(
      existingDocument,
      O.map((document) => document.backlog),
      O.getOrElse(A.empty<SchemaFirstBacklogRow>)
    )
  );
  const mergedDocument = mergeInventory(
    liveDocument,
    existingDocument,
    parityBacklogToWrite(options, parityEntries, parity)
  );
  const policyDocument = yield* readCrispeningPolicyDocument();
  const findings = collectSchemaFirstLintFindings(
    liveDocument,
    parity,
    existingDocument,
    mergedDocument,
    policyDocument
  );
  const summary = SchemaFirstRender.makeSchemaFirstLintSummary({
    liveDocument,
    mergedDocument,
    literalKitConstAssertionViolations,
    findings,
    options,
  });

  if (options.write) {
    yield* writeSchemaFirstInventoryDocument(mergedDocument);
  }

  yield* SchemaFirstRender.logSchemaFirstSummary(summary);
  if (options.reportScannedFiles) {
    yield* SchemaFirstRender.logScannedFiles(scannedFiles);
  }
  yield* SchemaFirstRender.logMissingEntries(findings.missingEntries);
  yield* SchemaFirstRender.logStaleEntries(findings.staleEntries);
  yield* SchemaFirstRender.logEnforcedCandidates(findings.enforcedCandidates);
  yield* SchemaFirstRender.logLiteralKitConstAssertionViolations(literalKitConstAssertionViolations);
  yield* SchemaFirstRender.logActiveAdvisories(findings.activeAdvisories);
  yield* enforceRatchet(yield* SchemaFirstRender.parityRatchetInput(findings.parity, options));

  if (schemaFirstLintHasFailures(options, findings, literalKitConstAssertionViolations)) {
    return yield* failWithReportedExit("schema-first: inventory enforcement failed.");
  }

  return summary;
});
