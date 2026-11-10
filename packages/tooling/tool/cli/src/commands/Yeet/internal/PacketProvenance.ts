/**
 * Detect the active goal and exploration packets a pull request is for.
 *
 * **Details**
 *
 * Detection reads only the branch's own content (its name, its commit
 * messages and its diff against the base), so a primary session, a delegated
 * sub-agent and a Codex lane that publish the same branch name the same
 * packets. A candidate counts only while its committed manifest reads
 * `active` at the branch head or at the merge-base, which keeps a packet that
 * the branch creates or closes.
 *
 * **Gotchas**
 *
 * Every probe is advisory: a git failure, a missing manifest or a manifest
 * that fails to decode contributes no packet and never fails a publish.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Git } from "@beep/git/Git";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { constant, dual, flow, identity, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { PacketRoot, PacketSlug } from "../../Goals/PacketCore/PacketCore.schemas.ts";
import type { CommitLogEntry } from "@beep/git/Git";

const $I = $RepoCliId.create("commands/Yeet/internal/PacketProvenance");

/**
 * Evidence linking a pull request to a packet.
 *
 * **Details**
 *
 * `branch` means the branch name carries the packet slug, `commit` means a
 * commit message on the branch names `goals/<slug>` or `explorations/<slug>`,
 * and `diff` means the branch changes files inside the packet directory.
 *
 * **Example** (Recognize a source)
 *
 * ```ts
 * import { PrProvenancePacketSource } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(PrProvenancePacketSource.literals) // ["branch", "commit", "diff"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PrProvenancePacketSource = LiteralKit(["branch", "commit", "diff"]).pipe(
  $I.annoteSchema("PrProvenancePacketSource", { description: "Evidence linking a pull request to a packet." })
);

/**
 * Evidence kind decoded by {@link PrProvenancePacketSource}.
 *
 * **Example** (Annotate a source)
 *
 * ```ts
 * import type { PrProvenancePacketSource } from "@beep/repo-cli/test/Yeet"
 *
 * const source: PrProvenancePacketSource = "diff"
 * console.log(source) // "diff"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type PrProvenancePacketSource = typeof PrProvenancePacketSource.Type;

/**
 * An active goal or exploration packet a pull request is for, with its evidence.
 *
 * **Details**
 *
 * The root and slug name a public repository directory, so the value may
 * cross into the public PR footer. `sources` is non-empty and kept in
 * {@link PrProvenancePacketSource} order.
 *
 * **Example** (Construct a packet reference)
 *
 * ```ts
 * import { PrProvenancePacket } from "@beep/repo-cli/test/Yeet"
 *
 * const packet = PrProvenancePacket.make({ root: "goals", slug: "agent-memory-store", sources: ["branch", "diff"] })
 * console.log(packet.slug) // "agent-memory-store"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PrProvenancePacket extends S.Opaque<PrProvenancePacket, { readonly brand: unique symbol }>()(
  S.Struct({
    root: PacketRoot,
    slug: PacketSlug,
    sources: S.Array(PrProvenancePacketSource).check(S.isMinLength(1)),
  }).pipe(
    $I.annoteSchema("PrProvenancePacket", {
      description: "Active goal or exploration packet a pull request is for, with its evidence.",
    })
  )
) {}

/**
 * Bound on packets listed by name in a public footer; the rest are counted.
 *
 * **Example** (Read the bound)
 *
 * ```ts
 * import { PUBLIC_PACKET_LIMIT } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(PUBLIC_PACKET_LIMIT) // 6
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const PUBLIC_PACKET_LIMIT = 6;

/**
 * Render a packet's repository directory.
 *
 * **Example** (Render a goal directory)
 *
 * ```ts
 * import { packetPath, PrProvenancePacket } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(packetPath(PrProvenancePacket.make({ root: "goals", slug: "hold-ledger", sources: ["diff"] })))
 * // "goals/hold-ledger"
 * ```
 *
 * @param packet - Packet whose root and slug form the directory.
 * @returns The repository-relative packet directory.
 * @category formatting
 * @since 0.0.0
 */
export const packetPath = (packet: Pick<PrProvenancePacket, "root" | "slug">): string =>
  `${packet.root}/${packet.slug}`;

