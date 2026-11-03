# Cache baseline review: cached Fallow verdicts (2026-11-02)

Branch `perf/fallow-k2-cache-concurrency`. The re-record covers the root subject `//`,
the only subject `bun run beep cache audit` reported after this change: eight
`unreviewed-expansion` findings (the Fallow rows that now cache) and the matching
`configuration-source-drift` row for `turbo.json`. Source: finding K2 of the
2026-11-02 quality-command performance audit. The reasoning per task is in
`docs/runbooks/turbo-cache-inputs.md`.

## What changed

- **Eight root tasks flip `cache: false` to `cache: true`**:
  `//#fallow:health:check`, `//#fallow:health:advisory`,
  `//#fallow:boundaries:advisory`, `//#fallow:flags:advisory`,
  `//#fallow:security:advisory`, `//#fallow:fix-preview:advisory`,
  `//#fallow:dead-code:check` and `//#fallow:boundaries:config-check`. Each command
  reads the working tree that Fallow discovers, the Fallow and plugin configuration,
  the committed baselines and the installed Fallow version. It reads no clock,
  network or git history: the health lane requests only `--complexity --file-scores`
  since #2630, so no churn section runs. `BEEP_PROOF_BASE` stays in the key, so a
  different base never restores the wrong envelope's `baseRef`.
- **All nine Fallow rows share one input set.** It adds what the old lists missed:
  the two regression baselines and the generated boundaries config the commands pass
  as `--baseline`, `--regression-baseline` or `--config`
  (`standards/fallow.*.jsonc`); every code file Fallow can discover outside the source
  trees (`**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs,html,css}`, which covers root configs,
  `goals/**`, `explorations/**`, `docs/**` and `scratchpad/**`); `.gitignore` files,
  which decide discovery; and the root tool configuration the active plugins read
  (`*.{json,jsonc,yml,yaml,toml}`, `.*.{json,jsonc,toml}`, `.changeset/config.json`).
  It excludes Git-ignored output trees (`dist`, `build`, `coverage`, `.next`,
  `.turbo`, `.beep`, `storybook-static`, `src-tauri/{target,gen}`, generated package
  `docs`) that Fallow never reads. A live probe on this branch hashed 16,978 inputs
  and found all 8,045 files that `fallow list --files` discovers among them.
- **`//#fallow:audit:check` stays uncached.** It diffs against the commit behind
  `BEEP_PROOF_BASE`, which locally and on pull requests is the ref name
  `origin/main`; that commit moves while the key stays the same.
- **Tool failures no longer exit 0 in advisory mode.** A non-ok envelope records a
  tool failure, not a verdict, so Turbo never caches one as a success.
- **Outputs are unchanged.** They already declared the envelope and the raw report it
  cites (`.beep/fallow/<lane>.<mode>.json`, `.beep/fallow/raw/<lane>.<mode>.*`).

## Proof

`packages/tooling/tool/cli/test/fallow-turbo-cache.test.ts` builds a Turbo fixture from
the production rows and runs them twice. The second run, with `.beep/fallow` deleted,
restores every envelope and the raw evidence it cites byte for byte without running a
command. A prose edit outside the inputs keeps every row cached. A failing row runs
again on every invocation. The same file checks the live repository: every file Fallow
discovers, and every plugin configuration file, is a hashed input of each cached row.

## Unchanged

`scope`, `profile` and `epoch` are copied from the current baseline. No remote-cache
authority, qualification tuple or exception inventory changes, and no qualification
is granted to the newly cached tasks (legacy posture recorded only).

## Reversal

Revert the `turbo.json` Fallow rows, the advisory exit rule in
`FallowQuality.command.ts`, and the test and runbook edits, then re-record `//`.
