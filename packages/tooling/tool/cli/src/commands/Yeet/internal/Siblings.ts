/**
 * Packet siblings: the open pull requests that share a `goals/<slug>/**`
 * packet with a given pull request, and the files each of them would conflict
 * on against the base once that pull request lands.
 *
 * **Details**
 *
 * Operator ruling 2026-11-05 (B2 in
 * `goals/agent-pool-doctrine/history/2026-11-05-base-conflict-merge-main.md`):
 * when the merge gate lands a pull request that touched a goal packet, every
 * other open pull request on that packet is told in the same run which
 * sibling merged and which files `git merge-tree --write-tree <base> <head>`
 * predicts will conflict, so its owner merges `origin/main` with a concrete
 * target instead of discovering a `CONFLICTING` flag hours later. The same
 * read backs `yeet siblings <pr>` for a report on demand.
 *
 * The read is REST only (the pull request's files, the open pull requests,
 * each candidate's files) plus local git for the probe: the sibling's head is
 * fetched as objects only (`refs/pull/<n>/head`, no ref written) and
 * `merge-tree` runs against the refreshed base. A probe that cannot run is
 * reported as `unavailable`, never as clean.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { shellQuote } from "@beep/repo-utils/Shell";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GithubRest } from "../../../internal/github/index.ts";
import { runRepoCommandCaptureRaw } from "../../../internal/repo-run/RepoRun.executor.ts";
import { parseMergeTreeConflictNames } from "../../Worktree/Fleet.service.ts";
import { provideYeetGhLogin, yeetGithubFailure } from "./GhOps.ts";
import { refreshBaseRef, resolveYeetRev } from "./GitExec.ts";
import { hydrateYeetReadOnlyContext } from "./Handler.ts";
import type { Git } from "@beep/git/Git";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { GithubPullRequestRecord } from "../../../internal/github/index.ts";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";
import type { YeetCommandError } from "../Yeet.errors.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/Siblings");

/**
 * How a sibling's `merge-tree` probe against the base ended.
 *
 * **Example** (Read the domain)
 *
 * ```ts
 * import { PacketSiblingProbe } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(PacketSiblingProbe.is("conflict")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PacketSiblingProbe = LiteralKit(["clean", "conflict", "unavailable"]).pipe(
  $I.annoteSchema("PacketSiblingProbe", {
    description: "Outcome of a sibling's merge-tree probe: clean, conflict, or a probe that could not run.",
  })
);

/**
 * The decoded probe outcome literal.
 *
 * @category models
 * @since 0.0.0
 */
export type PacketSiblingProbe = typeof PacketSiblingProbe.Type;

/**
 * Where a packet sibling stands when the subject pull request merges.
 *
 * **Details**
 *
 * `Trunk` is an ordinary pull request: it catches up by merging the trunk.
 * `Layer` is a stack layer whose parent is still open: it merges the parent's
 * branch, never the trunk, because its diff would otherwise carry the trunk's
 * changes until the parent catches up. `Cascading` is a layer above the
 * subject in the subject's own stack once the subject has merged: GitHub
 * retargets it to the trunk and force-pushes it, so it merges nothing and
 * adopts the rewritten head. `Unknown` is a layer above the bottom of a stack
 * whose relation to the subject could not be read: it is told both cases and
 * guesses neither. `onTrunk` says GitHub already retargeted it to the trunk.
 * The bottom layer of a stack has nothing below it and is always `Trunk`.
 *
 * **Example** (A layer whose parent just merged)
 *
 * ```ts
 * import { PacketSiblingPlace } from "@beep/repo-cli/test/Yeet"
 *
 * const place = PacketSiblingPlace.cases.Cascading.make({ belowPr: 3241 })
 * console.log(place._tag) // "Cascading"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PacketSiblingPlace = S.TaggedUnion({
  Trunk: {},
  Layer: { parentRef: S.NonEmptyString },
  Cascading: { belowPr: S.Int },
  Unknown: { stackNumber: S.Int, onTrunk: S.Boolean },
}).pipe(
  $I.annoteSchema("PacketSiblingPlace", {
    description:
      "Where a packet sibling stands when the subject merges: on the trunk, a stack layer on an open parent, a layer GitHub is cascading onto the trunk, or a stacked sibling whose relation to the subject was not read.",
  })
);

/**
 * Where a packet sibling stands when the subject pull request merges.
 *
 * @category models
 * @since 0.0.0
 */
