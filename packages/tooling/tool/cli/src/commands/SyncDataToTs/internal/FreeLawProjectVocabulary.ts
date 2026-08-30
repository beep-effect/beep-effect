/**
 * Shared constants and deterministic alias classification for the pinned
 * Free Law Project vocabulary targets.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, O, Str } from "@beep/utils";
import { pipe } from "effect";
import { dual } from "effect/Function";
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

type IssuedVocabularyRecord = {
  readonly id: string;
  readonly lineageKey: string;
  readonly successorId: string | null;
};

/**
 * Reconciles a regenerated vocabulary with every previously issued identity.
 *
 * **Details**
 *
 * Current-source rows retain source order. Previously issued rows absent from
 * the new source are appended through `onRemoved`, with a successor inferred
 * only when exactly one current row shares the prior lineage. Callers decide
 * how retained tombstones and target-specific successor fields are encoded.
 *
 * **Example** (Retain a removed issued identity)
 *
 * ```ts
 * import { preserveIssuedVocabularyRecords } from "@beep/repo-cli/commands/SyncDataToTs/internal/FreeLawProjectVocabulary"
 *
 * type VocabularyRecord = {
 *   readonly id: string
 *   readonly lineageKey: string
 *   readonly status: "active" | "tombstone"
 *   readonly successorId: string | null
 * }
 *
 * const previous: ReadonlyArray<VocabularyRecord> = [
 *   { id: "old", lineageKey: "family", status: "active", successorId: null }
 * ]
 * const current: ReadonlyArray<VocabularyRecord> = [
 *   { id: "new", lineageKey: "family", status: "active", successorId: null }
 * ]
 * const records = preserveIssuedVocabularyRecords(
 *   previous,
 *   current,
 *   (_, next) => next,
 *   (record, successorId): VocabularyRecord => ({
 *     id: record.id,
 *     lineageKey: record.lineageKey,
 *     status: "tombstone",
 *     successorId,
 *   })
 * )
 *
 * console.log(records[1]?.status) // "tombstone"
 * ```
 *
 * @param previous - Records from the last published vocabulary sidecar.
 * @param current - Records projected from the newly pinned source.
 * @param onRetained - Reconciles an identity present in both artifacts.
 * @param onRemoved - Tombstones an absent identity with its retained or uniquely inferred lineage successor.
 * @returns Current rows followed by preserved issued rows that disappeared from the source.
 * @category mapping
 * @since 0.0.0
 */
export const preserveIssuedVocabularyRecords: {
  <Record extends IssuedVocabularyRecord>(
    previous: ReadonlyArray<Record>,
    current: ReadonlyArray<Record>,
    onRetained: (previous: Record, current: Record) => Record,
    onRemoved: (previous: Record, successorId: string | null) => Record
  ): ReadonlyArray<Record>;
  <Record extends IssuedVocabularyRecord>(
    current: ReadonlyArray<Record>,
    onRetained: (previous: Record, current: Record) => Record,
    onRemoved: (previous: Record, successorId: string | null) => Record
  ): (previous: ReadonlyArray<Record>) => ReadonlyArray<Record>;
} = dual(
  4,
  <Record extends IssuedVocabularyRecord>(
    previous: ReadonlyArray<Record>,
    current: ReadonlyArray<Record>,
    onRetained: (previous: Record, current: Record) => Record,
    onRemoved: (previous: Record, successorId: string | null) => Record
  ): ReadonlyArray<Record> => {
    const previousById = pipe(
      previous,
      A.map((record) => [record.id, record] as const),
      R.fromEntries
    );
    const currentById = pipe(
      current,
      A.map((record) => [record.id, record] as const),
      R.fromEntries
    );
    const currentByLineage = A.groupBy(current, (record) => record.lineageKey);
    const retained = A.map(current, (record) =>
      pipe(
        R.get(previousById, record.id),
        O.match({
          onNone: () => record,
          onSome: (issued) => onRetained(issued, record),
        })
      )
    );
    const removed = pipe(
      previous,
      A.filter((record) => O.isNone(R.get(currentById, record.id))),
      A.map((record) => {
        const successor = pipe(
          R.get(currentByLineage, record.lineageKey),
          O.filter((candidates) => A.length(candidates) === 1),
          O.flatMap((candidates) => A.get(candidates, 0))
        );

        const successorId = pipe(
          O.fromNullishOr(record.successorId),
          O.orElse(() => O.map(successor, ({ id }) => id)),
          O.getOrNull
        );

        return onRemoved(record, successorId);
      })
    );

    return pipe(retained, A.appendAll(removed));
  }
);
