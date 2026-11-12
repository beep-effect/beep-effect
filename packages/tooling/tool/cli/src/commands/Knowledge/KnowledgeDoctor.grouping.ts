/**
 * Causal grouping for the knowledge doctor: delegated goals-doctor findings as causal roots, cause
 * groups keyed by the missing target's identity, and root attribution to the commit that removed the
 * target.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Str } from "@beep/utils";
import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import { KnowledgeCommitSha } from "./Knowledge.refs.ts";
import { KnowledgeFindingCandidate, KnowledgeFindingLocation, KnowledgeFindingSeverity } from "./Knowledge.schemas.ts";
import { knowledgeDoctorDocumentId, knowledgeGoalsDoctorCauseKey } from "./KnowledgeDoctor.evaluators.ts";
import {
  KnowledgeCauseGroup,
  KnowledgeFindingOrigin,
  KnowledgePathChange,
  KnowledgePathRemoval,
  KnowledgeRemovalCommit,
  KnowledgeRootAttribution,
} from "./KnowledgeDoctor.schemas.ts";
import type { CommitLogEntry, NameStatusEntry } from "@beep/git/Git";
import type { GoalDoctorFinding } from "../Goals/Doctor.ts";
import type { KnowledgeFindingId } from "./Knowledge.schemas.ts";
import type { KnowledgeDoctorFinding, KnowledgePathRemovalQuery } from "./KnowledgeDoctor.schemas.ts";

const $I = $RepoCliId.create("commands/Knowledge/KnowledgeDoctor.grouping");

const isCommitSha = S.is(KnowledgeCommitSha);

/* -------------------------------------------------------------------------------------------------
 * Delegated goals-doctor findings
 * ---------------------------------------------------------------------------------------------- */

const goalsDoctorDetail = (finding: GoalDoctorFinding): string =>
  pipe(Str.slice(Str.length(`${finding.slug} ${finding.kind}`))(finding.key), Str.trimStart);

/**
 * One goals-doctor finding as the knowledge doctor lists it: a delegated candidate, its severity, and
 * its cause key.
 *
 * **Example** (Read a delegated row's severity)
 *
 * ```ts
 * import { KnowledgeFindingCandidate, KnowledgeFindingLocation } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 * import { KnowledgeDelegatedRow } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.grouping"
 *
 * const row = KnowledgeDelegatedRow.make({
 *   candidate: KnowledgeFindingCandidate.make({
 *     kind: "delegated-goals-doctor-finding",
 *     documentId: "tree:goals/demo",
 *     subject: "goals-doctor:manifest-missing:demo",
 *     location: KnowledgeFindingLocation.make({ path: "goals/demo" }),
 *     message: "goals doctor [manifest-missing]: ops/manifest.json is missing.",
 *     remediation: "Resolve it as the goals doctor reports.",
 *   }),
 *   causeKey: "goals-doctor:manifest-missing:demo",
 *   severity: "blocking",
 * })
 *
 * console.log(row.severity) // "blocking"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeDelegatedRow extends S.Opaque<KnowledgeDelegatedRow, { readonly brand: unique symbol }>()(
  S.Struct({
    candidate: KnowledgeFindingCandidate,
    causeKey: S.String,
    severity: KnowledgeFindingSeverity,
  }).pipe(
    $I.annoteSchema("KnowledgeDelegatedRow", {
      description:
        "A goals-doctor finding listed as a delegated knowledge-doctor candidate with its severity and cause key.",
    })
  )
) {}

/**
 * Lists one goals-doctor finding as a delegated knowledge-doctor row.
 *
 * **Details**
 *
 * The row is a `delegated-goals-doctor-finding` located at the packet directory, with the goals
 * doctor's severity and message. Its subject is its cause key, so it is a causal root and its
 * identity is stable across runs. The goals doctor keeps the gate: the knowledge doctor never
 * baselines it.
 *
 * **Example** (List an invalid manifest)
 *
 * ```ts
 * import { GoalDoctorFinding } from "@beep/repo-cli/commands/Goals/Doctor"
 * import { knowledgeDelegatedRow } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.grouping"
 *
 * const row = knowledgeDelegatedRow(
 *   GoalDoctorFinding.make({
 *     slug: "demo",
 *     kind: "manifest-invalid",
 *     severity: "blocking",
 *     key: "demo manifest-invalid",
 *     message: "ops/manifest.json does not parse as JSON.",
 *   })
 * )
 *
 * console.log(row.causeKey) // "goals-doctor:manifest-invalid:demo"
 * ```
 *
 * @param finding - Goals-doctor finding read from the scanned tree.
 * @returns The delegated candidate with its severity and cause key.
 * @category constructors
 * @since 0.0.0
 */
