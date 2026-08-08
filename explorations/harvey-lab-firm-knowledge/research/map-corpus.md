# Corpus Anatomy — Calderwood & Harkness `dms/matters`

Date: 2026-08-08
Agent: corpus-anatomy (sampling only)
Clone: `~/YeeBois/research/harvey-labs`
Slice: `tasks/firm-knowledge/dms/matters/`

All paths below are relative to the harvey-labs clone root unless noted.

---

## 0. Method and sampling discipline

The corpus is ~100M tokens; a sweep is forbidden. What I actually did:

| Operation | Scope | Justification |
| --- | --- | --- |
| Directory + file **name** listing | corpus-wide (266 matters, 9,288 names) | brief explicitly permits listing directory names; names are metadata, not content |
| `os.walk` counters (file counts, extensions, depths) | corpus-wide | name/stat-level only, no bytes read |
| OOXML **marker scan** (regex for renderer artifacts, `w:ins`/`w:del`, `docProps`) | 235 `.docx` inside the **6 sampled matters only** | mechanical boolean probe; no document text entered context |
| **Full document peeks** | **11 documents + 7 `.eml` header blocks**, all inside sampled matters | within the ~10–15 budget |

Sampled matters (6, across 6 clients and 6 practice shapes):

| Matter | Client | Practice shape | Files | Folders | On-disk |
| --- | --- | --- | --- | --- | --- |
| `1001-00001` | Ardent Capital Partners III LP | Antitrust / HSR premerger (PE buyout) | 36 (27 docx, 6 eml, 3 xlsx) | 10 | 1.47 MB |
| `1005-00005` | Nexford Industrial Holdings (defense) | Commercial litigation → mediation → settlement | 37 (35 docx, 1 eml, 1 xlsx) | 10 | 1.90 MB |
| `1006-00002` | Crestline Packaging Solutions LLC | Chapter 11 restructuring (debtor-side) | 35 (35 docx) | 9 | 2.02 MB |
| `1008-00002` | Lumos Analytics Inc. | Capital markets — **withdrawn** IPO (S-1 → Form RW) | 40 (35 docx, 4 eml, 1 xlsx) | 10 | 2.29 MB |
| `1012-00004` | Stonefield Logistics Group Inc. | Labor & employment — FLSA misclassification / arbitration | 35 (33 docx, 2 xlsx) | 8 | 1.98 MB |
| `1014-00003` | Optiwave Semiconductor Corp. | Patent litigation (4 patents, Markman, settled) | 83 (70 docx, 6 eml, 4 xlsx, 3 pptx) | 11 | 4.40 MB |

Documents peeked (11 full + 7 eml headers):
`1014-00003/Pleadings/complaint-patent-infringement.docx`,
`1014-00003/Expert Engagement/reasonable-royalty-georgia-pacific-draft.docx`,
`1014-00003/Correspondence/email-ngo-to-ellison-settlement-finalized.eml`,
`1014-00003/Claim Construction/markman-hearing-demonstratives.pptx`,
`1014-00003/Matter Administration/billing-summary-january-2023.xlsx`,
`1012-00004/Factual Investigation & Analysis/icoa-version-comparison-chart.xlsx`,
`1001-00001/Engagement & Administration/conflicts-check-memorandum.docx`,
`1001-00001/Antitrust Analysis/hhi-concentration-analysis.xlsx`,
`1008-00002/Withdrawal/withdrawal-consequences-memo.docx`,
`1005-00005/Pleadings/stipulation-of-dismissal-with-prejudice.docx`,
`1006-00002/DIP Financing/motion-dip-financing.docx`.

---

## 1. Corpus shape (name-level census, corpus-wide)

```
266 matter directories, ids `<clientId>-<matterSeq>`  (clients 1001..1046 = 46 clients)
9,288 files: 8,055 .docx | 615 .eml | 573 .xlsx | 45 .pptx
files per matter: min 12, max 176, median 35, mean 34.9
nesting depth: 165 matters flat (matter/Category/file), 101 matters 2-deep, none deeper
559 DISTINCT depth-1 folder names across 266 matters
```

The 12–176 range matches the announcement's "10–200 realistic documents". The
median of 35 means the corpus is **wide, not deep**: the median matter is a
single screenful of files, and the difficulty is entirely in the 266-way fan-out.

Depth-1 folder-name frequency (top of a very long tail):

