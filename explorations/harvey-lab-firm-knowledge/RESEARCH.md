# Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
-->

## 2026-08-08 — Mining run synthesis

Method: 12-agent opus-5 workflow (map → mine → verify; ~2.5M subagent tokens,
655 tool calls, 43 min) over the machine-local `harvey-labs` clone
(commit `55510f0e6`). Detailed reports live in [`research/`](./research/):
five maps (`map-*.md`), four opportunity lenses (`mine-*.md`), and three
verification passes (`verify-facts.md` — 286 checks: 251 CONFIRMED /
22 CORRECTED / 13 UNVERIFIABLE; `verify-refutations.md` — all 20 ranked
opportunities attacked; `verify-completeness.md` — coverage critique + align
questions). This file is the navigator; quote numbers only in their
`verify-facts.md`-corrected form.

## External Landscape

All external claims below trace to the scraped announcement
([assets/x-post…md](./assets/x-post-itsjuliopereyra-2085772997944803682.md)),
the clone itself, or a mining report section (cited); nothing else was fetched.

- **What C&H is (verified against the clone):** synthetic law firm inside
  MIT-licensed [harveyai/harvey-labs](https://github.com/harveyai/harvey-labs):
  266 matters / 46 clients / 9,288 files (8,055 docx, 615 eml, 573 xlsx,
  45 pptx) / 250 retrieval-reasoning tasks with 3,098 rubric criteria
  (median 7, mean 12.4, max 122). Corpus documents are real OOXML rendered by
  python-docx / openpyxl 3.1.5 / python-pptx over a Markdown+HTML-comment
  directive IR — the generation pipeline itself was **deliberately withheld**
  (commit `55510f0e6` stripped `_source_id`/`_family` provenance keys)
  ([map-pipeline-docs](./research/map-pipeline-docs.md),
  [map-corpus](./research/map-corpus.md)).
- **The announcement's thesis holds up, with one big caveat:** agents fail C&H
  because they lack an amortized "intermediate model of the corpus." Verified
  supporting mechanics: grep is byte-blind over zipped OOXML
  (`harness/tools.py:601-629`; 82 ASCII letter-runs vs ~47k chars of real text
  in one probe), and all-pass difficulty is arithmetic — at p=0.5 per
  criterion, expected all-pass is 10.19 of 250 tasks, ~0 for the 19 tasks with
  31+ criteria. Caveat: part of the "stopping failure" is a **harness
  artifact** — glob silently caps at 100 results and grep at 250 with no
  truncation notice, so enumeration is structurally impossible
  ([map-harness](./research/map-harness.md) §finding 1).
- **Their eval methodology is the durable import:** rubric-as-gold-standard
  (no golden files), one judge call per criterion at temperature 0, all-pass
  scoring with `n_passed` diagnostics, criterion-scoped deliverables, a
  structured-output degradation ladder + three-stage JSON salvage parser, and
  two rubric idioms — the terminal **precision/closure criterion** ("does not
  assert any matter outside this list", 140 singleton instances + 39 variants)
  and the **ACCEPTABLE EITHER WAY neutral band** (61 criteria)
  ([map-evaluation](./research/map-evaluation.md),
  [map-task-census](./research/map-task-census.md)).
- **Their code is reference-grade, not port-grade** (consistent with
  DECISIONS 2026-08-08): verified defects include `finished_cleanly:true`
  always recorded, dual-judge arithmetic self-inconsistent (mean vs AND-merge),
  criterion scoping optional and bypassed by 100% of firm-knowledge tasks, and
  a **redline-blind pipeline** — both agent-read and judge-read strip
  `w:ins`/`w:del` while 393 tasks / 5,945 criteria grade redline work
  ([verify-completeness](./research/verify-completeness.md) §G2 — new defect
  found by our run, likely the sharpest wedge).
- **Scale correction:** the firm-knowledge slice we mined is 12.4% of tasks /
  2.7% of criteria / 9.8% of bytes in the repo. On disk: 2,010 task.json /
  114,912 criteria across 27 areas (badge says 1,671; docs say 1,660) —
  including 444 draft / 306 review / 488 analyze deliverable-producing tasks
  and 11 diligence data rooms up to 1,114 criteria, plus 147 IP rubrics
  (patent-litigation drafting exists; patent *prosecution* does not)
  ([verify-completeness](./research/verify-completeness.md) §0, §G1).
- **Engram** (collaborator) has published prior art for the amortization
  thesis itself (Cartridges / Active Reading — UNVERIFIED snippet-level;
  [verify-completeness](./research/verify-completeness.md) §G4). We would be
  entering a claimed race on that axis; the redline-ingest axis is unclaimed.
- **Baselines** (GPT-5.6-sol, Opus-4.8: ~half of criteria, 5+ min/task) trace
  only to the marketing post; whether they used this public harness is
  UNVERIFIED (U7).

## In-Repo Capability Inventory

Verified live by the mining lenses (every cite re-checked by rg/ls; see
[mine-benchmark-integration](./research/mine-benchmark-integration.md),
[mine-synthetic-corpus](./research/mine-synthetic-corpus.md),
[mine-eval-methodology](./research/mine-eval-methodology.md),
[mine-dms-taxonomy](./research/mine-dms-taxonomy.md) for full inventories):

- **Ingest/index lanes exist:** `bun run beep corpus catalog|extract|organize`
  (`commands/Corpus/Corpus.command.ts:142-334`), `PracticeKgProjections`
  (`PracticeKg.projections.ts`), hand-rolled BM25 in plain SQL
  (`PracticeKg.fts.ts:142-170` — but NOT verbatim-portable to stdlib sqlite3:
  `regexp_extract_all`/`UNNEST`/casts fail there, refuted claim R3).
- **Schema-complete for the OIP shapes C&H lacks:**
  `@beep/law-practice-domain` ships OfficeAction, Rejection, Claim,
  PriorArtReference, IdsSubmissionFact, PatentAsset, Matter (with persisted
  `fixtureKey`, `Matter.model.ts:48`).
- **Judge machinery is ahead of LAB on output integrity** (mandatory evidence
  `NonEmptyArray`, `EvidenceCrossCheck`), **behind on rubric mechanics**
  (no per-criterion isolated calls, no all-pass+diagnostic split in the qa
  lane, no closure criterion, no neutral band). `docgen
  quality-worker-eval` already proves the per-criterion-scoped call shape
  in-repo.
- **Verified gaps (NOT FOUND):** pptx + eml missing from `FileFormatFamily`
  (660 of 9,288 C&H files unroutable); zero hits for
  adverse-party/counterparty modeling and matter lifecycle status/dates in
  `law-practice`; no tracked-changes awareness anywhere (`rg track-changes` →
  0) — U4 makes this the gating question for the redline wedge; Pandoc JSON →
  .docx render lane absent (mapping+codec ship, no binary invocation —
  already owned by `explorations/docx-roundtrip-interop`'s
  `pandoc-driver-sidecar` candidate).
- **Two live beep defects found while inventorying** (fix regardless of this
  packet): `extractLastJsonBlock` (`JudgeCheck.ts:357-394`) hard-fails on
  correct unfenced judge JSON (LAB's balanced-brace third rung is the fix);
  the 16 `QaLens` literals are hand-duplicated in
  `browser-qa-loop/resources/judge-prompt.md` with no lint binding them.

## Verified Opportunity Ledger

[verify-refutations](./research/verify-refutations.md) attacked all 20 ranked
opportunities: **6 KEEP · 2 KEEP-with-condition · 10 WEAKEN · 2 KILL.**
Survivors, dependency-ordered (labels per the refutation report):

1. **Closure/precision + neutral-band schema** (D-O3 ≡ E-#4 ≡ S-O1 fragment) —
  three lenses independently converged on one schema construct
  (`required / acceptableEitherWay / ambiguityReason` + "assert nothing
  outside the set"); land it once. Strongest convergence signal in the run.
2. **Small judge fixes now:** unfenced-JSON salvage rung; `beep lint
  judge-rubric` binding QaLens ↔ judge prompt; delete the ignored-but-settable
  `SkillOptTaskWeights` (LAB bans `weight` by CI test).
3. **C&H as measurement instrument** (B-O1, WEAKENED not killed): the
  zero-patch `docs_dir` seam makes the amortized-index experiment expressible
  without touching their Python — but it is NOT acceptance evidence for
  `goals/practice-kg-mcp` P5 (that claim was refuted against the packet's own
  SPEC), and podman + pandoc + metered API keys are absent/unpriced (G3).
4. **Redline-aware ingest wedge** (from G2, promoted by the verify pass):
  371 tasks with real `w:ins`/`w:del` grade work both their harness and
  frontier agents are structurally blind to; unclaimed axis,
  OIP-load-bearing (claim amendments ARE redlines). Gated on U4.
5. **Conflicts & lifecycle rungs for practice-kg** (D-O1/D-O2): smallest
  schema deltas on live LiteralKits; conflicts absence is a
  professional-responsibility exposure; lifecycle unlocks ~108 of 250 tasks
  topologically. Competes with the synthetic generator for the same appetite
  (align Q8).
6. **Synthetic prosecution corpus generator** (S-O1/S-O3, WEAKENED): survives
  for non-public shapes only (published USPTO material is already owned by
  `goals/uspto-prosecution-read`/`uspto-mcp`); prose-authoring cost
  unestimated; render loop (S-O3: render → own ingest → assert FeaturePin
  recovery) is the part Harvey never built.

**Killed:** dual-judge port (copies a provably self-inconsistent component to
solve a failure mode with zero observed instances) and `beep corpus synth`
packaging (premature; its one durable idea — preflight-before-spend — is a
design law, not a command).

## Constraints Discovered

- **Runtime:** podman and pandoc absent on DankStation (harness hardcodes
  podman; setup.sh is apt-only → manual sudo/YubiKey install); running any
  LAB baseline needs metered API keys — the subscription-OAuth quota model
  doesn't cover it (refutation §preconditions, completeness §G3).
- **License/attribution:** MIT — port-with-attribution fine; exact NOTICE
  obligations recorded imprecisely so far (completeness §G7, 15-min closeout).
- **Containment:** any run mixing C&H with OIP material must keep the Oppold
  corpus out of mounts and telemetry; only aggregate shape statistics may
  parameterize a generator (mine-synthetic-corpus §O5 hard boundary).
- **Epistemic:** the 14-shape task taxonomy underlying the DMS catalog is a
  classifier output whose classifier wasn't published (U1) — downgrade to
  hypothesis before it seeds any SPEC; `p^n` all-pass math assumes independent
  criterion errors (U8); quote only `verify-facts.md`-corrected numbers.

## 2026-08-08 — Strategy comparison pass (Harvey / Engram / beep)

Second research wave (3-agent opus workflow + 1 direction agent) grounding the
question "does beep have an architectural edge in semantic-web / ontologies /
ingestion / agents / KG?" Full reports with URL ledgers:
[harvey-landscape-architecture](./research/harvey-landscape-architecture.md),
[harvey-landscape-engram](./research/harvey-landscape-engram.md),
[beep-kg-profile](./research/beep-kg-profile.md) (shipped, 840 lines),
[beep-kg-direction](./research/beep-kg-direction.md) (intended).

- **Harvey has no public KG/ontology/semantic layer at all** — embedding-first
  RAG at industrial scale (LanceDB Enterprise IVF-PQ, voyage-law-2-harvey,
  24.8M docs/week) with agentic search and metadata/feature reranking; the
  words knowledge graph / ontology / RDF appear nowhere in 8 engineering
  posts, 3 product pages, or founder interviews. Their announced next
  direction (amortized representations) plus the Engram partnership points at
  knowledge-in-weights, not knowledge-in-structure.
- **Engram verified:** $98M Series A (~$600M val, 13 people, out of stealth
  2026-06-23; customers Microsoft/Notion/Harvey). Cartridges = trained KV
  cache (weights frozen), validated at 100k–484k tokens — C&H is ~200x beyond
  the published operating point. Published governance void: no
  provenance/deletion/permission story; lossy compression has no
  representation of extent, so closure ("there are no more") is adversarial
  to it by construction.
- **beep shipped (honest):** schema-first substrate with ontology derived
  from schemas (Fold.assembly — cannot drift, but no production caller),
  Oxigraph workbench + RDFS-subset reasoner + provenance partitions,
  bitemporal epistemic core, VerifiedSpan extraction; but retrieval is
  lexical-only (no embeddings/reranker anywhere), OCR disabled, tracked
  changes never survive ingest, PracticeKg carries two confirmed blocker
  defects (provenance AC-2 unmet; cross-client contamination), ontology
  adoption is zero after two research waves.
- **beep direction:** authority-vs-projection doctrine (claim + evidence +
  provenance + lifecycle is the authoritative record; graph/search/summaries
  are rebuildable projections) — coherent across four independent grills;
  binding constraint is single-developer bandwidth (3,596 of 3,609 commits in
  six months by one author), not architecture.
- **Verdict shape** (synthesis in session, 2026-08-08): different
  admissibility contracts, not better/worse on one axis — beep's edge is
  closure/extent, provenance-as-authority, revocation, and redline ingest in
  a narrow statutorily-stable domain; Harvey/Engram's edge is recall and
  generalization at breadth. The seam Harvey has publicly boxed itself into
  (session-scoped runtime with zero durable derived data vs a direction that
  requires persistent derived artifacts with staleness/permission semantics)
  is exactly what beep's doctrine governs.

## Open Questions (queued for align)

Full versions: [verify-completeness](./research/verify-completeness.md) §5.

1. First experiment corpus: C&H firm-knowledge (matches thesis + baselines) or
   one closed diligence data room (runnable end-to-end, deliverable-mode)? —
   re-ranks everything.
2. Beep's wedge: amortized structural representation (crowded — Harvey AND
   Engram) or tracked-changes-aware ingest (unclaimed, graded testbed,
   OIP-load-bearing)? Sequenced or one winner?
3. Run their harness at all (podman + metered keys buys the only
   externally-comparable number) vs grade with our own eval from day one?
4. How many goal packets graduate — benchmark run / generator / Effect-native
   eval / DMS rungs share one corpus; eval framework is the dependency of the
   other three.
5. What does "standing test asset" (DECISIONS 2026-08-08) operationally mean —
   where the 5.3GB clone lives, what's pinned, CI vs on-demand, OIP
   containment?
6. Contribute the defect ledger (incl. G2 redline-blindness) upstream, or hold
   while it's an advantage?
7. Accept the 14-shape taxonomy as requirements, or re-derive with a published
   rule first (U1)?
8. OIP first move: generator (only path to a shareable graded OIP eval) or
   conflicts/lifecycle rungs (cheaper, unblocks practice-kg-mcp)?
