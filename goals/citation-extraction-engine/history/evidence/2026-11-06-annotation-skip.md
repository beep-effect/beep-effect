# Original skip annotation composition

The original `annotate_citations(unbalanced_tags="skip")` behavior now composes
through the existing native assembly, style helper and typed XML worker.
The enclosing operation captures its span processor, XML capability and text
budget through Effect services; returned methods require R=never. No callback
is encoded in a request. The existing XML process, parser and retirement owner
are reused rather than introducing another execution framework.

Overlap trimming happens before span checks. A skipped span leaves the previous
end unchanged. Successful style expansion retains its adjusted signed bounds
without a second overlap trim, matching the original output even where text is
repeated. The no-angle path borrows the original range without a parser child.
Native/query failures propagate through a closed failure union rather than
being interpreted as unbalanced markup. Final output and intermediate copies
retain the existing captured allocation checks.

## Original observations

The new producer calls the unchanged pinned original annotation function and
observes its actual balance checks and warning severity. It records 126 cases,
195 checks, 172 parser checks and 62 warnings, including empty/plain text,
style expansion, overlaps, repeated spans, negative bounds, attributes, NUL,
astral text and width-dependent surrogate behavior. The original eyecite pin
is 04d82c032ad5fd0f9ab72a61c87110c46ee8f52e with CPython 3.11.15.
Existing BSD-2-Clause attribution applies.

- Producer SHA-256:
  `23ae7e96a26ede3a3f5984e9ff562f7b64d7a53822f1ad6d834aefb4b62504f3`.
- Committed fixture SHA-256:
  `b36159a80d90ef8ad8daeb58ee65b02728f262f12f98f33ef978e25429660e1a`.
- Fresh original replay has identical decoded content. File formatting differs;
  this is not a byte-identical regeneration claim.

The target emits a static warning with operation metadata rather than logging
the original raw source payload. Tests compare skip counts and exact native
query sequences/results; they do not claim raw warning-message equivalence.
The warning/privacy fidelity obligation remains open.

## Verification

Eight tests across skip, assembly and style files pass in 47.34 seconds.
The focused composition replays 36 original cases on each actual Bun/Node
runtime, comparing exact output and ordered parser inputs/results. Each runtime
confirms 83 physical child exits, released operation/native admission and 33
skip decisions. Existing unchecked assembly and style corpus checks remain
passing. Server lint/types, declaration emission, blocking laws and scoped
Fallow pass, with zero introduced findings and nine inherited clone groups.
No policy thresholds or baselines change.

```sh
bun run beep quality package-verify @beep/law-practice-server --quick
bun run --cwd packages/law-practice/server beep:build
bun run beep lint laws --package packages/law-practice/server
cd packages/law-practice/server
bunx --bun vitest run test/CitationAnnotationSkip.test.ts \
  test/CitationAnnotationAssembly.test.ts test/CitationAnnotationStyle.test.ts
bunx --bun vitest run test/integration/CitationAnnotationSkip.test.ts
```

The complete 126-case replay per runtime is registered for hosted integration:
344 native parser children in total. That hosted result remains pending.
Wrap replacement templates, custom annotators, complete public request/service/
Layer, final boundary translation and whole-engine safety/scaling remain open.
All eleven representation laws, four fidelity questions and fifteen unfinished
proof rows remain open without semantic waiver or donor-accounting promotion.
