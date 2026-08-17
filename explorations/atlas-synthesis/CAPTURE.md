# CAPTURE — atlas-synthesis (orig. baseline-synthesis)

> Append-only raw dump. Never tidy, reorganize, or interrogate. New material goes
> under a new dated heading at the bottom.

## 2026-06-17 — the spark

The user asked for a synthesized **baseline-context** exploration: fan out many
sub-agents (using `/deep-research`, `/grill-with-docs`, `/explore`), each producing
an artifact, organized into a new `explorations/` packet. The goal is to **ground
ourselves in (a) the current state of the repository and (b) the user's goals for
the project**, so the user's *next* instruction lands on a solid, shared, aligned
baseline. The packet will likely be **renamed** after the exploration is done; once
finished, the user intends to give further instructions for what they plan to do.

### Inputs the user pointed at (the reading list)

- Vision/product: `docs/BEEPGRAPH_ARCHITECTURE.md`, `docs/PROSE_TO_PROOF_ARCHITECTURE_MAP.md`,
  `docs/PROSE_TO_PROOF_CHAT.html`, `docs/PROSE_TO_PROOF_FOR_TOM.md`, `docs/PROSE_TO_PROOF_GRAPH.html`,
  `docs/PROSE_TO_PROOF_USER_STORY.md`, `docs/PROSE_TO_PROOF_VISION.md`,
  `docs/PROSE_TO_PROOF_VISUALIZATION.html`, `docs/README.md`, `docs/product/prose-to-proof.md`
- Explorations: `explorations/docx-roundtrip-interop`, `explorations/agent-chat-interface`
- Goals (14 named): `agentic-professional-runtime`, `chat-surface-parity`, `desktop-chat-surface`,
  `file-processing-capability`, `ip-law-knowledge-graph`, `knowledge-workspace`,
  `langextract-capability`, `nlp-adjunct-port`, `oppold-corpus-pipeline`, `pandoc-ast-foundation`,
  `rich-text-foundation`, `trustgraph-doc-ontology`, `trustgraph-port`, `workspace-thread-domain`
- Architecture doctrine: `standards/ARCHITECTURE.md`, `standards/architecture/00..13`,
  `standards/architecture/{DECISIONS,GLOSSARY,README}.md`
- Memory architecture: `standards/memory-architecture/00..05`

### The reframe (user correction, mid-grill) — load-bearing

The user corrected two misconceptions the recon agents surfaced. These become a
**guardrail on every agent**:

1. **Learning substrate is not the product.** "When I started, I first began
   understanding ontologies, graphs & memory architecture by grounding myself in a
   domain that I understand — *software*. I thought: if I can do this for software
   (beep-effect) then I can do it for other domains (law, wealth management). I have
   since graduated [the repo-intelligence work has been **pruned and deleted** right
   around the time I began the architectural-doctrine work]. The first product and
   implementation of this research is **the solo IP law firm for my dad (the
   flywheel)**. So don't get confused about the code and product — this may steer us
   off course and start blurring up our vision."

2. **The corpus is prep, not a runtime feeder.** "The corpus lives in
   [the machine-local Oppold corpus home]. This was produced by
   `packages/tooling/tool/cli/src/commands/Corpus`. This corpus work was some initial
   cleaning-up-data work so that when the system is ready we have some clean data to
   work with, from my father's actual 25-year corpus."

### Exploration shape decided in the align grill (see DECISIONS.md)

- Scope: maximal fan-out (~16+ agents) + adversarial verification + focused deep-research.
- Layout: hybrid — canonical skeleton + a `synthesis/` subdir; `RESEARCH.md` is the index.
- External research: focused law+memory sweep (ontology stack, donor projects, No-Escape).
- Slug: `baseline-synthesis` (temporary; likely renamed later).

### Notes discovered during scaffolding

- `explorations/ATLAS.md` already lists a **proposed `atlas-synthesis`** exploration:
  "the grand-vision exercise: full capability inventory + outcome decomposition to give
  this Atlas real substance and break the vision into sequenced explorations/goals." This
  is essentially what this packet does — the rename target may be `atlas-synthesis`.
- There is an **active `effect-capability-kg`** exploration (deterministic Effect v4
  capability graph, JSDoc-derived) and a `goals/effect-capability-kg-seed` packet — these
  are software-domain work; the archaeology artifact clarifies whether they are a new
  tooling-first take vs. a revival of the pruned repo-intelligence.

## 2026-06-17 — engineer profile & working style (user background)

Provided by the user as additional grounding for the packet:

- ~10 years professional software engineering. Primarily TypeScript; **thinks in types
  & schemas**.
- **Breaks work down by capability** to compartmentalize: "I know I want to build a
  system for my dad's solo IP law firm, so I build `@beep/nlp`, `@beep/langextract`,
  etc." Designs the sub-parts & schemas *before* product work.
- Often has trouble **fitting everything into a coherent crystallized vision** — the
  hard part is the assembly, not the parts.
- A few months into **ontology / semantic-web** study; not an expert. Suggestions may
  be wrong or misleading → **wants to be challenged and taught** through a lens they
  understand: **types, schemas, flows, diagrams, visualizations** (e.g.
  `docs/PROSE_TO_PROOF_GRAPH.html`).
