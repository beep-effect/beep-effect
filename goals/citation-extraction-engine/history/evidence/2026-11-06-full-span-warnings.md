# Full-span evidence and overlap warning binding

The occurrence projector now retains each original full span as a named
fullSpan component anchor, using the existing public converter and provenance
verifier against the same canonical source proof. Equal primary/full spans reuse
the same capability and quote; distinct full spans reserve their quote allocation
before slicing. An invalid full span does not discard a verified primary mention:
it produces an explicit indexed unverified-component record. Other named capture
components and footnote detection are not inferred by this change.

## Source event identity

Original overlap warnings address the pre-filter model table. They are not
positions in the returned citation list. The projector captures the applicable
selected/disambiguated original IDs, checks uniqueness and validates every
returned entry against its corresponding original model. Warning endpoints must
address the original model table. Semantic rows, spans and warning pairs are
snapshotted together before asynchronous identity work.

After verification, existing Effect HashMap ownership maps original IDs to
mentions. Each source event whose endpoints are distinct verified occurrences
becomes the current mention's typed CitationOverlapWarning naming the previous
cm1. Per-mention event order and repeated events are retained. An unavailable
endpoint or an identical occurrence identity retains an explicit unbound event
with original model IDs; no dangling or self-referential document edge is
fabricated. Events remain visible even when source evidence cannot be issued.
The cm1 protocol and inputs are unchanged by component/warning enrichment.

## Verification

The source-backed raw-to-semantic/occurrence replay and prior mention regression
pass 15 tests across two files in 49.87 seconds on Bun and Node. The seven-document
smoke covers all eight citation families, non-BMP names, actual HTML and the
original full/short overlap warning. Primary and full-span anchors compare with
independent original code-point ranges and exact canonical source slices.
Warnings compare original event pairs with their final mention-ID endpoints.

Controls preserve invalid primary positions as unverified semantics, preserve a
primary mention with an invalid full span, and retain an original warning as an
unbound event when the previous primary is invalid. The coordinated corruption
fixture updates both original and returned model views using explicit source IDs;
it does not infer the IDs with the production selection logic. Exact allocation
assertions count the source and each newly allocated primary/component quote,
with shared capabilities charged once. Prior one-unit-short, mention ceiling,
source mismatch, forged proof, native point-layout and shortcut controls remain.

After the assertion-helper refactor and schema annotations, both connected
Bun/Node tests pass again in 49.37 seconds. Package lint/type/test checks, declaration generation, blocking
laws and codec lint pass. Scoped scans show no introduced cognitive excess or
clone group for affected occurrence modules/tests. Estimated isolated coverage
is not hosted coverage; complete hosted qualification remains pending.

Hosted Fallow passes on preceding head
30e8f1a71d860d399a9781426d5a35cbe6c6dbae, Check run 42253656666,
job 128015156055. Hosted confirmation of this wave remains pending.

```sh
bun run beep quality package-verify @beep/law-practice-server --quick
bun run beep lint laws --package packages/law-practice/server
cd packages/law-practice/server
bun run beep:build
bunx --bun vitest run test/CitationSemanticExtraction.test.ts \
  test/CitationMention.test.ts
```

The full 36-document integration replay uses the same occurrence adapter and
remains a hosted gate. Production source identity for cleaned inputs, public
errors/service/Layer, final detached/document integration, other components,
footnotes, transforms, broad host/subclass/equality/mutation/alias behavior,
exhaustive accounting and whole-engine safety/scaling remain open. All eleven
representation laws, four fidelity questions and fifteen unfinished proof rows
remain open without a semantic waiver or goal-completion claim.
