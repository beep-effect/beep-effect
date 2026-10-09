# Implementation evidence and current handoff

2026-10-09. Yeet published initial draft [PR #1571](https://github.com/beep-effect/beep-effect/pull/1571) from implementation
source commit `1565951a24da16aed9e238fde55ca7250fe9c7d2`. Both packets now carry the prospective lifecycle and
phase declarations intended for merged `main`, effective only after exact final-
head hosted checks, answered/resolved reviews, the 20-minute window and merge.
External execution remains open; no merge SHA or hosted readiness is claimed.
All three touched packages passed full audit/docgen on the qualified implementation
snapshot (CLI audit 745.2 seconds; docgen 23.9 seconds). All 16 cheap gates and
clean-head install passed before initial publication. Base integration and the
final packet wave retain their own exact-head gate.

## Current deterministic and review evidence

The combined router suite passes **44/44 tests**, including 23 storage cases and
21 schema/tool/private-filesystem cases, in 12.01 seconds. The explicit CLI test
project type-checks. Canonical full package audit/docgen passed on the qualified implementation
snapshot; final integrated-head hosted evidence remains distinct.

The final independent store extraction review found no introduced regression on
store SHA-256 `b8ef0633b663c0c8d3a8c59b0cdc86c6c5f5ee6984d239ab1bdd4ce55060feac`.
It confirmed one pre-existing P2, retained as [R1](FOLLOW-UPS.md): inconsistent
trusted-host provider metadata is accepted and debits quota, then dispatch rejects
it before inference. The latest review has one deferred P2; earlier zero findings
are historical snapshots. The earlier settled-completion, delivered-unacknowledged
replacement and ACK/ambiguity findings are repaired with real SQLite regressions.

Native independent review passed 19 synthetic cases and reported zero actionable
findings after deadline, early completion and Cursor provenance repairs. This is
the snapshot before the Claude safe-mode correction; its final patch review and
corrected live gate have now passed separately. Synthetic fixtures establish transport/lifecycle
boundaries, independently of model-generated consumption.

## Actual autonomous managed exchange

The [Codex↔Grok receipt](../../agent-session-bridges/research/GROK-MANAGED-ROUNDTRIP.json)
records a successful 39.91-second owned run. Three logical messages (seed, request,
correlated reply) were acknowledged, all native dispatches settled, and persisted
grant use was exactly one per provider. The controller started and observed the
run without forwarding peer replies. Source and native executable digests stayed
unchanged; owned leaders and process groups were stopped.

The preceding zero-model Grok sandbox preflight proved the actual MCP child could
write only its owned state directory and could not write the sibling workspace.
This remedy resolved the read-only database-directory blocker. The passing live
receipt does not claim busy delivery, built-in tool denial or existing app
attachment. See [native qualification](../../agent-session-bridges/research/NATIVE-QUALIFICATION.md)
for the root-owned qualification matrix and per-route limits.

## Prospective closeout and remaining gate

The corrected [Codex↔Claude receipt](../../agent-session-bridges/research/CLAUDE-MANAGED-ROUNDTRIP.json)
records a successful 56.2-second total run including setup and cleanup. Its distinct
two-message queued-busy exercise accepted the second while the primer was ACKed
and the native attempt remained active; both subsequently ACKed and settled, with
zero send-grant use. The same sessions then completed the autonomous three-message
seed/request/reply flow. All five messages ACKed and settled, with one send grant
each, unchanged source/executables and owned group cleanup. The provider corrected
full audit/docgen and 19 native cases pass. Independent review of the final Claude
launch patch reports zero actionable introduced findings; the
[retained review](../../agent-session-bridges/research/CLAUDE-PATCH-REVIEW.md) identifies
the exact production, fixture and documentation hashes.

Cursor generation retains its existing access blocker. Native Desktop, production
browser bridge, cloud conversation control and federation remain named gated
follow-ups. No production orchestrator, fallback or merge authority changed.

The final [reflections](../history/reflections/README.md) accompany the same PR
as the implementation. Manifest lifecycle and phase values declare intended merged
state, not an achieved hosted gate. Local full proof binds the qualified
implementation snapshot; integration of advancing `main` and the final packet
commit must satisfy the existing exact-head hosted and review gates. No new
provider proof is inferred from inherited base changes. After actual merge the
orchestrator verifies the merge/head, records external completion and retires
through the existing sweep route.

Failed raw transcripts and private databases remain outside tracked packets;
receipts retain the exact source digest that ran. The following historical
attempts retain their original evidence limits.

---

# Historical implementation evidence and phase handoff

2026-10-09. Both implementation goals remain active. The orchestrator activated
agent-session-bridges after the documented router contract and combined 20
injected/schema/tool/filesystem tests passed. New correctness findings are active
remediation, not a reason to claim a completed goal or pause the dependency.

## Approved topology and contract

The [placement review](IMPLEMENTATION.md) records command-owned AgentMessage roles
in `@beep/repo-cli`, managed native sessions in `@beep/ai-provider-cli`, and reuse of
`@beep/acp` and `@beep/mcp-kit`. No new shared/product package is introduced.

The bounded version `agent-message/v1` envelope carries conversation/message/
idempotency identifiers, enrolled sender, direct destination, repository scope,
queued mode, body, expiry, optional reply correlation and destination capability/
policy fingerprints. Endpoint bindings separate participant/session/owner and
lifecycle generation. Optional structured execution references distinguish canonical
workspace, lane, run and turn; optional host references distinguish managed process,
native app, browser or cloud surface from provider and backend. Unobserved references
remain absent, and managed-process backend metadata does not prove app control. Policy evidence distinguishes runtime readback from launch
enforcement. Launch grants bind sender generation/owner/scope, allowed recipients,
expiry and a persisted transactional message budget. Role routing remains
unsupported in the first slice.

## Deterministic evidence

The orchestrator reported six store/router tests plus fourteen schema/tool/private
filesystem tests passing together. The fourteen-test focused rerun also passed
after the acknowledged-in-flight serialization repair and the lazy endpoint
service API cleanup. These use real SQLite and Toolkit parameter/result dispatch;
they establish deterministic boundaries, not model generation or a complete MCP
wire/CLI process roundtrip.

The focused tests prove bounded contracts, default version/mode and Option fields,
reply correlation, host-bound sender identity despite forged parameters, stable
send/reply retry without extra quota debit, allowed-target budget enforcement,
missing/expired/replaced enrollment rejection for reads and writes, unrelated
message-read refusal, and acknowledgment while a claim remains active without
parallel dispatch or receipt regression. Native filesystem tests prove private
state modes, shared path refusal, symlink refusal before database creation and
absolute state-directory enforcement.

A subsequent owner-reported combined suite passed 30 tests, including process
crash/reopen and concurrent writer fixtures. The boundary owner reran six schema
tests after adding optional execution/host identity, all passing. Final store
acceptance-audit repairs and the combined rerun remain in progress.

The command and persisted SQLite toolkit boundaries are documented in the
[agent messaging runbook](../../../docs/runbooks/agent-messaging.md).

## Remaining gates

- Reviewed queued-generation replacement, exact Codex resume identity equality,
  atomic generation-scoped reads, grant-protected acknowledgment and source-message
  generation authorization have owner repairs and focused regression evidence.
  Further acceptance-audit work covers grant conversation authority, delivered
  acknowledgment deadlines and store subscriptions; final combined proof is pending.
- Native consumption and autonomous two-provider send/reply/ack must produce
  separate sanitized receipts through the actual router. Handshake enrollment
  does not itself prove model consumption.
- Canonical package verification, final hosted PR gates and same-PR closeout
  reflection remain required. A quick package verification failure during
  concurrent implementation was attributed to source diagnostics and missing
  inherited declarations; it is not recorded as a passing package gate.
- Existing native Desktop, production browser bridge, cloud conversations and
  federation remain the named follow-up gates in the goal SPECs.

## First native pair attempt

The orchestrator reported that both owned native enrollments handshook, but the
first seed became ambiguous after roughly 28 ms with no MCP grant usage. The
owned Codex ephemeral/resume combination was not qualified for the new driver.
This is a failed integration attempt; it does not establish autonomous provider
messaging or context consumption. The provider owner is repairing persistent
owned-profile lifecycle using the separately retained explicit-policy mitigation
evidence before another bounded attempt.

## Second native pair attempt

The orchestrator reported partial autonomous progress: the owned Codex session
acknowledged the seed and invoked `agent_message_send` to the enrolled Grok peer,
consuming one persisted Codex grant message. Grok claimed that message, then the
native turn ended ambiguous with no Grok grant usage or correlated reply. This
proves the Codex tool-to-router send and acknowledgment leg within the experiment;
it does not prove an autonomous two-provider reply loop or Grok context
consumption. The provider owner is diagnosing the exact owned Grok failure.

The [initial storage reversal procedure](STORAGE-REVERSAL.md) retains the original
private database/sidecars and ambiguity holds. Failed experiments remain evidence;
a fresh proof state must not overwrite their receipts or reset grant budgets.

## Third native pair attempt and storage isolation diagnostic

The orchestrator stopped the owned Grok route after a built-in permission mismatch:
Grok invoked a bounded terminal sleep despite the intended built-in tool exclusion.
No file or secret access was observed in that invocation. Both owned runtime leaders
were stopped by the runner; the final attempt was unsuccessful. Transport completed,
but MCP tools returned a storage error, so no autonomous reply proof is claimed.
Built-in denial remains unqualified until the provider owner repairs and tests the
native permission whitelist.

A separate zero-model diagnostic used SQLite's backup boundary to copy the stopped
proof database, then tested BEGIN/ROLLBACK and scoped MCP acknowledgment inside the
same outer filesystem sandbox successfully. The original proof database remained
unchanged. This narrows the failure to the live/native environment; it is not a
successful rerun of the autonomous exchange.

Launch grants now optionally pin a conversation; absence explicitly retains
repository-wide authority within allowed recipients. Atomic scope enforcement is
owned by the store. The [public opt-in runner](../../agent-session-bridges/research/probes/managed-roundtrip.py)
references existing subscription authentication, prepares fresh private cache state,
and requires seed/request/reply acknowledgment, settled dispatches and exactly one
persisted send per provider. It performs no controller forwarding. Its presence is
reproduction tooling, not a passing live receipt.

The storage owner subsequently reported 37 combined passing tests (20 store tests),
including the strengthened injected lifecycle fixture and conversation authority.
The boundary owner also reran 17 focused schema/tool/filesystem tests after the
schema/default and Effect test-boundary repairs; all passed. These counts refer
to their stated snapshots and do not replace final hosted or native proof.


## Final boundary handoff snapshot

The combined four-file fixture suite passed 38 tests (20 store and 18 boundary),
including concurrent first-open of a private database and encoded endpoint lists
with absent/present structured identity references. The explicit CLI test project
type check, with `--rootDir . --noEmit`, exited zero. A subsequent quick package
rerun stopped on formatting in the orchestrator-owned atomic database-create
repair; that red receipt is retained separately. The earlier quick lint/check
pass is not promoted into a final full-package green claim. Full audit/docgen,
independent review, native qualification and hosted exact-head gates remain open.

After the formatting repair, a new quick pass had green lint but a red check: the
serving runtime referenced the in-flight `sandboxWritablePaths` launch field before
the provider declaration surface supplied it. Both red receipts remain private.
Rebuild the completed provider surface and rerun the frozen package gate; no final
package pass is inferred from the earlier green snapshot.

## Independent router review closure

The latest frozen router suite passes 41 tests (23 store, 18 boundary) and the CLI
test project type-checks. Independent store review reproduced and verified fixes
for stale settled completion, delivered-but-unacknowledged replacement, and
observable ambiguity after acknowledgment. Independent store and boundary
reviewers both finished with zero actionable findings. Their earlier counts above
describe earlier snapshots. The provider review is still addressing handshake
timeouts and early completion correlation before final live and package proof.