const sourceRank = PrProvenancePacketSource.match({ branch: () => 0, commit: () => 1, diff: () => 2 });
const sourceOrder = Order.mapInput(Order.Number, sourceRank);
const packetOrder: Order.Order<PrProvenancePacket> = Order.combine(
  Order.mapInput(Order.Number, (packet: PrProvenancePacket) =>
    pipe(
      packet.sources,
      A.map(sourceRank),
      A.reduce(Number.POSITIVE_INFINITY, (best, rank) => Math.min(best, rank))
    )
  ),
  Order.mapInput(Str.Order, (packet: PrProvenancePacket) => packetPath(packet))
);
const samePacket = (
  left: Pick<PrProvenancePacket, "root" | "slug">,
  right: Pick<PrProvenancePacket, "root" | "slug">
): boolean => packetPath(left) === packetPath(right);

/**
 * Merge packet evidence by directory, then rank strongest evidence first.
 *
 * **Details**
 *
 * Entries naming the same directory collapse into one with the union of their
 * sources. Packets named by the branch rank first, then packets named by a
 * commit, then packets only the diff touched; ties sort by directory.
 *
 * **Example** (Merge two observations of one packet)
 *
 * ```ts
 * import { mergePrProvenancePackets, PrProvenancePacket } from "@beep/repo-cli/test/Yeet"
 *
 * const merged = mergePrProvenancePackets([
 *   PrProvenancePacket.make({ root: "goals", slug: "hold-ledger", sources: ["diff"] }),
 *   PrProvenancePacket.make({ root: "goals", slug: "hold-ledger", sources: ["branch"] }),
 * ])
 * console.log(merged[0]?.sources) // ["branch", "diff"]
 * ```
 *
 * @param packets - Packet observations, possibly repeating a directory.
 * @returns One ranked entry per directory.
 * @category projections
 * @since 0.0.0
 */
export const mergePrProvenancePackets = (
  packets: ReadonlyArray<PrProvenancePacket>
): ReadonlyArray<PrProvenancePacket> =>
  pipe(
    packets,
    A.dedupeWith(samePacket),
    A.map((first) =>
      PrProvenancePacket.make({
        root: first.root,
        slug: first.slug,
        sources: pipe(
          A.filter(packets, (packet) => samePacket(packet, first)),
          A.flatMap((packet) => packet.sources),
          A.dedupe,
          A.sort(sourceOrder)
        ),
      })
    ),
    A.sort(packetOrder)
  );

const decodePacketRoot = S.decodeUnknownOption(PacketRoot);
const decodePacketSlug = S.decodeUnknownOption(PacketSlug);

/**
 * Parse the packet directory a repository-relative path lies inside.
 *
 * **Details**
 *
 * Only paths at least one level inside `goals/<slug>/` or
 * `explorations/<slug>/` name a packet; files directly under a root (such as
 * `goals/INDEX.md`) and template placeholders such as `goals/<slug>` do not.
 *
 * **Example** (Parse a packet file)
 *
 * ```ts
 * import { packetFromPath } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * console.log(O.isSome(packetFromPath("goals/hold-ledger/PLAN.md"))) // true
 * console.log(O.isSome(packetFromPath("goals/INDEX.md"))) // false
 * ```
 *
 * @param relativePath - Repository-relative path with forward slashes.
 * @returns The packet root and slug, when the path lies inside a packet.
 * @category parsing
 * @since 0.0.0
 */
export const packetFromPath = (
  relativePath: string
): O.Option<{ readonly root: PacketRoot; readonly slug: PacketSlug }> => {
  const segments = Str.split(relativePath, "/");
  if (A.length(segments) < 3) return O.none();
  return O.all({
    root: O.flatMap(A.get(segments, 0), decodePacketRoot),
    slug: O.flatMap(A.get(segments, 1), decodePacketSlug),
  });
};

/**
 * Whether a branch name carries a packet slug.
 *
 * **Details**
 *
 * The branch is split on `/`. A segment equal to the slug always matches. A
 * slug with at least two hyphenated words also matches as a whole-word run
 * inside a segment (`goals/agent-memory-store-p0`, `fix/ep9-hold-ledger`);
 * a one-word slug must fill a segment so `fix/ledger-copy` never names a
 * `ledger` packet.
 *
 * **Example** (Match a lane branch)
 *
 * ```ts
 * import { branchNamesPacket } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(branchNamesPacket("goals/agent-memory-store-p0", "agent-memory-store")) // true
 * console.log(branchNamesPacket("fix/ledger-copy", "ledger")) // false
 * ```
 *
 * @param branch - Branch name to inspect.
 * @param slug - Packet slug to look for.
 * @returns `true` when a branch segment carries the slug.
 * @category parsing
 * @since 0.0.0
 */
