/**
 * Citation hops: derivation edges per hop and the routed-finding hop-2 admission gate.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
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
import { LibraryHopPolicy } from "./Library.hopPolicy.ts";
import { classifyLibraryReference, extractLibraryReferences } from "./Library.inventory.ts";
import { LibraryCatalog, LibraryDerivation } from "./Library.schemas.ts";
import { hashBytes } from "./Library.store.ts";
import type { LibraryEffectiveCapture } from "./Library.evidence.ts";
import type { LibraryArtifact, LibraryFinding, LibrarySource } from "./Library.schemas.ts";

const $I = $RepoCliId.create("commands/Research/Library/Library.hops");

interface HopIndex {
  readonly captured: HashSet.HashSet<string>;
  readonly findingsBySource: HashMap.HashMap<string, ReadonlyArray<LibraryFinding>>;
  readonly hopTwoBySource: HashMap.HashMap<string, ReadonlyArray<LibraryDerivation>>;
  readonly liveCaptured: HashSet.HashSet<string>;
  readonly minDepth: HashMap.HashMap<string, number>;
  readonly occurrenceSources: HashSet.HashSet<string>;
  readonly sourcesById: HashMap.HashMap<string, LibrarySource>;
}

const groupBy = <A>(items: ReadonlyArray<A>, key: (item: A) => string) => {
  let grouped = HashMap.empty<string, Array<A>>();
  for (const item of items) {
    const existing = HashMap.get(grouped, key(item));
    if (O.isSome(existing)) existing.value.push(item);
    else grouped = HashMap.set(grouped, key(item), [item]);
  }
  return grouped as HashMap.HashMap<string, ReadonlyArray<A>>;
};

// Catalogs are immutable values, so one index per catalog reference serves every per-source lookup.
let lastHopIndex: O.Option<readonly [LibraryCatalog, HopIndex]> = O.none();

const hopIndex = (catalog: LibraryCatalog): HopIndex => {
  if (O.isSome(lastHopIndex) && lastHopIndex.value[0] === catalog) return lastHopIndex.value[1];
  let minDepth = HashMap.empty<string, number>();
  for (const derivation of catalog.derivations) {
    const current = HashMap.get(minDepth, derivation.derivedId);
    if (O.isNone(current) || derivation.hopDepth < current.value)
      minDepth = HashMap.set(minDepth, derivation.derivedId, derivation.hopDepth);
  }
  const index: HopIndex = {
    sourcesById: HashMap.fromIterable(A.map(catalog.sources, (source) => [source.id, source] as const)),
    occurrenceSources: HashSet.fromIterable(A.map(catalog.occurrences, (occurrence) => occurrence.sourceId)),
    minDepth,
    hopTwoBySource: groupBy(
      A.filter(catalog.derivations, (d) => d.hopDepth === 2),
      (d) => d.derivedId
    ),
    captured: HashSet.fromIterable(A.map(catalog.captures, (capture) => capture.sourceId)),
    liveCaptured: HashSet.fromIterable(
      A.map(
        A.filter(catalog.captures, (capture) => capture.status !== "blocked"),
        (capture) => capture.sourceId
      )
    ),
    findingsBySource: groupBy(catalog.findings, (finding) => finding.sourceId),
  };
  lastHopIndex = O.some([catalog, index] as const);
  return index;
};

/**
 * Whether any capture, of any status, is recorded for a source.
 *
 * **Example** (Check for a capture)
 *
 * ```ts
 * import { LibraryCatalog } from "@beep/repo-cli/commands/Research"
 * import { librarySourceHasCapture } from "@beep/repo-cli/commands/Research/Library/Library.hops"
 *
 * const catalog = LibraryCatalog.make({ schema: "beep.research.library/v2", documents: [], sources: [], occurrences: [], captures: [], qualifications: [] })
 * console.log(librarySourceHasCapture(catalog, "missing")) // false
 * ```
 *
 * @internal
 * @param catalog - Catalog with captures.
 * @param sourceId - Source identifier to look up.
 * @returns True when a capture names the source.
 * @category utilities
 * @since 0.0.0
 */
export const librarySourceHasCapture: {
  (sourceId: string): (catalog: LibraryCatalog) => boolean;
  (catalog: LibraryCatalog, sourceId: string): boolean;
} = dual(2, (catalog: LibraryCatalog, sourceId: string): boolean => HashSet.has(hopIndex(catalog).captured, sourceId));

