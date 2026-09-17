# Effect MCP 2026-07-28 Stateless Protocol Adoption — Sources & Provenance

- **Cluster / origin:** Effect-TS/effect#7265 (merged 2026-09-11) and its follow-ups #8228 and
  #8242, read against the in-repo MCP hosts; ten native grok research lanes plus an orchestrator
  spike, verified by three-vote grok refuters (Gate B).
- **Provenance:** `RESEARCH.md` (synthesis), `research/00-plan-review.md` (Gate A),
  `research/verification/README.md` (Gate B), lane reports `research/1*-*.md` and
  `research/2*-*.md`, claims in `research/*.claims.jsonl`, verdicts in `research/verification.jsonl`.

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `effect-mcp-server` | MCP server runtime, `registerToolkit`, `layerHttp` SSE conversion | Effect-TS/effect `a7a71921de` | `effect:packages/effect/src/unstable/ai/McpServer.ts` (see lanes 10-u1, 11-u2, 20-r1) | adapter API | port with attribution (MIT) |
| `effect-mcp-runtime` | protocol selection, `selectStatefulProtocol`, header contract | Effect-TS/effect `a7a71921de` | `effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts` | stateless runtime | reference |
| `effect-mcp-2026` | `v2026_07_28` adapter and schema | Effect-TS/effect `a7a71921de` | `effect:packages/effect/src/unstable/ai/internal/mcpProtocol/v2026_07_28.ts`, `.../mcpSchema/v2026_07_28.ts` | wire semantics | reference |
| `effect-mcp-tests` | 2026-only conformance, protocol adapters, MRTR, security suites | Effect-TS/effect `a7a71921de` | `effect:packages/effect/test/unstable/ai/McpServer/**` | executable docs | port test harness patterns with attribution |
| `effect-mcp-docs` | `MCP.md`, migration notes and annotations, changesets | Effect-TS/effect `a7a71921de` | `effect:packages/effect/MCP.md`, `migration/**`, `.changeset/*.md` | guidance gaps (G8) | reference |
| `effect-sql-pg` | timestamp `Date` decode, unknown-OID text decode | Effect-TS/effect `a7a71921de` | `packages/sql/pg/src/PgTypes.ts` | snapshot blast radius | reference |
| `effect-core-align` | `Effect.isEffect`, `Stream.scan`, `orElseSucceed`, `ByteSize.Input` | Effect-TS/effect `a7a71921de` | `effect:packages/effect/src/{Effect,Stream,ByteSize}.ts` | snapshot blast radius | reference |

**How these inform this packet:** the runtime and adapter files fix what a 2026-only server
does with `initialize`, headers, identity, and cancellation; the test suites are the only
executable guidance for the new capabilities and are the pattern for in-repo 2026 wire proofs;
the sql-pg and core files size the non-MCP part of the snapshot pin.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| Effect-TS/effect | MIT | port-with-attribution | `registerToolkit` shape for the kit rebase; test-harness patterns for 2026 wire proofs |
| modelcontextprotocol/modelcontextprotocol (spec + SEPs) | MIT (spec text and schema) | reference-only | normative MUST/SHOULD rules for 2026-07-28 |
| modelcontextprotocol/conformance | MIT | reference-only (tooling we may run) | modern-only referee expectations |
| modelcontextprotocol/typescript-sdk, python-sdk | MIT | reference-only | dual-era defaults, `negotiate_auto` fallback rules |
| modelcontextprotocol/inspector | MIT | reference-only | `--protocol-era` client for manual probes |
| openai/codex | Apache-2.0 | reference-only | stdio/HTTP 2026 opt-in flags |
| xai-org/grok-build | not verified in this packet | reference-only | stdio stays on `initialize` (rmcp) |

## 3. External research sources

Specification and SEPs (lane 13-s1, section "Appendix — key page URLs used" lists every page):

- MCP 2026-07-28 specification: <https://modelcontextprotocol.io/specification/2026-07-28/changelog>,
  `.../basic/versioning`, `.../basic/transports/streamable-http`, `.../basic/transports/stdio`,
  `.../basic/patterns/mrtr`, `.../basic/patterns/subscriptions`, `.../server/discover`,
  `.../server/tools`, `.../deprecated`, `.../basic/authorization` and its security pages.
- Release announcement: <https://blog.modelcontextprotocol.io/posts/2026-07-28/>.
- SEPs: <https://modelcontextprotocol.io/seps/2575-stateless-mcp.md>,
  <https://modelcontextprotocol.io/seps/2567-sessionless-mcp.md>,
  <https://modelcontextprotocol.io/seps/2322-MRTR.md>,
  <https://modelcontextprotocol.io/seps/2243-http-standardization.md>,
  <https://modelcontextprotocol.io/seps/2549-TTL-for-list-results>,
  <https://modelcontextprotocol.io/seps/1303-input-validation-errors-as-tool-execution-errors>,
  <https://modelcontextprotocol.io/seps/1686-tasks.md>, <https://modelcontextprotocol.io/seps/2663-tasks-extension>.
