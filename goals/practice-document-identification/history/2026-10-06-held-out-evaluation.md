# Held-out evaluation — 2026-10-06

Counts only. Produced by `practice-identify evaluate` on the private data
(ground truth: the documents the attorney filed in his own client folders,
4,904 documents with text across 11 clients). The split is
`sha256(salt | contentHash) mod 5 = 0`; filters are fitted on the training
side only; the identical-copy signal is off while scoring.

## Pass-3 split (`--split-salt pass3`, train 3,891 / test 1,013)

| Tier | Resolved | Right | Wrong | Precision | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: |
| identified | 449 | 448 | 1 | 99.8% | 44.3% |
| identified-content | 51 | 51 | 0 | 100% | 5.0% |
| candidate | 194 | 194 | 0 | 100% | 19.2% |
| ambiguous / unknown | 319 | — | — | — | 31.5% |

These reproduce the pass-3 numbers computed outside the repository on the same
split (identified 449 / 448 / 1, identified-content 51 / 51). The candidate
tier is broader than pass 3's (pass 3 reported 17 / 18 at a stricter rule);
the 17 documents pass 3 left unknown that the tool now calls candidates were
all right.

## Default split (`--split-salt holdout`, train 3,914 / test 990)

| Tier | Resolved | Right | Wrong | Precision | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: |
| identified | 431 | 430 | 1 | 99.8% | 43.5% |
| identified-content | 6 | 6 | 0 | 100% | 0.6% |
| candidate | 220 | 220 | 0 | 100% | 22.2% |
| ambiguous / unknown | 333 | — | — | — | 33.6% |

## Index

- 72 clients, 846 (client, docket) pairs, 595 contacts. The pairs count
  matches pass 2 after the docket stage list gained the codes the attorney's
  own folders and email subjects use (D13); before that the index dropped 12
  pairs.
- Both splits were re-run after D13 with identical results.

## Reading the numbers

- The one wrong `identified` document on each split is a run-1 attribution
  the document's own reference contradicts (see D3).
- `identified-content` on the default split is small because that split
  holds out few documents with critic-confirmed extractions; the pass-3 split
  is the one the extraction batches were sized for.
- Coverage is of the test side only; unresolved documents stay where they are.
