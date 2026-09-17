# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-09-16

Operator request (verbatim):

> https://github.com/Effect-TS/effect/pull/7265 the effect PR launching support for the latest MCP
> server features has shipped. This likely means some of the MCP's this repo has need updating. I
> need you to do some /deep-research on this update & the effect documentation & what needs
> updating in this repo. Then I need you to make a new goal after we've done a /grill-with-docs
> session to clarify intent, align & lock in decisions. Use grok sub-agents for research &
> adversarial reviews at different stages of the process.
>
> First make a plan for the research plan then propose it to me for approval after you've done an
> initial grounding & /grilling session with me to make sure we are on the same page.
>
> This should result in a goal depending on the size of the changes we need to make.
>
> use the source code of effect in $HOME/YeeBois/dev/effect

Mid-session operator notes:

- "unsure that the /deep-research workflow is invoked on grok when using that agent to perform
  research."
- Pointers to the grok CLI docs: https://docs.x.ai/build/cli/headless-scripting and
  https://docs.x.ai/build/modes-and-commands#workflows (grok's own native workflows, including
  `/deep-research`).
- On protocol posture: "An actually good protocol. Doesn't matter." (no feature-specific pull).
- On client compatibility: "This is for the in package mcp servers we have mostly in
  ./packages/drivers. cursor-agent is irrelevant here".

Grounding facts gathered before the grill (orchestrator, read-only):

- Effect-TS/effect#7265 "feat: add v2026-07-28 protocol adapter" merged 2026-09-11T23:23:35Z
  (+10342/-1627, 51 files). Follow-ups on main: #8228 (tool strictness, server `instructions`,
  prompt titles, merged 2026-09-14) and #8242 (migration guidance for MCP handlers, tool results,
  byte sizes, merged 2026-09-15). Earlier MCP fixes #7388 and #7520 already shipped in rc.115.
- npm dist-tag `rc` is `4.0.0-rc.115`, cut before the #7265 merge; the changesets release PR #8201
  ("Version Packages (rc)") is still open. pkg.pr.new serves snapshots for upstream main
  `a7a71921de` and for `769f6046a2` (#8242).
- Local Effect clone (`$HOME/YeeBois/dev/effect`, remotes `origin` Effect-TS/effect and `fork`
  beep-effect/effect) is at `a7a71921de`; `effect@4.0.0-rc.115..a7a71921de` is 32 commits and
  +4027/-1010 lines under `packages/effect/src/unstable/{ai,rpc}`.
- Pending changesets on upstream main: 29 besides the MCP ones, including sql-pg `timestamp` and
  `timestamptz` decoding as `Date`, sql-pg unknown OIDs decoding as text, the Effect/Stream API
  alignment (#8256), strict `ByteSize.Input`, HttpApi literal action suffixes, and file response
  content types.
- Upstream migration annotations (`migration/annotations/effect__ai__McpServer.yaml`) now say
  registration handler requirements exclude `McpSchema.McpRequestContext` instead of
  `McpServerClient`; `McpServerClient` is only supplied for initialized stateful requests; strict
  tools reject excess input properties; declared handler failures produce `isError` results.
- `packages/effect/MCP.md` upstream was not touched by #7265 (last changes #8079, #6829, #6625).
- In-repo MCP servers all pin `McpProtocol.v2025_06_18` and mount through `@beep/mcp-kit`:
  `packages/drivers/nlp-mcp`, `packages/drivers/m365-mcp`, `packages/drivers/uspto-mcp`,
  `packages/drivers/gov-legal-mcp`, `packages/law-practice/server` (run by `apps/practice-kg-mcp`),
  and the HTTP sidecar `apps/professional-desktop/server/OntologyMcpTransport.ts`.
- `packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts` reads `McpServerClient` and the
  `mcp-session-id` header to build `McpCallerIdentity`; `packages/epistemic/server/src/GovernedTierGate/GovernedTierGate.gate.ts`
  keys per-session grant state and hash chains on that session id. The 2026-07-28 adapter creates
  no session id; `McpRequestContext` carries `clientId`, `protocolVersion`, `clientCapabilities`,
  `clientInfo`, `requestMetadata`, `inputResponses`, and `requestState`.
- The mcp-kit README still names `effect@4.0.0-beta.92` and MCP `2025-06-18`.
- Client binaries on the workstation that contain the `2026-07-28` version string: Claude Code
  2.1.273, Codex 0.154.0, grok 1.0.34 (string scan only, not a handshake proof).
- The nightly research routine tracked #7265 from 2026-08-31 (`research/2026-08-31` through
  `research/2026-09-13` claims), with a standing action to smoke-test `server/discover`,
  `structuredContent`, and MRTR `InputRequired` once a published RC carries the adapter.
