# Heavy-pool diet: friction receipts

Receipts recorded while the work happened. Secrets, home paths and machine
identifiers are redacted.

## 2026-11-13: the readiness monitor cannot read the check census

- **Doing:** driving #3301 to ready with `bun run beep yeet monitor --until-ready`.
- **Evidence:** the monitor failed three times with "Failed to read the
  complete pull request check census", while direct REST reads of the same
  PR's check runs worked and the GitHub rate limit had headroom. Worked
  around by acknowledging the inbox rows as observed and following the
  checks through REST.
- **Would have prevented it:** the monitor naming the read that failed and
  retrying it, or accepting a census it can complete through REST.

## 2026-11-13: local final-check under sibling load

- **Doing:** `bun run beep yeet final-check` for #3301 while three sibling
  lanes ran on the same 12-core worker.
- **Evidence:** cheap-gates ran for over 21 minutes at a load average near 30
  and was stopped. The receipt passed with 8 recorded skips (cheap-gates,
  lint, repo-sanity, fallow, coverage, lint-policy, check, docgen) that the
  hosted run on the same head covered.
- **Would have prevented it:** final-check reading the head's green hosted
  gates as evidence instead of replaying them when local compute is
  constrained.

## 2026-11-13: the secret-route doctor fails without a failing line

- **Doing:** a `gh` read from the orchestrating session (about 23:40Z).
- **Evidence:** "GitHub credential delivery failed; no credential was
  printed". `op-doctor` printed three PASS lines and then "FAIL diagnostic
  completed" with no failing check named. A fresh `gh` read worked a few
  minutes later.
- **Would have prevented it:** `op-doctor` naming the check that failed, so a
  transient delivery failure can be told from a broken route.
