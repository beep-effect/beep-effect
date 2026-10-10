# T3-owned Claude and Codex qualification

Date: 2026-10-09. This is an executed local qualification of the installed T3
Code desktop host. The operator selected T3-owned visible conversations as the
first target. No provider update, model fallback or new billing endpoint was used.

## Result

Both providers autonomously sent, consumed and answered messages through T3's
native MCP tools. Either provider can initiate this bounded messaging workflow.
The UI showed the messages in the two owned conversations. This qualifies T3 as
a shared visible host for Claude and Codex coordination. Production repository
orchestration, its role transfer and merge gates remain separate acceptance work.

This proof does not attach conversations already running in the separate Claude
or ChatGPT/Codex desktop applications. It also does not implement a Beep-to-T3
adapter or extend Beep's recipient-scoped authorization to T3.

## Installed artifact and scope

- T3 MCP server version: `0.0.45`.
- Installed source stamp: `365aa87982a4d81cc8e0c085e8d1a40ca7daecdc`.
- Installed AppImage SHA-256:
  `b75d10597ac55cd8d30941fcfe6d26581cb76a1aeb4403a13ca3dbb3539ee776`.
- Existing AppImage reused with a separate `T3CODE_HOME` and XDG configuration.
  Auto-update was disabled for this process. The public server stayed on loopback.
- Only the two owned scratch threads were targeted. Provider history homes
  remained shared with the existing installations. Separate T3 state therefore
  does not imply isolated native histories or credentials.

The profile contained 382 other imported/discovered thread metadata records.
The user interacted with onboarding; the cause of that inventory was not proved.
The qualification controllers did not open or inspect unrelated conversation
transcripts; provider discovery/import activity was not independently audited.
The profile is retained
because the user interacted with it. Raw receipts and authentication stay under
`~/.cache/beep/t3-qualification/`, outside the public repository. Public results
use provider labels instead of machine, session or conversation identifiers.

## Executed cases

| Case | Observation | Qualified claim |
| --- | --- | --- |
| Read-only client | Full-access thread launch returned `capability_denied` | Read-only mutation denial |
| Full-access enrollment | Public PKCE S256 OAuth with pairing-code approval; state/issuer checked; effective capability reported full-access | Supported external MCP enrollment with an explicit runtime ceiling |
| A1 idle exchange | One controller seed; Codex sent PING, Claude sent REPLY, Codex sent ACK; both emitted the bounded settled nonce | Autonomous bidirectional idle messaging; controller did not relay replies |
| B2 first busy attempt | Claude sent a literal PING while Codex ran a command; the prompt failed to give the receiver its reply rule | Steering observed; no complete roundtrip claimed for this attempt |
| B3 reverse/busy exchange | Claude initiated while Codex's `sleep 25` command was running; PING receipt was `steered`; REPLY returned; ACK was `queued` and drained into the next Codex run | Reverse initiation, active steering and consumed queued follow-up |
| Duplicate send | Original A1 request and clientRequestId replayed through a fresh MCP connection with the same OAuth client; same message/run returned; run count stayed five | Idempotent duplicate send in the same client namespace |
| Reconnect | Both owned conversations remained visible; their rendered histories were inspected through a browser view of the desktop-owned backend | UI persistence across browser reconnect; not a native app restart claim |
| C1 detach/resume | Both supported detach effects completed and their bindings disappeared; bounded continuation reattached the same native identities and completed | T3 detach/reattach with identity and permission continuity |
| D1 Codex cancellation | Running command observed before exact-run interrupt; terminal status `interrupted` | Running-command turn cancellation |
| D1 Claude attempt | Harness refused standalone foreground `sleep 25`; no running command existed | Command cancellation unproved; the refusal was not bypassed |
| D2 Claude cancellation | No-tool text generation observed active; exact-run interrupt reached `interrupted` | Active generation cancellation |

T3 detach completion is not independent proof of physical cold native unload.
Claude's source releases the single-thread runtime scope. Codex's shared-runtime
unsubscribe path can log warnings while the detach effect still succeeds. No
pre-detach owned PID or native close receipt was retained, so physical unload,
app restart and crash recovery remain unqualified. Provider switching within a
conversation and `restart` delivery were not exercised.

## Identity and permissions

Both conversations retained their original native identity through C1. The
six-turn native records after reattachment establish actual execution policy:

| Provider | Requested pin | Native evidence |
| --- | --- | --- |
| Codex | `gpt-6.1-sol`, `medium`, default service tier | Every observed `turn_context` used `never` approval, `danger-full-access`, the pinned model and medium effort |
| Claude | `claude-opus-5-5`, `medium`, fast mode off | Every observed native permission record used `bypassPermissions`; model/effort selection was separately verified through T3 configuration |

Claude's permission record does not independently attest OS sandboxing or effort.
The browser connection briefly displayed a changed-permissions notice for its
reduced orchestration grant. That connection notice is distinct from the native
provider execution policy above. Composer labels alone were not accepted as proof.

## Operational recipe

1. Use an explicitly owned T3 environment and verify its installed source/version.
   `T3CODE_HOME` selects T3 state; provider history isolation requires separate
   provider-home configuration and compatible authentication.
2. Obtain an authorized outside-agent OAuth connection. Read-only is insufficient
   for sending to a Full-access target. Keep credentials private and record the
   approved ceiling and expiry. Do not extract a desktop bootstrap credential.
3. Inspect `orchestrator_capabilities` and `t3_thread_configuration`. Select the
   exact approved provider/model/effort. Record T3 thread, native identity and
   effective runtime-policy evidence privately before dispatching substantive work.
4. Address the exact owned thread with `t3_thread_send`. Use a stable
   `clientRequestId` for identical retries. Read/wait on the returned message/run
   and require a correlated reply before calling the request consumed.
5. `auto` can start, steer or queue. Inspect the actual receipt and eventual
   consumption. Use `t3_thread_interrupt` with the owned run for cancellation.
   `t3_thread_launch` has no retry key; reconcile a lost launch before retrying.
6. Keep the repo's registered orchestrator, provider fallback rules, briefs,
   ownership and Yeet gates. Either provider can use this route, but receipt of
   a message does not transfer repository authority.

T3 OAuth operates at environment scope and is broader than Beep's conversation
and recipient grants. Use a dedicated environment or implement an explicit
narrowing layer before exposing unrelated repository sessions to outside clients.
A production adapter must map identities, delivery/recovery states, revocation and
policy evidence without advertising unsupported native-app attachment.

## Cleanup and evidence

All four temporary external authorization sessions were revoked: enrollment
admin, read-only MCP, OAuth MCP and browser proof. Subsequent read-only and
full-access MCP initialization both returned HTTP 401. The desktop bootstrap
session and user-interacted profile were preserved. Both final detach effects
completed, leaving zero owned runtime bindings; physical process teardown is
not claimed. The app remains available for viewing the proof histories.

Independent final verification found no active runs. Codex finished with six
completed runs and one interrupted run; Claude with seven completed runs and one
interrupted run. All seven Codex and eight Claude native policy records retained
the expected settings. A second snapshot five seconds later found no additional
run or changed status. This is bounded observation, not a future-event guarantee.

The [sanitized receipt index](T3CODE-QUALIFICATION.json) records the result and
hashes of the private evidence.
The private raw receipts are not a portable replay runner and are not published.
Their file hashes allow the local audit to bind each assertion to captured output.
