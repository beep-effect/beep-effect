/**
 * Scan orchestration for schema-first inventory enforcement.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { isExcludedTypeScriptSourcePath, toPosixPath } from "@beep/repo-utils/schemas/TypeScriptSourceExclusions";
import { A } from "@beep/utils";
import { Effect, HashMap, Path, pipe } from "effect";
import * as O from "effect/Option";
import { Node, SyntaxKind } from "ts-morph";
import { failWithReportedExit } from "../../../internal/cli/ExitCodeError.ts";
import { todayYmd } from "../../../internal/cli/Timing.ts";
import { diffMembership } from "../../../internal/ratchet/index.ts";
import {
  isActiveSchemaFirstRuleAdvisory,
  LiteralKitConstAssertionViolation,
  makeSchemaFirstEntryKey,
  SchemaFirstIncludedGlobs,
  SchemaFirstInventoryDocument,
  SchemaFirstInventoryEntry,
  schemaFirstEntryOrder,
  sortSchemaFirstEntries,
} from "../Lint.schemas.ts";
import { SchemaFirstRender } from "../SchemaFirst.render.ts";
import { SchemaFirstArbitraryCoverage } from "./SchemaFirstArbitraryCoverage.ts";
import { SchemaFirstDetectors } from "./SchemaFirstDetectors.ts";
import { isSchemaCrispeningPolicyExempt } from "./SchemaFirstPolicy.ts";
import {
  isSchemaFirstExcludedFile,
  makeSchemaFirstOwnerResolver,
  makeSchemaFirstProject,
} from "./SchemaFirstProject.ts";
import {
  readCrispeningPolicyDocument,
  readSchemaFirstInventoryDocument,
  writeSchemaFirstInventoryDocument,
} from "./SchemaFirstStore.ts";
import type { CallExpression, SourceFile } from "ts-morph";
import type { SchemaCrispeningPolicyDocument, SchemaFirstEntryKind, SchemaFirstLintOptions } from "../Lint.schemas.ts";
import type { SchemaFirstLintFindings } from "../SchemaFirst.render.ts";
import type { FunctionLikeDeclarationNode } from "./SchemaFirstDetectors.ts";

const isLiteralKitConstAssertionArgument = (argument: Node): boolean =>
  Node.isAsExpression(argument) &&
  Node.isArrayLiteralExpression(argument.getExpression()) &&
  argument.getTypeNode()?.getText() === "const";

const collectLiteralKitConstAssertionViolations = Effect.fn(function* () {
  const path = yield* Path.Path;
  const project = yield* makeSchemaFirstProject();

  const violations = A.empty<LiteralKitConstAssertionViolation>();

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = toPosixPath(path.relative(process.cwd(), sourceFile.getFilePath()));
    if (isSchemaFirstExcludedFile(filePath)) {
      continue;
    }

    for (const callExpression of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      if (callExpression.getExpression().getText() !== "LiteralKit") {
        continue;
      }

      const args = callExpression.getArguments();
      for (let argumentIndex = 0; argumentIndex < args.length; argumentIndex += 1) {
        const argument = args[argumentIndex];
        if (!isLiteralKitConstAssertionArgument(argument)) {
          continue;
        }

        A.appendInPlace(
          violations,
          LiteralKitConstAssertionViolation.make({
            file: filePath,
            line: sourceFile.getLineAndColumnAtPos(argument.getStart()).line,
            argument: argumentIndex + 1,
          })
        );
      }
    }
  }

  return violations;
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

const appendArbitraryAndTaggedErrorEntries = (
  entries: Array<SchemaFirstInventoryEntry>,
  sourceFile: SourceFile,
  filePath: string,
  owner: string
) => {
  appendOptionEntry(
    entries,
    SchemaFirstArbitraryCoverage.arbitraryTestsEntryFromSourceFile(sourceFile, filePath, owner)
  );
  if (isExcludedTypeScriptSourcePath(filePath) || !SchemaFirstDetectors.sourceHasTaggedErrorSignal(sourceFile)) return;
  for (const declaration of sourceFile.getDescendantsOfKind(SyntaxKind.ClassDeclaration)) {
    appendOptionEntry(
      entries,
      SchemaFirstDetectors.taggedErrorEquivalenceEntryFromClassDeclaration(declaration, filePath, owner)
    );
  }
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
    "Object schema should prefer an annotated S.Class over S.Struct.",
    owner
  );
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
  const project = yield* makeSchemaFirstProject();

  const entries = A.empty<SchemaFirstInventoryEntry>();

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = toPosixPath(path.relative(process.cwd(), sourceFile.getFilePath()));
    const owner = ownerResolver(sourceFile.getFilePath());
    appendArbitraryAndTaggedErrorEntries(entries, sourceFile, filePath, owner);
    if (isSchemaFirstExcludedFile(filePath)) continue;
    appendInterfaceEntries(entries, sourceFile, filePath, owner);
    appendTypeAliasEntries(entries, sourceFile, filePath, owner);
    appendCallEntries(entries, sourceFile, filePath, owner);
    appendFunctionEntries(entries, sourceFile, filePath, owner);
    appendPropertyEntries(entries, sourceFile, filePath, owner);
    appendStaticApiEntries(entries, sourceFile, filePath, owner);
    appendDefaultsEntries(entries, sourceFile, filePath, owner);
    appendEquivalenceEntries(entries, sourceFile, filePath, owner);
  }

  return SchemaFirstInventoryDocument.make({
    version: 1,
    generatedOn: todayYmd(),
    scope: A.fromIterable(SchemaFirstIncludedGlobs),
    entries: sortSchemaFirstEntries(
      A.dedupeWith(entries, (left, right) => makeSchemaFirstEntryKey(left) === makeSchemaFirstEntryKey(right))
    ),
  });
});

const mergeInventory = (
  liveDocument: SchemaFirstInventoryDocument,
  existingDocument: O.Option<SchemaFirstInventoryDocument>
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
  });
};

const collectSchemaFirstLintFindings = (
  liveDocument: SchemaFirstInventoryDocument,
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
  const taggedErrorEquivalenceAdvisories = A.filter(
    policyFilteredEntries,
    isActiveSchemaFirstRuleAdvisory("SFV4-tagged-error-equivalence")
  );
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
    taggedErrorEquivalenceAdvisories,
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
      ...taggedErrorEquivalenceAdvisories,
      ...precisionAuditAdvisories,
      ...arbitraryTestsAdvisories,
      ...numericDomainAdvisories,
      ...fnSchemaAdvisories,
      ...normalizationAdvisories,
      ...nullReturnAdvisories,
      ...getsomesStructAdvisories,
    ],
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
  const liveDocument = yield* scanSchemaFirstInventory();
  const literalKitConstAssertionViolations = yield* collectLiteralKitConstAssertionViolations();
  const existingDocument = yield* readSchemaFirstInventoryDocument();
  const mergedDocument = mergeInventory(liveDocument, existingDocument);
  const policyDocument = yield* readCrispeningPolicyDocument();
  const findings = collectSchemaFirstLintFindings(liveDocument, existingDocument, mergedDocument, policyDocument);
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
  yield* SchemaFirstRender.logMissingEntries(findings.missingEntries);
  yield* SchemaFirstRender.logStaleEntries(findings.staleEntries);
  yield* SchemaFirstRender.logEnforcedCandidates(findings.enforcedCandidates);
  yield* SchemaFirstRender.logLiteralKitConstAssertionViolations(literalKitConstAssertionViolations);
  yield* SchemaFirstRender.logActiveAdvisories(findings.activeAdvisories);

  if (schemaFirstLintHasFailures(options, findings, literalKitConstAssertionViolations)) {
    return yield* failWithReportedExit("schema-first: inventory enforcement failed.");
  }

  return summary;
});
