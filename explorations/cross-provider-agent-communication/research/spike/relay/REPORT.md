# Agent Relay executable adoption spike

2026-10-09. Local cache install only, exact `@agent-relay/{sdk,harness-driver,harnesses}@13.2.0`, installed with `--ignore-scripts --no-audit --no-fund` (170 packages, lockfile retained). Pinned upstream reference: `5b30a69d7ac62190e89f8b1e13ccbd9a38a3a2db`. Tests execute npm release artifacts; npm-release/source-commit byte equivalence was not established. No provider model, live app, hosted workspace, cloud credential, global install, auto-setup or paid endpoint was used.

## Actual local broker result

The supplied Linux binary runs entirely in an explicit local-only mode:

```text
agent-relay-broker init --local-only --instance-name synthetic-spike \
  --persist --state-dir <owned-cache>/broker-state --api-port 0 --api-bind 127.0.0.1
```

The process received an allowlisted environment with PATH, locale and a newly generated local broker authentication token. No inherited workspace credentials. Raw logs are mode 600; generated tokens and opaque receipt IDs are excluded from published results. The broker was stopped after each bounded run, and its synthetic worker was explicitly released.

| Test | Executable observation |
| --- | --- |
| Local startup/health | Pass; version 13.2.0, protocol 2; no workspace key or relay base URL |
| Local capabilities | spawn/attach/queue true; remote delivery/attach, cross-machine routing, Relaycast tools and worker presence false |
| Reconciliation | unconfigured/disconnected; `audit_only_at_least_once` |
| Absent local recipient | HTTP 502, “only agents running on this broker can receive local deliveries” |
| Custom native fixture | Spawn succeeded using a Python JSON-over-stdio sidecar; no provider CLI |
| Native command | Structured `submit_user_message` returned accepted=true; synthetic receipt event observed |
| Messaging to owned fixture | success=true, `delivery_status: queued_local`, `local: true`, Relaycast published=false, reconciliation pending=true |
| Fixture delivery | After a bounded 1.5-second observation, native history included `delivery.accepted`; this is fixture acceptance, not model consumption |
| Manual flush mode | Typed `capability_disabled`: unavailable in local-only mode; automatic durable queue remains |
| Broker restart | The second process read one retained local-outbox reconciliation record; after another synthetic send count became two |
| Release/cleanup | Worker process stopped, retained identity; owned broker stopped |

Restart established audit-outbox retention, not remote replay or exactly-once execution. Local reconciliation records remain pending because no Relaycast backend was configured. The local send API's success and queued status must not become a Beep `context-received` receipt without adapter evidence.

## Actual runtime receipt/recovery fixture

The published `RelayHarnessSession` class was imported from the package root and supplied a synthetic host, with no provider harness/model creation. Two separate Node processes exercised durable storage.

1. Busy host, on-idle delivery: returned `deferred`, reason `queued_until_idle`, with zero host invocations. Repeating the same key remained deferred and did not invoke the host.
2. Fresh process with idle host: `restoreDeferredMessages()` invoked the host once. Repeating the same message/key returned `accepted` without another invocation.
3. A separate immediate message returned `accepted` and invoked the host once more.

Observed events were `message.received` and `delivery.accepted`. No `delivered`, model acknowledgement or task completion occurred. The class advertises immediate/next-message/next-tool-call/on-idle modes, queue support, release and detailed observation capabilities. This fixture verifies class behavior, not that every provider adapter satisfies those declarations.

The initial fixture import incorrectly used the unexported `@agent-relay/harnesses/ai-sdk` subpath; package-root import corrected the probe. This was a probe mistake, not an upstream blocker.

## Model pins and provider coverage

Pure executable mapping checks preserved explicit Codex `model: gpt-6.1-sol` and `reasoningEffort: medium`. The registry defaults to `gpt-5.6-terra` if no model is supplied, so production must override and assert observed identity. Claude mapping preserved `claude-opus-5-5` but dropped an `effort: medium` field; its typed settings expose thinking rather than effort. A compliant Claude launch/config route must be proven before using that adapter for repo work.

Native registry entries are Claude, Codex, OpenCode, Pi and DeepAgents; rollout is experimental. Cursor and Grok definitions are PTY-based. This package does not supply the richer Cursor SDK or Grok ACP adapter proven as candidates by native interface research. Custom native harness configuration is supported and was exercised here, so those adapters could be added without replacing the broker, but that work is net-new.

## License observations

Root Apache-2.0 LICENSE retrieved from the pinned commit and saved as `UPSTREAM-LICENSE`. Release metadata says Apache-2.0 for harness-driver/harnesses, omits a license field for sdk, and says MIT for broker-linux-x64. No bundled component LICENSE was found in those package inventories. These are recorded declarations, not a completed transitive/component license audit. Do not label every installed artifact Apache-2.0 solely from the repository root.

## Comparison and recommendation

Relay is a concrete reusable managed-runtime candidate: local native sidecars, explicit local capability disabling, durable queue receipts, replay-aware deduplication, control acknowledgements and retained audit outbox were executed successfully. This is materially stronger evidence than a README claim.

It is not yet a full replacement for the proposed Beep broker. Local-only mode disables remote/fleet functionality, manual-flush control and messaging tools, and missing local recipients fail rather than durably waiting for enrollment. Rich existing app attachment, Cursor/Grok native steering, permission continuity, and Beep role/epoch/Yeet semantics remain untested or absent. The ordinary full facade depends on Relaycast messaging; no workspace was created and no remote service was contacted. A local/self-hosted Relaycast backend would require a separately scoped deployment test before an apples-to-apples remote/group/DM comparison.

Adopt behind the Beep receipt/capability contract only after those boundaries pass the same native-route tests. Preserve queued/accepted/deferred/model-consumed/completed distinctions, retain native extensions, and guard model defaults. Do not substitute PTY terminal heuristics for active-turn steering.

Artifacts: sanitized `broker-results.json`, `adapter-results.json`, `session-{write,read}-results.json`; raw `*.private.*`; reusable bounded `broker-probe.mjs.txt`, `session-fixture.mjs.txt` research source artifacts and `fixture.py`; install lockfile. No repository production edits.
