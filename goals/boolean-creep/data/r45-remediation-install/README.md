# R45 reviewed remediation install

This installs four independently reviewed R45 corrections after the
historical partial closeout (`79ee8264ae`, bindings repaired at `2f8e603b28`).
The parent timing ruling in `parent-timing-ruling.json` moves install timing
from "after full R45 composition", which can no longer happen, to now. It
changes no contract, review verdict, acceptance, record id or status.

| Finding | Record | Design sha256 | Inventory |
|---|---|---|---|
| CAP-1 | `color-support-level-flags` | `57cdde407a66` → `15e246de4d97` | row 43: cardinality, notes |
| CAP-2 | `r2-foundation-unique-match-search` | `0998085f931e` → `58e3513ccfce` | row 339: line, members, notes, symbol |
| AM-3 | `r3-foundation-invariant-enforcement-channels` | `e160fc888b39` → `a8db521173fe` | design only |
| DAF-2 | `duckdb-transaction-began-closed` | `8b0bab86da53` → `101e8efa4f25` | design only |

Each design is the exact reviewed candidate. The two inventory rows are the
exact reviewed `proposal` objects, serialized like every other row. All other
inventory rows are byte-identical. Counts stay 726 / 108 / 618 / zero applied.

Inventory `503206b01752` → `c607c64ce9c9`. The originals are archived
byte-identical:

- inventory: `history/inventory/2026-09-29-pre-r45-remediation-install.jsonl`
- designs: `history/designs/2026-09-29-pre-r45-remediation-install/`

## Historical binding relocation

The R45 round verdict bound the live `data/inventory.jsonl` at `503206b01752`.
That binding now names the archived snapshot, whose bytes and sha256 are
unchanged. This is the only verdict change (one line): verdict `471bd698aae8` →
`631b25f2fd57`. Details are in `verdict-binding-relocation.json`. Older rounds
that bind live paths are historical and were not rewritten; their bytes remain
recoverable by hash from the history archives.

## Limits

No census, current-source coverage, dry-round, P3 or implementation credit.
Main `f590617f15` superseded the R45 source; a fresh full census is still
required.
Reviews, acceptances, candidate manifests and patches stay private and are
bound by sha256 in `install-receipt.json`.
