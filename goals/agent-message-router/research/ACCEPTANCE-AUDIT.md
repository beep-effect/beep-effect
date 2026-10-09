# Router acceptance audit — 2026-10-09

Scope: current local AgentMessage store/service and operator CLI/MCP surfaces against goals/agent-message-router/SPEC.md. Provider drivers and autonomous native qualification remain the sibling bridge goal. No model calls were run by this review.

The latest independent store extraction review found no introduced regression but
confirmed one pre-existing P2, [R1](FOLLOW-UPS.md), for contradictory trusted-host
provider enrollment. Dispatch rejects it before inference, after acceptance and
quota use. This tracked finding remains deferred under the review-round policy.
The current combined suite passes 44 tests; full audit/docgen, final hosted gates,
Yeet and final reflection/lifecycle closeout remain required. Historical counts
and earlier owner/independent zero statements below retain their snapshot limits.

| Criterion | Current implementation/evidence | Remaining action |
| --- | --- | --- |
| Identities/envelopes | Schema agent supplies participant/session/generation/scope, optional execution and host references, distinct direct/role target, version/conversation/reply IDs, bounded queued payload | Owning runtime must populate only observed/declared references; no browser attachment claim |
| Atomic acceptance/attempt | SQLite transactions persist acceptance, sender/recipient generation, grant quota and receipts; equal duplicate stable and conflict typed | None identified locally |
| Operator/service surfaces | CLI register/list/send/reply/inbox/acknowledge/inspect/watch; scoped MCP send/reply/read/ACK/discovery; durable subscription port and injected dispatch port | Roles typed unsupported; no role authority admitted |
| Capability/policy | Supported advertised or verified send evidence with usable policy; persisted fingerprints and dispatcher host-provider fence; replacement fence | R1 tracks enrollment rejection; native policy qualification remains sibling proof |
| Restart and dropped ACK | Queued accepted messages reopen; expired consumed unacknowledged message transitions to original owned attempt ambiguity; no automatic replay | Original-session reconciliation is required; no unsafe clear API |
| Order/capacity/expiry | Oldest recipient created/row order; queue cap and TTL checks; serial active dispatch; duplicate ACK stable | No universal real-time claim |
| Ownership/authority | Atomic process-excluding claims; active/ambiguous replacement hold; old unsent generation failed explicitly; grants current owner/generation/scope/task + persistent quota | No enrollment/grant issuance exposed in model toolkit; CLI trusted local operator only |
| Injected vertical slice | One two-endpoint fixture combines restart, duplicate request acceptance, correlated reply and dropped reply ACK hold | Owned Codex↔Grok and Codex↔Claude autonomous proofs plus Claude queued-busy passed |
| Crash/privacy/reversal | Actual SIGKILL after committed accept and claim; two child process claim race; private path fixtures; futureversion fence; stopped-writer backup+restore retains pending mail/receipt/quota | No power-loss/online-backup/production restore claim |
| Package/review gates | Current combined four-file suite 44/44 (store23, boundary21); explicit test typing and CLI --quick passed | Parent must run full audit/docgen, final test typing, independent review and hosted finalhead checks |
| Merge/closeout | Parent owns lane/Yeet | Existing gate, reflection and lifecycle closeout required |

Historical owner receipt (37-test snapshot). Exact focused command: `bunx --bun vitest run test/agent-message-store.test.ts test/agent-message-models.test.ts test/AgentMessage.tools.test.ts test/AgentMessage.layer.test.ts`, from CLI workspace. Result: four files passed, 37 tests passed, 8.89 seconds. These are synthetic provider-free behavior fixtures; they do not establish native app continuity or autonomous provider delivery.

Storage diagnostics now retain only RouterError or static typed SQL reason tags/SchemaError, with regression ensuring stored payload and SQL table text do not appear. The private logs of any provider proof must remain outside the packet.

## Promotion scope

Promoted from the storage owner’s acceptance audit on 2026-10-09. Its zero-identified-gap
statement describes that owner’s local self-review, not the final independent review.
The boundary owner confirms the optional execution/host and conversation schemas
and scoped MCP/private-filesystem regression surface. The canonical runbook is
[agent messaging](../../../docs/runbooks/agent-messaging.md); the bounded backup
procedure and fixture limits are in [storage reversal](STORAGE-REVERSAL.md).


## Boundary post-review receipt

A later combined fixture rerun passed 38/38 (20 store, 18 boundary), including
concurrent private database first-open and endpoint list wire encoding of both
absent and populated execution/host references. Explicit CLI test type-check
passed with the repository root-directory override. This closes those local
post-review checks; it does not close final full audit/docgen, native integration,
independent review or hosted merge gates.

## Historical independent store and boundary review

The earlier combined suite passed 41 tests: 23 store and 18 schema/tool/filesystem
tests. The CLI test project also type-checks successfully. Independent store
review reproduced three receipt-lifecycle defects: an old completion could reopen
a settled hold, replacement could orphan delivered mail awaiting acknowledgment,
and uncertainty after acknowledgment was not observable in receipt history.
All three were repaired and received focused regressions. The reviewer's second
round reproduced the corrected outcomes against the frozen store and reported
zero actionable findings.

The independent boundary review also ended with zero actionable findings after
atomic private database creation and endpoint wire encoding were repaired. These
reviews cover the router store/service and CLI/MCP/filesystem boundaries; native
drivers retain their own independent review and live qualification. Final full
package audit/docgen, hosted checks, reflection and merge remain open.

The subsequent complexity-refactor review passed all 44 current router tests and
found no refactor regression. It independently reproduced one pre-existing P2:
conflicting trusted-host provider metadata is accepted at enrollment and message
acceptance, then fenced at dispatch after quota use. Per the review-round cap,
this is retained as [R1](FOLLOW-UPS.md), with an exact correction and regression
criterion. The latest store review has one deferred P2; the earlier zero-findings
statements above describe their recorded snapshots.