/**
 * Look up a catalog source by its primary id.
 *
 * **Example** (Find a source)
 *
 * ```ts
 * import { LibraryCatalog } from "@beep/repo-cli/commands/Research"
 * import { librarySourceById } from "@beep/repo-cli/commands/Research/Library/Library.hops"
 *
 * const catalog = LibraryCatalog.make({ schema: "beep.research.library/v2", documents: [], sources: [], occurrences: [], captures: [], qualifications: [] })
 * console.log(librarySourceById(catalog, "missing")) // { _tag: "None" }
 * ```
 *
 * @internal
 * @param catalog - Catalog with sources.
 * @param sourceId - Primary source identifier.
 * @returns The source, when catalogued.
 * @category utilities
 * @since 0.0.0
 */
export const librarySourceById: {
  (sourceId: string): (catalog: LibraryCatalog) => O.Option<LibrarySource>;
  (catalog: LibraryCatalog, sourceId: string): O.Option<LibrarySource>;
} = dual(
  2,
  (catalog: LibraryCatalog, sourceId: string): O.Option<LibrarySource> =>
    HashMap.get(hopIndex(catalog).sourcesById, sourceId)
);

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

const scannedArtifacts = (claims: ReadonlyArray<LibraryEffectiveCapture>) =>
  A.dedupeWith(
    A.flatMap(claims, (claim) =>
      claim.category === "readable" && claim.capture !== null
        ? A.filter(
            claim.capture.artifacts,
            (artifact) =>
              A.contains(scannedRoles, artifact.role) &&
              A.contains(scannedMediaTypes, artifact.mediaType) &&
              artifact.bytes <= MAX_SCANNED_BYTES
          )
        : []
    ),
    (a: LibraryArtifact, b: LibraryArtifact) => a.sha256 === b.sha256
  );

const admissibleChild = (parent: LibrarySource, child: LibrarySource) =>
  child.id !== parent.id && A.contains(["external", "project"], child.ownership);

// Every external URL in the readable text of a parent's current captures.
const scanChildren = Effect.fnUntraced(function* (
  root: string,
  catalog: LibraryCatalog,
  parent: LibrarySource,
  known: ReadonlyArray<string>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const claims = yield* libraryEffectiveCaptures(root, catalog, parent).pipe(Effect.orElseSucceed(A.empty));
  const found: Array<LibrarySource> = [];
  for (const artifact of scannedArtifacts(claims)) {
    const text = yield* fs.readFileString(path.resolve(root, artifact.path)).pipe(Effect.orElseSucceed(() => ""));
    for (const reference of extractLibraryReferences(text, known)) {
      const child = yield* classifyLibraryReference(reference.locator, parent.id);
      if (admissibleChild(parent, child)) found.push(child);
    }
  }
  return A.dedupeWith(found, (a, b) => a.id === b.id);
});

const intakeOccurrences = (catalog: LibraryCatalog, intake: LibraryCatalog["intakes"][number]) => {
  const snapshots = HashSet.fromIterable(A.map(intake.files, (file) => file.snapshotPath));
  const documents = HashSet.fromIterable(
    A.map(
      A.filter(catalog.documents, (document) => HashSet.has(snapshots, document.snapshotPath)),
      (document) => document.id
    )
  );
  return A.filter(catalog.occurrences, (occurrence) => HashSet.has(documents, occurrence.documentId));
};

interface HopEdge {
  readonly derivedId: string;
  readonly hopDepth: number;
  readonly intakeId: string;
  readonly parentId: string;
  readonly rootId: string;
}

const mergeDerivations = Effect.fnUntraced(function* (
  existing: ReadonlyArray<LibraryDerivation>,
  edges: ReadonlyArray<HopEdge>,
  recordedAt: string
) {
  let byId = HashMap.fromIterable(A.map(existing, (item) => [item.id, item] as const));
  for (const edge of edges) {
    const id = yield* derivationId(edge.intakeId, edge.hopDepth, edge.parentId, edge.derivedId);
    if (!HashMap.has(byId, id))
      byId = HashMap.set(
        byId,
        id,
        LibraryDerivation.make({
          id,
          derivedId: edge.derivedId,
          sourceId: edge.parentId,
          intakeId: edge.intakeId,
          rootId: edge.rootId,
          hopDepth: edge.hopDepth,
          recordedAt,
        })
      );
  }
  return byId.pipe(HashMap.values, A.fromIterable, A.sort(Order.mapInput(Str.Order, (d: LibraryDerivation) => d.id)));
});

