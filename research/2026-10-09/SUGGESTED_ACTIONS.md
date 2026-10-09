# SUGGESTED_ACTIONS — 2026-10-09

Proposals only. Human admits. Never auto-merge this research PR.

## High priority (time-sensitive / decision)

1. **Pin the hallucination checker before trusting a gated legal score.** LAB-AA v1.1's headline rate depends on which model upholds a "material hallucination" (about 8× between Sol and Sonnet 5.5). Any beep verifier that gates citations should name its checker and keep a public claim-level set beside the private gate.
   `bun run beep research capture https://artificialanalysis.ai/articles/harvey-lab-aa-v1-1 --tags law,harvey,benchmark,hallucination,lab-aa`
   `bun run beep research capture https://www.ai-primer.com/engineer/stories/harvey-hallucination-gated-benchmark --tags law,harvey,benchmark,hallucination,verifier`
   `bun run beep research capture https://arxiv.org/abs/2610.10971 --tags law,citation,hallucination,benchmark,arxiv`
2. **Do not bump past effect@4.0.2 without reading the unreleased main train.** DNS/TLSA, HTTP MCP subscription controls, OTel parent spans, JSON Schema integer bounds, and the cluster shutdown series are merged and not on npm.
   `bun run beep research capture https://github.com/Effect-TS/effect/pull/8880 --tags effect,net,dns,unreleased`
   `bun run beep research capture https://github.com/Effect-TS/effect/pull/8924 --tags effect,mcp,http,subscriptions`
   `bun run beep research capture https://github.com/Effect-TS/effect/pull/8941 --tags effect,cluster,shutdown,reliability`
   `bun run beep research capture https://github.com/Effect-TS/effect/pull/8956 --tags effect,schema,json-schema,mcp`
3. **Fail closed when a hook never starts.** Compare beep hook runners with Claude Code 2.1.295 `onFailure: "block"`.
   `bun run beep research capture https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md --tags agents,claude-code,hooks,mcp,security`
4. **Skill admission must hash bytecode caches and detect co-install overrides.**
   `bun run beep research capture https://arxiv.org/abs/2610.10612 --tags agents,skills,supply-chain,python,scanners`
   `bun run beep research capture https://arxiv.org/abs/2610.11647 --tags agents,skills,conflicts,coding-agents`
   `bun run beep research capture https://arxiv.org/abs/2610.11169 --tags agents,skills,supply-chain,github`

## Law / IP

5. `bun run beep research capture https://www.harvey.ai/blog/motion-to-dismiss-workflow-lexisnexis --tags law,harvey,lexisnexis,workflow,litigation`
6. `bun run beep research capture https://x.com/harvey/status/2108231639616930135 --tags law,harvey,memory,agents,wake-sleep`
7. `bun run beep research capture https://www.zenml.io/llmops-database/wake-sleep-memory-for-long-horizon-legal-agents --tags law,harvey,memory,agents,wake-sleep`
8. `bun run beep research capture https://www.theverge.com/ai-artificial-intelligence/1008198/usa-today-openai-copyright-lawsuit --tags law,copyright,openai,litigation,dmca`
9. `bun run beep research capture https://financetime.org/legal/legalindustry/law-firms-give-lawyers-time-off-billing-grind-test-drive-ai-2026-10-08 --tags law,adoption,billable-hours,training`
10. `bun run beep research capture https://arxiv.org/abs/2610.12361 --tags law,citation,interpretability,arxiv`

## Effect / local-first

11. `bun run beep research capture https://www.npmjs.com/package/@rocicorp/zero --tags effect,local-first,zero,release`
12. `bun run beep research capture https://techcrunch.com/2026/10/08/google-releases-a-new-local-first-granola-competitor/ --tags effect,local-first,on-device,google,embeddings`
13. `bun run beep research capture https://github.com/Effect-TS/effect/pull/8929 --tags effect,opentelemetry,tracing,rpc`

## Agents / skills / neural-symbolic

14. `bun run beep research capture https://github.com/openai/codex/releases/tag/rust-v0.162.0 --tags agents,codex,worktrees,tools`
15. `bun run beep research capture https://arxiv.org/abs/2610.11030 --tags agents,neural-symbolic,policy,tools,schema`
16. `bun run beep research capture https://arxiv.org/abs/2610.11725 --tags agents,specs,verification,coding-agents`
17. `bun run beep research capture https://arxiv.org/abs/2610.11768 --tags agents,ontology,industrial`
18. `bun run beep research capture https://arxiv.org/abs/2610.10961 --tags agents,review,coding-agents,contract`

## Holds (refutation attempted, standing claim unchanged)

19. `bun run beep research capture https://github.com/modelcontextprotocol/python-sdk/pull/3485 --tags agents,mcp,skills,sep-2640,hold`
20. `bun run beep research capture https://www.npmjs.com/package/jazz-tools --tags effect,local-first,jazz,hold`
21. `bun run beep research capture https://www.npmjs.com/package/@modelcontextprotocol/sdk --tags agents,mcp,security,oauth,hold`
22. `bun run beep research capture https://www.npmjs.com/package/@tanstack/db --tags effect,local-first,tanstack,hold`
