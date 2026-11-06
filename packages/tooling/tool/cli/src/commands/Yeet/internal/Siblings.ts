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
  }).pipe(
    $I.annoteSchema("PacketSibling", {
      description: "An open pull request sharing a goal packet with the subject, with its predicted conflicts.",
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
      `Merge \`origin/main\` into this lane now, resolve, regenerate generated files, push once. This instruction holds whatever your brief says about acceptance or merge authority (operator ruling 2026-11-05, B1; AGENTS.md "Autonomy").`,
      expectation,
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
    return `  #${sibling.prNumber} ${sibling.headRef} (${sha10(sibling.headSha)}) shares ${listOf(sibling.slugs)}; ${outcome}`;
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
  const siblings = yield* Effect.forEach(sharing, ({ pull, shared }) =>
    probeSibling(context, { prNumber: pull.number, headSha: pull.headSha }).pipe(
      Effect.map(({ probe, conflicts }) =>
        PacketSibling.make({
          prNumber: pull.number,
          headRef: pull.headRef,
          headSha: pull.headSha,
          slugs: shared,
          probe,
          conflicts,
        })
      )
    )
  );
  return PacketSiblingsReport.make({ prNumber, base: context.base, baseSha, slugs, siblings });
});

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
    `[yeet] told ${A.length(posted)} of ${A.length(report.siblings)} open sibling PR(s) on ${listOf(report.slugs)} to merge origin/main now`
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