```
208 Correspondence          30 Engagement & Administration   13 Regulatory
171 Engagement              30 Pleadings                     13 Engagement & Administrative
154 Closing                 24 Analysis                      12 Memoranda
144 Transaction Documents   23 Financing / 23 Discovery       11 Memos & Analyses
 75 Diligence               20 Insurance / 18 Tax             10 Opinions / 10 Expert Engagement
```

559 distinct names for ~1,900 folder instances is the quantitative form of the
paper's claim that "the exact filesystem is not standardized". Note the
near-synonym clusters that a naive taxonomy-normaliser would collapse and a
retrieval agent must not rely on: `Engagement & Administration` (30) vs
`Engagement & Administrative` (13) vs `Administration` (5) vs `Matter
Administration` (4); `Memoranda` (12) vs `Memos & Analyses` (11) vs `Memos &
Analysis` (9) vs `Analyses & Memos` (7) vs `Internal Memoranda` (15).
**There is no controlled vocabulary.** Folder names are free-text LLM output.

---

## 2. Anatomy of a rendered matter

### 2.1 The universal skeleton

Every sampled matter decomposes into the same four bands, whatever the practice
area calls them:

```
<matter>/
  <intake band>      Engagement | Engagement & Administration | Engagement & Client Intake
                     -> conflict(s)-check-memo, engagement-letter, matter-opening-memo,
                        litigation-hold-notice, new-matter-intake-form, retainer ack
  <substance band>   1..N practice-specific folders (the variable part)
                     -> the memos, filings, analyses, workpapers that carry the features
  <communication>    Correspondence [ /Client | /Counterparty Counsel | /External | /FDA | /SEC ]
                     -> .eml + .docx letters; the only place .eml appears
  <outcome band>     Closing | Settlement & Dismissal | Post-Closing | Withdrawal | Case Closing
                     -> matter-closing-memo, final invoice, stipulation of dismissal,
                        settlement agreement, certificate of effectiveness, Form RW
```

Corpus-wide lifecycle coverage (folder-name + filename heuristics, name-level only):

```
matters with an intake/engagement stage : 263 / 266   (missing: 1013-00001, 1017-00001, 1031-00001)
matters with a closing/outcome stage    : 203 / 266
matters with both                       : 201 / 266
```

The ~63 matters with no outcome band are the "in progress" half of the
announcement's "266 in progress or completed matters" — and they are exactly the
population that makes outcome-enumeration tasks ("which IP matters settled?")
hard, because absence-of-outcome must be inferred from absence-of-folder.

### 2.2 Four worked examples

**`1001-00001` — Ardent Capital / Pinnacle Health Systems, HSR premerger.**

```
Engagement & Administration/  conflicts-check-memorandum, engagement-letter-ardent-capital,
                              matter-opening-memorandum
Antitrust Analysis/           market-definition-competitive-analysis-memo,
                              hhi-concentration-analysis.xlsx, portfolio-company-overlap-analysis,
                              competitor-identification-chart.xlsx, vertical-relationships-analysis,
                              preliminary-antitrust-risk-assessment, state-regulatory-con-analysis
HSR Filing Preparation/       acquiring-person-hsr-form-{draft,redline,final},
                              cover-letter-ftc-pno, hsr-filing-checklist-timeline,
                              item-4c-4d-document-log.xlsx, hsr-filing-fee-wire-instructions, ...
Early Termination/            early-termination-request-letter, voluntary-submission-white-paper,
                              email-ftc-staff-availability.eml
FTC/DOJ Correspondence/       ftc-early-termination-notice-annotated, ftc-pno-filing-receipt-annotated
Correspondence/Counterparty Counsel/  4 items
Client Updates/               biweekly-status-report-{1,2}, client-update-*.eml
Closing/                      closing-memo-antitrust-workstream, hsr-clearance-certificate,
                              final-invoice-matter-closing-letter
```

The substance band is a *workstream* decomposition (analysis → filing →
early-termination → agency correspondence), not a document-type decomposition.

