# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-08-25 — the knowledge-endgame conversation

Provenance: this capture preserves a two-session Fable conversation
("Goals and exploration packet revamp" and its continuation). Inputs: the
operator's scratch note `~/.config/JetBrains/WebStorm2026.2/scratches/KNOWLEDGE_ENDGAME.md`,
ten Grok research lanes fanned out over it, a three-agent adversarial
verification pass, and four rounds of operator additions. Machine-local
evidence (untracked; this repo is public) lives in the operator's private
internal docs area, in a knowledge-endgame folder holding the lane prompts,
raw lane transcripts (~2MB), the ten lane reports (~430KB), and the four-part
SYNTHESIS document (full text mirrored below); the exact location is recorded
in [research/SOURCES.md](./research/SOURCES.md). Redactions in this public
capture: private deployment hostnames replaced with bracketed descriptions;
home paths as `~`.

### The operator's original note (KNOWLEDGE_ENDGAME.md, lightly redacted)

A multi-faceted vision of an internal beep-effect project that also dogfoods
the law-practice work & goals. Existing packets that fold into it:

- Explorations: `project-intelligence`, `packet-system-redesign`,
  `document-structure-ontologies`, `deterministic-doc-structure-extraction`,
  `protocol-as-value`
- Goals: `repo-codegraph-jsdoc`

The vision lies at the intersection of those packets and:

- `@beep/docgen`, storybook & effect api spec tooling
  (`unstable/httpapi/HttpApiScalar.ts`)
- the "Identity as IRI" scratch note
- the local LemmaScript clone (path in the provenance ledger)
- the goals & explorations system itself
- the semantica goal & exploration packets
- effect's new website & its generated v4 api page (local effect-website
  clone)
- documentation MCPs like https://docs.x.ai/developers/docs-mcp
- `@beep/qa-capture`
- `packages/tooling/library/repo-utils/src/JSDoc` ontology +
  `goals/repo-codegraph-jsdoc`
- the yeet system

Thought experiment — imagine a system with: semantica-like features; the
goal/exploration packets as envisioned; the nightly research & project
intelligence routines; an ingestion/parsing/normalization pipeline like the
corpus pipeline; T-Box & A-Box project intelligence knowledge graphs;
ontologies tailored to agent work in this repo; a FOLIO-like taxonomy
browser + MCP + API (folio.openlegalstandard.org, github.com/alea-institute/FOLIO,
a local folio-mapper clone); a hosted platform with routes for
taxonomy browsing, semantica-like features [private webui deployment],
effect-v4-style api documentation, and an ai-metrics UI [private Phoenix
deployment].

Ask: fan out grok agents over every reference; name the bush being beaten
around.

### The ten Grok lanes (reports in machine-local evidence)

01 intelligence loop · 02 packet control plane · 03 document structure &
corpus · 04 code as knowledge graph · 05 api docs surface · 06 identity as
IRI & LemmaScript · 07 semantica & ontology workbench · 08 FOLIO taxonomy ·
09 evidence & agent metrics · 10 outside landscape. Each report: what each
referenced thing IS, its data model, inputs/outputs, presuppositions,
recurring nouns (ranked), three candidate unifying-idea formulations + five
names, and tensions against the operator note. Lane 10's landscape verdict:
no existing product category combines the ten ingredients; every neighbor
(code intelligence, developer portals, living docs, docs MCPs, context
graphs, ontology platforms, LLM observability) ships a proper subset.

### The four-part synthesis (mirror of machine-local SYNTHESIS.md)

Verified by a three-agent adversarial pass (all verdicts: not refuted;
sharpenings adopted).

**Part I — the machine.** The operator keeps re-ratifying one governance
discipline for machine-produced knowledge; the tip-of-tongue thing is the
**join layer** over records that exist but cannot be dereferenced across
subsystem boundaries. Independence proof: producers reinvent PROV shapes
without importing `Prov.ts` (`YeetAttemptStarted` ≈ Activity start,
`CaptureProvenance` ≈ Generation, `QaEvidenceRef` ≈ EvidenceTarget without
IRI) — "the unifying move is mapping, not a fifth schema family"; the repo
already produces the evidence, it does not yet name it as a graph. Five laws
(ratified doctrine + one pilot; production still dual-writes status; 1 of
~219 packets has an event stream):

1. **Identity, two regimes joined by minting** — compile-checked `$I` for
   kinds; runtime-minted digests/IRIs for instances. The note flattens three
   deliberate channels ($I path / sha-256 digest / minted IRI-slug) into one
   "identity as IRI"; the flattening is the tell.
2. **Value/SoR + fold** — one system of record per kind; state derived by
   fold bound to `sourceTip`, never trusted from stored fields. The
   schemaVersion'd schemas are *candidate* T-Box branches — candidate,
   because they disagree (two `@category` taxonomies; 113-tag catalog vs the
   enforced law; five disjoint taxonomies).
