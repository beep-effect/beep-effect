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
import type {
  SchemaCrispeningPolicyDocument,
  SchemaFirstEntryKind,
  SchemaFirstEntryStatus,
  SchemaFirstLintOptions,
  SchemaFirstPolicyRuleId,
} from "../Lint.schemas.ts";
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

const scanSchemaFirstInventory = Effect.fn(function* () {
  const path = yield* Path.Path;
  const ownerResolver = yield* makeSchemaFirstOwnerResolver();
  const project = yield* makeSchemaFirstProject();

  const entries = A.empty<SchemaFirstInventoryEntry>();
  const pushEntry = (
    file: string,
    symbol: string,
    kind: SchemaFirstEntryKind,
    status: SchemaFirstEntryStatus,
    reason: string,
    owner: string,
    options: {
      readonly line?: number;
      readonly ruleId?: SchemaFirstPolicyRuleId;
    } = {}
  ) =>
    void A.appendInPlace(
      entries,
      SchemaFirstInventoryEntry.make({
        file,
        symbol,
        kind,
        status,
        ...options,
        reason,
        owner,
      })
    );

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = toPosixPath(path.relative(process.cwd(), sourceFile.getFilePath()));
    const owner = ownerResolver(sourceFile.getFilePath());
    const arbitraryTestsEntry = SchemaFirstArbitraryCoverage.arbitraryTestsEntryFromSourceFile(
      sourceFile,
      filePath,
      owner
    );
    if (O.isSome(arbitraryTestsEntry)) {
      A.appendInPlace(entries, arbitraryTestsEntry.value);
    }

    if (!isExcludedTypeScriptSourcePath(filePath) && SchemaFirstDetectors.sourceHasTaggedErrorSignal(sourceFile)) {
      for (const declaration of sourceFile.getDescendantsOfKind(SyntaxKind.ClassDeclaration)) {
        const entry = SchemaFirstDetectors.taggedErrorEquivalenceEntryFromClassDeclaration(
          declaration,
          filePath,
          owner
        );
        if (O.isSome(entry)) {
          A.appendInPlace(entries, entry.value);
        }
      }
    }

    if (isSchemaFirstExcludedFile(filePath)) {
      continue;
    }

    for (const declaration of sourceFile.getInterfaces()) {
      const symbol = SchemaFirstDetectors.declarationSymbol(declaration, declaration.getName());
      if (
        !SchemaFirstDetectors.isEffectivelyExported(declaration, symbol) ||
        !SchemaFirstDetectors.isInterfaceSchemaFirstCandidate(declaration)
      ) {
        continue;
      }
      pushEntry(
        filePath,
        symbol,
        "exported-interface",
        "candidate",
        "Exported pure-data interface should be modeled as an annotated schema.",
        owner
      );
    }

    for (const declaration of sourceFile.getTypeAliases()) {
      const symbol = SchemaFirstDetectors.declarationSymbol(declaration, declaration.getName());
      if (!SchemaFirstDetectors.isEffectivelyExported(declaration, symbol)) {
        continue;
      }
      const typeNode = declaration.getTypeNode();
      if (
        typeNode === undefined ||
        typeNode.getKind() !== SyntaxKind.TypeLiteral ||
        !SchemaFirstDetectors.isTypeAliasSchemaFirstCandidate(declaration)
      ) {
        continue;
      }
      pushEntry(
        filePath,
        symbol,
        "exported-type-literal",
        "candidate",
        "Exported pure-data type alias should be modeled as an annotated schema.",
        owner
      );
    }

    const hasNormalizationSignal = SchemaFirstDetectors.sourceHasNormalizationSignal(sourceFile);
    const hasGetSomesSignal = SchemaFirstDetectors.sourceHasGetSomesSignal(sourceFile);

    for (const callExpression of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      if (hasNormalizationSignal) {
        const normalizationEntry = SchemaFirstDetectors.normalizationEntryFromCallExpression(
          callExpression,
          filePath,
          owner
        );
        if (O.isSome(normalizationEntry)) {
          A.appendInPlace(entries, normalizationEntry.value);
        }
      }
      if (hasGetSomesSignal) {
        const getsomesEntry = SchemaFirstDetectors.getsomesStructEntryFromCallExpression(
          callExpression,
          filePath,
          owner
        );
        if (O.isSome(getsomesEntry)) {
          A.appendInPlace(entries, getsomesEntry.value);
        }
      }

      if (callExpression.getExpression().getText() !== "S.Struct") {
        if (SchemaFirstDetectors.isJsonParseCallExpression(callExpression)) {
          A.appendInPlace(
            entries,
            SchemaFirstDetectors.boundaryCodecEntryFromJsonParse(callExpression, filePath, owner)
          );
        }
        continue;
      }
      if (!SchemaFirstDetectors.isStructSchemaFirstCandidate(callExpression)) {
        continue;
      }
      pushEntry(
        filePath,
        SchemaFirstDetectors.inferStructSymbol(callExpression),
        "object-struct-schema",
        "candidate",
        "Object schema should prefer an annotated S.Class over S.Struct.",
        owner
      );
    }

    const functionLikeCandidates: ReadonlyArray<FunctionLikeDeclarationNode> = [
      ...A.filter(sourceFile.getFunctions(), (declaration) => {
        const symbol = SchemaFirstDetectors.declarationSymbol(declaration, declaration.getName());
        return SchemaFirstDetectors.isEffectivelyExported(declaration, symbol);
      }),
      ...SchemaFirstDetectors.sourceExportedArrowFunctions(sourceFile),
    ];
    const hasFnSchemaSignal = SchemaFirstDetectors.sourceHasFnSchemaSignal(sourceFile);
    const isFnSchemaEligible = SchemaFirstDetectors.isFnSchemaEligibleFilePath(filePath);
    const isNullReturnEligible = SchemaFirstDetectors.isNullReturnEligibleFilePath(filePath);

    for (const functionLike of functionLikeCandidates) {
      if (hasFnSchemaSignal && isFnSchemaEligible) {
        const fnSchemaEntry = SchemaFirstDetectors.fnSchemaEntryFromFunctionLike(functionLike, filePath, owner);
        if (O.isSome(fnSchemaEntry)) {
          A.appendInPlace(entries, fnSchemaEntry.value);
        }
      }
      if (isNullReturnEligible) {
        const nullReturnEntry = SchemaFirstDetectors.nullReturnEntryFromFunctionLike(functionLike, filePath, owner);
        if (O.isSome(nullReturnEntry)) {
          A.appendInPlace(entries, nullReturnEntry.value);
        }
      }
    }

    for (const property of sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
      const entry = SchemaFirstDetectors.numericDomainEntryFromProperty(property, filePath, owner);
      if (O.isSome(entry)) {
        A.appendInPlace(entries, entry.value);
      }
      const precisionEntry = SchemaFirstDetectors.precisionAuditEntryFromProperty(property, filePath, owner);
      if (O.isSome(precisionEntry)) {
        A.appendInPlace(entries, precisionEntry.value);
      }
    }

    if (SchemaFirstDetectors.sourceHasStaticApiSchemaSignal(sourceFile)) {
      for (const switchStatement of sourceFile.getDescendantsOfKind(SyntaxKind.SwitchStatement)) {
        const entry = SchemaFirstDetectors.staticApiEntryFromSwitch(switchStatement, filePath, owner);
        if (O.isSome(entry)) {
          A.appendInPlace(entries, entry.value);
        }
      }
    }

    if (SchemaFirstDetectors.sourceHasDefaultsSchemaSignal(sourceFile)) {
      for (const parameter of sourceFile.getDescendantsOfKind(SyntaxKind.Parameter)) {
        const entry = SchemaFirstDetectors.defaultsEntryFromParameter(parameter, filePath, owner);
        if (O.isSome(entry)) {
          A.appendInPlace(entries, entry.value);
        }
      }
    }

    if (SchemaFirstDetectors.sourceHasEquivalenceSchemaSignal(sourceFile)) {
      for (const declaration of sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
        const entry = SchemaFirstDetectors.equivalenceEntryFromVariableDeclaration(declaration, filePath, owner);
        if (O.isSome(entry)) {
          A.appendInPlace(entries, entry.value);
        }
      }
    }
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
