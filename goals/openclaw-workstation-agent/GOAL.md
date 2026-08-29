# GOAL: Deploy the OpenClaw workstation agent as generation-based infrastructure

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: a legal-focused OpenClaw agent runs on the Linux workstation as
immutable, hash-versioned `OpenClawGeneration` infrastructure managed by a
Pulumi+Effect stack — deployed via `pulumi up`, surviving drift audits,
secret rotation, and upgrade-with-rollback, live on Telegram + Control UI.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/openclaw-workstation-agent/README.md`
- `goals/openclaw-workstation-agent/SPEC.md`
- `goals/openclaw-workstation-agent/PLAN.md`
- `goals/openclaw-workstation-agent/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, and the standards named by
`SPEC.md`. Higher-priority repo standards outrank packet prose when they
conflict. Provenance: `explorations/openclaw-deployment-platform` (licenses
in research/SOURCES.md are load-bearing; nix-openclaw is AGPL: clean-room
only).

Scope:

- In: `packages/drivers/openclaw` (NET-NEW `@beep/openclaw`), `infra/`
  (new `infra/openclaw` project + `infra/src/OpenClaw.ts`), this packet, and
  workstation state (`/etc/beep/openclaw/<hash>/`, systemd `--user` unit)
  through the stack's applicator only.
- Out: dankserver in any form (never a migration target; dumb backup storage
  only), voice, llama-server lifecycle, gateway API client, real legal
  capabilities, Discord, plaintext secrets anywhere.

Workflow:

1. `PLAN.md` phases are sequential and P0 hard-gates everything: run the
   four-prototype gauntlet first, per the executable per-spike contract in
   `ops/handoffs/p0-gauntlet-contract.md` (isolation, assertions, cleanup,
   evidence). A failed assertion re-opens its decision in `SPEC.md`
   Decision Log before any implementation phase runs.
2. Make the smallest change that satisfies `SPEC.md`; schema-first,
   effect-first; the driver must not depend on `shared/*`.
3. Secrets are `op://` references as data; the single sanctioned exception is
   the `OP_SERVICE_ACCOUNT_TOKEN` systemd credential (SPEC Exception Ledger).
   Plaintext secrets never touch tracked files, Pulumi state, or output.
4. Archive spike/slice evidence under `history/`; keep decisions tied to
   evidence from files, tests, docs, or command output.
5. Update packet evidence/status if implementation changes readiness.
6. At P4 Close, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied (gauntlet, driver, first
      vertical slice, live agent).
- [ ] Required verification commands pass, or unrelated failures are
      reproduced and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/openclaw-workstation-agent/GOAL.md)" -le 4000
jq . goals/openclaw-workstation-agent/ops/manifest.json
git diff --check -- goals/openclaw-workstation-agent
```

Stop and report before changing public API, schema, data migration, auth,
infra, security behavior, dependencies, lockfiles, generated files, or
destructive state unless `SPEC.md` explicitly requires it. Completion gate:
not achieved until the work ships as PR(s) driven to mergeable via `/yeet`.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
