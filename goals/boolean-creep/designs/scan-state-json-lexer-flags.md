# Instance

- id: `scan-state-json-lexer-flags`
- source: `05405bf322da0ca7eb88b8bb402145081e8fded6`
- file:line: `packages/agents/server/src/AssistantTurn/ScanState.ts:48`
- symbol: `ScanState`
- members: `escaped`, `inBlocksArray`, `inString`
- evidence: E4 at `ScanState.ts:143-151` — `escaped` is set only while
  `inString` is true, and the scanner cannot leave the string while processing
  an escaped character. Therefore `escaped => inString`. `inBlocksArray` is an
  independent one-way latch set on the first outside-string `[`.

# Current shape

`ScanState`, `ScanChunkInput`, and `ScanChunkResult` are exported `S.Class`
schemas. The scanner stores `escaped`, `inString`, and `inBlocksArray` across
chunks. Inside the character fold, a nested `if (inString) / if (escaped)`
chain reconstructs three exclusive JSON string phases. Structural bracket and
brace handling runs only outside strings, while `inBlocksArray` independently
records whether the outer blocks array has begun.

`scanChunkResult` constructs a schema-backed `ScanChunkResult`. The public
dual `scanChunk` wrapper then copies its state fields into a plain object for
the returned tuple. `AnthropicTurnKernel` and the package test seed pass the
state opaquely; exact encoded and returned shapes are asserted in the schema
parity test.

# Cardinality gap

The three booleans represent eight combinations. Six are legal because the
independent `inBlocksArray` latch combines with three JSON string phases:

- `outside` × before/inside blocks array;
- `in-string` × before/inside blocks array;
- `escaped` × before/inside blocks array.

The two illegal combinations are `escaped && !inString`, one for each latch
value. `inBlocksArray` is not part of the exclusivity defect and remains a
boolean latch.

# Target schema

Add `LiteralKit` to the existing `@beep/schema` import. Define and annotate the
exported `ScanStringPhase` kit with `outside`, `in-string`, and `escaped`, plus
its same-name derived type. `ScanState` replaces `escaped` and `inString` with
`stringPhase: ScanStringPhase`, whose constructor/key default is
`ScanStringPhase.Enum.outside`; retain the existing field-level descriptions
and describe the phase as carry state across chunks.

Fold each character by `ScanStringPhase.$match`:

- `escaped` always advances to `in-string` and performs no structural action;
- `in-string` advances to `escaped` on `\\`, to `outside` on `"`, and
  otherwise remains `in-string`;
- `outside` enters `in-string` on `"` and otherwise runs the existing exact
  `[`, `{`, `}`, and `]` structural logic.

Keep the existing `if (depth > 0) current += char` before phase dispatch so
the emitted slice remains byte-identical. Keep `inBlocksArray` mutations only
in the `outside` arm. Construct the next `ScanState` with `stringPhase`, and
keep the public `scanChunk` wrapper's field-by-field plain-object copy while
replacing its two old fields with `stringPhase`.

# Migration inventory

- `packages/agents/server/src/AssistantTurn/ScanState.ts:8-14` — add
  `LiteralKit` to the existing `@beep/schema` import; reuse `$I`, `Match`, and
  the current schema imports.
- `ScanState.ts:18-22` — retain `NonNegativeScanDepth` unchanged.
- `ScanState.ts:24-63` — add the annotated exported `ScanStringPhase` owner and
  derived type near `ScanState`; replace fields at lines 48 and 54 with one
  defaulted/annotated `stringPhase` field. Keep `current`, `depth`,
  `inBlocksArray`, `ScanState.encodeResult`, and class annotation.
- `ScanState.ts:80-115` — `ScanChunkInput` and `ScanChunkResult` continue to
  compose `ScanState`; no separate field migration is needed.
- `ScanState.ts:117-131` — update example prose from flags to phase/latch if
  mentioned; keep `initialScanState = ScanState.make()` and its
  `inBlocksArray` example.