export const branchNamesPacket: {
  (slug: string): (branch: string) => boolean;
  (branch: string, slug: string): boolean;
} = dual(2, (branch: string, slug: string): boolean =>
  A.some(
    Str.split(branch, "/"),
    (segment) => segment === slug || (Str.includes("-")(slug) && Str.includes(`-${slug}-`)(`-${segment}-`))
  )
);

const commitPacketPattern = /(?<![\w./-])(goals|explorations)\/([a-z0-9][a-z0-9-]*)(?![\w-])/gu;

/**
 * Packet directories a commit message names.
 *
 * **Details**
 *
 * A mention is `goals/<slug>` or `explorations/<slug>` standing as its own
 * token, so a `Packet: goals/<slug>` trailer works as an explicit binding.
 * Paths embedded in a longer path (`docs/goals/x`) are not mentions.
 *
 * **Example** (Read a commit trailer)
 *
 * ```ts
 * import { packetsNamedByMessage } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(packetsNamedByMessage("feat: p1\n\nPacket: goals/agent-memory-store"))
 * // [{ root: "goals", slug: "agent-memory-store" }]
 * ```
 *
 * @param message - Commit subject and body.
 * @returns Each named packet once, in order of first mention.
 * @category parsing
 * @since 0.0.0
 */
export const packetsNamedByMessage = (
  message: string
): ReadonlyArray<{ readonly root: PacketRoot; readonly slug: PacketSlug }> =>
  pipe(
    A.fromIterable(Str.matchAll(commitPacketPattern)(message)),
    A.map((match) => packetFromPath(`${match[1]}/${match[2]}/`)),
    A.getSomes,
    A.dedupeWith(samePacket)
  );

// A manifest is active only when it decodes against the literal; any other
// status, a missing key or malformed JSON is simply not active.
const ActiveGoalManifest = S.Struct({ lifecycle: S.tag("active") });
const ActiveExplorationManifest = S.Struct({ exploration: S.Struct({ status: S.tag("active") }) });
const isActiveGoalManifest = flow(S.decodeUnknownOption(S.fromJsonString(ActiveGoalManifest)), O.isSome);
const isActiveExplorationManifest = flow(S.decodeUnknownOption(S.fromJsonString(ActiveExplorationManifest)), O.isSome);

/**
 * Whether a packet manifest's JSON text reads active.
 *
 * **Details**
 *
 * Goals are active when `lifecycle` is `active`; explorations when
 * `exploration.status` is `active`.
 *
 * **Example** (Check a goal manifest)
 *
 * ```ts
 * import { isActivePacketManifest } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(isActivePacketManifest("goals", JSON.stringify({ lifecycle: "active" }))) // true
 * console.log(isActivePacketManifest("goals", JSON.stringify({ lifecycle: "paused" }))) // false
 * ```
 *
 * @param root - Packet root deciding which manifest shape applies.
 * @param manifest - Raw `ops/manifest.json` text.
 * @returns `true` only for a decodable active manifest.
 * @category predicates
 * @since 0.0.0
 */
export const isActivePacketManifest: {
  (manifest: string): (root: PacketRoot) => boolean;
  (root: PacketRoot, manifest: string): boolean;
} = dual(2, (root: PacketRoot, manifest: string): boolean =>
  PacketRoot.match(root, {
    goals: () => isActiveGoalManifest(manifest),
    explorations: () => isActiveExplorationManifest(manifest),
  })
);

const isActiveAt = Effect.fn("PacketProvenance.isActiveAt")(function* (
  cwd: string,
  ref: string,
  packet: { readonly root: PacketRoot; readonly slug: PacketSlug }
) {
  const git = yield* Git;
  return yield* git
    .show(cwd, ref, `${packetPath(packet)}/ops/manifest.json`)
    .pipe(
      Effect.map(O.exists((manifest) => isActivePacketManifest(packet.root, manifest))),
      Effect.orElseSucceed(constant(false))
    );
});

const none = constant(A.empty<never>());
// Every packet carries `ops/manifest.json`, so those blobs name each packet
// directory. `git ls-tree` takes pathspecs literally (no globs), hence the
// root prefixes and the suffix filter.
const isPacketManifestPath = (path: string): boolean =>
  A.length(Str.split(path, "/")) === 4 && Str.endsWith("/ops/manifest.json")(path);

