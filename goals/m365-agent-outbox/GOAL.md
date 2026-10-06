# GOAL: ship the M365 agent outbox

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: agent sessions on the workstation draft mail with attachments from
local paths, send a draft through one explicit, guarded and audited tool, and
create or update calendar events in the attorney's mailbox, through a
firm-owned `beep-m365-outbox` MCP server, with no browser involved.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/m365-agent-outbox/README.md`
- `goals/m365-agent-outbox/SPEC.md`
- `goals/m365-agent-outbox/PLAN.md`
- `goals/m365-agent-outbox/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and the standards named
by `SPEC.md`. Higher-priority repo standards outrank packet prose when they
conflict.

Scope:

- In: `packages/drivers/m365` (mail-outbound verbs),
  `packages/drivers/m365-mcp` (outbox toolkit, send guard, attachment source,
  audit log, second server and bin), `.mcp.json`,
  `docs/runbooks/m365-agent-outbox-registration.md`, this packet.
- Out: the read-only `beep-m365` server, a delegated write lane, attendees and
  invitations, a send without a draft, a remote host, other mailboxes, docket
  or tagging logic, workstream A's registration.

Workflow:

1. Follow the slices in `PLAN.md`, one PR per slice, published through yeet.
   Slice 1 waits for workstream A's `@beep/m365` write lane on `main`.
2. Design order: schema, then the `Context.Service` contract, then the
   implementation.
3. Record every implementing decision, with its reversal, in the `SPEC.md`
   Decision Log.
4. Route operator-attended steps through the orchestrator session, as one
   sitting with workstream A's registration.
5. Keep mail content, addresses and tenant ids out of the repository and out
   of transcripts beyond ids, counts and hashes.
6. At P4 Close, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/m365-agent-outbox/GOAL.md)" -le 4000
jq . goals/m365-agent-outbox/ops/manifest.json
git diff --check -- goals/m365-agent-outbox
```

Escalate only a step that costs money. Decide everything else, record it, and
continue.

Done only when acceptance passes and verification is complete, or when a blocker
is reported with file/command evidence.