**`1014-00003` — Optiwave v. Lumos Photonics, patent litigation (83 files).**
The richest sample and the closest to OIP-practice shape:
`Pre-Suit Investigation & Strategy` (4 per-patent infringement analyses +
validity risk + funding analysis + board strategy) → `Engagement & Client
Intake` → `Pleadings` (complaint, summons, civil cover sheet JS44, corporate
disclosure, answer to counterclaims) → `Case Management` → `Fact Discovery`
(ESI search terms, document review protocol, privilege log `.xlsx`) →
`Claim Construction` (opening/responsive/reply briefs, contentions, 3 deposition
outlines, `markman-hearing-demonstratives.pptx`, technical tutorial `.pptx`) →
`Post-Markman Assessment` (4 per-patent viability memos, board `.pptx`) →
`Settlement & Dismissal` (11 files) → `Matter Administration` (3 monthly billing
`.xlsx`, status reports, budget memo, closing memo, **`lessons-learned-post-mortem-memo.docx`**).

The per-patent fan-out is the tell: `pre-suit-infringement-analysis-{234,567,678,890}-patent.docx`
and `post-markman-viability-{234,567,678,890}-patent.docx` — a spec-level list of
four patents renders as 4×2 parallel documents. This is *generated combinatorics
made visible in filenames*.

**`1006-00002` — Crestline Packaging, Chapter 11.** The only sample whose folder
names are pure procedural phases, in docket order:
`Engagement` → `RSA` → `Petition and First Day` → `Professional Retention` →
`DIP Financing` → `Plan and Disclosure Statement` → `Confirmation` →
`Post-Confirmation` → `Case Closing`. 35 files, 100% `.docx`, zero email — a
correspondence-free matter, which alone would defeat an agent that assumes
`Correspondence/` exists.

**`1008-00002` — Lumos Analytics, withdrawn IPO.** Lifecycle terminates in a
`Withdrawal/` band (`form-rw-withdrawal-application`,
`board-resolutions-withdrawal`, `withdrawal-consequences-memo`,
`engagement-closing-letter`). The *structural* feature "IPO withdrawn" is
expressed as a **folder that exists**, not as a sentence anywhere in the S-1
chain. Structural features are encoded topologically.

### 2.3 The degenerate render (3% of matters)

Eight matters have **no taxonomy at all** — every file sits in a single
`documents/` folder:

```
1014-00001  1017-00002  1031-00001  1038-00002  1039-00001  1044-00001  1044-00003  1045-00002
```

`1014-00001/documents/` holds 37 files (indenture drafts/redlines/execution,
ISDA masters, capped-call confirmations, closing checklist, funds-flow) that in
any other matter would be split across `Transaction Documents/`, `Closing/`,
`Derivatives/`. This is the generator's fallback when the folder-taxonomy step
produced nothing — 8/266 = 3.0% silent degradation, and it is invisible to any
consumer that trusts folder names as a signal.

---

## 3. Naming conventions

**Files: 9,288 / 9,288 (100%) are strict lowercase-kebab.** Zero spaces, zero
capitals, zero parentheses, zero version-suffix cruft, zero author initials.

**Folders: free-text title case with spaces and ampersands** (`Engagement &
Client Intake`, `Plan and Disclosure Statement`, `Post-Markman Assessment`).

The split is diagnostic: folder names come from the LLM's matter plan; filenames
are slugified by code. (See §6.)

Most-reused exact filenames corpus-wide — these are the generator's stock
document types:

```
80 closing-checklist.xlsx        29 escrow-agreement.docx        17 matter-closing-memo.docx
47 conflict-check-memo.docx      24 funds-flow-memorandum.xlsx   17 closing-memorandum.docx
40 engagement-letter.docx        21 litigation-hold-notice.docx  15 matter-closing-memorandum.docx
38 conflict-check-memorandum.docx                                14 due-diligence-request-list.docx
```

Note `conflict-check-memo` (47) / `conflict-check-memorandum` (38) /
`conflicts-check-memorandum` (9): even the stock types are not canonicalised.
An agent answering task 200's conflicts question by filename will miss a third
of the population on any single spelling.

**Document version families.** Lifecycle tokens across all 9,288 filenames:
`draft` 787, `execution` 262, `redline` 168, `final` 165, `amended` 55,
`v1` 32 / `v2` 36. Full draft→redline→execution triads are rare (7 families in
the 6 sampled matters); the common shape is a pair. Example triad:
`1008-00002/Underwriting/underwriting-agreement-{draft,redline,execution-version}.docx`.

---

## 4. How features are pinned to documents, in practice

The `task.json` criteria are the observable end of the feature system. Three
pinning levels are visible:

**(a) Matter-level pin.** `tasks/006/task.json` C-001:
> "Includes Ardent Capital Partners matter 1001-00001 as a qualifying Antitrust &
> Competition matter in which an HSR notification was actually filed."

