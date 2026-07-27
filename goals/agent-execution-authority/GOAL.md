# GOAL: govern the MCP agent surface with default-deny authority and an append-only record

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: every MCP tool dispatch and outbound request in the desktop sidecar's
MCP branch is decided against a grant set frozen at session start, recorded
before it runs, and refused by default — with a hash chain that fails
verification if any record is altered.

This is a compact `/goal` launcher. The detailed contract is
`goals/agent-execution-authority/{README,SPEC,PLAN}.md` plus
`ops/manifest.json`. Read those first, then `AGENTS.md`, `CLAUDE.md`, and the
standards `SPEC.md` names. Repo standards outrank packet prose on conflict.

Scope:

- In: `packages/epistemic/{domain,config,tables,use-cases,server}`;
  `packages/foundation/capability/{mcp-kit,api-transport}`;
  `packages/ontology/{use-cases,server}`; `apps/professional-desktop/server` and
  its integration tests; `standards/architecture/DECISIONS.md` and
  `10-cross-slice-coordination.md`.
- Out: host isolation, the chat/Anthropic egress path, credential custody,
  payload storage, budget enforcement, revocation, anchoring, child-run
  attenuation. Do not touch `apps/oip-web`, Storybook, `packages/agents/client`,
  or any driver package.

Non-negotiable boundaries (rationale in `SPEC.md`):

- `foundation/*` never imports a slice or the shared kernel — the grant type must
  not enter `mcp-kit`; the evaluator implements the existing `TierGate` port from
  `epistemic/server`.
- `epistemic/domain` imports only `foundation/primitive` and `modeling`.
- `ontology` and `epistemic` never import each other; the app entrypoint binds.
- The ledger stores no payloads. Denial reasons are a bounded literal domain and
  never reach the agent.
- Never infer a denial from a caller's error; the policy function records its own
  typed refusal.

Workflow:

1. Inspect referenced files and current repo state.
2. Work `PLAN.md`'s PRs 1-7 in order; each is independently landable.
3. Make the smallest change that satisfies `SPEC.md`.
4. Preserve unrelated user/worktree changes; keep decisions tied to evidence.
5. Update packet evidence/status if the implementation changes readiness.
6. At P4 Close, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via `/reflect`;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
bun run beep yeet verify
test "$(wc -m < goals/agent-execution-authority/GOAL.md)" -le 4000
jq . goals/agent-execution-authority/ops/manifest.json
git diff --check -- goals/agent-execution-authority
```

Never verify with bare `vitest` — migration registration is four places and only
the full lane checks it.

Stop and report before changing public API, auth, infra, security behavior,
dependencies, lockfiles, or generated files unless `SPEC.md` requires it. Two
packet-specific stops, both in PR 6: if a request from inside a real tool
handler cannot be shown reaching the policy fetch, and before landing the
outbound-POST tool, which `SPEC.md` flags for deliberate re-read.

Done only when acceptance passes and verification is complete, or when a blocker
is reported with file/command evidence.
