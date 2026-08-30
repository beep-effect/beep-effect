# Todox Marketing Site — Sources & Provenance

Inherited at graduation 2026-08-27 from the source exploration. The
exploration's ledger is the primary copy; this file reproduces what the
implementing agent needs and never restates claim content.

- **Source exploration:** `explorations/todox-wealth-management-site` —
  primary ledger:
  [`explorations/todox-wealth-management-site/research/SOURCES.md`](../../../explorations/todox-wealth-management-site/research/SOURCES.md).
- **Provenance:** machine ledgers in the exploration:
  [`SOURCE-MANIFEST.json`](../../../explorations/todox-wealth-management-site/research/SOURCE-MANIFEST.json)
  (91 promoted source records with access, tier, visibility, restrictions) and
  [`CLAIMS.jsonl`](../../../explorations/todox-wealth-management-site/research/CLAIMS.jsonl)
  (40 atomic claims; 15 `publicEligible`). Raw scrape custody stays in the
  gitignored `.firecrawl/todox-wealth-management-site/` tree and never enters
  this packet.

## 1. Mined source corpus

No upstream code is mined or ported by this goal. The corpus is research
provenance, not an implementation source; the build composes repo bricks and
authors original assets.

| Source | Title | Upstream (repo) | Location | Theme | Disposition |
|--------|-------|-----------------|----------|-------|-------------|
| — | none (no code mining) | — | — | — | — |

**How the corpus informs implementation:** copy comes only through
[`PUBLIC-COPY.md`](../../../explorations/todox-wealth-management-site/research/PUBLIC-COPY.md)
(claim-reconciled); demo content only through
[`DEMO-SCRIPT.md`](../../../explorations/todox-wealth-management-site/research/DEMO-SCRIPT.md);
visual references in
[`VISUAL-INSPIRATION.md`](../../../explorations/todox-wealth-management-site/research/VISUAL-INSPIRATION.md)
are observation-only with explicit no-clone boundaries.

## 2. Upstream repositories & licenses

None. No third-party repository is vendored, ported, or clean-roomed.
Typefaces are the only external material: candidates and license rules live in
[`ASSET-PLAN.md`](../../../explorations/todox-wealth-management-site/research/ASSET-PLAN.md);
each chosen face's license (expected OFL) is verified and recorded before
ship. Reference-corpus fonts, screenshots, palettes, prose, and compositions
are not production assets.

## 3. External research sources

All external citations (account, competitor, interview, regulatory, and
visual sources) live in the exploration's `SOURCES.md` and
`SOURCE-MANIFEST.json` with per-source visibility and restrictions. None is
public-copy clearance by itself; public copy resolves through `CLAIMS.jsonl`
records with `publicEligible: true` plus their caveats. Sales-only material
(`ACCOUNT-BRIEFS.md`, competitor matrices) must not leak into the site.

## 4. In-repo capability references

| Brick | Path | Use |
|-------|------|-----|
| App shell | `apps/todox` | reuse — implementation target (Next.js, portless dev script) |
| Product truth | `apps/todox/PRODUCT.md` | reuse — binding product record (confirmed 2026-08-27) |
| Synthetic fixture | `goals/agentic-professional-runtime/fixtures/runtime-data-loop/wealth-cash-request` | reuse — the deterministic session's canonical records |
| Runtime contract | `goals/agentic-professional-runtime/SPEC.md` | reference — mechanism truth behind the copy |
| Impeccable workflow | `.claude/skills/impeccable/` | reuse — direction contract, detector, finish reviewer, documenter |
| Recorded browser QA | `browser-qa-loop` skill + `bun run beep qa` | reuse — gesture evidence for the record inspector |
| Quality path | `bun run beep yeet` | reuse — P3 publication (deferred until explicit go) |
| Visual system | none (no DESIGN.md yet) | NET-NEW — built by this goal, documented at finish |
| Original assets | none | NET-NEW — per ASSET-PLAN, authored SVG/CSS + licensed faces |

## 5. Cross-links & provenance

- Goal ↔ exploration: this manifest's `provenance.exploration` points at
  `explorations/todox-wealth-management-site`; the exploration manifest's
  `links.goals` lists this packet.
- Decision history:
  [`DECISIONS.md`](../../../explorations/todox-wealth-management-site/DECISIONS.md)
  (seeded into `SPEC.md`'s decision log).
- Confirmed direction:
  [`SHAPE-BRIEF.md`](../../../explorations/todox-wealth-management-site/research/SHAPE-BRIEF.md)
  (Terminal of Record, seed `9ce5e740`, alternates on record).
- Decompose review artifact:
  <https://claude.ai/code/artifact/8c7c7e46-5ff9-4e17-9396-e1399c0228b9>.
