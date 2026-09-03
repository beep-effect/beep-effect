/**
 * Lifecycle and compatibility classification for court/reporter artifacts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, O } from "@beep/utils";
import { Order, pipe } from "effect";
import * as Eq from "effect/Equal";
import { dual, flow } from "effect/Function";
import * as R from "effect/Record";
import {
  ArtifactCompatibilityPolicy,
  ArtifactDriftChange,
  ArtifactDriftReport,
} from "./CourtReporterVocabulary.model.ts";
import type {
  ArtifactDriftChangeKind,
  ContextualAlias,
  CourtReporterArtifactComparison,
  CourtVocabularyRecord,
  ReporterVocabularyRecord,
} from "./CourtReporterVocabulary.model.ts";

const compatibleChanges: ReadonlyArray<ArtifactDriftChangeKind> = [
  "addition",
  "aliasAddition",
  "tombstone",
  "successor",
  "merger",
  "abbreviationReuse",
  "dateSplit",
];

const incompatibleChanges: ReadonlyArray<ArtifactDriftChangeKind> = [
  "aliasRemoval",
  "successorRemoval",
  "idReassignment",
  "semanticReuse",
  "removalWithoutTombstone",
  "schemaChange",
  "projectionChange",
];

/**
 * Machine-readable lifecycle policy applied by the artifact classifier.
 *
 * **Details**
 *
 * Additions and explicit lifecycle transitions retain every issued identity.
 * Removing or reassigning an identity, removing an alias, or changing the
 * schema/projection contract is incompatible.
 *
 * **Example** (Inspect identity-breaking changes)
 *
 * ```ts
 * import { CourtReporterCompatibilityPolicy } from "@beep/law-practice-domain/values/CourtReporterVocabulary"
 *
 * console.log(CourtReporterCompatibilityPolicy.incompatibleChanges.includes("idReassignment")) // true
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const CourtReporterCompatibilityPolicy = ArtifactCompatibilityPolicy.make({
  compatibleChanges,
  incompatibleChanges,
});

type SubjectKind = "court" | "reporter";
type ArtifactHeaders = Pick<CourtReporterArtifactComparison, "projectionVersion" | "schemaVersion">;
type ComparisonArtifactHeaders = ArtifactHeaders & {
  readonly courts: ArtifactHeaders;
  readonly reporters: ArtifactHeaders;
};

interface NormalizedRecord {
  readonly aliases: ReadonlyArray<string>;
  readonly contextualAliases: ReadonlyArray<ContextualAlias>;
  readonly id: string;
  readonly lineageKey: string;
  readonly plainAliases: ReadonlyArray<string>;
  readonly ranges: ReadonlyArray<string>;
  readonly semanticContent: string;
  readonly semanticKey: string;
  readonly status: "active" | "tombstone";
  readonly successorId: O.Option<string>;
}

const normalizeStringSet: (values: ReadonlyArray<string>) => ReadonlyArray<string> = flow(
  A.dedupe,
  A.sort(Order.String)
);

const normalizeAliases = (
  aliases: ReadonlyArray<string>,
  contextualAliases: ReadonlyArray<{ readonly alias: string }>
) => pipe(aliases, A.appendAll(A.map(contextualAliases, (entry) => entry.alias)), normalizeStringSet);

const normalizeOption = <A>(value: O.Option<A>): A | null => O.getOrNull(value);

const normalizeCourt = (record: CourtVocabularyRecord): NormalizedRecord => ({
  id: record.id,
  semanticKey: record.semanticKey,
  lineageKey: record.lineageKey,
  aliases: normalizeAliases(record.aliases, record.contextualAliases),
  contextualAliases: record.contextualAliases,
  plainAliases: normalizeStringSet(record.aliases),
  ranges: pipe(
    record.effectiveRanges,
    A.map(({ start, end }) => JSON.stringify([normalizeOption(start), normalizeOption(end)])),
    normalizeStringSet
  ),
  semanticContent: JSON.stringify([
    record.sourceId,
    record.name,
    normalizeOption(record.nameAbbreviation),
    record.citationString,
    normalizeOption(record.sourceJurisdiction),
    record.system,
    normalizeOption(record.type),
    normalizeOption(record.hierarchyLevel),
    record.location,
    normalizeOption(record.parentId),
  ]),
  status: record.status,
  successorId: record.successorId,
});

const normalizeReporter = (record: ReporterVocabularyRecord): NormalizedRecord => ({
  id: record.id,
  semanticKey: record.semanticKey,
  lineageKey: record.lineageKey,
  aliases: normalizeAliases(record.aliases, record.contextualAliases),
  contextualAliases: record.contextualAliases,
  plainAliases: normalizeStringSet(record.aliases),
  ranges: pipe(
    record.editions,
    A.map(({ abbreviation, start, end }) =>
      JSON.stringify([abbreviation, normalizeOption(start), normalizeOption(end)])
    ),
    normalizeStringSet
  ),
  semanticContent: JSON.stringify([
    record.primaryAbbreviation,
    record.name,
    record.citeType,
    normalizeStringSet(record.jurisdictions),
  ]),
  status: record.status,
  successorId: record.successorId,
});

const sameStringSet = (left: ReadonlyArray<string>, right: ReadonlyArray<string>) =>
  A.length(left) === A.length(right) && A.every(left, (value) => A.contains(right, value));

const contextualAliasTexts: (aliases: ReadonlyArray<ContextualAlias>) => ReadonlyArray<string> = flow(
  A.map((entry: ContextualAlias) => entry.alias),
  normalizeStringSet
);

const contextualAliasContexts = (aliases: ReadonlyArray<ContextualAlias>, alias: string) =>
  pipe(
    aliases,
    A.filter((entry) => Eq.equals(entry.alias, alias)),
    A.map((entry) => entry.context),
    normalizeStringSet
  );

const hasContextualAliasContextDrift = (previous: NormalizedRecord, next: NormalizedRecord) =>
  pipe(
    contextualAliasTexts(previous.contextualAliases),
    A.filter((alias) => A.contains(contextualAliasTexts(next.contextualAliases), alias)),
    A.some(
      (alias) =>
        !sameStringSet(
          contextualAliasContexts(previous.contextualAliases, alias),
          contextualAliasContexts(next.contextualAliases, alias)
        )
    )
  );

const isAdditiveRangeSplit = (previous: NormalizedRecord, next: NormalizedRecord) =>
  A.length(next.ranges) > A.length(previous.ranges) &&
  A.every(previous.ranges, (range) => A.contains(next.ranges, range));

const hasSemanticDrift = (previous: NormalizedRecord, next: NormalizedRecord, additiveRangeSplit: boolean) =>
  !Eq.equals(previous.semanticKey, next.semanticKey) ||
  !Eq.equals(previous.lineageKey, next.lineageKey) ||
  !Eq.equals(previous.semanticContent, next.semanticContent) ||
  hasContextualAliasContextDrift(previous, next) ||
  (!sameStringSet(previous.ranges, next.ranges) && !additiveRangeSplit);

const changeCompatibility = (kind: ArtifactDriftChangeKind) =>
  A.contains(compatibleChanges, kind) ? ("compatible" as const) : ("incompatible" as const);

const change = (
  kind: ArtifactDriftChangeKind,
  subjectKind: "artifact" | SubjectKind,
  subjectIds: ReadonlyArray<string>,
  detail: string
) =>
  ArtifactDriftChange.make({
    kind,
    compatibility: changeCompatibility(kind),
    subjectKind,
    subjectIds,
    detail,
  });

const headerDriftChanges = (
  previous: ComparisonArtifactHeaders,
  next: ComparisonArtifactHeaders
): ReadonlyArray<ArtifactDriftChange> => {
  const changes: Array<ArtifactDriftChange> = [];
  const compare = (previousHeaders: ArtifactHeaders, nextHeaders: ArtifactHeaders, scope: string) => {
    if (!Eq.equals(previousHeaders.schemaVersion, nextHeaders.schemaVersion)) {
      changes.push(change("schemaChange", "artifact", [], `The ${scope} schema version changed.`));
    }
    if (!Eq.equals(previousHeaders.projectionVersion, nextHeaders.projectionVersion)) {
      changes.push(change("projectionChange", "artifact", [], `The ${scope} projection version changed.`));
    }
  };

  compare(previous, next, "combined artifact");
  compare(previous.courts, next.courts, "court artifact");
  compare(previous.reporters, next.reporters, "reporter artifact");
  return changes;
};

const headerCoherenceChanges = (
  artifact: ComparisonArtifactHeaders,
  side: "previous" | "next"
): ReadonlyArray<ArtifactDriftChange> => {
  const changes: Array<ArtifactDriftChange> = [];
  const compare = (nested: ArtifactHeaders, scope: string) => {
    if (!Eq.equals(artifact.schemaVersion, nested.schemaVersion)) {
      changes.push(
        change(
          "schemaChange",
          "artifact",
          [],
          `The ${side} ${scope} schema version disagrees with its combined artifact.`
        )
      );
    }
    if (!Eq.equals(artifact.projectionVersion, nested.projectionVersion)) {
      changes.push(
        change(
          "projectionChange",
          "artifact",
          [],
          `The ${side} ${scope} projection version disagrees with its combined artifact.`
        )
      );
    }
  };

  compare(artifact.courts, "court artifact");
  compare(artifact.reporters, "reporter artifact");
  return changes;
};

const byKey = (records: ReadonlyArray<NormalizedRecord>, key: "id" | "semanticKey") =>
  pipe(
    records,
    A.map((record) => [record[key], record] as const),
    R.fromEntries
  );

const byLineage = (records: ReadonlyArray<NormalizedRecord>) => A.groupBy(records, (record) => record.lineageKey);

const aliasesByIdentity = (record: NormalizedRecord) => A.dedupe(record.aliases);

const aliasOwners = flow(
  A.flatMap((record: NormalizedRecord) => A.map(aliasesByIdentity(record), (alias) => [alias, record.id] as const)),
  A.groupBy(([alias]) => alias),
  R.map(
    flow(
      A.map(([, id]) => id),
      A.dedupe
    )
  )
);

const compareAliases = (
  subjectKind: SubjectKind,
  previous: NormalizedRecord,
  next: NormalizedRecord
): ReadonlyArray<ArtifactDriftChange> => {
  const previousContextualAliases = contextualAliasTexts(previous.contextualAliases);
  const nextContextualAliases = contextualAliasTexts(next.contextualAliases);
  const additions = normalizeStringSet([
    ...A.filter(next.aliases, (alias) => !A.contains(previous.aliases, alias)),
    ...A.filter(next.plainAliases, (alias) => !A.contains(previous.plainAliases, alias)),
    ...A.filter(nextContextualAliases, (alias) => !A.contains(previousContextualAliases, alias)),
  ]);
  const removals = normalizeStringSet([
    ...A.filter(previous.aliases, (alias) => !A.contains(next.aliases, alias)),
    ...A.filter(previous.plainAliases, (alias) => !A.contains(next.plainAliases, alias)),
    ...A.filter(previousContextualAliases, (alias) => !A.contains(nextContextualAliases, alias)),
  ]);

  return [
    ...A.map(additions, (alias) =>
      change("aliasAddition", subjectKind, [next.id], `Alias ${JSON.stringify(alias)} was added.`)
    ),
    ...A.map(removals, (alias) =>
      change("aliasRemoval", subjectKind, [next.id], `Alias ${JSON.stringify(alias)} was removed.`)
    ),
  ];
};

const compareFamily = (
  subjectKind: SubjectKind,
  previous: ReadonlyArray<NormalizedRecord>,
  next: ReadonlyArray<NormalizedRecord>
): ReadonlyArray<ArtifactDriftChange> => {
  const previousById = byKey(previous, "id");
  const nextById = byKey(next, "id");
  const previousBySemanticKey = byKey(previous, "semanticKey");
  const nextBySemanticKey = byKey(next, "semanticKey");
  const previousByLineageKey = byLineage(previous);

  const removedRecordChanges = (previousRecord: NormalizedRecord) =>
    pipe(
      R.get(nextBySemanticKey, previousRecord.semanticKey),
      O.match({
        onNone: () => [
          change(
            "removalWithoutTombstone",
            subjectKind,
            [previousRecord.id],
            "An issued identity disappeared instead of remaining as a tombstone."
          ),
        ],
        onSome: (reassigned) => [
          change(
            "idReassignment",
            subjectKind,
            [previousRecord.id, reassigned.id],
            "A published semantic identity was assigned a different stable ID."
          ),
        ],
      })
    );

  const retainedRecordChanges = (previousRecord: NormalizedRecord, nextRecord: NormalizedRecord) => {
    const changes: Array<ArtifactDriftChange> = [...compareAliases(subjectKind, previousRecord, nextRecord)];
    const additiveRangeSplit = isAdditiveRangeSplit(previousRecord, nextRecord);

    if (hasSemanticDrift(previousRecord, nextRecord, additiveRangeSplit)) {
      changes.push(
        change(
          "semanticReuse",
          subjectKind,
          [previousRecord.id],
          "A published stable ID now names different semantic content or effective-range boundaries."
        )
      );
    }

    if (previousRecord.status === "active" && nextRecord.status === "tombstone") {
      changes.push(
        change("tombstone", subjectKind, [previousRecord.id], "An issued identity was retained as a tombstone.")
      );
    }

    if (O.isSome(previousRecord.successorId) && !Eq.equals(previousRecord.successorId, nextRecord.successorId)) {
      changes.push(
        change(
          "successorRemoval",
          subjectKind,
          [previousRecord.id, previousRecord.successorId.value],
          "A published successor assignment was removed or replaced."
        )
      );
    }

    if (additiveRangeSplit) {
      changes.push(
        change("dateSplit", subjectKind, [previousRecord.id], "The identity gained a distinct effective range.")
      );
    }

    return changes;
  };

  const lineageAdditionChanges = (nextRecord: NormalizedRecord) =>
    pipe(
      R.get(previousByLineageKey, nextRecord.lineageKey),
      O.match({
        onNone: () => [change("addition", subjectKind, [nextRecord.id], "A new stable identity was added.")],
        onSome: (lineage) => [
          change(
            "dateSplit",
            subjectKind,
            [...A.map(lineage, (record) => record.id), nextRecord.id],
            "A lineage was split into a new stable identity for a distinct effective range."
          ),
        ],
      })
    );

  const semanticAdditionChanges = (nextRecord: NormalizedRecord) =>
    pipe(
      R.get(previousBySemanticKey, nextRecord.semanticKey),
      O.match({
        onSome: A.empty<ArtifactDriftChange>,
        onNone: () => lineageAdditionChanges(nextRecord),
      })
    );

  const retainedChanges = A.flatMap(previous, (previousRecord) =>
    pipe(
      R.get(nextById, previousRecord.id),
      O.match({
        onNone: () => removedRecordChanges(previousRecord),
        onSome: (nextRecord) => retainedRecordChanges(previousRecord, nextRecord),
      })
    )
  );

  const addedChanges = A.flatMap(next, (nextRecord) =>
    pipe(
      R.get(previousById, nextRecord.id),
      O.match({
        onNone: () => semanticAdditionChanges(nextRecord),
        onSome: A.empty<ArtifactDriftChange>,
      })
    )
  );

  const successorGroups = pipe(
    next,
    A.map((record) =>
      record.status === "tombstone"
        ? pipe(
            record.successorId,
            O.map((successorId) => [successorId, record.id] as const)
          )
        : O.none()
    ),
    A.getSomes,
    A.groupBy(([successorId]) => successorId)
  );
  const successorChanges = pipe(
    R.toEntries(successorGroups),
    A.map(([successorId, entries]) => {
      const predecessorIds = A.map(entries, ([, id]) => id);
      const changedEntries = A.filter(entries, ([, id]) =>
        pipe(
          R.get(previousById, id),
          O.match({
            onNone: () => true,
            onSome: (previousRecord) =>
              previousRecord.status !== "tombstone" || !Eq.equals(previousRecord.successorId, O.some(successorId)),
          })
        )
      );
      const kind = A.length(predecessorIds) > 1 ? ("merger" as const) : ("successor" as const);
      return A.isReadonlyArrayNonEmpty(changedEntries)
        ? O.some(
            change(
              kind,
              subjectKind,
              [...predecessorIds, successorId],
              kind === "merger"
                ? "Multiple tombstoned identities now name one retained successor."
                : "A tombstoned identity now names its retained successor."
            )
          )
        : O.none();
    }),
    A.getSomes
  );

  const previousAliasOwners = aliasOwners(previous);
  const nextAliasOwners = aliasOwners(next);
  const reuseChanges = pipe(
    R.toEntries(nextAliasOwners),
    A.map(([alias, owners]) => {
      const previousOwnerCount = pipe(
        R.get(previousAliasOwners, alias),
        O.map(A.length),
        O.getOrElse(() => 0)
      );
      return A.length(owners) > 1 && previousOwnerCount <= 1
        ? O.some(
            change(
              "abbreviationReuse",
              subjectKind,
              owners,
              `Alias ${JSON.stringify(alias)} became contextual because it names multiple identities.`
            )
          )
        : O.none();
    }),
    A.getSomes
  );

  return [...retainedChanges, ...addedChanges, ...successorChanges, ...reuseChanges];
};

/**
 * Classifies every compatibility-relevant change between two artifacts.
 *
 * **Details**
 *
 * The report covers additions, alias drift, tombstones, successors, mergers,
 * abbreviation reuse, date splits, stable-ID reassignment, semantic reuse,
 * disappearance without a tombstone, and schema/projection changes.
 *
 * **Example** (Classify the unchanged current artifact)
 *
 * ```ts
 * import {
 *   classifyCourtReporterArtifactCompatibility,
 *   CourtReporterArtifact,
 * } from "@beep/law-practice-domain/values/CourtReporterVocabulary"
 *
 * const report = classifyCourtReporterArtifactCompatibility(CourtReporterArtifact, CourtReporterArtifact)
 * console.log(report.compatibility) // "compatible"
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const classifyCourtReporterArtifactCompatibility: {
  (previous: CourtReporterArtifactComparison, next: CourtReporterArtifactComparison): ArtifactDriftReport;
  (next: CourtReporterArtifactComparison): (previous: CourtReporterArtifactComparison) => ArtifactDriftReport;
} = dual(2, (previous: CourtReporterArtifactComparison, next: CourtReporterArtifactComparison): ArtifactDriftReport => {
  const changes = [
    ...headerCoherenceChanges(previous, "previous"),
    ...headerCoherenceChanges(next, "next"),
    ...headerDriftChanges(previous, next),
    ...compareFamily(
      "court",
      A.map(previous.courts.records, normalizeCourt),
      A.map(next.courts.records, normalizeCourt)
    ),
    ...compareFamily(
      "reporter",
      A.map(previous.reporters.records, normalizeReporter),
      A.map(next.reporters.records, normalizeReporter)
    ),
  ];
  const compatibility = A.some(changes, (entry) => entry.compatibility === "incompatible")
    ? ("incompatible" as const)
    : ("compatible" as const);

  return ArtifactDriftReport.make({
    fromVersion: previous.artifactVersion,
    toVersion: next.artifactVersion,
    compatibility,
    changes,
  });
});
