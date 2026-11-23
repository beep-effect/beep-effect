---
title: "ci failures review round 1: run selection, partial reports, saved-log labels, inflate cap"
date: 2026-11-22
lane: "goals/ci-gate-reports-p3"
pullRequest: 3493
reversal: "Revert the round-1 fix commit on PR #3493; the prior failure-only filter, all-or-nothing feed reading and unlabelled log line return."
---

CodeRabbit's first review of PR #3493 raised six findings and a nitpick; each was verified and fixed.

- **Run selection.** A pull request's head runs are read when the newest run of a workflow concluded `failure` or `timed_out`, or has not completed. A `cancelled` run is left out: the head's code did not fail it, a newer push or a manual cancel did.
- **Artifact listing failure.** A failed artifact listing reads as no feeds, so every red job falls back to its log instead of failing the command.
- **Partial reports.** A job is reported from its artifact only when every report in it decoded. When some reports are unreadable, the command names them, prints one verdict line per readable report (at most a quarter of the agent budget, the rest counted on one line) and still reads the job's log, so the failing log region keeps its share of the budget.
- **Budget.** The bounded failing region reserves room for the job header, the partial-report verdict lines, the verdict lines, the saved-log line and the omission line. Every frame line is cut to `agentBudget.maxLineChars`, so the frame takes at most about 3,200 characters and the region keeps the rest of the budget. When even the omission line does not fit beside the frame, the region returns no line, so a job section never passes `agentBudget.maxChars`.
- **Saved-log label.** The saved-log line and each section of the saved file say what the log holds: failing steps only (`gh run view --log-failed`, marked when the capture was truncated) or the whole job log. The monitor's own wording is unchanged.
- **Inflate cap.** A feed artifact may hold at most 8 MiB of JSON entries in total (eight times the 1 MiB per-entry cap), each entry counted at the larger of its compressed and declared original sizes, because fflate copies a stored entry by its compressed size. A stored entry whose two sizes differ is refused. Entries past the limit are not inflated, and either case fails the read with a `CiCommandError`.
- **Option decoding.** Job and step `conclusion` and a job's `steps` decode to `Option` (`OptionFromNullOr`, `OptionFromOptionalNullOr`) and encode back to their wire forms.
