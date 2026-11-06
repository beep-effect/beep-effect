/**
 * `ArchivePlanner` — select terminal packets and compute their archive plan
 * (keep/remove partition, HEAD tree hash, inbound links) without changing
 * anything.
 *
 * **Details**
 *
 * Selection: goals in `completed-retained` or `superseded`, explorations in
 * `graduated` or `killed`, never `_template`, never a packet whose manifest
 * already carries an `archive` block or a `retentionReason`. Candidates are
 * ordered as the portfolio index lists them (goals first, by status group then
 * slug; explorations after, the same way) before `--slug` and `--batch` apply.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { runGitOutput, runGitPathList } from "../../internal/repo-run/index.ts";
import { ExplorationManifest, ExplorationStatus } from "../Explore/Atlas.ts";
import { knowledgeDocumentLines, knowledgeLinkDestinations } from "../Knowledge/Knowledge.refs.ts";
import { ArchivePlan, ArchivePlanEntry, InboundLink, tombstoneKeeps } from "./Archive.schemas.ts";
import { ArchiveError } from "./Goals.errors.ts";
import { decodeGoalManifest, GoalStatus } from "./Goals.schemas.ts";
import { isTerminalPacketStatus } from "./Harvest.service.ts";
import { GOALS_DIR, listGoalPackets, parseGoalManifestText, TEMPLATE_SLUG } from "./Inventory.ts";
import { canonicalJsonText, sha256Hex } from "./PacketCore/PacketDigest.ts";
import type * as Digest from "effect/crypto/Digest";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { GitCommandErrorAdapter } from "../../internal/repo-run/index.ts";
import type { KnowledgeDocumentLine } from "../Knowledge/Knowledge.refs.ts";
import type { ArchiveRepoRef } from "./Archive.schemas.ts";
import type { GoalManifest } from "./Goals.schemas.ts";
import type { GoalPacketRecord } from "./Inventory.ts";
import type { PacketRoot } from "./PacketCore/PacketCore.schemas.ts";

const $I = $RepoCliId.create("commands/Goals/Archive.service");

const EXPLORATIONS_DIR = "explorations";

/**
 * Repository roots scanned for inbound links into archived packet files.
 *
 * **Example** (Read the scanned roots)
 *
 * ```ts
 * import { INBOUND_LINK_ROOTS } from "@beep/repo-cli/commands/Goals/Archive.service"
 *
 * console.log(INBOUND_LINK_ROOTS.includes("standards")) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const INBOUND_LINK_ROOTS: ReadonlyArray<string> = [
  "docs",
  "standards",
  ".claude",
  "packages",
  "apps",
  GOALS_DIR,
  EXPLORATIONS_DIR,
];

const INBOUND_LINK_EXTENSIONS: ReadonlyArray<string> = [".md", ".mdx", ".ts", ".tsx", ".json"];
const QUERY_OR_FRAGMENT = /[?#].*$/;
const FRAGMENT = /#.*$/;

const decodeExplorationManifest = S.decodeUnknownOption(ExplorationManifest);
const encodePlanEntries = S.encodeUnknownEffect(S.Array(ArchivePlanEntry));

/**
 * Options for one archive plan.
 *
 * **Example** (Plan the first three goals)
 *
 * ```ts
 * import type { ArchivePlanOptions } from "@beep/repo-cli/commands/Goals/Archive.service"
 *
 * const options: ArchivePlanOptions = {
 *   kinds: ["goals"],
 *   slugs: [],
 *   batchSize: 3,
 *   repo: "beep-effect/beep-effect-goals-archive",
 *   repoRoot: ".",
 * }
 * console.log(options.batchSize) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface ArchivePlanOptions {
  readonly batchSize?: number;
  readonly kinds: ReadonlyArray<PacketRoot>;
  readonly repo: ArchiveRepoRef;
  readonly repoRoot: string;
  readonly slugs: ReadonlyArray<string>;
}

type Candidate = {
  readonly root: PacketRoot;
  readonly slug: string;
  readonly status: string;
};

const statusRank = (literals: ReadonlyArray<string>) => (status: string) =>
  O.getOrElse(
    A.findFirstIndex(literals, (literal) => literal === status),
    () => A.length(literals)
  );

const candidateOrder = (literals: ReadonlyArray<string>): Order.Order<Candidate> =>
  Order.combine(
    Order.mapInput(Order.Number, (candidate: Candidate) => statusRank(literals)(candidate.status)),
    Order.mapInput(Order.String, (candidate: Candidate) => candidate.slug)
  );

const gitAdapter = (repoRoot: string): GitCommandErrorAdapter<ArchiveError> => ({
  onSpawnFailure: (commandLine) => (cause) =>
    ArchiveError.new("archive-git-failed", null, repoRoot, `spawn ${commandLine}: ${String(cause)}`),
  onNonZeroExit: ({ commandLine, exitCode }) =>
    ArchiveError.new("archive-git-failed", null, repoRoot, `${commandLine} exited with ${exitCode}`),
  onTruncated: O.none(),
});

const isArchivableGoal = (manifest: GoalManifest): boolean =>
  isTerminalPacketStatus("goals", manifest.initiative.status) &&
  manifest.archive === undefined &&
  manifest.retentionReason === undefined;

const goalCandidate = Effect.fnUntraced(function* (record: GoalPacketRecord) {
  const parsed = pipe(O.fromUndefinedOr(record.manifestText), O.flatMap(parseGoalManifestText));
  if (O.isNone(parsed)) return O.none<Candidate>();
  const manifest = yield* decodeGoalManifest(parsed.value).pipe(Effect.option);
  return pipe(
    manifest,
    O.filter(isArchivableGoal),
    O.map((value): Candidate => ({ root: "goals", slug: record.slug, status: value.initiative.status }))
  );
});

const goalCandidates = Effect.fnUntraced(function* (repoRoot: string) {
  const records = yield* listGoalPackets(repoRoot);
  const decoded = yield* Effect.forEach(records, goalCandidate);
  return A.sort(A.getSomes(decoded), candidateOrder(GoalStatus.literals));
});

const explorationCandidates = Effect.fnUntraced(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const entries = yield* fs
    .readDirectory(path.join(repoRoot, EXPLORATIONS_DIR))
    .pipe(Effect.orElseSucceed(A.empty<string>));
  const slugs = A.filter(entries, (entry) => !Str.startsWith("_")(entry) && !Str.startsWith(".")(entry));
  const decoded = yield* Effect.forEach(slugs, (slug) =>
    fs.readFileString(path.join(repoRoot, EXPLORATIONS_DIR, slug, "ops", "manifest.json")).pipe(
      Effect.option,
      Effect.map(
        flow(
          O.flatMap(parseGoalManifestText),
          O.flatMap(decodeExplorationManifest),
          O.map((manifest) => manifest.exploration),
          O.filter(
            (entry) =>
              entry.slug === slug &&
              isTerminalPacketStatus("explorations", entry.status) &&
              entry.archive === undefined &&
              entry.retentionReason === undefined
          ),
          O.map((entry): Candidate => ({ root: "explorations", slug, status: entry.status }))
        )
      )
    )
  );
  return A.sort(A.getSomes(decoded), candidateOrder(ExplorationStatus.literals));
});

const selectCandidates = Effect.fnUntraced(function* (options: ArchivePlanOptions) {
  const goals = A.contains(options.kinds, "goals") ? yield* goalCandidates(options.repoRoot) : A.empty<Candidate>();
  const explorations = A.contains(options.kinds, "explorations")
    ? yield* explorationCandidates(options.repoRoot)
    : A.empty<Candidate>();
  const ordered = A.appendAll(goals, explorations);
  const eligible = HashSet.fromIterable(A.map(ordered, (candidate) => candidate.slug));
  const unknown = A.filter(options.slugs, (slug) => slug === TEMPLATE_SLUG || !HashSet.has(eligible, slug));
  if (A.isReadonlyArrayNonEmpty(unknown)) {
    return yield* ArchiveError.new(
      "archive-input-invalid",
      A.headNonEmpty(unknown),
      options.repoRoot,
      `not an archivable terminal packet of the selected kind (or already archived or retained): ${A.join(unknown, ", ")}`
    );
  }
  const requested = HashSet.fromIterable(options.slugs);
  const selected = A.isReadonlyArrayEmpty(options.slugs)
    ? ordered
    : A.filter(ordered, (candidate) => HashSet.has(requested, candidate.slug));
  return options.batchSize === undefined ? selected : A.take(selected, options.batchSize);
});

const packetDir = (candidate: Candidate): string => `${candidate.root}/${candidate.slug}`;

/**
 * Resolve a link destination written in `file` to a repo-relative path, or
 * `None` for external, anchor-only, or escaping destinations.
 *
 * **Example** (Resolve a relative link)
 *
 * ```ts
 * import { resolveLinkDestination } from "@beep/repo-cli/commands/Goals/Archive.service"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(resolveLinkDestination("docs/README.md", "../goals/demo/PLAN.md#p1"))) // true
 * ```
 *
 * @param file - Repo-relative path of the document holding the link.
 * @param destination - Raw link destination.
 * @returns Effect yielding the repo-relative target path without query or fragment.
 * @category parsing
 * @since 0.0.0
 */
