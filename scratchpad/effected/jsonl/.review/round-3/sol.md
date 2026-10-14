<!-- seat: sol, run on claude-opus-5-5 (Codex quota exhausted, 2026-10-14) -->
Round 3 for jsonl: 1 required finding, 2 backlog. All four round-2 required items are fixed at this commit:
- **grok-2-1:** `TailWindow.size` now uses the bytes actually read (`internal/tail.ts:136`).
- **sol-2-1:** the patch encoder now handles class members inside unions and codecs behind `decodeTo`, and `Journal.test.ts:323` and `:347` pin both cases.
- **fable-2-1:** `utf8Length` counts in place again, with no buffer.
- **fable-2-3:** both deep-input tests are back at depth `200_000`.

The sandbox would not let me run a probe, so the required finding comes from reading the code: the installed `effect` `SchemaAST`, the lab's `patchAst`, and the oracle's `merge.ts`.

### claude-3-1
- file: scratchpad/effected/jsonl/Envelope.ts:256
- class: bug   severity: required
- standard: D9, D11, section 14. This is the same class of defect as round-2 sol-2-1: a forced change to how runtime objects are handled breaks patches that upstream accepts. The ledger's native-runtime entry does not record this case.
  evidence:
  - `patchAst` rewrites only `Union` nodes (line 260) and `Declaration` nodes that encode to an object (line 271–275). Every other node, including `Suspend`, comes back unchanged (line 295).
  - In a payload such as `data: S.suspend(() => Boxed)`, the class declaration sits behind `Suspend`, so it keeps its instance check on the encoding side.
  - `Journal.ts:1127–1128` sends the merged value to that encoder as a plain object (`shallowMerge`, `internal/merge.ts:149`). The instance check rejects it with `InvalidData`.
  - The oracle's `shallowMerge` (`src/internal/merge.ts:109`, `Object.create(Object.getPrototypeOf(base))`) builds the merge on the base's prototype, so the same patch passes the instance check upstream.
  - `S.suspend` is the repo's required idiom for recursive schemas (effect coding standards).
- failure: Take a journal whose event payload is a suspended class, seeded with `{ n: 1, keep: "a" }`. `appendPatch("x", { n: 2 })` fails `InvalidData` and writes nothing. Upstream appends `{ n: 2, keep: "a" }`. The same gap applies to a `Declaration` whose encoding link points to a `Union` or `Suspend` rather than an object, because the check at line 274 only matches when `isObjects(link.to)` is true.
- fix: Add a `SchemaAST.isSuspend(ast)` branch that rebuilds the `Suspend` with a lazily memoized `() => patchAst(ast.thunk())`, keeping annotations, checks, encoding and context. Let the relaxation at line 274 also apply when `link.to` patches to a different AST. Add a suspended-class `appendPatch` regression next to `Journal.test.ts:323`. It should assert the retained fields, the class instance, two persisted records, and that an invalid patch writes nothing.

### claude-3-2
- file: scratchpad/effected/jsonl/Envelope.ts:298
- class: perf   severity: backlog
- standard: D11 (no measurement, constant-factor cost only)   evidence: `encodeResultWith` (line 315) calls `patchCodec(found.value.data)` on every patch append. That builds a new AST tree each time, so `S.encodeUnknownResult` cannot reuse a parser compiled for an earlier AST and recompiles the payload encoder on every `appendPatch`. The registry is fixed for the journal's life, so the patched codec could be built once.
- failure: Each patch append does extra work proportional to the schema's size. This is a constant factor, not a change in complexity class.
- fix: Compile the patched codec once per event, either as an extra field on the owned `Registry` (line 117) or as a lazy per-event value. Then `encodeResultWith` reads it instead of rebuilding it.