export type PacketSiblingPlace = typeof PacketSiblingPlace.Type;

const trunkPlace: PacketSiblingPlace = PacketSiblingPlace.cases.Trunk.make({});

/**
 * One open pull request that shares a goal packet with the subject pull request.
 *
 * **Example** (A sibling with one predicted conflict)
 *
 * ```ts
 * import { PacketSibling } from "@beep/repo-cli/test/Yeet"
 *
 * const sibling = PacketSibling.make({
 *   prNumber: 2691,
 *   headRef: "codex/cache-creation-mask-identity",
 *   headSha: "0123456789abcdef0123456789abcdef01234567",
 *   slugs: ["turborepo-cache"],
 *   probe: "conflict",
 *   conflicts: ["goals/turborepo-cache/SPEC.md"],
 * })
 * console.log(sibling.conflicts.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PacketSibling extends S.Opaque<PacketSibling, { readonly brand: unique symbol }>()(
  S.Struct({
    prNumber: S.Int,
    headRef: S.String,
    headSha: S.String,
    /** The packet slugs this sibling shares with the subject pull request. */
    slugs: S.Array(S.NonEmptyString),
    probe: PacketSiblingProbe,
    /** Files `merge-tree` predicts will conflict against the base; empty unless `probe` is `conflict`. */
    conflicts: S.Array(S.String),
    /** How the sibling catches up: an ordinary pull request unless it is a stack layer. */
    place: PacketSiblingPlace.pipe(S.withConstructorDefault(Effect.succeed(trunkPlace))),
  }).pipe(
    $I.annoteSchema("PacketSibling", {
      description:
        "An open pull request sharing a goal packet with the subject, with its predicted conflicts and where it stands relative to the trunk.",
    })
  )
) {}

/**
 * The siblings report for one pull request.
 *
 * **Example** (A pull request outside every packet)
 *
 * ```ts
 * import { PacketSiblingsReport } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const report = PacketSiblingsReport.make({ prNumber: 7, base: "origin/main", baseSha: O.none(), slugs: [], siblings: [] })
 * console.log(report.siblings.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PacketSiblingsReport extends S.Opaque<PacketSiblingsReport, { readonly brand: unique symbol }>()(
  S.Struct({
    prNumber: S.Int,
    base: S.String,
    /** The base commit the probes ran against; absent when no probe ran. */
    baseSha: S.Option(S.String),
    /** The packet slugs the subject pull request touches. */
    slugs: S.Array(S.NonEmptyString),
    siblings: S.Array(PacketSibling),
  }).pipe(
    $I.annoteSchema("PacketSiblingsReport", {
      description: "The goal packets a pull request touches and the open pull requests sharing them.",
    })
  )
) {}

const PACKET_PATH_PREFIX = "goals/";

// The packet a single path belongs to: `goals/<slug>/...`, never a file directly under `goals/`.
const packetSlugOf = (path: string): O.Option<string> => {
  if (!Str.startsWith(PACKET_PATH_PREFIX)(path)) return O.none();
  const rest = Str.slice(Str.length(PACKET_PATH_PREFIX))(path);
  return O.flatMap(Str.indexOf("/")(rest), (at) => (at > 0 ? O.some(Str.slice(0, at)(rest)) : O.none()));
};

/**
 * The goal-packet slugs a set of changed paths touches, deduped in path order.
 *
 * **Details**
 *
 * A path counts when it lies under `goals/<slug>/`; `goals/README.md` and
 * other files directly under `goals/` belong to no packet.
 *
 * **Example** (Two paths, one packet)
 *
 * ```ts
 * import { packetSlugsOf } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(packetSlugsOf(["goals/x/SPEC.md", "goals/x/ops/manifest.json", "goals/README.md", "src/a.ts"])) // ["x"]
 * ```
 *
 * @param paths - Repository-relative changed paths.
 * @returns The distinct packet slugs, first occurrence first.
 * @category queries
 * @since 0.0.0
 */
