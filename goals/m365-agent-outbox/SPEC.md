# M365 Agent Outbox Spec

## Objective

Agent sessions on the operator's workstation can, for the firm tenant and the
attorney's own mailbox, without a browser:

1. create a mail draft with attachments read from local paths;
2. send a draft, as one explicit action that restates the exact recipients,
   subject and attachments it expects to send;
3. create and update calendar events;

and every send leaves a local audit record.

The route is a second stdio MCP server, `beep-m365-outbox`, in
`@beep/m365-mcp`, on the app-only lane of `@beep/m365`, with its own Entra
registration limited to the one mailbox.

## Why

On 2026-10-06 the claude.ai Microsoft 365 connector for the firm tenant held
read scopes only, and its draft tools failed on a missing `Mail.ReadWrite`.
A two-PDF email was sent through Outlook web by browser automation instead;
keystrokes landed outside the compose box and produced about 40 blank drafts
and one unintended message. Granting the connector its write scopes does not
close the gap: its documentation states that sending, forwarding and drafting
reject messages with attachments (`research/SOURCES.md`, section 3).

## Recommendation

Both routes, with different jobs:

| Route | Job | Limit |
| --- | --- | --- |
| Firm-owned `beep-m365-outbox` MCP server (this packet) | The only route that sends mail from an agent session. Drafts with attachments, calendar writes, audit log. | Workstation sessions only (stdio, local attachment paths). |
| claude.ai Microsoft 365 connector with its write permission set consented | Text-only drafts and calendar events from claude.ai chat, desktop and mobile, where no local server exists. | No attachments. Its mail send and forward tools are set to Blocked in the organization's connector settings (D-9). |

## Non-Goals

- No change to the read-only `beep-m365` MCP server's tool surface. Its only
  change is the additive protocol list of D-12.
- No delegated write lane in `@beep/m365`: the delegated configuration keeps
  rejecting write scopes (D-1).
- No shared or second mailbox, no send-on-behalf, no send-as another user.
- No calendar attendees and no meeting invitations: an event with attendees
  sends mail implicitly (D-7).
- No send without a prior draft, no scheduled or deferred send, no rules, no
  auto-reply, no mail move or permanent delete. Deleting is limited to drafts
  this route created in the same call chain (`delete_draft`).
- No inline images, no reference (cloud link) attachments, no item
  attachments.
- No remote (HTTP) host and no claude.ai custom connector for this server
  (D-8).
- No docket, tagging or filing logic; workstreams A and B own those.
- No change to the docket intake registration: it never gains `Mail.Send`.

## Source Hierarchy

1. `AGENTS.md` (including Autonomy), `CLAUDE.md`, and the required skills
   (schema-first-development, effect-first-development).
2. Governing architecture and package standards (`standards/ARCHITECTURE.md`).
3. This `SPEC.md`.
4. `PLAN.md`.
5. `GOAL.md`.
6. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Relation To Existing Packets

| Packet | State | What this packet takes | What it leaves there |
| --- | --- | --- | --- |
| `goals/m365-driver` | completed-retained | The REST executor, schemas and error taxonomy of `@beep/m365`; `Mail.Send` and `Mail.ReadWrite` from its reserved write scopes are opened here, on the app-only lane only. | The delegated read lane, unchanged. |
| `goals/m365-mcp` | completed-retained | `@beep/mcp-kit` stateless stdio posture, the sanitized toolkit pattern and the conformance test pattern. | The read-only server and toolkit, unchanged. |
| `goals/practice-docket-intake` (workstream A) | active, slice 1 committed on `feat/m365-write-lane`, not yet published | The app-only lane (`M365.makeAppOnlyLayer`, certificate credential, `/users/{id}` only), the write-safe executor (`"ambiguous write"` on an unknown `POST` outcome), `createEvent`, `updateEvent`, `listMessageAttachments`. Nothing is rebuilt. | Docket logic, categories, its own registration and runbook. |
| `goals/practice-m365-contacts` | active, P0 | Nothing. | Contacts verbs. |

## Target Surfaces

- `packages/drivers/m365` — mail-outbound verbs: create draft, add attachment
  (single request and upload session), get draft, send draft, delete draft.
- `packages/drivers/m365-mcp` — the outbox toolkit, its handlers, the
  attachment source and audit log services, the send guard, a second server
  layer and `bin-outbox.ts`.
