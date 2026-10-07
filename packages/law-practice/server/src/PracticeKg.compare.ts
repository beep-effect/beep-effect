/**
 * Diff of two bundles' matter tables: what a rebuilt bundle added, removed, or
 * renumbered against the bundle it replaces.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import { HashMap, HashSet, Order } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { PracticeKgMatterTables } from "./PracticeKg.matters.ts";
import type { PracticeKgMatterDocketRow } from "./PracticeKg.matters.ts";

const $I = $LawPracticeServerId.create("PracticeKg.compare");

/**
 * Application and patent numbers one docket gained or lost between two bundles.
 *
 * **Example** (A docket that lost its patent)
 *
 * ```ts
 * import { PracticeKgDocketNumbersChange } from "@beep/law-practice-server"
 *
 * const change = PracticeKgDocketNumbersChange.make({
 *   applicationNumbersAdded: [],
 *   applicationNumbersRemoved: [],
 *   docketKey: "11111.12345US",
 *   familyKey: "11111.12345",
 *   patentNumbersAdded: [],
 *   patentNumbersRemoved: ["10,000,001"],
 * })
 * console.log(change.patentNumbersRemoved.length) // 1
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PracticeKgDocketNumbersChange extends S.Class<PracticeKgDocketNumbersChange>(
  $I`PracticeKgDocketNumbersChange`
)(
  {
    applicationNumbersAdded: S.Array(S.String),
    applicationNumbersRemoved: S.Array(S.String),
    docketKey: S.NonEmptyString,
    familyKey: S.NonEmptyString,
    patentNumbersAdded: S.Array(S.String),
    patentNumbersRemoved: S.Array(S.String),
  },
  $I.annote("PracticeKgDocketNumbersChange", {
    description: "Application and patent numbers a docket present in both bundles gained or lost.",
  })
) {}

/**
 * What a rebuilt bundle's matter tables added, removed, or renumbered against
 * the bundle it replaces.
 *
 * **Details**
 *
 * `lost` is true when the old bundle had something the new one lacks: a
 * matter, a docket, or an application or patent number on a docket both hold.
 * Additions never set it. Every list is sorted by key so two diffs of the same
 * bundles print the same.
 *
 * **Example** (Nothing lost)
 *
 * ```ts
 * import { PracticeKgBundleDiff } from "@beep/law-practice-server"
 *
 * const diff = PracticeKgBundleDiff.make({
 *   docketsAdded: ["11111.34567US"],
 *   docketsRemoved: [],
 *   lost: false,
 *   mattersAdded: ["11111.34567"],
 *   mattersRemoved: [],
 *   numbersChanged: [],
 * })
 * console.log(diff.lost) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PracticeKgBundleDiff extends S.Class<PracticeKgBundleDiff>($I`PracticeKgBundleDiff`)(
  {
    docketsAdded: S.Array(S.NonEmptyString),
    docketsRemoved: S.Array(S.NonEmptyString),
    lost: S.Boolean,
    mattersAdded: S.Array(S.NonEmptyString),
    mattersRemoved: S.Array(S.NonEmptyString),
    numbersChanged: S.Array(PracticeKgDocketNumbersChange),
  },
  $I.annote("PracticeKgBundleDiff", {
    description:
      "Matters, dockets, and per-docket numbers a rebuilt bundle added or removed against the bundle it replaces.",
  })
) {}

/**
 * The two bundles' matter tables to compare: the bundle being replaced and the
 * rebuilt one.
 *
 * **Example** (Compare a bundle with itself)
 *
 * ```ts
 * import { PracticeKgMatterTables, PracticeKgMatterTablesComparison } from "@beep/law-practice-server"
 *
 * const empty = PracticeKgMatterTables.make({ dockets: [], matters: [] })
 * const comparison = PracticeKgMatterTablesComparison.make({ base: empty, next: empty })
 * console.log(comparison.next.matters.length) // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PracticeKgMatterTablesComparison extends S.Class<PracticeKgMatterTablesComparison>(
  $I`PracticeKgMatterTablesComparison`
)(
  {
    base: PracticeKgMatterTables,
    next: PracticeKgMatterTables,
  },
  $I.annote("PracticeKgMatterTablesComparison", {
    description: "Matter tables of the bundle being replaced (base) and of the rebuilt bundle (next).",
  })
) {}

const sortedKeys = A.sort(Order.String);
const byDocketKey = Order.mapInput(Order.String, (change: PracticeKgDocketNumbersChange) => change.docketKey);

const keysNotIn = (keys: ReadonlyArray<string>, known: HashSet.HashSet<string>): ReadonlyArray<string> =>
  sortedKeys(A.filter(keys, (key) => !HashSet.has(known, key)));

const hasChange = (change: PracticeKgDocketNumbersChange): boolean =>
  A.isReadonlyArrayNonEmpty(change.applicationNumbersAdded) ||
  A.isReadonlyArrayNonEmpty(change.applicationNumbersRemoved) ||
  A.isReadonlyArrayNonEmpty(change.patentNumbersAdded) ||
  A.isReadonlyArrayNonEmpty(change.patentNumbersRemoved);

const hasLoss = (change: PracticeKgDocketNumbersChange): boolean =>
  A.isReadonlyArrayNonEmpty(change.applicationNumbersRemoved) || A.isReadonlyArrayNonEmpty(change.patentNumbersRemoved);

const numbersChangeOf = (
  base: PracticeKgMatterDocketRow,
  next: PracticeKgMatterDocketRow
): O.Option<PracticeKgDocketNumbersChange> =>
  O.liftPredicate(
    PracticeKgDocketNumbersChange.make({
      applicationNumbersAdded: keysNotIn(next.applicationNumbers, HashSet.fromIterable(base.applicationNumbers)),
      applicationNumbersRemoved: keysNotIn(base.applicationNumbers, HashSet.fromIterable(next.applicationNumbers)),
      docketKey: next.docketKey,
      familyKey: next.familyKey,
      patentNumbersAdded: keysNotIn(next.patentNumbers, HashSet.fromIterable(base.patentNumbers)),
      patentNumbersRemoved: keysNotIn(base.patentNumbers, HashSet.fromIterable(next.patentNumbers)),
    }),
    hasChange
  );

const familyKeyOf = (row: { readonly familyKey: string }): string => row.familyKey;
const docketKeyOf = (row: { readonly docketKey: string }): string => row.docketKey;

/**
 * Compares the matter tables of a rebuilt bundle with those of the bundle it
 * replaces.
 *
 * **Details**
 *
 * Matters are compared by family key and dockets by docket key. A docket both
 * bundles hold is then compared number by number, so an application or patent
 * that a rebuild withdrew from a docket shows up even when every key is still
 * there. Counts (documents per matter) are not compared: they change with
 * every ingest and say nothing about membership.
 *
 * **Example** (A rebuild that lost a docket)
 *
 * ```ts
 * import {
 *   diffPracticeKgMatterTables,
 *   PracticeKgMatterTables,
 *   PracticeKgMatterTablesComparison,
 * } from "@beep/law-practice-server"
 *
 * const empty = PracticeKgMatterTables.make({ dockets: [], matters: [] })
 * const diff = diffPracticeKgMatterTables(PracticeKgMatterTablesComparison.make({ base: empty, next: empty }))
 * console.log(diff.lost) // false
 * ```
 *
 * @param comparison - The tables of the bundle being replaced (`base`) and of the rebuilt bundle (`next`).
 * @returns What `next` added, removed, or renumbered against `base`.
 * @category use-cases
 * @since 0.0.0
 */
