/**
 * Rendering helpers for public API dual-arity law diagnostics.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A } from "@beep/utils";
import { Console, Effect, Match } from "effect";
import { DualArityInventoryPath } from "../Laws.schemas.js";
import type {
  DualArityDiagnosticKind,
  DualArityInventoryDocument,
  DualArityInventoryEntry,
  DualArityRulesOptions,
} from "../Laws.schemas.js";

const diagnosticMessage = (diagnostic: typeof DualArityDiagnosticKind.Type): string =>
  Match.value(diagnostic).pipe(
    Match.when(
      "missing-dual",
      () => "Public 2-3 parameter helper APIs must be implemented with dual from effect/Function."
    ),
    Match.when("invalid-dual-source", () => "dual must be imported directly or as a namespace from effect/Function."),
    Match.when("invalid-dual-arity", () => "dual arity must match the public positional arity and may not exceed 3."),
    Match.when(
      "missing-dual-signatures",
      () => "Public type must expose both data-first and data-last call signatures."
    ),
    Match.when(
      "too-many-positional-params",
      () => "Public helper APIs may not expose more than 3 positional parameters."
    ),
    Match.when(
      "third-param-not-object-like",
      () => "Public 3-parameter helper APIs must use a strict ObjectLike third parameter."
    ),
    Match.when(
      "obvious-wrong-first-parameter",
      () => "The first parameter appears to be configuration/status text while a later parameter is pipeable."
    ),
    Match.exhaustive
  );

const makeReason = (diagnostics: ReadonlyArray<typeof DualArityDiagnosticKind.Type>): string =>
  A.join(A.map(diagnostics, diagnosticMessage), " ");

const makeMissingDiagnostics = (entries: ReadonlyArray<DualArityInventoryEntry>): ReadonlyArray<string> =>
  A.map(
    entries,
    (entry) =>
      `[missing] ${entry.file}:${entry.line}:${entry.column} ${entry.qualifiedName} [${entry.kind}] (${A.join(", ")(entry.diagnostics)}) ${entry.reason}`
  );

const makeStaleDiagnostics = (entries: ReadonlyArray<DualArityInventoryEntry>): ReadonlyArray<string> =>
  A.map(entries, (entry) => `[stale] ${entry.file} ${entry.qualifiedName} [${entry.kind}]`);

const makeEnforcedDiagnostics = (entries: ReadonlyArray<DualArityInventoryEntry>): ReadonlyArray<string> =>
  A.map(
    entries,
    (entry) =>
      `[enforced] ${entry.file}:${entry.line}:${entry.column} ${entry.qualifiedName} [${entry.kind}] (${A.join(", ")(entry.diagnostics)}) ${entry.reason}`
  );

const makeInvalidExceptionDiagnostics = (entries: ReadonlyArray<DualArityInventoryEntry>): ReadonlyArray<string> =>
  A.map(
    entries,
    (entry) => `[invalid-exception] ${entry.file} ${entry.qualifiedName} [${entry.kind}] owner and reason are required`
  );

const reportSummary = Effect.fn("DualArity.reportSummary")(function* (input: {
  readonly options: DualArityRulesOptions;
  readonly liveDocument: DualArityInventoryDocument;
  readonly mergedDocument: DualArityInventoryDocument;
  readonly excludedLegitimate: number;
  readonly diagnostics: ReadonlyArray<string>;
}) {
  yield* Console.log(`[dual-arity] live_entries=${input.liveDocument.entries.length}`);
  yield* Console.log(`[dual-arity] tracked_entries=${input.mergedDocument.entries.length}`);
  yield* Console.log(
    `[dual-arity] missing_entries=${input.diagnostics.filter((line) => line.startsWith("[missing]")).length}`
  );
  yield* Console.log(
    `[dual-arity] stale_entries=${input.diagnostics.filter((line) => line.startsWith("[stale]")).length}`
  );
  yield* Console.log(
    `[dual-arity] enforced_candidates=${input.diagnostics.filter((line) => line.startsWith("[enforced]")).length}`
  );
  yield* Console.log(
    `[dual-arity] invalid_exceptions=${input.diagnostics.filter((line) => line.startsWith("[invalid-exception]")).length}`
  );
  yield* Console.log(`[dual-arity] excluded_legitimate=${input.excludedLegitimate}`);
  if (input.options.write) {
    yield* Console.log(`[dual-arity] wrote ${DualArityInventoryPath}`);
  }

  for (const diagnostic of input.diagnostics) {
    yield* Console.error(`[dual-arity] ${diagnostic}`);
  }
});

/**
 * Internal rendering adapter for dual-arity law output.
 *
 * @example
 * ```ts
 * console.log("DualArityRender")
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const DualArityRender = {
  makeEnforcedDiagnostics,
  makeInvalidExceptionDiagnostics,
  makeMissingDiagnostics,
  makeReason,
  makeStaleDiagnostics,
  reportSummary,
} as const;
