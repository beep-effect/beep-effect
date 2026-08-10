# Friction & Opportunity Ledger

Receipts recorded at the moment friction happens (repo law: never saved for
closeout).

## 2026-08-06 — TS2589 flake class defeated its own quarantine rerun

- **Doing:** `yeet publish --pr` for the docs-only packet-open PR (#612).
- **Evidence:** first proof run — `@beep/ui#build` failed with a no-location
  `error TS2589`; the flake-quarantine machinery correctly detected the
  signature, reran `@beep/ui` standalone (green), then reran the FULL build
  lane — where a *different* package (`@beep/box#build`) flaked with the
  same signature, and the quarantine kept the failure hard
  ("lane rerun failed with exit 2; keeping failure hard"). The same class
  hit `@beep/xai#check` in the check lane and was quarantined green there.
  Manual recovery: standalone builds of both packages passed instantly,
  full `bun run build` green (131/131), soft-reset the unpushed commit,
  republish — second proof fully green. Net cost: one full ~50-minute proof
  plus operator intervention for an environment-only failure class on a
  markdown-only diff.
- **Prevention:** the quarantine's lane-rerun policy treats a *new* flake
  in the rerun as a hard failure, but a no-location TS2589 in a DIFFERENT
  package on the rerun is the same environment signature, not new evidence.
  A candidate fix: let the quarantine match the signature per-incident (not
  per-package) within one lane run, or cap-and-retry the lane once more
  when the second failure also matches the no-location TS2589 signature.
  (Known class: memory `ts2589-native-compiler-flake-class`; this receipt
  adds the quarantine-defeat wrinkle.)

## 2026-08-06 — summarizing WebFetch on long MPEP pages fabricates absence

- **Doing:** research Lane B fetching MPEP § 608.04 (~875 KB page).
- **Evidence:** two summarizing fetch calls reported the section "not
  present"; a full-page read found it. Recorded in
  [`02-drafting-episode-frame.md`](./02-drafting-episode-frame.md) §12.
- **Prevention:** for statute/MPEP-scale pages, treat a "section absent"
  answer from a summarizing fetch as unverified; only a full-page read is
  evidence of absence. Worth a line in the research-lane prompt template.
