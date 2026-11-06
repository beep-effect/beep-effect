/**
 * Filter-first graph projection and guarded JSON export.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as OptionUtils from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { KbError } from "./Kb.errors.ts";
import { hasKbCanary } from "./Kb.projection.ts";
import { KbLedger, selectKb } from "./Kb.service.ts";
import {
  KbGraph,
  KbGraphAssertion,
  KbGraphClaim,
  KbGraphLink,
  KbGraphNode,
  KbRegistryNode,
} from "./KbGraph.schemas.ts";
import type { Assertion, Audience, KbClaim, KbView } from "./Kb.schemas.ts";
import type { KbGraphConfidence, KbGraphReview } from "./KbGraph.schemas.ts";

const encodeGraphJson = S.encodeEffect(S.fromJsonString(KbGraph, { space: 2 }));

const $I = $RepoCliId.create("commands/Kb/KbGraph.service");
const byId = Order.mapInput(Str.Order, (row: { readonly id: string }) => row.id);
const audienceDefault: Audience = "public";
const audienceRank = { public: 0, personal: 1, internal: 2 };
const primaryCaptureKinds = HashSet.make(
  "web",
  "wayback",
  "wacz",
  "youtube",
  "linkedin",
  "x",
  "github",
  "registry",
  "git"
);
/**
 * Derive viewer confidence from the selected evidence only, so an outward graph never borrows strength from
 * withheld assertions. Verified: an accepted, captured assertion from a primary capture. Reported: accepted
 * evidence only from statements (self-report, chat, session, internal files) or evidence still pending.
 * Inferred: no accepted or pending evidence.
 *
 * @param evidence - The assertions selected for the claim in the current view.
 * @returns The viewer confidence tier for that evidence.
 */
const confidenceOf = (evidence: ReadonlyArray<Assertion>): KbGraphConfidence => {
  const accepted = A.filter(evidence, (a) => a.review === "accepted" && a.outcome === "captured");
  if (A.some(accepted, (a) => HashSet.has(primaryCaptureKinds, a.sourceRef.kind))) return "verified";
  return A.isReadonlyArrayNonEmpty(accepted) || A.some(evidence, (a) => a.review === "pending")
    ? "reported"
    : "inferred";
};
const isHttpUrl = (value: string): boolean => Str.startsWith("https://")(value) || Str.startsWith("http://")(value);
/** Outward graphs never expose capture-system locators (local paths); a public URL or the derivation basis stands in. */
const basisLabel = { "public-source": "public source", "own-public-work": "own public work", none: "self-report" };
const review = Match.type<KbClaim["review"]>().pipe(
  Match.tagsExhaustive({
    Proposed: (): KbGraphReview => "proposed",
    Accepted: (): KbGraphReview => "accepted",
    Rejected: (): KbGraphReview => "disputed",
    Disputed: (): KbGraphReview => "disputed",
    Retracted: (): KbGraphReview => "retracted",
  })
);

/**
 * Graph file export contract with captured platform dependencies.
 * **Example** (Access the service)
 * ```ts
 * import { KbGraphExport } from "@beep/repo-cli/commands/Kb"
 * console.log(KbGraphExport.key)
 * ```
 * @category services
 * @since 0.0.0
 */
export class KbGraphExport extends Context.Service<
  KbGraphExport,
  {
    readonly write: (root: string, view: KbView, out: string, force: boolean) => Effect.Effect<KbGraph, KbError>;
  }
>()($I`KbGraphExport`) {}

/**
 * Construct the exporter with the shared disclosure filter and canary check.
 * **Details**
 * Rejected claims map to disputed in the viewer vocabulary. Confidence is derived from the selected evidence:
 * verified (accepted primary capture), reported (statements or pending evidence), inferred (no evidence).
 * Assertion URLs fall back to the derivation reference; outward locators are public URLs or the derivation basis.
 * Both views show only current claim versions; superseded versions remain in the RDF history.
 * Capture dates fall back to claim recording dates. builtAt is the latest selected
 * recording date (epoch when empty), so identical ledgers produce identical bytes.
 * **Example** (Construct the service effect)
 * ```ts
 * import { makeKbGraphExport } from "@beep/repo-cli/commands/Kb"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.isEffect(makeKbGraphExport))
 * ```
 * @category services
 * @since 0.0.0
 */
