# Built-in extraction dispatch

Source: eyecite 2.7.6 commit
`04d82c032ad5fd0f9ab72a61c87110c46ee8f52e`, tree
`a35a58fac03400f71a93a93485b77f1d56f2b02f`, BSD-2-Clause.
The producer verifies both identities, a clean checkout and CPython 3.11.15.

`ops/probe-token-dispatch.py` executes the original get_citations branch loop
and _extract_full_citation source-set/class priority. It explicitly substitutes
document/tokenization context, metadata, references, filtering and short/id/supra
context construction. These observations prove dispatch, not full extraction.

The 7,318 cases enumerate all exact/variation pairs of sequences of length zero
through three over reporters/laws/journals/other, all corresponding short cases,
and the other eight built-in token classes. They retain 259 unknown-source
failures and all 19,608 ordered source-property reads. Short citations bypass
full-source selection; nonempty exact editions override variations; full classes
prefer reporters, then laws, then journals. Every selected occurrence is read
before deciding. SectionToken selects UnknownCitation; other generic tokens skip.

The target reuses Effect HashMap/HashSet, LiteralKit matching, captured Clock
and existing policy timing. It captures the existing CitationFrozenEditions
owner, whose new primitive source getter uses the same authenticated edition
map. All 2,533 real edition source labels agree with existing lookup. Methods
have R = never. Native tokenizer assembly indices and token identities are
checked before publication; malformed references and duplicate identities fail
without partial plans. Canonical 1 U.S. 1 tokenization reaches FullCaseCitation
through the real edition owner and independently retired workers.

Verification:

- Nine tests in four files pass: CitationTokenDispatch, CitationFrozenEditions,
  CitationResourceObjects and CitationTokenizerCatalog.
- Quick server lint/type checks and scoped Oxlint pass.
- Repeat producer capture under PYTHONHASHSEED=137 is byte-identical. Source
  label set membership/priority does not require an edition hash profile.
- Corruption controls cover missing editions (including later chosen entries),
  exact preference over an invalid variation, short lookup bypass, invalid
  mixed-output indices, missing token seeds and duplicate ids/bindings.

Producer SHA-256:
`ebfacb0bde36e1dbd582c86f670ad90c2704095869d76eeb9ccdd36a832c5e9e`.
Fixture SHA-256:
`3a865e3d1bf47f08eb97a092c2ae5743232f1adbad3feea9537ba5907386fd47`.
The test authenticates bytes before decoding. The exact generated fixture joins
existing oracle-data formatter exclusions to preserve one vector per line and
its authenticated producer bytes; no source rule, test or quality floor changes.

Full citation construction, metadata/pincites, reference/parallel extraction,
filtering, ambiguity removal, document projection and custom protocols remain
open. This does not settle fresh-process edition hashing or candidate-order
laws. No semantic waiver or canonical full-parity completion row is added.
Hosted integration and quality results require their own exact-head receipts.

Policy review: the EV010 platform-filesystem candidate is retained as a reviewed
resource exception. The per-suite it.layer reads and authenticates actual
committed bytes; seeded memory files would not prove this. Owner:
@beep/law-practice-server. Exit: inject an independently authenticated corpus
when authentication is isolated. No schema-first codec advisory is added by
the decode-only observation schema. Staged new-only Fallow passes with zero
introduced findings. Divergence accounting retains 11 representation laws,
four open fidelity questions and 15 unfinished target-proof rows.
