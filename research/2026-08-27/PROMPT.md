# PROMPT — 2026-08-27

Ready-to-fire kickoffs. Pick one. Do not auto-append to explorations/INBOX.md or goals/.

## A. Tenet numbers are harness-bound (eval gold)

Read yesterday's Harvey Tenet claim (`research/2026-08-26` f-law-04) against today's Fireworks numbers and Harvey's bash-vs-MCP footnote. If `effect-native-legal-eval` wants an external baseline, record the harness (bash/fs vs Mercor MCP/ReAct Archipelago) as a first-class field, not a footnote. Lexis Protégé's Shepard's-in-the-harness is the same pattern on the competitor side.

```sh
bun run beep research capture https://fireworks.ai/blog/post-training-kimi-k3-with-harvey-for-long-horizon-legal-work --tags law,harvey,tenet,eval,fireworks,competitor
bun run beep research capture https://www.harvey.ai/blog/post-training-update-harvey-tenet --tags law,harvey,tenet,harness,mcp,eval
bun run beep research capture https://www.lexisnexis.com/community/pressroom/b/news/posts/lexis-with-protege-accelerates-frictionless-agentic-productivity-from-first-idea-to-review-ready-legal-work-product --tags law,lexis,protege,harness,skills,competitor
```

## B. Evolu JsonValue codec vs Effect SchemaBinary

Read Effect rc.112 + #7461 (MessagePack removed) next to `@evolu/common@8.7.0` (`encodeJsonValue` / `decodeJsonValue`, msgpackr dropped). Decide whether beep local-first / EventLog paths should treat "schema-narrow codec, not generic msgpack" as the v4 default. drizzle-orm#6162 is still open on the rc.4 branch — #852 did not retire it.

```sh
bun run beep research capture https://github.com/evoluhq/evolu/releases/tag/%40evolu%2Fcommon%408.7.0 --tags effect,evolu,local-first,schema,codec
bun run beep research capture https://github.com/Effect-TS/effect/pull/7486 --tags effect,effect-v4,tools,streaming
bun run beep research capture https://github.com/drizzle-team/drizzle-orm/issues/6162 --tags effect,drizzle,effect-v4
```

## C. Clio judiciary + USPTO RPI identity

Read `uspto-prosecution-read` / `law-docketing-patent-spine` against the July 2026 RPI-for-reexam NPR (26 split comments). Separately: Clio's Arredondo hire (starts 2026-08-31) is the first big-house judiciary product line — relevant to `gov-legal-mcp` / court-facing surfaces.

```sh
bun run beep research capture https://ipwatchdog.com/2026/08/25/commenters-split-uspto-proposal-require-rpi-disclosure-reexams/ --tags law,uspto,reexam,rpi
bun run beep research capture https://www.law.com/legaltechnews/2026/08/25/clio-appoints-casetext-founder-pablo-arredondo-to-lead-judiciary-expansion/ --tags law,clio,casetext,judiciary,competitor
```

## D. Streaming tool safety + yeet watch

Read Effect #7486 (eager streamText handlers, incomplete-finish gate) before landing more yeet tool-loop work on #858. Same "do not run the side effect until the stream has moved past the call" rule.

```sh
bun run beep research capture https://github.com/Effect-TS/effect/pull/7486 --tags effect,effect-v4,tools,streaming
bun run beep research capture https://github.com/Effect-TS/effect/pull/7489 --tags effect,effect-v4,cluster
```
