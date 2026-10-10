# Office-action pair truth guide

Judge text independently from any extractor. Each input supplies its modality.
A public-form-language excerpt is evaluated as an instantiated form-language
sample, rather than an actual application's issued action. It cannot prove
performance on real office actions.

Return exactly one atomic outcome: `recognized` with finality (`FINAL` or
`NON-FINAL`) and two exact raw quotes (the operative finality declaration and
initial complete sentence establishing the shortened response period), or
`abstained` with one code: `absent`, `ambiguous`, `unsupported`,
`low-quality-source`, or `rule-not-covered`.

Truth rules, in precedence order:

1. OCR-derived or layout-derived input has no authorizing lineage and closes
   `low-quality-source`, irrespective of apparent text quality.
2. A notice of allowance, restriction requirement, or advisory action is
   `unsupported` for this office-action pair.
3. More than one operative pair, conflicting declarations, or a checkbox whose
   selected state is unavailable is `ambiguous`. Never infer a missing glyph.
4. Ignore literals explicitly inside quoted history, an attachment, or a footer.
   If no operative declaration remains, close `absent`.
5. An incomplete pair is `absent`. Both members must be operative in one action.
6. A malformed or unspecified period or an unknown form is `rule-not-covered`.
7. A unique explicit operative declaration paired with a complete period sentence
   is `recognized`. Preserve raw whitespace and Unicode in quotes.

Also report structural diagnostic `correct`, `miss`, `false-alarm`, `split`,
`merge`, or `many-to-many`, and relationship labels among `same-paragraph`,
`sibling`, `continuation`, and `reading-order`. Label physical splits as `split`,
merged distinct blocks as `merge`, and duplicate/conflicting pairs as `many-to-many`.
Ordinary pairs and abstentions are `correct` unless the source exposes one of
those structural defects. Relationships diagnose structure and never authorize
an incomplete or unverified pair.

Output one JSON object per opaque id with keys `id`, `outcome`, `diagnostic`,
`relationships`. A recognized outcome has `status`, `finality`, `finalityQuote`,
`periodQuote`; an abstention has `status` and `code`. No prose.
