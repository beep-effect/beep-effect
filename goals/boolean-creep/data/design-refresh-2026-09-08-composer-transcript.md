# Composer and transcript design refresh — 2026-09-08

Source checkout: `7440cb8c4302ce64b87860069a464bafbf65f576`
Main apps/packages corpus: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`

This is durable design evidence for replacement P3 preparation. It is not an
independent review receipt.

## Composer shell edit content

`Composer.atoms.ts:398` filters the global edit target to the shell's thread.
The sole view writer at `:402-411` then derives both members, and
`contentToLoadFor` at `:362-366` proves a matching target always yields
`Some(target.content)`. The three supported cases are empty, draft content,
and editing content: four coarse pairs are representable and three are legal.

The new design replaces the pair with an annotated schema tagged union. It
preserves exact target-over-draft precedence, thread filtering,
revision-keyed one-shot draft seeds, `thread:<id>:<revision>` and
`edit:<turnId>` remount keys, empty documents as valid edit payload, stable
cancel/stop handlers, safety refusal, and editor seed conversion.
`turnActiveAtom` remains independent; editing while streaming continues to
show Rewrite, the edit banner, and Stop.

Whole-repository source/test search found the sole readers at
`Composer.tsx:113-144` and no existing test of `composerShellAtoms` or the edit
banner. The design requires a focused atom/component matrix and recorded
edit/cancel/thread-switch/streaming browser QA.

## Transcript correlation correction

The raw r25 apps row classified `empty` and streaming presence as independent,
but the sole writer contradicts that classification. `Thread.atoms.ts:328-332`
defines empty with absent `turns`, absent `displayedUnreconciled`, and
`O.isNone(streaming)` in the same conjunction that requires timeline success.
This is direct E4 evidence.

The complete coarse cluster is `empty`, `failed`, `loading`, streaming
presence, turns presence, and unreconciled presence. It represents 64 tuples
and has exactly 21 legal tuples:

- empty: one tuple, with all three content carriers absent;
- failed: eight tuples, because failure may retain previous timeline turns and
  unreconciled/stream carriers are independent;
- loading: four tuples, because Initial has no `AsyncResult.value` and thus no
  timeline turns, while unreconciled and stream carriers remain independent;
- ready: eight tuples. Initial-not-waiting supplies the all-absent tuple and
  success supplies the remaining payload combinations.

Effect's live `AsyncResult.value` returns `None` for Initial, the timeline
projection at `Thread.atoms.ts:292-295` therefore starts with empty turns, and
active-branch/truncation operations cannot add a timeline turn. Success may be
marked waiting and still selects empty when every carrier is absent. Failure
may contain `previousSuccess`, whose turns remain visible through
`AsyncResult.value`. These behaviors make the 21-tuple count exact.

The repaired target is a hot-path TypeScript discriminated view whose
vocabulary is owned by a LiteralKit. Empty narrows all three carriers; loading
narrows only timeline turns; failed and ready retain arbitrary payload. It does
not add runtime schema validation, require nonempty arrays, erase retained
content, or conflate independently sourced unreconciled/stream data with load
phase.

The separate `thread-load-state-props` record remains 4/3. Its component only
needs loading, failed, or no message and reuses the four-value transcript kit,
mapping empty and ready to no message.

## Canonical metadata corrections for the parent

- Expand `thread-transcript-load-state.members` to
  `["empty","failed","loading","streaming","turns","unreconciled"]`.
- Change its cardinality from `8/4` to `64/21`.
- Add E4 evidence citing `Thread.atoms.ts:292` and `:328`: empty requires all
  three carriers absent; loading is Initial, whose `AsyncResult.value` has no
  timeline value and therefore yields absent turns.
- Change its target shape from `literalkit` to `tagged-union`; the named
  LiteralKit still owns the discriminator vocabulary.
- Reconcile the raw `r25-apps-thread-transcript-empty-streaming` row into this
  canonical cluster instead of retaining its D1 adjudication.
- Keep `thread-load-state-props` at members `failed/loading`, cardinality 4/3,
  target LiteralKit, because it is the smaller downstream prop contract.

## Scope

Only the three owned designs and this handoff changed. No source, tests,
inventory, statuses, dependencies, generated files, or git refs were edited.

## Verification

- An independent abstract enumeration of live timeline kinds, timeline-value
  presence, unreconciled presence, and matching-stream presence produced 21
  distinct six-bit tuples, partitioned `empty=1`, `failed=8`, `loading=4`,
  `ready=8`.
- Scoped `git diff --check` passed for all four owned files.
- `mise exec bun@1.4.2 -- bun goals/boolean-creep/ops/validate-designs.ts`
  recognized the composer design but remains globally blocked by three
  concurrently admitted, unowned designs:
  `scheduler-protocol-eviction-mode`, `coverage-baseline-write-mode`, and
  `yeet-prepared-publish-commit` (`design coverage INVALID: 3 missing
  surface(s) across 114 qualified ids`).
