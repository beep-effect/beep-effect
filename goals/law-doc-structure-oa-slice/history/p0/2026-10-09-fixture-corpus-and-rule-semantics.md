# P0 proposed corpus and rule semantics — frozen

Proposed family `uspto-oa-finality-ssp`, version `1`, is clean-room.
Source/license rows are in the packet's `research/SOURCES.md`. No production
regex implementation exists and no confidence prior is calibrated.

Replay on the same exact `SourceTextIdentity` must be byte-identical. A future
rule version appends an attempt linked to its predecessor and never rewrites
stored output. There is no migration of persisted outcomes; consumers select an
explicit family version. Source drift is a retained failed attempt, and a
re-anchor proves new raw slices separately. These semantics are frozen for v1.

Floors remain normative: emitted-pair precision 1.0 for seen and held-out
families; zero candidates and exact code for every closed fixture; seen-family
eligible-positive coverage at least 0.9. Report every modality, family,
structure class and evaluation lane separately from complete vectors of
eligible, emitted, abstained, invalid, contradicted-by-label and correct counts.
Run 1 made no measured claim; Run 2 establishes the following vectors.

Inventory: 34 text fixtures, including 12 MPEP form variants across three
families (four gamma variants held out), synthetic FINAL and NON-FINAL cover
language, duplicate/conflicting declarations, partial pairs, footer/history/
attachment negatives, unsupported forms, malformed periods, missing checkbox
state, NBSP, astral/curly-quote context, page straddle, ligature, zero-width,
OCR and layout modalities, and a sole operative all-capital block.

Measured preimplementation rule-spike vectors are stored in
`2026-10-09-floor-vectors.json`; P2 independently recomputes them through the
implemented boundaries. Precision 1.0 on seen and held-out families, coverage
1.0 on seen eligible positives, and exact closed-code correctness 1.0 pass.
The public-form modality is separate; no real-OA precision claim is made.

| Group | Eligible | Emitted | Abstained | Invalid | Contradicted | Correct |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| family:alpha | 4 | 4 | 1 | 0 | 0 | 5 |
| modality:public-form-language | 16 | 16 | 16 | 0 | 0 | 32 |
| structure:correct | 13 | 13 | 16 | 0 | 0 | 29 |
| lane:oracle-upstream | 7 | 7 | 10 | 0 | 0 | 17 |
| held-out:seen | 12 | 12 | 18 | 0 | 0 | 30 |
| lane:full-pipeline | 9 | 9 | 8 | 0 | 0 | 17 |
| structure:split | 3 | 3 | 0 | 0 | 0 | 3 |
| family:beta | 4 | 4 | 0 | 0 | 0 | 4 |
| family:gamma | 4 | 4 | 0 | 0 | 0 | 4 |
| held-out:held-out | 4 | 4 | 0 | 0 | 0 | 4 |
| family:cover | 3 | 3 | 8 | 0 | 0 | 11 |
| structure:many-to-many | 0 | 0 | 2 | 0 | 0 | 2 |
| family:hostile | 0 | 0 | 3 | 0 | 0 | 3 |
| family:unsupported | 0 | 0 | 3 | 0 | 0 | 3 |
| family:unknown | 0 | 0 | 1 | 0 | 0 | 1 |
| family:quality | 0 | 0 | 2 | 0 | 0 | 2 |
| modality:ocr-derived | 0 | 0 | 1 | 0 | 0 | 1 |
| modality:layout-derived | 0 | 0 | 1 | 0 | 0 | 1 |
| family:operative | 1 | 1 | 0 | 0 | 0 | 1 |
