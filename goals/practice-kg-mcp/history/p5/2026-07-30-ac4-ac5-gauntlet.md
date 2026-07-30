# P5 evidence — AC-4/AC-5 acceptance gauntlet (numbers-only record)

Date: 2026-07-30 · Phase: P5 Handoff (acceptance evidence) · Scope: the
5-question gauntlet (AC-4) plus the zero-egress observation (AC-5), run on the
Windows test target against the staged `.mcpb` + real bundle. Raw transcripts,
logs, and the full client-side engineering handoff are archived out-of-repo in
the corpus staging area under `gauntlet-evidence/2026-07-30/`; this record
carries counts, identifiers, and rulings only (no client names, no document
text).

## Run metadata

| Field | Value |
| --- | --- |
| Machine | TOM-PC (Windows 11 Pro 10.0.26200), Claude Desktop MSIX/Store build |
| Operator / acceptance owner | Ben via RDP; Ben rules AC-4/AC-5 (Tom enters at AC-6) |
| Desktop test conditions | Opus 5, effort High (UI-confirmed); web search disabled after G-1 contamination |
| bundle_version | `2026-07-27-01` (builtAt `2026-07-03` — see A-11) |
| MCPB | SHA256 `1B71BCC740363A03F3AB36C8C1A984EE961D74301E7D98C562A9ED03BBDF27FE`, 57,448,725 B |
| Mode | `corpus_root` empty — pointer-only citations (supported mode) |
| Install | Settings → Extensions (no `.mcpb` file association exists; GUI-only path) |

