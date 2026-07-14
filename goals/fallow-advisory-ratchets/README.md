# Fallow Advisory Ratchets

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

### Portfolio closeout (2026-07-14)

The retained deliverable is P0 packet authoring, P1 duplication-ratchet
retirement, and the shipped boundary-config freshness portion of P3. P2 health,
the feature-flag registry remainder of P3, and P4 are recorded deferrals until
a Fallow advisory lane regresses or the post-P5 platform window opens.

The P3 disposition is intentionally split: generated boundary-config freshness
is implemented and tested; `standards/feature-flags.inventory.jsonc` is not
shipped and remains deferred. No raw Fallow advisory lane is promoted by this
closeout.

## Mission

Implement the next phase after Fallow Quality Enforcement: selected advisory
lanes become narrow, policy-backed ratchets where new debt fails, while
inherited baselines, false positives, and doctrine gaps remain explicit.

This packet is not an instruction to make every Fallow finding fail.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/fallow-advisory-ratchets/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - phase sequence.
4. [`tasks/tasks.jsonc`](./tasks/tasks.jsonc) - ranked task inventory.
5. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
6. Parent packet: [`goals/fallow-quality-enforcement`](../fallow-quality-enforcement/).
7. Precedent packet: [`goals/fallow-zero-dead-code`](../fallow-zero-dead-code/).

## Ratchet Order

1. `health`: recorded deferral until a Fallow advisory lane regresses or the
   post-P5 platform window opens; calibration still requires a health inventory.
2. `boundaries`: promote generated boundary config freshness only. Analyzer
   violations and architecture-role legality stay advisory.
3. `flags`: recorded deferral under the same trigger; define
   `standards/feature-flags.inventory.jsonc` before any future blocking policy.
4. `security`: keep candidate surfacing advisory until triage inventory exists.
5. `fix-preview`: keep dry-run only; possible future gate is parseability.
6. `runtime-coverage` and `editor-mcp-hooks`: deferred pending separate policy.

## Current Decisions

- `audit` and `dead-code` are already blocking through the parent matrix.
- Duplication enforcement has been retired from repo-owned quality lanes.
- `boundaries` must stay split between generated config freshness and
  architecture legality.
- Generated boundary config freshness is wired through
  `repo-sanity:fallow-boundaries-config`.
- Fallow is an enforcement projection. Architecture meaning remains in
  canonical architecture standards and package READMEs.
- Knip stays in place.
- Non-dry-run `fallow fix` stays forbidden.

## Verification

```sh
test "$(wc -m < goals/fallow-advisory-ratchets/GOAL.md)" -le 4000
bun goals/fallow-advisory-ratchets/ops/validate-packet.ts
bun goals/fallow-quality-enforcement/ops/validate-packet.ts
bun run beep quality fallow command-contract-check --assert audit,dead-code,health,boundaries,flags,security,fix-preview --require-envelope --out-dir .beep/fallow
bun run beep quality fallow boundaries config-check --check
bun run beep quality github-checks plan-contract-check --mode pre-push --feature-matrix goals/fallow-quality-enforcement/research/feature-matrix.jsonc --expect-promoted-fallow-lanes
bun test packages/tooling/tool/cli/test/quality-tasks.test.ts
bun run beep laws effect-fn --check
bun run beep quality repo-exports-catalog --package-shard --package @beep/repo-cli --check
bun run beep quality repo-exports-catalog --from-shards --check
bunx biome check goals/fallow-advisory-ratchets
git diff --check -- goals/fallow-advisory-ratchets
```
