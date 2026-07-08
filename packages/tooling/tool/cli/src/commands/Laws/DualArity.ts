/**
 * Public API dual-arity inventory and enforcement law.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { toPosixPath } from "@beep/repo-utils/schemas/TypeScriptSourceExclusions";
import { TSMorphService } from "@beep/repo-utils/TSMorph/index";
import { A } from "@beep/utils";
import { Effect, HashMap, MutableHashSet, Path, pipe } from "effect";
import * as O from "effect/Option";
import { todayYmd } from "../../internal/cli/Timing.js";
import { diffMembership } from "../../internal/ratchet/index.js";
import { DualArityAnalysis } from "./internal/DualArity.analysis.js";
import { DualArityInventory } from "./internal/DualArity.inventory.js";
import { DualArityRender } from "./internal/DualArity.render.js";
import {
  DualArityEnforcedRoots,
  DualArityIncludedGlobs,
  DualArityInventoryDocument,
  DualArityInventoryEntry,
  DualArityRulesSummary,
  decodeDualArityProjectInspectionRequest,
  dualArityEntryOrder,
  makeDualArityEntryKey,
  sortDualArityEntries,
} from "./Laws.schemas.js";
import type { DualArityRulesOptions } from "./Laws.schemas.js";

/**
 * Enforced root paths for strict dual-arity checks.
 *
 * @example
 * ```ts
 * import { DualArityEnforcedRoots } from "@beep/repo-cli/commands/Laws/DualArity"
 *
 * const example = DualArityEnforcedRoots
 * console.log(typeof example !== "undefined") // true
 * ```
 * @category configuration
 * @since 0.0.0
 */
/**
 * Included source globs for dual-arity scans.
 *
 * @example
 * ```ts
 * import { DualArityIncludedGlobs } from "@beep/repo-cli/commands/Laws/DualArity"
 *
 * const example = DualArityIncludedGlobs
 * console.log(typeof example !== "undefined") // true
 * ```
 * @category configuration
 * @since 0.0.0
 */
/**
 * Dual-arity inventory document schema.
 *
 * @example
 * ```ts
 * import { DualArityInventoryDocument } from "@beep/repo-cli/commands/Laws/DualArity"
 *
 * const example = DualArityInventoryDocument
 * console.log(typeof example !== "undefined") // true
 * ```
 * @category models
 * @since 0.0.0
 */
/**
 * Dual-arity inventory entry schema.
 *
 * @example
 * ```ts
 * import { DualArityInventoryEntry } from "@beep/repo-cli/commands/Laws/DualArity"
 *
 * const example = DualArityInventoryEntry
 * console.log(typeof example !== "undefined") // true
 * ```
 * @category models
 * @since 0.0.0
 */
/**
 * Runtime options for dual-arity enforcement.
 *
 * @example
 * ```ts
 * import { DualArityRulesOptions } from "@beep/repo-cli/commands/Laws/DualArity"
 *
 * const example = DualArityRulesOptions
 * console.log(typeof example !== "undefined") // true
 * ```
 * @category models
 * @since 0.0.0
 */
/**
 * Summary schema for dual-arity enforcement results.
 *
 * @example
 * ```ts
 * import { DualArityRulesSummary } from "@beep/repo-cli/commands/Laws/DualArity"
 *
 * const example = DualArityRulesSummary
 * console.log(typeof example !== "undefined") // true
 * ```
 * @category models
 * @since 0.0.0
 */
/**
 * Committed dual-arity inventory path.
 *
 * @example
 * ```ts
 * import { DualArityInventoryPath } from "@beep/repo-cli/commands/Laws/DualArity"
 *
 * console.log(DualArityInventoryPath.length > 0) // true
 * ```
 * @category configuration
 * @since 0.0.0
 */
/**
 * Decoder for dual-arity project inspection requests.
 *
 * @example
 * ```ts
 * import { decodeDualArityProjectInspectionRequest } from "@beep/repo-cli/commands/Laws/DualArity"
 *
 * const example = decodeDualArityProjectInspectionRequest
 * console.log(typeof example !== "undefined") // true
 * ```
 * @category codecs
 * @since 0.0.0
 */
/**
 * Sort order for dual-arity inventory entries.
 *
 * @example
 * ```ts
 * import { dualArityEntryOrder } from "@beep/repo-cli/commands/Laws/DualArity"
 *
 * const example = dualArityEntryOrder
 * console.log(typeof example !== "undefined") // true
 * ```
 * @category utilities
 * @since 0.0.0
 */
