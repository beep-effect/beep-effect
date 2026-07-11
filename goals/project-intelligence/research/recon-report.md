# Reconnaissance Report (P0)

Date: 2026-07-11. This report records the two P0 reconnaissance obligations
from [`PLAN.md`](../PLAN.md): the freshness re-check of the pre-seeded repo
reconnaissance in [`recon-findings.md`](./recon-findings.md), and the corpus
reconnaissance performed inside the operator-provided, session-only, read-only
allowlist (PLAN "P0 preflight"). Per SPEC D2 the allowlist itself is never
committed; this report names its two locations only by sanitized logical
category: the operator projects collection and the operator knowledge vault
(including the prototype catalog). Corpus measurements are deliberately
coarsened to non-identifying magnitudes — precise inventory, timestamps, and
per-domain tallies are operator-corpus specifics that D2 keeps out of the
public packet.

## Freshness re-check (repo side)

The recorded freshness commands from `recon-findings.md` were executed on
2026-07-11 on the P0 branch (base: `main`, commit `c63d23c1b4`; the recon
baseline was recorded at `53f5bb53a2`). Results against the recorded
baselines:

| Probe | Baseline expectation | 2026-07-11 result | Drift |
| --- | --- | --- | --- |
| `ls packages/drivers` | no github entry | 41 drivers, no github entry | none |
| octokit / GitHub API probe (drivers) | empty (exit 1) | empty (exit 1) | none |
| watchlist probe (packages, apps) | empty (exit 1) | empty (exit 1) | none |
| daily-brief probe (packages, apps) | empty (exit 1) | empty (exit 1) | none |
| cron/scheduler/systemd probe | 11 hits, all `packages/tooling/**` | same 11 files, all `packages/tooling/**` | none |
| mem0/pgvector probe | exactly one hit: VersionSync `DockerResolver.ts` | same single hit | none |
| `ls goals explorations` | this packet is the only research-intelligence packet | confirmed | none |

Spot-checks of the non-mechanical Section C negatives (the recon scope note
says these are not covered by the recorded commands):

- No Cognee, Graphiti, or GitHub driver directory exists under
  `packages/drivers`.
- No `GuardedHttpClient` or prompt-injection implementation exists in
  `packages/**/src`; the ingestion-security capabilities remain exploration
  doctrine (`explorations/ingestion-security-secret-governance`), with
  `SafeRemoteHost` as the shipped exception
  (`packages/foundation/modeling/schema/src/SafeRemoteHost.ts`).
- A license-policy probe over `packages/**/src` returns only IANA media-type
  data noise; no dependency/license-compliance policy surface exists.

Verdict: **no material drift**. `recon-findings.md` remains authoritative and
no resurvey was performed. During P0 artifact authoring, deeper source reads
refined four recon statements; each refinement is recorded in the owning
artifact's "Recon corrections" section rather than duplicated here:
[`prototype-disposition.md`](./prototype-disposition.md) (prototype
"immutability" is deduplication intent, not snapshot immutability; AI-metrics
timer install is render-only), [`technology-adr.md`](./technology-adr.md)
(Cognee/Graphiti client surfaces now resolved; TrustGraph packets paused),
[`architecture-proposal.md`](./architecture-proposal.md) (courtlistener driver
is metadata-only — govinfo is the implemented triad template; the law-practice
slice is a live end-to-end consumer of the epistemic mechanism), and
[`product-definition.md`](./product-definition.md) (no corrections required).

## Corpus reconnaissance

### Method and sampling record

A delegated read-only agent swept the two allowlisted locations on 2026-07-11
under these binding caps: directory listings plus README/package metadata for
the projects collection (cap 40 items); YAML frontmatter only (never card
bodies) for up to the 100 most recent knowledge-vault cards; digest titles and
headings only (cap 10); no env/secret/key files; no node_modules, VCS
internals, or build outputs; no usernames or handles collected; x-posts
reported as counts only. Only sanitized aggregates left the session, and this
report further coarsens them to non-identifying magnitudes.

- Operator projects collection: a modest set of independent project items,
  well under the sampling cap (all checkouts of this repository grouped as one
  item and not deep-read). Roughly half supplied package metadata, most of the
  rest README metadata, and a small remainder had neither.
- Operator knowledge vault (after excluding placeholders and a handful of
  credential-suggestive filenames, skipped unread): on the order of a thousand
  cards overall. The inbox holds the large majority (over four-fifths); a
  low-hundreds repository-source collection, a small x-post collection, a
  single article card, and a small set of daily digests make up the rest.
- Recent-card sample: the 100 newest cards (by modification time) all came
  from the inbox; all had valid frontmatter with generic `link` source type
  and `inbox` status; none had tags; all were captured within the few days
  preceding the sweep.
- Digest sample: all available digests (under the cap), spanning roughly the
  week preceding the sweep.
- The prototype catalog was not queried: no DuckDB CLI was available in the
  session. Catalog-level aggregates remain unresolved (below).

### Recurring topics (ranked, overlapping title-keyword bins over the sample)

1. Knowledge and research systems (about a quarter of the sample)
2. Agent memory and persistence (about a quarter)
3. Decentralized knowledge infrastructure (nearly a fifth)
4. Web UI, components, and browser tooling (about a tenth)
5. AI agents and agent tooling (under a tenth)
6. Legal NLP and legal knowledge (under a tenth)
7. Ontologies and semantic-web technology (under a tenth)
8. TypeScript and Effect (a few cards)
9. Data modeling and protocols (a few cards)
10. Voice and multimodal interfaces (a couple of cards)
11. Local-first or edge execution (isolated)

