# GOAL: Slice Topology Audit

Repo root: the current `beep-effect` checkout; all paths below are repo-relative.

Outcome: make the slice grammar mechanical — land the locked doctrine
amendments, then ship `beep architecture audit` (closed `LiteralKit`
vocabularies shared with the generator, schema-versioned report, day-one
baseline ratchet) as a required check.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/slice-topology-audit/README.md`
- `goals/slice-topology-audit/SPEC.md`
- `goals/slice-topology-audit/PLAN.md`
- `goals/slice-topology-audit/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, `standards/ARCHITECTURE.md`,
and the graduated exploration `explorations/v3-consistency-audit/` (`DECISIONS.md` is binding;
`BRIEF.md` holds the grammar block; `MAP.md` the sequencing;
`synthesis/40-recommendations-ranked.md` the mechanisms). Higher-priority repo
standards outrank packet prose when they conflict.

Scope:

- In: `standards/architecture/DECISIONS.md` + doctrine text (amendments PR);
  `packages/tooling/tool/cli/src/commands/Architecture/**` (`audit`
  subcommand, `RoleVocabulary` / `RoleMember` / `ContractMember`,
  `AuditReport` / `AuditBaseline`); `Fallow.command.ts` classifier export;
  `SchemaTopology.ts` regex export; `Quality/Tasks.ts`, `Ci/CiLane.ts`,
  `check.yml`, `GithubChecks.ts`, root `package.json` (gate wiring);
  the audit baseline (`architecture.audit-baseline.jsonc` under `standards/`);
  CLI tests.
- Out: slice codemods, the `AcceptedProofManifest` / `architecture-lab`
  rewrite (that is `goals/canonical-proof-reconciliation`), driver /
  foundation / tooling rule packs, any change to `beep architecture check`
  or the `architecture-operation-plan/v1` contract, casing.

Workflow:

1. Inspect referenced files and current repo state; re-verify line cites.
2. Schema → `Context.Service` contract → implementation; reuse
   `resolveWorkspaceDirs`, `collectTypeScriptFiles`, `internal/ratchet`,
   `createRepoTsMorphProject` — never a second walker or ratchet.
3. Three PRs in order: amendments → command + baseline → gate wiring.
4. Preserve unrelated user/worktree changes.
5. Keep decisions tied to evidence from files, tests, docs, or command output.
6. Update packet evidence/status if the implementation changes readiness.
7. At the Close phase, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] `beep architecture audit --slice architecture-lab --json` on `main`
      reports exactly the expected finding set P0 derived; after
      `--write-baseline` a second run exits 0 and an injected regression
      exits non-zero.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/slice-topology-audit/GOAL.md)" -le 4000
jq . goals/slice-topology-audit/ops/manifest.json
git diff --check -- goals/slice-topology-audit
bun run beep quality package-verify @beep/repo-cli
```

Never overturn a locked exploration decision here — reopen the exploration at
`align` instead.

The final PR carries the reflection and writes `closeout` naming itself. Done
only when this passes and `goals completion refresh --slug slice-topology-audit` prints
verified, when this passes under an operator ruling in `decisions/`, or when an
operator blocker is reported with evidence:
`git show origin/main:goals/slice-topology-audit/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
