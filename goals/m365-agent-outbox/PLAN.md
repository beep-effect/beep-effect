# M365 Agent Outbox Plan

## Status

Status: `active`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Compare the connector route with a firm-owned route and ground the design in workstream A's lane. | `SPEC.md` recommendation, relation table and Decision Log are written. |
| P1 Implement | pending | Build the slices below. | Acceptance criteria are met. |
| P2 Verify | pending | Package handoffs, property tests, live smoke after registration. | Verification is green or blockers are documented. |
| P3 Yeet: PR to mergeable | pending | Publish each slice through yeet and drive it to mergeable. | Each PR is merge-ready; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Slices

One PR per slice.

| Slice | Content | Surfaces | Depends on |
| --- | --- | --- | --- |
| 0 | This packet and the registration runbook. | `goals/m365-agent-outbox`, `docs/runbooks` | Nothing |
| 1 | `@beep/m365` mail-outbound verbs: create draft, add attachment (single request and upload session), get draft with `bccRecipients`, send draft, delete draft. Fixture tests. | `packages/drivers/m365`, `packages/drivers/m365-mcp` (test stubs) | Workstream A's slice 1 (`feat/m365-write-lane`) merged to `main` |
| 2 | The outbox server: tool schemas, send guard, attachment source, audit log, handlers, server layer, `bin-outbox.ts`, `.mcp.json` entry, conformance and guard tests, the credential-gated live smoke. | `packages/drivers/m365-mcp`, `.mcp.json` | Slice 1 |
| 3 | Reply, reply-all and forward drafts; draft update. | `packages/drivers/m365`, `packages/drivers/m365-mcp` | Slice 2 live |

Slice 1 is developed on a branch cut from workstream A's commit and merges
`main` once after A's PR lands. It is not published as a stacked PR: a stacked
PR gets no hosted CI until it is retargeted.

## Operator-Attended Steps

Routed through the orchestrator session as one sitting with workstream A's
registration, never asked in chat:

1. `docs/runbooks/m365-agent-outbox-registration.md`, steps 1 to 6: the
   `beep-agent-outbox` registration, its 1Password fields and its three
   mailbox-scoped Exchange role assignments.
2. Step 7 of the same runbook (optional): the claude.ai connector's write
   consent and the Blocked setting on its send tools.
3. Step 8 (optional, after slice 2 merges): the user-level MCP registration
   for sessions outside this repository.

## P4 Closeout Checklist

Before marking the packet closed (`status` to `completed-retained`):

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses and `initiative.status`.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative; record every implementing decision in its
  Decision Log.
- Do not edit workstream A's verbs or schemas; add optional fields only.
- Fixtures contain no real mail. Evidence in `history/` carries ids, counts
  and hashes only.

## Verification Commands

```sh
test "$(wc -m < goals/m365-agent-outbox/GOAL.md)" -le 4000
jq . goals/m365-agent-outbox/ops/manifest.json
rg -n "m365-agent-outbox|GOAL.md|agentLaunchers|packetAnchorDocument" goals/m365-agent-outbox
git diff --check -- goals/m365-agent-outbox
```