export const diffPracticeKgMatterTables = ({ base, next }: PracticeKgMatterTablesComparison): PracticeKgBundleDiff => {
  const baseMatterKeys = HashSet.fromIterable(A.map(base.matters, familyKeyOf));
  const nextMatterKeys = HashSet.fromIterable(A.map(next.matters, familyKeyOf));
  const baseDockets = HashMap.fromIterable(A.map(base.dockets, (docket) => [docket.docketKey, docket] as const));
  const nextDocketKeys = HashSet.fromIterable(A.map(next.dockets, docketKeyOf));
  const mattersRemoved = keysNotIn(A.map(base.matters, familyKeyOf), nextMatterKeys);
  const docketsRemoved = keysNotIn(A.map(base.dockets, docketKeyOf), nextDocketKeys);
  const numbersChanged = A.sort(
    A.getSomes(
      A.map(next.dockets, (docket) =>
        O.flatMap(HashMap.get(baseDockets, docket.docketKey), (before) => numbersChangeOf(before, docket))
      )
    ),
    byDocketKey
  );
  return PracticeKgBundleDiff.make({
    docketsAdded: keysNotIn(A.map(next.dockets, docketKeyOf), HashSet.fromIterable(A.map(base.dockets, docketKeyOf))),
    docketsRemoved,
    lost:
      A.isReadonlyArrayNonEmpty(mattersRemoved) ||
      A.isReadonlyArrayNonEmpty(docketsRemoved) ||
      A.some(numbersChanged, hasLoss),
    mattersAdded: keysNotIn(A.map(next.matters, familyKeyOf), baseMatterKeys),
    mattersRemoved,
    numbersChanged,
  });
};