export const resolveLinkDestination = Effect.fn("Archive.resolveLinkDestination")(function* (
  file: string,
  destination: string
) {
  const path = yield* Path.Path;
  const cleaned = Str.replace(QUERY_OR_FRAGMENT, "")(destination);
  if (
    Str.isEmpty(cleaned) ||
    Str.includes("://")(destination) ||
    Str.startsWith("mailto:")(destination) ||
    Str.startsWith("#")(destination)
  ) {
    return O.none<string>();
  }
  const joined = Str.startsWith("/")(cleaned) ? Str.slice(1)(cleaned) : path.join(path.dirname(file), cleaned);
  const normalized = path.normalize(joined);
  return Str.startsWith("..")(normalized) || path.isAbsolute(normalized) ? O.none<string>() : O.some(normalized);
});

type ScannedLink = {
  readonly file: string;
  readonly line: number;
  readonly destination: string;
  readonly target: string;
};

const scanFileLinks = Effect.fnUntraced(function* (repoRoot: string, file: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const text = yield* fs.readFileString(path.join(repoRoot, file)).pipe(Effect.orElseSucceed(() => ""));
  const proseLines: ReadonlyArray<KnowledgeDocumentLine> = A.filter(knowledgeDocumentLines(text), (line) => line.prose);
  const candidates = A.flatMap(proseLines, (line) =>
    A.map(knowledgeLinkDestinations(line.text), (link) => ({ line: line.number, destination: link.destination }))
  );
  const resolved = yield* Effect.forEach(candidates, (candidate) =>
    Effect.map(
      resolveLinkDestination(file, candidate.destination),
      O.map((target): ScannedLink => ({ file, line: candidate.line, destination: candidate.destination, target }))
    )
  );
  return A.getSomes(resolved);
});