- Feature lifecycle: <https://modelcontextprotocol.io/community/feature-lifecycle>.
- Spec repository pull requests and issues cited per rule in 13-s1 §1 (for example
  <https://github.com/modelcontextprotocol/modelcontextprotocol/pull/3002>,
  <https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2575>).

Ecosystem (lane 14-s2):

- Conformance: <https://github.com/modelcontextprotocol/conformance> (`src/scenarios/server/stateless.ts`).
- SDK protocol-version notes: <https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/protocol-versions.md>,
  <https://github.com/modelcontextprotocol/python-sdk/blob/main/docs/protocol-versions.md>,
  <https://github.com/modelcontextprotocol/python-sdk/blob/main/src/mcp/client/_probe.py>,
  <https://github.com/modelcontextprotocol/go-sdk/blob/main/docs/protocol.md>,
  <https://github.com/modelcontextprotocol/csharp-sdk/releases/tag/v2.0.0-preview.1>.
- Inspector: <https://github.com/modelcontextprotocol/inspector/releases/tag/2.0.0>,
  <https://modelcontextprotocol.io/docs/2026-07-28/tools/inspector/protocol-eras.md>,
  issues 1700 and 1846.
- Claude Code: <https://code.claude.com/docs/en/mcp>, <https://code.claude.com/docs/en/env-vars>.
- Codex: <https://github.com/openai/codex/releases/tag/rust-v0.147.0>,
  <https://github.com/openai/codex/blob/main/codex-rs/core/config.schema.json>,
  <https://github.com/openai/codex/tree/main/scripts/mcp_conformance>, PR 35724, issues 29247 and 33952.
- grok: <https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-shell/changelogs/1.0.29.md>
  and the `servers.rs` MCP client source.
- Community: <https://laravel-news.com/laravel-mcp-1-0> (cited claim struck in Gate B),
  <https://github.com/Roee-Tsur/mcp-spec-check>.

Effect: <https://github.com/Effect-TS/effect/pull/7265>; snapshots at
`https://pkg.pr.new/Effect-TS/effect/<package>@<sha>`.

## 4. In-repo capability references

| Brick | Path | Mode |
| --- | --- | --- |
| `@beep/mcp-kit` (`SanitizedSpan`, `McpCaller`, `TierGate`, `ApiKeyRequired`, `FieldTier`, `ToolkitComposition`, `ToolAnnotations`, `SourceAuth`, `Version`) | `packages/foundation/capability/mcp-kit/` | extend (rebase on snapshot `registerToolkit`; identity redesign) |
| `@beep/nlp-mcp`, `@beep/m365-mcp`, `@beep/uspto-mcp`, `@beep/gov-legal-mcp` | `packages/drivers/*-mcp/` | extend (protocol pin, `instructions`, wire tests) |
| `@beep/law-practice-server` + `apps/practice-kg-mcp` | `packages/law-practice/server/`, `apps/practice-kg-mcp/` | extend |
| Ontology MCP sidecar | `apps/professional-desktop/server/OntologyMcpTransport.ts` | extend (CORS, Origin, identity) |
| `GovernedTierGate`, `OntologyChangeActor`, `GovernedEgress` | `packages/epistemic/server/src/GovernedTierGate/`, `apps/professional-desktop/server/` | extend (run key without sessions, owned here) |
| `OntologyMcpServerConfig` | `packages/ontology/config/src/McpConfig.ts` | extend (Origin allow-list home if D-origin picks config) |
| Sidecar HTTP harness and live client | `apps/professional-desktop/test/integration/support/ontology-mcp-harness.ts`, `goals/ontology-agent-surface/ops/live-mcp-client.ts` | extend (2026 wire or SSE-aware transport) |
| Effect catalog and `patchedDependencies` | `package.json` | extend (snapshot pin, patch re-key) |
| `@beep/schema` `EffectSchema`, ai-metrics `source-discovery` | `packages/foundation/modeling/schema/src/EffectSchema.ts`, `packages/tooling/library/ai-metrics/src/source-discovery.ts` | extend (two snapshot type fixes) |
| Snapshot campaign precedent | beep-effect #1060 (`c8349ed`) | reuse (procedure) |
| 2026 wire test seam | NET-NEW (Effect test-harness patterns, ported with attribution) | NET-NEW |

## 5. Cross-links & provenance

- This packet: `README.md`, `CAPTURE.md`, `DECISIONS.md` (G1–G9), `RESEARCH.md`,
  `research/impact-matrix.md`, `research/OPPORTUNITIES.md`, `ops/prompts/*` (lane briefs).
- Reviews: `research/00-plan-review.md` (Gate A), `research/verification/README.md` (Gate B),
  `reviews/gate-c-{premortem,doctrine,sizing}.md` (Gate C, 30 findings dispositioned).
- Related goals: `goals/agent-execution-authority` (SPEC decision 10, "a run is an MCP session",
  corrected in its PR 5), `goals/ontology-agent-surface` (live client and harness only);
  standards `standards/architecture/06-*`, `07-*`, `09-*`, `12-*` and `standards/architecture/DECISIONS.md`.
- Memory precedents (agent-local, not in repo): the `c8349ed` snapshot migration state and the
  `mcp-session-identity` note.
