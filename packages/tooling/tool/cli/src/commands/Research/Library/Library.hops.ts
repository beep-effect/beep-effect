/**
 * Citation hops: derivation edges per hop and the routed-finding hop-2 admission gate.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { libraryEffectiveCaptures } from "./Library.evidence.ts";
import { classifyLibraryReference, extractLibraryReferences } from "./Library.inventory.ts";
import { LibraryCatalog, LibraryDerivation } from "./Library.schemas.ts";
import { hashBytes } from "./Library.store.ts";
import type { LibraryHopPolicy } from "./Library.hopPolicy.ts";
import type { LibrarySource } from "./Library.schemas.ts";

const $I = $RepoCliId.create("commands/Research/Library/Library.hops");

/**
 * Packet concept a finding can route to, with its liveness under a policy.
 *
 * **Example** (Construct a live concept)
 *
 * ```ts
 * import { LibraryPacketConcept } from "@beep/repo-cli/commands/Research"
 *
 * console.log(LibraryPacketConcept.make({ id: "goals/x", initiativeId: "x", status: "active", live: true }).live)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryPacketConcept extends S.Opaque<LibraryPacketConcept, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String,
    initiativeId: S.String,
    status: S.String,
    live: S.Boolean,
  }).pipe($I.annoteSchema("LibraryPacketConcept", { description: "Goal or exploration concept and liveness." }))
) {}

const GoalManifest = S.fromJsonString(S.Struct({ initiative: S.Struct({ id: S.String, status: S.String }) }));
const ExplorationManifest = S.fromJsonString(S.Struct({ exploration: S.Struct({ slug: S.String, status: S.String }) }));

/**
 * Read goal and exploration packet statuses and classify each as live under the policy.
 *
 * **Example** (Prepare concept discovery)
 *
 * ```ts
 * import { libraryPacketConcepts, LibraryHopPolicy } from "@beep/repo-cli/commands/Research"
 *
 * console.log(libraryPacketConcepts("/repo", LibraryHopPolicy.make({})).pipe !== undefined)
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const libraryPacketConcepts = Effect.fn("Library.packetConcepts")(function* (
  repoRoot: string,
  policy: LibraryHopPolicy
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const concepts: Array<LibraryPacketConcept> = [];
  const read = (kind: string, slug: string) =>
    fs.readFileString(path.join(repoRoot, kind, slug, "ops/manifest.json")).pipe(Effect.option);
  const goals = yield* fs.readDirectory(path.join(repoRoot, "goals")).pipe(Effect.orElseSucceed(A.empty<string>));
  const explorations = yield* fs
    .readDirectory(path.join(repoRoot, "explorations"))
    .pipe(Effect.orElseSucceed(A.empty<string>));
  for (const slug of A.sort(goals, Str.Order)) {
    const decoded = yield* read("goals", slug).pipe(Effect.map(O.flatMap(S.decodeUnknownOption(GoalManifest))));
    if (O.isSome(decoded))
      concepts.push(
        LibraryPacketConcept.make({
          id: `goals/${slug}`,
          initiativeId: decoded.value.initiative.id,
          status: decoded.value.initiative.status,
          live: A.contains(policy.liveGoalStatuses, decoded.value.initiative.status),
        })
      );
  }
  for (const slug of A.sort(explorations, Str.Order)) {
    const decoded = yield* read("explorations", slug).pipe(
      Effect.map(O.flatMap(S.decodeUnknownOption(ExplorationManifest)))
    );
    if (O.isSome(decoded))
      concepts.push(
        LibraryPacketConcept.make({
          id: `explorations/${slug}`,
          initiativeId: decoded.value.exploration.slug,
          status: decoded.value.exploration.status,
          live: !A.contains(policy.closedExplorationStatuses, decoded.value.exploration.status),
        })
      );
  }
  return concepts;
});

const derivationId = (intakeId: string, hopDepth: number, parentId: string, derivedId: string) =>
  hashBytes(new TextEncoder().encode(`${intakeId}\n${hopDepth}\n${parentId}\n${derivedId}`));

const MAX_SCANNED_BYTES = 5_000_000;
const scannedRoles = ["extracted-full-text", "raw-full-text", "transcript-full-text"];
const scannedMediaTypes = ["text/markdown", "text/plain", "text/vtt"];

/**
 * Record hop-1 derivations for every intake and hop-2 identities from readable hop-1 captures.
 *
 * **Details**
 *
 * Every occurrence in an intake document becomes a hop-1 `Derivation` from that hop-0 document.
 * Edge ids hash intake, depth, parent and child, so re-running is idempotent.
 * Every URL in the readable text of a hop-1 capture becomes a catalogued hop-2 `Source` with a
 * hop-2 `Derivation` from its hop-1 parent. Depth lives on the edge; nothing is dropped. GitHub
 * captures are scanned too: the transitivity rule is enforced by the acquisition gate, not here.
 *
 * **Example** (Prepare hop recording)
 *
 * ```ts
 * import { recordLibraryHops } from "@beep/repo-cli/commands/Research"
 *
 * console.log(typeof recordLibraryHops)
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const recordLibraryHops = Effect.fn("Library.recordHops")(function* (
  root: string,
  catalog: LibraryCatalog,
  recordedAt: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  let derivations = HashMap.fromIterable(A.map(catalog.derivations, (item) => [item.id, item] as const));
  let sources = A.fromIterable(catalog.sources);
  let childrenByParent = HashMap.empty<string, ReadonlyArray<LibrarySource>>();
  const known = A.flatMap(catalog.sources, (source) => [source.repository, source.identity]);
  const addDerivation = Effect.fnUntraced(function* (
    intakeId: string,
    hopDepth: number,
    parentId: string,
    derivedId: string,
    rootId: string
  ) {
    const id = yield* derivationId(intakeId, hopDepth, parentId, derivedId);
    if (HashMap.has(derivations, id)) return;
    derivations = HashMap.set(
      derivations,
      id,
      LibraryDerivation.make({ id, derivedId, sourceId: parentId, intakeId, rootId, hopDepth, recordedAt })
    );
  });
  const childrenOf = Effect.fnUntraced(function* (parent: LibrarySource) {
    const cached = HashMap.get(childrenByParent, parent.id);
    if (O.isSome(cached)) return cached.value;
    const current = yield* libraryEffectiveCaptures(root, catalog, parent).pipe(Effect.orElseSucceed(A.empty));
    const readable = A.flatMap(current, (claim) =>
      claim.category === "readable" && claim.capture !== null ? [claim.capture] : []
    );
    const texts = A.flatMap(readable, (capture) =>
      A.filter(
        capture.artifacts,
        (artifact) =>
          A.contains(scannedRoles, artifact.role) &&
          A.contains(scannedMediaTypes, artifact.mediaType) &&
          artifact.bytes <= MAX_SCANNED_BYTES
      )
    );
    const children: Array<LibrarySource> = [];
    for (const artifact of A.dedupeWith(texts, (a, b) => a.sha256 === b.sha256)) {
      const text = yield* fs.readFileString(path.resolve(root, artifact.path)).pipe(Effect.orElseSucceed(() => ""));
      for (const reference of extractLibraryReferences(text, known)) {
        const child = yield* classifyLibraryReference(reference.locator, parent.id);
        if (child.id === parent.id || !A.contains(["external", "project"], child.ownership)) continue;
        if (!A.some(sources, (source) => source.id === child.id || A.contains(source.aliasIds, child.id)))
          sources = A.append(sources, child);
        children.push(
          O.getOrElse(
            A.findFirst(sources, (source) => A.contains(source.aliasIds, child.id)),
            () => child
          )
        );
      }
    }
    const unique = A.dedupeWith(children, (a, b) => a.id === b.id);
    childrenByParent = HashMap.set(childrenByParent, parent.id, unique);
    return unique;
  });
  for (const intake of catalog.intakes) {
    const snapshots = HashSet.fromIterable(A.map(intake.files, (file) => file.snapshotPath));
    const intakeDocuments = HashSet.fromIterable(
      A.map(
        A.filter(catalog.documents, (document) => HashSet.has(snapshots, document.snapshotPath)),
        (document) => document.id
      )
    );
    const hopOne = A.filter(catalog.occurrences, (occurrence) => HashSet.has(intakeDocuments, occurrence.documentId));
    for (const occurrence of hopOne)
      yield* addDerivation(intake.id, 1, occurrence.documentId, occurrence.sourceId, occurrence.documentId);
    for (const occurrence of A.dedupeWith(hopOne, (a, b) => a.sourceId === b.sourceId)) {
      const parent = A.findFirst(catalog.sources, (source) => source.id === occurrence.sourceId);
      if (O.isNone(parent)) continue;
      for (const child of yield* childrenOf(parent.value))
        yield* addDerivation(intake.id, 2, parent.value.id, child.id, occurrence.documentId);
    }
  }
  return LibraryCatalog.make({
    ...catalog,
    sources,
    derivations: derivations.pipe(
      HashMap.values,
      A.fromIterable,
      A.sort(Order.mapInput(Str.Order, (d: LibraryDerivation) => d.id))
    ),
  });
});

/**
 * Minimum hop depth recorded for a source, or none when it has no derivation edge.
 *
 * **Example** (Read a hop depth)
 *
 * ```ts
 * import { librarySourceHopDepth, LibraryCatalog } from "@beep/repo-cli/commands/Research"
 *
 * const catalog = LibraryCatalog.make({ schema: "beep.research.library/v2", documents: [], sources: [], occurrences: [], captures: [], qualifications: [] })
 * console.log(librarySourceHopDepth(catalog, "missing")) // { _tag: "None" }
 * ```
 *
 * @param catalog - Catalog with derivation edges.
 * @param sourceId - Identifier of the source whose derivation edges are read.
 * @returns The minimum `hopDepth` of edges deriving the source.
 * @category utilities
 * @since 0.0.0
 */