export const knowledgeDelegatedRow = (finding: GoalDoctorFinding): KnowledgeDelegatedRow => {
  const causeKey = knowledgeGoalsDoctorCauseKey({
    kind: finding.kind,
    slug: finding.slug,
    detail: goalsDoctorDetail(finding),
  });
  const packetPath = `goals/${finding.slug}`;
  return KnowledgeDelegatedRow.make({
    candidate: KnowledgeFindingCandidate.make({
      kind: "delegated-goals-doctor-finding",
      documentId: knowledgeDoctorDocumentId(packetPath),
      subject: causeKey,
      location: KnowledgeFindingLocation.make({ path: packetPath }),
      message: `goals doctor [${finding.kind}]: ${finding.message}`,
      remediation: "Resolve it as bun run beep goals doctor reports; the goals doctor owns this finding.",
    }),
    causeKey,
    severity: finding.severity,
  });
};

/* -------------------------------------------------------------------------------------------------
 * Path removals
 * ---------------------------------------------------------------------------------------------- */

/**
 * The `Git.log` options whose listing {@link knowledgePathRemovalsFromLog} reads, newest commit first.
 *
 * **Details**
 *
 * The walk starts at a tree commit (the caller adds `revisions`), keeps only deletions and renames
 * (`--diff-filter=DR`), detects renames at git's default 50 % similarity (`-M`), and reads paths raw.
 *
 * **Example** (Read the diff filter)
 *
 * ```ts
 * import { KNOWLEDGE_PATH_REMOVAL_LOG } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.grouping"
 *
 * console.log(KNOWLEDGE_PATH_REMOVAL_LOG.diffFilter) // "DR"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const KNOWLEDGE_PATH_REMOVAL_LOG = {
  nameStatus: true,
  diffFilter: "DR",
  findRenames: 50,
  quotePath: false,
} as const;

// A deletion removes its path; a rename removes its source and names its target.
const removalOfChange = (commit: KnowledgeCommitSha, subject: string, change: NameStatusEntry) =>
  Match.value(change.status).pipe(
    Match.when("deleted", () =>
      O.some(
        KnowledgePathRemoval.make({
          path: change.path,
          commit,
          subject,
          change: KnowledgePathChange.Enum.deleted,
          renamedTo: O.none(),
        })
      )
    ),
    Match.when("renamed", () =>
      O.map(O.fromUndefinedOr(change.oldPath), (path) =>
        KnowledgePathRemoval.make({
          path,
          commit,
          subject,
          change: KnowledgePathChange.Enum.renamed,
          renamedTo: O.some(change.path),
        })
      )
    ),
    Match.orElse(O.none<KnowledgePathRemoval>)
  );

const commitRemovals = (entry: CommitLogEntry): ReadonlyArray<KnowledgePathRemoval> =>
  isCommitSha(entry.sha)
    ? A.getSomes(A.map(entry.changes ?? [], (change) => removalOfChange(entry.sha, entry.subject, change)))
    : A.empty();

/**
 * Maps a `Git.log` listing read with {@link KNOWLEDGE_PATH_REMOVAL_LOG} onto path removals.
 *
 * **Details**
 *
 * Every deleted or renamed-away path becomes one removal, in log order (newest commit first): a
 * deletion names its path, a rename its source with the target as `renamedTo`. Commits whose id is
 * not a full commit id are skipped.
 *
 * **Example** (Map one deletion)
 *
 * ```ts
 * import { CommitLogEntry, NameStatusEntry } from "@beep/git/Git"
 * import { knowledgePathRemovalsFromLog } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.grouping"
 * import * as DateTime from "effect/DateTime"
 *
 * const at = DateTime.makeUnsafe("2026-11-03T00:00:00Z")
 * const removals = knowledgePathRemovalsFromLog([
 *   CommitLogEntry.make({
 *     sha: "1111111111111111111111111111111111111111",
 *     authoredAt: at,
 *     committedAt: at,
 *     authorName: "a",
 *     authorEmail: "a@example.invalid",
 *     subject: "chore: drop",
 *     paths: ["docs/old.md"],
 *     changes: [NameStatusEntry.make({ status: "deleted", path: "docs/old.md" })],
 *   }),
 * ])
 *
 * console.log(removals[0]?.path) // "docs/old.md"
 * ```
 *
 * @param entries - The log listing, newest commit first.
 * @returns The removals, newest first.
 * @category parsing
 * @since 0.0.0
 */
