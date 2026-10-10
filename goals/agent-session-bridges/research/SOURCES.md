# Agent Session Bridges: inherited sources and provenance

Graduation snapshot: 2026-10-09. The [source exploration ledger](../../../explorations/cross-provider-agent-communication/research/SOURCES.md) is primary; the corpus below is reproduced for implementation convenience, with links resolved back to the source packet. Its dated historical state statements describe the original research phases, not this goal's lifecycle. This goal remains `paused` and has no completed implementation proof.

Implementation decisions follow [SPEC.md](../SPEC.md). Related promised-now goal: [other contract](../../agent-message-router/SPEC.md). Production app enrollment/browser/federation remain named gated candidates in the source map. Use exact source dates and license dispositions below; no upstream code has been copied into package implementations.

## Inherited corpus

# Sources and provenance

Research date: 2026-10-09. Inspected repo commit:
`d1e8350670f87c7fa2d744f87c8cdbf99ad1852f`.

## Evidence discipline

Local help proves interface presence only. Current primary docs prove documented
contracts, not local deployment. Source inspection proves code at the stated
revision. Earlier packet evidence keeps its original date. The subsequent
[executed spike](../../../explorations/cross-provider-agent-communication/research/spike/README.md) adds model-delivery and synthetic-recovery
receipts. The subsequent Claude web idle bridge passed with visible UI evidence;
native app attachment remains unknown. No upstream code was vendored.

## Upstream repositories and licenses

| Repository | Inspected revision | License observation | Disposition |
| --- | --- | --- | --- |
| AgentWorkforce/relay | `5b30a69d7ac62190e89f8b1e13ccbd9a38a3a2db` | Apache-2.0, root LICENSE retrieved | Adoption candidate; port only with attribution and component/license recheck |
| whooperlove/cross-agent_mcp | `ab67426fdd08c007a0c40f7b92228c5adce40010` | MIT, root LICENSE retrieved | Bridge reference; port with attribution after tests |
| Dicklesworthstone/mcp_agent_mail | `2f487bdb1f1d2744707d1e9dba181f68b9162b38` | MIT-labelled text with restrictive OpenAI/Anthropic rider; GitHub SPDX NOASSERTION | Exclude adoption/port/benchmark under presumed permissive terms; license finding only |
| gvorwaller/claude-relay | `1937dc802fd2baf9c8d4c52fabcc029912a700ac` | Metadata null; root LICENSE returned 404 | Reference only; no copying |
| xai-org/grok-build | Upstream main source link, not release-pinned | Not verified in this pass | Reference only; pin installed-compatible source before implementation |
| agentclientprotocol/claude-agent-acp | Upstream repo link | Not verified in this pass | Reference only |
| zed-industries/codex-acp | Upstream repo link | Not verified in this pass | Reference only |
| agentclientprotocol/agent-client-protocol | Primary protocol docs | Specification/code license not verified here | Contract reference only; no vendoring |
| a2aproject/A2A | Primary protocol docs | Specification/code license not verified here | Contract reference only; no vendoring |

Repository metadata and root license retrieval used unauthenticated GitHub HTTP
reads. Mutable documentation URLs were accessed on the research date. Dependency
licenses inside Relay were not exhaustively audited. The spike installed exact
release artifacts only in disposable cache, not repo manifests. A permissive
root license does not establish every component's terms.

## Mined source corpus

| ID | Source | Location | Disposition |
| --- | --- | --- | --- |
| L1 | Fleet coordination lineage | `goals/fleet-mirror/README.md:35` and `explorations/fleet-coordination/DECISIONS.md:309` | Reuse decisions; delivery still missing |
| L2 | Failed idle-wake experiment | `explorations/pr-event-awareness/research/2026-09-28-W7-socket-probe.md:36` | Preserve failed evidence and test boundary |
| L3 | Orchestrator policy | `.claude/skills/orchestrate/SKILL.md`, `docs/runbooks/agent-pools.md` | Current authority constraints |
| L4 | Provider controls | `research/provider-interfaces.md`, local help receipt table | Candidate adapters; no runtime pass |
| L5 | Implemented repo components | `research/repo-bricks.md`, source/symbol table | Reuse within listed boundaries |
| U1 | Relay managed runtime | Pinned `packages/harnesses/README.md` | Evaluate PTY/native tradeoffs |
| U2 | Relay native registry | Pinned `packages/harnesses/src/ai-sdk/adapter-registry.ts` | Coverage/model-default evidence; no code copied |
| U3 | Cross-agent IDE bridge | Pinned `README.md`, IDE integration section | Launch-wrapper reference; no arbitrary app claim |

