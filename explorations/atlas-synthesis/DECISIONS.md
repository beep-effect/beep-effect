# DECISIONS — atlas-synthesis (orig. baseline-synthesis)

> One branch-closing question per entry, recommended answer first. Logged with
> Question / Answer / Rationale. This packet's align grill happened up front to shape
> the exploration itself (an unusual but deliberate use of `/grill-with-docs`).

## 2026-06-17 — exploration-scope

**Question:** How large should the synthesis fan out (artifact/agent count)?

**Answer:** Maximal (~16+ agents) with adversarial verification + a heavier deep-research
sweep. (Recommended was the ~10-agent "full set"; user chose maximal.)

**Rationale:** The user asked not to be conservative with sub-agents and wants an
exhaustive, grounded baseline. Maximal splits current-state inventory finely (per
cluster + foundation/tooling/apps), adds a git-archaeology agent, and runs a skeptic
verifier per artifact. Rejected: lean (~6) — too coarse for a baseline meant to anchor
future planning.

## 2026-06-17 — packet-layout

**Question:** How are the synthesis artifacts laid out given the canonical flat `/explore`
packet convention (no subdirs but `assets/`)?

**Answer:** Hybrid — canonical skeleton (`README`, `ops/manifest.json`, `CAPTURE`,
`DECISIONS`) + a `synthesis/` subdirectory of per-theme artifacts, with `RESEARCH.md` as
the INDEX/landscape linking each doc.

**Rationale:** Maximal scope yields 10-16 artifacts; one giant `RESEARCH.md` would be
unnavigable, and 16 top-level files would clutter the packet root. Goal packets already
use a `research/` subdir, so a subdir here is justified, documented drift. Rejected:
canonical-only (one `RESEARCH.md`) and custom-flat (many top-level files).

## 2026-06-17 — external-research-depth

**Question:** How much external (web) deep-research, and on what?

**Answer:** Focused law+memory sweep (~3 deep-research agents): (1) the IP-law ontology
stack and how published ontologies map to the BeepGraph TBox; (2) the memory/KG donor
projects validated and mapped to our choices; (3) the No-Escape theorem provenance +
reasoning foundations.

**Rationale:** All the user's listed inputs are internal; the highest-value external work
is the ontology stack (directly serves the *pending* `ip-law-knowledge-graph` P0) plus
verifying the load-bearing external claims (donor projects, the No-Escape citation).
Rejected: broad multi-front (competitor/market landscape) — lower value for a grounding
baseline; the vision docs already cover competitors. Rejected: internal-only — leaves the
ontology P0 and the No-Escape citation unverified.

## 2026-06-17 — packet-slug

**Question:** What working slug for the packet?

**Answer:** `baseline-synthesis`.

**Rationale:** Neutral, descriptive, signals a grounding/context packet (not a feature),
and is easy to rename once the user's real direction is named. The proposed `atlas-synthesis`
exploration in `ATLAS.md` is a likely rename target. Rejected: `prose-to-proof-baseline`
(prematurely narrows to one product framing), `repo-grounding` (drops the goals/vision half).

## 2026-06-17 — reframe-learning-substrate-vs-product (correction, not a question)

**Correction logged:** The software / repo-intelligence / code-AST / "L3 deterministic
code intelligence" work was a **learning vehicle** (grounding in a familiar domain to
learn ontology/graph/memory architecture), since **pruned/deleted** around the start of
the architecture-doctrine work. It is NOT current capability and NOT the moat. The
**product** is the solo IP-law firm flywheel for the user's father. The Oppold corpus is
**ahead-of-time data prep**, not a live runtime feeder.

**How applied:** Injected as a guardrail into every synthesis + verifier agent; a dedicated
git-archaeology artifact (`synthesis/90-archaeology-pruned-repo-intel.md`) provides the
evidence; the memory-architecture artifact reframes the No-Escape framework as *learned
theory now applied to law*; the corpus artifact frames the Corpus CLI as data prep. Also
captured durably in agent file-memory.

## 2026-06-17 — packet-rename

**Question:** Keep the working slug `baseline-synthesis`, or rename now?

**Answer:** Rename to `atlas-synthesis` (2026-06-17).

**Rationale:** The centerpiece (`synthesis/00` §5) established that this packet IS the
capability-inventory half of the proposed `atlas-synthesis` exploration (`../ATLAS.md`).
Renaming now makes them one initiative at two stages (inventory done → decomposition next)
rather than two competing entries. Done as part of the doctrine-hygiene cleanup recorded in
`standards/memory-architecture/04-decision-log.md` (2026-06-17); the outcome-decomposition
half is the packet's next stage.

## 2026-06-17 — assessment-posture

**Question:** In what critical posture should the strategic/architectural assessment artifacts
(the 30-band) be written?

**Answer:** Steelman → red-team → verdict (strongest honest case FOR, then AGAINST, then my
candid call — per dimension).

**Rationale:** The user explicitly asked to be challenged. Steelman-before-red-team keeps it
fair while still candid, and a decision-forcing verdict makes it useful to reflect on. Rejected:
founder-brutal red-team (less balanced), balanced-advisor memo (pulls fewer punches than asked).

## 2026-06-17 — assessment-research-scope

**Question:** How wide should the deep-research competitive sweep go?

**Answer:** Broad sweep — IP-specific + horizontal legal-AI + local-first knowledge-tool
competitors, PLUS legal-AI market size/funding, the solo/small-firm segment & willingness-to-pay,
vertical-AI moat case studies, and regulatory/ethics (UPL, ABA/state-bar AI rules, confidentiality,
USPTO AI guidance).