export const packetSlugsOf = (paths: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.dedupe(A.getSomes(A.map(paths, packetSlugOf)));

const sharedSlugs = (mine: ReadonlyArray<string>, theirs: ReadonlyArray<string>): ReadonlyArray<string> => {
  const theirSet = HashSet.fromIterable(theirs);
  return A.filter(mine, (slug) => HashSet.has(theirSet, slug));
};

const sha10 = Str.slice(0, 10);

const backticked = (text: string): string => `\`${text}\``;

const listOf = (items: ReadonlyArray<string>): string => A.join(A.map(items, backticked), ", ");

/**
 * What one sibling broadcast says: the merged pull request, its squash commit, the probed base and the sibling told.
 *
 * **Example** (Describe one broadcast)
 *
 * ```ts
 * import { PacketSibling, SiblingBroadcast } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const sibling = PacketSibling.make({ prNumber: 8, headRef: "lane/eight", headSha: "0123456789abcdef0123456789abcdef01234567", slugs: ["alpha"], probe: "clean", conflicts: [] })
 * console.log(SiblingBroadcast.make({ mergedPr: 7, mergeSha: "feedface", baseSha: O.none(), sibling }).mergedPr) // 7
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SiblingBroadcast extends S.Opaque<SiblingBroadcast, { readonly brand: unique symbol }>()(
  S.Struct({
    mergedPr: S.Int,
    mergeSha: S.String,
    /** The base commit the probe ran against, when it ran. */
    baseSha: S.Option(S.String),
    sibling: PacketSibling,
  }).pipe(
    $I.annoteSchema("SiblingBroadcast", {
      description:
        "One merge-gate broadcast: the merged pull request, its squash commit, the probed base and the sibling told.",
    })
  )
) {}

const AUTHORITY =
  'This instruction holds whatever your brief says about acceptance or merge authority (operator ruling 2026-11-05, B1; AGENTS.md "Autonomy").';

// The branch name comes from GitHub and lands in a command a recipient may paste,
// so both ref arguments are shell-quoted. `git switch -C` resets the branch, so the
// old tip is kept for any commit the lane had not pushed. The backup is named per
// branch: linked worktrees share refs/heads, and one merge can cascade several layers.
const adoptRewrite = (headRef: string): string => {
  const backup = shellQuote(`pre-cascade/${headRef}`);
  return `wait for \`head_ref_force_pushed\` on its timeline, then, before any further commit, adopt the rewritten head: \`git fetch origin && git branch -f ${backup} HEAD && git switch -C ${shellQuote(headRef)} ${shellQuote(`origin/${headRef}`)}\`. The switch resets the branch, so the \`pre-cascade/\` branch keeps the old tip: cherry-pick from it any commit of your own that was never pushed`;
};

// What the sibling does now. A stack layer never merges the trunk: its diff would
// carry the trunk's changes until its parent catches up.
const siblingInstruction = (mergedPr: number, sibling: PacketSibling): string =>
  PacketSiblingPlace.match({
    Trunk: () => "Merge `origin/main` into this lane now, resolve, regenerate generated files, push once.",
    Layer: ({ parentRef }) =>
      `This pull request is a stack layer on \`${parentRef}\`: do not merge \`origin/main\` into it. Its parent catches up first; once the parent has pushed, merge \`origin/${parentRef}\` into this lane, resolve, regenerate generated files, push once.`,
    Cascading: ({ belowPr }) =>
      `#${belowPr} was the layer below this pull request and merged alone, so GitHub retargets this pull request to \`main\` and force-pushes it (the cascade), usually within seconds. Merge nothing into it: ${adoptRewrite(sibling.headRef)}.`,
    Unknown: ({ stackNumber, onTrunk }) => {
      const opening = `This pull request is in stack #${stackNumber}, and the gate could not read how #${mergedPr} relates to it.`;
      // Already on the trunk: either this merge cascaded it, or an earlier one did and it is an
      // ordinary pull request now. Adopting first is right in both cases.
      return onTrunk
        ? `${opening} If #${mergedPr} was the layer below it, GitHub has cascaded it onto \`main\`: ${adoptRewrite(sibling.headRef)}. Then merge \`origin/main\` into this lane, resolve, regenerate generated files, push once.`
        : `${opening} If #${mergedPr} was the layer below it, GitHub is cascading it onto \`main\`: merge nothing, ${adoptRewrite(sibling.headRef)}. Otherwise merge its parent's branch, never \`origin/main\`.`;
    },
  })(sibling.place);

// A cascading layer is not probed, and neither is one whose place is unknown: the head it may be
// leaving predicts conflicts the cascade removes.
const siblingProbed = (sibling: PacketSibling): boolean =>
  sibling.place._tag === "Trunk" || sibling.place._tag === "Layer";