## External sources

- https://a2a-protocol.org/latest/specification/
- https://a2a-protocol.org/latest/whats-new-v1/
- https://agentclientprotocol.com/protocol/prompt-turn
- https://agentclientprotocol.com/protocol/session-setup
- https://agentclientprotocol.com/protocol/v1/overview
- https://agentrelay.com/docs/introduction
- https://agentrelay.com/docs/relay-connect
- https://agentrelay.com/docs/session-capabilities
- https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode
- https://code.claude.com/docs/en/channels
- https://code.claude.com/docs/en/channels-reference
- https://code.claude.com/docs/en/cli-reference
- https://code.claude.com/docs/en/desktop
- https://cursor.com/docs/cli/acp
- https://cursor.com/docs/cli/reference/output-format
- https://cursor.com/docs/sdk/typescript
- https://developers.openai.com/codex/app-server
- https://docs.x.ai/build/cli/headless-scripting
- https://docs.x.ai/build/keyboard-shortcuts
- https://github.com/AgentWorkforce/relay/blob/5b30a69d7ac62190e89f8b1e13ccbd9a38a3a2db/packages/harnesses/README.md
- https://github.com/AgentWorkforce/relay/blob/5b30a69d7ac62190e89f8b1e13ccbd9a38a3a2db/packages/harnesses/src/ai-sdk/adapter-registry.ts
- https://github.com/Dicklesworthstone/mcp_agent_mail/blob/2f487bdb1f1d2744707d1e9dba181f68b9162b38/LICENSE
- https://github.com/agentclientprotocol/claude-agent-acp
- https://github.com/gvorwaller/claude-relay/tree/1937dc802fd2baf9c8d4c52fabcc029912a700ac
- https://github.com/whooperlove/cross-agent_mcp/tree/ab67426fdd08c007a0c40f7b92228c5adce40010
- https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-shell/src/session/acp_session_impl/interjection.rs
- https://github.com/zed-industries/codex-acp
- https://modelcontextprotocol.io/specification/2025-11-25/basic/transports
- https://ts.sdk.modelcontextprotocol.io/v2/migration/support-2026-07-28

## In-repo capability references

The [repo inventory](../../../explorations/cross-provider-agent-communication/research/repo-bricks.md) is the complete source/symbol table. Reuse
`@beep/acp`, `@beep/ai-provider-cli`, Session/Register, QualityScheduler/RunScope,
Yeet inbox/PR registry/wave notifier/merge gate, and MCP framing where their
contracts fit. General durable peer messaging, endpoint enrollment, fencing,
provider-specific attach bridges and remote message delivery are NET-NEW.

Architecture placement follows `standards/architecture/07-non-slice-families.md`
and `10-cross-slice-coordination.md`: repo operations in tooling, external
wrappers in drivers, product semantics in their owning slice.

## Cross-links and provenance

- [Prior packet inventory](../../../explorations/cross-provider-agent-communication/research/prior-packets.md), including exact original anchors.
- [Provider interface census](../../../explorations/cross-provider-agent-communication/research/provider-interfaces.md).
- [Current implementation inventory](../../../explorations/cross-provider-agent-communication/research/repo-bricks.md).
- [Research synthesis](../../../explorations/cross-provider-agent-communication/RESEARCH.md), [decisions](../../../explorations/cross-provider-agent-communication/DECISIONS.md),
  [brief](../../../explorations/cross-provider-agent-communication/BRIEF.md), [candidate goal map](../../../explorations/cross-provider-agent-communication/MAP.md).
- [Proposed contract](../../../explorations/cross-provider-agent-communication/research/ARCHITECTURE.md), [probe plan](../../../explorations/cross-provider-agent-communication/research/PROBE-PLAN.md),
  [friction ledger](../../../explorations/cross-provider-agent-communication/research/OPPORTUNITIES.md).

