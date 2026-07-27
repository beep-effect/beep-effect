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
`kg_provenance` resolves every cited row to a catalog digest, USPTO anchor, or
extraction Activity (AC-2 spot check inside the gauntlet). One failure = the
question fails.

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

## Placeholder selection guidance (run time, workstation)

- FAMILY for G-1: a family with a granted patent AND at least one continuation
  (maximizes the chain walk).
- FAMILY for G-3: pick from the `staging/oppold-demo-inputs` OA subset (P3
  batch coverage is limited to it).
- TECHNICAL-TERM for G-4: a term Tom actually uses, appearing in ≥3 families
  including at least one unsorted document.
- PERSON-NAME for G-5: an examiner or opposing counsel with correspondence in
  ≥2 PST archives (stresses the archive-level linkage caveat).