/**
 * The comment the merge gate posts on one sibling after a packet pull request merged.
 *
 * **Example** (Render one broadcast)
 *
 * ```ts
 * import { PacketSibling, renderSiblingBroadcast, SiblingBroadcast } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const sibling = PacketSibling.make({
 *   prNumber: 2691,
 *   headRef: "codex/x",
 *   headSha: "0123456789abcdef0123456789abcdef01234567",
 *   slugs: ["turborepo-cache"],
 *   probe: "conflict",
 *   conflicts: ["goals/turborepo-cache/SPEC.md"],
 * })
 * const body = renderSiblingBroadcast(SiblingBroadcast.make({ mergedPr: 2688, mergeSha: "feedfacefeedface", baseSha: O.some("0abc0abc0abc"), sibling }))
 * console.log(body.split("\n")[0]) // "yeet merge-gate: sibling #2688 merged on `turborepo-cache` (feedfacefe)."
 * ```
 *
 * @param input - The merged pull request, its squash commit, the probed base commit (when the probe ran) and the sibling being told.
 * @returns The comment body.
 * @category rendering
 * @since 0.0.0
 */
export const renderSiblingBroadcast = ({ mergedPr, mergeSha, baseSha, sibling }: SiblingBroadcast): string => {
  const base = O.match(baseSha, { onNone: () => "the base", onSome: (sha) => `\`origin/main\` at ${sha10(sha)}` });
  const expectation = Match.value(sibling.probe).pipe(
    Match.when("conflict", () => `Expected conflicting files against ${base}: ${listOf(sibling.conflicts)}.`),
    Match.when(
      "clean",
      () =>
        `No conflicts predicted against ${base}; the catch-up merge is still due so the next sibling merge does not find you behind.`
    ),
    Match.when(
      "unavailable",
      () => `The conflict probe could not run; expect the packet's Decision Log tails and \`ops/manifest.json\`.`
    ),
    Match.exhaustive
  );
  return A.join(
    [
      `yeet merge-gate: sibling #${mergedPr} merged on ${listOf(sibling.slugs)} (${sha10(mergeSha)}).`,
      `${siblingInstruction(mergedPr, sibling)} ${AUTHORITY}`,
      ...(siblingProbed(sibling) ? [expectation] : []),
    ],
    "\n\n"
  );
};

/**
 * Render a siblings report as hand-off lines.
 *
 * **Example** (Render a report with no packets)
 *
 * ```ts
 * import { PacketSiblingsReport, renderPacketSiblingsReport } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const report = PacketSiblingsReport.make({ prNumber: 7, base: "origin/main", baseSha: O.none(), slugs: [], siblings: [] })
 * console.log(renderPacketSiblingsReport(report)) // "[yeet] siblings #7: touches no goal packet"
 * ```
 *
 * @param report - The report to render.
 * @returns One line per sibling after a header line.
 * @category rendering
 * @since 0.0.0
 */
export const renderPacketSiblingsReport = (report: PacketSiblingsReport): string => {
  if (A.isReadonlyArrayEmpty(report.slugs)) return `[yeet] siblings #${report.prNumber}: touches no goal packet`;
  const base = O.match(report.baseSha, {
    onNone: () => report.base,
    onSome: (sha) => `${report.base} at ${sha10(sha)}`,
  });
  const header = `[yeet] siblings #${report.prNumber}: packets ${listOf(report.slugs)}; ${A.length(report.siblings)} open sibling PR(s); probed against ${base}`;
  const lines = A.map(report.siblings, (sibling) => {
    const outcome = Match.value(sibling.probe).pipe(
      Match.when("conflict", () => `conflicts: ${A.join(sibling.conflicts, ", ")}`),
      Match.when("clean", () => "no conflicts predicted"),
      Match.when("unavailable", () => "probe unavailable"),
      Match.exhaustive
    );
    const layer = PacketSiblingPlace.match({
      Trunk: () => "",
      Layer: ({ parentRef }) => `; stack layer on ${parentRef}`,
      Cascading: ({ belowPr }) => `; cascading onto the trunk after #${belowPr} (not probed)`,
      Unknown: ({ stackNumber }) => `; in stack #${stackNumber}, relation to the subject not read (not probed)`,
    })(sibling.place);
    return `  #${sibling.prNumber} ${sibling.headRef} (${sha10(sibling.headSha)}) shares ${listOf(sibling.slugs)}; ${outcome}${layer}`;
  });
  return A.join([header, ...lines], "\n");
};