export const knowledgePathRemovalsFromLog: (
  entries: ReadonlyArray<CommitLogEntry>
) => ReadonlyArray<KnowledgePathRemoval> = A.flatMap(commitRemovals);

// A removed path and every directory above it: the keys the removal index files it under.
const pathPrefixes = (path: string): ReadonlyArray<string> =>
  A.drop(
    A.scan(Str.split("/")(path), "", (prefix, segment) => (Str.isEmpty(prefix) ? segment : `${prefix}/${segment}`)),
    1
  );

// Each removed path and every directory above it, mapped to its newest removal.
const removalIndex = (removals: ReadonlyArray<KnowledgePathRemoval>): HashMap.HashMap<string, KnowledgePathRemoval> => {
  const index = MutableHashMap.empty<string, KnowledgePathRemoval>();
  for (const removal of removals) {
    for (const key of pathPrefixes(removal.path)) {
      if (!MutableHashMap.has(index, key)) {
        MutableHashMap.set(index, key, removal);
      }
    }
  }
  return HashMap.fromIterable(index);
};

/**
 * The `Git.log` options of the tree-only removal walk {@link knowledgeRemovalCommitsFromLog} reads.
 *
 * **Details**
 *
 * Deletions only (`--diff-filter=D`) with rename detection off (`--no-renames`), so a rename lists its
 * source as a deletion and git compares trees without reading one blob: in a blobless partial clone
 * the walk fetches nothing. Per commit it lists the same removed paths as
 * {@link KNOWLEDGE_PATH_REMOVAL_LOG}, which only adds the rename pairing.
 *
 * **Example** (Read the diff filter)
 *
 * ```ts
 * import { KNOWLEDGE_REMOVAL_WALK_LOG } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.grouping"
 *
 * console.log(KNOWLEDGE_REMOVAL_WALK_LOG.diffFilter) // "D"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const KNOWLEDGE_REMOVAL_WALK_LOG = {
  diffFilter: "D",
  noRenames: true,
  quotePath: false,
} as const;

/**
 * Maps a `Git.log` listing read with {@link KNOWLEDGE_REMOVAL_WALK_LOG} onto removal commits.
 *
 * **Details**
 *
 * One commit per log entry, in log order (newest first), with the paths it deleted. Commits whose id
 * is not a full commit id are skipped, as {@link knowledgePathRemovalsFromLog} skips them.
 *
 * **Example** (Map one deletion)
 *
 * ```ts
 * import { CommitLogEntry } from "@beep/git/Git"
 * import { knowledgeRemovalCommitsFromLog } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.grouping"
 * import * as DateTime from "effect/DateTime"
 *
 * const at = DateTime.makeUnsafe("2026-11-03T00:00:00Z")
 * const commits = knowledgeRemovalCommitsFromLog([
 *   CommitLogEntry.make({
 *     sha: "1111111111111111111111111111111111111111",
 *     authoredAt: at,
 *     committedAt: at,
 *     authorName: "a",
 *     authorEmail: "a@example.invalid",
 *     subject: "chore: drop",
 *     paths: ["docs/old.md"],
 *   }),
 * ])
 *
 * console.log(commits[0]?.paths) // ["docs/old.md"]
 * ```
 *
 * @param entries - The tree-only walk, newest commit first.
 * @returns Each commit's id and removed paths, newest first.
 * @category parsing
 * @since 0.0.0
 */