3. **Projection** — every surface (browser, API docs, MCP, JSON-LD, metrics
   UI) is generated, disposable, never a second writer (D15).
4. **Redaction** — projections crossing trust boundaries carry only the
   public half; the A-Box is deliberately fragmented (checkout `.beep/`,
   packet `history/`, XDG metrics, Phoenix, out-of-repo corpora); a platform
   mounts public projections, never reads the git tree as "the graph."
5. **Admission, split** — *grounding* (machine-verifiable witness:
   `slice === quote` spans, CAS fingerprints, receipts, proof lemmas; misses
   are typed abstentions) and *governance* (machine proposes; a human token
   admits).

Hosted platform = a **federation of FOLIO-style triples** (browse + MCP +
HTTP, one per record kind), joined by identity + `seeAlso`; **dereference**
(exact registry) and **discovery** (search/browse) deliberately separate.
Why unverbalizable: (a) every noun is overloaded in-house (packet ×3,
research ×3, evidence ×3+, span ×8, ontology ×4+, claim ×3, digest ×3,
category ×2, document ×3, provenance ×3); (b) no market category exists —
closest compound: *ontology-backed project intelligence*; (c) the operator's
own decision log demoted the closest prior articulation
(`standards/memory-architecture`: deterministic repo intelligence = operator
tooling; product = the IP-law flywheel) — the idea re-enters through side
doors because it was refused the front door. Resolution: platform ships as
projections/operator tooling; the law practice is the product-authority
instance; the dogfood transfers laws, not pipelines. Missing piece (small,
not zero): lane 09's seven steps (schemaVersion catalog as T-Box; mint
instance IRIs under `https://ns.beep.sh/`; map producers onto PROV beside
their JSON; JSON-LD off existing folds — packet Amendment I, acceptance = one
concrete cross-graph join; public-projection-only ingest; join keys
(`configSnapshotId`, `attemptId`, QA `sessionId` as IRI); human-token-only
writes) plus vocabulary reconciliation and publishing the unpublished
catalogs (docgen Domain JSON; Fibered/IdentityRegistry).

**Part II — the market.** Operator additions: the flywheel (agents improve
the repo that improves the agents; the UI projection is how a human grasps
project state; everything compounds); the fs/grep thesis (agents transformed
software because work + corpus are collocated, greppable, checkable — high
backpressure; harness memory systems fight this by burying memories outside
the repo; the goals/explorations system exists to combat that bifurcation;
but fs loses on context consumption, consistency, discovery, grasp; systems
of record win those and lose the agent-environment story; Theo (t3) tearing
down remote memory products, pro repo-as-truth); lawyers use computers like
kids learning to write yet every lawyer's DMS is essentially bad version
control; businesses drown in bifurcated SaaS; developers get everything in
one app because plugins/MCPs/CLIs are child's play for them; how do you give
a lawyer that; enterprise/regulatory drag kills solo-dev speed; nobody knows
ontologies except the deep-weeds people; **nobody trusts AI fully except
those who know how to typecheck & lint**; proposal — host git behind the
scenes so the practice becomes the repo, agents handle the integration
know-how, systems of record become synced projections.

Synthesis: **the developer's environment is the first agent-native knowledge
substrate; generalize it.** Practice-as-repo: agents supply technical
know-how; **ontologies are the type system that makes non-code work lintable
— and lintable is what makes AI trustable to people who can't read code**
(ontologies as backpressure infrastructure, not knowledge representation);
invisible hosted git is the DMS; SaaS surfaces become projections.
Go-to-market: never sell the ontology, **sell the red squiggle** (TypeScript
was adopted for autocomplete + underlines, not type theory). Both/and
resolution: fs is the SoR; database-grade surfaces are projections of the
fold. Four hard parts, each mapped to existing machinery: (1) write-back —
external SoRs (courts, USPTO, e-signing) are counterparties, not
projections; needs a third category: **connectors executing external Actions
with receipts** (agent proposes, human token admits, `prov:Activity` in the
journal; the Yeet operator-merge shape); unbundle the interface from the
SoR, don't claim to eliminate it; (2) diffability — git leverage assumes
mergeable text; **ingestion is the border crossing** where DOCX/PDF/email
become span-addressed diffable representations (the least-shipped layer);
(3) partial backpressure — legal work never typechecks but lints far more
than exploited (deadlines, citation resolution, CFR-specified structure,
claim-support spans, taxonomy membership); claim "lint," not "verify"; the
gap is where the human token lives (the malpractice-liability interface, a
feature); (4) enterprise drag reframed — in regulated environments the five
laws become the pitch (immutable journals, gates, redaction, receipts =
audit story); keep agents collocated with data (agent-leverage argument, not
compliance-mandates-local). Interface pushback: chat is not the interface —
the triad is **projections to grasp, chat to propose, a token to admit**.
Three nested flywheels: agents↔repo (running); substrate→practice instances
(product); instances→evals/metrics/ontology-learning→substrate (moat).

