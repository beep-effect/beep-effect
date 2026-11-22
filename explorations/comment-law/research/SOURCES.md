# Comment Law — Sources & Provenance

- **Cluster / origin:** a full census of this repository at `a1b08269809`, six research lanes with refutation passes, and a web sweep on 2026-11-21.
- **Provenance:** lane reports in [`lanes/`](./lanes/), rubric in [`rubric.md`](./rubric.md), draft skill in [`drafts/delete-comment/`](./drafts/delete-comment/SKILL.md).

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `census` | 100,821 comment groups | this repo | `~/.local/state/beep/comment-law/2026-11-21/` | measurement | reference (outside the repo) |
| `ledger` | 33,113 coded comments, full and sampled | this repo | `~/.local/state/beep/comment-law/2026-11-21/ledger.full.tsv.gz` | classification | reference (outside the repo) |

**How these inform this packet:** the ledger is an input to the first sweep, not its verdict. Labels hold at the rates in RESEARCH.md, so every deletion re-verifies.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| eslint-plugin-no-comments, eslint-plugin-ban-comments | MIT | reference-only | the allow-list idea |
| eslint-plugin-unicorn | MIT | reference-only | condition-dated TODO idea |
| betterer | MIT | reference-only | content-hash ratchet entries |
| SonarJS | source-available | reference-only, no code | commented-out-code detection idea |
| MADR templates | MIT OR CC0-1.0 | reference-only | ADR shape |
| adr-tools | GPL-3.0-or-later | clean-room only | nothing yet |

Licences are as read in [`lanes/external.md`](./lanes/external.md), section 11.

## 3. External research sources

Every URL and its reading level is in [`lanes/external.md`](./lanes/external.md).

## 4. In-repo capability references

Listed in [`RESEARCH.md`](../RESEARCH.md), In-Repo Capability Inventory.

## 5. Cross-links & provenance

Lane reports: [adr](./lanes/adr.md), [consumers](./lanes/consumers.md), [external](./lanes/external.md),
[lint](./lanes/lint.md), [ratchet](./lanes/ratchet.md), [skill](./lanes/skill.md).
