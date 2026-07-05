# GOAL: Drive the repo-wide schema crispening to a durable, self-enforcing state

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path. Paths below are repo-relative.

Outcome: push every invariant and pure behavior into `effect/Schema` and onto
the data across `packages/**`/`apps/**`; land four novel lint cards as real
AST detectors; flip a per-owner blocking policy family-by-family; amend
effect-first Law 20/47 + `standards/architecture/DECISIONS.md`; ship a tracked
schema catalog so the crispening survives after this packet closes.

This is a compact `/goal` launcher. `SPEC.md` is the normative contract; treat
it, not this file, as binding when they disagree:

- `goals/repo-crispening-orchestration/README.md`
- `goals/repo-crispening-orchestration/SPEC.md`
- `goals/repo-crispening-orchestration/PLAN.md`
- `goals/repo-crispening-orchestration/ops/manifest.json`
- `goals/repo-crispening-orchestration/research/decisions-locked.md` (D1-D5,
  G1-G7 — locked, do not reopen)
- `goals/repo-crispening-orchestration/research/prompt-2026-07-05.md`

Read those, then `AGENTS.md`, `CLAUDE.md`, skills `crispen`,
`effect-first-development`, `schema-first-development`, `yeet`. Repo standards
outrank packet prose. Training data is Effect v3; this repo is v4 — verify
every API against `.repos/effect-v4` and SPEC's corrections table first.

Scope:

- In: SPEC's P0 enforcement surfaces (`SchemaFirst.ts` novel cards,
  `standards/schema-crispening.policy.jsonc`,
  `standards/schema-first.inventory.jsonc`, Law 20/47 amendment,
  `standards/architecture/DECISIONS.md`,
  `standards/schema-catalog.generated.jsonc`); this packet's own files;
  family-scoped waves (foundation → drivers → tooling → apps/slices).
- Out: the nine SPEC Non-Goals fences (interface carve-outs, SQL-null
  encoding, error-tag merging, trust boundaries, `declare namespace`
  recursion, `Graph`/`MutableHash*`, native-collection migration, wave scope,
  ripple sweeps) plus the `effect-native-migration` seam — see SPEC.md
  Non-Goals for full text.

Workflow (phase order per PLAN.md; do not skip or reorder):

1. P0 — enforce: author the four novel lint cards non-blocking via the
   per-owner policy, wire Yeet, amend Law 20/47 + DECISIONS.md.
2. P1 — five read-only S1-S5 specialists baseline + rank findings; one writer
   per package during remediation, never a specialist.
3. P1.5 — mechanize: ts-morph codemods with golden-diff dry-runs.
4. P2 — bounded, family-scoped waves; each gates on `yeet verify` and a §5.3
   parity proof before flipping that family's cards to blocking.
5. P3 — generate + track `standards/schema-catalog.generated.jsonc`.
6. P4 — close: confirm the SPEC Definition of Done, then `/reflect`.

Stop per SPEC's Stop Conditions (parity-proof failure; ripple beyond a wave's
family; any fence violated; `yeet verify` red without repair;
`SFV4-getsomes-struct` before Law 20/47 merges) — halt the wave, record the
blocker in `ops/progress.json`, report.

Acceptance:

- [ ] SPEC.md Acceptance Criteria and Definition of Done are satisfied.
- [ ] Verification commands pass, or unrelated failures are reproduced and
      recorded separately.
- [ ] No unrelated refactors or formatting churn; no Non-Goals fence violated.

Verification:

```sh
test "$(wc -m < goals/repo-crispening-orchestration/GOAL.md)" -le 4000
jq . goals/repo-crispening-orchestration/ops/manifest.json
git diff --check -- goals/repo-crispening-orchestration
bun run beep lint schema-first
bun run beep yeet verify
```

Stop and report before changing public API, schema wire formats, data
migrations, auth, infra, security behavior, generated driver output, or
dependencies beyond SPEC's stated needs.

Done only when the SPEC Definition of Done is met, acceptance passes, and
verification is complete, or a blocker is reported with file/command evidence.
