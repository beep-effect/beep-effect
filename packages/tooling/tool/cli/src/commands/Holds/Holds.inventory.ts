/**
 * Hold inventory rules: which ledger rows are live, the syncpack held list the
 * ledger implies, and how the ledger and the checkout's config disagree.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import { dual, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Str from "effect/String";
import { HoldAnchor, HoldLintFinding } from "./Holds.schemas.ts";
import type { HoldClaimVersion, HoldSiteSnapshot } from "./Holds.schemas.ts";

/**
 * Stable text key of an anchor, used to compare ledger anchors with config sites.
 *
 * **Example** (Key a root override)
 *
 * ```ts
 * import { anchorKey, HoldAnchor } from "@beep/repo-cli/commands/Holds"
 *
 * console.log(anchorKey(HoldAnchor.cases.RootOverride.make({ packageName: "glob" }))) // "override:glob"
 * ```
 *
 * @param anchor - The anchor to key.
 * @returns The anchor's stable key.
 * @category utilities
 * @since 0.0.0
 */
export const anchorKey = (anchor: HoldAnchor): string =>
  HoldAnchor.match(anchor, {
    CatalogEntry: ({ packageName }) => `catalog:${packageName}`,
    ManifestDependency: ({ manifest, packageName }) => `manifest:${manifest}#${packageName}`,
    SyncpackHeld: ({ dependency }) => `syncpack-held:${dependency}`,
    SyncpackVersionGroup: ({ label }) => `version-group:${label}`,
    RootOverride: ({ packageName }) => `override:${packageName}`,
    PatchedDependency: ({ key }) => `patch:${key}`,
    OsvPackageOverride: ({ packageName }) => `osv:${packageName}`,
  });

const byHoldId = Order.mapInput(Order.String, (version: HoldClaimVersion) => version.proposition.holdId);

/**
 * The live hold versions in a ledger: not superseded, not retracted and not expired.
 *
 * **Details**
 *
 * The ledger is append-only, so a renewal or a tombstone never edits the row it
 * replaces. A row is superseded when a later row names it in `supersedes`.
 *
 * **Example** (An empty ledger)
 *
 * ```ts
 * import { liveHoldVersions } from "@beep/repo-cli/commands/Holds"
 *
 * console.log(liveHoldVersions([]).length) // 0
 * ```
 *
 * @param rows - Every claim version in the ledger, in file order.
 * @returns The live versions, ordered by hold id.
 * @category policies
 * @since 0.0.0
 */
export const liveHoldVersions = (rows: ReadonlyArray<HoldClaimVersion>): ReadonlyArray<HoldClaimVersion> => {
  const superseded = HashSet.fromIterable(A.getSomes(A.map(rows, (row) => row.supersedes)));
  return pipe(
    rows,
    A.filter(
      (row) => !HashSet.has(superseded, row.id) && row.review._tag !== "Retracted" && O.isNone(row.knowledge.expiredAt)
    ),
    A.sort(byHoldId)
  );
};

/**
 * The syncpack held list implied by live hold versions, sorted and deduplicated.
 *
 * **Example** (No holds)
 *
 * ```ts
 * import { heldListFor } from "@beep/repo-cli/commands/Holds"
 *
 * console.log(heldListFor([])) // []
 * ```
 *
 * @param live - Live hold versions.
 * @returns The dependency patterns syncpack must not update.
 * @category policies
 * @since 0.0.0
 */
export const heldListFor = (live: ReadonlyArray<HoldClaimVersion>): ReadonlyArray<string> =>
  pipe(
    liveAnchorValues((anchor) => (anchor._tag === "SyncpackHeld" ? O.some(anchor.dependency) : O.none()))(live),
    A.dedupe,
    A.sort(Order.String)
  );

/**
 * Collect one value from every anchor of the given hold versions that `pick` selects.
 *
 * **Example** (Every manifest a hold names)
 *
 * ```ts
 * import { liveAnchorValues } from "@beep/repo-cli/commands/Holds"
 * import * as O from "effect/Option"
 *
 * const manifests = liveAnchorValues((anchor) =>
 *   anchor._tag === "ManifestDependency" ? O.some(anchor.manifest) : O.none()
 * )
 * console.log(manifests([])) // []
 * ```
 *
 * @param pick - Selects a value from an anchor, or `None` to skip it.
 * @returns A function from hold versions to the selected values, in anchor order.
 * @category utilities
 * @since 0.0.0
 */