- **Learns by porting other codebases.** Began in Python (now rusty). Found
  **TrustGraph** (Python, upstream: https://github.com/trustgraph-ai/trustgraph) and decided to
  port it to TypeScript and make it **Effect-native** (https://github.com/trustgraph-ai/trustgraph/tree/main/ts).
- Lexical/chat lineage: machine-local lexical-clone `*.md`
  reports (`effect-v4-ai-chat-sync`, `effect-v4-anthropic-model-catalog-report`,
  `effect-v4-isanyof-bug-report`, `effect-v4-lexical-node-schema`,
  `effect-v4-streamobject-proposal`) → the machine-local `effect-lexical-chat` checkout
  → current repo packages: `packages/foundation/modeling/lexical`,
  `packages/foundation/modeling/md`, `apps/professional-desktop`.
- The vision for the product & repo is **grand & very technical**; even with strong
  type/schema skills, assembling it into a coherent system is the struggle. Guidance,
  challenges, and teaching are explicitly welcomed.

## 2026-06-17 — renamed to atlas-synthesis

Doctrine-hygiene cleanup renamed this packet `baseline-synthesis → atlas-synthesis` (it is
the capability-inventory half of the proposed grand-vision exercise in `../ATLAS.md`). See
`DECISIONS.md` (packet-rename) and `standards/memory-architecture/04-decision-log.md`
(2026-06-17 entry).

## 2026-06-17 — assessment & critique request (CHALLENGES_AND_SUGGESTIONS branch)

In a branched session (`baseline-synthesis-grounded_CHALLENGES_AND_SUGGESTIONS`), the user
asked for a candid big-picture assessment to read & reflect on, before deciding direction:

- "What are your general thoughts? What's good? What needs work? What's bad or you dislike?"
- "What do you think about the architecture?"
- "Do you think my idea is a good one? Is it competitive? What is my competition like? What
  is the niche and do you think I have one? Do I have a moat? Product market fit?"
- "use /deep-research & /grill-with-docs to flesh out any details and decisions. I would like
  some artifacts written to the exploration packet so I have some things to read and reflect on."

Shaped via grill into three artifacts (`synthesis/` 30-band): `30-assessment-and-critique`,
`31-competitive-landscape`, `32-moat-niche-pmf-verdict`. Posture: **steelman → red-team →
verdict**. Deep-research: **broad sweep** (competitors + market/funding + regulatory/ethics +
moat case studies). See the three `2026-06-17 — assessment-*` entries in `DECISIONS.md`.

## 2026-06-17 — the ambition LADDER (user clarification on "dad-tool vs venture")

User clarification on the `synthesis/32 §4` "dad-tool vs venture" framing — it is a **ladder,
not a fork**:

- Dad's reaction *if the tool is effective for him*: *"I could sell this to so many of my
  colleagues and connections I've made over the years like hot cakes."* → dad's 25-year network
  is a built-in **distribution channel**, not just a user.
- Sequence, not fork: **dad-tool (make it good) precedes venture.** "Dad tool makes it good for
  an experienced attorney → if good for an experienced attorney, ready for venture."
- **The atomic unit is the individual attorney**, not the solo: *"fundamentally made to benefit
  1 attorney focusing on real law work, the individual."* Solo practice is not the only target —
  attorneys *inside* firms count too.
- Scaling vision (hypothetical): individual-effectiveness tool → every attorney at a medium/large
  firm has one → **aggregate to a firm/organizational-level tool** (aggregate attorney data to a
  firm; shared skills, workflows, intelligence; a *bigger graph*).

Reframed as rungs: **0 dad (n=1, dogfood-PMF + distribution node) → 1 individual attorney #2..N
(segment-PMF: a *different* attorney depends on it w/o bespoke tuning; sourced from dad's network)
→ 2 many individuals → 3 firm aggregation (organizational).**

Two challenges raised in discussion: (a) "good for dad ⟹ venture-ready" is too fast — dad is the
*most-aligned* user, not a random one; the real venture signal is attorney #2's unprompted
dependence (dad's network *supplies* #2). (b) Rung 3 (firm aggregation) **collides with the
local-first / privilege / matter-wall moat** (`32 §2`) — a *different trust model* (data leaves
the device; cross-attorney sharing hits ethical walls; up-market puts you on Harvey/CoCounsel's
turf). Architecture payoff: treat the firm graph as a **permissioned projection over individual
authorities** (federation = the existing authority/projection split scaled), which *partially
rehabilitates* the matter-wall/authority-projection investment. Candidate amendment to `32 §4`
(replace "fork" with "ladder" + trust-model discontinuity + federation payoff) — pending the
user's call on whether rung 3 is a real commitment or a bracketed north star.

## 2026-06-17 — foundation-gaps follow-up (what to build/migrate next)

The user asked: "what gaps/capabilities are we missing in foundation work (à la `@beep/langextract`,
`@beep/nlp`, `@beep/editor`) that would make the things we're striving for more achievable?" Two
read-only recon agents (foundation inventory + requirements-vs-v3-migration) grounded the answer →
`synthesis/60-foundation-gaps.md`. Finding: the foundation is ~80% there; the keystone fill-in is a
shared **`@beep/provenance`** anchor (`TextAnchor`/`SourceRef`) — today four incompatible
"where-from?" shapes exist (`nlp` `Span`, `file-processing` `ArtifactId`/`ContentDigest`, epistemic
`Evidence` opaque fixture keys, editor `ArtifactRefNode`) and nothing bridges them. Most else (entity
resolution, GraphRAG, grounded-ask, embeddings) is migrate-from-v3; the in-memory graph
(`@beep/nlp/Graph`) + SHACL gate (`@beep/semantic-web`) already exist. Coordination flagged: the
`epistemic-claim-lifecycle-gate` EvidenceSpan item should consume the shared anchor. See `DECISIONS.md`
(2026-06-17 `foundation-gaps-doc` entries).