const scanInboundLinks = Effect.fnUntraced(function* (repoRoot: string) {
  const tracked = yield* runGitPathList(
    repoRoot,
    ["ls-files", "-z", "--", ...INBOUND_LINK_ROOTS],
    gitAdapter(repoRoot)
  );
  const documents = A.filter(tracked, (file) =>
    A.some(INBOUND_LINK_EXTENSIONS, (extension) => Str.endsWith(extension)(file))
  );
  const links = yield* Effect.forEach(documents, (file) => scanFileLinks(repoRoot, file), { concurrency: 16 });
  return A.flatten(links);
});

const fragmentOf = (destination: string): string =>
  O.getOrElse(
    O.flatMap(Str.match(FRAGMENT)(destination), (match) => O.fromUndefinedOr(match[0])),
    () => ""
  );

const planEntry = Effect.fnUntraced(function* (
  options: ArchivePlanOptions,
  candidate: Candidate,
  links: ReadonlyArray<ScannedLink>
) {
  const adapter = gitAdapter(options.repoRoot);
  const dir = packetDir(candidate);
  const files = yield* runGitPathList(options.repoRoot, ["ls-files", "-z", "--", dir], adapter);
  const sorted = A.sort(files, Order.String);
  const kept = (file: string): boolean => tombstoneKeeps(candidate.root, Str.slice(Str.length(dir) + 1)(file));
  const keep = A.filter(sorted, kept);
  const remove = A.filter(sorted, (file) => !kept(file));
  const localTreeHash = yield* runGitOutput(options.repoRoot, ["rev-parse", `HEAD:${dir}`], adapter);
  const removed = HashSet.fromIterable(remove);
  const inbound = A.map(
    A.filter(links, (link) => !Str.startsWith(`${dir}/`)(link.file) && HashSet.has(removed, link.target)),
    (link) =>
      InboundLink.make({
        file: link.file,
        line: link.line,
        destination: link.destination,
        rewrittenTo: `https://github.com/${options.repo}/blob/main/${link.target}${fragmentOf(link.destination)}`,
      })
  );
  return ArchivePlanEntry.make({
    root: candidate.root,
    slug: candidate.slug,
    status: candidate.status,
    keep,
    remove,
    inboundLinks: inbound,
    localTreeHash,
  });
});

