/**
 * Effect laws allowlist helpers used by repository ESLint rules.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, thunkFalse } from "@beep/utils";
import { identity, pipe, Result } from "effect";
import * as O from "effect/Option";
import {
  ALLOWLIST_PATH,
  areLookupKeysEquivalent,
  decodeAllowlistCheckInput,
  decodeAllowlistSnapshot,
  EffectLawsAllowlistLookupKey,
  EffectLawsAllowlistSnapshot,
  toSnapshotDecodeDiagnostics,
} from "../internal/eslint/EffectLawsAllowlistSchemas.ts";
import { ALLOWLIST_SNAPSHOT } from "../internal/eslint/generated/EffectLawsAllowlistSnapshot.ts";
import { normalizePath } from "./Shared.ts";

const fallbackAllowlistPath = normalizePath(`${process.cwd()}/${ALLOWLIST_PATH}`);

const decodedAllowlistSnapshot = pipe(
  Result.try({
    try: () => decodeAllowlistSnapshot(ALLOWLIST_SNAPSHOT),
    catch: toSnapshotDecodeDiagnostics,
  }),
  Result.match({
    onFailure: (diagnostics) =>
      EffectLawsAllowlistSnapshot.make({
        path: fallbackAllowlistPath,
        diagnostics,
      }),
    onSuccess: identity,
  })
);

/**
 * Reset memoized allowlist state.
 *
 * **Details**
 *
 * Snapshot-backed runtime has no mutable cache, so this is a compatibility no-op.
 *
 * **Example** (Reset returns undefined)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { resetAllowlistCache } from "@beep/repo-configs/eslint/EffectLawsAllowlist"
 *
 * strictEqual(resetAllowlistCache(), undefined)
 * ```
 *
 * @returns `undefined` because snapshot-backed runtime has no mutable cache.
 * @category utilities
 * @since 0.0.0
 */
export const resetAllowlistCache = (): void => undefined;

/**
 * Retrieve allowlist decode diagnostics.
 *
 * **Example** (Log allowlist diagnostics)
 *
 * ```ts
 * import { getAllowlistDiagnostics } from "@beep/repo-configs/eslint/EffectLawsAllowlist"
 * const diagnostics = getAllowlistDiagnostics()
 * console.log(diagnostics)
 * ```
 *
 * @returns Read-only diagnostic messages produced while loading/decoding the allowlist document.
 * @category utilities
 * @since 0.0.0
 */
export const getAllowlistDiagnostics = (): ReadonlyArray<string> => decodedAllowlistSnapshot.diagnostics;

/**
 * Retrieve normalized allowlist entries from the generated snapshot.
 *
 * **Example** (Log allowlist entries)
 *
 * ```ts
 * import { getAllowlistEntries } from "@beep/repo-configs/eslint/EffectLawsAllowlist"
 * const entries = getAllowlistEntries()
 * console.log(entries)
 * ```
 *
 * @returns Read-only allowlist entries available to repository law checkers.
 * @category utilities
 * @since 0.0.0
 */
export const getAllowlistEntries = () => decodedAllowlistSnapshot.entries;

/**
 * Check whether a normalized violation key appears in the effect-laws allowlist.
 *
 * **Example** (Check violation allowlist match)
 *
 * ```ts
 * import { isViolationAllowlisted } from "@beep/repo-configs/eslint/EffectLawsAllowlist"
 * const allowlisted = isViolationAllowlisted({
 *   ruleId: "effect/no-native-runtime",
 *   filePath: "packages/tooling/tool/cli/src/commands/Lint/index.ts",
 *   kind: "error",
 * })
 * console.log(allowlisted)
 * ```
 *
 * @param input - Candidate violation identity payload.
 * @returns `true` when an allowlist entry exactly matches the normalized lookup key.
 * @category utilities
 * @since 0.0.0
 */
export const isViolationAllowlisted = (input: unknown): boolean =>
  pipe(
    decodeAllowlistCheckInput(input),
    O.match({
      onNone: thunkFalse,
      onSome: (normalizedInput) => {
        const normalizedLookupKey = EffectLawsAllowlistLookupKey.make({
          rule: normalizedInput.ruleId,
          file: normalizePath(normalizedInput.filePath),
          kind: normalizedInput.kind,
        });

        return A.some(decodedAllowlistSnapshot.entries, (entry) =>
          areLookupKeysEquivalent(
            normalizedLookupKey,
            EffectLawsAllowlistLookupKey.make({
              rule: entry.rule,
              file: normalizePath(entry.file),
              kind: entry.kind,
            })
          )
        );
      },
    })
  );
