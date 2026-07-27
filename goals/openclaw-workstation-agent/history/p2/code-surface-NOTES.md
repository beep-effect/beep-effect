# P2 Evidence — Code Surface (2026-07-27)

Scope: the unprivileged half of P2, landed on `goals/openclaw-p2-generation`
(stacked on `goals/openclaw-p1-driver` / PR #482 pending merge). The live
proofs (slice deploy, rollback, drift demo, backups + restore drill) are
operator-gated and scripted in
[`../../ops/handoffs/p2-slice-proof-runbook.md`](../../ops/handoffs/p2-slice-proof-runbook.md);
their evidence lands beside this file when executed.

## What is proven, and how

- **Repo gates green (authoritative):** `bun run beep yeet verify` exit 0 on
  `ffffa74ec5` (branch head incl. the runbook) after fixes for: cspell
  (`esac`), fallow duplication (shared `pulumiConfigSchemaIssueError` in
  `PulumiConfigSchema.ts` used by AIMetrics + OpenClaw; shared
  `switchScriptBindings` for apply/rollback), fallow dead-code
  (`toIntent` method → free `makeOpenClawDeploymentIntent`), and stale
  fallow boundaries. Post-fix: fallow audit 0 findings, dead-code 0,
  cspell 0.
- **Package proof:** `cd infra && bun run lint && bun run check && bun run
  test && bun run docgen` — biome clean, tsgo clean, 52/52 tests
  (4 files; `test/OpenClaw.test.ts` covers the 8 infra case types plus
  renderer goldens and script-ordering assertions), docgen compiles all
  examples.
- **Structural invariants asserted by tests and verified by inspection:**
  - Apply script: stopped-state `cp -a` snapshot (incl. WAL sidecars)
    strictly BEFORE the atomic `ln -s` + `mv -T` pointer switch; bounded
    30×1 s `/health` wait; failure path restores snapshot + prior pointer;
    `PRAGMA user_version` downgrade guard refuses malformed or older
    recorded stamps (`APPLY-REFUSED` anchors).
  - Preflight: machine-id/hostname/UID/username/home/runtime-dir binding
    failing CLOSED; linger required; bus proven via
    `systemctl --user show -p UnitsLoadTimestampMonotonic` (manager state
    read tolerantly, not via `is-system-running` exit); 108-byte socket
    guard; `sudo -n -v` armed-ticket assertion with operator cue — no
    mutation before preflight passes.
  - Drift audit: read-only, outside Command resources, alert-only
    (`ALERT: OPENCLAW_CONFIG_DRIFT`), covering pointer target, openclaw +
    node versions, unit content hash, enabled/active state, config hash +
    validate, identity.
  - Backup ship: gpg AES256 symmetric archive (passphrase via op://-resolved
    env), `ssh mkdir -p` + `scp` + remote `sha256sum` receipt compare
    (`BACKUP-OK`/`BACKUP-FAIL`); dankserver receives files only.
  - Renderers are pure and applicator-agnostic; config JSON and content
    hash come from the P1 driver (`renderOpenclawConfig`).

## Pins

- Driver: `@beep/openclaw` @ PR #482 head (`openclaw@2026.7.1-2`, commit
  `0790d9f`, Node 24.16.0 — `OPENCLAW_COMPATIBILITY_SET`).
- Stack: `infra/src/OpenClaw.ts`, project `infra/openclaw`
  (`beep-openclaw`), stack name `workstation` (created at operator time,
  local passphrase backend).
