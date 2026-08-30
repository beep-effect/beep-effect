# GOAL: Canonical Proof Reconciliation

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: bring the CLI's accepted proof (`AcceptedProofManifest` +
`architecture-lab`) and the eight live slices onto the amended slice grammar —
kind folders, doctrine suffixes, role-named members (`User.Model`,
`User.Table`, `User.Repo`), per-operation `contracts/` + `handlers/` — one
codemod PR per slice, each proven by a shrinking audit baseline.

Requires `architecture/slice-audit` from `goals/slice-topology-audit`: stop
if `beep architecture audit` or its baseline
(`architecture.audit-baseline.jsonc` under `standards/`) is missing on `main`.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/canonical-proof-reconciliation/README.md`
- `goals/canonical-proof-reconciliation/SPEC.md`
- `goals/canonical-proof-reconciliation/PLAN.md`
- `goals/canonical-proof-reconciliation/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, `standards/ARCHITECTURE.md`
as amended, and `explorations/v3-consistency-audit/` (`DECISIONS.md` is
binding; `synthesis/15` lists the proof divergences). Repo standards outrank
packet prose when they conflict.

Scope:

- In: `commands/Architecture/internal/{AcceptedProofManifest,TemplateRetarget}.ts`
  and the operation-plan test fixtures; `packages/architecture-lab/**` and
  the other manifest-covered proof paths; a `Contract` concept module in
  `@beep/schema` (sibling of `Fn/`); slice packages under
  `packages/{epistemic,law-practice,documents,workspace,ontology,agents,shared}/`
  with their export maps; the audit baseline under `standards/`;
  codemods + golden-diff tests under this packet's `ops/codemods/`.
- Out: new audit rules or gate wiring (file them in
  `goals/slice-topology-audit`), `beep architecture check` and the
  `architecture-operation-plan/v1` schema, bulk rewrites of persisted `$I`
  tag strings, casing, any v3 structure.

Workflow:

1. Inspect referenced files and current repo state; read the baseline.
2. PR-1 manifest + lab first, so `add concept` stops propagating drift.
3. Then one PR per slice in descending baseline order: codemod moves symbol
   and every deep-import site together (`TSMorphService`,
   `createRepoTsMorphProject`; precedent `commands/Laws/EffectImports.ts`),
   `.rpc.ts` → per-op contracts, `audit --write-baseline`, smaller baseline.
4. Schema → `Context.Service` contract → implementation for the kit.
5. Preserve unrelated worktree changes; tie decisions to evidence.
6. Update packet evidence/status if readiness changes.
7. At the Close phase, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] `beep architecture audit --slice architecture-lab --json`
      returns zero findings and the v1 replay test still passes.
- [ ] Every slice PR ends with a strictly smaller baseline; leftovers are
      `follow_ups` rows with owners.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/canonical-proof-reconciliation/GOAL.md)" -le 4000
jq . goals/canonical-proof-reconciliation/ops/manifest.json
git diff --check -- goals/canonical-proof-reconciliation
bun run beep architecture audit --slice architecture-lab --json
```

Stop and report before changing public API, schema, data migration, auth, infra,
security behavior, dependencies, lockfiles, generated files, or destructive
state unless `SPEC.md` explicitly requires it. Never overturn a locked
exploration decision here — reopen the exploration at `align` instead.

Done only when acceptance passes and verification is complete, or when a blocker
is reported with file/command evidence.