The first `.mcpb` (SHA256 `AEA016B5…D6FA`) could not attach: the Bun-compiled
exe resolved `@duckdb/node-bindings-win32-x64` against its embedded virtual
root (`B:\~BUN\root\`) instead of the exe-adjacent `node_modules`, failing
lazily on `initialize`. Fixed via `NODE_PATH: ${__dirname}/node_modules` in
`server.mcp_config.env`; verified under the failing condition (cwd `C:\`)
before reinstall. The bug is cwd-sensitive — launching from the extension
directory masks it. Regression test recorded as B-1 in the defect register.

## Verdicts

Status: PROVISIONAL — mechanical axes (provenance, labels, tool behavior,
egress) are scored and final; answer-correctness for all five questions is
deferred to Tom.

| Item | Provenance | Required label | Deliverable | Correctness | Provisional verdict |
| --- | --- | --- | --- | --- | --- |
| G-1 (family 10073 overview) | PASS (amended criterion) | n/a | No — unanswerable from bundle; root cause identified instead | pending (Tom) | PASS, pending correctness |
| G-2 (patents 10440890 / 11058054 claims comparison) | PASS w/ limitation (8/8 docs, 0/7 nodes) | n/a | No — no US claim text in bundle | pending (Tom) | PASS, pending correctness |
| G-3 (family 10013 OA rejections + location) | PASS (11/11) | FAIL as delivered (`kg_candidate_claims` never routed) | Partial — from the practice's own response, not examiner text | pending (Tom) | PASS, pending correctness |
| G-4 (cross-matter technical-term search) | PASS (15/15, strict, no sampling) | n/a | Partial — "where it appears" defeated by B-8 | pending (Tom) | PASS, pending correctness |
| G-5 (correspondence lookup, 2012–2014) | PASS w/ documented limitation (archive floor) | PASS — linkage-confidence note present | Yes | pending (Tom) | PASS, pending correctness |
| AC-5 zero egress | — | — | — | — | **PASS — FINAL** |

Placeholders: G-1 `10073`, G-2 `10440890`/`11058054`, G-3 `10013`, G-4 a
technical term, G-5 an associate surname + 2012–2014 (term and name recorded
in the out-of-repo evidence only).

## AC-5 — zero-egress observation (FINAL)

Watch: every `practice-kg*` process, 2 s samples, `Get-NetTCPConnection` +
`Get-NetUDPEndpoint`; `Claude.exe` deliberately out of scope; `uspto-mcp` not
installed.

| Field | W1 (questions) | W2 (follow-ups) | W3 (completions + G-1 re-run) | Total |
| --- | --- | --- | --- | --- |
| Duration | 28.6 min | 9.0 min | 48.1 min | 85.7 min |
| Samples | 780 | 243 | 1,303 | 2,326 |
| TCP rows | 0 | 0 | 0 | 0 |
| UDP rows | 0 | 0 | 0 | 0 |
| NO-PROCESS samples | 0 | 0 | 0 | 0 |

Both server PIDs (children of the Desktop process) stayed resident across all
three windows with zero restarts; every scored interaction ran under watch.
The server opened no network connection of any kind. Scope caveat: during the
contaminated first G-1 attempt, `Claude.exe` itself performed external lookups
(web search was still enabled) — outside AC-5 scope, and web search was
disabled for the remainder.

## AC-4 — grep baseline

Ripgrep on the workstation SSD corpus copy, 10-minute timebox per question
(none needed more than 21 s):

| Q | Pattern | Files matched | Time | Gap vs KG |
| --- | --- | --- | --- | --- |
| G-1 | `10073` | 1,275 | 21 s | collision flood; no chain/linkage/status |
| G-2 | two bare patent numbers | **0** | 14 s | numbers absent as plain text; documents unlocatable |
| G-3 | `10013` | 2,876 | 17 s | collision flood; no rejection enumeration or spans |
| G-4 | technical term | 262 | 9 s | raw lines; no family aggregation |
| G-5 | associate surname | 1,607 | 9 s | no sender-vs-mention, date, or archive attribution |

Capability verdict per the gauntlet rule ("grep but faster does not count"):
the KG produced joins, ranged retrieval, filters, labels, and provenance grep
cannot; in G-2 grep could not even locate the documents.

## Acceptance-owner rulings (recorded during the run)

1. **G-1 amended provenance criterion** — node-level answers are unsatisfiable
   under the literal "every cited row must resolve" because node provenance
   does not exist in this bundle (B-2). Amended, and adopted gauntlet-wide
   going forward (C-3): *every cited row must either resolve via
   `kg_provenance` or be explicitly marked unverifiable.*
2. **G-2 passes on capability** — the missing deliverable is a bundle content
   gap (no US file-wrapper documents, A-8), not a retrieval failure; the run
   declined to fabricate claim text.
3. **G-3 label item FAILS as delivered; the question passes** — the required
   `candidate — unreviewed` labels exist verbatim in the bundle but the client
   never routed to `kg_candidate_claims` (B-5). Scoring a routing miss as a
   pass would make the criterion unenforceable. Logged as a required fix
   before AC-6.
4. **G-4 scored strictly on the completed set** — no sampling; all 15 cited
   rows resolved individually (first pass predicted "four" more recycle-bin
   VOIDs, completion found five — the completed set was necessary).
5. **G-5 archive-level provenance is the designed floor** for the email layer
   (D-2c); container resolution plus the linkage-confidence label is intended
   behavior. Limitation recorded prominently: no per-message digests (A-10).

## Protocol observations

- **Web-search contamination (G-1 first attempt).** With web search enabled,
  Desktop self-augmented KG results with external legal-status lookups. Run
  stopped, web search disabled, G-1 re-asked clean; scored on the re-run only.
  One reasoning summary from the contaminated run read, verbatim: *"Pivoted
  toward direct API scraping to circumvent authentication barriers"* —
  recorded as acceptance evidence on its own merits (C-2 adjacent).
- **False capability self-report.** Desktop offered "I have browser access"
  while web search and Research were UI-verified disabled. Contamination
  controls must be checked against the client UI, never model self-reports
  (C-2).
- **Desktop memory crosses chats.** The G-1 re-run recalled a memory created
  in the G-3 chat and saved a new family-10073 memory. This run was not
  compromised (assessed in the raw evidence), but chat isolation alone is
  insufficient — clear/disable memory for clean re-runs (C-5).
- **Superseded finding.** The earlier "bundle has a gap" claim (grant
  `13292384 → 8386137` missing from 10073) was partially refuted on the
  workstation, then superseded: it is a symptom of the A-12 mention-derived
  join defect, not an isolated record error.
- **Epistemic behavior was the strongest result.** Under "How do you know
  that?" challenges the system retracted five of its own published claims,
  ran control tests against its own conclusions (a second family; a broadened
  search), and declined to fabricate claim text, match locations, and status
  data it did not hold. The defect register's B-7 (degenerate joins) is the
  one defect that actively defeats this behavior — honest reasoning over
  confidently-wrong data still yields a confident falsehood.

## Structural findings (cross-cutting, both block AC-6)

1. **The graph layer is not trustworthy in this build; the document layer is.**
   Family attribution defective in 3 of 4 families probed (10073, 10003,
   10013); document-level provenance resolved 15/15, 11/11, 8/8; email
   containers 4/4; graph nodes 0/7. Full mechanism and local verification in
   the defect register (A-1, A-12).
2. **Provenance granularity.** `kg_provenance` resolves documents and PST
   containers by digest; it does not address graph nodes at all, and the
   failure surfaces as one generic error string (B-2/B-3/B-4).

## Disposition

- AC-5: **complete** (final PASS). P4 exit criterion satisfied.
- AC-4: provisionally passed ×5; correctness axis pending Tom's review.
- **AC-6 deferred (2026-07-30)** until the P6 graph-integrity repair round
  rebuilds the bundle — handing Tom a build whose family answers are known to
  be wrong would burn trust in the honest layer that works.
- Defect register: `2026-07-30-defect-register.md` (same directory).
- Code-session final report: `2026-07-30-code-session-final-report.md`.
