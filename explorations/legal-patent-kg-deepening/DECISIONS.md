# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-08-01 — packet home

**Question:** Where does this corpus-extraction effort live — new packet,
reopened `legal-ontology-landscape`, folded into the unlaunched Gold Intake
v2 campaign, or straight into `goals/semantic-foundation`?

**Answer:** New successor packet (`legal-patent-kg-deepening`), explicitly
building on — not invalidating — the graduated wave-1 findings and
semantic-foundation decisions, with cross-links both ways.

**Rationale:** Reopening a graduated packet muddies its closeout trail; Gold
Intake v2 is a repo-mining campaign whose contracts fit a paper corpus
awkwardly and it has not launched; going straight to the goal skips the
align/shape/adhd divergence this corpus warrants. Benjamin's rider: the new
packet must not be read as superseding wave-1 conclusions — they remain
standing inputs.

## 2026-08-01 — mining engine & quota routing

**Question:** Who reads the ~120 papers and ~24 repos, and where does the
`/deep-research` Workflow harness fit, given the standing codex-for-volume
doctrine vs this session's ultracode mandate?

**Answer:** Codex mines, the Workflow harness orchestrates and synthesizes:
`codex exec` (GPT-5.6 Sol, `--effort medium`) jobs are driven from inside the
Workflow scripts (Bash/codex-wrapper stages), writing per-source distillates
to this packet's `research/`; Anthropic agents run only the adversarial
verify + synthesis phases over the distillates.

**Rationale:** Matches the quota-arbitrage doctrine, wave-1's own captured
constraint ("all research/fetching via codex; Claude orchestrates and
synthesizes"), and Gold Intake v2's locked codex-only-mining decision, while
keeping deterministic orchestration and the deep-research verification
machinery. Rejected: pure-Anthropic Workflow (burns the scarce pool on ~4.4k
files of bulk reading), pure-codex end-to-end (loses adversarial verify).

## 2026-08-01 — intake depth

**Question:** Triage-then-deep-mine (gold-intake pattern) or full coverage?

**Answer:** Papers full, repos triaged: catalog + content-hash dedupe pass
first (noise excluded: cookies file, screenshots, duplicate PDFs); then a
distillate for EVERY unique paper and every `links.md` URL at codex medium
effort; the ~24 repos get a triage pass with xhigh deep-mines on survivors
only. FOPNet gets a dedicated deep-dive thread.

**Rationale:** The corpus is hand-curated — triage over the papers would
mostly say yes while risking silent drops; the repo set is bulkier and partly
redundant with wave-1 holdings (e.g. lkif-core), so triage earns its keep
there. Effort tiers mirror Gold Intake v2's locked medium-triage /
xhigh-deep-mine split.

## 2026-08-01 — deep-research track slicing

**Question:** How is the synthesis layer sliced, given tracks must run
sequentially (rate-limit memory: never 3+ parallel harness runs)?

**Answer:** Four thematic tracks, strictly one at a time, each landing a
verified synthesis note in `research/`:

1. Legal core ontology + Hohfeldian formalization.
2. Patent KGs + functional patent knowledge (carries the FOPNet priority
   thread).
3. Legal GraphRAG + temporal/diachronic norm reasoning.
4. Patent LLM authoring + multi-agent IP workflows (ODRL, Symboleo).

**Rationale:** Each theme routes to different downstream homes
(semantic-foundation; patent tooling / uspto-patent-driver-depth; epistemic
slice; OIP practice tooling), so separate verified syntheses keep routing
clean. Rejected: 2 fat tracks (routing needs a later split), 1 combined pass
(dilutes adversarial verify, buries FOPNet).

## 2026-08-01 — /adhd placement

**Question:** Where does `/adhd` divergence sit, and on what problem?

**Answer:** Post-synthesis, on integration plays: "given these findings, what
should beep-effect actually build/absorb?" Diverge/deepen branches run as
codex exec background jobs, critic inline (per the adhd-via-codex-fanout
pattern). Output feeds the align/shape stage as BRIEF candidates.

**Rationale:** Divergence works best with real material; up-front it
speculates about what the corpus might say. Rejected: up-front question
framing (the hand-curated corpus already implies its questions), both-ends
(adds a fan-out before any findings exist).

## 2026-08-01 — artifact contracts

**Question:** What contracts do distillates and syntheses land in?

**Answer:** Per-source distillates as packet `research/` notes PLUS a nugget
catalog and ROUTING-SEED reusing the `_gold-intake` v1 schemas, mapping each
finding to its downstream goal/packet; campaign ends with a HANDOFF doc.

**Rationale:** Routing is where the corpus pays off, and schema reuse lets
Gold Intake v2 dedupe against this campaign instead of re-mining the same
directory. Rejected: freeform notes only (routing stays prose-bound, no v2
dedupe ledger), catalog-only (loses the per-source provenance the verify
phase cites).

## 2026-08-01 — campaign staging & PR cadence

**Question:** Where does the run stop, and how does it land in PRs?

**Answer:** PR 1 (docs-only, immediately): packet skeleton with CAPTURE +
DECISIONS + ATLAS sync. Then the campaign runs (mining waves → four
sequential tracks → /adhd → catalog + routing seed); artifacts land as PR 2.
Campaign endpoint = syntheses + nugget catalog + ROUTING-SEED + HANDOFF;
BRIEF/MAP shaping is gated on Benjamin's sign-off in a follow-up /explore
session. Fetched third-party files (links.md targets, vendor ontologies)
stay gitignored under `assets/vendor/` with a committed manifest, per wave-1
precedent.

**Rationale:** Matches the standing grill-outcomes-as-docs-only-PR rule and
the Gold Intake v1 endpoint pattern (synthesis + routing seed + handoff,
then stop for sign-off). Rejected: run-through-shaping (bakes in unreviewed
framing), single end-of-campaign PR (long-running branch, violates the
grill-first pattern).

## 2026-08-01 — packet slug

**Question:** What is the packet called?

**Answer:** `legal-patent-kg-deepening`.

**Rationale:** Reads as the deepening pass over the strand `legal-ontology-
landscape` opened, without implying supersession. Rejected:
`patent-kg-harvest` (under-represents the legal-core/Hohfeld and GraphRAG
tracks), `legal-patent-ontology-kg-research` (wordy; "research" is redundant
for an exploration packet).
