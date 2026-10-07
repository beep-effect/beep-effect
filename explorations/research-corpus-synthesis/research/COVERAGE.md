# Final corpus coverage and reading boundary

The original intake denominator remains **143 files, 142 parsed documents,
5,389 occurrences and 1,175 source identities**. The empty `.gitkeep` is accounted
as an opaque non-content file. Every original parsed document was body-read;
419 nightly claims, 1,217 Markdown sections and 107 supplemental ledger rows
have explicit reading and routing records. A mechanical validator reconstructs
those units from preserved originals and checks hashes and coverage; it does not
substitute for the readers' work.

Gap-bound investigations added one 13-line discovery document and seven sources.
The current collection therefore contains **144 files, 143 parsed documents,
5,396 occurrences and 1,182 source identities**. Original and supplemental
coverage are never collapsed into a claim that more original reports were read.

## Current source accounting

The maintained strict verifier and status command agree on the following source
categories after the human reviews of three gated article excerpts. Capture
history remains intact; the newest valid evidence or review for each requested
revision determines its current disposition. Version-specific reviews cannot
silently change another cited version.

| Category | Sources |
| --- | ---: |
| Readable | 989 |
| Unavailable | 7 |
| Ambiguous | 2 |
| Incomplete | 32 |
| Tool-blocked | 16 |
| Internal | 56 |
| Operational | 12 |
| Non-reference | 68 |
| **Total** | **1,182** |

Missing references and integrity failures are both zero. All seven required
acquisition routes retain verified actual probes. There are 1,002 readable
source/version obligations; this is a separate denominator from source identity.
The verifier's legacy `unavailable=75` headline includes internal and operational
references; only seven sources have an unavailable disposition.

The 32 incomplete sources comprise 27 X references without complete original
post bodies, two bounded GitHub listings and three gated article excerpts.
Grok workflow and X Search execution are proven; that execution does not supply
missing post text. Incomplete, blocked and ambiguous sources cannot support an
affirmative conclusion about their unread content.

## Reading and relationships

[`source-ledger.jsonl`](source-ledger.jsonl) has exactly one row per current source
identity. Each row links its local library card, every citing document, related
finding IDs, and the original reader ledger/line. The 1,192 reading reviews include
ten additional reviews of sources owned by another reader. Their categories are
939 background-not-deep-read, 123 non-evidence, 67 unread-gap, 35 context-read and
28 deep-read. These are **review counts, not unique source counts**. Read ranges,
retained hashes, and limitations remain in the underlying rows. “Deep-read” means
the recorded substantive evidence was inspected; consult the exact ranges before
assuming a complete paper or repository was read.

Acquisition of 989 readable sources is not a claim that every source body was
fully read. Background sources have explicit relevance/reading dispositions.
Evidence carrying substantive conclusions received deeper inspection, with
source assertions separated from observed behavior and proposed experiments.

All 461 findings have a final disposition in [`routing.jsonl`](routing.jsonl).
The 107 parent ledger rows retain their original identifiers; 84 have exact-locator
links to related findings. Shared source identity establishes a relationship,
not claim equivalence. The remaining rows retain explicit parent dispositions.
No nightly packet or its single-writer ledger was modified.

## Reproduction and retained receipts

Run the maintained CLI from the repository:

```sh
bun run beep research library verify
bun run beep research library status
bun run beep research library render
```

The external library's `ops/session-evidence/2026-10-06/phase2/` preserves the
synthesis validators, frozen input census, source-ledger generator, final
verification and navigation receipts, and acquisition investigation provenance.
The validator checks original denominators and supplemental discoveries
separately. Its successful result is evidence of reconciliation, not an
independent replication of source claims.

The catalog SHA-256 at this checkpoint is
`f2eb5ea7784ea1e76ac2266b8fea2d71a58e0284ac1b7217d0f8bacbcb66e928`.
Publication and merge proof are distinct from this local coverage checkpoint.
