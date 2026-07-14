# GOAL: Fallow Advisory Ratchets retained outcome

Repo: repository root (`./`).

Outcome: retain packet authoring, duplication-ratchet retirement, and shipped
boundary-config freshness. Health, the feature-flag registry, and P4 remain
deferred until a Fallow advisory lane regresses or the post-P5 window opens.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/fallow-advisory-ratchets/README.md`
- `goals/fallow-advisory-ratchets/SPEC.md`
- `goals/fallow-advisory-ratchets/PLAN.md`
- `goals/fallow-advisory-ratchets/ops/manifest.json`
- `goals/fallow-advisory-ratchets/tasks/tasks.jsonc`

Read those first, then `AGENTS.md`, `CLAUDE.md`, and the parent packet:

- `goals/fallow-quality-enforcement/README.md`
- `goals/fallow-quality-enforcement/SPEC.md`
- `goals/fallow-quality-enforcement/research/feature-matrix.jsonc`
- `goals/fallow-quality-enforcement/tasks/tasks.jsonc`

Scope:

- In: this packet, retired duplication ratchet state, generated
  boundary config freshness, and seeded policy work for later lanes.
- Out: raw Fallow lane promotion, Knip removal, non-dry-run `fallow fix`,
  runtime coverage adoption, and new architecture doctrine.

Workflow: preserve the shipped boundary-config freshness proof and keep the
parent packet reference-only. Do not reopen health, flags, or P4 until the
recorded trigger and an explicit status change.

Acceptance:

- [x] Packet files explain the retained and deferred dispositions.
- [x] Duplication ratchet state reflects the retired repo-owned gate.
- [x] `boundaries` wires only generated config freshness.
- [x] Health, flags, and later lanes are recorded deferrals.

Verification:

```sh
test "$(wc -m < goals/fallow-advisory-ratchets/GOAL.md)" -le 4000
bun goals/fallow-advisory-ratchets/ops/validate-packet.ts
bun goals/fallow-quality-enforcement/ops/validate-packet.ts
bun run beep quality fallow boundaries config-check --check
bun test packages/tooling/tool/cli/test/quality-tasks.test.ts
git diff --check -- goals/fallow-advisory-ratchets
```

Stop and report before removing Knip, running non-dry-run `fallow fix`, making
runtime coverage blocking, encoding architecture meaning in Fallow config, or
promoting a lane with unresolved false positives or doctrine gaps.
