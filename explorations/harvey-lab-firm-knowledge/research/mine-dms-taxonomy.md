# Mine: the 250-task set as a DMS product-requirements catalog

**Date:** 2026-08-08
**Agent:** mine-dms-taxonomy (Opus 5)
**Sources:** `~/YeeBois/research/harvey-labs` (MIT; paths below relative to that
clone) + this repo at `main` `6b42b239a6`. Every beep-effect claim below was
verified with `ls`/`rg`/file read before it was written; the commands are in
§9. **Nothing under `tasks/firm-knowledge/dms/` was opened** (hard rule) —
task-shape claims come from the 250 `task.json` files, corpus claims are
inherited from `map-corpus.md` and marked as such.

Inputs read in full: `map-task-census.md`, `map-corpus.md`,
`map-evaluation.md`, `map-pipeline-docs.md`, `map-harness.md`, `CAPTURE.md`,
`DECISIONS.md`.

---

## 0. The finding in one paragraph

The 250 firm-knowledge tasks are the **requirements document that
`goals/practice-kg-mcp` and `goals/legal-document-intake` do not have**.
`docs/ROADMAP.md` Lane 1 states the dependency out loud — *"Tom's captured
real questions (practice-kg-mcp P5 handoff) become P4/P5 requirements"* — and
that slot is empty: AC-6 (Tom installs and asks) has not run, because
`goals/practice-kg-mcp/README.md:53-59` puts the packet at "P6 graph-integrity
repair gates the AC-6 install." Meanwhile the shipped acceptance surface is a
**5-question gauntlet** (`history/p5/2026-07-30-ac4-ac5-gauntlet.md:60-64`)
against a **14-shape** question space. Harvey enumerated that space for us, at
firm scale, with ground truth. The second finding is sharper and less
comfortable: mapping the taxonomy onto the *shipped* practice-KG vocabulary
(`KgNodeKind`, 7 kinds; `KgEdgePredicate`, 9 predicates) shows beep can serve
**3 of 14 shapes** today, and the three biggest blockers — no adverse party,
no matter lifecycle status/dates, no closure semantics on an answer — are each
a small, schema-first delta on a closed `LiteralKit` domain that already
exists.

---

## 1. From 14 task shapes to 10 product capabilities

`map-task-census.md` §3 classifies the 250 tasks into 14 shapes. Shapes are a
*surface* taxonomy; several collapse onto the same underlying store capability.
Reducing them gives the actual feature catalog — what a DMS/institutional-
knowledge system must be able to *do*, independent of how the lawyer phrases it.

| # | Capability (what the store must support) | C&H shapes served | Tasks | Signature ask |
|---|---|---|---|---|
| **F1** | **Predicate filter over matters** — "matters where feature X holds", where X is a clause, event, or provision buried in a document | enumeration, count, superlative, frequency | ~180 | *"pull every matter where we used a 10% escrow"* (`133`) |
| **F2** | **Set closure / precision** — assert the boundary of the answer, not just its members | precision criteria across all shapes | 175 criteria / 140 tasks | *"the answer does not assert any matter outside this list"* (`200` C-005) |
| **F3** | **Ordering over a matter attribute** — most recent, largest, first, longest-running, shortest | superlative, aggregate-stat | 47 | *"what's our longest-running open matter, and when did it open?"* (`209`) |
| **F4** | **Cardinality with membership** — a count that is only credited alongside the roll call | count | 23 | *"how many matters did we actually close in 2024?"* (`204`, 69 criteria for a 17-word question) |
| **F5** | **Grouping / binning** — by year, practice area, size band, venue, outcome | distribution, trend, frequency | 28 | *"what's the mix of use of proceeds?"* (`049`) |
| **F6** | **Party-role traversal** — adverse to / opposite / representing / related-family | conflicts, client-relationship | 13 | *"have we ever been adverse to Vantor Holdings?"* (`200`) |
| **F7** | **Person-role traversal** — staffed by, led by, billed by, has experience in | staffing | 6 | *"which associates have patent-litigation experience?"* (`181`) |
| **F8** | **Document-instance retrieval with version role** — the *executed* copy, the operative clause, the controlling version | single-doc + 548 document-id criteria | 4 tasks / 548 criteria | *"pull the executed SPA for the closing binder"* (`196`) |
| **F9** | **Lifecycle-status predicates** — open, closed, dormant, signed-not-closed, withdrawn, abandoned | portfolio hygiene | 10 | *"which commercial deals were signed more than 90 days ago but still haven't closed?"* (`184`) |
| **F10** | **Negative answers with distractor rejection** — "no", plus why the near-miss isn't it | zero-result criteria across shapes | 28 tasks | *"pull the ROFR clause"* → Article 13 is an Expansion Option, Article 15 is a ROFO, the qualifying set is empty (`221` C-004/5/6) |

