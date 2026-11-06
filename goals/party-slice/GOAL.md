# GOAL: Party Slice

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: Graduate the scratchpad party model into a domain-agnostic packages/party slice (domain, use-cases, server) on @beep/epistemics

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/party-slice/README.md`
- `goals/party-slice/SPEC.md`
- `goals/party-slice/PLAN.md`
- `goals/party-slice/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: new `packages/party/{domain,use-cases,server}` (via `beep create-package`), the law-practice contact-port adapter (server tier, bounded exception), the law-practice `Party` -> `LegalPartyReference` rename, `scratchpad/party`, and this packet.
- Out: party tables/persistence, client/ui/config packages, the review page, epistemic edge projection, and any corpus data (see `SPEC.md` Non-Goals).

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
test "$(wc -m < goals/party-slice/GOAL.md)" -le 4000
jq . goals/party-slice/ops/manifest.json
git diff --check -- goals/party-slice
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each in SPEC.md's Decision Log with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

Ship proposedCloseout and the reflection in the final PR (status stays active or
paused). After that merge, verify with `bun run beep goals completion refresh --slug party-slice`,
then adopt with `bun run beep goals set-status party-slice <status>` in a
packet-state PR. Done only once it merges and this passes, or an operator
blocker is reported with evidence:
`git show origin/main:goals/party-slice/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
