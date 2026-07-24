# <Exploration Title> — Sources & Provenance

<!--
The provenance ledger for this packet. Start it in the `research` stage and keep
it current through graduate; the graduated goal inherits a copy. Purpose: let an
implementing agent trace every decision back to its origin — a mined source
(repo + file:line), an upstream repo + LICENSE, an external citation, or an
in-repo brick.

RULES
- Never fabricate a URL/DOI/repo link. Reproduce only sources that actually
  appear on disk in RESEARCH.md / research/*.md; if a claim has no on-disk URL,
  cite the RESEARCH.md section that carries it instead.
- Licenses are load-bearing: copyleft (AGPL/GPL/MPL) upstream is CLEAN-ROOM
  reimplement only (pattern, not vendored code); permissive (MIT/Apache/BSD) may
  be ported WITH attribution; missing/unverified LICENSE ⇒ treat as reference
  only. State the discipline per repo.
- Register this file in ops/manifest.json `exploration.sources`.
- Drop a section that genuinely does not apply (e.g. §1/§2 for a greenfield idea
  with no mined corpus) — but keep §3–§5.
-->

- **Cluster / origin:** <where these sources came from — a research sweep, a
  referenced repo, an intake corpus, etc.>
- **Provenance:** <links to any upstream catalog/synthesis; the packet codex
  review under `reviews/` if present>

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `<id>` | <what it is> | <repo> | `<path:line>` | <theme> | port / clean-room / reference |

**How these inform this packet:** <1–2 lines per sub-area — the pattern to take
vs leave; quote a load-bearing snippet only where it carries a concrete contract.>

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| <repo> | <SPDX> | clean-room / port-with-attribution / reference-only | <pattern> |

## 3. External research sources

<!-- Titles + URLs that ACTUALLY appear in RESEARCH.md / research/*.md. If none
have URLs, list the in-repo RESEARCH sections that carry the claims. -->

## 4. In-repo capability references

<!-- The @beep/* bricks this packet composes, each with its package path,
marked reuse / extend / NET-NEW. -->

## 5. Cross-links & provenance

<!-- exploration <-> goal / sibling links; this packet's own RESEARCH.md +
DECISIONS.md; codex review(s); any upstream synthesis section. -->
