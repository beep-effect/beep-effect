# Ready-to-fire prompts — 2026-09-22

## 1) Effect rc.117 + path migration spike

```
Beep Effect kits: tip is effect@4.0.0-rc.117 (rc.116 shipped Sep 18 via #8201;
#8336 stages rc.118). SchemaJIT #7908 merged; #8354 removed effect/unstable/*
compat paths; #8365 renamed effect/httpapi → effect/http-api. Draft a migration
checklist for beep HttpApi + schema consumers: import remaps, @unstable markers,
whether to pin rc.117 now vs wait for rc.118, and smoke tests for MCP 2026-07-28
adapter (#7265) now that it is on published RCs. Do not edit explorations/INBOX
or goals/.
```

## 2) Astra for Law competitor memo delta

```
Update the Tom / legal-AI competitive frame with OpenAI Astra for Law (Sep 17):
GPT-6 Astra legal config, Free Law Project search index, 26 plugins naming Harvey,
Legora, iManage, TR, DeepJudge, Intapp. Contrast with Claude for Legal and with
beep's Effect/schema-first + local-first matter ambitions. Keep Patlytics as IP-MCP
foil. Capture-ready URLs already in research/2026-09-22/SUGGESTED_ACTIONS.md.
```

## 3) MCP authorization-drift watch (RAC × IntentCap)

```
Read arXiv 2609.23498 (RAC) against standing watches IntentCap (2609.14631),
Stochastic Deputy (2609.14780), ACLE-MCP / SEP-3004 (now CLOSED unmerged). Propose
3 concrete design constraints for matter-scoped legal MCP tools (tenant binding,
pre-commit lineage, fail-closed on purpose drift). SEP-2640 SDKs still OPEN —
note python#3485 conformance-green-but-unmerged.
```
