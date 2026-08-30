# PROMPT — 2026-08-28

Ready-to-fire kickoffs. Pick one. Do not auto-append to explorations/INBOX.md or goals/.

## A. Capture Daydreaming (threat note; do not implement a steal)

Read `skill-contract-kernel`, `mcp-kit`, and parked #853. Daydreaming (arXiv 2608.26733) reconstructs a multi-file hosted skill from ordinary task results at Output-level (final answer only): 86.8% capability, median 32 victim calls, ~4× SigLeak, with disclosure defenses on. Names Harvey as Skill-as-a-Service. Hiding `SKILL.md` is not a confidentiality story. Capture as a threat note for the skill contract and any long-lived MCP provider; do not implement a steal.

```sh
bun run beep research capture https://arxiv.org/abs/2608.26733 --tags agents,skills,security,daydreaming,arxiv
```

## B. iManage MCP write-back as competitor foil (do not implement iManage)

Read `gov-legal-mcp`, `practice-kg-mcp`, and `uspto-mcp`. iManage next-gen GA is October 2026; MCP already creates workspaces/folders, files, moves, and links, and lands AI work product in the governed record. Clarra (120 tools / 250 endpoints), Bloomberg Law Claude MCP, and Gemini Enterprise for Legal's 13+ permission-bound connectors are the same race from the system-of-record side. Treat as competitor foil; do not implement iManage.

```sh
bun run beep research capture https://www.lawnext.com/2026/08/imanage-announces-general-availability-of-its-next-generation-platform-enabling-organizations-to-scale-ai-reliably.html --tags law,imanage,mcp,dms,competitor
bun run beep research capture https://www.prnewswire.com/news-releases/clarra-introduces-the-most-comprehensive-mcp-server-for-legal-case-management-302854675.html --tags law,clarra,mcp,docketing,competitor
bun run beep research capture https://cloud.google.com/blog/products/ai-machine-learning/introducing-gemini-enterprise-for-legal/ --tags law,gemini,mcp,google,competitor
```

## C. Audit beep MCP success schemas against Effect #7495

Effect #7495 stops null/arrays going into MCP `structuredContent` (`typeof encodedResult === "object"` is true for both). Encoded success must be a JSON object or `structuredContent` stays undefined. Audit beep MCP success schemas (`mcp-kit` / `gov-legal-mcp` / `uspto-mcp`). Do not pin SchemaBinary as a cluster transport until an RC includes #7506/#7507/#7508.

```sh
bun run beep research capture https://github.com/Effect-TS/effect/pull/7495 --tags effect,effect-v4,mcp,tools
bun run beep research capture https://github.com/Effect-TS/effect/pull/7508 --tags effect,effect-v4,schemabinary,codec
```

## D. Confirm USPTO ODP four profile fields

Standing 2026-08-26 f-law-05 still holds. Confirm Job Title / Organization Name / Organization Type / Intended Use remain mandatory after 2026-08-18 (cannot be set via API; keys revoke if missing). Keep petition `includeDocuments=true` off the critical path — it still 500s for every record 2004–2026. OA path is `api.uspto.gov/api/v1/patent/oa/` and keyed.

```sh
bun run beep research capture https://patent.dev/heads-up-complete-your-uspto-profile-by-august-18/ --tags law,uspto,odp,refute
```
