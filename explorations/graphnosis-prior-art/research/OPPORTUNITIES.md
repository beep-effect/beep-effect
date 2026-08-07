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

## 2026-08-07 — beta.104 made `epistemic/server` uncompilable on 16 GB hosted runners

- **Doing:** driving PR #607's hosted checks green after the effect `4.0.0-beta.104` refresh.
- **Evidence:** eight hosted attempts across five heads. Concurrency caps were walked 4 → 3 → 2 →
  1 (commits `9eaf6d469b`, `de86011973`, `9d0c39d45f`); at every level the killed task list
  shrank until, fully serial, a **single** task still exit-137s: `packages/epistemic/server`
  `bun run build` (`tsc -b`) alone starves a 16 GB `ubuntu-24.04` runner (Test Integration
  10:24→10:37, Coverage 10:24→11:05, both killed on exactly that task; Check's serial tsgo pass
  ran 57 min then "runner lost communication"; Docgen's runner died at `--parallel=2`).
  Local proofs pass because the workstation has 96 GB — the pressure is invisible off-runner.
  Push-event lanes stay green only because they ride the remote turbo cache; PR lanes compile
  cold by security design (`cache-write: "false"`, no `TURBO_TOKEN`).
- **Prevention / unlock:** (a) short-term: a swap-file step in `check.yml` before the heavy
  lanes, or larger runners — workflow edits were outside this session's write surface; (b) real
  fix: the epistemic-slice type-instantiation explosion under beta.104 belongs to the
  box-typecheck-cost / instantiation-census campaign — `epistemic/server`, `epistemic/client`,
  `epistemic/ui`, `db-admin`, `ontology/client`, `tooling/tool/cli`, and `apps/storybook` were
  the recurring kill set; (c) worth deciding: a read-only remote-cache lane for PRs.
