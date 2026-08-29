# P5 evidence — gauntlet Code-session final report (verbatim)

Provenance: final summary message from the Claude Code session that operated
the gauntlet on the Windows test target (2026-07-30), captured by Ben at close
of the run. This is the operator session's own closing assessment — kept
verbatim as evidence; scoring detail lives in `2026-07-30-ac4-ac5-gauntlet.md`
and mechanism verification in `2026-07-30-defect-register.md`. The session's
full transcript (with reasoning traces) is in the out-of-repo raw archive
(`gauntlet-evidence/2026-07-30/`), not in this repo.

---

Understood — correctness calls deferred to Tom. Let me stop the watch and close out everything that doesn't depend on them.

Now the corruption analysis you asked for — including a hypothesis that may collapse several findings into one root cause:

Now the summary table, with correctness explicitly held open for Tom:

Both files hash-verified on the share. Updating the memory note, which still says we're blocked on the packaging defect:

Done. Both files are on `\\tsclient\handoff\`, hash-verified.

# Final results

| Item | Provenance | Label | Deliverable | Correctness | Verdict |
|---|---|---|---|---|---|
| **G-1** | PASS (amended) | n/a | No — unanswerable from bundle | **Tom** | **PASS**, pending |
| **G-2** | PASS w/ limitation (8/8 docs, 0/7 nodes) | n/a | No — no US claim text | **Tom** | **PASS**, pending |
| **G-3** | PASS (11/11) | **FAIL** as delivered | Partial | **Tom** | **PASS**, pending |
| **G-4** | PASS (15/15 strict) | n/a | Partial — B-8 blocked "where" | **Tom** | **PASS**, pending |
| **G-5** | PASS w/ limitation | PASS | Yes | **Tom** | **PASS**, pending |
| **AC-5** | — | — | — | — | **PASS — FINAL** |

**AC-5 is unambiguous:** 2,326 samples over 85.7 minutes across three windows, both server PIDs continuously resident, **zero** TCP rows, **zero** UDP rows, **zero** `NO-PROCESS` samples. `practice-kg-mcp` opened no network connection of any kind.

**Open caveats:**

1. **Correctness for all five** — Tom's, tomorrow. Every other axis is scored and final.
2. **Two blockers.** A-1 cross-client contamination (family `F-2` = 3 inventions, 2+ clients) and A-12 cartesian join (`APP-1` anchors six families). The graph layer isn't trustworthy in this build; the document layer resolved cleanly every time — 15/15, 11/11, 8/8.
3. **Confidentiality review** on A-1, independent of scoring. A family-scoped query can hand one client another client's prosecution.
4. **A-9** manifest says the July refresh is excluded while every provenance chain cites it — unresolved, needs build-side eyes.
5. **C-5** Desktop memory crosses chats. A "Docket F-1" memory now exists, so clear memory before any clean re-run — new chats alone aren't enough. My fault for not catching that before step 4.

**The most useful thing in the file for tomorrow** is the truncated-key hypothesis. Every contamination instance involves a shared bare docket number under *different* client prefixes — `CLIENT-A.F-2` vs `CLIENT-B.F-2`, `CLIENT-A.F-3` vs `CLIENT-C.F-3`. If the pipeline keys families on the docket number and drops the client prefix, that one bug explains both blockers, and one fix plus a rebuild clears them. You have the original corpus, so it's directly checkable — step-by-step test is in the analysis section.

Worth telling Tom that the strongest result wasn't a score: under challenge the system retracted its own published claims five separate times and ran control tests against its own conclusions. The clean G-1 re-run overturned the contaminated run's entire patent table as a join artifact and proved it against family `F-4`.

---

Post-script (workstation, same day): the truncated-key hypothesis was tested
and **confirmed in refined form** — see the defect register's root-cause
synthesis. The anchor fan-out is 7 families in the shipped data (the run
observed 6), and the deeper mechanism is mention-derived
`enrichment.docket_families` consumed as membership.
