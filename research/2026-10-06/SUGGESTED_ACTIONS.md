# SUGGESTED_ACTIONS — 2026-10-06

Proposals only. Human admits. Never auto-merge this research PR.

## High priority (time-sensitive / decision)
1. **USPTO SI roundtable RSVP deadline Oct 7** (Oct 15 Dallas, vendor market research) — decide whether beep/Tom-facing IP tooling should RSVP.
   `bun run beep research capture https://app.fedsift.app/solicitations/3bf5bdb6cb8e42d6ba58d8c0fab6f581 --tags law,uspto,procurement,roundtable`
2. **Legora Skills = productized SKILL.md for lawyers** — compare against beep skills surface (install-gated sharing, org publish permission, matter-scoped isolation).
   `bun run beep research capture https://legora.com/blog/introducing-skills --tags law,legora,skills,agents`
3. **Effect MCP toolkit typing fix** — check beep MCP hosts (uspto / gov-legal in mcp-kit) once effect@4.0.2 ships (#8744).
   `bun run beep research capture https://github.com/Effect-TS/effect/pull/8842 --tags effect,mcp,types,fix`
4. **MCP default-auth CVEs + Local Server Security guide** — audit beep MCP hosts' transports/bind addresses against the new guidance.
   `bun run beep research capture https://github.com/modelcontextprotocol/modelcontextprotocol/pull/3072 --tags agents,mcp,security,docs`
   `bun run beep research capture https://dev.to/kielltampubolon/mcp-servers-had-a-rough-48-hours-4-unauthenticated-cves-4oco --tags agents,mcp,security,cve`

## Law / IP
5. `bun run beep research capture https://conventuslaw.com/press-releases/netdocuments-connects-organizational-legal-knowledge-to-microsoft-copilot-through-mcp/ --tags law,netdocuments,mcp,copilot,dms`
6. `bun run beep research capture https://www.dwt.com/insights/2026/10/uspto-ai-patent-eligibility-guidance --tags law,uspto,101,ai-patents,smed`
7. `bun run beep research capture https://www.theamericancounsel.com/ross-plans-a-supreme-court-challenge-to-the-third-circuits-fair-use-ruling-in-thomson-reuters-v-ross-intelligence/ --tags law,copyright,fair-use,ross,thomson-reuters`
8. `bun run beep research capture https://pandektes.com/blog/pandektes-13-5m-series-a --tags law,pandektes,funding,legal-data,api`
9. Tom/solo foil: `bun run beep research capture https://www.einpresswire.com/article/946678994/esgenix-launches-self-serve-ai-patent-workflows-for-solo-practitioners-smaller-firms-and-inventors --tags law,patent,solo,esgenix`

## Effect / local-first
10. `bun run beep research capture https://github.com/Effect-TS/effect/releases/tag/effect%404.0.1 --tags effect,release,4.0.1,contradicted`
11. `bun run beep research capture https://github.com/TanStack/db/releases/tag/%40tanstack/db%400.12.0 --tags effect,tanstack-db,local-first,sync`
12. `bun run beep research capture https://github.com/Effect-TS/effect/pull/8853 --tags effect,agents,github-actions,maintainer-bot`

## Agents / skills
13. `bun run beep research capture https://arxiv.org/abs/2610.04832 --tags agents,skills,arxiv,coding-agents`
14. `bun run beep research capture https://arxiv.org/abs/2610.05943 --tags agents,skills,security,arxiv`
15. `bun run beep research capture https://arxiv.org/abs/2610.06193 --tags agents,coding-agents,governance,arxiv`
16. `bun run beep research capture https://arxiv.org/abs/2610.05777 --tags agents,skills,ontology,arxiv`
17. `bun run beep research capture https://arxiv.org/abs/2610.04779 --tags agents,coding-agents,merge,arxiv`

## Ledger / process (no capture)
- Tombstones (15) and the watchlist edits land with this PR on admit (`research/ledger/tombstones/2026-10-06.jsonl` and `research/ledger/WATCHLIST.md`); then retire `w-effect-410-staging`, `w-jazz-alpha-58`, `w-evolu-8170`.
- **Tombstone-leak fix:** prelude should hard-drop tombstoned URLs from refute candidates (5 leaked across 09-30/10-02/10-03).
- **X enrollment** still blocks the social pool (client-not-enrolled) — attach the connector app to an X Project.