/**
 * Encoder for persisted dual-arity inventory documents.
 *
 * @example
 * ```ts
 * import { encodeDualArityInventoryDocument } from "@beep/repo-cli/commands/Laws/DualArity"
 *
 * const example = encodeDualArityInventoryDocument
 * console.log(typeof example !== "undefined") // true
 * ```
 * @category codecs
 * @since 0.0.0
 */
/**
 * Stable key used to reconcile dual-arity inventory entries.
 *
 * @example
 * ```ts
 * import { makeDualArityEntryKey } from "@beep/repo-cli/commands/Laws/DualArity"
 *
 * const result = makeDualArityEntryKey({ file: "packages/example/src/Foo.ts", line: 12, name: "mapFoo", reason: "dual helper" })
 * console.log(result) // rendered command output
 * ```
 * @category utilities
 * @since 0.0.0
 */
/**
 * Sort dual-arity inventory entries in committed baseline order.
 *
 * @example
 * ```ts
 * import { sortDualArityEntries } from "@beep/repo-cli/commands/Laws/DualArity"
 *
 * const result = sortDualArityEntries([])
 * console.log(result) // rendered command output
 * ```
 * @category utilities
 * @since 0.0.0
 */
export {
  DualArityEnforcedRoots,
  DualArityIncludedGlobs,
  DualArityInventoryDocument,
  DualArityInventoryEntry,
  DualArityInventoryPath,
  DualArityRulesOptions,
  DualArityRulesSummary,
  decodeDualArityProjectInspectionRequest,
  dualArityEntryOrder,
  encodeDualArityInventoryDocument,
  makeDualArityEntryKey,
  sortDualArityEntries,
} from "./Laws.schemas.js";

type DualArityScanResult = Readonly<{
  readonly document: DualArityInventoryDocument;
  readonly excludedLegitimate: number;
}>;

const scanDualArityInventory = Effect.fn("DualArity.scanDualArityInventory")(function* (
  options: DualArityRulesOptions
) {
  const service = yield* TSMorphService;
  const path = yield* Path.Path;
  const ownerResolver = yield* DualArityAnalysis.makeOwnerResolver();
  const excludePaths = MutableHashSet.empty<string>();
  for (const excludePath of options.excludePaths) {
    MutableHashSet.add(excludePaths, toPosixPath(excludePath));
  }

  const request = yield* decodeDualArityProjectInspectionRequest({
    entrypoint: {
      _tag: "tsconfig",
      tsConfigPath: "tsconfig.json",
    },
    repoRootPath: null,
    mode: "semantic",
    referencePolicy: "workspaceOnly",
    filePaths: A.empty(),
    sourceFileGlobs: A.fromIterable(DualArityIncludedGlobs),
  });
  const scanResult = yield* service.inspectProject(request, ({ scope, sourceFiles }) => {
    let liveEntries = A.empty<DualArityInventoryEntry>();
    let excludedLegitimate = 0;

    for (const sourceFile of sourceFiles) {
      const filePath = toPosixPath(path.relative(scope.repoRootPath, sourceFile.getFilePath()));
      if (DualArityInventory.isExcludedFile({ excludePaths, filePath })) {
        continue;
      }

      const owner = ownerResolver(sourceFile.getFilePath());
      const collection = DualArityAnalysis.scanSourceFile({ sourceFile, filePath, owner });
      excludedLegitimate += collection.excludedLegitimate;
      liveEntries = A.appendAll(liveEntries, collection.entries);
    }

    return {
      entries: sortDualArityEntries(
        A.dedupeWith(liveEntries, (left, right) => makeDualArityEntryKey(left) === makeDualArityEntryKey(right))
      ),
      excludedLegitimate,
    };
  });

  return {
    document: DualArityInventoryDocument.make({
      version: 1,
      generatedOn: todayYmd(),
      scope: A.fromIterable(DualArityIncludedGlobs),
      enforcedRoots: A.fromIterable(DualArityEnforcedRoots),
      entries: scanResult.entries,
    }),
    excludedLegitimate: scanResult.excludedLegitimate,
  } satisfies DualArityScanResult;
});