- `.mcp.json` — the `beep-m365-outbox` entry.
- `docs/runbooks/m365-agent-outbox-registration.md` — the operator-attended
  registration, run in the same sitting as workstream A's.
- The live tenant: one Entra app registration, one Exchange management scope,
  three role assignments; optionally the connector's write consent.

## Design

Design order is schema, then the `Context.Service` contract, then the
implementation.

### Tools

| Tool | Graph effect | Sends mail |
| --- | --- | --- |
| `m365_outbox_create_draft` | `POST /users/{id}/messages`, then one attachment call or upload session per file | No |
| `m365_outbox_get_draft` | `GET` the draft and its attachment list | No |
| `m365_outbox_delete_draft` | `DELETE` the draft (Outlook moves it to Deleted Items) | No |
| `m365_outbox_send_draft` | re-read the draft, compare, `POST /users/{id}/messages/{id}/send` | **Yes — the only tool that does** |
| `m365_outbox_create_event` | workstream A's `createEvent` | No (attendees are not accepted) |
| `m365_outbox_update_event` | workstream A's `updateEvent` | No |

The mailbox is fixed by server configuration. No tool takes a mailbox
parameter, so a session cannot address another mailbox even if the Exchange
scope were widened by mistake.

### The send guard

`m365_outbox_send_draft` takes the draft id and an `expect` block: the `to`,
`cc` and `bcc` address lists, the subject, and the attachment list as
`{ name, size, sha256 }`, all three required for every attachment. Before
sending, the handler reads the draft back from Graph, downloads each stored
attachment and hashes its bytes, and refuses with a typed mismatch unless:

- the message is still a draft;
- each recipient list equals the expected list as a set, compared
  case-insensitively on the address;
- the subject is equal after trimming;
- the stored attachments equal the expected list, counting duplicates, on
  name and size (`attachments` otherwise) and then on the SHA-256 digest
  (`attachment-digest` otherwise). Name is the name Graph stores. Size is the
  byte length of the downloaded content, not the size Graph reports, which
  includes storage overhead. The digest is computed from the stored bytes at
  check time; no record of what was uploaded is consulted (D-18).

A stored attachment that cannot be verified refuses the send with
`attachments`: an item or reference attachment, an inline one, one without a
name, one for which Graph reports no size, or one that cannot be downloaded. So does a draft with more attachments
than the configured count limit, or whose attachments Graph reports as more
than twice the per-message byte limit; neither is downloaded.

A draft that was edited in Outlook after it was prepared therefore cannot be
sent on a stale description, whether the edit changed a recipient or swapped
an attachment for another of the same name and size. The caller reads it
again with `get_draft`, which returns the same computed attachment summaries,
and restates what it means to send. The comparison is a pure function over
two schemas and is property-tested.

### Attachments

- A path must be absolute, resolve (after following symlinks) to a regular,
  non-empty file, and lie under one of the configured attachment roots. When
  `M365_OUTBOX_ATTACHMENT_ROOTS` is unset there is exactly one root: the
  dedicated staging directory
  `${XDG_DATA_HOME:-$HOME/.local/share}/beep/m365-outbox/attachments`, which
  the server creates with mode 0700. The default is never the home directory
  or a working tree. A configured root that is missing or not a directory
  stops the server from starting.
- Limits are configuration with defaults: 25 MiB per file, 25 MiB per message,
  20 files. Exchange Online's own message limit still applies.
- Up to 3 MiB a file goes in one `POST .../attachments` request; larger files
  use an upload session in 3.2 MiB chunks. The chunk `PUT` requests go to the
  session URL without the bearer token.
- `create_draft` returns the name, size and SHA-256 of each local file it
  attached; these are the values `expect` restates. After attaching, it reads
  the stored attachments back once and compares them with the local files.
  If they differ it deletes the draft and fails, so what `create_draft`
  returns is exactly what `send_draft` will compute later, on the chunked
  upload path too.
- If an attachment step fails, the handler deletes the draft it created and
  fails the call, so a failed prepare leaves nothing in Drafts.

### Audit log

An append-only JSON Lines file per month under
`$XDG_STATE_HOME/beep/m365-outbox/audit/`. A send that passes the guard
writes two records with one audit id:

1. `send-intent`, flushed to disk **before** the Graph call: time, draft id,
   recipients, subject, attachment names, sizes and digests. If this record
   cannot be written, nothing is sent.
2. `send-outcome`: `sent`, `refused` (Graph rejected the request; the HTTP
   status is recorded) or `unknown` (the `POST` outcome is ambiguous).

A send the guard refuses never reaches Graph, so it writes one record: a
`send-outcome` of `refused` that names the differing fields (D-13). The tool
result carries `auditRecorded`, which is false when the outcome record could
not be appended after the send was already decided.

Draft creation, draft deletion and event writes each add one record. The log
never holds a message body or attachment content. It stays on the workstation
and is never committed; spans carry ids, counts and hashes only.

After an `unknown` outcome the caller calls `get_draft`: a draft that is gone
from Drafts was sent. The send is never replayed blindly.

### Authentication

The app-only lane with a certificate credential, read from 1Password through
`op run` at launch (`CLOUD_M365_OUTBOX_*`). The registration holds no Graph
API permission; access comes from three Exchange RBAC-for-Applications role
assignments scoped to the one mailbox: `Application Mail.ReadWrite`,
`Application Mail.Send`, `Application Calendars.ReadWrite`.

## Constraints

- **One send path.** Exactly one tool reaches the Graph send endpoint, and it
  runs the guard first. No tool has a "send now" flag.
- **Non-idempotent writes are never blind-replayed.** Inherited from
  workstream A's executor.
- **One mailbox**, fixed in configuration, addressed as `/users/{id}`.
- **Least privilege across registrations.** The outbox and the docket intake
  service are separate service principals with separate certificates.
- **Secrets** stay `op://` references. No key, token, tenant id or mailbox
  address is committed, logged or put in a span.
- **Hygiene.** Fixtures use `example.test` addresses and synthetic bytes. No
  real mail content, client name or tenant id enters the repository.
- **Effect v4**, `LiteralKit` for literal domains, `HashMap`/`HashSet`,
  `effect/unstable/http`, `Effect.fn` for effectful functions, typed errors.
- **Tool annotations.** `send_draft` and `delete_draft` are marked
  destructive and open-world so a harness asks before running them.

## Acceptance Criteria

- [ ] `@beep/m365` has the mail-outbound verbs, fixture-proven for method,
      URL, headers, body and decoded response; the upload session path is
      proven for chunk boundaries and for the absent bearer token on chunk
      requests; a send whose outcome is unknown fails as `"ambiguous write"`.
- [ ] The send guard is property-tested: it accepts exactly the drafts whose
      recipients, subject and attachments equal the expectation.
- [ ] The attachment source rejects relative paths, paths outside the roots,
      symlinks that leave the roots, non-regular files, and files over the
      limits.
- [ ] No send happens when the intent record cannot be written; every send
      attempt leaves an intent and an outcome record.
- [ ] The outbox server passes the `@beep/mcp-kit` conformance runner, and a
      test proves that only `m365_outbox_send_draft` can reach the send verb.
- [ ] The read-only `beep-m365` server's tool list is unchanged.
- [ ] `.mcp.json` registers `beep-m365-outbox`; a session without the
      credentials sees a failed server, not a broken session.
- [ ] The registration runbook has been handed to the operator together with
      workstream A's, and the live smoke (credential-gated; a write opt-in
      for creating and deleting a draft, a separate send opt-in for one
      message from the mailbox to itself with one synthetic attachment) has
      been run once, with a receipt in `history/`.
