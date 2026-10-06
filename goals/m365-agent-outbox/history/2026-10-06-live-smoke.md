# Live smoke receipt — 2026-10-06

Run from the `feat/m365-outbox-verbs` lane at `e2ffc404df` against the firm
tenant, with the `CLOUD_M365_OUTBOX_*` fields resolved by
`op run --no-masking --env-file=packages/drivers/m365-mcp/outbox.env`.
Command: `bunx --bun vitest run test/integration/Outbox.live.test.ts` in
`packages/drivers/m365-mcp`. Ids, addresses and content are not recorded here.

| Stage | Opt-in | Result |
| --- | --- | --- |
| Read: certificate token, one page of drafts | none | 1 passed |
| Write: `create_draft` with one synthetic attachment, `get_draft`, `delete_draft` | `M365_OUTBOX_LIVE_WRITE=1` | 2 passed |
| Send: one message from the mailbox to itself through `send_draft` | `M365_OUTBOX_LIVE_SEND=1`, approved by the operator | 3 passed |

What the run proves beyond the fixture tests:

- The app-only certificate lane authenticates and the Exchange role
  assignments reach the configured mailbox.
- Graph returns `@odata.type` on the attachment list call and attachment ids
  that are valid path segments, so the two fail-closed assumptions in the SPEC
  hold; the stored-attachment digest equals the uploaded file's digest.
- The send stage returned outcome `sent` with `auditRecorded: true`.

Local audit log after the three runs, counted by record kind: 3
`draft-created`, 2 `draft-deleted`, 1 `send-intent`, 1 `send-outcome`
(`sent`). The two deleted drafts are in the mailbox's Deleted Items; the sent
message is in its Sent Items and Inbox.