export const liveAnchorValues =
  <B>(pick: (anchor: HoldAnchor) => O.Option<B>) =>
  (live: ReadonlyArray<HoldClaimVersion>): Array<B> =>
    pipe(
      live,
      A.flatMap((version) => version.proposition.subject.anchors),
      A.map(pick),
      A.getSomes
    );

/**
 * Compare live hold versions with the hold-shaped sites in a checkout.
 *
 * **Details**
 *
 * A required site with no live anchor is `Unrecorded`. A live anchor whose site
 * is gone is `Orphaned`; `SyncpackHeld` anchors are exempt because the held
 * list is generated from them. A held list on disk that differs from
 * {@link heldListFor} is `HeldListStale`.
 *
 * **Example** (A clean empty checkout)
 *
 * ```ts
 * import { HoldSiteSnapshot, lintHolds } from "@beep/repo-cli/commands/Holds"
 *
 * const findings = lintHolds(HoldSiteSnapshot.make({ required: [], present: [], heldList: [] }), [])
 * console.log(findings.length) // 0
 * ```
 *
 * @param snapshot - The checkout's hold-shaped sites.
 * @param live - Live hold versions.
 * @returns Every disagreement, unrecorded sites first.
 * @category policies
 * @since 0.0.0
 */
export const lintHolds: {
  (live: ReadonlyArray<HoldClaimVersion>): (snapshot: HoldSiteSnapshot) => ReadonlyArray<HoldLintFinding>;
  (snapshot: HoldSiteSnapshot, live: ReadonlyArray<HoldClaimVersion>): ReadonlyArray<HoldLintFinding>;
} = dual(2, (snapshot: HoldSiteSnapshot, live: ReadonlyArray<HoldClaimVersion>): ReadonlyArray<HoldLintFinding> => {
  const anchored = pipe(
    live,
    A.flatMap((version) => A.map(version.proposition.subject.anchors, (anchor) => [version, anchor] as const))
  );
  const recordedKeys = HashSet.fromIterable(A.map(anchored, ([, anchor]) => anchorKey(anchor)));
  const presentKeys = HashSet.fromIterable(A.map(snapshot.present, anchorKey));
  const unrecorded = pipe(
    snapshot.required,
    A.filter((anchor) => !HashSet.has(recordedKeys, anchorKey(anchor))),
    A.map((anchor) => HoldLintFinding.cases.Unrecorded.make({ anchor }))
  );
  const orphaned = pipe(
    anchored,
    A.filter(([, anchor]) => anchor._tag !== "SyncpackHeld" && !HashSet.has(presentKeys, anchorKey(anchor))),
    A.map(([version, anchor]) => HoldLintFinding.cases.Orphaned.make({ holdId: version.proposition.holdId, anchor }))
  );
  const expected = heldListFor(live);
  const stale = A.makeEquivalence(Str.Equivalence)(expected, snapshot.heldList)
    ? []
    : [HoldLintFinding.cases.HeldListStale.make({ expected, actual: snapshot.heldList })];
  return [...unrecorded, ...orphaned, ...stale];
});

/**
 * Render one lint finding as a report line.
 *
 * **Example** (An orphaned record)
 *
 * ```ts
 * import { HoldAnchor, HoldId, HoldLintFinding, holdLintFindingText } from "@beep/repo-cli/commands/Holds"
 * import * as S from "effect/Schema"
 *
 * const finding = HoldLintFinding.cases.Orphaned.make({
 *   holdId: S.decodeSync(HoldId)("glob-unify"),
 *   anchor: HoldAnchor.cases.RootOverride.make({ packageName: "glob" }),
 * })
 * console.log(holdLintFindingText(finding)) // "orphaned: glob-unify anchors override:glob, which is gone"
 * ```
 *
 * @param finding - The finding to render.
 * @returns One line of text.
 * @category utilities
 * @since 0.0.0
 */
