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

/**
 * Validate one append against its entire already accepted prefix.
 *
 * **Example** (Inspect an empty log)
 *
 * ```ts
 * import { checkClaimLog } from "@beep/epistemics/ClaimLog"
 * console.log(checkClaimLog([]))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const appendProjection: {
  (other: ClaimLogEntry): (self: ReadonlyArray<ClaimLogEntry>) => AppendResult;
  (self: ReadonlyArray<ClaimLogEntry>, other: ClaimLogEntry): AppendResult;
} = dual(2, (log: ReadonlyArray<ClaimLogEntry>, entry: ClaimLogEntry): AppendResult => {
  const byClaim = HashMap.fromIterable(A.map(log, (row): readonly [ClaimId, ClaimLogEntry] => [row.claim, row]));
  if (HashMap.has(byClaim, entry.claim)) {
    return { _tag: "Refused", log, violations: [V.DuplicateId.make({ claim: entry.claim })] };
  }
  const violations: Array<ClaimLogViolation> = [];
  const previous = A.last(log);
  if (O.exists(previous, (row) => DateTime.isLessThan(entry.knowledgeStart, row.knowledgeStart))) {
    O.map(previous, (row) =>
      violations.push(V.KnowledgeStartRegression.make({ claim: entry.claim, previous: row.claim }))
    );
  }
  if (DateTime.isLessThan(entry.knowledgeStart, entry.generatedAt)) {
    violations.push(V.StartsBeforeGeneration.make({ claim: entry.claim }));
  }
  O.map(entry.supersedes, (superseded) => {
    O.match(HashMap.get(byClaim, superseded), {
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
    const superseders = HashSet.fromIterable(
      A.map(
        A.filter(log, (row) => O.contains(row.supersedes, superseded)),
        (row) => row.claim
      )
    );
    if (!HashSet.isEmpty(superseders)) {
      violations.push(V.SupersessionFork.make({ superseded, superseders: HashSet.add(superseders, entry.claim) }));
    }
  });
  A.forEach(A.fromIterable(entry.derivedFrom), (parent) => {
    O.match(HashMap.get(byClaim, parent), {
      onNone: () => violations.push(V.ParentMissing.make({ claim: entry.claim, parent })),
      onSome: (row) => {
        if (DateTime.isGreaterThan(row.knowledgeStart, entry.knowledgeStart))
          violations.push(V.ParentStartsLater.make({ claim: entry.claim, parent }));
      },
    });
  });
  const superseded = HashSet.fromIterable(A.getSomes(A.map([...log, entry], (row) => row.supersedes)));
  if (!HashSet.has(superseded, entry.claim)) {
    A.forEach(log, (row) => {
      if (!HashSet.has(superseded, row.claim) && samePartition(row, entry) && validOverlap(row, entry)) {
        violations.push(V.ValidTimeOverlap.make({ left: row.claim, right: entry.claim }));
      }
    });
  }
  return A.match(violations, {
    onEmpty: () => AppendResult.cases.Appended.make({ log: [...log, entry] }),
    onNonEmpty: (violations) => ({ _tag: "Refused", log, violations }),
  });
});

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
  let accepted: ReadonlyArray<ClaimLogEntry> = [];
  const violations: Array<ClaimLogViolation> = [];
  A.forEach(log, (entry, at) => {
    const result = appendProjection(accepted, entry);
    AppendResult.match(result, {
      Appended: (result) => {
        accepted = result.log;
      },
      Refused: (result) => {
        violations.push(
          ...A.map(result.violations, (violation) => {
            if (
              ClaimLogViolation.guards.SupersededMissing(violation) &&
              O.exists(HashMap.get(positions, violation.superseded), (position) => position >= at)
            ) {
              return V.PredecessorNotEarlier.make({ claim: violation.claim, superseded: violation.superseded });
            }
            return violation;
          })
        );
      },
    });
  });
  return violations;
};

/**
 * End a claim's knowledge interval only at its explicit superseder's start.
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
    O.map(
      A.findFirst(log, (row) => Eq.equals(row.claim, claim)),
      (row) =>
        ClaimKnowledgeInterval.make({
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
} = dual(
  2,
  (log: ReadonlyArray<ClaimLogEntry>, asOf: DateTime.Utc): ReadonlyArray<ClaimLogEntry> =>
    A.filter(log, (row) =>
      O.exists(
        knowledgeInterval(log, row.claim),
        (interval) => !DateTime.isLessThan(asOf, interval.start) && startsBefore(asOf, interval.end)
      )
    )
);

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
