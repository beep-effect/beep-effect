# SUGGESTED_ACTIONS — 2026-10-08

Proposals only. Human admits. Never auto-merge this research PR.

## High priority (time-sensitive / decision)
1. **MCP OAuth issuer binding (GHSA-6qxp-vccf-f47h).** main already pins the transitive SDK at 1.31.0 (#1500). Audit any beep MCP *client* that uses an `authProvider` for `expectedIssuer` and for `issuer` on persisted credentials.
   `bun run beep research capture https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-6qxp-vccf-f47h --tags agents,mcp,security,oauth,cve,typescript-sdk`
2. **effect@4.0.2 bump review.** Check `@effect/ai` telemetry options (#8870 removals) and the mcp-kit `McpServer.layerHttp` hosts (#8773/#8775) before switching main from 4.0.1.
   `bun run beep research capture https://github.com/Effect-TS/effect/releases/tag/effect%404.0.2 --tags effect,release,mcp,patch`
   `bun run beep research capture https://github.com/Effect-TS/effect/pull/8870 --tags effect,ai,opentelemetry,breaking-in-patch`
3. **Harvey MCP Policy Engine as a design reference.** Compare its Tool Pinner and Sanitizer with beep's MCP host/client trust model and with SEP-2127 Server Cards.
   `bun run beep research capture https://www.harvey.ai/blog/building-harveys-mcp-policy-engine --tags law,harvey,mcp,security,tool-pinning`
   `bun run beep research capture https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2127 --tags agents,mcp,spec,sep-2127,discovery`

## Law / IP
4. `bun run beep research capture https://research.google/blog/does-better-work-always-mean-better-workers/ --tags law,patent,uspto,rct,google,drafting`
5. `bun run beep research capture https://legora.com/newsroom/legora-collaborates-with-bmw-group-to-advance-ai-enabled-legal-services --tags law,legora,enterprise,dach,in-house`
6. `bun run beep research capture https://legalsolutions.thomsonreuters.co.uk/blog/2026/10/06/the-next-generation-of-cocounsel-legal/ --tags law,thomson-reuters,cocounsel,uk,matter-workspace`
7. `bun run beep research capture https://www.artificiallawyer.com/2026/10/07/ivo-launches-open-source-deepseek-contract-ai-model/ --tags law,ivo,open-source,contract-ai,model`
8. `bun run beep research capture https://thelegalwire.ai/stealthy-legal-services-startup-teddy-ai-closes-60m-seed-round/ --tags law,funding,rollup,legal-services`

## Effect / local-first
9. **tsc-rs vs `@effect/tsgo` checker evaluation.** Proposal only; no dependency change in a research PR.
   `bun run beep research capture https://github.com/pingdotgg/ts-rust --tags effect,typescript,tsgo,rust,tooling,agents`
10. `bun run beep research capture https://github.com/evoluhq/evolu/releases/tag/%40evolu/common%408.19.0 --tags effect,local-first,evolu,sqlite,release`
11. `bun run beep research capture https://blog.google/innovation-and-ai/technology/developers-tools/embeddinggemma-2/ --tags effect,local-first,on-device,embeddings,google`

## Agents / skills / neural-symbolic
12. **Harness defaults and rule-file supply chain:**
   `bun run beep research capture https://arxiv.org/abs/2610.07639 --tags agents,coding-agents,harness,security,benchmark`
   `bun run beep research capture https://arxiv.org/abs/2610.09264 --tags agents,coding-agents,supply-chain,prompt-injection,agents-md`
13. **Skill utility is configuration-dependent.** Consider per-harness evaluation of beep skills.
   `bun run beep research capture https://arxiv.org/abs/2610.08875 --tags agents,skills,benchmark,skill-authoring`
14. `bun run beep research capture https://arxiv.org/abs/2610.07757 --tags agents,coding-agents,repo-norms,governance`
15. `bun run beep research capture https://arxiv.org/abs/2610.09159 --tags agents,neural-symbolic,lean,coding-agents,verification`
16. `bun run beep research capture https://github.com/anthropics/claude-code/releases/tag/v2.1.294 --tags agents,claude-code,hooks,security,harness`