Two structural observations that only fall out of the reduction:

**A count task is an enumeration task wearing a hat.** Per census §4, the
`count` shape is **73% matter-identification criteria** — the number itself
earns 1 of 7. F4 is not a separate capability from F1; it is F1 + one assertion.
The same holds for `superlative`: 24% matter-id, 21% precision. Any product
that answers "how many" by returning a number and nothing else fails the shape
it thinks it is serving.

**F2 is the only capability with no analogue anywhere in this repo.** It is
also the one that the whole benchmark is built around: 140 tasks carry exactly
one `The answer does not assert …` criterion, another ~35 use `Limits …` /
`Puts forward …` phrasing for the same job, so ~70% of tasks grade *closure*.
See §4/O3.

---

## 2. The OIP translation — what a solo IP/patent firm actually asks

C&H is a 46-client, 14-practice-area transactional-and-litigation firm. OIP is
one attorney, one practice area (patent prosecution + some IP litigation
support), ~105 docket families (`goals/oppold-corpus-pipeline/README.md`
current phase: "643 docket files across 105 docket families, 242 restored
names, 99 USPTO anchors"). The taxonomy does not port uniformly. Here is the
honest mapping:

| Capability | OIP question it becomes | Transfers? |
|---|---|---|
| F6 party-role | *"Have we ever represented anyone adverse to this prospective client — or prosecuted for a direct competitor in the same art?"* | **Strongly.** This is a Rule 1.7/1.9 gate, run before every engagement. `map-corpus.md` §3 shows C&H ships a per-matter `conflict-check-memo.docx` (47) / `conflict-check-memorandum.docx` (38) / `conflicts-check-memorandum.docx` (9) — the artifact exists and is not canonicalised, exactly OIP's problem. |
| F9 lifecycle | *"Which families have a response due with nothing drafted? Which have gone abandoned? Which applications are signed-but-unfiled?"* | **Strongly.** This is `docs/product/solo-firm-docketing.md` §1's "vigilance overlay" reframed as a query rather than a reminder. Tasks `109`/`168`/`184`/`170`/`171`/`172` are the shape. |
| F8 version role | *"Pull the as-filed response, not the draft"* / *"the executed assignment"* | **Strongly.** Patent prosecution is version-critical; the C&H filename lifecycle tokens (`draft` 787, `execution` 262, `redline` 168, `final` 165 — `map-corpus.md` §3) are the same problem. |
| F1 predicate filter | *"Every application where we argued §103 with a secondary-reference combination"* / *"every response citing an examiner interview"* | **Strongly**, and this is the precedent-bank wedge: prosecution is argued from your own prior responses. C&H `045` ("work from our own precedent") and `233` ("assembling our tax-opinion precedent file") are the exact phrasing. |
| F3 ordering | *"Most recent OA response on this family"*, *"longest-pending application"* | **Strongly**, and it is the cheapest shape in the whole set (43 tasks, median 4 criteria). |
| F10 zero-result | *"Does this application have a terminal disclaimer?"* → no, and the thing you found is a restriction requirement | **Strongly.** For a candor-sensitive practice (`goals/patent-citation-candor-gate`), a confidently-wrong "yes" is the dangerous failure. |
| F2 closure | *"…and that is the complete set of adverse representations"* | **Strongly.** For a conflicts answer, closure *is* the answer. |
| F5 grouping | *"Allowance rate by art unit by year"* | **Partially.** The grouping keys OIP cares about (art unit, examiner, CPC class, office) come from USPTO official data (`goals/uspto-prosecution-read`), not the corpus. The C&H bin keys (deal size, practice area, venue) have no OIP analogue. |
| F4 cardinality | *"How many active applications do we have?"* | **Partially** — real, but small-N; the anti-guessing value of the pattern survives, the difficulty does not. |
| F7 person-role | *"Which associates have patent-lit experience?"* | **No.** n=1 attorney. The only surviving fragment is *outside*-counsel: C&H `197` C-002 explicitly enumerates "local-counsel, vendor, forensics, subcontractor, compliance-monitor" engagement letters — for OIP that is **foreign associates and search firms**, which is real but is F6 (party-role), not F7. |

**Net:** 8 of 10 capabilities transfer strongly, one partially, one not at all.
The two that do not transfer (F7 staffing, F5's deal-value bins) are also the
two that C&H spends the most rubric mass on in the tail (`188` is 122 criteria
of deal-value-by-practice-area). Do not let the hardest task in the set set the
agenda; it is the least relevant one.

---

## 3. Capability ledger — what beep ships today, verified

### 3.1 Shipped and load-bearing

| Capability brick | Evidence (verified) |
|---|---|
| Practice KG node vocabulary — 7 kinds: `client`, `docket_family`, `docket`, `application`, `patent`, `document`, `email_archive` | `packages/law-practice/domain/src/values/KgNodeKind/KgNodeKind.model.ts:38-46` |
| Practice KG edge vocabulary — 9 predicates: `has_docket_family`, `has_docket`, `files_as`, `granted_as`, `has_document`, `family_document`, `archived_in`, `continuation_of`, `enriched_family` | `packages/law-practice/domain/src/values/KgEdgePredicate/KgEdgePredicate.model.ts:37-47` |
| 9 read-only MCP tools: `kg_clients`, `kg_docket_family`, `kg_application_lookup`, `kg_find`, `corpus_search_text`, `corpus_get_document`, `email_search`, `kg_candidate_claims`, `kg_provenance` | `packages/law-practice/use-cases/src/PracticeKg.tools.ts:650-802` |
| KG read models | `packages/law-practice/tables/src/entities/{KgNode,KgEdge,KgBuild}` |
| Governed corpus + catalog | `goals/oppold-corpus-pipeline` (completed-retained): 8,438 files / 31.7 GB salvaged, DuckDB catalog of 7,330 distinct digests, 663,272 PST message artifacts, 6,702 text artifacts, 105 docket families |
| Deterministic extraction | `@beep/file-processing`, `FileFormatFamily` at `packages/foundation/capability/file-processing/src/Strategy/index.ts:99-113` |
| Span-grounded LLM extraction | `@beep/langextract` at `packages/foundation/capability/langextract` (goal `completed-retained`) |
| Claim/evidence substrate | `packages/epistemic/domain/src/entities/`: `CandidateClaim`, `ClaimDisposition`, `Contradiction`, `EdgeVersion`, `Evidence`, `EvidenceVerification`, `Activity`, `UsageRecord` |
| Schema-validated judge inventory with cross-field invariants | `packages/tooling/tool/cli/src/commands/Qa/Inventory.schemas.ts:1-11` — `qa-inventory/v1` carries "a schema-level filter asserting `requiredCount` equals the number of P0 and P1 findings, so a miscounted verdict fails decoding instead of shipping" |

### 3.2 Verified gaps (zero hits — these are NET-NEW)

| Gap | Verification |
|---|---|
| **No adverse party, counterparty, or opposing-party concept anywhere** | `rg -l -i "adverse\|counterparty\|opposing.?party" packages/ --glob '*.ts'` → **0 files** |
| **No matter lifecycle status or dates** | `rg -n -i "matterStatus\|matter_status\|openedAt\|opened_date\|closedAt\|closed_date" packages/law-practice` → **0 hits**. `Matter` carries exactly four fields — `displayName`, `fixtureKey`, `legalClientFixtureKey`, `matterType` (`packages/law-practice/domain/src/entities/Matter/Matter.model.ts:48-81`) |
| **The literal domains are single-valued proof fixtures** | `MatterType = LiteralKit(["patent_application"])` (`Matter.values.ts:13`); `LegalClientStatus = LiteralKit(["active_client"])` (`LegalClient.values.ts:13`); `PatentAssetStatus = LiteralKit(["pre_filing"])` (`PatentAsset.values.ts:13`) |
| **No person / attorney node kind** | `rg -n -i "attorney\|associate\|partner\b" .../KgNodeKind.model.ts` → **0 hits** (acceptable — F7 does not transfer) |
| **No tracked-changes / redline handling** | `rg -n "track-changes\|trackChanges" packages/ goals/` → **0 hits**. `@beep/pandoc-ast` models `Strikeout` as a markdown inline (`Pandoc.model.ts:938`), not OOXML `w:ins`/`w:del`. `map-corpus.md` §5.1 measured 169 real-redline files in C&H |
| **No `.pptx`, no standalone `.eml` ingest** | `FileFormatFamily` covers doc/docx/docm/rtf/html/xhtml/pdf-text-layer/pst/plain-text/markdown/image-metadata/xls/xlsx — no `pptx`, no `eml`. `packages/drivers/libpff/src/Libpff.eml.ts` *synthesizes* EML from PST exports (`assembleEml`, `synthesizeEmlHeaderBlock`); it does not parse arbitrary `.eml` files. C&H ships 615 `.eml` + 45 `.pptx` |
| **No closure / set-completeness concept on any answer** | See §4/O3 |
| **Fused retrieval not started** | `goals/hybrid-retrieval-fusion-core/README.md`: "Latest Evidence: **Not started.**" Current phase is P0 symbol audit |

### 3.3 The coverage verdict

Mapping the 10 capabilities onto the shipped node/edge vocabulary:

| Capability | Servable today? | Blocker |
|---|---|---|
| F8 document retrieval | **Yes** (`corpus_get_document`, `kg_find`) | version role is untyped |
| F1 predicate filter (text-level) | **Partly** (`corpus_search_text` = BM25) | no structured feature layer; falls back to phrase sweep |
| F5 grouping | **No** | no bin keys on any node |
| F2 closure | **No** | NET-NEW |
| F3 ordering | **No** | no dates/values on nodes |
| F4 cardinality | **No** | follows F1+F2 |
| F6 party-role | **No** | NET-NEW node + edge kinds |
| F7 person-role | **No** | NET-NEW (and out of scope for OIP) |
| F9 lifecycle | **No** | NET-NEW status/date fields |
| F10 zero-result | **No** | no negative-answer contract |

**3 of 14 shapes, 1.5 of 10 capabilities.** The P5 gauntlet's own results
corroborate this from the other direction: G-1 through G-5 covered
family-overview, cross-document comparison, enumeration-with-location,
phrase-sweep, and person+date-range correspondence — four of them landed
"PASS, pending correctness," and the one closest to F1 (G-3's rejection
enumeration) **failed its required-label item** because `kg_candidate_claims`
was never routed (`history/p5/2026-07-30-defect-register.md` B-5).

---

## 4. Ranked opportunities

Ranked by *(OIP practice value) × (shortness of the path from today's shipped
surface)*. Sequencing note follows the list.

---

### O1 — Conflicts & adversity rung *(highest value, smallest delta)*

**What.** Extend the two closed `LiteralKit` domains with an adversity layer:
add `adverse_party` (and optionally `counterparty`) to `KgNodeKind`; add
`adverse_to`, `represented_in`, `related_matter` to `KgEdgePredicate`. Add one
MCP tool, `kg_conflicts_check(partyName)`, returning the full prior-adversity
set with provenance and an explicit closure assertion.

**Capability cite vs NET-NEW.**
- Extension point exists: `KgNodeKind.model.ts:38-46`, `KgEdgePredicate.model.ts:37-47` are `LiteralKit`s — adding a member is a compile-checked change that fans out through `KgNode`/`KgEdge` read models.
- Tool pattern exists: `readTool(...)` composition at `PracticeKg.tools.ts:650-802`, field tiers at `:441-603`.
- Provenance gate exists: `kg_provenance` + AC-2.
- **NET-NEW:** the adversity extraction itself (no `adverse` token anywhere in `packages/`) and party-name resolution.

**Why first.** It is the only capability in the catalog whose *absence is a
professional-responsibility exposure*, not a convenience gap. It is also the
one shape where C&H proves the source artifact exists in a real DMS (the
conflict-check memo, in three non-canonical spellings). And it is the smallest
schema delta of the five.

**Known trap, inherited.** `map-corpus.md` §5.2 records identity drift *within
one matter* (`alan.ngo@` vs `ango@`) and firm-fact drift across matters. Party
resolution is the hard half; the graph shape is the easy half. Budget
accordingly, and give the tool an explicit "unresolved alias" channel rather
than silently merging.

**Acceptance tests (C&H).**

| Task | Criteria | Why it is the right gate |
|---|---|---|
| `200` Matters Adverse to Vantor Holdings | 5 | The canonical shape. C-001 asserts the count, C-002/3/4 each require matter id **plus the representation direction** ("represented Stonefield against adverse party Vantor"), C-005 is the closure test. |
| `201` Deals Opposite Crescent Harbor Bank | 6 | Same shape, phrased as "conflict and precedent check" — proves the answer serves both intents. |
| `214` Related Matters for 1039-00001 | 5 | Family traversal + closure, with an explicit carve-out: "Matter 1039-00001 may be mentioned as the subject matter" (C-005). |
| `176` Full Matter List for Cascade Retail | 12 | Client-relationship completeness — the "full relationship picture" half of a conflicts refresh. |
| `202` Conflict Check: Government Entities (stretch) | 22 | 85% matter-id criteria each with a *distinct* adversity rationale, plus a 7-matter acceptable-either-way tail. Do not attempt before `200`/`201`/`214` pass. |

---

### O2 — Matter lifecycle spine → portfolio-hygiene surface *(largest unlock)*

**What.** Give `Matter` a real lifecycle: a `MatterStatus` literal domain
(`prospective | open | dormant | signed_not_closed | closed_completed |
closed_terminated | withdrawn`), `openedAt` / `signedAt` / `closedAt` instants,
and a `practiceArea` (for OIP, a single-value domain today — that is fine and
honest). Project those onto `KgNode` so `kg_find` can filter and order.

**Capability cite vs NET-NEW.**
- The entity, table projection, and identity plumbing exist: `Matter.model.ts` uses `BaseEntity.Class` with a `persisted` block — adding fields is the well-trodden path (`EntitySchema.persist.literal` / `.text` already in use at `:65-77`).
- **NET-NEW:** every one of the fields. Today's domains are single-valued fixtures (`MatterType`, `LegalClientStatus`, `PatentAssetStatus` — all `LiteralKit` of length 1).

**The cheap derivation trick, taken from the corpus.** `map-corpus.md` §2.1/2.2
establishes that C&H encodes structural features **topologically**: "IPO
withdrawn" is a `Withdrawal/` folder that exists; "matter still open" is an
*absent* closing band (63 of 266 matters have no outcome band); "reached claim
construction" is a `Claim Construction/` folder. That is a ~200-token
per-matter structural summary that answers a large share of enumeration tasks
*without opening a document*. The Oppold corpus has the same property — docket
status is implicit in which document types exist in a family. **Derive
lifecycle from folder/doctype topology first; extract from prose second.**

**Why second.** It unlocks F3, F4, F5, F9 at once — 47 + 23 + 28 + 10 = ~108 of
250 tasks — and it is the direct query-side complement to
`docs/product/solo-firm-docketing.md` §1's vigilance overlay. Vigilance answers
"what is due"; lifecycle answers "what is stale."

**Acceptance tests (C&H).**

| Task | Criteria | Capability proved |
|---|---|---|
| `209` Longest-Running Open Matter | 3 | F3 ordering + F9 status + the `ACCEPTABLE EITHER WAY` boundary (C-003 explicitly blesses either reading of "dormant counts as open") |
| `197` Engagement Letters Issued Last Year | 3 | Date-window filter over an intake doctype; C-001 demands "68 qualifying matters containing 78 engagement-letter documents" — matter-count and document-count are separate assertions |
| `168` Dormant M&A Matters | 7 | The dormancy predicate itself |
| `184` Signed >90 days ago, not closed | 13 | Two-date arithmetic + a negative status condition — the hardest hygiene shape and the closest analogue to "response due, nothing drafted" |
| `206` Count of Active Patent-Infringement Cases | 4 | F4 + F9 on an IP matter type; only 4 criteria, so it is a real early gate |
| `177` Cascade Retail Matters Closed in 2024 | 4 | Client × year × status intersection |
| `204` Count of Matters Closed in 2024 (stretch) | 69 | 17-word question, 66-matter roll call. The proof that counting is enumeration. |

---

### O3 — The closure / precision answer contract *(the differentiator)*

**What.** Model the *shape of an answer*, not just its content. A
`RetrievalAnswer` schema carrying `asserted: HashSet<Ref>`,
`closureClaimed: boolean`, `acceptableEitherWay: HashSet<Ref>`, and
`justification` — so "this is the complete set" is a typed, gradeable claim
rather than a rhetorical flourish. Then a judge criterion kind that fails when
the answer asserts anything outside the ground-truth set.

**Capability cite vs NET-NEW.**
- **Cite:** `packages/tooling/tool/cli/src/commands/Qa/Inventory.schemas.ts` already does exactly this class of thing — a schema-level cross-field filter that makes a miscounted verdict a *decode failure*. `QaSeverity = LiteralKit(["P0","P1","P2"])` with `requiredCount` invariant. The pattern is proven in-repo; only the domain changes.
- **Cite:** `packages/epistemic/domain/src/entities/{Evidence,EvidenceVerification,ClaimDisposition}` give the per-member provenance the closure claim must rest on.
- **NET-NEW:** the closure concept itself. Verified absent.

**Why this is the differentiator and not a nicety.** `map-evaluation.md` §13.2
is blunt: without a precision criterion, all-pass scoring *rewards
shotgunning* — enumerate everything and you satisfy every recall criterion.
The same is true of a product: a conflicts tool that returns 40 maybes is worse
than useless because the attorney must now check 40 things. And the beep-side
symptom is already on the record: the P5 gauntlet logged five "PASS, pending
correctness" verdicts (`2026-07-30-ac4-ac5-gauntlet.md:60-64`) precisely
because there was no ground-truth set to check closure against.

**Two design corrections to make on the way in** (both from `map-evaluation.md`
§14 / `map-task-census.md` §9): (a) `ACCEPTABLE EITHER WAY` in C&H is *prose
inside a judge string* with no code path honoring it — model it as a field;
(b) criterion ids are permanent keys, not array indices (six C&H tasks have
non-contiguous ids because criteria were deleted without renumbering —
`041`, `091`, `102`, `122`, `133`).

**Acceptance tests (C&H).** These are criterion-level, not task-level:

| Task/criterion | What it grades |
|---|---|
| `200` C-005 | Bare closure over a 3-member set |
| `214` C-005 | Closure with an explicit permitted mention ("may be mentioned as the subject matter") |
| `209` C-003 | Closure **plus** a two-member `ACCEPTABLE EITHER WAY` band with its justification |
| `206` C-004 | Closure on a count answer |
| `013` (4 crit) | Zero-result: the MFN provision does not exist in the controlling agreement, so there is nothing to pull |
| `221` (6 crit) | Distractor rejection: 3 of 6 criteria grade explaining why an Expansion Option and a ROFO are **not** the requested ROFR |
| `236` (5 crit) | Second zero-result/distractor case |

---

### O4 — Precedent bank with typed version roles

**What.** A `DocumentVersionRole` literal domain (`draft | redline | execution
| final | amended | as_filed`) on the `document` node, plus retrieval that
defaults to the operative version. Then the precedent query: "every prior
document where we argued/drafted X, with the controlling copy."

**Capability cite vs NET-NEW.**
- **Cite:** `corpus_search_text` (`PracticeKg.tools.ts:726`) + `corpus_get_document` (`:745`) and the document field tiers at `:508` are the retrieval floor today.
- **Cite:** `goals/hybrid-retrieval-fusion-core` owns the fused semantic+lexical+literal ranking this needs — but it is **not started**, which is why this ranks fourth.
- **NET-NEW:** the version-role domain, and (see §5) tracked-changes-aware ingest if amendment deltas are in scope.

**Why it matters for OIP.** Prosecution is argued from your own prior
responses; "how did we phrase the §112 antecedent-basis fix last time" is the
daily question. C&H phrases it identically: `045` — *"I'm drafting the
use-of-proceeds section for an upcoming offering and want to work from our own
precedent"*; `233` — *"I'm assembling our tax-opinion precedent file."*

**Acceptance tests (C&H).**

| Task | Criteria | Capability proved |
|---|---|---|
| `196` Retrieve Cascade Retail Executed SPA | 4 | Version role — "the controlling execution copy for the closing binder" |
| `013` Lumos Analytics Most Recent MFN | 4 | Version role + F3 ordering + F10 (the answer is "there is no MFN") |
| `045` Debt-Repayment Use-of-Proceeds Precedents | 7 | The precedent-bank shape at small scale |
| `233` More-Likely-Than-Not Tax Opinion Precedent | 4 | Same, keyed on a graded qualifier |
| `194` MFN provisions across M&A and commercial | 21 | Cross-practice clause sweep with document pins |
| `195` Closed M&A Agreements with Indemnification Sections (stretch) | 32 | Mega-enumeration; ~41% matter-id + ~32% document-id criteria |

---

### O5 — The shape catalog as an acceptance matrix *(zero code, do it first)*

**What.** Replace the ad-hoc 5-question gauntlet with a 14-row shape matrix,
and adopt C&H's **triad generator**: per `map-task-census.md` §3, most features
in the set yield an *enumeration* task, a *count* task, and a *most-recent*
task over the same ground truth (`006/007/008`, `021/022/023`, `146/147/148`,
`242/243/244`, …). One ground-truth feature set → three difficulty tiers at
near-zero marginal authoring cost. For the Oppold corpus, one feature ("family
received a §103 rejection") yields three OIP acceptance questions.

**Capability cite vs NET-NEW.** Pure documentation + fixture work. The landing
zones already exist: `goals/practice-kg-mcp/SPEC.md:70-88` (AC-4/AC-6) and
`docs/ROADMAP.md` Lane 1's empty "Tom's captured real questions" slot.

**Concrete deliverable: a 14-task smoke suite, 52 criteria total** — the
smallest task of each C&H shape, runnable end-to-end for less than the cost of
`188` alone:

| Shape | Task | Criteria |
|---|---|---|
| enumeration | `032` Bankruptcy matters producing plans of reorganization | 2 |
| superlative | `034` Most recent confirmed plan of reorganization | 1 |
| count | `033` Count of B&R matters with filed reorg plans | 3 |
| distribution | `237` Transfer-pricing matters by industry | 5 |
| frequency | `018` Frequency of springing liens | 2 |
| existence | `061` Funds with an American deal-by-deal waterfall | 2 |
| hygiene | `197` Engagement letters issued last year | 3 |
| client-relationship | `216` Pinnacle Venture Fund II portfolio company IPO | 2 |
| staffing | `180` Matters staffed by Prentice and Hartwell | 4 |
| trend | `187` Indemnification cap trend in software deals 2022–2024 | 11 |
| conflicts | `200` Matters adverse to Vantor Holdings | 5 |
| single-doc | `013` Lumos Analytics most recent MFN | 4 |
| aggregate-stat | `099` Average non-compete duration | 5 |
| phrase-sweep | `193` Documents referencing OFAC | 3 |
| **total** | | **52** |

Note `034` is the only 1-criterion task in the set, and its criterion says
*"Credit the matter number OR the client name"* — disjunctive credit, another
pattern worth copying.

---

### Sequencing (differs from the ranking)

O5 first (it is free and it defines "done" for the others), then O3 (the
answer contract every later capability is graded against), then O1, then O2,
then O4. Ranking above is by product value; this is by dependency.

---

## 5. Traps, carried forward from the map reports

1. **Do not tune on filenames.** `map-corpus.md` §5.2 and §7.1: all 9,288 C&H
   filenames are clean lowercase-kebab semantic slugs — a channel no production
   DMS has, and the Oppold corpus emphatically does not (242 of 643 docket
   filenames were *restored*, per `goals/oppold-corpus-pipeline`). Any beep run
   on C&H must include a **filename-ablated arm** (hash the basenames, keep the
   extension) or the score is measuring the wrong thing. This is the cheapest
   high-value experiment in the packet.
2. **Never report criterion-pass as all-pass.** `evaluation/scoring.py:383-386`
   is `score = 1.0 if n_passed == n_total else 0.0`. At the announced ~50%
   per-criterion rate, expected all-pass across the set is **10.19 / 250**
   (`map-task-census.md` §2). Publish both, with `p^n` shown.
3. **The corpus is undocumented and untagged upstream.** `map-pipeline-docs.md`
   §4: the firm-knowledge drop is 8 commits past the only tag (`v1.0`), which
   does not contain it; `firm-knowledge` appears in exactly one non-task file,
   a code comment at `harness/run.py:57`. Pin a commit sha in any packet that
   cites it.
4. **Ingest gaps will bite before retrieval does.** 615 `.eml` and 45 `.pptx`
   in C&H have no `FileFormatFamily` member; 169 redline files have no
   tracked-changes path. `map-corpus.md` §7.5 makes the constructive point:
   C&H's serialization defects (leaked `<!-- indent -->` directives at 6.4% of
   sampled docx, unexpanded `TOC \o` field text at 34.5%, empty `.eml` `Date:`
   / `Subject:` headers, the phantom `FTC/` directory from a slash in a folder
   label) are exactly the regression fixtures a DMS connector needs.
5. **Adversity resolution is entity resolution.** See O1's trap note.

---

## 6. What I am *not* claiming

- I did not verify that any C&H answer is reachable by the shipped beep stack —
  no run was executed against the corpus.
- I did not read `dms/`; every corpus statement is inherited from
  `map-corpus.md` (which sampled 6 matters and 11 documents) and is flagged as
  such where load-bearing.
- The "3 of 14 shapes servable" figure is a **static reading of the node/edge
  vocabulary plus the tool list**, not a measured result. It is a lower bound:
  a sufficiently clever agent can reach further with `corpus_search_text` +
  `bash`, which is precisely what the P5 gauntlet's G-3 did (and why its label
  criterion failed).

---

## 7. UNVERIFIED

- Whether `@beep/pandoc-ast` can round-trip OOXML tracked changes at all.
  `Strikeout` exists as a markdown inline (`Pandoc.model.ts:938`); pandoc's
  `--track-changes=all` would surface insertions/deletions as spans, but the
  flag appears nowhere in this repo (`rg` → 0 hits) and no redline model
  exists. Treat as a gap until someone runs a `redline.docx` through the
  driver.
- Whether the Oppold corpus's docket status is in fact topologically derivable
  the way C&H's is (§O2's cheap trick). `goals/oppold-corpus-pipeline` reports
  a `organized/` taxonomy of 643 docket files across 105 families, but I did
  not inspect the per-family folder shape.