export const librarySourceHopDepth: {
  (sourceId: string): (catalog: LibraryCatalog) => O.Option<number>;
  (catalog: LibraryCatalog, sourceId: string): O.Option<number>;
} = dual(
  2,
  (catalog: LibraryCatalog, sourceId: string): O.Option<number> =>
    A.match(
      A.map(
        A.filter(catalog.derivations, (derivation) => derivation.derivedId === sourceId),
        (derivation) => derivation.hopDepth
      ),
      { onEmpty: O.none, onNonEmpty: (depths) => O.some(A.min(depths, Order.Number)) }
    )
);

/**
 * Whether a source is known only as a hop-2 (or deeper) identity: never cited at hop 0 or 1.
 *
 * **Example** (Check a catalogued-only identity)
 *
 * ```ts
 * import { libraryHopTwoOnly, LibraryCatalog } from "@beep/repo-cli/commands/Research"
 *
 * const catalog = LibraryCatalog.make({ schema: "beep.research.library/v2", documents: [], sources: [], occurrences: [], captures: [], qualifications: [] })
 * console.log(libraryHopTwoOnly(catalog, "missing")) // false
 * ```
 *
 * @param catalog - Catalog with occurrences and derivations.
 * @param sourceId - Identifier of the source whose derivation edges are read.
 * @returns True when every derivation of the source is at hop 2 or deeper and no report cites it.
 * @category utilities
 * @since 0.0.0
 */