type ProbeOutcome = { readonly probe: PacketSiblingProbe; readonly conflicts: ReadonlyArray<string> };

const PROBE_UNAVAILABLE: ProbeOutcome = { probe: "unavailable", conflicts: A.empty() };

// Objects only: the pull ref is fetched without writing a local ref or FETCH_HEAD, so the probe
// leaves the checkout's refs untouched. GitHub keeps `refs/pull/<n>/head` for every open PR.
const fetchSiblingHead = (repoRoot: string, prNumber: number) =>
  runRepoCommandCaptureRaw(
    "git",
    ["fetch", "--quiet", "--no-tags", "--no-write-fetch-head", "origin", `refs/pull/${prNumber}/head`],
    repoRoot
  );

// `merge-tree --write-tree` exits 0 clean and 1 conflicted; every other exit (a missing object
// included) is a failed probe, never clean.
const probeSibling = Effect.fnUntraced(function* (
  context: RepoRunContext,
  sibling: { prNumber: number; headSha: string }
) {
  const fetched = yield* fetchSiblingHead(context.repoRoot, sibling.prNumber).pipe(Effect.option);
  if (O.isNone(fetched) || fetched.value.exitCode !== 0) return PROBE_UNAVAILABLE;
  const probe = yield* runRepoCommandCaptureRaw(
    "git",
    ["merge-tree", "--write-tree", "--name-only", context.base, sibling.headSha],
    context.repoRoot
  ).pipe(Effect.option);
  return O.match(probe, {
    onNone: () => PROBE_UNAVAILABLE,
    onSome: (result): ProbeOutcome =>
      Match.value(result.exitCode).pipe(
        Match.when(0, (): ProbeOutcome => ({ probe: "clean", conflicts: A.empty() })),
        Match.when(
          1,
          (): ProbeOutcome => ({ probe: "conflict", conflicts: parseMergeTreeConflictNames(result.output) })
        ),
        Match.orElse(() => PROBE_UNAVAILABLE)
      ),
  });
});

// A layer's own base is the parent's branch while the stack's base is the trunk. Once the layer
// below has merged, GitHub retargets and force-pushes every layer above it, and the list read can
// catch such a layer on either base, so a merged subject below it in the same stack decides first.
const siblingPlace = (
  subject: O.Option<GithubPullRequestRecord>,
  subjectUnread: boolean,
  pull: GithubPullRequestRecord
): PacketSiblingPlace =>
  O.match(pull.stack, {
    onNone: () => trunkPlace,
    onSome: (stack) => {
      // The bottom layer has nothing below it: an ordinary pull request, whatever was read.
      if (stack.position <= 1) return trunkPlace;
      // An unread subject places no upper layer: a guessed `Layer` would tell a cascading layer
      // to merge a parent branch that no longer exists.
      return subjectUnread
        ? PacketSiblingPlace.cases.Unknown.make({
            stackNumber: stack.number,
            onTrunk: stack.baseRef === pull.baseRef,
          })
        : subject.pipe(
            O.filter(
              (below) =>
                below.merged &&
                O.exists(below.stack, (theirs) => theirs.number === stack.number && theirs.position < stack.position)
            ),
            O.match({
              onSome: (below): PacketSiblingPlace => PacketSiblingPlace.cases.Cascading.make({ belowPr: below.number }),
              onNone: (): PacketSiblingPlace =>
                stack.baseRef === pull.baseRef
                  ? trunkPlace
                  : PacketSiblingPlace.cases.Layer.make({ parentRef: pull.baseRef }),
            })
          );
    },
  });

/**
 * Read the open pull requests that share a goal packet with `prNumber` and probe each against the base.
 *
 * **Details**
 *
 * Returns early with no siblings when the subject touches no `goals/<slug>/**`
 * path, without listing open pull requests or touching git. Otherwise the base
 * is refreshed once (`refreshBaseRef`), every open pull request's files are
 * read, and each one sharing a slug is probed with `merge-tree` against the
 * base. The subject itself is never a sibling.
 *
 * **Example** (Build the read)
 *
 * ```ts
 * import { readPacketSiblings } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof readPacketSiblings) // "function"
 * ```
 *
 * @param context - The run context (repo root and base ref).
 * @param prNumber - The subject pull request.
 * @returns The report.
 * @category workflows
 * @since 0.0.0
 */
