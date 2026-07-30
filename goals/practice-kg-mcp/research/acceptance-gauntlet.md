# Acceptance Gauntlet — 5 Questions vs. the Grep Baseline (AC-4, AC-5)

Drafted 2026-07-27 (P0 gap work, ahead of Days 6–7). Run order: workstation
Claude Desktop first (AC-4 gate), then install on Tom's machine (AC-6).

**Rule:** placeholders in ALL-CAPS are filled at run time from the live corpus
on the workstation. Real client names, inventor names, counsel names, and
docket numbers never land in this repo — record run results in an out-of-repo
log next to the bundle (`<bundle>/gauntlet-results.md`) and summarize
pass/fail only in packet history.

## Why these five

Each question exercises a capability grep-over-SSD structurally cannot
deliver — joins, provenance chains, structured status, digest-addressed
side-by-side retrieval, labeled claims. "Grep but faster" does not count as a
win (SPEC: "tables populated" is not success).

| # | Question (as Tom would ask it) | Tools exercised | Why grep loses |
| --- | --- | --- | --- |
| G-1 | "Pull up everything on docket family FAMILY — what applications did it file as, what granted, and what's the USPTO status on each?" | `kg_docket_family` → `kg_application_lookup` | Continuity chain + enrichment status is a join across catalog, organize, and USPTO anchors; on disk it's scattered across folder names and 99 separate anchor records. |
| G-2 | "Pull up patents PATENT-A and PATENT-B side by side — compare their claims sections." | `kg_application_lookup` ×2 → `corpus_get_document` ×2 (ranged) | Grep finds filenames at best; digest-addressed retrieval with ranged excerpts is what makes side-by-side a two-call operation. |
| G-3 | "What did the examiner reject in the FAMILY office action, and where exactly does it say that?" | `kg_candidate_claims` → `corpus_get_document` (span range) → `kg_provenance` | Grep locates the OA PDF; it cannot enumerate rejections with pinpoint evidence spans. Verify every row carries `candidate — unreviewed` (AC-3). |
| G-4 | "Which of our matters ever dealt with TECHNICAL-TERM? List the families and show me where it appears." | `corpus_search_text` (family join) → `kg_find` | Grep matches lines; it cannot aggregate hits into families/dockets, and the 3,055 unsorted docs are reachable only through FTS + the documents join. |
| G-5 | "Find correspondence with PERSON-NAME between DATE-A and DATE-B — what was it about and which matter archive was it in?" | `email_search` (sender/date filters) | The email layer is 663k pffexport header files across ~27 trees; sender/date-filtered search over that is not a grep workflow at all. Confirm the archive-level linkage-confidence note appears in output (D-2c). |

## The provenance follow-up (applies to every question)

After each answer, ask: **"How do you know that?"** The follow-up passes when
**every cited row either resolves via `kg_provenance` to a catalog digest,
USPTO anchor, or extraction Activity, or is explicitly marked unverifiable in
the answer** (AC-2 spot check inside the gauntlet). One silent failure = the
question fails.

*Amended 2026-07-30 (first run, C-3):* the original wording ("every cited row
must resolve") is unsatisfiable by construction for graph-derived answers —
node-level provenance does not exist in the current bundle — which would make
the criterion untestable rather than strict. The amended form stays
enforceable: resolving document rows while flagging node rows as unverified
passes; silently asserting spine facts as though backed fails. Resolution must
be individual — no sampling, no arguing from shared provenance shapes.

## Scoring (per question)

Record in the out-of-repo results log:

1. Tools called + turn count.
2. Answer correctness, verified manually against the source documents.
3. Grep-baseline attempt: same question against the SSD copy (ripgrep +
   Explorer), time-boxed to 10 minutes; note what it could and couldn't produce.
4. Provenance follow-up: pass/fail.
5. Labels present where required (`candidate — unreviewed` on G-3;
   linkage-confidence note on G-5; spine label elsewhere).

**Gauntlet passes** when all 5 questions are answered correctly with
provenance, and each is strictly better than its grep-baseline attempt on
capability (not merely speed).

## Egress observation (AC-5)

While the gauntlet runs, observe the practice-kg-mcp process for network
activity:

- Linux workstation: `ss -tnp | grep <pid>` sampled during the run, or launch
  under `bwrap --unshare-net` for a hard proof (server must behave
  identically).
- Windows (Tom's machine spot check): Resource Monitor → Network tab filtered
  to the exe; expect zero entries.

Any connection attempt = AC-5 failure (uspto-mcp is a separate process and is
allowed egress; do not conflate the two PIDs).

## Run protocol (mandatory preflight — learned from the 2026-07-30 first run)

1. **Web search and Research OFF** in the Desktop composer before the first
   question, and verified in the UI. With search on, Desktop self-augments KG
   answers with external lookups (the first run's contaminated attempt pivoted
   to external scraping for status data); any contaminated question is
   re-asked clean and scored on the re-run only.
2. **Clear or disable Desktop memory.** Memory crosses chat boundaries — the
   first run recalled a docket memory created in a different chat and saved a
   new one. Fresh chats alone are NOT isolation.
3. **Verify controls against the client UI, never the model's self-report.**
   The first run claimed browser access while search was verifiably disabled.
4. Ask each question's provenance follow-up immediately after its answer, in
   the same chat, before moving on.
5. Ship this file with the handoff set so the target machine has the canonical
   question list (C-1); the runbook references it.

## Placeholder selection guidance (run time, workstation)

- FAMILY for G-1: a family with a granted patent AND at least one continuation
  (maximizes the chain walk).
- FAMILY for G-3: pick from the `staging/oppold-demo-inputs` OA subset (P3
  batch coverage is limited to it).
- TECHNICAL-TERM for G-4: a term Tom actually uses, appearing in ≥3 families
  including at least one unsorted document.
- PERSON-NAME for G-5: an examiner or opposing counsel with correspondence in
  ≥2 PST archives (stresses the archive-level linkage caveat).
