# P2 C0 relation-slate result

Date: 2026-08-30

Status: first vertical slice and three-paper relation extension passed; full-W1
R2 gate pending.

## Candidate and breaker accounting

The evidence-quote re-entry candidate was run unchanged over F1 plus each of
the three frozen G-relation papers. The candidate passed its first live probe
and the complete relation-paper extension. Its single retry remains unspent.

Each live command used the committed W1 manifest and the same model identity:

- extractor: Anthropic `claude-opus-4-6`
- gold proposer: xAI `grok-4.6`
- gold: `gold/v1`, digest
  `9321c57c92402fba398ff226a178d9bc2922bb48f116f892fd8584a44ad72f29`
- hosted artifact hash:
  `9d9530e8cef53088d23552cce31eb7aa6b90365e609960231fcbc7a370163071`

The provider environment was injected from the existing `op://`-backed env
file with `op run`; no secret value was printed or copied.

## First vertical slice

The slice selected F1 plus `057e356e94f8`. The live run emitted digest
`6610f2e23cc73348036d70e2f4ca24028feaddb343a0cea3769c2867abbeea94`.
The selected paper was parsed and extracted, produced 10 hosted relation
claims, and reported zero failed anchors and zero unexpected degradation.

The explicit replay-mode run emitted the same digest. Its
`eval-report.json` was byte-identical to the live report. The telemetry
sidecars correctly differed and identified their modes as `live` and
`replay`; telemetry remained outside the digest.

## Three-paper extension

| Paper | Hosted relations | Unexpected degradation | Failed anchors | Live/replay digest |
| --- | ---: | ---: | ---: | --- |
| `057e356e94f8` | 10 | 0 | 0 | `6610f2e23cc73348036d70e2f4ca24028feaddb343a0cea3769c2867abbeea94` |
| `05afbbf3e1e9` | 9 | 0 | 0 | `05521b122b001375b162cf7642243d0ea4f7e95898a14290fac5f3f8febe52b9` |
| `06c93f91ef3d` | 9 | 0 | 0 | `1bde32bf7b58aeb3dd568995f680e08115be407a08789ecfe9e14ae264110bf4` |

For every row, replay ran with `SEMANTICA_OFFLINE=true`, reproduced the live
digest, and emitted a byte-identical `eval-report.json`. Report schema checks
therefore establish selection coverage, verified anchors, complete hosted and
pattern metric coordinates, model identity, typed F1 degradation, and the
non-zero hosted-relation gate.

## Next gate

Passing the relation slate does not pass C0. The next boundary is the R2 gate:
all 25 W1 papers plus F1, live and then replay, with equal report digests and
zero unexpected W1 degradation. Extractor and Input verdicts remain unwritten
until that gate passes.