export const readPacketSiblings = Effect.fn("Yeet.readPacketSiblings")(function* (
  context: RepoRunContext,
  prNumber: number
): Effect.fn.Return<
  PacketSiblingsReport,
  YeetCommandError,
  GithubRest | ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom | Git
> {
  const rest = yield* GithubRest;
  const files = yield* rest
    .pullRequestFiles(prNumber)
    .pipe(Effect.mapError(yeetGithubFailure(`gh api files #${prNumber}`)));
  const slugs = packetSlugsOf(files);
  const empty = PacketSiblingsReport.make({ prNumber, base: context.base, baseSha: O.none(), slugs, siblings: [] });
  if (A.isReadonlyArrayEmpty(slugs)) return empty;

  const open = yield* rest.openPullRequests.pipe(Effect.mapError(yeetGithubFailure("gh api open pulls")));
  // One candidate's files read failing (a 5xx, a rate limit, a PR closed mid-read) must not abort
  // the discovery: that PR is reported as not sharing and the others still get their broadcast.
  const candidates = yield* Effect.forEach(
    A.filter(open, (pull) => pull.number !== prNumber),
    (pull) =>
      rest.pullRequestFiles(pull.number).pipe(
        Effect.map((theirs) => ({ pull, shared: sharedSlugs(slugs, packetSlugsOf(theirs)) })),
        Effect.catch((error) =>
          Console.error(
            `[yeet] warning: could not read the files of #${pull.number}; treating it as not sharing a packet: ${error.message}`
          ).pipe(Effect.as({ pull, shared: A.empty<string>() }))
        )
      ),
    { concurrency: 4 }
  );
  const sharing = A.filter(candidates, ({ shared }) => A.isReadonlyArrayNonEmpty(shared));
  if (A.isReadonlyArrayEmpty(sharing)) return empty;

  yield* refreshBaseRef(context.repoRoot, context.base);
  // `Git.revParse` verifies the base commit (W7a, SPEC D-18); an unresolvable base is no sha.
  const baseSha = yield* resolveYeetRev(context.repoRoot, `${context.base}^{commit}`).pipe(Effect.option);
  // The subject's own record is read only when a sibling sits in a stack: a layer above a
  // merged subject is being cascaded, whichever base the list read caught it on.
  const stacked = A.some(sharing, ({ pull }) => O.isSome(pull.stack));
  const subject = stacked
    ? yield* rest.pullRequest(prNumber).pipe(
        Effect.asSome,
        Effect.catch((error) =>
          Console.error(
            `[yeet] warning: could not read #${prNumber} to place its stacked siblings; each is told to check its stack: ${error.message}`
          ).pipe(Effect.as(O.none<GithubPullRequestRecord>()))
        )
      )
    : O.none<GithubPullRequestRecord>();
  const siblings = yield* Effect.forEach(sharing, ({ pull, shared }) => {
    const place = siblingPlace(subject, stacked && O.isNone(subject), pull);
    // Only a sibling that will merge something is probed: GitHub replays a cascading layer's
    // commits onto the squash commit, and a probe of the head it is leaving predicts conflicts
    // the cascade removes.
    const probed =
      place._tag === "Trunk" || place._tag === "Layer"
        ? probeSibling(context, { prNumber: pull.number, headSha: pull.headSha })
        : Effect.succeed<ProbeOutcome>({ probe: "unavailable", conflicts: [] });
    return probed.pipe(
      Effect.map(({ probe, conflicts }) =>
        PacketSibling.make({
          prNumber: pull.number,
          headRef: pull.headRef,
          headSha: pull.headSha,
          slugs: shared,
          probe,
          conflicts,
          place,
        })
      )
    );
  });
  return PacketSiblingsReport.make({ prNumber, base: context.base, baseSha, slugs, siblings });
});

