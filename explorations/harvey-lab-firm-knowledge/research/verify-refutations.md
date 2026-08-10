# Adversarial refutation of the 20 mined opportunities

**Date:** 2026-08-08
**Agent:** verify-refutations (Opus 5)
**Inputs:** `research/mine-{benchmark-integration,dms-taxonomy,eval-methodology,synthetic-corpus}.md`,
`research/verify-facts.md`, `CAPTURE.md`, `DECISIONS.md`, the scraped X post.
**Ruled against:** `explorations/ATLAS.md`, every packet under `explorations/`, every
packet under `goals/`, `docs/ROADMAP.md`.

**Citation convention.** Paths starting `harness/`, `evaluation/`, `sandbox/`,
`tasks/`, `scripts/`, `utils/` are relative to the harvey-labs clone
(`~/YeeBois/research/harvey-labs`, HEAD `55510f0e6`). Everything else is relative
to the beep-effect repo root (`main`, `6b42b239a6`). **Nothing under
`tasks/firm-knowledge/dms/` was opened** — the two corpus-derived numbers below
come from `task.json` files only. Reproduction commands are in §5.

**Posture.** Default skeptical. An opportunity survives only on evidence. Verdicts
are **KEEP** (graduate as pitched), **WEAKEN** (something real survives, named
explicitly), **KILL** (do not graduate).

---

## 0. Verdict table

| # | Opportunity | Lens rank | Verdict | One-line reason |
|---|---|---|---|---|
| **B-O1** | C&H as public acceptance gauntlet | benchmark #1 | **WEAKEN** | Real measurement instrument; but it does **not** unblock `practice-kg-mcp` P5, and its "zero patch" cost model omits podman, metered API keys, and a 2× measurement error |
| **B-O2** | `MatterSummary` amortized-representation schema | benchmark #2 | **WEAKEN** | Durable asset, wrong vessel — mints a second matter vocabulary beside the shipped `KgNodeKind` spine. Merge into D-O2 |
| **B-O3** | `beep eval` Effect-native rubric/judge harness | benchmark #3 | **KEEP** | Verified NET-NEW, pre-authorised by `DECISIONS.md`; sequence behind E-#1 |
| **B-O4** | Ingest-fidelity hardening with C&H defect fixtures | benchmark #4 | **KEEP** | The only opportunity needing no container, no API key, no rendered corpus |
| **B-O5** | Prove the enumeration-honesty law empirically | benchmark #5 | **WEAKEN** | Rides B-O1's blocked preconditions; the capability it "proves" already ships. Fold in as a third arm |
| **D-O1** | Conflicts & adversity rung | dms #1 | **WEAKEN** | "Smallest delta" measures the schema, not the work; the OIP-shaped conflict is a same-art problem, not an `adverse_to` edge |
| **D-O2** | Matter lifecycle spine | dms #2 | **KEEP** | Largest verified-empty gap, lands on an existing entity; must be routed through `law-docketing-patent-spine` |
| **D-O3** | Closure / precision answer contract | dms #3 | **KEEP** | The one genuinely novel idea; three lenses converged on it independently — land it **once** |
| **D-O4** | Precedent bank with typed version roles | dms #4 | **WEAKEN** | Version-role domain survives; the precedent query depends on `hybrid-retrieval-fusion-core`, verified not started |
| **D-O5** | Shape catalog as acceptance matrix | dms #5 | **KEEP** | Zero code, fills a documented empty slot; ship as a matrix, not a runnable suite |
| **E-#1** | `beep lint judge-rubric` + brace-scan rung | eval #1 | **KEEP** | Verified defect, ~15 lines, highest value-per-line in the packet |
| **E-#2** | Criterion-scoped judge calls for `beep qa` | eval #2 | **WEAKEN** | Reopens a campaign that closed six days ago and never prices per-surface rubric authoring |
| **E-#3** | All-pass gate + delete `weights` | eval #3 | **WEAKEN** | The all-pass gate **already exists** downstream; the continuous score is a training reward, not a gate. Only the `weights` deletion survives |
| **E-#4** | Acceptable-either-way band + semantic precision | eval #4 | **WEAKEN** | Same schema as D-O3 and S-O1's `BoundaryPolicy`; merge, and it inherits E-#2's gate |
| **E-#5** | Dual-judge on clean rounds only | eval #5 | **KILL** | Doubles cost to solve a failure mode with zero observed instances, copying LAB's provably self-inconsistent component |
| **S-O1** | `MatterSpec`/`Feature`/`MatterPlan` kernel + derived rubrics | synth #1 | **WEAKEN** | The "only path to a graded OIP eval" premise is false — published file wrappers are public and already owned by `uspto-prosecution-read` |
| **S-O2** | `@beep/pandoc` process driver | synth #2 | **KEEP (reroute)** | Already a named candidate packet in `explorations/docx-roundtrip-interop/MAP.md`; cite it, do not re-mint it |
| **S-O3** | Closed-loop render → extract → recover the pins | synth #3 | **KEEP (conditional)** | The falsification design for the whole generation strand — but a gate on S-O1, not an independent opportunity |
| **S-O5** | Shadow-corpus statistics mirror | synth #4 | **WEAKEN** | Not a work item; a confidentiality question to grill before scoping |
| **S-O4** | `beep corpus synth` operator surface | synth #5 | **KILL** | Packaging for an unbuilt capability; the one durable idea (preflight-before-spend) is a design law, not a packet |

**Tally: 6 KEEP, 2 KEEP-with-condition, 10 WEAKEN, 2 KILL.**

The four lens reports are of high quality — `verify-facts.md` graded the upstream
map layer at 251/286 CONFIRMED, and that reliability carries through. Almost
every refutation below is about **framing, ownership, or unpriced preconditions**,
not about a falsified fact. Two exceptions are genuine factual corrections (§1.3,
§1.4) and one is a genuine "already shipped" finding (§2.13).

---

## 1. Cross-cutting refutations

These hit multiple opportunities and should be fixed once, in the packet, before
anything graduates.

### 1.1 The execution preconditions nobody costed

Three lens reports assume a LAB run is a matter of pointing the harness at a
directory. On this workstation it is not.

