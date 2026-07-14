# GOAL: Ship subscription auth to LLM providers via vendor-CLI delegation

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: users of a local-first beep server connect Claude Pro/Max and ChatGPT
subscriptions by logging in with the vendor CLIs; beep manages ProviderInstance
records (binary/HOME/env), isolates credentials per instance via HOME layouts,
probes rich auth status (state, email, plan label), and persists metadata +
snapshots — never tokens.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/llm-provider-subscription-auth/README.md`
- `goals/llm-provider-subscription-auth/SPEC.md`
- `goals/llm-provider-subscription-auth/PLAN.md`
- `goals/llm-provider-subscription-auth/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and the standards named
by `SPEC.md` (`standards/ARCHITECTURE.md`, architecture docs 03/06/09).
Higher-priority repo standards outrank packet prose when they conflict.

Scope:

- In: `packages/drivers/ai-provider-cli` (rich probe + HOME/env/shadow-home
  mechanics); `packages/agents/domain` (ProviderInstance entity);
  `packages/agents/use-cases` (commands/queries/ports/errors);
  NET-NEW `packages/agents/tables`; `packages/agents/server` (port impls +
  layers); `packages/agents/client` (atoms/service); this packet's files.
- Out: in-app OAuth/PKCE/device-code flows; any provider-token persistence or
  per-user vault; hosted multi-user login relay; key-precedence/dispatch/
  fallback layer (stays in `explorations/multi-provider-llm-dispatch-fallback`);
  provider kinds beyond `claude` and `codex`.

Workflow:

1. Inspect referenced files and current repo state.
2. Make the smallest change that satisfies `SPEC.md`, in `PLAN.md` P1 order
   (driver -> domain -> use-cases -> tables -> server -> client).
3. Preserve unrelated user/worktree changes.
4. Keep decisions tied to evidence from files, tests, docs, or command output.
5. Update packet evidence/status if the implementation changes readiness.
6. At P4 Close, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill (see
   `PLAN.md` P3 Closeout Checklist); `bun run beep lint reflection-artifacts`
   must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are
      reproduced and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/llm-provider-subscription-auth/GOAL.md)" -le 4000
jq . goals/llm-provider-subscription-auth/ops/manifest.json
git diff --check -- goals/llm-provider-subscription-auth
```

Hard invariant: no provider access token, refresh token, OAuth code, or raw
CLI output that could embed one may be persisted in beep-owned storage or
logs. If a design choice seems to require it, stop and report.

Stop and report before changing public API, schema, data migration, auth,
infra, security behavior, dependencies, lockfiles, generated files, or
destructive state unless `SPEC.md` explicitly requires it.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