**Part III — the labor model (Palantir/FDE).** Operator addition: Palantir =
data mining → ontology learning → graph → bespoke applications, but requires
FDEs who know the system; how to remove the FDE, with the repo ontology
itself removing developer orchestration. Synthesis: Foundry's ontology
covers the **domain** but not the **work** or the **applications**; the FDE
is the runtime for everything the ontology doesn't cover (also their revenue
model; AIP is the attempt, constrained by the hosted platform being the
opposite of the medium where agents are superhuman). Answer: extend the
ontology over three universes — domain, work (packets/gates/protocols/
evals/receipts; AgentO mapping), applications (apps = declared projections;
**orchestration-as-value is the FDE's job description, reified** —
protocol-as-value). Labor inversion: Palantir scales know-how by shipping
engineers; the substrate scales it by making know-how a dereferenceable
value — **onboarding an agent replaces deploying an engineer**. FDE
decomposition: elicitation → ingestion + ontology learning under
propose→gate→record; modeling → agent proposals under typecheck/SHACL/drift
lint + human admit; app building → projection declarations compiled against
the T-Box + QA/evals; plumbing → connectors-with-receipts; orchestration →
protocols as values + the packet journal. Discipline: the FDE is amortized
into the substrate, not removed — the operator is still beep-effect's FDE;
vocabulary drift happened under expert supervision (reconciliation machinery
is load-bearing); know-how hasn't finished escaping the operator's head
(protocol-as-value is wave-2 gated); friction receipts are the
FDE-dependency detector. **Metric: the fraction of operator interventions
that could have been dereferenced. Eval: a fresh agent, cold, in a fresh
clone — how far does it get on a real packet before needing a human fact?**

**Part IV — distribution.** Operator additions: (a) the repo needs the same
system the agents need, which the applications need (recursion); (b) imagine
cloning beep-effect and agents build applications locally in it — problem:
upstream reconciliation without introducing another system of record like a
self-hosted forge. Synthesis: the recursion is the compiler-bootstrap
property — L0 the repo develops itself (running), L1 agents build apps in a
clone, L2 apps run practices whose matters are packets; no dev-tooling vs
runtime split, so the clone contains the whole loop. **The forge is the last
SoR to disaggregate**: git is already the distributed content-addressed SoR;
a forge adds four separable things — transport (a dumb bare remote / object
storage: a host, not a forge), identity/discovery (signed tags + IRIs; a
registry is a projection of tags), collaboration state (in-repo values: the
packet CAS journal; review threads/approvals as event kinds; prior art
Fossil, git-bug, git-appraise, Radicle), and gate execution (the real
tension: today the repo's merge authority is hosted required checks;
migration = Amendment J gate certificates — signed, digest-bound, in-repo;
runners become executors leaving receipts; the forge becomes to the repo
what Jira is to packets). Upstream = remote + signed tags; contribution =
request-pull/patch bundles; instances send up receipts/evals/patches, never
instance data (redaction law). **Agents change fork-rot economics**:
upstream ships migrations-as-values (schemas + codemods + laws);
reconciliation becomes an agent task with backpressure (fetch, replay
divergence, run migrations, gates verify, human admits); eject stops being a
one-way door. Honest gap: the repo is not partitioned for cloning —
substrate and the operator's instance are interleaved; promote the de-facto
four rings into **declared workspace geometry** (ring 0 public substrate —
the only thing upstream pull touches; ring 1 instance-committed; ring 2
instance-private; ring 3 local-ephemeral + out-of-repo).

### 2026-08-25 addition — the training-data flywheel

Operator, verbatim in substance: beep-effect is open source & labs can train
on it. Imagine the ultimate website from earlier — a projection of
beep-effect's APIs, docs, goal packets, everything — structured so
enticingly with linked data, machine-readable schema.org, AEO, SEO & GEO
that a lab's scraper or any agent couldn't help but ingest the prose and use
it for internal training. beep-effect becomes a flywheel of being built by
agents for agents for applications for humans, where the prose is so public
and so good that labs train on it, embedding beep-effect itself in the
semantic space of frontier models' neural nets.

### Where the conversation closed

The synthesis parts answer, in order: what it is (join layer over five
laws), who it's for and why it wins (practice-as-repo; lint as trust), who
builds each instance (agents as FDEs; know-how dereferenceable), how it
spreads (clone-and-go; forge disaggregation). Each operator addition
resolved the previous part's hanging question; no obvious fifth hanging
question remained. Five decisions were named as the critical path, mostly
already queued in existing packets: Amendments H/I/J
(`explorations/packet-system-redesign` MAP, queued unratified), the
four-ring substrate/instance partition, and the cold-agent eval. Operator
verdict: "damn cool," no project-direction pivot — captured here so nothing
is lost.
