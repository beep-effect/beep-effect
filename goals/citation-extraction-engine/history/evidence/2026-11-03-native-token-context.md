# Native token-context preparation

The producer runs actual helpers.match_on_tokens from clean eyecite commit
`04d82c032ad5fd0f9ab72a61c87110c46ee8f52e`, tree
`a35a58fac03400f71a93a93485b77f1d56f2b02f`, under CPython 3.11.15 and regex
2023.12.25. It intercepts only the final regex.search call. Context text,
pattern wrapping, forwarded flags and pre-search failures are actual source
observations. It does not execute or prove third-party regex matching.

All 2,976 observations match the target context text and directional anchor:
2,364 successful search preparations and 612 IndexErrors, mapped to a closed
index-out-of-range failure without retaining source text. Every exact built-in
token class is distinguished from str. Paragraph tokens stop either mode;
strings-only stops at every non-str token. Forward negative indices revisit
trailing words before proceeding through zero, while invalid indices fail.
The 300-character cutoff applies after appending a word, not eagerly to the
prefix: oversized prefixes survive when no word is appended. Empty words,
299/300/301 boundaries, both directions, native scalar/literal-surrogate words
and null Token.data (source str becomes None) are covered.

`TokenContext.ts` uses schema-first word/mode data and Effect.whileLoop,
Array helpers and captured Clock/policy. The existing native Unicode owner
validates and owns inputs. A range plan preserves Python coordinates; the
new native-range concatenation helper shares existing Unicode measurement and
canonical width encoding. It calls the receiver before output allocation.
No JavaScript string round-trip merges adjacent literal surrogate words.
Retained input and receiving output units share this invocation's configured
produced-text ceiling. Whole-engine shared reservations remain required.

Nine focused tests across context/text/assembly pass, including source replay,
invalid str-null input, input/output ownership, cumulative receiving refusal,
recovery and a captured-deadline control under a disabled caller Clock.
Quick server lint/type checks pass. The staged new-only Fallow audit passes
with zero introduced findings after factoring source scan steps through Effect.
Repeat source capture under PYTHONHASHSEED=137 is byte-identical.

Producer SHA-256:
`28ee79ce711fc16a906f5df7e12ea0515518e0051f6b772bcaf51b8c3f0093ea`.
Fixture SHA-256:
`252231fd5180ba20cfce5ccece24cac7572edcde834e1187467f64671d0181ca`.
The test authenticates fixture bytes before decoding. The exact fixture's
formatter exclusion preserves one authenticated observation per line; authored
source and quality floors are unchanged. The EV010 real-filesystem candidate
is reviewed because seeded memory would remove artifact authentication.
Owner: @beep/law-practice-server. Exit: inject an independently authenticated
corpus when authentication is isolated. No new semantic waiver is granted.

Hosted lint job 126004576865 on 8c9cb9b260 rejected the generated identity lint
profile as stale after the prior root formatter exclusion changed. The canonical
`beep cache profile --write` regenerates the projection, including both exact
fixture exclusions; `beep cache profile` verifies it current. All four focused
cache-profile tests pass. No diagnostic, floor or lint rule was disabled.

Remaining: tokenizer-to-context composition, actual third-party regex semantics,
pincites/metadata, references, filtering and full public engine integration.
The fixture captures CONTROL anchoring and regex.X=64 forwarding; the target
currently returns anchor data, not a compiled or executed regex. Custom string
subclasses/protocols remain open. These finite observations do not prove every
context or the entire helpers module, and no full-parity row advances.

Next matching admission: direct compilation with pinned regex 2023.12.25 finds
POST_SHORT_CITATION_REGEX (two groups), POST_LAW_CITATION_REGEX (six) and
POST_JOURNAL_CITATION_REGEX (three) all match empty input. POST_FULL (seven),
PRE_FULL (two), SUPRA_ANTECEDENT (two) and YEAR (one) do not. The existing
positive-width evaluated worker profile cannot be silently applied to these
nullable helpers. A source-bound single-search profile and independent exact
third-party-engine observations are required before context matching is wired.
This is required implementation work, not an approved limitation of the goal.
