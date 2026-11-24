/**
 * Immutable append-prefix validation, explicit supersession intervals and derivation closure.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Eq from "effect/Equal";
import { constTrue, dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import { ValidTime } from "./Claim/index.ts";
import { AppendResult, ClaimKnowledgeInterval, ClaimLogViolation } from "./ClaimLog.schema.ts";
import type { ClaimId } from "./ClaimCore.schema.ts";
import type { ClaimLogEntry } from "./ClaimLog.schema.ts";

const V = ClaimLogViolation.cases;
const samePartition = (left: ClaimLogEntry, right: ClaimLogEntry): boolean =>
  Eq.equals(left.scope, right.scope) && Eq.equals(left.logicalKey, right.logicalKey);
const startsBefore = (start: DateTime.Utc, end: O.Option<DateTime.Utc>): boolean =>
  O.match(end, { onNone: constTrue, onSome: (end) => DateTime.isLessThan(start, end) });
const validOverlap = (left: ClaimLogEntry, right: ClaimLogEntry): boolean =>
  ValidTime.guards.Interval(left.valid) &&
  ValidTime.guards.Interval(right.valid) &&
  startsBefore(left.valid.validFrom, right.valid.validTo) &&
  startsBefore(right.valid.validFrom, left.valid.validTo);

const supersedersIn = (log: ReadonlyArray<ClaimLogEntry>, superseded: ClaimId): HashSet.HashSet<ClaimId> =>
  HashSet.fromIterable(
    A.map(
      A.filter(log, (row) => O.contains(row.supersedes, superseded)),
      (row) => row.claim
    )
  );
const scannedPrefix = (log: ReadonlyArray<ClaimLogEntry>) => {
  const byClaim = HashMap.fromIterable(A.map(log, (row): readonly [ClaimId, ClaimLogEntry] => [row.claim, row]));
  const superseded = HashSet.fromIterable(A.getSomes(A.map(log, (row) => row.supersedes)));
  return {
    get: (claim: ClaimId) => HashMap.get(byClaim, claim),
    last: A.last(log),
    superseders: (claim: ClaimId) => supersedersIn(log, claim),
    isSuperseded: (claim: ClaimId) => HashSet.has(superseded, claim),
    current: (entry: ClaimLogEntry): ReadonlyArray<ClaimLogEntry> =>
      A.filter(log, (row) => !HashSet.has(superseded, row.claim) && samePartition(row, entry)),
  };
};
type PrefixView = ReturnType<typeof scannedPrefix>;
type Partitions = HashMap.HashMap<ClaimLogEntry["scope"], HashMap.HashMap<string, ReadonlyArray<ClaimLogEntry>>>;
const emptyIndex = () => ({
  last: O.none<ClaimLogEntry>(),
  byClaim: HashMap.empty<ClaimId, ClaimLogEntry>(),
  superseders: HashMap.empty<ClaimId, HashSet.HashSet<ClaimId>>(),
  intervals: HashMap.empty<ClaimLogEntry["scope"], HashMap.HashMap<string, ReadonlyArray<ClaimLogEntry>>>(),
});
type PrefixIndex = ReturnType<typeof emptyIndex>;
const partitionOf = (intervals: Partitions, entry: ClaimLogEntry) =>
  O.getOrElse(HashMap.get(intervals, entry.scope), HashMap.empty<string, ReadonlyArray<ClaimLogEntry>>);
const currentIntervals = (intervals: Partitions, entry: ClaimLogEntry): ReadonlyArray<ClaimLogEntry> =>
  O.getOrElse(HashMap.get(partitionOf(intervals, entry), entry.logicalKey), A.empty<ClaimLogEntry>);
const indexedPrefix = (index: PrefixIndex): PrefixView => ({
  get: (claim) => HashMap.get(index.byClaim, claim),
  last: index.last,
  superseders: (claim) => O.getOrElse(HashMap.get(index.superseders, claim), HashSet.empty<ClaimId>),
  isSuperseded: (claim) => HashMap.has(index.superseders, claim),
  current: (entry) => currentIntervals(index.intervals, entry),
});
const accept = (index: PrefixIndex, entry: ClaimLogEntry): PrefixIndex => {
  const kept = A.filter(currentIntervals(index.intervals, entry), (row) => !O.contains(entry.supersedes, row.claim));
  return {
    last: O.some(entry),
    byClaim: HashMap.set(index.byClaim, entry.claim, entry),
    superseders: O.match(entry.supersedes, {
      onNone: () => index.superseders,
      onSome: (superseded) =>
        HashMap.set(
          index.superseders,
          superseded,
          HashSet.add(indexedPrefix(index).superseders(superseded), entry.claim)
        ),
    }),
    intervals: HashMap.set(
      index.intervals,
      entry.scope,
      HashMap.set(
        partitionOf(index.intervals, entry),
        entry.logicalKey,
        ValidTime.guards.Interval(entry.valid) ? A.append(kept, entry) : kept
      )
    ),
  };
};
const appendViolations = (prefix: PrefixView, entry: ClaimLogEntry): ReadonlyArray<ClaimLogViolation> => {
  if (O.isSome(prefix.get(entry.claim))) return [V.DuplicateId.make({ claim: entry.claim })];
  const violations: Array<ClaimLogViolation> = [];
  if (O.exists(prefix.last, (row) => DateTime.isLessThan(entry.knowledgeStart, row.knowledgeStart))) {
    O.map(prefix.last, (row) =>
      violations.push(V.KnowledgeStartRegression.make({ claim: entry.claim, previous: row.claim }))
    );
  }
  if (DateTime.isLessThan(entry.knowledgeStart, entry.generatedAt)) {
    violations.push(V.StartsBeforeGeneration.make({ claim: entry.claim }));
  }
  O.map(entry.supersedes, (superseded) => {
    O.match(prefix.get(superseded), {
      onNone: () =>
        violations.push(
          Eq.equals(entry.claim, superseded)
            ? V.PredecessorNotEarlier.make({ claim: entry.claim, superseded })
            : V.SupersededMissing.make({ claim: entry.claim, superseded })
        ),
      onSome: (prior) => {
        if (!samePartition(entry, prior))
          violations.push(V.SupersededAcrossPartitions.make({ claim: entry.claim, superseded }));
        if (DateTime.isLessThan(entry.knowledgeStart, prior.knowledgeStart))
          violations.push(V.StartsBeforeSuperseded.make({ claim: entry.claim, superseded }));
      },
    });
    const superseders = prefix.superseders(superseded);
    if (!HashSet.isEmpty(superseders)) {
      violations.push(V.SupersessionFork.make({ superseded, superseders: HashSet.add(superseders, entry.claim) }));
    }
  });
  A.forEach(A.fromIterable(entry.derivedFrom), (parent) => {
    O.match(prefix.get(parent), {
      onNone: () => violations.push(V.ParentMissing.make({ claim: entry.claim, parent })),
      onSome: (row) => {
        if (DateTime.isGreaterThan(row.knowledgeStart, entry.knowledgeStart))
          violations.push(V.ParentStartsLater.make({ claim: entry.claim, parent }));
      },
    });
  });
  if (!prefix.isSuperseded(entry.claim) && !O.contains(entry.supersedes, entry.claim)) {
    A.forEach(prefix.current(entry), (row) => {
      if (!O.contains(entry.supersedes, row.claim) && validOverlap(row, entry)) {
        violations.push(V.ValidTimeOverlap.make({ left: row.claim, right: entry.claim }));
      }
    });
  }
  return violations;
};

/**
 * Validate one append against its entire already accepted prefix.
 *
 * **Example** (Append a first entry to an empty log)
 *
 * ```ts
 * import { ClaimId } from "@beep/epistemics/ClaimCore.schema"
 * import { appendProjection } from "@beep/epistemics/ClaimLog"
 * import { ClaimLogEntry } from "@beep/epistemics/ClaimLog.schema"
 * import * as DateTime from "effect/DateTime"
 * import * as HashSet from "effect/HashSet"
 * import * as O from "effect/Option"
 *
 * const entry = ClaimLogEntry.make({
 *   claim: ClaimId.make("sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
 *   scope: "fixture",
 *   logicalKey: "subject:1",
 *   supersedes: O.none(),
 *   derivedFrom: HashSet.empty(),
 *   knowledgeStart: DateTime.makeUnsafe(10),
 *   generatedAt: DateTime.makeUnsafe(0),
 *   valid: { _tag: "Unknown" },
 * })
 *
 * console.log(appendProjection([], entry)._tag) // "Appended"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const appendProjection: {
  (other: ClaimLogEntry): (self: ReadonlyArray<ClaimLogEntry>) => AppendResult;
  (self: ReadonlyArray<ClaimLogEntry>, other: ClaimLogEntry): AppendResult;
} = dual(
  2,
  (log: ReadonlyArray<ClaimLogEntry>, entry: ClaimLogEntry): AppendResult =>
    A.match(appendViolations(scannedPrefix(log), entry), {
      onEmpty: () => AppendResult.cases.Appended.make({ log: [...log, entry] }),
      onNonEmpty: (violations) => ({ _tag: "Refused", log, violations }),
    })
);

/**
 * Fold accepted prefixes so a future superseder cannot hide a historical overlap.
 *
 * **Example** (Check an empty history)
 *
 * ```ts
 * import { checkClaimLog } from "@beep/epistemics/ClaimLog"
 * console.log(checkClaimLog([]).length)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const checkClaimLog = (log: ReadonlyArray<ClaimLogEntry>): ReadonlyArray<ClaimLogViolation> => {
  const positions = A.reduce(log, HashMap.empty<ClaimId, number>(), (index, entry, at) =>
    HashMap.has(index, entry.claim) ? index : HashMap.set(index, entry.claim, at)
  );
  const violations: Array<ClaimLogViolation> = [];
  A.reduce(log, emptyIndex(), (index, entry, at) =>
    A.match(appendViolations(indexedPrefix(index), entry), {
      onEmpty: () => accept(index, entry),
      onNonEmpty: (refused) => {
        violations.push(
          ...A.map(refused, (violation) =>
            ClaimLogViolation.guards.SupersededMissing(violation) &&
            O.exists(HashMap.get(positions, violation.superseded), (position) => position >= at)
              ? V.PredecessorNotEarlier.make({ claim: violation.claim, superseded: violation.superseded })
              : violation
          )
        );
        return index;
      },
    })
  );
  return violations;
};

/**
 * End a claim's knowledge interval only at its explicit superseder's start.
 *
 * **Details**
 *
 * A superseder that starts before the claim itself is a log violation, so the claim has no
 * interval and `claimsAt` never selects it.
 *
 * **Example** (Select a missing claim)
 *
 * ```ts
 * import { knowledgeInterval } from "@beep/epistemics/ClaimLog"
 * import { ClaimId } from "@beep/epistemics/ClaimCore.schema"
 * import * as O from "effect/Option"
 * console.log(O.isNone(knowledgeInterval([], ClaimId.make("sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"))))
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const knowledgeInterval: {
  (other: ClaimId): (self: ReadonlyArray<ClaimLogEntry>) => O.Option<ClaimKnowledgeInterval>;
  (self: ReadonlyArray<ClaimLogEntry>, other: ClaimId): O.Option<ClaimKnowledgeInterval>;
} = dual(
  2,
  (log: ReadonlyArray<ClaimLogEntry>, claim: ClaimId): O.Option<ClaimKnowledgeInterval> =>
    O.flatMap(
      A.findFirst(log, (row) => Eq.equals(row.claim, claim)),
      (row) =>
        ClaimKnowledgeInterval.makeOption({
          start: row.knowledgeStart,
          end: O.map(
            A.findFirst(log, (next) => O.contains(next.supersedes, claim)),
            (next) => next.knowledgeStart
          ),
        })
    )
);

/**
 * Select cores on half-open knowledge bounds at an explicit time.
 *
 * **Example** (Select an empty history)
 *
 * ```ts
 * import { claimsAt } from "@beep/epistemics/ClaimLog"
 * import * as DateTime from "effect/DateTime"
 * console.log(claimsAt([], DateTime.makeUnsafe(0)))
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const claimsAt: {
  (other: DateTime.Utc): (self: ReadonlyArray<ClaimLogEntry>) => ReadonlyArray<ClaimLogEntry>;
  (self: ReadonlyArray<ClaimLogEntry>, other: DateTime.Utc): ReadonlyArray<ClaimLogEntry>;
} = dual(2, (log: ReadonlyArray<ClaimLogEntry>, asOf: DateTime.Utc): ReadonlyArray<ClaimLogEntry> => {
  const firstAt = (index: HashMap.HashMap<ClaimId, DateTime.Utc>, claim: ClaimId, at: DateTime.Utc) =>
    HashMap.has(index, claim) ? index : HashMap.set(index, claim, at);
  const starts = A.reduce(log, HashMap.empty<ClaimId, DateTime.Utc>(), (index, row) =>
    firstAt(index, row.claim, row.knowledgeStart)
  );
  const ends = A.reduce(log, HashMap.empty<ClaimId, DateTime.Utc>(), (index, row) =>
    O.match(row.supersedes, {
      onNone: () => index,
      onSome: (superseded) => firstAt(index, superseded, row.knowledgeStart),
    })
  );
  return A.filter(log, (row) =>
    O.exists(
      HashMap.get(starts, row.claim),
      (start) => !DateTime.isLessThan(asOf, start) && startsBefore(asOf, HashMap.get(ends, row.claim))
    )
  );
});

/**
 * Flag nonempty wholly dead derivation transitively; roots and partial support survive.
 *
 * **Example** (No derivations are orphaned in an empty graph)
 *
 * ```ts
 * import { orphanedDerivations } from "@beep/epistemics/ClaimLog"
 * import * as HashMap from "effect/HashMap"
 * import * as HashSet from "effect/HashSet"
 * console.log(HashSet.size(orphanedDerivations(HashMap.empty(), HashSet.empty())))
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const orphanedDerivations: {
  (
    other: HashSet.HashSet<ClaimId>
  ): (self: HashMap.HashMap<ClaimId, HashSet.HashSet<ClaimId>>) => HashSet.HashSet<ClaimId>;
  (self: HashMap.HashMap<ClaimId, HashSet.HashSet<ClaimId>>, other: HashSet.HashSet<ClaimId>): HashSet.HashSet<ClaimId>;
} = dual(
  2,
  (
    derivedFrom: HashMap.HashMap<ClaimId, HashSet.HashSet<ClaimId>>,
    retracted: HashSet.HashSet<ClaimId>
  ): HashSet.HashSet<ClaimId> => {
    const dependents = HashMap.reduce(
      derivedFrom,
      HashMap.empty<ClaimId, HashSet.HashSet<ClaimId>>(),
      (index, parents, child) =>
        HashSet.reduce(parents, index, (index, parent) =>
          HashMap.set(
            index,
            parent,
            HashSet.add(O.getOrElse(HashMap.get(index, parent), HashSet.empty<ClaimId>), child)
          )
        )
    );
    let remaining = HashMap.map(derivedFrom, (parents) => HashSet.size(HashSet.difference(parents, retracted)));
    let frontier = derivedFrom.pipe(
      HashMap.toEntries,
      A.filterMap(([claim, parents]) =>
        !HashSet.has(retracted, claim) && !HashSet.isEmpty(parents) && O.contains(HashMap.get(remaining, claim), 0)
          ? Result.succeed(claim)
          : Result.failVoid
      ),
      HashSet.fromIterable
    );
    let flagged = HashSet.empty<ClaimId>();
    while (!HashSet.isEmpty(frontier)) {
      flagged = HashSet.union(flagged, frontier);
      let next = HashSet.empty<ClaimId>();
      A.forEach(A.fromIterable(frontier), (dead) =>
        A.forEach(A.fromIterable(O.getOrElse(HashMap.get(dependents, dead), HashSet.empty<ClaimId>)), (child) => {
          if (!HashSet.has(retracted, child)) {
            remaining = HashMap.modify(remaining, child, (live) => live - 1);
            if (O.contains(HashMap.get(remaining, child), 0)) next = HashSet.add(next, child);
          }
        })
      );
      frontier = next;
    }
    return flagged;
  }
);

/**
 * Claim-log projections and refusal schemas.
 *
 * **Example** (Inspect append result cases)
 *
 * ```ts
 * import { AppendResult } from "@beep/epistemics/ClaimLog"
 * console.log(AppendResult.cases.Appended.make({ log: [] })._tag)
 * ```
 *
 * @category exports
 * @since 0.0.0
 */
export * from "./ClaimLog.schema.ts";
