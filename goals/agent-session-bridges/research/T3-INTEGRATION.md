# Attached T3 integration design

Admission date: 2026-10-09. User-authorized implementation extension; acceptance
now has the bounded functional proof below; final verification and closeout remain open. [T3 qualification](../../../explorations/cross-provider-agent-communication/research/T3CODE-QUALIFICATION.md)
proves the installed visible host's native messaging, not this adapter.

## Boundary and topology

A thin `@beep/t3-code` driver owns the external T3 legacy MCP HTTP/JSON/SSE
handshake, correlated tool calls, typed wire schemas/errors and bounded connection
lifetime. It is application-unaware: no repo CLI grants, store or role imports.
Existing protocol-neutral MCP transport/decoding primitives are reuse candidates;
the newer MCP kit discovery protocol is not silently interchangeable with the
qualified T3 initialize/session protocol. Canonical create-package/architecture
writers establish package and flat role topology before implementation.

Repo CLI `attach-t3` supplies a distinct AttachedT3 profile and EndpointDispatch
implementation to the existing store/dispatch loop. It owns its connection and
bridge worker, not the app or native child. Enrollment preserves exact T3 thread,
workspace/lane/task, host/provider identity, generation and owner, and observed
host configuration. Endpoint sessionId may identify the T3 host thread; it must
never be relabeled as a provider-native session. Independently observed native
identity/policy baseline carries its observation time and provenance separately.
MCP thread read exposes host metadata, not native identity or effective policy. The app's settings are read, never changed by this adapter.

The durable Beep claim commits before external submission; no SQL transaction
spans network work. The model returns through a grant-bound `agent-message peer`
CLI invoking existing AgentMessageToolkit handlers. A host-issued wrapper fixes
private state/grant references; model arguments carry only schema-decoded messaging
inputs. Persisted grants enforce current sender, recipient, repository/conversation
scope, expiry, generation, budget and equal-request idempotency. Operator launch,
register, grant and arbitrary administration are excluded from this return API.
Handler failure must fail the command even if its Effect transport succeeds.

Native T3 MCP tools remain separately authorized: environment OAuth is broader
than Beep grants. Only actual peer/router traffic earns Beep enforcement claims.
Per-thread MCP injection is unproved and not required for the first slice. Scoped
CLI protocol authority does not provide OS confinement of a Full-access model.
Avoid exposing unrelated sessions; keep authorized OAuth references private and
never extract bootstrap credentials or print native histories.

## Delivery and policy limits

First slice uses explicit queued delivery. Stable clientRequestId and a private
bounded correlation checkpoint retain the Beep claim/request key and returned
T3 message/run identity in the same OAuth client namespace. Accepted/queued is
not consumed. Require exact peer ACK and a supported successful correlated native
run terminal result before reporting settled delivery. ACK while claimed retains
the existing router serialization/ambiguity behavior.

Before send, verify exclusive owned target and unchanged host thread/provider/
instance/model and available host-reported effort/runtime configuration. T3 send has no expected-policy/native/model compare-and-send
precondition: configuration read→send races remain possible. Host configuration post-readback
detects reported drift; independent owned DB/native-record observation qualifies
the native baseline and live policy proof separately. Host assertions are not
native policy verification. detected drift, unknown submission, unmatched run, timeout or
revocation after submission holds ambiguity and stops the route without blind
resubmission. This does not advertise atomic pre-inference enforcement. Reconnect
reconciles the original request first; lost launch has no retry key. Cancellation
closes only owned resources and does not establish physical native unload.

## Real first slice and register authority

Register the exact owned T3 coordinator/worker as existing desktop-session units,
with ownership, private address, last contact and orphan plan. This metadata does
not claim the global orchestrator role: the existing holder remains authoritative.
No fleet broadcast, election, review/red routing, fallback or merge permission is
conferred by a peer message.

T3 Codex receives an on-disk brief and delegates a real one-file repository audit
to T3 Claude through Beep's queue. Claude writes/returns its scoped result; Codex
consumes the correlated reply, ACKs it and writes a private report. The controller
starts and observes without forwarding replies. Prove reverse initiation with a
bounded second brief where needed. Preserve original visible/native conversations
and actual policy across the exercise. Record accepted/claimed/ACK/terminal/settled
states and persisted grant use, not merely matching text.

## Verification and reversal

Injected driver/host tests cover legacy frame decoding, auth denial/revocation,
bounded waits, stale/mismatched identity, policy drift and external race,
queued-versus-consumed outcomes, correlation, ACK-before-terminal, restart and
unknown outcome without replay. Real store/tool tests cover grants, quota and
reply authority; actual T3 proof covers the delegated task. Package verification,
independent review and exact final-head Yeet gates remain required.

Public receipts retain source/artifact digests and provider labels, never ids,
absolute home paths, OAuth or raw transcripts. Reversal disables attachment,
closes owned connections and revokes its owned OAuth client while retaining
accepted/ambiguous mail and the user-interacted T3 conversations/profile. Separate
Claude/ChatGPT Desktop attachment, physical unload, app crash recovery, production
browser/federation and global role handoff remain gated.

## Admission review

Two separate existing store/provider owners read this design and attached-T3 SPEC
acceptance on 2026-10-09 and reported zero blocking admission findings. This is
a contract review, not implementation qualification. The provider review notes
that a narrow project read resolves workspaceRoot when thread worktreePath is
absent; no workspace/native identity may be fabricated. The admission review did not itself qualify implementation or task behavior.

