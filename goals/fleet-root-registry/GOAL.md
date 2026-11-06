# GOAL: fleet root registry

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: every path-dependent beep CLI surface resolves the fleet from one
per-repository ordered list of discovery roots; a schema-first authored
registry beside the session ledger holds only seat role, owning seat, drain
status and retention exemption; `beep worktree fleet --join` and
`fleet describe <checkout>` render mirror, registry and ledger facts as a
compact row plus on-demand expansion; the `beep-effect0-worktrees` undercount
is explained or fixed.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/fleet-root-registry/README.md`
- `goals/fleet-root-registry/SPEC.md`
- `goals/fleet-root-registry/PLAN.md`
- `goals/fleet-root-registry/decisions/` (2026-11-06 re-grounding)
- `goals/fleet-root-registry/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `packages/tooling/tool/cli/src/commands/Worktree/Fleet.service.ts`,
  `Fleet.command.ts`, new `internal/FleetRoots.*` and `internal/FleetRegistry.*`,
  `commands/Yeet/internal/Economics.ts` (`projectsRootOf`, `fleetCandidates`),
  `commands/Worktree/internal/ResidueReap.ts` discovery, a fixture fleet test,
  `docs/runbooks/fleet-root-and-registry.md`.
- Out: any checkout move, clone or delete; `worktree add` managed-root rewrite
  and the AGENTS.md worktree bullet (`lane-bootstrap`); timer units;
  `standards/git-worktrees.md`; plain `beep worktree fleet` output.

Workflow:

1. Inspect referenced files and current repo state (`resolveFleetScope`,
   `discoverClones`, `cloneStubs`, Economics discovery, the session ledger
   key and row shape).
2. Schema first: roots document, registry document, `LiteralKit` seat roles
   and drain status; then the `Context.Service` contracts; then stores and
   command wiring.
3. Make the smallest change that satisfies `SPEC.md`; `fleet --json` stays
   byte-identical with roots unset.
4. Preserve unrelated user/worktree changes.
5. Keep decisions tied to evidence from files, tests, docs, or command output;
   record each new call with `bun run beep goals decisions add`.
6. Update packet evidence/status if the implementation changes readiness.
7. At P4 Close, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill (see
   `PLAN.md` P4 Closeout Checklist); `bun run beep lint reflection-artifacts`
   must pass. Name the undercount's cause there.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/fleet-root-registry/GOAL.md)" -le 4000
jq . goals/fleet-root-registry/ops/manifest.json
bun run beep worktree fleet --json > /tmp/fleet-before.json  # roots unset; diff after
bun run beep quality package-verify @beep/repo-cli
git diff --check -- goals/fleet-root-registry
```

Stop and report before changing public API, schema, data migration, auth, infra,
security behavior, dependencies, lockfiles, generated files, or destructive
state unless `SPEC.md` explicitly requires it.

Done only when acceptance passes and verification is complete, or when a blocker
is reported with file/command evidence.