export const knowledgeRemovalCommitsFromLog = (
  entries: ReadonlyArray<CommitLogEntry>
): ReadonlyArray<KnowledgeRemovalCommit> =>
  A.flatMap(entries, (entry) =>
    isCommitSha(entry.sha) ? [KnowledgeRemovalCommit.make({ commit: entry.sha, paths: entry.paths })] : A.empty()
  );

// Claims every still-unclaimed target a commit removes, itself or a path under it; true when any.
const claimTargets = (paths: ReadonlyArray<string>, remaining: MutableHashSet.MutableHashSet<string>): boolean => {
  const claimed = A.filter(A.flatMap(paths, pathPrefixes), (key) => MutableHashSet.has(remaining, key));
  for (const key of claimed) {
    MutableHashSet.remove(remaining, key);
  }
  return A.isReadonlyArrayNonEmpty(claimed);
};

const selectRemovalCommits = (
  history: ReadonlyArray<KnowledgeRemovalCommit>,
  query: KnowledgePathRemovalQuery
): ReadonlyArray<KnowledgeCommitSha> => {
  const remaining = MutableHashSet.fromIterable(query.targets);
  const selected = A.empty<KnowledgeCommitSha>();
  for (const entry of history) {
    if (MutableHashSet.size(remaining) === 0) {
      break;
    }
    if (claimTargets(entry.paths, remaining)) {
      selected.push(entry.commit);
    }
  }
  return selected;
};

/**
 * The commits whose rename-detecting removals a query reads, in walk order.
 *
 * **Details**
 *
 * For each target, the newest commit that removed the target itself or a path under it. The cause
 * grouping files each
 * removed path and every directory above it under its first removal in walk order, so the commit that
 * removal belongs to is exactly the newest commit removing a matching path: reading only the selected
 * commits gives every target the same attribution as reading the whole history. A commit removes the
 * same paths whether or not renames are detected, so the tree-only walk is enough to select it.
 *
 * **Example** (The newest removal of a directory's file)
 *
 * ```ts
 * import {
 *   KnowledgePathRemovalQuery,
 *   KnowledgeRemovalCommit,
 * } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 * import { selectKnowledgeRemovalCommits } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.grouping"
 * import * as HashSet from "effect/HashSet"
 *
 * const newer = "2222222222222222222222222222222222222222"
 * const older = "1111111111111111111111111111111111111111"
 * const selected = selectKnowledgeRemovalCommits(
 *   [
 *     KnowledgeRemovalCommit.make({ commit: newer, paths: ["docs/guide/a.md"] }),
 *     KnowledgeRemovalCommit.make({ commit: older, paths: ["docs/guide/b.md"] }),
 *   ],
 *   KnowledgePathRemovalQuery.make({ targets: HashSet.make("docs/guide") })
 * )
 *
 * console.log(selected) // ["2222222222222222222222222222222222222222"]
 * ```
 *
 * @param history - The tree-only walk, newest commit first.
 * @param query - The targets to resolve.
 * @returns The selected commit ids, newest first.
 * @category queries
 * @since 0.0.0
 */
export const selectKnowledgeRemovalCommits: {
  (
    query: KnowledgePathRemovalQuery
  ): (history: ReadonlyArray<KnowledgeRemovalCommit>) => ReadonlyArray<KnowledgeCommitSha>;
  (history: ReadonlyArray<KnowledgeRemovalCommit>, query: KnowledgePathRemovalQuery): ReadonlyArray<KnowledgeCommitSha>;
} = dual(2, selectRemovalCommits);