export const holdLintFindingText = (finding: HoldLintFinding): string =>
  HoldLintFinding.match(finding, {
    Unrecorded: ({ anchor }) => `unrecorded: ${anchorKey(anchor)} has no live hold record`,
    Orphaned: ({ holdId, anchor }) => `orphaned: ${holdId} anchors ${anchorKey(anchor)}, which is gone`,
    HeldListStale: ({ expected }) =>
      `stale: hold-ledger/syncpack-held.generated.json differs from the ledger (expected ${A.join(expected, ", ")})`,
  });

/**
 * Whether a hold's probe is due: two-thirds of its lease has elapsed.
 *
 * **Details**
 *
 * A hold with an unknown or open-ended lease is always due, since nothing else
 * would ever re-check it. `deps:update` runs due probes before it bumps the
 * catalog; jitter for fleet-wide wakes belongs to the wake service.
 *
 * **Example** (A hold with no runs yet)
 *
 * ```ts
 * import { isProbeDue } from "@beep/repo-cli/commands/Holds"
 *
 * console.log(typeof isProbeDue) // "function"
 * ```
 *
 * @param version - The live hold version.
 * @param now - The current time.
 * @returns `true` once the probe should run again.
 * @category policies
 * @since 0.0.0
 */
export const isProbeDue: {
  (now: DateTime.Utc): (version: HoldClaimVersion) => boolean;
  (version: HoldClaimVersion, now: DateTime.Utc): boolean;
} = dual(2, (version: HoldClaimVersion, now: DateTime.Utc): boolean => {
  const lease = version.validTime;
  return lease._tag === "Interval"
    ? O.match(lease.validTo, {
        onNone: () => true,
        onSome: (validTo) => {
          const from = DateTime.toEpochMillis(lease.validFrom);
          return DateTime.toEpochMillis(now) >= from + ((DateTime.toEpochMillis(validTo) - from) * 2) / 3;
        },
      })
    : true;
});

/**
 * Whether a flipped hold can be retired by `deps:update` alone.
 *
 * **Details**
 *
 * Only an `Unpin` exit whose anchors are all catalog entries or held-list
 * patterns, with at least one catalog entry, probed against npm `latest`, qualifies: tombstoning the record
 * drops the pattern from the held list, and `syncpack update --target=latest`
 * installs the version the probe tested. A direct workspace-manifest pin is
 * not moved by the catalog bump, and an override, patch, OSV exception or
 * version group is a file edit, so those holds need a reviewed change.
 *
 * **Example** (Check a hold record)
 *
 * ```ts
 * import { isUnpinnedByCatalogBump } from "@beep/repo-cli/commands/Holds"
 *
 * console.log(typeof isUnpinnedByCatalogBump) // "function"
 * ```
 *
 * @param version - The flipped hold version.
 * @returns `true` when the catalog bump alone ends the hold.
 * @category policies
 * @since 0.0.0
 */
export const isUnpinnedByCatalogBump = (version: HoldClaimVersion): boolean =>
  version.proposition.exitAction._tag === "Unpin" &&
  version.proposition.falsifier._tag === "Scripted" &&
  version.proposition.falsifier.candidate === "latest" &&
  // The catalog bump only moves packages that resolve through the catalog.
  A.some(version.proposition.subject.anchors, (anchor) => anchor._tag === "CatalogEntry") &&
  A.every(
    version.proposition.subject.anchors,
    (anchor) => anchor._tag === "CatalogEntry" || anchor._tag === "SyncpackHeld"
  );

/**
 * Whether a hold governs a package, directly or through a `scope/**` group pattern.
 *
 * **Example** (A lockstep family pattern)
 *
 * ```ts
 * import { holdPackageMatches } from "@beep/repo-cli/commands/Holds"
 *
 * console.log(holdPackageMatches("@lexical/**", "@lexical/react")) // true
 * console.log(holdPackageMatches("@lexical/**", "lexical")) // false
 * ```
 *
 * @param pattern - A package name or `scope/**` pattern from a hold subject.
 * @param packageName - The package to look up.
 * @returns `true` when the pattern covers the package.
 * @category policies
 * @since 0.0.0
 */
export const holdPackageMatches: {
  (packageName: string): (pattern: string) => boolean;
  (pattern: string, packageName: string): boolean;
} = dual(
  2,
  (pattern: string, packageName: string): boolean =>
    pattern === packageName || (Str.endsWith("/**")(pattern) && Str.startsWith(Str.slice(0, -2)(pattern))(packageName))
);