## Initial executed integration qualification (historical)

The [initial structured receipt](T3-INTEGRATION-INITIAL-QUALIFICATION.json) records actual forward
and reverse AGENTS.md audits in the same two owned visible T3 conversations.
Codex delegated to Claude, then Claude delegated to Codex. Each coordinator
received a correlated peer result, ACKed it and wrote a private report without
controller forwarding. All four logical messages ended acknowledged, attempt
generation one and dispatch_active zero; each persisted grant consumed two sends.
Independent implementation review found zero remaining actionable findings.
Reviewer fixtures passed 10 driver cases and eight attached cases; owner combined
Bun and Node coverage runs each passed 56 cases. Full CLI and repository docgen
proofs and exact final-head hosted/review/merge/closeout remain pending.

Read-only exact-owned DB/native-file observations found the same native identities
as prime, four completed runs per provider and no nonterminal runs. These counts
include prime plus three live runs. All four Codex turn contexts retained
gpt-6.1-sol, medium, never and danger-full-access. All four Claude native permission
records retained bypassPermissions; Opus 5.5/medium is separately host-reported
configuration. Neither host metadata nor Full access establishes OS confinement.

Prime is a negative scope receipt: Codex ran eight commands in three batched exec
calls, including inbox inspection and ACK, beyond a no-tool brief. Claude used no
prime tools but encountered inherited hooks. Later observed commands were confined
to the owned brief, scoped peer route, AGENTS.md and private report. Concurrent
checkpoints cannot establish tracked-edit attribution. Claude's final hook demand
is a self-report; observed live command metadata shows no Yeet ACK.

Cleanup stopped both owned bridge workers and revoked the external OAuth and
enrollment credentials; exact re-probes returned HTTP401. Earlier scoped archive
detach revoked the owned internal credential through the installed source path,
but that old internal bearer was not HTTP-probed. The app and conversations remain;
register retirement is metadata only. No active or always-on bridge is claimed.
The structured receipt indexes private evidence by basename and digest, without
credentials, session IDs, home paths or native transcript contents.

After all four messages settled, supported endpoint replacement advanced each
generation with a fresh owner and supported=false, invalidating both persisted
peer grants. Both old wrappers refused discover with “Launch grant expired or its
enrollment was replaced.” This used canonical enrollment, with no SQL edits or
fabricated revokeGrant API. The cleanup digest indexes this final receipt.

## Hardened qualification and current gate

Final review confirmed that sender-only grant acceptance could expose a foreign
conversation or unallowed peer to this receiver before its ACK later refused the
message. The attached guard now rejects wrong direct target, repository, scoped
conversation or sender outside the receiver's declared symmetric peer allowlist
before any T3 read/send. Independent narrow review found zero remaining findings;
the reviewer reran nine cases, including real sender-grant acceptance and claim
for both foreign-task scenarios, with no native submission.

The [current receipt](T3-INTEGRATION-QUALIFICATION.json) records a fresh bounded
forward/reverse audit on this guarded source. Again all four messages ACKed and
settled at attempt one, and each grant used twice. Independent exact-owned native
observation found seven completed runs per provider, no nonterminal runs and the
same native identities; counts include prime, original three and hardened three.
All seven Codex contexts retained the same model/effort/never/danger-full-access;
all seven Claude records retained bypassPermissions, with model/effort separately
host-reported. Both new external credentials were revoked/re-probed401, both
bridge workers stopped, peer grants invalidated and register units retired.

The [initial receipt](T3-INTEGRATION-INITIAL-QUALIFICATION.json) preserves earlier
source and negative prime/internal-credential evidence. The hardened receipt binds
attached.service.ts SHA b3db46f0edda48574e8c8cdabba30546e38fbad42afc85c7737341d45490adf8.
The later Fallow cohesion refactor earned separate tests and independent review;
this live result is not relabeled as proof of its later hash. Full repository
docgen retry passed after infrastructure preparation. The final full CLI package
verification passed (audit 812.1 seconds, docgen 24.8 seconds). Final cheap gates
passed 15 lanes and failed only inherited EV015; hosted/merge/closeout remain open.
The inherited main EV015 remains owned by its main lane.

[Cache posture review](T3-CACHE-REVIEW.md) records canonical task/fingerprint
bookkeeping separately from runtime qualification and cache reuse correctness.
The orchestrate skill/runbook distinguish queued acceptance, exact scoped ACK
and native settlement, prohibit automatic mutation retry, and preserve same-key
namespace/reconciliation limits. Their T3 claims do not imply separate-app
attachment, global authority or OS confinement.

## Cohesion refactor interruption reconciliation

The separate [refactor receipt](T3-REFACTOR-RECONCILIATION.json) binds the
exercised attached service hash a62c24334ef460e3e09f4757e84bf99f36964b012a3750db05c2137d440d52db.
An independent recomputation confirmed the final type-import reorder emits
identical JavaScript; this does not extend the proof to later driver changes.
The h3 forward task settled and its coordinator report exists. Reverse initiation,
worker result, both exact ACKs and the second report also persisted, but the
reverse coordinator native run was cancelled after host restoration. Four ACKs
and two reports therefore do not establish four successful native settlements.
Canonical recovery holds both reverse dispatches ambiguous without replay.

The original app/profile and conversations remain. Both external credentials
were revoked and re-probed HTTP401; bridge workers were absent after interruption
and were not restarted. Immutable peer grants and messages remain behind the
ambiguity fences. Final package/hosted/review/closeout gates remain separate.
