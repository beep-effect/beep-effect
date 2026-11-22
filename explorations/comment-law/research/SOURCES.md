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

Every external source the external lane read, with its URL. Reading level, claim and effect sizes are in the lane report.

| URL | Cited in |
| --- | --- |
| https://arxiv.org/abs/2404.03114 | [lanes/external.md](./lanes/external.md) |
| https://arxiv.org/abs/2506.11007 | [lanes/external.md](./lanes/external.md) |
| https://arxiv.org/abs/2504.14119 | [lanes/external.md](./lanes/external.md) |
| https://arxiv.org/abs/2601.23059 | [lanes/external.md](./lanes/external.md) |
| https://arxiv.org/abs/2609.09242 | [lanes/external.md](./lanes/external.md) |
| https://arxiv.org/abs/2512.16790 | [lanes/external.md](./lanes/external.md) |
| https://neurips.cc/virtual/2026/176319 | [lanes/external.md](./lanes/external.md) |
| https://arxiv.org/abs/2606.01326 | [lanes/external.md](./lanes/external.md) |
| https://arxiv.org/abs/2605.20049 | [lanes/external.md](./lanes/external.md) |
| https://arxiv.org/abs/2507.05289 | [lanes/external.md](./lanes/external.md) |
| https://arxiv.org/abs/2609.31587 | [lanes/external.md](./lanes/external.md) |
| https://arxiv.org/abs/2503.15231 | [lanes/external.md](./lanes/external.md) |
| https://arxiv.org/abs/2406.14836 | [lanes/external.md](./lanes/external.md) |
| https://dev.to/newellpaul/comments-considered-harmful-3oc2 | [lanes/external.md](./lanes/external.md) |
| https://neverworkintheory.org/2021/09/06/commenting-source-code.html | [lanes/external.md](./lanes/external.md) |
| https://jacobkrueger.github.io/assets/papers/Nielebock2019Comments.pdf | [lanes/external.md](./lanes/external.md) |
| https://web.archive.org/web/2020id_/http://www.inf.usi.ch/lanza/Downloads/Wen2019a.pdf | [lanes/external.md](./lanes/external.md) |
| https://www.cs.mcgill.ca/~martin/papers/ase2017.pdf | [lanes/external.md](./lanes/external.md) |
| https://arxiv.org/abs/2608.03734 | [lanes/external.md](./lanes/external.md) |
| https://arxiv.org/abs/2010.01625 | [lanes/external.md](./lanes/external.md) |
| https://arxiv.org/abs/2512.19883 | [lanes/external.md](./lanes/external.md) |
| https://arxiv.org/abs/2409.10781 | [lanes/external.md](./lanes/external.md) |
| https://arxiv.org/abs/1901.07440 | [lanes/external.md](./lanes/external.md) |
| https://arxiv.org/abs/2205.13872 | [lanes/external.md](./lanes/external.md) |
| https://arxiv.org/abs/2101.03730 | [lanes/external.md](./lanes/external.md) |
| https://aserebre.win.tue.nl/MSR2018-Fiorella.pdf | [lanes/external.md](./lanes/external.md) |
| https://arxiv.org/abs/2007.01568 | [lanes/external.md](./lanes/external.md) |
| https://arxiv.org/abs/2003.09418 | [lanes/external.md](./lanes/external.md) |
| https://arxiv.org/abs/2601.07786 | [lanes/external.md](./lanes/external.md) |
| https://arxiv.org/abs/2603.28592 | [lanes/external.md](./lanes/external.md) |
| https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions | [lanes/external.md](./lanes/external.md) |
| https://research.jku.at/en/publications/using-architecture-decision-records-in-open-source-projects-an-ms/ | [lanes/external.md](./lanes/external.md) |
| https://arxiv.org/abs/2608.20195 | [lanes/external.md](./lanes/external.md) |
| https://www.oreilly.com/radar/coding-agents-love-decision-records/ | [lanes/external.md](./lanes/external.md) |
| https://arxiv.org/html/2602.07609v1 | [lanes/external.md](./lanes/external.md) |
| https://arxiv.org/abs/2604.10345 | [lanes/external.md](./lanes/external.md) |
| https://arxiv.org/abs/2603.15566 | [lanes/external.md](./lanes/external.md) |
| https://github.com/adr/e-adr | [lanes/external.md](./lanes/external.md) |
| https://cdn.jsdelivr.net/npm/archgate@0.48.1/README.md | [lanes/external.md](./lanes/external.md) |
| https://github.com/code-yeongyu/go-claude-code-comment-checker | [lanes/external.md](./lanes/external.md) |
| https://gitlab.com/gitlab-org/orbit/knowledge-graph/-/merge_requests/75 | [lanes/external.md](./lanes/external.md) |
| https://dev.to/juliantellez/the-comments-are-not-for-you-1jp | [lanes/external.md](./lanes/external.md) |
| https://github.com/biomejs/biome/issues/10474 | [lanes/external.md](./lanes/external.md) |
| https://oxc.rs/docs/guide/usage/linter/js-plugins | [lanes/external.md](./lanes/external.md) |
| https://phenomnomnominal.github.io/betterer/docs/results-file/ | [lanes/external.md](./lanes/external.md) |
| https://eslint.org/docs/latest/use/suppressions | [lanes/external.md](./lanes/external.md) |

## 4. In-repo capability references

Listed in [`RESEARCH.md`](../RESEARCH.md), In-Repo Capability Inventory.

## 5. Cross-links & provenance

Lane reports: [adr](./lanes/adr.md), [consumers](./lanes/consumers.md), [external](./lanes/external.md),
[lint](./lanes/lint.md), [ratchet](./lanes/ratchet.md), [skill](./lanes/skill.md).
