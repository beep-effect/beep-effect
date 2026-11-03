# Text.js Console UI — Sources & Provenance

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
-->

- **Cluster / origin:** the operator's link to `https://textjs.org/llms.txt`
  (2026-11-03) and the pages it indexes.
- **Provenance:** [`CAPTURE.md`](../CAPTURE.md); no research sweep or codex
  review yet.

## 1. Mined source corpus

Nothing mined yet. Research stage fills this in.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| https://github.com/anomalyco/textjs | MIT (`LICENSE` on branch `dev`, "Copyright (c) 2026 Anomaly", read 2026-11-03) | port-with-attribution | Undecided; reference only until research names a pattern |

## 3. External research sources

- Text.js `llms.txt` index — https://textjs.org/llms.txt (snapshot:
  [`../assets/textjs-llms-2026-11-03.txt`](../assets/textjs-llms-2026-11-03.txt))
- MCP for Coding Agents — https://textjs.org/docs/mcp
- Testing — https://textjs.org/docs/testing
- Running in a Terminal — https://textjs.org/docs/terminal
- The Turbolog Engine — https://textjs.org/docs/turbolog-engine
- Docs markdown source — `apps/web/src/docs/content/*.md` in the upstream repo

## 4. In-repo capability references

Not inventoried yet. Research stage fills this in.

## 5. Cross-links & provenance

- This packet: [`../README.md`](../README.md), [`../CAPTURE.md`](../CAPTURE.md).
