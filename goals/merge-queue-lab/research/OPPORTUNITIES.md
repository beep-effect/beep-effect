# Merge Queue Lab — Opportunities

Friction receipts, recorded when they happen.

## 2026-11-09 — planned paths in a new goal SPEC reached main unchecked

- **Doing:** graduating `explorations/github-merge-queue` into this packet as
  a docs-only pull request (#3047).
- **Evidence:** `SPEC.md` named two files that do not exist yet as
  repo-root-relative paths (the lab workflow and the findings ledger).
  `bun run beep knowledge semantic-delta` reports each as an introduced
  `broken-tracked-path`. The cheap tier that gates a push does not run that
  gate, hosted Heavy / Lint Policy passes without work on a docs-only diff, and
  `yeet final-check` reported it 20 minutes after the push, by which time the
  pull request had merged. A second local red in the same run, coverage on
  `PrivateHomePaths.ts`, was inherited from #3039 and fixed on `main` by
  #3048.
- **What would have prevented it:** running the knowledge semantic-delta gate
  in the cheap tier whenever the diff touches a packet, or the hosted
  docs-policy job that `explorations/ten-minute-certainty` decision D8 already
  plans (ROUT-02). Until then: after committing a new packet, run
  `bun run beep knowledge semantic-delta` before pushing.