export const makeKbGraphExport = Effect.gen(function* () {
  const ledger = yield* KbLedger;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const project = Effect.fn("KbGraph.project")(function* (root: string, view: KbView) {
    const loaded = yield* ledger.read(root);
    if (!loaded.report.valid) return yield* KbError.make({ message: "Ledger validation failed; run kb validate" });
    const registry = yield* ledger.readRegistry(root);
    const metadata = HashMap.fromIterable(A.map(registry, (node) => Tuple.make(node.id, node)));
    const selected = selectKb(loaded.claims, loaded.assertions, view);
    // The graph is a current-state view in both disclosures; superseded versions stay in the N-Quads history.
    const superseded = HashSet.fromIterable(A.getSomes(A.map(loaded.claims, (c) => c.supersedes)));
    const current = A.filter(selected.claims, (c) => !HashSet.has(superseded, c.id));
    let nodes = HashMap.empty<string, KbGraphNode>();
    let claims = A.empty<readonly [string, KbGraphClaim]>();
    let links = A.empty<KbGraphLink>();
    let builtAt = "1970-01-01T00:00:00.000Z";
    for (const c of A.sort(current, byId)) {
      const evidence = A.sort(
        A.filter(selected.assertions, (a) => a.claimId === c.id),
        byId
      );
      const audience: Audience = A.reduce(
        evidence,
        audienceDefault,
        (strictest: Audience, a): Audience =>
          audienceRank[a.audience] > audienceRank[strictest] ? a.audience : strictest
      );
      const recordedAt = DateTime.formatIso(c.knowledge.recordedAt);
      if (recordedAt > builtAt) builtAt = recordedAt;
      const disposition = review(c.review);
      const confidence = confidenceOf(evidence);
      const assertions = A.map(evidence, (a) => {
        const url = A.findFirst([a.sourceRef.locator, a.derivation.ref], isHttpUrl);
        return KbGraphAssertion.make({
          quote: a.quote,
          sourceKind: a.sourceRef.kind,
          locator: view === "outward" ? O.getOrElse(url, () => basisLabel[a.derivation.basis]) : a.sourceRef.locator,
          ...OptionUtils.getSomesStruct({ url }),
          audience: a.audience,
          capturedAt: recordedAt,
        });
      });
      claims = A.append(
        claims,
        Tuple.make(c.id, KbGraphClaim.make({ text: c.proposition.text, review: disposition, confidence, assertions }))
      );
      const p = c.proposition;
      links = A.append(
        links,
        KbGraphLink.make({
          id: `edge/${c.id}`,
          source: p.subject,
          target: p.object,
          predicate: `kb:${p._tag}`,
          label: Str.toLowerCase(Str.replace(/([a-z])([A-Z])/g, "$1 $2")(p._tag)),
          claimId: c.id,
          audience,
          review: disposition,
          confidence,
          ...(c.validTime._tag === "Interval"
            ? {
                validFrom: DateTime.formatIso(c.validTime.validFrom),
                ...OptionUtils.getSomesStruct({ validTo: O.map(c.validTime.validTo, DateTime.formatIso) }),
              }
            : {}),
        })
      );
      for (const id of HashSet.make(p.subject, p.object)) {
        const previous = HashMap.get(nodes, id);
        const meta = O.getOrElse(HashMap.get(metadata, id), () =>
          KbRegistryNode.make({ id, type: "Concept", label: id })
        );
        const claimIds = previous.pipe(
          O.map((n) => n.claimIds),
          O.getOrElse(() => []),
          HashSet.fromIterable,
          HashSet.add(c.id),
          A.fromIterable,
          A.sort(Str.Order)
        );
        const strictest = O.map(previous, (n) =>
          audienceRank[n.audience] > audienceRank[audience] ? n.audience : audience
        ).pipe(O.getOrElse(() => audience));
        nodes = HashMap.set(nodes, id, KbGraphNode.make({ ...meta, audience: strictest, claimIds }));
      }
    }
    const sortedNodes = nodes.pipe(HashMap.values, A.fromIterable, A.sort(byId));
    return KbGraph.make({
      view,
      builtAt,
      stats: { nodes: A.length(sortedNodes), links: A.length(links), claims: A.length(claims) },
      nodes: sortedNodes,
      links: A.sort(links, byId),
      claims: R.fromEntries(claims),
    });
  });
  const canaryFailed = (where: string) => KbError.make({ message: `Outward canary check failed${where}` });
  // The graph output must never resolve to one of the ledger inputs.
  const refuseLedgerTarget = Effect.fnUntraced(function* (root: string, actual: string) {
    for (const name of ["claims.jsonl", "assertions.jsonl", "registry.jsonl"]) {
      const source = path.join(root, name);
      if ((yield* fs.exists(source)) && (yield* fs.realPath(source)) === actual)
        return yield* KbError.make({ message: "Graph output cannot replace ledger input" });
    }
  });
  // True when the target already holds these bytes; a differing nonempty target needs --force.
  const isUnchanged = Effect.fnUntraced(function* (target: string, json: string, force: boolean) {
    const old = yield* fs.readFileString(target);
    if (old === json) return true;
    if (Str.isNonEmpty(old) && !force)
      return yield* KbError.make({ message: "Output differs and is nonempty; use --force" });
    return false;
  });
  const requireNoCanaryOnDisk = Effect.fnUntraced(function* (target: string) {
    const written = yield* fs.readFileString(target);
    if (hasKbCanary({ "graph.json": written })) return yield* canaryFailed(" on disk");
  });
  return KbGraphExport.of({
    write: Effect.fn("KbGraphExport.write")(
      function* (root, view, out, force) {
        const graph = yield* project(root, view);
        const json = `${yield* encodeGraphJson(graph)}\n`;
        const outward = view === "outward";
        if (outward && hasKbCanary({ "graph.json": json })) return yield* canaryFailed("");
        const target = path.resolve(out);
        const targetExists = yield* fs.exists(target);
        const actual = targetExists ? yield* fs.realPath(target) : target;
        yield* refuseLedgerTarget(root, actual);
        if (targetExists && (yield* isUnchanged(target, json, force))) return graph;
        yield* fs.makeDirectory(path.dirname(target), { recursive: true });
        yield* fs.writeFileString(target, json);
        if (outward) yield* requireNoCanaryOnDisk(target);
        return graph;
      },
      Effect.mapError((error) =>
        S.is(KbError)(error) ? error : KbError.make({ message: "Cannot export knowledge graph" })
      )
    ),
  });
});