Capture-host frequency reinforces the ranking: GitHub is the dominant host at
roughly a third of recent captures; vendor documentation for OriginTrail and
Mem0 recurs heavily; OpenClaw documentation, X, npm, Lit, Cognee, RDFJS, and
OASIS documentation appear repeatedly at smaller scale.

### Named technologies, projects, and vendors (public names only)

Mem0 (heavy recurring documentation links plus a direct repository capture,
part of the agent-memory cluster); OriginTrail (heavy recurring documentation
links, dominant in the decentralized-knowledge cluster); OpenClaw (recurring
documentation links, agent tooling); Cognee (recurring documentation links);
Supermemory (direct repository capture); Effect and TypeScript (several
recent capture titles, matching this repository's own public stack); Lit
(recurring documentation links plus a repository capture); RDFJS, OASIS,
OWLAPI, SciGraph, Reactodia (ontology and semantic-web cluster); Legal
Ontologies, Legal Text Analytics, legal sentence classification, and ontology
learning (legal-NLP cluster). The projects collection was surveyed only to
confirm technology-stack recurrence that is already public in this
repository; its item-level composition and project identities are
operator-corpus specifics excluded under D2. No sampled card carried tags, so
none of these recurrences is tag-supported.

### Implicit research questions the corpus suggests

1. Which agent-memory architecture balances durable recall, provenance, graph
   structure, retrieval quality, and operational simplicity?
2. How should Mem0, Cognee, and Supermemory be compared or combined?
3. Can decentralized knowledge infrastructure (OriginTrail-style) interoperate
   with RDF/OWL/SHACL knowledge graphs?
4. How should a high-volume capture queue become tagged, status-rich,
   queryable knowledge?
5. Which ontology and legal-NLP projects are mature enough to reuse rather
   than rebuild?
6. What UI stack fits semantic-graph and research-corpus exploration?
7. How should agent protocols and runtimes (MCP, OpenClaw-style assistants)
   fit a TypeScript/Effect system?
8. Which standards and serialization layers suit durable knowledge
   interchange?
9. How much of the research workflow should remain local-first or offline?
10. Can voice or multimodal interfaces make research capture more practical?

### Pain points observable in the corpus

- Inbox concentration is high: the large majority of all cards (over
  four-fifths) remain in the inbox, and every card in the recent sample is an
  untagged, generic `link` record with `inbox` status.
- Digest headings show the backlog roughly doubling across the sampled week
  despite a healthy daily digest cadence; capture volume is bursty, with
  day-to-day new-capture counts varying by more than an order of magnitude.
- The latest digest's backlog figure disagrees with the physical inbox count
  by a small margin, suggesting post-digest movement or a stale materialized
  count; the unavailable catalog CLI prevented reconciling them.
- Only a small fraction of cards has reached the typed source collections.
  Classification, grounding, and assessment are not keeping pace with capture
  — precisely the loop stages this packet's product adds beyond the prototype
  (capture/dedup/digest exist; ground/assess/synthesize do not).

### Watchlist seed verification

Candidate public repositories surfaced by the corpus were verified against the
GitHub API on 2026-07-11 (existence, machine-readable license, archived
state). Two findings beyond simple confirmation:

- One captured repository name did not resolve at verification time and was
  dropped from seeding (recorded as unresolved).
- The OriginTrail node repository resolved through a provider-side rename to
  `OriginTrail/dkg-engine` — live evidence for the source-alias and
  stable-identity design in
  [`architecture-proposal.md`](./architecture-proposal.md) (gate G4).

The verified candidate pool, the selected seed subset, and the first-source
swap-clause evaluation live in
[`interest-taxonomy-watchlist.md`](./interest-taxonomy-watchlist.md).

### Excluded material

Card bodies; repository internals, dependencies, and build outputs; hidden and
operational metadata; anything credential-suggestive (skipped unread); x-post
identities and topical detail (counts only, and only coarsened here); precise
corpus inventory, capture timestamps, and per-domain tallies (session-only
working data, excluded from the committed packet under D2); every location
outside the two allowlisted corpus roots.

### Confidence and unresolved questions

High confidence: the coarse composition and status facts, host-frequency
ordering, digest-trend direction, and seed existence/license checks. Moderate
confidence: topic ranking (title-keyword bins over frontmatter, not bodies or
semantics). Low-to-moderate confidence: "sustained interest" per individual
seed — most seeds have one direct capture plus cluster-level support.
Unresolved, carried into later phases: full-corpus status and source-type
distributions (catalog unqueried); repository/article/x-post topical
distributions (the recency rule selected only inbox cards); whether the tag
absence extends beyond the recent sample; operator motivations and evaluations
(bodies deliberately unread).

## Consequences for P0

1. The interest taxonomy and seed watchlist
   ([`interest-taxonomy-watchlist.md`](./interest-taxonomy-watchlist.md)) are
   grounded in the topic clusters and verified seeds above.
2. The corpus supports keeping the GitHub watchlist as the first source
   (GitHub is the dominant capture host and the corpus interests map cleanly
   to public repositories); the SPEC swap clause is evaluated and declined
   with evidence in the taxonomy artifact.
3. The observed pain points (ungrounded backlog, missing
   classification/assessment) confirm the product jobs in
   [`product-definition.md`](./product-definition.md) and the packet's focus
   on grounding and lifecycle over additional capture mechanisms.
4. Unresolved corpus questions transfer to the roadmap (local
   research-directory ingestion and feedback stages), not to the first proof.
