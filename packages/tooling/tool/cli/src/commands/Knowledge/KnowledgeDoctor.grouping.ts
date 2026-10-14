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
import * as MutableHashMap from "effect/MutableHashMap";
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
  KnowledgeRootAttribution,
} from "./KnowledgeDoctor.schemas.ts";
import type { GoalDoctorFinding } from "../Goals/Doctor.ts";
import type { KnowledgeFindingId } from "./Knowledge.schemas.ts";
import type { KnowledgeDoctorFinding } from "./KnowledgeDoctor.schemas.ts";

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
export class KnowledgeDelegatedRow extends S.Class<KnowledgeDelegatedRow>($I`KnowledgeDelegatedRow`)(
  {
    candidate: KnowledgeFindingCandidate,
    causeKey: S.String,
    severity: KnowledgeFindingSeverity,
  },
  $I.annote("KnowledgeDelegatedRow", {
    description:
      "A goals-doctor finding listed as a delegated knowledge-doctor candidate with its severity and cause key.",
  })
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
 * The `git log` arguments whose output {@link parseKnowledgePathRemovals} reads, newest commit first.
 *
 * **Example** (Read the diff filter)
 *
 * ```ts
 * import { KNOWLEDGE_PATH_REMOVAL_LOG_ARGS } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.grouping"
 *
 * console.log(KNOWLEDGE_PATH_REMOVAL_LOG_ARGS.includes("--diff-filter=DR")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const KNOWLEDGE_PATH_REMOVAL_LOG_ARGS: ReadonlyArray<string> = [
  "-c",
  "core.quotePath=false",
  "log",
  "--diff-filter=DR",
  "-M",
  "--name-status",
  "--format=%x1e%H%x1f%s",
];

const RECORD_SEPARATOR = "\u001e";
const UNIT_SEPARATOR = "\u001f";

// `git log --name-status` letters for a rename (`R<score>`) and a deletion.
const STATUS_CHANGES: ReadonlyArray<readonly [string, KnowledgePathChange]> = [
  ["R", KnowledgePathChange.Enum.renamed],
  ["D", KnowledgePathChange.Enum.deleted],
];

const removalOf = (commit: KnowledgeCommitSha, subject: string, line: string): O.Option<KnowledgePathRemoval> => {
  const [status = "", path = "", renamedTo] = Str.split("\t")(line);
  const change = O.map(
    A.findFirst(STATUS_CHANGES, ([prefix]) => Str.startsWith(prefix)(status)),
    ([, value]) => value
  );
  return O.map(
    O.filter(change, () => Str.isNonEmpty(path)),
    (value) =>
      KnowledgePathRemoval.make({ path, commit, subject, change: value, renamedTo: O.fromUndefinedOr(renamedTo) })
  );
};

const commitRemovals = (record: string): ReadonlyArray<KnowledgePathRemoval> => {
  const [header = "", ...lines] = Str.split("\n")(record);
  const [commit = "", subject = ""] = Str.split(UNIT_SEPARATOR)(header);
  return isCommitSha(commit)
    ? A.getSomes(A.map(A.filter(lines, Str.isNonEmpty), (line) => removalOf(commit, subject, line)))
    : A.empty();
};

/**
 * Parses the output of `git log` run with {@link KNOWLEDGE_PATH_REMOVAL_LOG_ARGS}.
 *
 * **Details**
 *
 * Every deleted (`D`) or renamed-away (`R`) path becomes one removal, in log order (newest commit
 * first). Records whose header is not a full commit id are skipped.
 *
 * **Example** (Parse one deletion)
 *
 * ```ts
 * import { parseKnowledgePathRemovals } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.grouping"
 *
 * const removals = parseKnowledgePathRemovals(
 *   "\u001e1111111111111111111111111111111111111111\u001fchore: drop\n\nD\tdocs/old.md\n"
 * )
 *
 * console.log(removals[0]?.path) // "docs/old.md"
 * ```
 *
 * @param text - Raw log output.
 * @returns The removals, newest first.
 * @category parsing
 * @since 0.0.0
 */
export const parseKnowledgePathRemovals = (text: string): ReadonlyArray<KnowledgePathRemoval> =>
  A.flatMap(Str.split(RECORD_SEPARATOR)(text), commitRemovals);

// Each removed path and every directory above it, mapped to its newest removal.
const removalIndex = (removals: ReadonlyArray<KnowledgePathRemoval>): HashMap.HashMap<string, KnowledgePathRemoval> => {
  const index = MutableHashMap.empty<string, KnowledgePathRemoval>();
  for (const removal of removals) {
    const prefixes = A.scan(Str.split("/")(removal.path), "", (prefix, segment) =>
      Str.isEmpty(prefix) ? segment : `${prefix}/${segment}`
    );
    for (const key of A.drop(prefixes, 1)) {
      if (!MutableHashMap.has(index, key)) {
        MutableHashMap.set(index, key, removal);
      }
    }
  }
  return HashMap.fromIterable(index);
};

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
