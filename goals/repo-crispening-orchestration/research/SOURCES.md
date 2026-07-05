# <Goal Title> — Sources & Provenance

<!--
The provenance ledger an implementing agent reads to trace every decision back to
its origin. Inherited from the source exploration at graduate (reproduce the
corpus here for implementation convenience AND link the exploration's ledger as
the primary copy). If this goal was authored directly (no exploration), build it
during P0 Research.

RULES
- Never fabricate a URL/DOI/repo link. Reproduce only sources that actually
  appear on disk (here, the exploration's RESEARCH/research, or this goal's
  research/*.md); otherwise cite the section that carries the claim.
- Licenses are load-bearing: copyleft (AGPL/GPL/MPL) upstream is CLEAN-ROOM
  reimplement only (pattern, not vendored code); permissive (MIT/Apache/BSD) may
  be ported WITH attribution; missing/unverified LICENSE ⇒ reference only.
- Registered in ops/manifest.json `researchReports[]` + `currentSourceOfTruth[]`;
  `provenance.exploration` ↔ source exploration `links.goals`.
-->

- **Source exploration:** `explorations/<slug>` — primary ledger:
  `explorations/<slug>/research/SOURCES.md`.
- **Provenance:** <upstream catalog/synthesis links; codex spec review under
  `research/` if present>

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `<id>` | <what it is> | <repo> | `<path:line>` | <theme> | port / clean-room / reference |

**How these inform implementation:** <1–2 lines per sub-area — the concrete
pattern the build should take vs leave.>

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| <repo> | <SPDX> | clean-room / port-with-attribution / reference-only | <pattern> |

## 3. External research sources

<!-- Titles + URLs that ACTUALLY appear on disk. Never invent. -->

## 4. In-repo capability references

<!-- The @beep/* bricks this goal composes, each with its package path, marked
reuse / extend / NET-NEW. -->

## 5. Cross-links & provenance

<!-- goal <-> source exploration / sibling links; SPEC.md decision log; codex
review(s); any upstream synthesis section. -->
