# P0 proposed corpus and rule semantics — pending

Proposed family `uspto-oa-finality-ssp`, version `1`, is clean-room and unadopted.
Source/license rows are in the packet's `research/SOURCES.md`. No production
regex implementation exists and no confidence prior is calibrated.

Replay on the same exact `SourceTextIdentity` must be byte-identical. A future
rule version appends an attempt linked to its predecessor and never rewrites
stored output. There is no migration of persisted outcomes; consumers select an
explicit family version. Source drift is a retained failed attempt, and a
re-anchor proves new raw slices separately. These proposed semantics are frozen
only when P0 passes.

Floors remain normative: emitted-pair precision 1.0 for seen and held-out
families; zero candidates and exact code for every closed fixture; seen-family
eligible-positive coverage at least 0.9. Report every modality, family,
structure class and evaluation lane separately from complete vectors of
eligible, emitted, abstained, invalid, contradicted-by-label and correct counts.
No measured vector or passing floor is claimed in Run 1.

Inventory: 34 text fixtures, including 12 MPEP form variants across three
families (four gamma variants held out), synthetic FINAL and NON-FINAL cover
language, duplicate/conflicting declarations, partial pairs, footer/history/
attachment negatives, unsupported forms, malformed periods, missing checkbox
state, NBSP, astral/curly-quote context, page straddle, ligature, zero-width,
OCR and layout modalities, and a sole operative all-capital block.

Remaining P0 gaps: valid independent B labels, constructed integrity cases,
full split/merge diagnostics, inert future-model shadow cases, schema-decoded
fixture inventory, complete measured floor vectors and any qualified real-OA
positive samples. See the reconciliation for the bounded two-run failure.
