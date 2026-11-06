# Native wrap annotation composition

Original wrap annotation now connects the existing XML query, original tag
pattern, native regex worker, Python template adapter and output assembly.
No alternate matcher, parser, process manager or RPC transport is introduced.
The fixed `(<[^>]+>)` pattern is bound to its reviewed native fingerprint and
one-group profile. Complete and first-group ranges must agree before template
substitution, preserving the original helper's equal zero/one references.

The shared markup span preparer owns the no-angle fast path, reserved native
slice and initial XML query for both skip and wrap. Only an unbalanced span
reaches its captured strategy. Wrap reverses after/before for the original
internal tag substitutions, then the existing assembly inserts the outer
annotation. Balanced/plain spans retain literal backslashes without template
interpretation. Invalid templates on unbalanced spans refuse before a regex
child is spawned; no partial assembled output is returned.

## Selected operation and ownership

The private CitationRegexOperation service selects schema-owned operation data
at installation. Extraction remains the default. Regex preparation, compiler
and descriptor binding reuse the shared timing factory, capturing that selected
operation and Clock. Unicode preparation uses the same selected operation.
The existing worker uses it for native ownership/admission and maps runtime
safety refusals to that operation. No callback or runtime object is request data.
Every returned worker, wrapper and span method retains R=never.

A controlled Clock test installs annotation timing at 50ms with cleaning and
extraction both 1ms, blocks actual input preparation and replaces the caller's
operation service. Work remains pending after 1ms and refuses at 50ms with
annotateDeadline. A separate default/extraction control proves the enclosing
5ms operation deadline wins over a 20ms stage deadline. Cleanup ownership,
physical exit acknowledgement and quarantine retain the existing implementation.

## Actual source and target observations

The unchanged original annotate_citations function supplies a new 162-case
corpus, with actual XML/helper observers rather than reconstructed decisions.
It records 161 balance checks, 134 parser calls, 90 wrap calls, 69 successful
wraps and 21 invalid-template failures. Cases include overlap trimming, repeated
spans, signed bounds, malformed/nested markup, NUL, astral points and literal
surrogates. Fresh original replay has identical decoded content; committed JSON
formatting is separate, so byte-identical regeneration is not claimed.

- Original eyecite pin: `04d82c032ad5fd0f9ab72a61c87110c46ee8f52e`.
- CPython: 3.11.15.
- Producer SHA-256:
  `4277edbb6d168dd9fdd6373e9ef0533b16cdeebdcfcc7a1c6ab47b796918cfff`.
- Committed fixture SHA-256:
  `c91c4ec5e74e1ac4d80846218b5c6ed7dd181df138690d845da9081a04d13b6a`.
- Native tag-pattern fingerprint, including width prefix:
  `309a84eea285d876e0a32e0840a49ce6b826bf0a12bec8eae4e74e32cc67dad9`.

Actual Bun/Node helper replay selects 36 original cases per runtime from the
unchanged 1,320-case template corpus. Twenty-four successful queries per runtime
match exact original output, including complete no-match results; twelve invalid
templates refuse before native spawn. Separate composed replay selects 36
original annotation cases per runtime, matching exact final output/refusal and
ordered native XML input/results. It confirms 32 XML plus 15 regex exits per
runtime, with 15 original failures. Shared operation/native admission is released.

The first Node composed replay exposed a test bundle collision: both runtime
roles wrote the same bundle filename in one temporary directory. Separate
scoped directories fix the test ownership error; production runtime paths are
explicit and unchanged. Shared trace, native-input assembly and outcome helpers
retain all assertions while removing new clone findings.

## Verification and remaining scope

Twenty-seven tests across five files pass in 43.01 seconds, including actual
Bun/Node wrap and skip, complete template component replay, captured Clock
controls and existing regex worker behavior. Server lint/types, declaration
emission, blocking laws and scoped Fallow pass. No new dead-code, complexity or
clone finding remains; nine inherited clone groups remain nonblocking under
unchanged policy. No baseline, threshold or source expectation is weakened.

```sh
bun run beep quality package-verify @beep/law-practice-server --quick
bun run --cwd packages/law-practice/server beep:build
bun run beep lint laws --package packages/law-practice/server
cd packages/law-practice/server
bunx --bun vitest run test/CitationAnnotationWrap.test.ts \
  test/CitationAnnotationTemplate.test.ts test/CitationAnnotationSkip.test.ts \
  test/CitationRegexOperation.test.ts test/CitationRegexWorker.test.ts
bunx --bun vitest run test/integration/CitationAnnotationWrap.test.ts
```

The full helper and composition corpora are registered for hosted integration
on both runtimes: 1,990 native children in total. That hosted result remains
pending. Existing eyecite BSD-2-Clause and CPython PSF attribution apply.
Warm-cache warning fidelity, final exception/installation boundary translation,
custom annotators, complete public request/service/Layer and whole-engine safety/
scaling remain required. All eleven representation laws, four fidelity questions
and fifteen unfinished proof rows remain open without a semantic waiver or
source/donor accounting promotion.