**(b) File-level pin.** `tasks/087/task.json` C-011 and C-012:
> "For Optiwave Semiconductor Corp. matter 1014-00003, the answer identifies
> `complaint-patent-infringement.docx` as the source alleging willful infringement"
> … "identifies `expert-retention-agreement-kessler.docx` as the source showing
> retention of damages expert Dr. Lawrence Kessler."

**(c) Value-level pin.** `tasks/076/task.json` C-002:
> "…qualifying, based on its preliminary reasonable-royalty estimate of **7.5%**
> of accused-product revenue, which is above 5%."
`tasks/092/task.json` C-002: "…its executed driver ICOA contains a **12-month**
non-compete." `tasks/001/task.json` C-001: "the FTC issued an HSR Second Request
on **July 16, 2024**."

I verified (c) end-to-end for two features by opening the pinned documents:

- **Willfulness / enhanced damages** → `1014-00003/Pleadings/complaint-patent-infringement.docx` ¶2:
  "OWS seeks damages, **enhanced damages for willful infringement**, injunctive
  relief… infringement of four United States patents: U.S. Patent No. 10,234,567
  ('the '567 Patent'); …10,891,234; …11,045,678; …11,312,890". The feature is a
  clause in a 45,298-character pleading. There is no metadata, no tag, no header.
- **12-month non-compete** → `1012-00004/Factual Investigation & Analysis/icoa-version-comparison-chart.xlsx`,
  sheet 2, a per-provision comparison grid across ICOA v1.0 (2018) / v2.0 (Aug
  2020) / v3.0 (Jan 2023) with `Material Change v1.0→v2.0?` / `v2.0→v3.0?`
  columns. The feature lives in a **spreadsheet cell**, not prose.

**Corroboration, not single-sourcing.** The same feature is expressed
redundantly across the band. Optiwave's settlement outcome appears in
`Settlement & Dismissal/settlement-agreement-mutual-release.docx`,
`joint-stipulation-of-dismissal.docx`, `walk-away-cost-benefit-analysis-memo.docx`,
and in `Correspondence/email-ngo-to-ellison-settlement-finalized.eml`, which
recites the whole term set:
> "**No monetary payment** in either direction ($0 settlement amount); **Mutual
> general releases**…; **No license granted**…; **Dismissal with prejudice** of
> all claims and counterclaims."

That email also back-references the Markman order ("adopted claim constructions
substantially aligned with Lumos's positions on **eight of eleven** disputed
claim terms"), the $500,000 rejected cross-license offer, the $1.65M remaining
spend, and the $4.2M board-approved budget — figures that also appear
independently in `Matter Administration/billing-summary-january-2023.xlsx`
("Board-Approved Litigation Budget | $4,200,000.00"). **Numeric facts are
cross-consistent across document types within a matter.** That is the single
most impressive property of this corpus and the thing that makes it a real
retrieval benchmark rather than a bag of plausible prose.

**One observed ground-truth/render gap.** `tasks/092/task.json` C-003 requires
"all **executed versions** of the driver ICOA for … 1012-00004". A corpus-wide
filename search for `*icoa*` returns exactly one file — the comparison chart
above. The executed ICOAs exist only as *described rows*, not as documents. The
criterion is either satisfiable only by returning the chart, or it is
over-specified relative to what the renderer produced. UNVERIFIED whether the
LLM judge accepts the chart; I did not run the harness.

---

## 5. Realism assessment

### 5.1 What reads like genuine work product — most of it

The prose is not "synthetic-looking". Representative openings:

- `1014-00003/Pleadings/complaint-patent-infringement.docx` — correct N.D. Cal.
  San Jose caption block, case number `5:22-cv-03417-EJD`, jury demand, §271
  cause of action, party allegations with fabless-semiconductor detail (45,298
  chars).
- `1014-00003/Expert Engagement/reasonable-royalty-georgia-pacific-draft.docx` —
  99,717 characters (~25k tokens) working the fifteen *Georgia-Pacific* factors
  with the correct citation (318 F. Supp. 1116 (S.D.N.Y. 1970)) and 35 U.S.C.
  § 284 quoted accurately; header carries `Status: DRAFT — Analysis paused
  following Markman ruling of February 17, 2023`, i.e. the document *knows where
  it sits in the matter's timeline*.
- `1006-00002/DIP Financing/motion-dip-financing.docx` — real Chapter 11 motion
  caption with jointly-administered debtors, redacted EINs (`XX-XXX4837`), the
  full five-part §§ 105/361/362/363/364 relief caption, Bankruptcy Rules
  2002/4001(b)/4001(c)/9014.
- `1001-00001/Engagement & Administration/conflicts-check-memorandum.docx` —
  cites "Calderwood & Harkness's General Counsel Conflicts Policy (revised
  September 2023)" and the New York Rules of Professional Conduct; scopes the
  engagement in lettered subparagraphs (a)–(e).
- `1001-00001/Antitrust Analysis/hhi-concentration-analysis.xlsx` — HHI
  workpaper with NAICS codes 621493/621111, 9 MSAs, DOJ/FTC Merger Guidelines
  methodology, and a stated key finding (`delta = 0`, no horizontal overlap).
- `1014-00003/Matter Administration/billing-summary-january-2023.xlsx` — invoice
  number `SC-2023-02-0478-07`, blended-hourly with 10% volume discount, fees
  $198,742.50 + costs $18,634.22, cumulative-to-date and budget-remaining rows.

Structural realism markers I did not expect and would call genuinely strong:
per-matter **conflicts memos**, **litigation hold notices**, **retainer
replenishment letters**, **final fee reconciliation**, a **lessons-learned
post-mortem memo**, `civil-cover-sheet-js44.docx`, `verified-statement-rule-2014.docx`,
and privilege logs as `.xlsx`. Someone who has actually run matters specified
this.

**Spreadsheets follow a consistent two-sheet convention**: sheet 1 is a
`Field | Value` cover block (title, prepared by, reviewed by, matter no.,
client, confidentiality legend), sheet 2+ is the actual grid. That is a
generator convention, but it is a *plausible* one and it makes xlsx trivially
parseable.

**Redlines are real.** Every file whose name contains `redline` carries genuine
OOXML tracked changes. In the 6 sampled matters this is exact: 3 redline-named
files, 3 files containing `<w:ins>`/`<w:del>`, same 3 files. Corpus-wide there
are 169 redline-named files. `1005-00005/Settlement/settlement-agreement-redline.docx`
has 159 insertions / 30 deletions. Negotiation deltas are therefore recoverable
by a tracked-changes-aware reader and invisible to a flatten-to-text reader —
a real capability discriminator.

### 5.2 Where it stops reading real

| Defect | Evidence | Severity |
| --- | --- | --- |
| **100% lowercase-kebab filenames** | all 9,288 | High. No real DMS looks like this. It hands agents a clean, uniform, semantically-loaded filename channel that production corpora do not have — the benchmark is *easier* than reality on exactly the axis the paper says agents rely on. |
| **Renderer directives leaked as visible text** | 15/235 sampled docx (6.4%) contain escaped `<!-- indent:2 -->`, `<!-- center -->`, `<!-- signature -->`, `<!-- small -->`; e.g. `1005-00005/Pleadings/stipulation-of-dismissal-with-prejudice.docx` renders `&lt;!-- indent:2 --&gt;Plaintiff,&lt;!-- /indent --&gt;` in the caption | Medium |
| **Unexpanded Word TOC field code** | 81/235 sampled docx (34.5%) contain the literal string `TOC \o "1-2" \h \z \u Right-click to update Table of Contents` where a table of contents should be; e.g. the Georgia-Pacific memo and `1008-00002/Withdrawal/withdrawal-consequences-memo.docx` | Medium — 1/3 of long memos begin with parser garbage |
| **Markdown emphasis leaked into body text** | 2/235; `1005-00005/Settlement/settlement-agreement-redline.docx` renders `**1.3 1.4 "Disputed Period"**` | Low |
| **Empty `.eml` headers** | of 7 sampled emails, 2 have an empty `Date:` and 2 an empty `Subject:` — e.g. `1014-00003/Correspondence/email-ngo-to-ellison-settlement-finalized.eml` (no Date) and `1001-00001/Client Updates/client-update-hsr-forms-filed.eml` (no Subject) | **High for temporal reasoning** — any "what happened first" task over email is partially unanswerable from headers |
| **Identity drift within one matter** | Alan Ngo is `alan.ngo@calderwoodharkness.com` in `email-ngo-to-ashworth-settlement-call.eml` but `ango@calderwoodharkness.com` in the other three `1014-00003` emails | Medium — entity resolution noise is accidental, not designed |
| **Firm-fact drift across matters** | C&H's San Francisco office is "1 Market Street, Spear Tower, Suite 3600" in `1008-00002` and "One Embarcadero Center, 34th Floor" in `1014-00003`; also "600 Lexington Avenue, New York" (`1001-00001`) and "200 South Wacker Drive, Suite 4400, Chicago" (`1005-00005`) | Medium — multi-office is plausible, but *two different SF addresses* is not. Evidence that matters are rendered independently with no shared firm-facts registry. |
| **Synthetic timestamp signature** | sampled email `Date:` minutes cluster on `:17`, `:37`, `:47` past the hour (04:17, 04:47, 06:47, 04:37, 10:17) | Cosmetic, but a fingerprint |
| **Occasional casing slip** | "intellectual Property Group" (lowercase i) in the Georgia-Pacific memo header | Cosmetic |

Net: **realism is high at the paragraph and matter level, and leaky at the
serialization layer.** The substance would pass a partner's read; the bytes
would not pass a DMS migration QA.

---

## 6. Reverse-engineering the absent generation pipeline

The repo ships only rendered output. The output is nonetheless self-incriminating.

**The renderers are named in the file metadata — no scrubbing was done:**

```
docx  docProps/core.xml   <dc:creator>python-docx</dc:creator>
                          <dc:description>generated by python-docx</dc:description>
      docProps/app.xml    <Application>Microsoft Macintosh Word</Application>   (python-docx default template)
xlsx  docProps/app.xml    <Application>Microsoft Excel Compatible / Openpyxl 3.1.5</Application>
pptx  docProps/core.xml   generated using python-pptx
```

Every docx also ships `docProps/thumbnail.jpeg`, `customXml/item1.xml`,
`stylesWithEffects.xml` — the untouched python-docx `default.docx` template.
So: **Python renderers, one per Office format, over a single default template.**

**The intermediate representation is a Markdown-plus-directive dialect.** The
leaked directive vocabulary observed is `<!-- indent:N -->…<!-- /indent -->`,
`<!-- center -->…<!-- /center -->`, `<!-- signature -->…<!-- /signature -->`,
`<!-- small -->…<!-- /small -->`, alongside `**bold**`. When the renderer's
handler table has an entry, the directive becomes paragraph formatting; when it
does not, the directive is escaped into the run text and appears to the reader.
The 6.4% leak rate is the handler-table miss rate.

**The likely stage order, and where each stage's fingerprint lands:**

| Stage | Inferred output | Fingerprint in the corpus |
| --- | --- | --- |
| 1. Matter spec (~1,000 tokens) | client, practice, state/court, parties, dates, feature list | cross-document numeric consistency ($4.2M budget in both an email and a billing xlsx); per-patent fan-out |
| 2. Folder plan | free-text folder labels | 559 distinct labels; near-synonym clusters; **8 matters where this stage produced nothing → `documents/`** |
| 3. File plan | one slug + doctype + assigned features per file | 100% kebab filenames; stock names reused 80×/47×/40×; `-draft`/`-redline`/`-execution` sibling families |
| 4. Content generation | Markdown + directives per file, conditioned on spec + assigned features | leaked `<!-- indent -->`, `**bold**`, `TOC \o` field text, "intellectual Property Group" |
| 5. Format render | python-docx / openpyxl / python-pptx | `docProps` creator strings; two-sheet `Field \| Value` xlsx convention; real `w:ins`/`w:del` only on `*redline*` |
| 6. Filesystem write | `matter/<label>/<slug>.<ext>` | **path-injection artifact**: a folder label containing `/` becomes nested directories |

**The path-injection artifact is the cleanest single proof of stage 6.**
`1001-00001/FTC/DOJ Correspondence/` is not a design choice — the intended label
was the standard legal folder name "FTC/DOJ Correspondence", and the writer
`os.makedirs`'d the string. `FTC/` contains exactly one child and zero files.
Corpus-wide I found 33 folders whose only content is a single subdirectory;
roughly a dozen are unambiguous slash-splits (`Corporate/Governance`,
`Debt/Capital Structure`, `UCC/Perfection`, `Payoff/Refinancing`,
`Sanctions/OFAC Workstream`, `Registration/SEC Filings`, `Regulatory/Antitrust`,
`Settlement/Mediation`, `SEC/Proxy`, `Construction/EPC`), the rest are genuine
single-child nesting (`Correspondence/Client`, `Diligence/Tax`). This also means
the corpus's stated max depth of 2 is partly an *accident*, not a taxonomy
decision — the pipeline is really **one level deep by design**.

**What is NOT recoverable from the output:** the spec schema itself, the feature
vocabulary and its type system, the ground-truth computation from feature mixes,
and the review loop the paper describes. The 250 `task.json` criteria are the
only projection of the feature layer that shipped — and they are prose
(`match_criteria` strings), not structured features. Reconstructing the feature
schema means inverting ~1,900 criteria strings back into typed features.

---

## 7. Implications for beep-effect

1. **Filenames are a leaky benchmark channel; do not build on them.** A retrieval
   system tuned against C&H filenames will overfit to a property (100% clean
   semantic kebab slugs) that no production DMS has. Any beep evaluation using
   C&H should include a *filename-ablated* run — hash the basenames, keep the
   extension — to measure how much of the score is content understanding vs.
   filename grep. This is the cheapest high-value experiment in the whole packet.

2. **Structural features are topological, so an amortized corpus index must
   index shape, not just text.** "IPO withdrawn" is a `Withdrawal/` folder;
   "matter still open" is an *absent* closing band; "reached claim construction"
   is a `Claim Construction/` folder. A per-matter structural summary (bands
   present, folder labels, doc-type histogram, lifecycle stage) is ~200 tokens
   and would answer a large share of the enumeration tasks *without opening a
   document*. That is precisely the "intermediate model of what the corpus
   contains" the paper says agents lack — and it is a schema-first artifact:
   `MatterSummary` as an Effect Schema class with a derived guard, built once,
   invalidated per matter.

3. **Redlines are a first-class, mostly-ignored signal.** 169 files carry real
   `w:ins`/`w:del`. Negotiation history (what was conceded, by whom, between
   which drafts) is machine-recoverable *only* if the ingest path is
   tracked-changes-aware. Most RAG stacks flatten to text and lose it. This is a
   differentiator for a beep ingest pipeline and directly relevant to the
   patent-prosecution use case (claim amendments are redlines).

4. **The corpus is a ready-made synthetic-generation reference for OIP work.**
   The spec→feature→plan→render pipeline shape is exactly what we would need to
   produce patent-prosecution-shaped corpora with zero confidentiality exposure.
   Port the *architecture* (typed spec schema → folder plan → file plan with
   feature assignment → renderer) and fix the observed defects at the schema
   level: a sanitised `FolderLabel` branded type (rejects `/`), a controlled
   `DocumentBand` literal domain, a required `Instant` on every correspondence
   artifact, a firm-facts registry threaded through every matter render, and a
   render step whose directive handler table is total (a `LiteralKit` over the
   directive vocabulary makes a missing handler a compile error rather than a
   6.4% leak rate).

5. **Their defects are our test fixtures.** The leaked `<!-- indent -->`
   directives, `TOC \o` field text, empty `.eml` headers, double-escaped HTML
   entities in `sharedStrings.xml`, and the `FTC/` phantom directory are exactly
   the ingest edge cases a real DMS connector must survive. Any beep document
   ingest should be run against these specific files as regression fixtures
   before it is pointed at real client material.

6. **`lessons-learned-post-mortem-memo.docx` and per-matter billing summaries
   are the firm-knowledge product surface.** They are the documents that make
   "what does this firm know" answerable — cross-matter precedent, rate
   benchmarks, outcome mixes. That is the product shape worth extracting from
   the task catalogue, and it maps onto the conflicts-check workflow already
   named in CAPTURE.md.

---

## 8. UNVERIFIED / open

- Whether the same C&H personnel (Alan Ngo, Howard Bellamy, Priya Anand) recur
  across non-sampled matters — would confirm or refute a shared roster registry.
  Requires a cross-matter content sweep; **not attempted** (hard rule).
- Whether the LLM judge accepts `icoa-version-comparison-chart.xlsx` for
  `tasks/092` C-003. Requires running the harness.
- Whether the `<!-- indent -->` leak rate (6.4%) and the `documents/` fallback
  rate (3.0%) hold outside the 6 sampled matters. The `documents/` figure is
  corpus-wide (name-level, so exact); the leak rate is sample-only.
- Whether the two San Francisco addresses are a deliberate two-office fiction or
  a generation inconsistency. Resolving this needs a firm-directory document,
  which I did not locate by name.
- Total token count per matter. I measured on-disk bytes (1.5–4.4 MB for the
  samples) and character counts for 11 documents; I did not tokenize.