- `ScanState.ts:142-192` — destructure `stringPhase`, replace the nested string
  boolean chain with exhaustive phase matching, and construct the next state
  with the literal field. Preserve character accumulation, bracket/brace
  depth behavior, completed-slice order, and mutable completed-array behavior.
- `ScanState.ts:194-230` — update the state-machine comment and the plain-object
  tuple return to copy `stringPhase`; do not replace the copy with
  `result.state`, because that could change the existing plain-object runtime
  result into an `S.Class` instance.
- `packages/agents/server/src/AssistantTurn/AnthropicTurnKernel.ts:202` — no
  field migration; it carries `initialScanState` and `scanChunk` opaquely
  through `Stream.mapAccum`.
- `packages/agents/server/src/AssistantTurn/index.ts:97`,
  `packages/agents/server/src/index.ts:17-19`, and
  `packages/agents/server/src/test.ts:9-27` — barrels/examples remain valid;
  the test seed aliases the initial state opaquely.
- `packages/agents/server/test/AssistantTurn.schema-parity.test.ts:26-80` —
  replace exact `escaped`/`inString` fixtures with
  `stringPhase: "outside"` in both initial encoded state and returned state;
  retain all three scanner schemas in the arbitrary round-trip list.
- `packages/agents/server/test/scanChunk.test.ts:13-62` — retain the envelope ×
  chunking property and single-character test; add focused phase-transition
  cases at chunk boundaries.

Live source/test/barrel search found no other field reader or writer. Public
consumers import the state and scanner through `AssistantTurn`, but repository
runtime consumers treat the state opaquely.

# Guard-deletion accounting

Delete the outer `if (inString)` guard, nested `if (escaped)` guard, their
`continue`, and all separate `inString`/`escaped` reads and writes in the fold,
next-state construction, and tuple-state copy. The exhaustive literal match
becomes the only string-phase transition owner, making
`escaped && !inString` unrepresentable.

Retain `if (!inBlocksArray)` and `if (inBlocksArray)`: they govern the
independent one-way latch. Retain depth guards and the public wrapper's manual
copy because neither enforces the removed boolean invariant. There is no
legacy-input normalizer or mutual-exclusion error to delete.

# Encoded-side impact

The internal encoded schema changes from separate `escaped` and `inString`
keys to `stringPhase: "outside" | "in-string" | "escaped"`. Update the exact
schema-parity fixture atomically. No compatibility transform is required under
the inventory's `internal` exposure: repository search found no persisted,
wire, JSON-file, database, or request/response consumer.

The source API is exported through `@beep/agents-server/AssistantTurn`, so
compile-time consumers see the field migration and the new phase owner. The
`scanChunk` call signatures, tuple order, completed JSON-slice bytes, initial
semantics, and opaque `Stream.mapAccum` use remain unchanged. Include the
required patch changeset.

# Test impact

- Update the exact encoded and returned state objects in
  `AssistantTurn.schema-parity.test.ts` and retain schema-derived arbitrary
  round trips for `ScanState`, `ScanChunkInput`, and `ScanChunkResult`.
- Retain the existing 200-run envelope/chunking property and single-character
  chunking test as the behavioral proof for braces, brackets, quotes,
  backslashes, newlines, and Unicode inside JSON strings.
- Add direct transitions that end a chunk immediately after a backslash
  (`escaped`), consume an escaped quote in the next chunk (`in-string`), and
  consume an unescaped closing quote (`outside`). Also cover those phases both
  before and after the blocks-array latch is set.

Run the focused scanner/schema-parity tests and full
`@beep/agents-server` package verification with the required patch changeset
when this design is applied.

# Risk and sequencing

This is the only batch item in `packages/agents/server` and has the highest
behavioral risk because it changes the incremental lexer carry state. Land the
schema, transition fold, tuple copy, exact-shape fixture, phase-boundary tests,
and changeset atomically. Preserve the exact ordering of accumulation and
phase/structure handling; a one-character ordering change can corrupt slices
only at chunk boundaries.