| Precondition | State | Evidence |
|---|---|---|
| **podman** | **ABSENT** | `which podman` → not found. `docker` is present but unused by LAB: `sandbox/sandbox.py` hardcodes `["podman", …]` at `:205`, `:237`, `:252`, `:259`, `:279`, `:290`, `:297`, raises `PodmanError`, and its error text says "Harvey Labs requires podman to be installed and running" (`:269`). There is no runtime-selection seam. |
| **podman installer** | **wrong distro** | `scripts/setup.sh:230-233` Linux branch is `apt-get install -y -qq podman`. This machine is CachyOS/Arch — the script's Linux path does not apply, so install is manual `pacman`, i.e. a **sudo YubiKey touch** (machine rule). |
| **pandoc** | **ABSENT** | `which pandoc` → not found. `mine-synthetic-corpus.md` §7 flagged this as UNVERIFIED; it is now verified absent, and it is a hard prerequisite for S-O2's first proof. |
| **Metered API keys** | **unaddressed** | Every adapter takes a raw provider key (`harness/adapters/anthropic.py`, `openai.py`, …). The operator's quota model is subscription OAuth across three providers (global routing doctrine), which does not drive the Anthropic Messages API. |

The API-key problem has exactly one cheap escape and it is worth recording,
because it changes what B-O1 can claim. `harness/adapters/fireworks.py:28-35`
reads `FIREWORKS_API_BASE` from the environment and passes an explicit
`api_key`, so the Fireworks adapter can be pointed at a local OpenAI-compatible
endpoint (the CLIProxyAPI already running on this machine). Model calls happen
**on the host** — `--network=none` only isolates the container — so this works
mechanically. Two caveats travel with it: (a) it makes the run non-comparable to
any published baseline, which B-O1 already concedes for other reasons; (b)
whether driving a subscription through a proxy for automated benchmarking is
within the provider's terms is **an open question, not a finding** — ask before
running.

**Consequence.** B-O1, B-O5, and D-O5's *runnable* half all sit behind a
podman install and a model-access decision. None of the four lens reports
mentions either. Any appetite that does not include them is not honest.

### 1.2 "Unblocks `goals/practice-kg-mcp` P5" is false

This is the single load-bearing claim in `mine-benchmark-integration.md` §0 —
it is what makes B-O1 rank 1 — and it does not survive contact with the packet.

What P5 is actually waiting on, from the source:

- `goals/practice-kg-mcp/PLAN.md:19` — "Remaining: **Tom's correctness calls** on
  G-1..G-5." A human judgement on his own corpus.
- Same row — "**AC-2 unmet** — node provenance absent, blocker B-2." A missing
  *capability* (graph nodes carry no provenance), not missing evidence.
  `SPEC.md:40` (D-10) makes this explicit: "AC-2 as a whole remains unmet until
  node provenance exists or is declared out of scope with a typed capability
  boundary."
- `SPEC.md:40` (D-10b) — AC-4 runs "in Claude Desktop on the Windows target";
  "AC-6 remains Tom installing and querying unassisted."
- `PLAN.md:20` — P6 graph-integrity repair (client-dimension extraction,
  mention-derived family fan-out) gates AC-6.

A rubric-graded run against a **different corpus** (transactional/litigation
matters) on a **different spine** (C&H is client → matter → document; PracticeKg
is client → docket_family → application → patent → document, verified at
`packages/law-practice/domain/src/values/KgNodeKind/KgNodeKind.model.ts:38-46`)
discharges none of those. It cannot supply Tom's correctness call, cannot create
node provenance, cannot run in Claude Desktop on Windows, and cannot be
installed by Tom.

**What survives:** C&H is a *complementary regression surface* for the
enumeration/closure capability class — repeatable and publishable where the
five-question gauntlet is neither. That is genuinely valuable and it is enough to
justify the work. It is not acceptance evidence for any acceptance criterion in
any goal packet, and the packet must stop saying it is.

### 1.3 CORRECTION — the filename-citing measurement is ~1.9× low

`mine-benchmark-integration.md` §0 fact 1 — the arithmetic behind "Layer 1 alone
targets 85% of the grading surface" — is built on a backtick-only regex without
saying so.

| Claim (mine-benchmark §0) | Reproduced |
|---|---|
| 2,638 / 3,098 criteria (85.1%) cite a matter id | **CONFIRMED** — 2,638 (85.2%) |
| 295 (9.5%) cite a filename | **CORRECTED** — 295 is the *backticked* count (matching `verify-facts.md` T23). Counting all filename mentions gives **557 (18.0%)** |
| 200 of 250 tasks contain zero filename-citing criteria, carrying 2,466 of 3,098 | **CORRECTED** — that reproduces only under backtick-only matching. Counting all mentions: **164 tasks**, carrying **1,901** criteria |

`verify-facts.md` T24 already supplies the disconfirming evidence — it counts
"397 distinct filenames cited 663 times… backticked or not" — so the two reports
disagree with each other and the narrower measure won without argument.

**Consequence.** 86 tasks carrying **1,197 criteria (38.6%)** cite at least one
filename. The Layer-1-only thesis addresses tasks carrying ~61% of criteria, not
~80%. Layer 2 (extracted text + BM25) is needed earlier than the plan implies,
which pushes cost and schedule the other way. The matter-id figure — the strong
half of the argument — is untouched.

### 1.4 CORRECTION — the BM25 SQL does not port to SQLite verbatim

`mine-benchmark-integration.md` §2.1 calls this "the single most load-bearing
reuse in the plan": the `fts_docstats`/`fts_postings`/`fts_terms`/`fts_bm25`
schema at `packages/law-practice/server/src/PracticeKg.fts.ts:142-170` "uses no
extension and no window functions beyond plain aggregates, so **the same SQL
ports to stock-image `sqlite3` verbatim**."

Read against the source, the tokenizer CTE is DuckDB-specific:

```sql
UNNEST(regexp_extract_all(lower(content), '[a-z0-9]+(?:[-/][a-z0-9]+)*')) AS term
…
COUNT(*)::BIGINT AS token_count
```

Executed against Python's stdlib `sqlite3` (3.53.1 on this machine):

| Construct | Result |
|---|---|
| `ln(2.0)` | **OK** |
| `CAST(1 AS VARCHAR)` | **OK** |
| `regexp_extract_all(...)` | **FAIL** — no such function |
| `unnest(...)` | **FAIL** — no such function |
| `1::BIGINT` | **FAIL** — unrecognized token ":" |

**What survives:** the BM25 *scoring expression* (the `LN(...)` formula joining
postings/terms/docstats) is portable, and the three-table shape is portable. The
tokenizer and every `::TYPE` cast must be rewritten — tokenization moves to
Python, which is trivial but is not "verbatim". A load-bearing reuse claim
degrades to a formula reuse claim. **UNVERIFIED:** whether `python:3.12-slim`'s
bundled SQLite is compiled with `SQLITE_ENABLE_MATH_FUNCTIONS` (it works here;
the image was not probed).