- [ ] `bun run beep quality package-verify` passes for `@beep/m365` and
      `@beep/m365-mcp`.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/m365-agent-outbox/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/m365-agent-outbox/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/m365-agent-outbox` | Passes |
| Driver handoff | `bun run beep quality package-verify @beep/m365` | Passes |
| Server handoff | `bun run beep quality package-verify @beep/m365-mcp` | Passes |
| Live smoke | receipt in `history/` (ids, counts and hashes only) | Recorded |

## Stop Conditions

- RBAC-for-Applications scoping cannot be established for the registration
  (report; never fall back to a tenant-wide `Mail.Send` application
  permission).
- A step would cost money beyond existing subscriptions.
- Required source files are missing or materially contradictory.
- The same blocker repeats after reasonable investigation.

## Decision Log

Taken under the autonomy charter. Each entry names how to reverse it.

| Id | Decision | Why | Reversal |
| --- | --- | --- | --- |
| D-1 | The outbox authenticates app-only (certificate, Exchange RBAC scoped to the attorney's mailbox), not delegated as the signed-in attorney. | Agent sessions run without anyone at a browser. The delegated lane needs an interactive sign-in and a refresh-token cache on disk, which is a long-lived secret outside 1Password; `@beep/m365` rejects write scopes on that lane by construction and its encrypted cache dependency is not installed. The app-only certificate lives in 1Password, the grant is one mailbox wide, and Entra's sign-in log attributes each call to the service principal, which is the honest record of who sent. Mail still leaves from the attorney's address and lands in Sent Items. | Remove the three role assignments and add a delegated write configuration to the driver; the tools and guard do not change. |
| D-2 | A separate Entra registration (`beep-agent-outbox`) and certificate, not a wider grant on workstream A's `beep-docket-intake`. | The docket service is unattended and reads untrusted inbound mail; its packet rules out sending. Keeping `Mail.Send` off that principal means a fault there cannot send mail. | Delete the registration; assign `Application Mail.Send` to the other principal. |
| D-3 | Sending is two calls: prepare a draft, then `send_draft` with an `expect` block checked against the draft as stored. | The task requires an explicit send that takes the exact recipients, subject and attachments. Checking against the stored draft also covers a draft edited in Outlook between the two calls, and makes large attachments possible, since Graph only accepts them on a draft. A one-call send would be a second send path with no stored state to check. | Add a convenience tool that composes the two; the guard stays. |
| D-4 | The outbox is a second server in `@beep/m365-mcp` (own toolkit, own bin, own registration), not new tools on `beep-m365` and not a new package. | The read-only server runs on the delegated lane and its tool list is a shipped contract. A new package would repeat the same kit wiring and pay the new-package governance gates for no boundary gain; the audit log and attachment policy are tool-surface policy and belong beside the tools, not in the driver. | Move the modules to their own package; nothing outside imports them. |
| D-5 | The audit log is local JSON Lines, intent before send. | It must exist even when Graph does not answer, so it cannot live in the mailbox. It holds recipients and subjects, so it cannot live in the repository. Exchange's own message trace and Sent Items remain the second record. | Point the log directory elsewhere; the record schema is versioned. |
| D-6 | Attachments come only from an allowlist of directories. When none is configured, the allowlist is one dedicated staging directory under the XDG data home, which the server creates; it is never the home directory or a working tree. | A session that has read an untrusted document could be talked into attaching a private file. An allowlist bounds that to what the operator chose to expose. The root is a per-machine path, so it cannot live in the committed 1Password env file, and `${HOME}` expansion in an MCP `env` block is a Claude Code feature that a user-level registration or another harness does not share; a fixed staging directory works everywhere and exposes nothing that was not put there on purpose. | Set `M365_OUTBOX_ATTACHMENT_ROOTS`. |
| D-7 | Calendar tools accept no attendees. | Graph mails an invitation to each attendee on create, which is a send outside the guard and the audit pairing. | Add an attendee-bearing tool that goes through the same `expect` and audit steps. |
| D-8 | Registration is the repo's `.mcp.json` over stdio. No claude.ai custom connector. | Attachments come from local paths, which a remote connector cannot read, and a remote host would put the send credential on a network listener. Sessions outside this repository get the server through a user-level registration the operator runs once (runbook step 8). | Host the same server layer over HTTP behind authentication. |
| D-9 | The claude.ai connector's write permission set is consented, with its mail send and forward tools set to Blocked in the organization's connector settings; drafts and calendar tools stay on Ask. | The connector gives text drafts and calendar writes in claude.ai chat and mobile, where the local server does not exist. Its sends have no attachment support and no local audit record, so the outbox stays the one send path. The Entra consent is one permission set and also carries `Files.ReadWrite.All`, `MailboxSettings.ReadWrite` and the Teams send scopes; those tools are blocked the same way until a packet wants them. The step is optional and last in the runbook. | Revoke the grant on the enterprise application, or unblock the tools. |
| D-10 | Reply and forward drafts are slice 3, after the send route is live. | The incident that started this packet was a new message with attachments. Replies need two more driver verbs and a draft update, and nothing blocks on them. | Reorder the slices. |
| D-11 | `delete_draft` exists and is the only delete. | A failed prepare must not leave residue in Drafts, and a session that prepared the wrong draft needs to withdraw it. Graph moves the draft to Deleted Items, so it is recoverable. | Remove the tool. |
| D-12 | Both hosts in `@beep/m365-mcp`, the outbox and the read-only `beep-m365` server, answer MCP `2026-07-28` first and also the handshake-era versions `2025-11-25`, `2025-06-18`, `2025-03-26` and `2024-11-05`, from one list shared inside the package. | Claude Code and Claude Desktop open every MCP server with `initialize` (they offered `2025-11-25` on 2026-10-06). A host that lists only `2026-07-28` refuses that handshake and the client reports the server as failed, which is how the Practice KG server failed in the field. The outbox exists to be used from Claude Code, and the read-only server is used the same way. For `beep-m365` the change is additive: its tools, instructions and handlers are unchanged (noted in `goals/m365-mcp/README.md`). | Drop the handshake-era versions once the clients speak `2026-07-28`. |
| D-13 | A send the guard refuses writes one `send-outcome` record and no `send-intent`. | The intent record exists to prove what was about to reach Graph. A guard refusal never reaches Graph, so an intent would record a send that was not attempted. | Write the intent before running the guard. |
| D-14 | `delete_draft` deletes only a message that is still a draft and that this server recorded creating (a `draft-created` audit record). | The Graph call behind it deletes any message by id. Without the two checks the tool could move arbitrary mail to Deleted Items, which the Non-Goals rule out. | Drop the audit-record check to allow deleting drafts made in Outlook. |
| D-15 | `create_draft` deletes the draft when its `draft-created` record cannot be written. | A failed prepare leaves nothing behind, and without the record `delete_draft` could never withdraw the draft (D-14). | Keep the draft and report the missing record. |
| D-16 | `create_event` stores `outbox:<auditId>` on the event as the driver's idempotency key. | An event create that fails as `"ambiguous write"` can then be looked up instead of duplicated, and Graph drops a retried create inside its own window. | Stop passing the key. |
| D-17 | `@beep/m365` exports `GraphPathSegment`, and the outbox tool schemas use it for draft and event ids. | The driver's request classes reject an id that could alter a URL path when they are constructed. Checking the same rule in the tool input turns a bad id from an agent into an ordinary invalid-parameters answer. | Keep the schema private and repeat the rule in the server. |
| D-18 | The guard verifies the stored attachments themselves: each one is downloaded and hashed at check time, and `expect` must state name, size and sha256 for every attachment. There is no "unverified" attachment. `create_draft` proves the upload by reading the stored bytes back. | The size Graph reports for an attachment includes storage overhead and is not the uploaded length, and the ids returned by an upload and by a listing are not a reliable join, so a record of what was uploaded cannot be matched to what is stored. Hashing the stored bytes needs no join and also covers an attachment added or swapped in Outlook. This replaces the earlier design that took digests from the audit log. | None needed. The cost is one download of the draft's attachments per `get_draft` and per `send_draft`, bounded by the count limit and twice the per-message byte limit. |
| D-19 | The live smoke writes nothing without an opt-in: credentials alone allow a token and one read; `M365_OUTBOX_LIVE_WRITE=1` allows creating and deleting a draft; `M365_OUTBOX_LIVE_SEND=1` (implies write) allows one send to self. | Running the integration tests with credentials in the environment must not change a real mailbox by accident. | Drop the write opt-in. |
| D-20 | Recorded, not decided here: on 2026-10-06 the operator chose to grant the connector's full write permission set tenant-wide, and the orchestrator session applied it to the existing all-principals grant on the `M365 MCP Server for Claude` enterprise application with the Azure CLI. The per-tool Blocked and Ask settings of D-9 are a separate step in each claude.ai organization and remain the operator's. | The consent half of D-9 is therefore done and covers every Claude account in the tenant, since one enterprise application serves them all. Until the per-tool settings are made, the connector's send tools work: the outbox is then the only route with attachments, a checked draft and an audit record, but not the only route that can send. A test send through the connector succeeded the same day; it still cannot attach a file. | Patch the grant back to the scope string the orchestrator saved before the change (runbook step 7), or revoke the consent on the enterprise application. |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
