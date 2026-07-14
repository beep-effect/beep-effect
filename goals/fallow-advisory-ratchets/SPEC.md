# Fallow Advisory Ratchets Spec

## Objective

Implement a follow-up packet for selective Fallow advisory ratchets. The work
must make only policy-backed ratchets blocking, and only after the repo has
closed false positives, doctrine gaps, and baseline policy.

The thesis is "new debt fails", not "all existing advisory findings fail".

## Portfolio disposition (2026-07-14)

P0, P1, and P3 boundary-config freshness are the retained deliverable. P2
health, the P3 feature-flag registry, and P4 are recorded deferrals until a
Fallow advisory lane regresses or the post-P5 platform window opens. The
contracts below remain the guardrails if that trigger later reopens the work.

## Source Hierarchy

1. User objective for Fallow Advisory Ratchets.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. `goals/fallow-quality-enforcement/SPEC.md` and
   `research/feature-matrix.jsonc`.
4. This `SPEC.md`.
5. `PLAN.md`, `GOAL.md`, and supporting packet artifacts.

## Branch And Worktree

The implementation starts from merge commit `c25dc13663` on updated
`origin/main`:

```sh
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c feat/fallow-advisory-ratchets
```

Preserve unrelated local and untracked work. Do not stage unrelated files under
`.claude/` or the sibling `goals/fallow-zero-dead-code/` packet.

## Packet Scope

Create and execute a child packet at `goals/fallow-advisory-ratchets/`. Do not
extend the completed P0-P3 record in `goals/fallow-quality-enforcement`.

Required packet artifacts:

- `GOAL.md`
- `README.md`
- `SPEC.md`
- `PLAN.md`
- `tasks/tasks.jsonc`
- `tasks/tasks.schema.json`
- `ops/manifest.json`
- `ops/validate-packet.ts`

## Ratchet Contracts

### Health

`health` is the second promotion candidate. It requires a calibrated inventory
before blocking, proposed as `standards/fallow.health.inventory.jsonc`.

The future gate may fail only new or worsened critical/high findings after:

- Effect/schema-heavy false positives are classified.
- Generated or legacy hotspots are inventoried.
- Inherited moderate findings remain cleanup-on-touch/advisory.

Avoid a blunt global complexity gate.

### Boundaries

`boundaries` must stay split:

- Generated boundary config freshness may become a hard check through
  `bun run beep quality fallow boundaries config-check --check`.
- Direct boundary analyzer violations stay advisory.
- Architecture-role legality stays advisory until doctrine-backed metadata
  exists.
- Only `manifest-derived` or otherwise promotion-eligible rules may block.
- `review-gate-only` rules cannot block.

Implementation note: `repo-sanity:fallow-boundaries-config` is the hard check.
Raw `fallow:boundaries` analyzer output remains advisory.

### Flags

`flags` is blocked by missing lifecycle registry policy even though the current
baseline is quiet. The packet reserves
`standards/feature-flags.inventory.jsonc` as the repo-owned registry target.

Only after that registry exists may Fallow fail on new unregistered or expired
flags.

### Security

`security` remains candidate surfacing. Existing security lanes stay
authoritative. A future gate may fail only new untriaged candidates after a
triage inventory classifies coverage by existing security lanes.

### Fix Preview

`fix-preview` remains dry-run/advisory. Yeet repair and hidden repair flows
must never run non-dry-run `fallow fix`.

A future gate may fail only when dry-run output cannot be produced or parsed.

### Deferred Lanes

`runtime-coverage` and `editor-mcp-hooks` are deferred. They require separate
licensing, privacy, local-tooling, and bypass/waiver policy before adoption.

## Acceptance Criteria

- [ ] Packet exists at `goals/fallow-advisory-ratchets`.
- [ ] Parent packet remains reference-only and completed.
- [ ] `health` ratchet requires calibrated baseline inventory before blocking.
- [ ] `boundaries` ratchet wires generated config freshness only.
- [ ] `flags` requires a repo-owned feature flag registry before blocking.
- [ ] `security`, `fix-preview`, `runtime-coverage`, and `editor-mcp-hooks`
      are guarded or deferred.
- [ ] `ops/validate-packet.ts` passes.
- [ ] Parent feature matrix still has only `audit` and `dead-code` promoted.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Launcher size | `test "$(wc -m < goals/fallow-advisory-ratchets/GOAL.md)" -le 4000` | Passes |
| Packet validity | `bun goals/fallow-advisory-ratchets/ops/validate-packet.ts` | Passes |
| Parent validity | `bun goals/fallow-quality-enforcement/ops/validate-packet.ts` | Passes |
| Fallow wrappers | `bun run beep quality fallow command-contract-check --assert audit,dead-code,health,boundaries,flags,security,fix-preview --require-envelope --out-dir .beep/fallow` | Passes |
| Boundary freshness | `bun run beep quality fallow boundaries config-check --check` | Passes |
| Promotion contract | `bun run beep quality github-checks plan-contract-check --mode pre-push --feature-matrix goals/fallow-quality-enforcement/research/feature-matrix.jsonc --expect-promoted-fallow-lanes` | Only promoted lanes are wired |
| Repo check planner | `bun test packages/tooling/tool/cli/test/quality-tasks.test.ts` | Policy ratchet lanes are wired outside raw Fallow promotion lanes |
| Effect function law | `bun run beep laws effect-fn --check` | Passes |
| Repo export shard | `bun run beep quality repo-exports-catalog --package-shard --package @beep/repo-cli --check` | Passes |
| Repo export aggregate | `bun run beep quality repo-exports-catalog --from-shards --check` | Passes |
| Whitespace | `git diff --check -- goals/fallow-advisory-ratchets` | Passes |

## Stop Conditions

- Do not remove Knip.
- Do not run non-dry-run `fallow fix`.
- Do not make runtime coverage blocking.
- Do not encode architecture meaning in Fallow config before doctrine.
- Do not promote any lane with unresolved false positives or doctrine gaps.
- Do not make all current advisory findings fail.