const mergeInventory = (
  liveDocument: DualArityInventoryDocument,
  existingDocument: O.Option<DualArityInventoryDocument>
): DualArityInventoryDocument => {
  const existingByKey = pipe(
    existingDocument,
    O.map((document) =>
      HashMap.fromIterable(
        A.map(document.entries, (entry): readonly [string, DualArityInventoryEntry] => [
          makeDualArityEntryKey(entry),
          entry,
        ])
      )
    ),
    O.getOrElse(HashMap.empty<string, DualArityInventoryEntry>)
  );

  const mergedEntries = pipe(
    liveDocument.entries,
    A.map((entry) => {
      const existingEntry = HashMap.get(existingByKey, makeDualArityEntryKey(entry));
      if (O.isNone(existingEntry)) {
        return entry;
      }

      return DualArityInventoryEntry.make({
        ...entry,
        status: existingEntry.value.status,
        owner: existingEntry.value.owner,
        reason: existingEntry.value.reason,
        issue: existingEntry.value.issue,
      });
    })
  );

  return DualArityInventoryDocument.make({
    version: 1,
    generatedOn: liveDocument.generatedOn,
    scope: liveDocument.scope,
    enforcedRoots: pipe(
      existingDocument,
      O.map((document) => document.enforcedRoots),
      O.getOrElse(() => liveDocument.enforcedRoots)
    ),
    entries: sortDualArityEntries(mergedEntries),
  });
};

/**
 * Run public API dual-arity inventory verification.
 *
 * @example
 * ```ts
 * console.log("runDualArityRules")
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const runDualArityRules = Effect.fn("runDualArityRules")(function* (options: DualArityRulesOptions) {
  const liveScan = yield* scanDualArityInventory(options);
  const liveDocument = liveScan.document;
  const existingDocument = yield* DualArityInventory.readDocument();
  const mergedDocument = mergeInventory(liveDocument, existingDocument);
  const membershipDiff = diffMembership({
    current: liveDocument.entries,
    baseline: pipe(
      existingDocument,
      O.map((document) => document.entries),
      O.getOrElse(A.empty<DualArityInventoryEntry>)
    ),
    equivalence: (left, right) => makeDualArityEntryKey(left) === makeDualArityEntryKey(right),
    order: dualArityEntryOrder,
  });
  const missingEntries = membershipDiff.introduced;
  const staleEntries = membershipDiff.resolved;
  const enforcedCandidates = A.filter(
    mergedDocument.entries,
    (entry) =>
      entry.status === "candidate" &&
      DualArityInventory.isEnforcedFile({ document: mergedDocument, filePath: entry.file })
  );
  const invalidExceptions = DualArityInventory.getInvalidExceptions(mergedDocument);

  if (options.write) {
    yield* DualArityInventory.writeDocument(mergedDocument);
  }

  const diagnostics = pipe(
    A.empty<string>(),
    A.appendAll(DualArityRender.makeMissingDiagnostics(missingEntries)),
    A.appendAll(DualArityRender.makeStaleDiagnostics(staleEntries)),
    A.appendAll(DualArityRender.makeEnforcedDiagnostics(enforcedCandidates)),
    A.appendAll(DualArityRender.makeInvalidExceptionDiagnostics(invalidExceptions))
  );

  const strictFailure = options.write
    ? !A.isReadonlyArrayEmpty(enforcedCandidates) || !A.isReadonlyArrayEmpty(invalidExceptions)
    : options.strictCheck &&
      (!A.isReadonlyArrayEmpty(missingEntries) ||
        !A.isReadonlyArrayEmpty(staleEntries) ||
        !A.isReadonlyArrayEmpty(enforcedCandidates) ||
        !A.isReadonlyArrayEmpty(invalidExceptions));

  yield* DualArityRender.reportSummary({
    options,
    liveDocument,
    mergedDocument,
    excludedLegitimate: liveScan.excludedLegitimate,
    diagnostics,
  });

  return DualArityRulesSummary.make({
    liveEntries: liveDocument.entries.length,
    trackedEntries: mergedDocument.entries.length,
    missingEntries: missingEntries.length,
    staleEntries: staleEntries.length,
    enforcedCandidates: enforcedCandidates.length,
    invalidExceptions: invalidExceptions.length,
    excludedLegitimate: liveScan.excludedLegitimate,
    wroteInventory: options.write,
    strictFailure,
    diagnostics,
  });
});
