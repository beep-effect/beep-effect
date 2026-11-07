# Short-form missing-page constructor review repair

PR #2847 review thread PRRT_kwDOPbO_N860zQvH correctly identified that the earlier
CitationBase missing-page normalization was applied only to full constructors.
The pinned source applies it to ShortCaseCitation too, after raw token groups
have supplied the pin-cite prefix in find.py _extract_shortform_citation.

ReferenceTokenExtraction now retains that original order: pin/metadata extraction
consumes the raw page, then the returned model token passes through the existing
shared missing-page normalization. No alternate page matcher or public wire model
is introduced. Original token spelling and source coordinates remain unchanged.

The new probe runs only against a clean exact eyecite pin under CPython 3.11.15.
It records the source hashes of models.py, find.py and regexes.py, producer hash,
BSD-2-Clause attribution and original observations for 576 U.S., at ___ with and
without a trailing comma/13 suffix. Its committed fixture SHA-256 is
`a0ef3bb1308d890aed337ca53465607430ca4d8452734365561ce87dbefd9b20`.
A second independent invocation produces byte-identical output.

Both source observations have groups.page=None and metadata.pin_cite=None, with
primary span [0,13] and full/pin-inclusive spans [0,16]. The target public-engine
regressions preserve these exact distinctions rather than replacing coordinates
with the entire matched text. Both Bun and Node replay both inputs; two tests
pass in 45.15 seconds. Original groups, complete semantic metadata, verified
primary/full/pin-inclusive ranges, full matched spelling and independently
confirmed native exits are checked. Public error redaction and all deadlines
remain unchanged. Fallow new-only passes with zero introduced findings.

This closes the specific short-form constructor defect only. It does not qualify
the whole original corpus, other model protocols, safety/scaling or any previously
unfinished accounting obligation. Historical callback and ten-input-group timeout
causes remain open despite their passing isolated reruns.