No goal packet was graduated, no prior packet was superseded, and no external
session was contacted. This is authored research in a new isolated lane.

## Review and validation

- [Lineage review](../../../explorations/cross-provider-agent-communication/reviews/2026-10-09-lineage.md).
- [Provider review](../../../explorations/cross-provider-agent-communication/reviews/2026-10-09-providers.md), including resolved scope finding.
- [Architecture review](../../../explorations/cross-provider-agent-communication/reviews/2026-10-09-architecture.md), including resolved findings.
- [Validation receipt](../../../explorations/cross-provider-agent-communication/research/VALIDATION.md).


## Executed spike provenance

- [Result index](../../../explorations/cross-provider-agent-communication/research/spike/README.md): authorized experiments on 2026-10-09; provider
  versions, exact route pins, sanitized machine receipts, model/transport/fixture
  distinctions and reusable probe sources. Raw transcripts and opaque identities
  remain private in the workstation cache, not the public repository.
- Codex 0.162.0 generated app-server JSON schema plus installed CLI help guided
  calls. [Official app-server transport documentation](https://learn.chatgpt.com/docs/app-server)
  resolved Unix WebSocket framing; initial raw-NDJSON/proxy timeouts were probe
  failures, not evidence that model delivery is unsupported.
- Relay executable artifacts: exact npm `@agent-relay/sdk`,
  `@agent-relay/harness-driver`, `@agent-relay/harnesses` 13.2.0, installed with
  scripts disabled. [SDK registry metadata](https://registry.npmjs.org/@agent-relay/sdk/13.2.0),
  [driver metadata](https://registry.npmjs.org/@agent-relay/harness-driver/13.2.0),
  [harness metadata](https://registry.npmjs.org/@agent-relay/harnesses/13.2.0).
  Source-reference SHA above was not proven byte-equivalent to the npm release.
  SDK license metadata absent; driver/harnesses Apache-2.0; broker-linux-x64
  declares MIT. Full component/transitive license audit remains open.
- The Python/SQLite contract model is new research-only fixture code. It models
  crashes and role fencing; it is not a port, Beep package or production proof.


## Visible-app proof provenance

- [Root CUA observations and scoped UI receipt](../../../explorations/cross-provider-agent-communication/research/spike/APP-PROOF.md): public Claude
  web UI with a disposable conversation; visible model Opus 5.5 Medium and Manual
  mode; actual assistant-message extraction, managed-peer correlation and reload
  identity. No private web API, app credential or unrelated transcript was read.
- [Managed Grok peer](../../../explorations/cross-provider-agent-communication/research/spike/app-peer/README.md): one still-live isolated session
  generated the request and acknowledged the exact app reply. UI observations
  belong to the root, not the managed-peer worker.
- [Installed Desktop source discovery](../../../explorations/cross-provider-agent-communication/research/spike/app-discovery/REPORT.md): bundled
  alpha.17.2 stdio ownership; missing shared daemon; implementation-level opt-in
  gates. Sanitized module names/hashes identify the inspected local source. No
  proprietary source was copied and no public-stable-API claim is made.

- [Browser integration reuse check](../../../explorations/cross-provider-agent-communication/research/spike/browser-integration.md): exact live
  source anchors for Firecrawl service browser APIs, QA and Openclaw boundaries.
  No repo-owned authenticated local conversation enrollment driver was found.
  These existing service APIs do not qualify the CUA browser route for unattended
  deployment or authorize a new hosted-service billing route.

## Current implementation receipts — 2026-10-09

- [Owned Codex↔Grok autonomous receipt](GROK-MANAGED-ROUNDTRIP.json): actual
  managed tools, three acknowledged and settled messages, one persisted grant use
  each, 39.91-second total run, unchanged source/executables and owned cleanup.
  Busy delivery, built-in denial and existing-app enrollment are not qualified.
- [Native qualification](NATIVE-QUALIFICATION.md): root-owned per-mode matrix
  and separate Claude queued-busy/idle proof; historical synthetic/native receipts
  remain separate from new launch corrections.
- [Router follow-up R1](../../agent-message-router/research/FOLLOW-UPS.md): latest independent
  extraction review has no introduced regression and one deferred pre-existing P2
  for inconsistent trusted-host enrollment; the dispatcher fences inference.

- [Owned Codex↔Claude managed receipt](CLAUDE-MANAGED-ROUNDTRIP.json): corrected
  launch recipe, two-message queued-busy exercise followed by the same sessions'
  autonomous three-message exchange; all five ACKed and settled, one send grant
  per provider, unchanged source/executables and owned cleanup, 56.2 seconds total.
  Independent review of the final Claude patch remains a separate gate.

## Claude launch isolation qualification (2026-10-09)

- Installed Claude Code 2.1.295 `--help` identifies safe-mode MCP suppression
  and bare-mode exclusion of subscription OAuth. A zero-model control-protocol
  comparison established zero servers under safe mode versus six connected
  messaging tools under restricted mode, with no model prompt and no network.
- [Official memory documentation](https://code.claude.com/docs/en/memory#exclude-specific-claude-md-files)
  documents absolute-glob `claudeMdExcludes`, instruction/rule exclusions and
  `autoMemoryEnabled: false`; managed administrator instructions remain
  applicable. Reference-only use; no upstream source was copied.
- The implementation and actual busy/autonomous result are recorded in
  [native qualification](NATIVE-QUALIFICATION.md) and the
  [Claude managed receipt](CLAUDE-MANAGED-ROUNDTRIP.json). Launch settings,
  MCP startup and live model behavior are distinct evidence.

## Attached T3 extension (2026-10-09)

- [Executed T3 host qualification](../../../explorations/cross-provider-agent-communication/research/T3CODE-QUALIFICATION.md) and its receipt index: installed host evidence, native identities/policy and limitations; not adapter proof or Beep recipient authorization.
- [T3 integration design](T3-INTEGRATION.md): admitted architecture and executed functional acceptance, with final gates open; composes existing EndpointDispatch/store loop, AgentMessageToolkit and desktop-session register units. New external transport belongs in t3-code, not native managed launch profile.
- Binding routing: standards/architecture/03-driver-boundaries.md and standards/ARCHITECTURE.md tooling operational driver composition. External OAuth remains private; no proprietary installed source is copied.

- [Attached T3 integration qualification](T3-INTEGRATION-QUALIFICATION.json): actual bidirectional repository audits, four ACKed/settled messages, native observer separation, negative prime, owned credential/bridge cleanup, independent review and source/private-receipt digests. Full final verification and hosted closeout remain pending.

- [Initial T3 integration receipt](T3-INTEGRATION-INITIAL-QUALIFICATION.json): immutable earlier exercised source, negative prime and original internal credential incident.
- [T3 cache posture review](T3-CACHE-REVIEW.md): separately reviewed task/fingerprint baseline evidence, not runtime or cache-reuse qualification.

- [Refactor interruption reconciliation](T3-REFACTOR-RECONCILIATION.json): four h3 ACKs and both reports, forward settlement, cancelled reverse coordinator and two canonical ambiguity holds; separate from the historical complete hardened proof.

- [T3 helper cache review](T3-CACHE-HELPER-REVIEW.md): canonical dependency posture review for the schema-policy helper repair; no new cache qualification.

- [Final local verification](T3-LOCAL-VERIFICATION.md): completed package checks and exact publication boundary.

- [Shared main integration](T3-MAIN-INTEGRATION.md): frozen receipt for main 6513e85d2c integrated through 5868dc8218, canonical conflict regeneration and retained cache scope; post-integration gates remain separate.
- [Scoped T3 reflection](../history/reflections/2026-10-09-codex-t3.md): final-extension lessons and prospective completed-retained declaration for merged main only; operative execution and external gates remain open.

- [Post-integration gate attribution](T3-POST-INTEGRATION-GATES.md): 14 pass/two shared-main reds, exact upstream source/fingerprint provenance, verified owner routing and bounded publication fallback.

- [T3 hosted triage](T3-HOSTED-TRIAGE.md): exact77fd CI and review findings, introduced repairs and inherited ownership.
