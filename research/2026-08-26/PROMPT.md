# PROMPT — 2026-08-26

Ready-to-fire kickoffs. Pick one. Do not auto-append to explorations/INBOX.md or goals/.

## A. USPTO ODP auth + OA path (blocks prosecution-read)

Read `uspto-prosecution-read` and `uspto-ptmnfee2-ingest`. Confirm whether the workstation ODP key still works after the 2026-08-18 profile-field gate. Hit `https://api.uspto.gov/api/v1/patent/oa/` for one 12-series public OA. Record the petition `includeDocuments` 500 as a friction, not a retry loop. Capture:

```sh
bun run beep research capture https://data.uspto.gov/apis/office-action-retrieval/search --tags law,uspto,office-action,odp
```

## B. Effect SchemaBinary vs open effect-drizzle #852

Read Effect rc.112 + #7461 (MessagePack removed) and drizzle-orm#6162 (`TaggedErrorClass`). On #852, check whether the kit still imports the old name. If yes, the next drizzle-kit slice should pin the rename. Capture:

```sh
bun run beep research capture https://github.com/Effect-TS/effect/releases/tag/effect%404.0.0-rc.112 --tags effect,effect-v4,schema,rpc
bun run beep research capture https://github.com/drizzle-team/drizzle-orm/issues/6162 --tags effect,drizzle,effect-v4
```

## C. Skills-over-MCP fork + semantica C0 park

Read MCP experimental-ext-skills PR #120 (Agent Plugins disk vs SEP-2640 wire) and TrustShiftProbe (2608.23763) before un-parking #853. Decide whether semantica MCP providers need a trust-window / N-call honesty check, not just install-time skill scan. Capture:

```sh
bun run beep research capture https://github.com/modelcontextprotocol/experimental-ext-skills/pull/120 --tags agents,mcp,skills,sep-2640
bun run beep research capture https://arxiv.org/abs/2608.23763 --tags agents,mcp,security,trustshift
```

## D. Competitor legal models (eval gold)

Thomson 1.0 + CoCounsel Verify vs Harvey Tenet. If `effect-native-legal-eval` wants an external baseline, these two plus Dis2Pat (2608.21249) are the week's comparable artifacts.

```sh
bun run beep research capture https://www.lawnext.com/2026/08/thomson-reuters-launches-thomson-its-own-proprietary-llm-trained-on-westlaw-and-practical-law-content.html --tags law,cocounsel,thomson,competitor
bun run beep research capture https://www.law.com/legaltechnews/2026/08/20/harvey-introduces-tenet-its-first-post-trained-ai-model-for-legal-/ --tags law,harvey,tenet,competitor
bun run beep research capture https://arxiv.org/abs/2608.21249 --tags law,patent-drafting,benchmark,arxiv
```