/* -------------------------------------------------------------------------------------------------
 * Cause targets and attribution
 * ---------------------------------------------------------------------------------------------- */

const CAUSE_TARGETS: ReadonlyArray<readonly [string, (rest: string) => string]> = [
  ["path:", (rest) => rest],
  ["goals-doctor:manifest-missing:", (rest) => `goals/${rest}/ops/manifest.json`],
];

/**
 * The repository path a cause key names as its missing target, when it names one.
 *
 * **Details**
 *
 * Path causes (`path:<path>`, which a missing packet's claims share with plain references to the
 * packet directory) and missing manifests (`goals-doctor:manifest-missing:<slug>`) name a path; commands, options, symbols, claims against an
 * existing manifest, and historical citations do not, so they stay unattributed.
 *
 * **Example** (Read the target of a missing packet)
 *
 * ```ts
 * import { knowledgeCauseTargetPath } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.grouping"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrNull(knowledgeCauseTargetPath("goals-doctor:manifest-missing:demo"))) // "goals/demo/ops/manifest.json"
 * ```
 *
 * @param causeKey - Cause key of a finding.
 * @returns The target path, or none when the cause is not a path.
 * @category queries
 * @since 0.0.0
 */
export const knowledgeCauseTargetPath = (causeKey: string): O.Option<string> =>
  O.map(
    A.findFirst(CAUSE_TARGETS, ([prefix]) => Str.startsWith(prefix)(causeKey)),
    ([prefix, toPath]) => toPath(Str.slice(Str.length(prefix))(causeKey))
  );

/**
 * Every path {@link groupKnowledgeDoctorFindings} looks up in the removal index for these findings.
 *
 * **Details**
 *
 * The target of each finding's cause key, when it names one. A removal query built from them resolves
 * exactly the history the grouping of the same findings reads.
 *
 * **Example** (No findings, no targets)
 *
 * ```ts
 * import { knowledgeRemovalTargets } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.grouping"
 * import * as HashSet from "effect/HashSet"
 *
 * console.log(HashSet.size(knowledgeRemovalTargets([]))) // 0
 * ```
 *
 * @param findings - The findings one grouping will collapse.
 * @returns The distinct target paths of their cause keys.
 * @category queries
 * @since 0.0.0
 */
export const knowledgeRemovalTargets = (findings: ReadonlyArray<KnowledgeDoctorFinding>): HashSet.HashSet<string> =>
  HashSet.fromIterable(A.getSomes(A.map(findings, (finding) => knowledgeCauseTargetPath(finding.causeKey))));

// A rename of the target itself proposes its new path; a rename of a file under a directory target
// proposes the directory the file moved into, when the file kept its relative place.
const repairTarget = (target: string, removal: KnowledgePathRemoval): O.Option<string> =>
  O.flatMap(removal.renamedTo, (renamedTo) => {
    const suffix = Str.slice(Str.length(target))(removal.path);
    return Str.endsWith(suffix)(renamedTo)
      ? O.some(Str.slice(0, Str.length(renamedTo) - Str.length(suffix))(renamedTo))
      : O.none();
  });

const attributionOf = (target: string, removal: KnowledgePathRemoval): KnowledgeRootAttribution =>
  KnowledgeRootAttribution.make({
    commit: removal.commit,
    subject: removal.subject,
    change: removal.change,
    removedPath: removal.path,
    repairTarget: repairTarget(target, removal),
  });

/* -------------------------------------------------------------------------------------------------
 * Grouping
 * ---------------------------------------------------------------------------------------------- */

