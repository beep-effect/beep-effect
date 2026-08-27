/**
 * Shared constants and deterministic alias classification for the pinned
 * Free Law Project vocabulary targets.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, Str } from "@beep/utils";
import { pipe } from "effect";
import * as R from "effect/Record";

/**
 * Exact combined court/reporter artifact version for the two pinned sources.
 *
 * **Details**
 *
 * The identifier changes whenever either pinned commit changes. Compatibility
 * with an earlier identifier is classified separately by the public
 * law-practice contract.
 *
 * **Example** (Record the current vocabulary version)
 *
 * ```ts
 * import { COURT_REPORTER_ARTIFACT_VERSION } from "@beep/repo-cli/commands/SyncDataToTs/internal/FreeLawProjectVocabulary"
 *
 * console.log(COURT_REPORTER_ARTIFACT_VERSION.startsWith("crv1:")) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const COURT_REPORTER_ARTIFACT_VERSION = "crv1:f353e51400a5:fad63b383b92" as const;

/**
 * Machine-readable schema identifier shared by both vocabulary projections.
 *
 * **Example** (Inspect the schema family)
 *
 * ```ts
 * import { COURT_REPORTER_VOCABULARY_SCHEMA_VERSION } from "@beep/repo-cli/commands/SyncDataToTs/internal/FreeLawProjectVocabulary"
 *
 * console.log(COURT_REPORTER_VOCABULARY_SCHEMA_VERSION) // "court-reporter-vocabulary/v1"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const COURT_REPORTER_VOCABULARY_SCHEMA_VERSION = "court-reporter-vocabulary/v1" as const;

/**
 * Projection revision for the public court/reporter record shapes.
 *
 * **Example** (Inspect the projection revision)
 *
 * ```ts
 * import { COURT_REPORTER_PROJECTION_VERSION } from "@beep/repo-cli/commands/SyncDataToTs/internal/FreeLawProjectVocabulary"
 *
 * console.log(COURT_REPORTER_PROJECTION_VERSION) // 1
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const COURT_REPORTER_PROJECTION_VERSION = 1 as const;

/**
 * Separates aliases owned by one identity from aliases reused by several
 * identities.
 *
 * **Details**
 *
 * Every tuple contains an identity, a human review context, and its candidate
 * aliases. The result keeps unambiguous aliases as strings and emits reused
 * aliases with the supplied context so lookups never collapse them into one
 * identity.
 *
 * **Example** (Classify one reused abbreviation)
 *
 * ```ts
 * import { classifyVocabularyAliases } from "@beep/repo-cli/commands/SyncDataToTs/internal/FreeLawProjectVocabulary"
 *
 * const classified = classifyVocabularyAliases([
 *   ["first", "First reporter", ["Rep."]],
 *   ["second", "Second reporter", ["Rep."]],
 * ])
 *
 * console.log(classified[0]?.[2][0]?.[0]) // "Rep."
 * ```
 *
 * @param seeds - Identity, review-context, and candidate-alias tuples to classify.
 * @returns Each identity with unique aliases separated from context-bearing reused aliases.
 * @category mapping
 * @since 0.0.0
 */
export const classifyVocabularyAliases = (
  seeds: ReadonlyArray<readonly [id: string, context: string, aliases: ReadonlyArray<string>]>
): ReadonlyArray<
  readonly [
    id: string,
    aliases: ReadonlyArray<string>,
    contextualAliases: ReadonlyArray<readonly [alias: string, context: string]>,
  ]
> => {
  const usages = pipe(
    seeds,
    A.flatMap(([id, context, aliases]) => A.map(aliases, (alias) => ({ alias, context, id }))),
    A.groupBy((usage) => usage.alias)
  );

  return A.map(seeds, ([id, context, seedAliases]) => {
    const aliases = pipe(seedAliases, A.dedupe, A.filter(Str.isNonEmpty));
    const reused = A.filter(aliases, (alias) =>
      pipe(
        R.get(usages, alias),
        A.fromOption,
        A.flatten,
        A.map((entry) => entry.id),
        A.dedupe,
        A.length,
        (count) => count > 1
      )
    );

    return [
      id,
      A.filter(aliases, (alias) => !A.contains(reused, alias)),
      A.map(reused, (alias) => [alias, context] as const),
    ] as const;
  });
};
