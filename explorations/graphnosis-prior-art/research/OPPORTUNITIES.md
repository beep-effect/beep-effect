# Friction Ledger

Receipts recorded at the moment friction happened, per the repo's friction-first-class law.

## 2026-08-06 — Secret Scanning catch-22 on subtree squash commits

- **Doing:** driving PR #607 (this packet + the effect `4.0.0-beta.104` subtree refresh) to
  mergeable.
- **Evidence:** hosted `Secret Scanning` failed with `leaks found: 1` — the immutable squash
  commit `cb5d50cf0a` trips `generic-api-key` on the `Config.redacted` JSDoc sample
  (`packages/effect/src/Config.ts:1484`), the same false positive already admitted at line 1482
  for the previous squash. The branch carried the correct `.gitleaksignore` fingerprints, but the
  gate pins `.gitleaksignore` to the base branch by design (`.github/workflows/check.yml`
  "a PR cannot add suppression fingerprints to its own scan"), so the PR could never pass on its
  own — a prerequisite PR (#609) had to land the fingerprints on `main` first.
- **Prevention:** a subtree-refresh runbook step — before pushing a `git subtree pull --squash`
  branch, scan the squash range with the **base** branch's gitleaks config
  (`git show origin/main:.gitleaksignore`), and land any new fingerprints on `main` as a
  config-only PR first. Candidate home: the effect-v4 subtree update notes or a
  `docs/` runbook page; could also be a `beep` CLI preflight (`beep ci lane secrets --base`).

## 2026-08-06 — half-pushed platform bump left PR CI red across 8 lanes

- **Doing:** same PR; the subtree bump (`03d80c6c12`) was pushed while its adaptation commit
  (`bce8e78fd6`) stayed local, so hosted CI built a tree with renamed Schema APIs and no
  adaptations — 7 lanes red (Check, Test Unit/Integration, Docgen, JSDoc Ratchet, Property Laws,
  Coverage, IPC Stdio) with failure text (`Schema$1.TaggedErrorClass is not a function`,
  TS2345 at `OpenAiCompatLanguageModel.service.ts:846`) that reads as 7 distinct problems.
- **Evidence:** run 31141879419; attribution cost a full lane-by-lane log pass before any repair
  was safe.
- **Prevention:** treat subtree-bump + adaptation as one atomic push — publish through
  `beep yeet publish` (which proves before pushing) instead of pushing the subtree merge
  directly.
