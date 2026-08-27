# P2 C0 probe-breaker result

Date: 2026-08-26

## Outcome

C0 did not pass. The Extraction family exhausted its first probe and single
retry on the frozen relation-paper slate. The first candidate failed on
`06c93f91ef3d`; its retry failed the same paper. Review then found that the two
earlier apparent passes had accepted first-occurrence anchors for repeated
entity surfaces. The shared aligner now rejects ambiguous exact and
case-folded matches, and no C0 vertical slice remains accepted. S1 therefore
parks Extraction and routes the exploration back to `decompose`.

The full-W1 R2 gate was not run. Input remains `park-pending-canary`, and C1
and C2 did not start.

## Superseded diagnostic slices

The first hosted candidate used Anthropic `claude-opus-4-6` with extraction
artifact hash
`037cb4d7aebc54ef0839acbe6c51b55f63cf92c33c4b9d561c113c4f27453e68`.

| Paper | Historical live/replay digest | Hosted relations | Verified anchors | Failed anchors | Unexpected degradation |
| --- | --- | ---: | ---: | ---: | ---: |
| `057e356e94f8` | `23875bd24a70379b17795b0070368d7931c8090c28cbacdaa0a28bceb9208c55` | 6 | 938 | 0 | 0 |
| `05afbbf3e1e9` | `041a48900febe51c005784ac1dcda98750afdca8d5deab0d2e13a417c57e8399` | 1 | 1180 | 0 | 0 |

Each paper ran through the official `canary c0` entry live and then with
`--offline`; each pair produced the same digest under the pre-review aligner.
These rows are diagnostic history, not passing evidence. That aligner assigned
every repeated candidate surface to its first occurrence. For the first paper,
the cached response contained 6 uniquely anchored relation texts, but none had
both endpoint entities grounded at a unique source occurrence. The apparent
relation claims therefore depended on ambiguous entity anchors and cannot
satisfy the canonical-span gate.

## Breaker evidence

The first candidate's response for `06c93f91ef3d` was stored under provider
cache key
`5737b31d6d5095afeb0123f9feb8d6e3197f8a284b94096928abce354a0c2955`.
It contained 118 candidates and 16 relation candidates, but none of the
relation texts was a verbatim canonical span. The cache-entry file SHA-256 was
`60f24303498f5eb7da176d5567218a2c2a46297943f964056a152627dd28bdf7`.
The run failed typed as `ReportInvalid`: selected relation-gold papers must
each have at least one hosted relation claim.

The single retry tightened the relation target so its evidence text had to be
a verbatim contiguous source span and its endpoint surfaces had to be copied
exactly. That produced extraction artifact hash
`32857d3b1b8140c432e11864028aba5f1f756559bc313562741c9f386ddac2bb`.
The retry response was stored under cache key
`6bbc2bb81a00c859ba81547fc2b04003671a0e6fd731fa9e4c9dbc6e624d3447`.
It contained 109 candidates and 7 relation candidates, but still no exact
canonical relation span. The cache-entry file SHA-256 was
`91d2370b9df25eab6b90a2c51dd042d367a14d2d4c45db7c1d4c4e4d852fd275`.
The retry failed with the same typed `ReportInvalid` gate.

## Review-closeout replay

The final aligner requires a unique exact or case-folded occurrence before it
emits a grounded span. Ambiguous candidates become typed `unaligned` results;
the lab retains them as `fabricated-span` degraded claims instead of assigning
the first occurrence.

The retry candidate was then run through the official `canary c0` entry on the
first frozen paper, `057e356e94f8`, live and with `--offline`. Its response is
stored under provider cache key
`0ac6007d473c64776b6cc3dbba277dd11096fa387b857381a9c98b2ba8c827e9`;
the cache-entry SHA-256 is
`daee245943ec699d92bbfd99c0c30729f7ea99afc41cd7a4c7ffebcbfb818e36`.
The response contained 172 candidates and 9 relation candidates, but no
relation text was an exact canonical span. Both live and replay runs failed
with the same typed `ReportInvalid` non-zero-relation gate. No `EvalReport`
digest is emitted for a schema-rejected report.

This is not another retry: it replays the already-consumed retry artifact on
the first paper to prove the final code cannot pass by relying on ambiguous
first-occurrence endpoints.

The provider moved from synthesized relation sentences to close copies of
source sentences, but it still normalized PDF line boundaries, punctuation,
or wording. Accepting those candidates would require fabricated or fuzzy
evidence and would violate the `TextAnchor` tripwire. Pattern-only is the
sheet's runner-up, but it declares relations unsupported and cannot satisfy
the non-zero G-relation gate.

## Re-entry questions

- Can a relation result carry an independently selected verbatim evidence span
  instead of overloading the relation's semantic text as its anchor?
- Would bounded, chunk-scoped relation extraction preserve exact PDF evidence
  without weakening the canonical-text contract?
- Can the relation schema enforce endpoint entities and evidence quotes before
  the provider response reaches alignment?

Any new candidate or contract change starts in the exploration at
`decompose`; this goal packet does not continue the candidate search.
