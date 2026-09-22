# Brief — Effect MCP 2026-07-28 Stateless Protocol Adoption

Fat-marker pitch shaped from `CAPTURE.md`, `RESEARCH.md`, and `DECISIONS.md` (G1–G9, the
2026-09-21 release update, and the seven 2026-09-22 rulings D-posture … D-origin).

## Problem

Effect-TS/effect#7265 shipped the MCP `2026-07-28` stateless protocol (no `initialize`, no
session id, `server/discover`, `McpRequestContext`, multi-round-trip tool results,
`subscriptions/listen`, JSON `structuredContent`), and `effect@4.0.0-rc.117` with that adapter is
already installed on `main` (#1173). Every in-repo MCP server still pins
`McpProtocol.v2025_06_18` through `@beep/mcp-kit`, whose `sanitizedToolkit` is a fork of the
rc.115 `registerToolkit` that has drifted from the installed source. The moment a host lists
only the 2026 adapter, two things happen: the kit builds no caller identity (it only does so when
`McpServerClient` is present), so `GovernedTierGate` fail-closed refuses every ontology mutation;
and no in-repo or vendor client can talk to the host, because Effect's 2026 client group is
`@internal` and Claude Code, Codex and grok all default stdio to `initialize`. We want the good
protocol (G5), on every in-repo host (G9), without a compatibility list that never proves it
(D-posture).

## Appetite

Medium-large: two goal packets, roughly 24–34 agent-days of implementation plus hosted proof
(`research/sizing.md`). The appetite buys a rebased kit with a client and a conformance port,
five stdio hosts cut over in a fixed order, and the sidecar re-keyed on the launch bearer. It does
not buy a new package, a client-echoed run token, MRTR approval flows, or browser-origin
clients.

## Solution sketch

**Kit first (Goal A, S1).** Rebase `sanitizedToolkit` on the installed rc.117 `registerToolkit`
(exclude `McpRequestContext`, `outputSchema`, strict decode, `omitRequestServices`,
`Stream.runLast`); dual-read `McpServerClient` or `McpRequestContext` so a 2026 dispatch still
yields transport facts (`clientId`, `sessionId: None`), never run-key semantics; one named error
translator at the kit adapter (D-projection: `api_key_required` kept, invalid arguments →
`InvalidParams`); a protocol-list helper so six hosts do not carry six literals; README pin,
stale comments, `SanitizedSpan` coverage ratchet; the sql-pg native call-site census inherited
from the retired S0.

**Client in the kit (Goal A, S1b).** `@beep/mcp-kit/client`: the 2026 `ClientRpcs` group with
`server/discover`; an HTTP injector for `MCP-Protocol-Version`, `Mcp-Method`, `Mcp-Name`
(`params.name` for tool calls and prompt gets, `params.uri` for resource reads) and `_meta`; a
stdio NDJSON helper that sends `discover` first; the SSE unwrap ported from the #1173 harness; a
port of Effect's conformance harness (D-conformance). Consumers: the sidecar integration harness,
`goals/ontology-agent-surface/ops/live-mcp-client.ts`, the m365 stdio test, the vendor capture.

**Hosts in order (Goal A, S2/S3).** m365 first (the only real stdio JSON-RPC conversation test:
the framing canary), then uspto (array `structuredContent`), gov-legal, practice-kg (smoke and
`.mcpb`), each with `instructions`, prompt titles, JSDoc, and a conformance run. nlp-mcp last,
and only after a live first-message capture of Claude Code (and Codex if cheap) against a
2026-only build (D-cli-contract). If no daily CLI speaks 2026 on stdio, the nlp-mcp flip is held
as a re-entry gate in `MAP.md`, recorded in Goal A's exception ledger.

**Sidecar last (Goal B, S4).** The run key becomes a server-side digest of the per-launch bearer
that `requireRpcSessionToken` already verifies (`launch:<digest>`). The desktop composition fills
the kit's product-neutral dispatch anchor (a branded `Context.Reference` added by Goal A) with
that digest; `epistemic/server` (`runIdOf`) and `ontology/server` (`OntologyChangeActor`) both
read the anchor and never import each other (D-run-key as amended by Gate D, 2026-07-25
foundation-mediated inversion); the kit's 2025 `mcp-session-id` read is deleted in the same PR;
decision 10 reads "a run is a sidecar launch". Same PR: the sidecar protocol pin,
the harness on the 2026 wire through the kit client, grant-expired and never-evict tests,
`OntologyChangeActor` keyed to the anchor, the gate's own spans in `GovernedTierGate.gate.ts`
renamed `epistemic.governed_tier_gate.evaluate` / `record_outcome` and carrying
`epistemic.governed_tier_gate.run_id` (not the kit's technical `mcp.tool.call.*` spans), and the
Origin allow-list moved into `OntologyMcpServerConfig` with one Origin check, `OPTIONS` → 403,
Origin-less POST denied, CORS headers updated (D-origin). HTTP cancellation stays a recorded
Effect gap.

**Doctrine touch points (S5a, split across the goals).** mcp-kit README consumer table
(architecture 07); identity wording in `goals/agent-execution-authority/SPEC.md` and the
epistemic package docs. No architecture-wide `DECISIONS.md` entry, no numbered-doc edits, no
shared-kernel promotion record (the kit is `foundation/capability`, its consumer table exists).

## Rabbit holes

- Reading `Mcp-Session-Id` after Effect stops minting it: a client-supplied string would become a
  grant-run key. Sequencing matters (Gate D amendment 2): Goal A PR 1 keeps the 2025 read as part
  of the dual-read so `main` never runs a session-keyed gate with no key; Goal B deletes the read
  in the same PR that fills the dispatch anchor with `launch:<digest>`, and adds a test that a
  stray header on a 2026 dispatch still yields `sessionId: None`.
- `sanitizedToolkit` drift: the fork excludes `McpServerClient` where upstream now excludes
  `McpRequestContext`; rebasing by hand re-creates drift within one RC. Rebase once, then a
  `SanitizedSpan` coverage ratchet and a stale-comment sweep are the guard.
- `withTopLevelObjectInputSchema`: rc.117 (Effect#8326) normalises identified output schemas to
  object roots; S1 must re-check whether the kit shim is still needed against the installed
  source before deleting or keeping it.
- HTTP cancellation on 2026 is an accepted Effect gap; do not design a kit-side workaround.
- The stdio conformance referee expects `data.supported` on `-32022`; Effect omits it. Upstream
  lane (G8), never an in-repo waiver that hides a real failure.
- Vendor CLIs may never speak 2026 on stdio; nlp-mcp can stay held without blocking Goal A's
  close.

## No-gos

- No mixed protocol lists on any host, not even as a stepping stone (D-posture).
- No new package for the client (D-client-home); no client-echoed run token, `requestState`
  HMAC, or MRTR approval flow as the run key (D-run-key).
- No canned invalid-arguments result once strict tools land (D-projection).
- No browser-origin `/mcp` client, no Origin-less POST allowance, no app-local allow-list
  literal (D-origin).
- No bearer, launch, or sidecar semantics in mcp-kit schemas; the kit carries transport facts plus
  one product-neutral dispatch anchor that app composition fills (Gate D amendment 1).
- No architecture-wide decision-log entry, numbered-doc edit, or promotion record for this work.
- External agent clients (cursor-agent and others) do not gate any flip (G6); the only capture is
  the nlp-mcp entrance criterion.