/**
 * Compute an archive plan's content address: sha-256 of the canonical JSON of
 * the encoded plan without `planId`.
 *
 * **Example** (Build the id effect)
 *
 * ```ts
 * import { archivePlanId } from "@beep/repo-cli/commands/Goals/Archive.service"
 * import * as Effect from "effect/Effect"
 *
 * const id = archivePlanId({ repo: "beep-effect/beep-effect-goals-archive", sourceCommit: "c".repeat(40), entries: [] })
 * console.log(Effect.isEffect(id)) // true
 * ```
 *
 * @param plan - Repo, source commit and entries of the plan.
 * @returns Effect yielding the 64-character hex plan id.
 * @category encoding
 * @since 0.0.0
 */
export const archivePlanId = Effect.fn("Archive.archivePlanId")(function* (plan: {
  readonly repo: ArchiveRepoRef;
  readonly sourceCommit: string;
  readonly entries: ReadonlyArray<ArchivePlanEntry>;
}) {
  const entries = yield* encodePlanEntries(plan.entries).pipe(Effect.orDie);
  return yield* sha256Hex(
    canonicalJsonText({
      schemaVersion: "archive-plan/v1",
      repo: plan.repo,
      sourceCommit: plan.sourceCommit,
      entries,
    })
  );
});

const buildPlan = Effect.fn("Archive.plan")(function* (options: ArchivePlanOptions) {
  const candidates = yield* selectCandidates(options);
  const sourceCommit = yield* runGitOutput(options.repoRoot, ["rev-parse", "HEAD"], gitAdapter(options.repoRoot));
  const links = A.isReadonlyArrayEmpty(candidates) ? A.empty<ScannedLink>() : yield* scanInboundLinks(options.repoRoot);
  const entries = yield* Effect.forEach(candidates, (candidate) => planEntry(options, candidate, links), {
    concurrency: 4,
  });
  const planId = yield* archivePlanId({ repo: options.repo, sourceCommit, entries });
  return ArchivePlan.make({ schemaVersion: "archive-plan/v1", planId, repo: options.repo, sourceCommit, entries });
});

/**
 * Service contract: compute an archive plan without changing anything.
 *
 * **Example** (Describe a plan call)
 *
 * ```ts
 * import type { ArchivePlannerShape } from "@beep/repo-cli/commands/Goals/Archive.service"
 *
 * const planGoals = (planner: ArchivePlannerShape) =>
 *   planner.plan({ kinds: ["goals"], slugs: [], repo: "beep-effect/beep-effect-goals-archive", repoRoot: "." })
 * console.log(planGoals.length) // 1
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface ArchivePlannerShape {
  readonly plan: (options: ArchivePlanOptions) => Effect.Effect<ArchivePlan, ArchiveError>;
}

/**
 * Selects terminal packets and computes their reviewable archive plan.
 *
 * **Example** (Request the planner)
 *
 * ```ts
 * import { ArchivePlanner } from "@beep/repo-cli/commands/Goals/Archive.service"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(Effect.gen(function* () { return yield* ArchivePlanner }))) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ArchivePlanner extends Context.Service<ArchivePlanner, ArchivePlannerShape>()($I`ArchivePlanner`) {}

const makeLive = Effect.gen(function* () {
  const context = yield* Effect.context<
    | FileSystem.FileSystem
    | Path.Path
    | ChildProcessSpawner.ChildProcessSpawner
    | SecureRandom.SecureRandom
    | Digest.Digest
  >();
  return ArchivePlanner.of({ plan: flow(buildPlan, Effect.provide(context)) });
});

/**
 * Working-tree {@link ArchivePlanner}: reads manifests through `FileSystem`,
 * asks git for tracked files and tree hashes, and scans tracked documents for
 * inbound links.
 *
 * **Example** (Build the layer)
 *
 * ```ts
 * import { ArchivePlannerLive } from "@beep/repo-cli/commands/Goals/Archive.service"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(ArchivePlannerLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ArchivePlannerLive = Layer.effect(ArchivePlanner, makeLive);