export const libraryHopTwoOnly: {
  (sourceId: string): (catalog: LibraryCatalog) => boolean;
  (catalog: LibraryCatalog, sourceId: string): boolean;
} = dual(
  2,
  (catalog: LibraryCatalog, sourceId: string): boolean =>
    !A.some(catalog.occurrences, (occurrence) => occurrence.sourceId === sourceId) &&
    O.match(librarySourceHopDepth(catalog, sourceId), { onNone: () => false, onSome: (depth) => depth >= 2 })
);

/**
 * Outcome of the hop-2 gate for one source.
 *
 * **Example** (List gate outcomes)
 *
 * ```ts
 * import { LibraryHopGateReason } from "@beep/repo-cli/commands/Research"
 *
 * console.log(LibraryHopGateReason.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LibraryHopGateReason = LiteralKit([
  "routed-parent",
  "arxiv-on-demand",
  "unrouted-parent",
  "github-not-transitive",
  "arxiv-catalogue-only",
  "domain-cap",
]).pipe($I.annoteSchema("LibraryHopGateReason", { description: "Why the hop-2 gate admitted or refused a source." }));

/**
 * Runtime type of {@link LibraryHopGateReason}.
 *
 * @category models
 * @since 0.0.0
 */
export type LibraryHopGateReason = typeof LibraryHopGateReason.Type;