### 1.5 Nothing depends on the absent generation pipeline

The brief asks whether any opportunity depends on pieces that do not exist,
naming the withheld generation pipeline. Answer: **no.** `mine-synthetic-corpus`
explicitly *reconstructs* the pipeline from renderer fingerprints rather than
depending on it, and says so (§1.1). Every other lens works from `task.json`
files and the beep checkout.

The pieces that genuinely do not exist, ranked by how much they gate:

1. **podman / pandoc / model access** (§1.1) — gate B-O1, B-O5, D-O5-runnable, S-O2.
2. **`goals/hybrid-retrieval-fusion-core`** — verified `active` but
   `README.md` "Latest Evidence: **Not started.**", manifest `statusNote`: "P0
   must audit live symbols/topology…". Gates D-O4's precedent query.
3. **cognee / basic-memory / knowledge-vault as beep runtime** — `mine-benchmark`
   §2.3 says these are docs, not code. **CONFIRMED**: `rg -l -i cognee`
   returns only `goals/`, `explorations/`, and `docs/` files, zero under
   `packages/`. Any opportunity phrased as "point cognee at C&H" is an
   integration project.
4. **A `beep eval` command group** — **CONFIRMED absent**: the 28 groups under
   `packages/tooling/tool/cli/src/commands/` contain no `Eval`, and
   `rg "allPass|all_pass"` over the CLI returns nothing.

### 1.6 Duplication ruling

| Opportunity | Collides with | Ruling |
|---|---|---|
| S-O2 `@beep/pandoc` driver | `explorations/docx-roundtrip-interop/MAP.md` row **`pandoc-driver-sidecar`** ("Wrap the Pandoc executable as a repo-level driver… future NET-NEW `@beep/pandoc`"), with `docx-fixture-pipeline` sequenced behind it. Exploration is `graduate`/`graduated`; the packet was never opened. | **Duplicative.** Cite the existing MAP row; do not re-decompose. This packet's only new contribution is the verified-absent pandoc binary. |
| B-O2 `MatterSummary` | D-O2 matter lifecycle spine (same lens family, different report) | **Duplicative in substance.** Two reports independently proposed a matter-shaped structural model. Merge. |
| D-O3 closure contract / E-#4 acceptable-either-way / S-O1 `BoundaryPolicy` | each other | **Three spellings of one schema** (`required` + `acceptableEitherWay` + justification, with a closure verdict). Convergence across three independent lenses is the strongest signal in the packet — and it must land **once**, in one owner, or the repo gets three incompatible closure types. |
| D-O2 matter lifecycle (`MatterStatus`, `openedAt`/`closedAt`) | `goals/law-docketing-patent-spine` (`active`, manifest: "patent v1 is **blocked** until `goals/law-docketing-reliability` proves the independent kill-app alert and restore/backfill/reconciliation path") | **Overlapping ownership.** Matter status and dates are docketing-spine vocabulary. Route through that packet; do not land a parallel lifecycle domain. |
| D-O4 precedent query | `goals/hybrid-retrieval-fusion-core` (owns RRF fusion; not started) | **Partially duplicative.** The version-role domain is free of it; the precedent query is not. |
| E-#3 all-pass gate | `tools/skillopt/src/beep_skillopt/adapter.py:591` — `result["hard"] = 1.0 if score >= 0.999 else 0.0` | **Already shipped.** See §2.13. |
| E-#2 criterion-scoped judge | `goals/recorded-qa-acceptance` (`completed-retained`, closed 2026-08-01 with named follow-ups) | **Re-opens a just-closed contract.** See §2.12. |
| B-O3 `beep eval` | `goals/agent-effectiveness-loop` (legacy `phase1-complete`), `goals/coding-agent-effectiveness-evidence-loop` (`active`), `goals/jsdoc-worker-eval` | **Not duplicative.** Those measure agent effectiveness and doc quality; none owns rubric/judge infrastructure. B-O3 would *unify* four existing scoring surfaces, which is a real argument for it and also a real scope risk. |
| B-O1 acceptance gauntlet | `goals/practice-kg-mcp` P5 | **Not duplicative — mis-attributed.** See §1.2. |
| D-O5 shape catalog | `docs/ROADMAP.md:76` "Tom's captured real questions (practice-kg-mcp P5 handoff)" | **Fills a verified-empty documented slot.** `goals/practice-kg-mcp/PLAN.md:22` (P8) confirms the questions are captured only *after* handoff, which has not happened. |

---

## 2. Per-opportunity verdicts

### 2.1 B-O1 — C&H as the public acceptance gauntlet — **WEAKEN**

**Survives:** a repeatable, publishable, externally-graded measurement of the
enumeration/stopping capability, on a corpus that is MIT-licensed and therefore
committable, screenshottable, and shareable — which Tom's corpus can never be.
The `docs_dir` seam is real: `harness/run.py:59-61` resolves any relative
`docs_dir` and `sandbox/sandbox.py:365-367` mounts it `ro`, so a sibling
`env/{dms,index}` layout needs no Python change. The stratified 40-task first
experiment and the mandatory filename-ablation arm are both good design and
should be kept verbatim.

**Killed:** the P5-unblocking claim (§1.2); "zero cost, zero patch" (§1.1 — a
podman install and a model-access decision are the actual first tasks); the
80%-of-criteria framing (§1.3); "the same SQL ports verbatim" (§1.4).

**Also worth pricing, unmentioned in the report:**

- `harness/run.py:46` — `task_dir = BENCH_ROOT / "tasks" / Path(*parts)`. The
  derived task set **must live inside the harvey-labs clone's `tasks/`**. The
  report says "derived, not committed to harvey-labs", which then requires
  `.git/info/exclude` or a fork. Minor, but it is not a beep-repo artifact.
- `/workspace/documents` is mounted **read-only**. A SQLite index read from it
  must be opened `file:...?mode=ro` and must not be in WAL mode, or reads can
  fail on a read-only directory. Not fatal; it is a spec line the index emitter
  must carry. **UNVERIFIED** — not exercised.

**Reframed verdict:** graduate as *"an external measurement of the amortized-index
thesis"*, gated on a podman + model-access decision, with the ablation arm as a
hard gate and no acceptance-criterion claim attached to any goal packet.

### 2.2 B-O2 — `MatterSummary` as the first amortized-representation schema — **WEAKEN**

