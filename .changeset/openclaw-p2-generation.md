---
"@beep/infra": minor
---

Add the OpenClaw generation engine and workstation applicator stack
(`infra/src/OpenClaw.ts` + the `infra/openclaw` Pulumi project). The module
consumes the `@beep/openclaw` driver for config rendering and exposes pure,
applicator-agnostic renderers (systemd user unit, run script, content-hashed
generation tree, and the preflight / apply / rollback / drift-audit /
backup-ship scripts) plus an `OpenClawStack` component chaining local
preflight → stage → apply → probe commands with an optional encrypted
backup-ship leg to dankserver (receipt-verified; dankserver receives files
only). Preflight binds machine identity fail-closed and asserts an armed
sudo ticket before any mutation; apply encodes the staged upgrade with a
stopped-state WAL-consistent snapshot, atomic pointer switch, bounded health
wait, snapshot restore on failure, and a `PRAGMA user_version` downgrade
guard; the drift audit is read-only and alert-only.