/**
 * Hop-2 gate decision for one catalogued source.
 *
 * **Example** (Construct a refusal)
 *
 * ```ts
 * import { LibraryHopDecision } from "@beep/repo-cli/commands/Research"
 *
 * const decision = LibraryHopDecision.make({ sourceId: "s", intakeId: "i", domain: "example.org", parentIds: [], admitted: false, reason: "unrouted-parent" })
 * console.log(decision.admitted) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryHopDecision extends S.Opaque<LibraryHopDecision, { readonly brand: unique symbol }>()(
  S.Struct({
    sourceId: S.String,
    intakeId: S.String,
    domain: S.String,
    parentIds: S.Array(S.String),
    admitted: S.Boolean,
    reason: LibraryHopGateReason,
  }).pipe($I.annoteSchema("LibraryHopDecision", { description: "Admission decision for one hop-2 source." }))
) {}

/**
 * Registrable host of a source, lowercased without a leading `www.`.
 *
 * **Example** (Read a domain)
 *
 * ```ts
 * import { librarySourceDomain } from "@beep/repo-cli/commands/Research"
 *
 * console.log(librarySourceDomain("https://www.Example.org/a")) // "example.org"
 * ```
 *
 * @param url - Canonical source URL.
 * @returns Lowercased host, or the empty string for a non-URL.
 * @category utilities
 * @since 0.0.0
 */
