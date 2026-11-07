# Original annotation replacement-template component

The private adapter compiles the exact `wrap_html_tags` replacement expression
as one native template: before, literal backslash-one, after. Parsing the whole
expression preserves interactions across those boundaries. Python replacement
semantics differ from Effect String's JavaScript replacement semantics, so the
adapter specializes the original CPython parser rather than substituting a
JavaScript replacement operation. This is an attributed compatibility adapter,
not a new regex engine or matching implementation.

The fixed original pattern has one capture identical to its whole match.
Template references zero and one therefore select that same range. Escape,
octal, numeric-reference, named-numeric-reference and invalid-template behavior
follow CPython 3.11.15 `Lib/re/_parser.py`. Existing frozen native Unicode and
Python integer services are reused. Borrowed literal ranges and one static
byte table avoid allocating one replacement string per match. Cooperative scans
and the existing two-pass native concatenator retain allocation preflight.

The required enclosing text budget is captured once. A shared annotation
reservation adapter now also serves existing skip/style consumers, retaining
their operation-specific refusal without repeated bookkeeping. Final enclosing
operation admission and deadline remain the caller's responsibility.

## Direct source evidence

The producer calls unchanged eyecite `utils.wrap_html_tags` and separately
records original `re.finditer` tag ranges. All 1,320 synthetic observations
include exact native source/before/after/output, original exception class and
message, and DeprecationWarning observations. There are 792 successful outputs,
528 invalid-template failures and 120 warnings. Empty/plain text demonstrates
that invalid templates fail even without a match. Newlines, malformed/nested
angles, NUL, astral text, adjacent and lone surrogates preserve native storage.

The template cache is explicitly cleared for each independent source case.
This qualifies cold-source observations only; warm-cache warning suppression is
not established. Fresh replay has identical decoded content. The committed
fixture is formatted separately, so byte-identical regeneration is not claimed.

- Original eyecite pin: `04d82c032ad5fd0f9ab72a61c87110c46ee8f52e`.
- CPython: 3.11.15.
- Original template parser SHA-256:
  `4748e39c77d6dc14f81af80e68a62ad99031a8182d5e0b219a6666d0cfb1626f`.
- Producer SHA-256:
  `3845e015f477bfdaabc2f80ca02e9cbbe0f4be2bfbf0fdbda08ec25e940a4e44`.
- Committed fixture SHA-256:
  `c2b7516115dc68b4e929ccb7f2de3caab9b787b884738ba2b43d3e11e520d35e`.

Existing eyecite BSD-2-Clause and complete CPython PSF notices apply. The new
notice records the Effect/native-range changes and restricted capture profile.

## Target proof and limits

The full component replay compares all 792 outputs using independently observed
original match ranges and refuses all 528 invalid templates. Successful cold
plans also match the original warning counts. Target failures intentionally
contain no original template text or parser diagnostics; this does not establish
final exception-class/message translation or a representation-law discharge.
The target emits static warning metadata; warm-cache behavior, failed-plan
warning traces and complete warning fidelity remain open.

A separate exact-allocation control reserves the two-unit template, refuses a
three-unit output against remaining capacity two without changing the charge,
and succeeds against remaining capacity three. A caller-supplied replacement
budget remains unused, proving captured authority. Existing skip/style
regression is retained after sharing the reservation adapter.

Server lint/types, declaration emission, blocking laws and scoped Fallow pass.
Fallow reports zero introduced findings and nine inherited clone groups under
unchanged policy. Ten regression tests across four files pass in 80.60 seconds,
including
actual Bun/Node skip composition, style expansion and frozen integer parsing.
Two final template tests pass in 2.37 seconds after parser decomposition.

```sh
bun run beep quality package-verify @beep/law-practice-server --quick
bun run --cwd packages/law-practice/server beep:build
bun run beep lint laws --package packages/law-practice/server
cd packages/law-practice/server
bunx --bun vitest run test/CitationAnnotationTemplate.test.ts \
  test/CitationMetadataYear.test.ts test/CitationAnnotationSkip.test.ts \
  test/CitationAnnotationStyle.test.ts
```

This proof supplies original match ranges to isolate template interpretation.
Native matching, full wrap/skip dispatch with custom annotators, complete public
request/service/Layer and whole-engine safety/scaling remain required. The
existing regex worker must use the owning annotation operation's deadline when
integrated, rather than inheriting extraction timing. All eleven representation
laws, four fidelity questions and fifteen unfinished proof rows remain open;
there is no semantic waiver or source/donor accounting promotion.
