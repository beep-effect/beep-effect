# rqt Ledger — agent-pipeline-velocity (continues repo-quality-throughput)

Conventions per goals/repo-quality-throughput: id, finding, change, measured
delta. Baselines (2026-07-05, 32c/64t, feat/agent-pipeline-velocity):
full `yeet verify` 14m05s cold / 7m42s warm (concurrency 3, 840%/388% CPU);
direct `github-checks pre-push` 6m54s; forced-cold `turbo run check` 25.0s.

## rqt-011 — read-only PR remote cache (B2)

Finding: PR CI lanes rebuilt cold on 2–4 vCPU runners (CSF-001 emptied
TURBO_TOKEN on pull_request). Change: same-repo PRs get
`TURBO_CACHE=local:rw,remote:r` + credentials; forks unchanged; push
read-write (check.yml both sites; lineage vercel/turborepo#1188 → #6624).
Measured: hosted evidence pending first PR run — expect cache HITs with zero
uploads in PR lane logs. Rollback trigger documented (Vercel 429 history).

## rqt-012 — root turbo concurrency hypothesis FALSIFIED (D2, negative result)

Hypothesis: `--concurrency=3` (Tasks.ts ROOT_TURBO_CONCURRENCY_ARG) starves a
64-thread box. Measurement (forced-cold `turbo run check`, 97 tasks):
c=3 → 25.0s at 974% CPU; c=16 → 27.3s at 1350% CPU with +70% user time
(oversubscription thrash). tsgo tasks are internally multi-threaded — 3
concurrent tasks already saturate usefully. **Constant stays 3.** Peak memory
during window: 52.2GB/128GB. Lesson: task-level concurrency is the wrong
lever for internally-parallel tools; lane-level structure is the right one
(see rqt-014).

## rqt-013 — per-step wall-time instrumentation (D1)

Finding: quality lanes had no per-step timing; failures and slowness were
unattributable (turbo `--summarize` covers only turbo tasks — the sequential
non-turbo steps, ~4.5min of the 6m54s pre-push, were dark). Change: both
step runners (streaming + grouped) in Quality/Tasks.ts now log
`[beep-cli] <label>: ok|failed|done in <N>ms`. Measured: n/a (instrumentation);
enables rqt-014 and successors.

## rqt-014 — lint-policy grouped concurrency (D4)

Finding: the 20 lint-policy steps (cspell, markdownlint, oxlint,
eslint-jsdoc, 7 law checks, madge, docgen check, typos...) ran strictly
sequentially via the streaming runner — lane cost = SUM of steps. They are
independent read-only tools. Change: `lint` and `lint:policy` lanes now use
the existing grouped runner at concurrency 6 (LINT_POLICY_STEP_CONCURRENCY).
Measured (2026-07-05, warm): sum-of-steps 142.4s (sequential-equivalent) →
**32.3s wall** at 765% CPU = **4.4× lane speedup, −110s per lint/policy run**.
Wall is within 2s of the floor (max step: dual-arity 30.6s). Top steps:
dual-arity 30.6s, schema-first 19.9s, terse-effect 15.6s, deprecated-apis
12.4s, jsdoc 10.1s. Next candidate if ever needed: the dual-arity checker
itself. Bonus catch: the effect-imports law flagged this change's own
Duration import (stable-form conversion applied via --write) — laws policing
the pipeline that runs them.

## Bug filed — yeet verdict repair-hint misattribution

Two failed verify runs attributed `full:01-pre-push` failures to
"dual-arity" while the actually-failing steps were quality:lint /
quality:test / quality:changeset-status (run 1) and quality:test (run 2);
dual-arity passed standalone and grouped throughout. Suspect: stale
`.beep/yeet/quality-issue-index.json` and/or first-repair-path routing in
QualityIssueIndex picking a default law hint. Debt: make the verdict carry
the failing step labels verbatim (they exist in the runner output).

## D3 note — local/hosted parity smaller than assessed

The exploration (and REPO_RATING) claimed verify lacked the lint-policy
suite; reading the lanes shows `bun run lint` already embeds all 19 policy
steps and pre-push adds fallow + repo-sanity + secrets/security/sast/nix
external lanes. Remaining true gaps vs hosted: none blocking identified;
action reduced to updating goals/repo-quality-throughput/proof-parity-map.md
references at closeout.
