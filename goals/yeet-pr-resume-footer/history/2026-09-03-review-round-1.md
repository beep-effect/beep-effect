# 2026-09-03 — PR 1 review round 1

Lanes (all Codex, Sol medium, detached with nohup + Monitor; handoffs under
`<handoff-dir>/`):

- Implementation lane: delivered the v2 footer, registry, resume, monitor
  re-assert, boundary test, changeset, skill doc, CSF-007 follow-up. Focused
  tests 19/19 (threads pool; the forks pool hangs inside the Codex sandbox).
  Package audit failed only on stale dependency dists (`@beep/schema/Unknown`
  missing an export the source has); rebuilding the dists cleared it.
- Adversarial review lane (security re-scan simulation, operator failure walk,
  repo-law lens): verdict `SAFE TO PUBLISH: no`, eight findings.
- JSDoc lane: the rewrite had dropped every `**Example** (Title)` section
  (`Provenance.ts` 37 exports / 0 examples versus 15 / 13 on main).

## Findings and rulings

| # | Severity | Finding | Ruling |
| --- | --- | --- | --- |
| 1 | Medium | `PrProvenanceBranch` and `PrProvenanceModel` admit UUID / ≥16-hex; the boundary property never varied them | Branch: not a leak — the head ref is already public on the PR page; keep branches as-is, vary every public field in the property, assert UUID/hex exclusions after removing branch occurrences, add hostile-branch escaping cases. Model: reject UUID/long-hex like labels, map to `unknown`. |
| 2 | Medium | Claude `pr-link` fallback keyed by PR number only; can resume another repository's same-numbered PR | Fix: require `prRepository` equality with the current repository. |
| 3 | Medium | Codex session-store enrichment timeout discards the exact `CODEX_THREAD_ID` | Fix: exact identity survives enrichment failure; only cwd/model degrade. |
| 4 | Medium | `--list` / `--agent` number raw lifecycle rows, not distinct sessions | Fix: one shared distinct-session projection for footer, list, and selection; list non-resumable rows with a status. |
| 5 | Medium | Registry append and run-dir mirror are sequenced so either failure suppresses the other and the footer | Fix: independent writes, separate warnings, footer whenever lookup state exists. |
| 6 | Low | Corrupt registry lines skipped silently | Fix: count and warn. |
| 7 | Low | `sessionWorkspace` never derived (ratified decision) | Fix: derive from the session home's main clone; publish only when it differs. |
| 8 | Low | Missing JSDoc examples on new exports | JSDoc lane. |

Scenario walk (a)–(j) otherwise traced correctly: cross-clone session home,
same session publishing #946 then #950, body rewrite then monitor, dead
terminal, `--start-pr-early`, two agents, no local state (exit 4), live desktop
window guard, and the `CODEX_COMPANION_*` mislabel fix.