**Rationale:** The competition/niche/moat/PMF questions need current (2026) evidence, and the
"is it venture-viable" question needs market + regulatory context; the PRD's competitor notes are
point-in-time (2026-06-15). Rejected: focused 4-front (drops market/regulatory), light/judgment-led
(leaves the niche & PMF claims unevidenced).

## 2026-06-17 — assessment-artifacts

**Question:** How to split the assessment into packet artifacts?

**Answer:** Three docs in `synthesis/` (a new **30-band**): `30-assessment-and-critique.md`
(general thoughts + architecture), `31-competitive-landscape.md` (deep-research evidence),
`32-moat-niche-pmf-verdict.md` (strategic synthesis + decision-forcing verdict).

**Rationale:** Clean separation of judgment / evidence / strategy; each independently readable;
the 30-band distinguishes assessment/strategy from the 00–23 grounding docs. Rejected: 4 docs
(more navigable but more files), 2 docs (denser, mixes evidence and verdict).

## 2026-06-17 — ambition-ladder-and-rung3-optionality

**Question:** Is the product a dad-tool or a venture-product — and does firm-level aggregation
shape architecture now?

**Answer:** It is a **ladder, not a fork**: dad (rung 0) → individual attorney #2..N (rung 1, the
venture gate, sourced from dad's network) → many individuals (rung 2) → firm aggregation (rung 3).
**Dad-tool-first**, with the **individual attorney as the atomic unit** (not solos only). **Rung 3
(firm aggregation) is bracketed ambition — not a current build focus** — but the architecture must
preserve its optionality (no large-scale-refactor hole). Adopt a forward-compatibility invariant
now: corpus authority is always single-owner + local; any firm/cross-attorney view is a
**permissioned projection over individual authorities** (federation, never a central store);
matter walls modeled as a first-class sharing-permission boundary (enforcement deferrable, model
not).

**Rationale:** "Good for dad" is the on-ramp to venture (dad is also the first distribution node —
"sell to colleagues like hot cakes"), and the firm rung is a real long-term ambition. But firm
aggregation is a *different trust model* that collides with the local-first/privilege/matter-wall
moat (`32 §2`) and walks onto incumbent turf, so it must not be built now — only kept reachable.
The invariant is a stricter reading of vision commitments C1 (local-first/matter-walled) + C7
(authority vs projection), so it costs ~0 at rung 0 while foreclosing the centralized-firm-DB
dead-end. Supersedes the `32 §4` "fork" framing (see `synthesis/32` Amendment 2). Caution retained:
dad's enthusiasm is *distribution*, not *proof*; attorney #2's unprompted dependence is the venture
signal.

## 2026-06-17 — foundation-gaps-doc: anchor home

**Question:** Where should `synthesis/60-foundation-gaps.md` recommend the shared provenance anchor
(`TextAnchor`/`SourceRef`) live?

**Answer:** A new **`@beep/provenance`** package in `foundation/modeling` (peer of `@beep/rdf` /
`@beep/identity`).

**Rationale:** Domain-agnostic substrate → `foundation`, not `shared` (per `02`/`07`); pure schema
value objects (no service/Layer) → `modeling`, not `capability`. Layering note: `Span` (in `@beep/nlp`)
and `ArtifactId`/`ContentDigest` (in `@beep/file-processing`) are in *capability* packages — promote
those primitives down so a modeling anchor composes them without a modeling→capability inversion.
Rejected: concept modules in `@beep/schema` (buries provenance in the generic kit); extend
`@beep/identity` (`TextAnchor` exceeds identity).

## 2026-06-17 — foundation-gaps-doc: posture

**Question:** How prescriptive should the doc be?

**Answer:** Analysis + concrete **sequencing & coordination** (build `@beep/provenance` first →
`epistemic-claim-lifecycle-gate` consumes it for EvidenceSpan → embeddings/reasoner/ask are
migrate-from-v3, deferred) — but **no goal-packet scaffolding**.

**Rationale:** The user wants something actionable; the epistemic packet now exists with an
EvidenceSpan item that should consume the shared anchor. Scaffolding a foundation goal packet would
overlap the goal-packet branch's active lane. Rejected: pure analysis (less actionable);
draft-a-packet (overlaps that lane).

## 2026-06-17 — foundation-gaps-doc: integration

**Question:** How to integrate the doc given concurrent branch activity on shared files?

**Answer:** Standalone `synthesis/60-foundation-gaps.md` (60-band, no path collision) + careful
append-only hygiene (re-read each shared file before touching; skip + report on conflict).

**Rationale:** Avoids clobbering the assessment/goal-packet branches' edits to
RESEARCH/DECISIONS/README/CAPTURE. Rejected: full integration now (clobber risk); standalone-only
(doc not discoverable in the index).

## 2026-08-13 — holding-pen graduation convention

**Question:** Does this packet stay `active` as a holding pen for its gated/queued MAP.md candidates, or does it graduate now that every promised-now goal exists?
**Answer:** The two manifest questions are resolved by the completed-retained
`epistemic-claim-lifecycle-gate` and `law-practice-office-action-spike` goals.
Clear the frontier and graduate this packet. A future synthesis pass reopens
the packet at `decompose` or opens a fresh exploration packet.

**Rationale:** Promised-now work, not possible future decomposition, determines
graduation. A future synthesis pass is a re-entry event rather than a reason to
hold this packet open.

**Rejected:** keep-active holding pen (the prior convention — leaves terminal packets indistinguishable from in-flight work); flip-and-spawn (a fired gate spawns a goal directly from MAP.md — skips the operator's align/shape gates on the resumed scope; the ratified rule reopens the packet at `decompose` instead).
