# GOAL: Alchemy Vault-Sync Slice

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: the `documents` vault-sync slice runs on `@alchemy.run/domain` 2.0.0-beta.85
over a repo-owned Postgres Platform driver with the Effect Cluster workflow
engine; one Api (HTTP, CLI, MCP views) behind Session middleware; optimistic +
offline-intents client; legacy tables rebuilt as Projections after a
single-writer cutover; doctrine amended and the entity kit frozen.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/alchemy-vault-sync-slice/README.md`
- `goals/alchemy-vault-sync-slice/SPEC.md`
- `goals/alchemy-vault-sync-slice/PLAN.md`
- `goals/alchemy-vault-sync-slice/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `packages/documents/{domain,use-cases,server,tables}/**`, a new Postgres
  Platform driver package (via `bun run beep create-package`), the vault-sync
  frontend, the root catalog + `bun.lock` (beta.85 lockstep bump),
  `standards/**` doctrine entries, a freeze guard on
  `packages/shared/domain/src/entity/**`, and this packet.
- Out: every other slice; deleting the entity kit; CRDT/replica sync; MCP
  command tools; Cloudflare DO storage; dual writes. Decisions D0–D17 in
  `explorations/alchemy-domain-adoption/DECISIONS.md` are binding.

Workflow:

1. Inspect referenced files and current repo state.
2. Make the smallest change that satisfies `SPEC.md`.
3. Preserve unrelated user/worktree changes.
4. Keep decisions tied to evidence from files, tests, docs, or command output.
5. Update packet evidence/status if the implementation changes readiness.
6. At the Close phase, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/alchemy-vault-sync-slice/GOAL.md)" -le 4000
jq . goals/alchemy-vault-sync-slice/ops/manifest.json
git diff --check -- goals/alchemy-vault-sync-slice
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each in SPEC.md's Decision Log with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

Ship proposedCloseout and the reflection in the final implementation PR while
initiative.status stays active or paused. A proposal never reports achievement.
Done only when exact-head hosted readiness and merge evidence verify the proposal
through `bun run beep goals completion refresh --slug <slug>`, or when a blocker
that needs the operator is reported with file/command evidence.