**Survives:** the insight, which is the best one in the report — lifecycle is
encoded by folder *presence and absence*, so `Option`/`HashSet` with meaningful
absence is the right modelling, and `FolderLabel` as a brand that rejects `/`
turns C&H's own path-injection artefact (33 phantom directories, `verify-facts`
C33) into an unrepresentable state.

**Attacked:** the vessel. beep's live node vocabulary is
`KgNodeKind = LiteralKit(["client","docket_family","docket","application","patent","document","email_archive"])`
(verified, `KgNodeKind.model.ts:38-46`), and `Matter` already exists as an entity
with four fields (`Matter.model.ts:48-81`). Landing a *new* `MatterSummary` /
`CorpusDigest` family beside them creates a second matter vocabulary in
`law-practice` — precisely the divergence the slice cannot afford, and precisely
what D-O2 proposes to avoid by extending what is there.

**Reframed verdict:** not an independent opportunity. Fold the absence-is-meaningful
modelling and the `FolderLabel` brand into **D-O2**, which owns the same territory
from the shipped-vocabulary side.

### 2.3 B-O3 — `beep eval` — **KEEP** (sequence behind E-#1)

**Survives intact.** The gap is verified (no `Eval` command group; no `allPass`
anywhere in the CLI), the decision to roll our own is already recorded
(`DECISIONS.md`, 2026-08-08), and the four improvements-on-the-source it names
(evidence required by schema, one reconciliation rule, one shared provider
domain, additive metric versioning) are each grounded in a specific verified LAB
defect.

**One honest correction to the framing.** The report treats `beep eval` as rank 3
of 5 within one lens, which understates it: it is the **largest** of the twenty,
it would unify four existing scoring surfaces (`beep qa judge-*`,
`docgen quality`, `docgen quality-worker-eval`, `agent-effectiveness evals`), and
it is a *dependency of B-O1's run-2 scoring*, not a prerequisite of run 1 (run 1
uses LAB's evaluator by design, §3.4 of that report). Sequence it after E-#1,
which is its cheap down-payment on the same surface.

### 2.4 B-O4 — Ingest-fidelity hardening with C&H defect fixtures — **KEEP**

**Strongest survivor in the packet.** It is the only opportunity with no external
dependency: no container, no API key, no rendered corpus, no unstarted goal.

Verified directly:
`packages/foundation/capability/file-processing/src/Strategy/index.ts:99-133`
lists 14 `FileFormatFamily` members and `fromExtension` has **no `pptx` case and
no `eml` case** — both fall to `"unknown"`. That is 660 of 9,288 C&H files
(7.1%), and it is the same gap for any real DMS connector. The defect corpus
(`verify-facts` C25 16/235 leaked directives, C26 81/235 unexpanded `TOC \o`
field text, C28 empty `.eml` headers, C33 the phantom `FTC/` directory) is
MIT-licensed and therefore *committable*, which is the whole point.

**One scope cut:** the tracked-changes half (168 redline files, `verify-facts`
C24 — note **168**, not the 169 two map sections claim) is a materially harder
slice with its own UNVERIFIED (whether `@beep/pandoc-ast` preserves `w:ins`/`w:del`
at all). Do not let it ride in on the format-family extension.

### 2.5 B-O5 — Prove the enumeration-honesty law — **WEAKEN**

**Attacked on two axes.** (a) It rides entirely on B-O1's infrastructure, so it
inherits every precondition in §1.1 — it is not "cheap", it is *marginal on top of
something expensive that has not been costed*. (b) The capability it would
"prove" already ships:
`packages/law-practice/use-cases/src/PracticeKg.tools.ts:185-197` —
`PracticeKgToolResult` carries `total`, `truncated`, and `tier` (verified). The
repo does not need a benchmark to adopt a law it already follows.

**Survives:** the *measurement* — does honest truncation signalling actually change
agent behaviour, or is it hygiene we believe in for taste reasons? That is a
genuinely interesting result and it is one extra condition on a run that is
already happening. **Reframed verdict:** not an opportunity; a **third arm of
B-O1's experiment**, beside the no-index and ablation arms.

### 2.6 D-O1 — Conflicts & adversity rung — **WEAKEN**

**Survives:** conflicts is a real, recurring, high-stakes OIP workflow; C&H proves
the source artifact exists in a real DMS in three non-canonical spellings
(`conflict-check-memo.docx` 47 / `conflict-check-memorandum.docx` 38 /
`conflicts-check-memorandum.docx` 9 — `verify-facts` C12/C13, all exact); and
tasks 200 / 201 / 214 / 176 are excellent acceptance fixtures.

**Three attacks:**

1. **"Highest value, smallest delta" measures the wrong thing.** The delta *is*
   small — adding literals to two `LiteralKit`s is a compile-checked change. But
   the report concedes in the same section that "party resolution is the hard
   half", and `rg -l -i "adverse|counterparty|opposing.?party" packages/` returns
   zero files, so the extraction is entirely NET-NEW. Ranking by schema-delta
   size ranks the cheap 10% of the work.
2. **The OIP transfer is half-claimed.** The report rates F6 party-role
   "**Strongly**" for OIP and then defines the OIP question as *"adverse to this
   client — or prosecuted for a direct competitor in the same art"*. Only the
   first clause is an `adverse_to` edge. The second — the characteristic
   prosecution conflict — is a subject-matter similarity problem over CPC class
   and art unit, which comes from USPTO official data (`goals/uspto-prosecution-read`,
   `goals/uspto-mcp`), not from an adversity graph. The proposed schema serves the
   litigation-shaped conflict, which for a solo prosecution practice is the rarer
   half.
3. **The professional-responsibility framing raises the bar past what is
   achievable.** "The only capability whose absence is a professional-responsibility
   exposure" is an argument for urgency that is also an argument for a near-100%
   recall gate — and the C&H baselines are the evidence that frontier agents
   regress to 0% all-pass exactly as the enumeration set grows. A partial
   automated conflicts check is worse than none: it converts an attorney's
   deliberate manual process into a false-negative surface.

