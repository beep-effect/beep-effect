# GOAL: drive Professional Desktop adversarial QA to convergence

Execute the active campaign defined by
`goals/professional-desktop-adversarial-qa/README.md`. The campaign is complete
only after two consecutive full rounds have zero unwaived findings and the
result ships through Yeet.

## Read first

1. `AGENTS.md` and the required browser-QA skills.
2. This packet's `README.md` campaign contract.
3. `ledgers/findings.md`, `ledgers/waivers.md`, and `ledgers/backlog.md`.
4. The newest `history/round-NN/` evidence before opening another round.
5. `ops/manifest.json` for phases and stop conditions.

## Execute

- Preserve the campaign's locked runtime, credential, Box-root, browser-lane,
  and browser/Tauri alternation boundaries. Resolve secrets only through the
  authorized 1Password environment flow; never print or persist raw values.
- Run gesture-bearing scenarios through the repository browser-QA recording
  loop so each judgment has replayable video, witness events, and extracted
  frames. Serialize browser lanes as required by the campaign contract.
- For every confirmed finding, record the screenshot, exact reproduction,
  source location, recommended repair, severity, and disposition in the
  round evidence and master ledger.
- Repair confirmed findings without weakening tests, quality gates, security,
  or the campaign's waiver policy. Run the narrow affected checks after each
  repair wave and the packet's full acceptance proof at round close.
- A round is clean only when every required lane completed and produced zero
  unwaived findings. Blocked or unexercised coverage is not clean.
- Continue until two consecutive full rounds are clean. Then run the Yeet
  repair, verification, publication, hosted-check, review-thread, and packet
  closeout sequence required by the README and repository instructions.

## Stop and report

Stop before destructive or out-of-scope external changes, when required QA
credentials or runtime services are unavailable, or when the same blocker
repeats after reasonable investigation. Preserve the evidence and identify
the exact resume condition.
