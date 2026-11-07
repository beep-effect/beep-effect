# Correct original-markup backward geometry

While composing discovery with owned diff evaluation, a source reread of
Document.__post_init__ found an incorrect earlier assumption. Forward mapping
uses `SpanUpdater(plain_text, placeholder_markup)`. Backward mapping uses
`SpanUpdater(markup_text, plain_text)`, with the original markup. The earlier
probe used placeholder markup for backward mapping too, and the geometry
adapter required matching complete layouts between those two markup inputs.
Those assumptions are withdrawn. Existing passing tests had not covered this
distinction; they were insufficient evidence for it.

The corrected producer calls the exact original constructor in both directions
and additionally compares its frozen entries with each actual Document-owned
updater. Two new Documents cover a body spelling repeated inside an attribute
and a supplementary point appearing only inside an attribute. The source helper
also converts a supplied tuple over the first attribute's Foo range: the actual
backward map returns plain `Foo`, whereas placeholder-based mapping returns an
empty string. This concrete control prevents the old construction from passing.

Placeholder replacement preserves Python source-point length. It can remove all
supplementary points, changing both canonical storage width and UTF-16 size.
The geometry adapter now requires equal markup point counts while independently
checking each plan's plain layout. It does not require original and placeholder
markup to share storage width or display layout. Each plan still undergoes its
existing exact step/input coherence checks; no resource limit is weakened.

The corrected sealed corpus has 72 maps, 2,492 left/right lookups, 16 real
Documents, 362 tag queries and 17 conversions. It preserves the original
non-HTML, builtin, supplied-step and native Unicode controls. A repeat export
with PYTHONHASHSEED=379 is byte-identical.

| Artifact | SHA-256 |
| --- | --- |
| Producer | 05cd5994d30bf9bb214aa5ba7599ed7d8cc933bf9089dac40b6a474294a5bc7b |
| span-offsets.json | 7f3ea888395629a5472de3ca0fc952db102ff3b918194ffab0cb1543b07f4223 |

Four focused geometry tests pass in 1.22 seconds. Package lint, source/test
type checks pass. The authenticated portable kernel replay passes 1,056 DMP
maps / 9,998 exact steps under both Bun and Node with unchanged refusal controls.
The DMP source, binary and separate 1,005-case diff fixture are unchanged.
Earlier kernel receipts with 1,052 maps / 9,978 steps describe the previous
supplemental span corpus; these counts supersede them for current portable proof.

This correction prepares the proper composition boundary; it does not yet
connect cleaning, discovery and both worker evaluations into the final Document
or prove HTML case-name extraction. Hosted exact-head verification, full family
qualification, public engine composition and every remaining goal requirement
stay open. No semantic divergence or waiver is introduced.