const dependentsByCause = (
  findings: ReadonlyArray<KnowledgeDoctorFinding>
): MutableHashMap.MutableHashMap<string, Array<KnowledgeFindingId>> => {
  const byCause = MutableHashMap.empty<string, Array<KnowledgeFindingId>>();
  for (const row of A.filter(findings, (finding) => KnowledgeFindingOrigin.is.owned(finding.origin))) {
    O.match(MutableHashMap.get(byCause, row.causeKey), {
      onNone: () => MutableHashMap.set(byCause, row.causeKey, [row.finding.findingId]),
      onSome: (ids) => ids.push(row.finding.findingId),
    });
  }
  return byCause;
};

const delegatedRoots = (findings: ReadonlyArray<KnowledgeDoctorFinding>): HashMap.HashMap<string, KnowledgeFindingId> =>
  A.reduce(
    A.sort(
      A.filter(findings, (finding) => KnowledgeFindingOrigin.is.delegated(finding.origin)),
      Order.mapInput(Order.String, (finding: KnowledgeDoctorFinding) => finding.finding.findingId)
    ),
    HashMap.empty<string, KnowledgeFindingId>(),
    (roots, finding) =>
      HashMap.has(roots, finding.causeKey) ? roots : HashMap.set(roots, finding.causeKey, finding.finding.findingId)
  );

/**
 * Collapses findings into cause groups, one per distinct cause key.
 *
 * **Details**
 *
 * A group whose cause key a delegated finding carries is rooted at that finding (`rootOrigin`
 * `delegated`), and its dependents are the owned findings it explains. Every other group's root is
 * the missing target itself, and its dependents are every finding naming it. A root whose cause key
 * names a path is attributed to the newest commit that deleted or renamed away that path, or a file
 * under it, when `removals` is available. Groups are sorted by cause key and dependents by id, so the
 * result does not depend on the order findings were discovered in.
 *
 * **Example** (Group nothing)
 *
 * ```ts
 * import { groupKnowledgeDoctorFindings } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.grouping"
 * import * as O from "effect/Option"
 *
 * console.log(groupKnowledgeDoctorFindings([], O.some([])).length) // 0
 * ```
 *
 * @param findings - Every finding of one report, owned and delegated.
 * @param removals - The tree's path removals, newest first; none when history is unavailable.
 * @returns The cause groups, sorted by cause key.
 * @category use-cases
 * @since 0.0.0
 */
export const groupKnowledgeDoctorFindings: {
  (
    removals: O.Option<ReadonlyArray<KnowledgePathRemoval>>
  ): (findings: ReadonlyArray<KnowledgeDoctorFinding>) => ReadonlyArray<KnowledgeCauseGroup>;
  (
    findings: ReadonlyArray<KnowledgeDoctorFinding>,
    removals: O.Option<ReadonlyArray<KnowledgePathRemoval>>
  ): ReadonlyArray<KnowledgeCauseGroup>;
} = dual(
  2,
  (
    findings: ReadonlyArray<KnowledgeDoctorFinding>,
    removals: O.Option<ReadonlyArray<KnowledgePathRemoval>>
  ): ReadonlyArray<KnowledgeCauseGroup> => {
    const index = O.map(removals, removalIndex);
    const dependents = dependentsByCause(findings);
    const roots = delegatedRoots(findings);
    const causeKeys = A.sort(
      A.fromIterable(HashSet.fromIterable(A.map(findings, (finding) => finding.causeKey))),
      Order.String
    );
    return A.map(causeKeys, (causeKey) => {
      const root = HashMap.get(roots, causeKey);
      return KnowledgeCauseGroup.make({
        causeKey,
        rootOrigin: O.isSome(root) ? KnowledgeFindingOrigin.Enum.delegated : KnowledgeFindingOrigin.Enum.owned,
        root,
        dependents: A.sort(O.getOrElse(MutableHashMap.get(dependents, causeKey), A.empty), Order.String),
        attribution: O.flatMap(knowledgeCauseTargetPath(causeKey), (target) =>
          O.map(
            O.flatMap(index, (byPath) => HashMap.get(byPath, target)),
            (removal) => attributionOf(target, removal)
          )
        ),
      });
    });
  }
);