export const librarySourceDomain = (url: string) =>
  O.getOrElse(
    O.map(Str.match(/^https?:\/\/([^/?#:]+)/i)(url), (match) =>
      Str.replace(/^www\./, "")(Str.toLowerCase(match[1] ?? ""))
    ),
    () => ""
  );

const isGithub = (source: LibrarySource) => Str.startsWith("github-")(source.kind);
const isArxiv = (source: LibrarySource) => Str.startsWith("arxiv:")(source.identity);

/**
 * Inputs of {@link libraryHopGate}: packet concepts, policy and explicit on-demand selections.
 *
 * @category models
 * @since 0.0.0
 */
export interface LibraryHopGateInput {
  readonly concepts: ReadonlyArray<LibraryPacketConcept>;
  readonly explicit?: ReadonlyArray<string>;
  readonly policy: LibraryHopPolicy;
}

/**
 * Decide which hop-2 sources the next acquisition may fetch.
 *
 * **Details**
 *
 * A hop-2 source is admitted only when a hop-1 parent has a `Finding` whose topics name a live
 * packet concept. GitHub is never transitive: a GitHub child, or a child of a GitHub parent, is
 * refused. arXiv is catalogued only unless `explicit` names it. Every other domain admits at most
 * `domainCap` acquired hop-2 sources per intake, counting sources already captured. Candidates are
 * ordered by canonical URL so the cap is deterministic.
 *
 * **Example** (Gate an empty catalog)
 *
 * ```ts
 * import { libraryHopGate, LibraryHopPolicy, LibraryCatalog } from "@beep/repo-cli/commands/Research"
 *
 * const catalog = LibraryCatalog.make({ schema: "beep.research.library/v2", documents: [], sources: [], occurrences: [], captures: [], qualifications: [] })
 * console.log(libraryHopGate(catalog, { concepts: [], policy: LibraryHopPolicy.make({}) })) // []
 * ```
 *
 * @returns One decision per hop-2-only source.
 * @category use-cases
 * @since 0.0.0
 */
export const libraryHopGate: {
  (input: LibraryHopGateInput): (catalog: LibraryCatalog) => ReadonlyArray<LibraryHopDecision>;
  (catalog: LibraryCatalog, input: LibraryHopGateInput): ReadonlyArray<LibraryHopDecision>;
} = dual(2, (catalog: LibraryCatalog, input: LibraryHopGateInput): ReadonlyArray<LibraryHopDecision> => {
  const { concepts, policy } = input;
  const explicit = input.explicit ?? [];
  const live = HashSet.fromIterable(
    A.flatMap(
      A.filter(concepts, (concept: LibraryPacketConcept) => concept.live),
      (concept: LibraryPacketConcept) => [concept.id, concept.initiativeId]
    )
  );
  const routed = (parent: LibrarySource) =>
    A.some(
      catalog.findings,
      (finding) =>
        (finding.sourceId === parent.id || A.contains(parent.aliasIds, finding.sourceId)) &&
        A.some(finding.topicIds, (topic) => HashSet.has(live, topic))
    );
  const candidates = A.sort(
    A.filter(catalog.sources, (source) => libraryHopTwoOnly(catalog, source.id)),
    Order.mapInput(Str.Order, (source: LibrarySource) => `${source.canonicalUrl}\n${source.id}`)
  );
  let acquired = HashMap.empty<string, number>();
  const intakeOf = (source: LibrarySource) =>
    O.getOrElse(
      A.head(
        A.sort(
          A.map(
            A.filter(catalog.derivations, (d) => d.derivedId === source.id && d.hopDepth === 2),
            (d) => d.intakeId
          ),
          Str.Order
        )
      ),
      () => ""
    );
  const captured = (source: LibrarySource) =>
    A.some(catalog.captures, (capture) => capture.sourceId === source.id && capture.status !== "blocked");
  for (const source of candidates) {
    if (!captured(source) || isGithub(source) || isArxiv(source)) continue;
    const key = `${intakeOf(source)}\n${librarySourceDomain(source.canonicalUrl)}`;
    acquired = HashMap.set(acquired, key, O.getOrElse(HashMap.get(acquired, key), () => 0) + 1);
  }
  return A.map(candidates, (source) => {
    const parentIds = A.dedupe(
      A.map(
        A.filter(catalog.derivations, (d) => d.derivedId === source.id && d.hopDepth === 2),
        (d) => d.sourceId
      )
    );
    const parents = A.filter(catalog.sources, (candidate) => A.contains(parentIds, candidate.id));
    const intakeId = intakeOf(source);
    const domain = librarySourceDomain(source.canonicalUrl);
    const decide = (admitted: boolean, reason: LibraryHopGateReason) =>
      LibraryHopDecision.make({ sourceId: source.id, intakeId, domain, parentIds, admitted, reason });
    if (!policy.githubTransitive && (isGithub(source) || A.some(parents, isGithub)))
      return decide(false, "github-not-transitive");
    if (isArxiv(source))
      return A.contains(explicit, source.id) ? decide(true, "arxiv-on-demand") : decide(false, "arxiv-catalogue-only");
    if (!A.some(parents, routed)) return decide(false, "unrouted-parent");
    if (captured(source)) return decide(true, "routed-parent");
    const key = `${intakeId}\n${domain}`;
    const count = O.getOrElse(HashMap.get(acquired, key), () => 0);
    if (count >= policy.domainCap) return decide(false, "domain-cap");
    acquired = HashMap.set(acquired, key, count + 1);
    return decide(true, "routed-parent");
  });
});
