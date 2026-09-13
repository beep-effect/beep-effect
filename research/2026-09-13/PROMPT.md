# PROMPT — 2026-09-13 nightly kickoffs

Ready-to-fire. Human admits. Do not auto-append to explorations/INBOX.md or goals/.

## 1) SEP-2640 Final-on-branch ≠ shipped
Babysit merge of modelcontextprotocol#2640 (Status=Final, still OPEN). Pair with Tier-1 SDK PRs (go/python/csharp) + docs#3353.
```
bun run beep research capture https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2640 --tags agents,mcp,skills,sep-2640
```

## 2) Effect rc.116 / MCP adapter publish
When #8201 merges / effect@4.0.0-rc.116 hits npm, re-pin MCP toolkit. Until then tip is rc.115 without #7265.
```
bun run beep research capture https://github.com/Effect-TS/effect/pull/8201 --tags effect,rc116,mcp
```

## 3) Jazz tip alpha.54 / alpha.55 staged; Evolu tip 8.10.0 / 8.11.0 staged
```
bun run beep research capture https://github.com/garden-co/jazz/pull/2748 --tags jazz,local-first,alpha-55
bun run beep research capture https://github.com/evoluhq/evolu/pull/708 --tags evolu,local-first
```

## 4) IP MCP rising edge (in-window GitHub)
```
bun run beep research capture https://github.com/blazingbunny/patent-kb-connect --tags law,patent,mcp,github
bun run beep research capture https://github.com/73882/feature-separate-batch-eval-mcp --tags law,patent,mcp,eval
```

## 5) Scanners-as-skills
```
bun run beep research capture https://github.com/Shubhamsaboo/awesome-llm-apps/pull/1167 --tags agents,skills,security
bun run beep research capture https://github.com/truefoundry/awesome-skills-registry/pull/23 --tags agents,skills,scanner
```