// The branch's own non-merge commits: those on the first-parent chain from
// the merge-base. Commits a merge of the base brought in are not the
// branch's, which keeps a stale base ref from crediting another lane's
// packets. When the first-parent walk fails every non-merge commit counts.
const ownCommits = Effect.fn("PacketProvenance.ownCommits")(function* (cwd: string, mergeBase: string) {
  const git = yield* Git;
  const range = `${mergeBase}..HEAD`;
  const firstParent = yield* git
    .revList(cwd, range, { firstParent: true })
    .pipe(Effect.map(HashSet.fromIterable), Effect.option);
  const entries = yield* git
    .log(cwd, { revisions: [range], includeBody: true, noMerges: true })
    .pipe(Effect.orElseSucceed(constant(A.empty<CommitLogEntry>())));
  return O.match(firstParent, {
    onNone: constant(entries),
    onSome: (shas) => A.filter(entries, (entry) => HashSet.has(shas, entry.sha)),
  });
});

/**
 * Detect the active packets a branch is for, strongest evidence first.
 *
 * **Details**
 *
 * The merge-base of `HEAD` and `base` bounds the diff and the commit walk.
 * Only the branch's own non-merge commits on its first-parent chain count:
 * their messages give `commit` evidence, and a file in the net diff gives
 * `diff` evidence only when one of them touched it, so commits a merge of
 * the base brought in credit nothing even when `base` is stale. Branch
 * matching considers every packet directory with a manifest at `HEAD`. Each
 * candidate is kept when its committed manifest reads active at `HEAD` or at
 * the merge-base.
 *
 * **Example** (Build the detection effect)
 *
 * ```ts
 * import { detectActivePackets } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(detectActivePackets("/worktrees/lane", "origin/main", "goals/hold-ledger-p1"))) // true
 * ```
 *
 * @param cwd - Checkout whose `HEAD` is the pull request head.
 * @param base - Base ref the pull request merges into.
 * @param branch - Branch name of the pull request.
 * @returns Ranked active packets; empty when nothing matches or a probe fails.
 * @category detection
 * @since 0.0.0
 */
export const detectActivePackets = Effect.fn("PacketProvenance.detectActivePackets")(function* (
  cwd: string,
  base: string,
  branch: string
) {
  const git = yield* Git;
  const mergeBase = yield* git.mergeBaseOption(cwd, base, "HEAD").pipe(Effect.orElseSucceed(O.none<string>));
  const fromBranch = yield* git.lsTree(cwd, "HEAD", { pathspec: ["goals/", "explorations/"], fullTree: true }).pipe(
    Effect.map(
      flow(
        A.filter((entry) => entry.type === "blob" && isPacketManifestPath(entry.path)),
        A.map((entry) => packetFromPath(entry.path)),
        A.getSomes
      )
    ),
    Effect.map(A.filter((packet) => branchNamesPacket(branch, packet.slug))),
    Effect.orElseSucceed(none)
  );
  const own = O.isNone(mergeBase) ? A.empty<CommitLogEntry>() : yield* ownCommits(cwd, mergeBase.value);
  const ownPaths = HashSet.fromIterable(A.flatMap(own, (entry) => entry.paths));
  const fromDiff = O.isNone(mergeBase)
    ? A.empty<{ root: PacketRoot; slug: PacketSlug }>()
    : yield* git
        .changedFiles(cwd, {
          base: mergeBase.value,
          head: "HEAD",
          twoDot: true,
          pathspec: ["goals/", "explorations/"],
        })
        .pipe(
          Effect.map(
            flow(
              A.filter((path) => HashSet.has(ownPaths, path)),
              A.map(packetFromPath),
              A.getSomes
            )
          ),
          Effect.orElseSucceed(none)
        );
  const fromCommits = A.flatMap(own, (entry) =>
    pipe([entry.subject, entry.body], A.filter(P.isString), A.join("\n\n"), packetsNamedByMessage)
  );
  const tagged = (source: PrProvenancePacketSource) =>
    A.map((packet: { readonly root: PacketRoot; readonly slug: PacketSlug }) =>
      PrProvenancePacket.make({ root: packet.root, slug: packet.slug, sources: [source] })
    );
  const candidates = mergePrProvenancePackets([
    ...tagged("branch")(fromBranch),
    ...tagged("commit")(fromCommits),
    ...tagged("diff")(fromDiff),
  ]);
  return yield* Effect.filter(candidates, (packet) =>
    isActiveAt(cwd, "HEAD", packet).pipe(
      Effect.filterOrElse(identity, () =>
        O.match(mergeBase, {
          onNone: () => Effect.succeed(false),
          onSome: (ref) => isActiveAt(cwd, ref, packet),
        })
      )
    )
  );
});