**Reframed verdict:** ship it as a **retrieval-assist surface with an explicit
"this is not a conflicts clearance" typed boundary**, plus the unresolved-alias
channel the report already names (identity drift is verified: `verify-facts` C29
found a 2/2 split on one person's address inside one matter). Drop the
professional-responsibility framing; it writes a cheque the capability cannot cash.

### 2.7 D-O2 — Matter lifecycle spine — **KEEP** (routed, not standalone)

**Survives, and absorbs B-O2.** The gap is verified empty in the strongest sense:
`rg -n -i "matterStatus|matter_status|openedAt|closedAt" packages/law-practice`
→ 0 hits, and `Matter` carries exactly four fields (`Matter.model.ts:48-81`,
read directly). The single-valued proof fixtures are real
(`MatterType = LiteralKit(["patent_application"])`). The topological-derivation
trick — lifecycle from folder presence/absence before prose extraction — is the
cheapest real technique the whole packet found, and it is what makes this
tractable rather than an extraction project.

**One hard routing constraint the report misses.** `MatterStatus`, `openedAt`,
`closedAt` are docketing-spine vocabulary, and `goals/law-docketing-patent-spine`
is `active` with a manifest that says "patent v1 is **blocked** until
`goals/law-docketing-reliability` proves the independent kill-app alert and
restore/backfill/reconciliation path". Landing a parallel lifecycle domain from
this packet would fork the vocabulary of a blocked, active packet. This must
graduate *through* or *coordinated with* that packet.

**One honest caveat the report already states and should keep:** whether the
Oppold corpus's docket status is topologically derivable the way C&H's is remains
**UNVERIFIED** — nobody inspected the per-family folder shape. That is the first
thing to check, and it is a `ls` away.

### 2.8 D-O3 — Closure / precision answer contract — **KEEP** (land once)

**The one genuinely novel idea in the packet**, and the convergence evidence is
strong: three independent lenses proposed the same schema (D-O3's
`RetrievalAnswer`, E-#4's `required`/`acceptableEitherWay`/`ambiguityReason`,
S-O1's `BoundaryPolicy`). The upstream evidence is the most reproducible in the
whole census — `verify-facts` E18/T28 confirm **61** `ACCEPTABLE EITHER WAY`
criteria across 61 tasks, and T27 confirms **140** tasks carry exactly one
`The answer does not assert` closure criterion.

**One correction to "verified absent".** Closure *signalling* is not absent —
`PracticeKgToolResult { total, truncated, tier }` is disclosure-closure, and
`Inventory.schemas.ts` `RequiredCountCoherenceCheck` is a schema-level coherence
gate that makes a miscounted verdict a decode failure. What is absent is closure
over an asserted **answer set**. Say that precisely; the overclaim invites a
reviewer to find the counterexample and discount the rest.

**Binding condition:** one owner, one schema. Three closure types would be worse
than none.

### 2.9 D-O4 — Precedent bank with typed version roles — **WEAKEN**

**Survives:** the `DocumentVersionRole` literal domain
(`draft | redline | execution | final | amended | as_filed`) as a field on the
document node. It is cheap, it is compile-checked, and the upstream evidence is
solid (`verify-facts` C14: `execution` 262, `redline` 168, `final` 165, `amended`
55 — all confirmed; `draft` corrected to 785/797). Prosecution is
version-critical; "the as-filed response, not the draft" is a daily question.

**Killed for now:** the precedent *query* ("every prior document where we argued
X, with the controlling copy"). The report itself cites
`goals/hybrid-retrieval-fusion-core` as the owner and ranks this fourth because
of it — and that packet is verified **not started** (README "Latest Evidence: Not
started."; manifest: P0 symbol audit pending). Do not graduate a capability whose
ranking rationale is "it depends on something that has not begun."

### 2.10 D-O5 — Shape catalog as acceptance matrix — **KEEP, do first**

**Cheapest real artifact in the packet.** Zero code. The slot it fills is
verified empty: `docs/ROADMAP.md:76` names "Tom's captured real questions
(practice-kg-mcp P5 handoff)" as the P4/P5 requirements source, and
`goals/practice-kg-mcp/PLAN.md:22` puts that capture in P8, after a handoff that
has not happened. The shipped acceptance surface really is five questions
(`history/p5/2026-07-30-ac4-ac5-gauntlet.md`, G-1..G-5 table read directly) —
and that record is admirably honest about its own qualifications ("Do not
summarize this as a clean five-of-five").

**One correction.** The 14-task / 52-criteria smoke suite cannot be *run* without
§1.1's preconditions. Split the deliverable: the **requirements matrix** (14 shapes
→ 10 capabilities → the OIP translation) is free and should ship immediately; the
**runnable smoke suite** is a B-O1 artifact and inherits its gates.

**Also worth copying, and the report is right about it:** the triad generator
(one ground-truth feature → enumeration + count + most-recent task) is a
near-zero-marginal-cost acceptance-authoring pattern. `verify-facts` T18 marks
the triads "UNVERIFIABLE as a generator claim" but confirms the titles are
consistent with it — which is enough to adopt the *pattern* without asserting the
*mechanism*.

### 2.11 E-#1 — `beep lint judge-rubric` + brace-scan rung — **KEEP**

**Verified and it survives whole.** Read directly at
`packages/tooling/tool/cli/src/commands/Qa/JudgeCheck.ts:357-394`:
`extractLastJsonBlock` is `O.orElse(lastMatch(text, FENCED_JSON), () => lastMatch(text, FENCED_ANY))`
— exactly two rungs, both requiring a fence. A judge that emits correct,
schema-valid, **unfenced** JSON returns `O.none` and the round hard-fails at
ingest, discarding a capture, an extract, and a paid vision-judge pass. LAB's
`evaluation/judge.py:232-259` has the same two stages *plus* a balanced-brace
scan (`verify-facts` E30, CONFIRMED). That is ~15 lines that convert a wasted
round into a successful ingest.

The lint half is equally real: no test reads
`.claude/skills/browser-qa-loop/resources/judge-prompt.md`, so the 16 `QaLens`
literals and their prose twins agree only by hand. `beep lint reflection-artifacts`
is the in-repo precedent for lint-gating an authored artifact.

**No refutation found.** This is the highest value-per-line item in all four
reports and it should ship regardless of what else graduates.

### 2.12 E-#2 — Criterion-scoped judge calls — **WEAKEN**

**Survives:** the structural argument is sound — per-criterion scoping removes
the 8 MiB `dropped` cliff, makes verdicts independently attributable and
re-runnable, and creates the denominator E-#3/E-#4 need. And the shape is proven
in-repo (`docgen quality-worker-eval` runs one call per packet with a closed
context).

**Two attacks:**

1. **Timing.** `goals/recorded-qa-acceptance` closed `completed-retained` on
   2026-08-01 with amended exit criteria, a named lane decision, and explicit
   follow-ups ("Lane C productionization and the smear-capable fixture graduate
   to a follow-up packet"). Reopening the judge *contract* seven days later,
   before those named follow-ups land, re-litigates a campaign that was closed
   deliberately and with unusual rigour.
2. **Unpriced authoring cost.** `beep qa` today requires **zero** per-surface
   rubric authoring — the judge is an open-ended defect generator and that is why
   it caught "five real defects across rounds that harness assertions missed"
   (recorded-qa-acceptance, falsification row). Criterion-scoping requires a
   rubric per surface, maintained forever, and LAB's own `CONTRIBUTING.md:87-99`
   warns that "nice-to-have padding" actively degrades all-pass. The report
   prices the mechanism and not the ongoing authoring tax.

**Reframed verdict:** scope to the **motion lenses only** — the eight lenses where
frame strips and GIFs actually overrun the 8 MiB budget — leaving the static
lenses on the open-ended bundle. That captures the budget win without converting
an open-ended defect finder into a checklist. Sequence behind E-#1 and behind
`recorded-qa-acceptance`'s named follow-ups.

### 2.13 E-#3 — All-pass gate + delete `weights` — **WEAKEN, sharply**

**The all-pass half is already shipped, one layer down.**
`tools/skillopt/src/beep_skillopt/adapter.py:589-593`:

```python
score = max(0.0, min(1.0, float(score_payload.get("score", 0.0) or 0.0)))
result["soft"] = score
result["hard"] = 1.0 if score >= 0.999 else 0.0
```

and `:671` — `correct_count = sum(1 for row in existing if row.get("hard", 0))`.
That `hard` value **is** the all-pass gate the report proposes to add, computed
from the continuous score the report proposes to replace.

The framing error is deeper than the duplication. The report argues that
`score = completion_frac * law_frac` is "the '95% useful' fallacy applied to a
repo-law conformance test". But this scorer's consumer is a **training loop**,
not an acceptance gate, and `soft`/`hard` is the standard reward-shaping split:
the continuous channel supplies gradient, the binary channel supplies the metric.
LAB's "a diligence memo that catches 95% of issues… is wrong"
(`docs/eval-strategies.md:98`, verified) is an argument about *shipping a
deliverable*, and it does not transfer to reward shaping. Collapsing `score` to
binary would destroy the signal the trainer consumes.

**What survives, and it is real:** the `weights` block is a verified footgun —
`SkillOptTaskWeights` is annotated "Manifest weighting metadata retained for
compatibility; scorer formula remains contract-fixed"
(`AgentEffectiveness.schemas.ts:85-93`) and **all 12** corpus tasks populate
`{"completion": 0.5, "law": 0.5}`, so an author can set it and believe it
matters. LAB bans the identical field with a build-failing test
(`tests/test_task_integrity.py:157-160`, verified). Make it a decode failure.
Also keep: publish `p^n` beside any all-pass number so the two are never
conflated.

**Reframed verdict:** a ~1-hour hygiene change, not an opportunity. Rank it out
of the list and into whatever PR touches that file next.

### 2.14 E-#4 — Acceptable-either-way band + semantic precision — **WEAKEN (merge)**

**Survives:** the mechanism is genuinely absent in beep and the improvement on
the source is genuine — LAB's `ACCEPTABLE EITHER WAY` is prose inside a
`match_criteria` string honoured only because the judge model reads it
(`evaluation/prompts/rubric_criterion.txt` is a bare PASS/FAIL, 26 lines,
verified). Modelling it as `required` / `acceptableEitherWay` / `ambiguityReason`
and enforcing it in the scorer is better than the thing it is copied from.

**Attacks:** (a) it is the same schema as D-O3 and S-O1's `BoundaryPolicy` (§1.6)
— merge; (b) it depends on E-#2 shipping first ("there is nowhere to put a
criterion-level neutral band until criteria exist"), and E-#2 is itself weakened
and gated, so E-#4 inherits two gates.

**Reframed verdict:** absorb into D-O3's single closure schema; it is one field
family, not a separate opportunity.

### 2.15 E-#5 — Dual-judge on clean rounds only — **KILL**

The report itself calls it "lowest confidence, highest marginal cost, and the
reference implementation is the one part of LAB that is provably
self-inconsistent." Every one of those is correct and `verify-facts` E53/E54
confirms the inconsistency exactly (`report.py:53` AND-merges while `:68` takes
the mean, so a task renders `Score 0.875` beside `Criteria Passed 7/8`).

Adding the case against:

- **The failure mode has zero observed instances.** The documented
  `recorded-qa-acceptance` history is a list of the judge's **true positives**
  ("caught five real defects across rounds that harness assertions missed"). The
  falsification round's finding was that the *fixture* could not express the
  defect, not that the judge missed one. There is no false-clean round on record.
- **beep's judge already carries the anti-fabrication machinery LAB lacks** —
  mandatory evidence on every finding, `crossCheckEvidence` against the round
  root, `crossCheckAgainstRound` on event ids, re-validated at lint time.
- **The cost lands on the rounds you least want to pay for** — a second full
  vision pass on every round that was about to exit clean.

**Verdict: do not graduate.** Record the idea in the packet against the day a
false-clean round is actually observed; that observation is the trigger, and it
has not fired.

### 2.16 S-O1 — `MatterSpec` / `Feature` / `MatterPlan` kernel — **WEAKEN**

**Survives, and it is the best thinking in the packet.** "Ground truth is
computed, never read back" is the real invention; the three pinning granularities
are verified end-to-end by `map-corpus`; the fix-on-the-way-in table (§4.3) is a
genuinely good argument that a schema-first port beats consuming the artifact;
and rubric derivation as `S.encode` rather than authoring is the right shape.
The repo genuinely owns the prosecution vocabulary already
(`packages/law-practice/domain/src/entities/` — `OfficeAction`, `Rejection`,
`Claim`, `PriorArtReference`, `IdsSubmissionFact`, `PatentAsset`, verified) and
`Random.withSeed` is verified live at `.repos/effect/packages/effect/src/Random.ts:290`.

**The load-bearing premise is false as stated.** §0: *"beep currently cannot
measure its own retrieval / KG / ingestion quality on the one domain it exists to
serve… A generated patent-prosecution corpus with computed ground truth is the
**only path** to a graded eval."*

The standing rule bans **pre-publication** patent text from cloud AI. Published
applications, issued patents, and their USPTO file wrappers are **public
documents** — and `goals/uspto-prosecution-read` and `goals/uspto-mcp` already
own retrieving exactly that data ("known-application, provenance-bearing USPTO
prosecution observation"). A graded eval built from the public file wrappers of
Tom's own *published* families is real, carries genuine ground truth, needs no
synthesis, and has no confidentiality exposure. It is a competing option the
report never considers, and it is cheaper.

Two honesty notes that follow:

- Synthesis remains the right answer for the shapes that are *never* public —
  drafts, invention disclosures, client correspondence, work product. That is a
  narrower and much more defensible scope than "the only path".
- The **appetite is not honest**. "2–3 weeks" prices the schema kernel; §7 of the
  same report concedes "No estimate for authoring a 35-document matter (C&H's
  median)" and C&H has 266 of them. Prose generation is the dominant cost and it
  is unpriced.

**Reframed verdict:** graduate only after a recorded decision on *public-file-wrapper
eval vs synthetic eval*, and with the scope cut to non-public document shapes. The
schema kernel itself is sound; the justification needs rebuilding.

### 2.17 S-O2 — `@beep/pandoc` process driver — **KEEP the work, KILL the ownership**

**Duplicative** (§1.6): `explorations/docx-roundtrip-interop/MAP.md` already
carries `pandoc-driver-sidecar` — *"Wrap the Pandoc executable as a repo-level
driver for later DOCX → JSON and JSON → DOCX conversion… future NET-NEW
`@beep/pandoc`"* — sequenced third, with `docx-fixture-pipeline` behind it. That
exploration is `graduated`; the driver packet was simply never opened. Its
first-slice rationale (do the pure mapping proof before the binary wrapper) has
now been discharged: `goals/pandoc-ast-foundation` is `completed-retained`.

**What this packet legitimately adds:** independent demand evidence (a synthetic
corpus renderer needs it, and so do `explorations/full-document-editor`,
`goals/rich-text-foundation`, `apps/oip-web`), plus one new verified fact — the
`pandoc` binary is **not installed on this workstation** (`which pandoc` → not
found), so the driver carries a toolchain-provisioning step (mise entry + CI
image) that the original MAP row did not anticipate.

**Verdict:** the right move is a one-line cross-reference from this packet to
that MAP row and a note that the prerequisite is now met — not a fresh
decomposition. Re-minting it here would put two packets on one driver.

### 2.18 S-O3 — Closed-loop render → extract → recover the pins — **KEEP (conditional)**

**Survives as the falsification design for the entire generation strand.** It is
the discipline Harvey demonstrably lacked: `verify-facts` C16 confirms the
`icoa` desync (a corpus-wide search for `*icoa*` returns exactly one file, the
comparison chart, while `tasks/092` C-003 requires "all executed versions"). A
spec that promises a feature the renderer did not express should fail the build.
It also doubles as an honest floor: if beep's own extraction cannot recover a
deliberately planted feature, no retrieval agent will.

**Condition:** strictly downstream of S-O1 *and* S-O2. It cannot start, cannot be
scoped independently, and should be written into S-O1's acceptance criteria
rather than tracked as its own opportunity.

### 2.19 S-O5 — Shadow-corpus statistics mirror — **WEAKEN**

**Survives as a question, not a work item.** The idea — parameterize a generator
from aggregate shape statistics of the real corpus so the synthetic one stresses
the stack at the shape it will meet — is clever and cheap given
`goals/oppold-corpus-pipeline`'s existing DuckDB catalog.

**The attack is the report's own caveat, taken seriously.** The standing rule
says "**When unsure whether material is pre-publication, ask before sending**",
and the report says "when unsure whether a statistic is specific enough to
identify a matter, ask before extracting it." With 105 docket families and one
attorney, a per-family size histogram plus a temporal density curve is close to
a fingerprint. That is a judgement for Benjamin and Tom, not for a scoping
document. It is also worth ~nothing until S-O1 exists.

**Reframed verdict:** a `DECISIONS.md` entry to be grilled ("does an aggregate
histogram derived from the corpus catalog cross the confidentiality line?"), not
a graduation candidate.

### 2.20 S-O4 — `beep corpus synth` operator surface — **KILL**

The report ranks it last and explains why: *"it is packaging: O1–O3 have to exist
first, and the CLI shape follows from what they need."* Packaging for an unbuilt
capability is not an opportunity — it is the last commit of whatever ships.

The one durable idea inside it — LAB's preflight-before-spend
(`utils/sweep.py:582` `run_preflight`, `:678` `--preflight-only`, both verified) —
is a design law to carry into any command that spends money, and it should be
written down as such. It does not need a packet.

---

## 3. What survives, and in what order

Sequenced by dependency, not by value.

**Tier 0 — ship regardless, no external dependency:**

1. **E-#1** `beep lint judge-rubric` + the brace-scan rung. Verified defect,
   ~15 lines for the high-value half.
2. **D-O5 (matrix half)** the 14-shape → 10-capability requirements matrix.
   Documentation only; fills a verified-empty ROADMAP slot.
3. **E-#3 residue** delete/reject the `weights` block. ~1 hour.

**Tier 1 — bounded, schema-first, no unstarted dependencies:**

4. **B-O4** `FileFormatFamily` + `pptx`/`eml`, C&H defect files as committed
   fixtures. Redlines excluded.
5. **D-O3 (+ E-#4 + S-O1's `BoundaryPolicy`)** one closure/answer-set schema, one
   owner, landed once.
6. **D-O2 (absorbing B-O2)** matter lifecycle spine, routed through
   `law-docketing-patent-spine`; first step is the free `ls` that tests whether
   the Oppold corpus is topologically derivable.

**Tier 2 — gated on a decision or a precondition:**

7. **B-O3** `beep eval` — after E-#1, and honest that it is the largest item here.
8. **B-O1 (+ B-O5 as a third arm)** — gated on a podman install and a recorded
   model-access decision (§1.1). Reframed as a measurement of the amortized-index
   thesis, with no goal-packet acceptance claim attached.
9. **S-O1 (+ S-O3 as its gate)** — gated on a recorded decision between public
   USPTO file-wrapper evals and synthetic generation, and on a real prose-cost
   estimate.
10. **D-O1** — as a retrieval-assist surface with an explicit non-clearance
    boundary, after D-O2 (adversity edges need a matter spine to hang on).
11. **D-O4 (version-role domain only)** — the precedent query waits on
    `hybrid-retrieval-fusion-core`.

**Rerouted:** S-O2 → `explorations/docx-roundtrip-interop/MAP.md` row
`pandoc-driver-sidecar`.

**Parked, not graduated:** E-#5 (trigger: a first observed false-clean round),
S-O5 (trigger: a confidentiality ruling), S-O4 (trigger: S-O1–S-O3 shipping).

**Three corrections to make in the packet before anything is quoted downstream:**

1. Strike "unblocks `goals/practice-kg-mcp` P5" everywhere (§1.2).
2. Fix the filename-citing numbers: 557 criteria / 164 filename-free tasks /
   1,901 criteria, and say the measure counts all mentions (§1.3).
3. Downgrade "the same BM25 SQL ports to sqlite3 verbatim" to "the BM25 formula
   ports; the tokenizer and casts do not" (§1.4).

---

## 4. UNVERIFIED in this report

- **Whether driving a subscription-OAuth proxy through `FIREWORKS_API_BASE` for
  automated benchmarking is within provider terms.** Mechanically possible
  (`harness/adapters/fireworks.py:28-35` read directly); the terms question is
  open and is a decision, not a finding.
- **Whether `python:3.12-slim`'s bundled SQLite has `SQLITE_ENABLE_MATH_FUNCTIONS`.**
  `ln()` works on this machine's SQLite 3.53.1; the LAB image was not probed
  (no podman).
- **Whether a read-only-mounted SQLite index actually opens for queries inside
  the sandbox.** Reasoned from the `ro` mount at `sandbox/sandbox.py:366`; not
  exercised.
- **Whether the Oppold corpus's docket status is topologically derivable** the way
  C&H's is (D-O2's cheap trick). Inherited UNVERIFIED from `mine-dms-taxonomy` §7;
  not checked here.
- **Whether `@beep/pandoc-ast` preserves OOXML tracked changes.** Inherited
  UNVERIFIED from two lens reports; not re-checked.
- **No LAB run was executed.** No podman, no container, no API call, no
  `results/`. Every runtime claim in every report — including the announcement's
  baselines — remains read from source or from the blog.
- **`tools/skillopt/` read only at the score-consumption seam**
  (`adapter.py:455-485`, `:570-600`, `:671`, `:711-717`). The trainer's full
  reward path was not read; the soft/hard characterisation in §2.13 rests on
  those lines plus the `correct_count` aggregation.
- **Appetite figures** in the lens reports (2–3 weeks, 3–5 days, 1 week) were not
  independently re-estimated; §2.16 challenges one of them on the report's own
  stated omission, not on a competing estimate.

---

## 5. Reproduction

```bash
# ── preconditions (§1.1)
which podman pandoc                       # both: not found
cd ~/YeeBois/research/harvey-labs
rg -n "podman" sandbox/sandbox.py | head  # hardcoded runtime, PodmanError
sed -n '228,236p' scripts/setup.sh        # Linux branch is apt-get only
sed -n '28,36p' harness/adapters/fireworks.py   # FIREWORKS_API_BASE override

# ── §1.2 practice-kg-mcp P5 residue
cd ~/YeeBois/projects/beep-effect13
rg -n "AC-2|AC-4|AC-6" goals/practice-kg-mcp/SPEC.md | head
sed -n '19,22p' goals/practice-kg-mcp/PLAN.md
sed -n '55,70p' goals/practice-kg-mcp/history/p5/2026-07-30-ac4-ac5-gauntlet.md

# ── §1.3 filename-citing correction (task.json only; dms never opened)
cd ~/YeeBois/research/harvey-labs && python3 -c "
import json,glob,re
fs=sorted(glob.glob('tasks/firm-knowledge/tasks/*/task.json'))
mid=re.compile(r'\b\d{4}-\d{5}\b')
anyfn=re.compile(r'[\w\-]+\.(?:docx|xlsx|pptx|eml|pdf)\b')
btfn=re.compile(r'\`[^\`]*\.(?:docx|xlsx|pptx|eml|pdf)\`')
tot=cm=ca=cb=0; ta=tb=cta=ctb=0
for f in fs:
    cs=json.load(open(f))['criteria']; tot+=len(cs); ha=hb=False
    for c in cs:
        m=c['match_criteria']
        if mid.search(m): cm+=1
        if anyfn.search(m): ca+=1; ha=True
        if btfn.search(m): cb+=1; hb=True
    if not ha: ta+=1; cta+=len(cs)
    if not hb: tb+=1; ctb+=len(cs)
print('total',tot,'matter-id',cm,'any-filename',ca,'backticked',cb)
print('filename-free tasks: any',ta,cta,'| backticked-only',tb,ctb)"
# -> total 3098 matter-id 2638 any-filename 557 backticked 295
# -> filename-free tasks: any 164 1901 | backticked-only 200 2466

# ── §1.4 BM25 SQL portability
cd ~/YeeBois/projects/beep-effect13
sed -n '130,175p' packages/law-practice/server/src/PracticeKg.fts.ts
python3 -c "
import sqlite3; con=sqlite3.connect(':memory:')
for e in ['SELECT ln(2.0)','SELECT regexp_extract_all(\'a b\',\'[a-z]+\')',
          'SELECT unnest(1)','SELECT CAST(1 AS VARCHAR)','SELECT 1::BIGINT']:
    try: con.execute(e); print('OK  ',e)
    except Exception as x: print('FAIL',e,'->',x)"

# ── §1.5 / §1.6 duplication + absence rulings
rg -l -i "cognee" --glob '!node_modules' .        # goals/ explorations/ docs/ only
ls packages/tooling/tool/cli/src/commands/         # no Eval group
cat explorations/docx-roundtrip-interop/MAP.md     # pandoc-driver-sidecar row
rg -n "Latest Evidence" -A 1 goals/hybrid-retrieval-fusion-core/README.md

# ── §2.11 / §2.13 verified defects
sed -n '355,395p' packages/tooling/tool/cli/src/commands/Qa/JudgeCheck.ts
sed -n '585,595p' tools/skillopt/src/beep_skillopt/adapter.py
python3 -c "
import json,glob
fs=sorted(glob.glob('goals/skillopt-training-pilot/corpus/tasks/*.json'))
print(len(fs), {json.load(open(f)).get('weights') and 'set' for f in fs})"

# ── §2.4 / §2.7 verified gaps
sed -n '99,133p' packages/foundation/capability/file-processing/src/Strategy/index.ts
sed -n '48,81p' packages/law-practice/domain/src/entities/Matter/Matter.model.ts
rg -n -i "matterStatus|matter_status|openedAt|closedAt" packages/law-practice   # 0
rg -l -i "adverse|counterparty|opposing.?party" packages/ --glob '*.ts'         # 0
```