- Whether `202`'s 22 criteria are satisfiable at all from the corpus — the
  government-adversity rationales (state AG, FERC, DOJ, FDA, IRS, SEC) are
  distinct per matter and `map-task-census.md` §7 ranks it #7 hardest.
- Whether the practice-KG `kg_find` tool can already express an ordering or a
  date filter. I read the tool *declarations* (`PracticeKg.tools.ts:650-802`)
  and the field tiers, not the handler query bodies
  (`packages/law-practice/server/src/PracticeKg.queries.ts`).

---

## 8. One line for the packet's decision log

> The C&H task set is beep's missing requirements document for institutional
> knowledge retrieval: 14 question shapes reduce to 10 capabilities, of which
> 8 transfer to a solo patent practice, and the shipped practice-KG vocabulary
> serves 1.5 of them. The three cheapest unlocks — adversity edges, matter
> lifecycle, and a typed closure claim on the answer — are each a small
> schema-first delta on a closed `LiteralKit` domain that already exists.

---

## 9. Reproduction

```bash
# C&H side (task.json only; dms never opened)
cd ~/YeeBois/research/harvey-labs
python3 -c "
import json,glob,os
for f in sorted(glob.glob('tasks/firm-knowledge/tasks/*/task.json')):
    t=json.load(open(f)); print(os.path.basename(os.path.dirname(f)), len(t['criteria']), t['title'])
"
python3 -c "
import json
t=json.load(open('tasks/firm-knowledge/tasks/200/task.json'))
[print(c['id'], c['match_criteria']) for c in t['criteria']]
"

# beep side — the gap verifications
cd ~/YeeBois/projects/beep-effect13
rg -l -i "adverse|counterparty|opposing.?party" packages/ --glob '*.ts'          # 0
rg -n -i "matterStatus|matter_status|openedAt|closedAt" packages/law-practice   # 0
rg -n "track-changes|trackChanges" packages/ goals/                              # 0
rg -n "LiteralKit\(\[" -A 12 packages/law-practice/domain/src/values/KgNodeKind/KgNodeKind.model.ts
rg -n "LiteralKit\(\[" -A 12 packages/law-practice/domain/src/values/KgEdgePredicate/KgEdgePredicate.model.ts
rg -n "^export const .*Tool = readTool" packages/law-practice/use-cases/src/PracticeKg.tools.ts
sed -n '85,140p' packages/foundation/capability/file-processing/src/Strategy/index.ts
sed -n '49,81p' packages/law-practice/domain/src/entities/Matter/Matter.model.ts
```