/**
 * Record hop-1 derivations for the named intakes (every intake when omitted) and hop-2 identities from readable hop-1 captures.
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
  recordedAt: string,
  intakeIds?: ReadonlyArray<string>
) {
  // Copy: A.fromIterable returns an array argument as-is, and the input catalog must stay unchanged.
  const sources = [...catalog.sources];
  let childrenByParent = HashMap.empty<string, ReadonlyArray<string>>();
  // Primary ids map to themselves and aliases to their primary, so membership and resolution are lookups.
  let primaryOf = HashMap.fromIterable(
    A.flatMap(catalog.sources, (source) => [
      [source.id, source.id] as const,
      ...A.map(source.aliasIds, (alias) => [alias, source.id] as const),
    ])
  );
  const known = A.flatMap(catalog.sources, (source) => [source.repository, source.identity]);
  const childIds = Effect.fnUntraced(function* (parent: LibrarySource) {
    const cached = HashMap.get(childrenByParent, parent.id);
    if (O.isSome(cached)) return cached.value;
    const found = yield* scanChildren(root, catalog, parent, known);
    for (const child of found)
      if (!HashMap.has(primaryOf, child.id)) {
        sources.push(child);
        primaryOf = HashMap.set(primaryOf, child.id, child.id);
      }
    const ids = A.dedupe(A.map(found, (child) => O.getOrElse(HashMap.get(primaryOf, child.id), () => child.id)));
    childrenByParent = HashMap.set(childrenByParent, parent.id, ids);
    return ids;
  });
  const sourcesById = HashMap.fromIterable(A.map(catalog.sources, (source) => [source.id, source] as const));
  // Only the named intakes are derived: re-deriving historical intakes would rewrite their accounting.
  const wanted = intakeIds === undefined ? O.none() : O.some(HashSet.fromIterable(intakeIds));
  const edges: Array<HopEdge> = [];
  for (const intake of A.filter(catalog.intakes, (item) =>
    O.match(wanted, { onNone: () => true, onSome: HashSet.has(item.id) })
  )) {
    const hopOne = intakeOccurrences(catalog, intake);
    edges.push(
      ...A.map(hopOne, (occurrence) => ({
        intakeId: intake.id,
        hopDepth: 1,
        parentId: occurrence.documentId,
        derivedId: occurrence.sourceId,
        rootId: occurrence.documentId,
      }))
    );
    const parents = A.dedupeWith(hopOne, (a, b) => a.sourceId === b.sourceId);
    for (const occurrence of parents) {
      const parent = HashMap.get(sourcesById, occurrence.sourceId);
      const children = O.isSome(parent) ? yield* childIds(parent.value) : [];
      edges.push(
        ...A.map(children, (derivedId) => ({
          intakeId: intake.id,
          hopDepth: 2,
          parentId: occurrence.sourceId,
          derivedId,
          rootId: occurrence.documentId,
        }))
      );
    }
  }
  const derivations = yield* mergeDerivations(catalog.derivations, edges, recordedAt);
  return LibraryCatalog.make({ ...catalog, sources, derivations });
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
  (catalog: LibraryCatalog, sourceId: string): O.Option<number> => HashMap.get(hopIndex(catalog).minDepth, sourceId)
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
    !HashSet.has(hopIndex(catalog).occurrenceSources, sourceId) &&
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
 * **Example** (Build gate inputs)
 *
 * ```ts
 * import { LibraryHopGateInput, LibraryHopPolicy } from "@beep/repo-cli/commands/Research"
 *
 * console.log(LibraryHopGateInput.make({ concepts: [], policy: LibraryHopPolicy.make({}) }).explicit) // []
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibraryHopGateInput extends S.Opaque<LibraryHopGateInput, { readonly brand: unique symbol }>()(
  S.Struct({
    concepts: S.Array(LibraryPacketConcept),
    policy: LibraryHopPolicy,
    explicit: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultKey(Effect.succeed([]))
    ),
  }).pipe(
    $I.annoteSchema("LibraryHopGateInput", {
      description: "Packet concepts, hop policy and explicit on-demand source ids for one gate evaluation.",
    })
  )
) {}

type GateOutcome = readonly [admitted: boolean, reason: LibraryHopGateReason];

// Refusals and admissions that never depend on the per-domain cap.
const policyOutcome = (
  source: LibrarySource,
  parents: ReadonlyArray<LibrarySource>,
  input: LibraryHopGateInput,
  routed: (parent: LibrarySource) => boolean
): O.Option<GateOutcome> => {
  if (!input.policy.githubTransitive && (isGithub(source) || A.some(parents, isGithub)))
    return O.some([false, "github-not-transitive"]);
  if (isArxiv(source))
    return O.some(A.contains(input.explicit, source.id) ? [true, "arxiv-on-demand"] : [false, "arxiv-catalogue-only"]);
  return A.some(parents, routed) ? O.none() : O.some([false, "unrouted-parent"]);
};

const hopTwoEdges = (catalog: LibraryCatalog, source: LibrarySource): ReadonlyArray<LibraryDerivation> =>
  O.getOrElse(HashMap.get(hopIndex(catalog).hopTwoBySource, source.id), A.empty<LibraryDerivation>);

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
  const live = HashSet.fromIterable(
    A.flatMap(
      A.filter(input.concepts, (concept: LibraryPacketConcept) => concept.live),
      (concept: LibraryPacketConcept) => [concept.id, concept.initiativeId]
    )
  );
  const index = hopIndex(catalog);
  const routed = (parent: LibrarySource) =>
    A.some([parent.id, ...parent.aliasIds], (id) =>
      A.some(O.getOrElse(HashMap.get(index.findingsBySource, id), A.empty<LibraryFinding>), (finding) =>
        A.some(finding.topicIds, (topic) => HashSet.has(live, topic))
      )
    );
  const candidates = A.sort(
    A.filter(catalog.sources, (source) => libraryHopTwoOnly(catalog, source.id)),
    Order.mapInput(Str.Order, (source: LibrarySource) => `${source.canonicalUrl}\n${source.id}`)
  );
  const intakeOf = (source: LibrarySource) =>
    O.getOrElse(
      A.head(
        A.sort(
          A.map(hopTwoEdges(catalog, source), (d) => d.intakeId),
          Str.Order
        )
      ),
      () => ""
    );
  const captured = (source: LibrarySource) => HashSet.has(index.liveCaptured, source.id);
  const capKey = (source: LibrarySource) => `${intakeOf(source)}\n${librarySourceDomain(source.canonicalUrl)}`;
  let acquired = HashMap.empty<string, number>();
  const count = (key: string) => O.getOrElse(HashMap.get(acquired, key), () => 0);
  for (const source of A.filter(candidates, (item) => captured(item) && !isGithub(item) && !isArxiv(item)))
    acquired = HashMap.set(acquired, capKey(source), count(capKey(source)) + 1);
  const capOutcome = (source: LibrarySource): GateOutcome => {
    if (captured(source)) return [true, "routed-parent"];
    const key = capKey(source);
    if (count(key) >= input.policy.domainCap) return [false, "domain-cap"];
    acquired = HashMap.set(acquired, key, count(key) + 1);
    return [true, "routed-parent"];
  };
  return A.map(candidates, (source) => {
    const parentIds = A.dedupe(A.map(hopTwoEdges(catalog, source), (d) => d.sourceId));
    const parents = A.flatMap(parentIds, (id) => A.fromOption(HashMap.get(index.sourcesById, id)));
    const [admitted, reason] = O.getOrElse(policyOutcome(source, parents, input, routed), () => capOutcome(source));
    return LibraryHopDecision.make({
      sourceId: source.id,
      intakeId: intakeOf(source),
      domain: librarySourceDomain(source.canonicalUrl),
      parentIds,
      admitted,
      reason,
    });
  });
});

/**
 * Packet concepts of the enclosing repository, or none when the library runs outside one.
 *
 * **Example** (Prepare concept discovery)
 *
 * ```ts
 * import { libraryLiveConcepts, LibraryHopPolicy } from "@beep/repo-cli/commands/Research"
 *
 * console.log(libraryLiveConcepts(LibraryHopPolicy.make({})).pipe !== undefined)
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const libraryLiveConcepts = Effect.fn("Library.liveConcepts")(function* (policy: LibraryHopPolicy) {
  const repoRoot = yield* findRepoRoot().pipe(Effect.option);
  if (O.isNone(repoRoot)) return A.empty<LibraryPacketConcept>();
  return yield* libraryPacketConcepts(repoRoot.value, policy).pipe(Effect.orElseSucceed(A.empty<LibraryPacketConcept>));
});

/**
 * Ids of hop-2 sources the gate refuses for the next acquisition.
 *
 * **Example** (Prepare refusals)
 *
 * ```ts
 * import { libraryRefusedHopTwo, LibraryCatalog, LibraryHopPolicy } from "@beep/repo-cli/commands/Research"
 *
 * const catalog = LibraryCatalog.make({ schema: "beep.research.library/v2", documents: [], sources: [], occurrences: [], captures: [], qualifications: [] })
 * console.log(libraryRefusedHopTwo(catalog, LibraryHopPolicy.make({}), []).pipe !== undefined)
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const libraryRefusedHopTwo = Effect.fn("Library.refusedHopTwo")(function* (
  catalog: LibraryCatalog,
  policy: LibraryHopPolicy,
  explicit: ReadonlyArray<string>
) {
  if (!A.some(catalog.sources, (source) => libraryHopTwoOnly(catalog, source.id))) return HashSet.empty<string>();
  const concepts = yield* libraryLiveConcepts(policy);
  const decisions = libraryHopGate(catalog, LibraryHopGateInput.make({ concepts, policy, explicit }));
  return HashSet.fromIterable(
    A.map(
      A.filter(decisions, (decision) => !decision.admitted),
      (decision) => decision.sourceId
    )
  );
});
