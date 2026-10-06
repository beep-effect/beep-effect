# Opportunities — practice-kg-mcp

Friction receipts, recorded when they happened.

## 2026-10-06 — P9 working-files bundle

- **Salvage hash reads files whole.** `beep corpus salvage` on a folder with an
  857 MB zip took the process past 12 GB and was OOM-killed three times (a
  5.5 GB zip passed 48 GB); two runs raised memory pressure for the whole
  desktop slice. Evidence: `Failed with result 'oom-kill'`, `48G memory peak`.
  Prevention: a streaming file hash; run heavy corpus stages outside the
  desktop's cgroup slice from the start.
- **Salvage and extract cannot resume.** Provenance and `sources.jsonl` are
  written only at the end; every retry started from zero and a killed salvage
  needs its partial output deleted first. Prevention: per-file completion
  records.
- **`corpus extract --source` filters by label across runs.** Two runs sharing
  `source-a` cannot be extracted separately. Prevention: a `--run-label` filter.
- **No extraction engine for `.eml` / `.msg`.** 1,890 saved emails came back as
  "No file-processing engine is available". Prevention: route both to Tika.
- **A shared landing folder was edited.** Moving oversize files out of the
  landing area broke another workstream reading the same tree. Prevention:
  treat landing areas as read-only; build a hard-link view for a subset.
- **Register-first attribution removed existing matters.** Caught only by
  diffing the old and new `matters` tables. Prevention: make that diff a step of
  `verify.ts` (`--compare-to <old bundle>`).
- **Cheap gates do not run the JSDoc lint.** A wrapped code span passed
  `yeet publish` and failed hosted Lint Policy 40 minutes later. Prevention: run
  the package `lint:jsdoc` on changed packages in cheap gates.