// "2 to merge origin/main, 1 to adopt the cascade": what the comments asked for, by place.
const siblingAsks: ReadonlyArray<readonly [PacketSiblingPlace["_tag"], string]> = [
  ["Trunk", "to merge origin/main"],
  ["Layer", "to merge their parent's branch"],
  ["Cascading", "to adopt the cascade"],
  ["Unknown", "to check their stack"],
];
const renderSiblingAsks = (siblings: ReadonlyArray<PacketSibling>): string =>
  A.join(
    A.flatMap(siblingAsks, ([tag, ask]) => {
      const asked = A.length(A.filter(siblings, (sibling) => sibling.place._tag === tag));
      return asked === 0 ? [] : [`${asked} ${ask}`];
    }),
    ", "
  );

/**
 * Tell every open sibling of a just-merged packet pull request to merge main now.
 *
 * **Details**
 *
 * Reads the siblings of the merged pull request (its files are still readable
 * after the merge), posts one {@link renderSiblingBroadcast} comment per
 * sibling, and prints the count. A pull request outside every packet posts
 * nothing. Each comment is independent: one refused comment is reported and
 * the rest are still posted. Failures reach the caller, which treats the whole
 * broadcast as best effort after the merge.
 *
 * **Example** (Build the broadcast)
 *
 * ```ts
 * import { broadcastPacketSiblings } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof broadcastPacketSiblings) // "function"
 * ```
 *
 * @param context - The run context.
 * @param mergedPr - The merged pull request.
 * @param mergeSha - Its squash commit.
 * @returns The report the comments were rendered from.
 * @category workflows
 * @since 0.0.0
 */
export const broadcastPacketSiblings = Effect.fn("Yeet.broadcastPacketSiblings")(function* (
  context: RepoRunContext,
  mergedPr: number,
  mergeSha: string
): Effect.fn.Return<
  PacketSiblingsReport,
  YeetCommandError,
  GithubRest | ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom | Git
> {
  const report = yield* readPacketSiblings(context, mergedPr);
  if (A.isReadonlyArrayEmpty(report.siblings)) return report;
  const rest = yield* GithubRest;
  const [posted, failed] = yield* Effect.partition(report.siblings, (sibling) =>
    rest
      .createIssueComment(
        sibling.prNumber,
        renderSiblingBroadcast(SiblingBroadcast.make({ mergedPr, mergeSha, baseSha: report.baseSha, sibling }))
      )
      .pipe(
        Effect.mapBoth({
          onFailure: yeetGithubFailure(`gh api comment #${sibling.prNumber}`),
          onSuccess: () => sibling.prNumber,
        })
      )
  );
  yield* Effect.forEach(
    failed,
    (error) => Console.error(`[yeet] warning: a sibling broadcast failed; continuing: ${error.message}`),
    { discard: true }
  );
  yield* Console.log(
    `[yeet] told ${A.length(posted)} of ${A.length(report.siblings)} open sibling PR(s) on ${listOf(report.slugs)} to catch up (${renderSiblingAsks(report.siblings)})`
  );
  return report;
});

/**
 * The `yeet siblings` flags as the CLI parses them.
 *
 * **Example** (Describe an invocation)
 *
 * ```ts
 * import { SiblingsCommandOptions } from "@beep/repo-cli/test/Yeet"
 *
 * const options = SiblingsCommandOptions.make({ base: "origin/main", head: "HEAD", packetDir: ".beep/yeet", pr: 2691 })
 * console.log(options.pr) // 2691
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SiblingsCommandOptions extends S.Opaque<SiblingsCommandOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    base: S.String,
    head: S.String,
    packetDir: S.String,
    pr: S.Int,
  }).pipe($I.annoteSchema("SiblingsCommandOptions", { description: "Parsed yeet siblings flags." }))
) {}

/**
 * Run `yeet siblings <pr>`: resolve the repo root, read the report under the operator's gh login, print it.
 *
 * **Example** (Build the command effect)
 *
 * ```ts
 * import { runYeetSiblings } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof runYeetSiblings) // "function"
 * ```
 *
 * @param options - The parsed command flags.
 * @returns Nothing; the report is printed.
 * @category workflows
 * @since 0.0.0
 */
export const runYeetSiblings = Effect.fn("Yeet.runSiblingsCommand")(function* (
  options: SiblingsCommandOptions
): Effect.fn.Return<
  void,
  YeetCommandError,
  SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner | Git
> {
  const context = yield* hydrateYeetReadOnlyContext(options);
  const report = yield* readPacketSiblings(context, options.pr).pipe(provideYeetGhLogin(context.repoRoot));
  yield* Console.log(renderPacketSiblingsReport(report));
});