### claude-3-3
- file: scratchpad/effected/jsonl/Journal.ts:960
- class: docs   severity: backlog
- standard: section 14 (a deviation's stated guarantee must match its behaviour)   evidence: The paged read pins the file handle and checks its `dev:ino` once (lines 929–946). After that, `readSampledWindow` only detects a page that is shorter than requested (`internal/tail.ts:314`). If a writer truncates the same file in place with `O_TRUNC` and refills it past the next page's end before that page is read, every page comes back full length. Deviation 13 ("a truncation beneath it fails typed") and the README text at lines 491–530 claim the read cannot be spliced.
- failure: A `query` or replay can emit old pages followed by pages from the rewritten content, with no `JournalResync`. This is the splice Deviation 13 says it removed, but for an in-place rewrite rather than a rename-over. The window is narrow: the regrowth must finish between two page reads.
- fix: Narrow the Deviation 13 wording to rename-over and plain shrink, and name this race as a limitation. Detection would need a per-page check of size or mtime, which nothing here does yet.

REQUIRED: 1
BACKLOG: 2
Round 3 for jsonl: 1 required finding, 2 backlog. All four round-2 required items are fixed at this commit:
- **grok-2-1:** `TailWindow.size` now uses the bytes actually read (`internal/tail.ts:136`).
- **sol-2-1:** the patch encoder now handles class members inside unions and codecs behind `decodeTo`, and `Journal.test.ts:323` and `:347` pin both cases.
- **fable-2-1:** `utf8Length` counts in place again, with no buffer.
- **fable-2-3:** both deep-input tests are back at depth `200_000`.

The sandbox would not let me run a probe, so the required finding comes from reading the code: the installed `effect` `SchemaAST`, the lab's `patchAst`, and the oracle's `merge.ts`.

### claude-3-1
- file: scratchpad/effected/jsonl/Envelope.ts:256
- class: bug   severity: required
- standard: D9, D11, section 14. This is the same class of defect as round-2 sol-2-1: a forced change to how runtime objects are handled breaks patches that upstream accepts. The ledger's native-runtime entry does not record this case.
  evidence:
  - `patchAst` rewrites only `Union` nodes (line 260) and `Declaration` nodes that encode to an object (line 271–275). Every other node, including `Suspend`, comes back unchanged (line 295).
  - In a payload such as `data: S.suspend(() => Boxed)`, the class declaration sits behind `Suspend`, so it keeps its instance check on the encoding side.
  - `Journal.ts:1127–1128` sends the merged value to that encoder as a plain object (`shallowMerge`, `internal/merge.ts:149`). The instance check rejects it with `InvalidData`.
  - The oracle's `shallowMerge` (`src/internal/merge.ts:109`, `Object.create(Object.getPrototypeOf(base))`) builds the merge on the base's prototype, so the same patch passes the instance check upstream.
  - `S.suspend` is the repo's required idiom for recursive schemas (effect coding standards).
- failure: Take a journal whose event payload is a suspended class, seeded with `{ n: 1, keep: "a" }`. `appendPatch("x", { n: 2 })` fails `InvalidData` and writes nothing. Upstream appends `{ n: 2, keep: "a" }`. The same gap applies to a `Declaration` whose encoding link points to a `Union` or `Suspend` rather than an object, because the check at line 274 only matches when `isObjects(link.to)` is true.
- fix: Add a `SchemaAST.isSuspend(ast)` branch that rebuilds the `Suspend` with a lazily memoized `() => patchAst(ast.thunk())`, keeping annotations, checks, encoding and context. Let the relaxation at line 274 also apply when `link.to` patches to a different AST. Add a suspended-class `appendPatch` regression next to `Journal.test.ts:323`. It should assert the retained fields, the class instance, two persisted records, and that an invalid patch writes nothing.

### claude-3-2
- file: scratchpad/effected/jsonl/Envelope.ts:298
- class: perf   severity: backlog
- standard: D11 (no measurement, constant-factor cost only)   evidence: `encodeResultWith` (line 315) calls `patchCodec(found.value.data)` on every patch append. That builds a new AST tree each time, so `S.encodeUnknownResult` cannot reuse a parser compiled for an earlier AST and recompiles the payload encoder on every `appendPatch`. The registry is fixed for the journal's life, so the patched codec could be built once.
- failure: Each patch append does extra work proportional to the schema's size. This is a constant factor, not a change in complexity class.
- fix: Compile the patched codec once per event, either as an extra field on the owned `Registry` (line 117) or as a lazy per-event value. Then `encodeResultWith` reads it instead of rebuilding it.

### claude-3-3
- file: scratchpad/effected/jsonl/Journal.ts:960
- class: docs   severity: backlog
- standard: section 14 (a deviation's stated guarantee must match its behaviour)   evidence: The paged read pins the file handle and checks its `dev:ino` once (lines 929–946). After that, `readSampledWindow` only detects a page that is shorter than requested (`internal/tail.ts:314`). If a writer truncates the same file in place with `O_TRUNC` and refills it past the next page's end before that page is read, every page comes back full length. Deviation 13 ("a truncation beneath it fails typed") and the README text at lines 491–530 claim the read cannot be spliced.
- failure: A `query` or replay can emit old pages followed by pages from the rewritten content, with no `JournalResync`. This is the splice Deviation 13 says it removed, but for an in-place rewrite rather than a rename-over. The window is narrow: the regrowth must finish between two page reads.
- fix: Narrow the Deviation 13 wording to rename-over and plain shrink, and name this race as a limitation. Detection would need a per-page check of size or mtime, which nothing here does yet.

REQUIRED: 1
BACKLOG: 2
