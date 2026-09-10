# R28 receipt occupancy: inferred domain correction

Date: 2026-09-09. Frozen product HEAD
`93217d998f851e2e93d9864e2b5315552eaa58a7`; frozen main
`d1b4d769fbaffddd55717f3b1ba461897dd545c5`.

**Verdict: retain qualification and correct the declared-domain cardinality
from 4/3 to 6/3.** The exact inferred type of `currentDraftOccupied` is
`Option<boolean>`, admitting None, Some(false) and Some(true). The real
`draftToRestore` Option adds an absent/present dimension while preserving
the complete `StreamingTurn` payload. Supported producers reach only three
of the six declared state shapes.

This separate P2 correction supersedes only the receipt type/cardinality
conclusion in the finalized
`data/design-refresh-2026-09-09-r28-agent-app-owner-boundaries.md`.
That audit and the finalized Hero provisional remain byte-identical.
Its actual-owner, lazy-selection, payload and compatibility evidence remains
valid; its 4/3 presence projection is not the complete declared-domain count.
No canonical row, current design, source, test, archive or ref was edited.
This is not independent P3 acceptance.

## Exact source and inference

`packages/agents/client/src/Chat.atoms.ts:1019` has no literal-return
annotation or explicit generic narrowing:

```ts
const currentDraftOccupied = O.map(registry.get(draftAtom), () => true);
let draftToRestore = O.none<StreamingTurn>();
```

The local Effect v4 reference at
`.repos/effect/packages/effect/src/Option.ts:1090-1095` declares the map
overloads with an unconstrained result type parameter `B`:

```ts
<A, B>(f: (a: A) => B): (self: Option<A>) => Option<B>
<A, B>(self: Option<A>, f: (a: A) => B): Option<B>
```

The installed dependency is also Effect `4.0.0-rc.112`. Its declaration
file, actually consumed by the private compiler probe, has the same
overloads at `node_modules/effect/dist/Option.d.ts:1380,1410`. Installed
source repeats them at `node_modules/effect/src/Option.ts:1483,1513`.
Reference/installed source bytes differ in documentation layout; their map
type signatures agree. The compiler inference, rather than an assumption
about returned runtime values, decides the representable domain here.

## Private compiler proof

A new compile-only probe lives at
`~/.cache/beep/boolean-creep/r28-receipt-occupancy-type/probe.mts`.
It imports the installed dependency directly from this checkout's
`node_modules/effect/dist/Option.js`; no module install, package command,
source import closure, source/test edit or JavaScript execution was needed.
The input uses a generic `registry.get` returning an Option of an opaque
document payload. Its payload cannot affect `B` because the map callback
ignores the input. The actual map expression and absence of an annotation
are copied exactly. The probe checks:

```ts
export const currentDraftOccupied = O.map(registry.get(draftAtom), () => true);
export type ExactInferredType = Assert<
  Equal<typeof currentDraftOccupied, O.Option<boolean>>
>;
export const acceptsNone: typeof currentDraftOccupied = O.none();
export const acceptsSomeFalse: typeof currentDraftOccupied = O.some(false);
export const acceptsSomeTrue: typeof currentDraftOccupied = O.some(true);

export const annotatedOccupancy = O.map(registry.get(draftAtom), (): true => true);
export type ExactAnnotatedType = Assert<
  Equal<typeof annotatedOccupancy, O.Option<true>>
>;
// @ts-expect-error: the inferred Option<boolean> cannot narrow to Option<true>.
export const cannotNarrow: O.Option<true> = currentDraftOccupied;
// @ts-expect-error: explicit true-only control rejects Some(false).
export const controlRejectsFalse: typeof annotatedOccupancy = O.some(false);
```

`Equal` compares types through the standard two generic-function conditional
forms; `Assert<T extends true>` fails if equality is not exact. Both expected
errors are checked by the compiler, so success also demonstrates that the
inferred type is not `Option<true>` and that the annotated control differs.
The explicit annotation is only a probe control; it is not an implemented
or proposed source patch.

The installed native compiler reports
`Version 7.0.2+effect-tsgo.0.39.1`; the installed TypeScript compiler reports
`Version 6.0.3`. Both independently accepted the same probe with exit 0 and
no diagnostics. Commands below preserve the invoked launchers and flags;
home-directory prefixes are normalized to `~` for this public packet.

From the checkout root:

```sh
node node_modules/@typescript/native/bin/tsc --version
node node_modules/@typescript/native/bin/tsc --ignoreConfig --noEmit --strict --exactOptionalPropertyTypes --skipLibCheck --target ESNext --module NodeNext --moduleResolution NodeNext ~/.cache/beep/boolean-creep/r28-receipt-occupancy-type/probe.mts
```

From `~/.cache/beep/boolean-creep/r28-receipt-occupancy-type`:

```sh
node ~/YeeBois/projects/beep-effect9/node_modules/typescript/bin/tsc --version
node ~/YeeBois/projects/beep-effect9/node_modules/typescript/bin/tsc --noEmit --strict --exactOptionalPropertyTypes --skipLibCheck --target ESNext --module NodeNext --moduleResolution NodeNext probe.mts
```

The first native attempt omitted `--ignoreConfig` while running from the
checkout root and exited 1 with TS5112: the compiler requested explicit
configuration-discovery opt-out when command-line files coexist with
`tsconfig.json`. Adding `--ignoreConfig` resolved that invocation issue.
No compiler error arose from the type assertions. No root/project tsconfig,
incremental build file, emitted JavaScript or declaration file was written.

## Complete state count and None/false behavior

Count finite state shapes, carrying the selected turn unchanged rather than
counting its required arrays, strings or nested fields as additional flags:

| Inferred occupancy value | Restore candidate | Producer legality |
| --- | --- | --- |
| None | None | legal: available |
| Some(false) | None | impossible: the only occupancy producer returns true for Some |
| Some(true) | None | legal: occupied |
| None | Some(turn) | legal: selected |
| Some(false) | Some(turn) | impossible: false producer absent, and any occupancy Some bypasses the selection writer |
| Some(true) | Some(turn) | impossible: occupied Some bypasses the selection writer |

The inferred occupancy domain has cardinality three; restore presence has
cardinality two. Thus **3 × 2 = 6 representable / 3 legal**. The old 4/3
table merged the two different Some payloads before counting the declared
type, hiding the unused but representable Some(false) states.

Do not treat Some(false) as None. The source's `O.orElse` at
`Chat.atoms.ts:1030` inspects Option presence, not Boolean truthiness;
`O.getOrElse` at 1031 returns a Some payload without invoking the writer.
Reference implementations at `Option.ts:587,624`, and installed
implementations at `node_modules/effect/src/Option.ts:712,807`, confirm this.
Were Some(false) supplied, the not-persisted filter branch would return
false without selecting a restore candidate. None instead reaches the
fallback writer when no candidate has been selected. This semantic
difference is why false cannot be silently normalized into absence.

No supported producer supplies Some(false): 1019 is the sole const
initialization and every produced Some contains true. The only Some write
to `draftToRestore` at 1032 is behind both lazy None fallthroughs. Therefore
the three-case `available | occupied | selected { turn }` target remains
behaviorally correct for all supported source writes; it eliminates all
three impossible declared shapes. The correction changes the cardinality
proof, not the required legitimate-state behavior.

## Owner, payload and migration boundary

The owner remains the real sibling Option declarations in the same
`Effect.sync` block at `Chat.atoms.ts:1017-1053`, inside the actual
`reconcileReceiptFallbacks` Effect binding at 998. The analytical
`.draftRestoration` suffix can be normalized without changing its stable id.
Neither declaration is a callable parameter or a nested projection.

The prior complete writer/consumer proof is unchanged: take the occupancy
snapshot after serial receipt reads at 999-1019; filter the current fallback
array by identity-based status decisions at 1021-1047; select only the
first eligible not-persisted fallback; retain later candidates, unknown or
absent statuses and newly appended fallbacks; restore exact selected
`userContent` and increment the selected turn's thread revision once at
1048-1050; publish retained order at 1052. Newer drafts arriving during
receipt I/O must continue to block restoration.

The sole invocation at `Chat.atoms.ts:1251-1259` remains in the successful
timeline-refresh tap, with reconciliation completing before the active
streaming-turn Option is cleared. This continuation and its surrounding
refresh failure handling are outside the occupancy replacement.

Carry the existing complete `StreamingTurn` schema at 439-472: thread id,
request-id Option, full Document, truncate-target Option, reconciliation
literal/default and required ordered assistant blocks. No nested payload
fields become new sibling axes. No encoded/public constructor, atom payload,
Option codec/default or receipt-status behavior changes. The actual fixtures
and assertions in `run-turn-reconciliation.test.ts:357-405,609-725` remain
the migration proof obligations, including the post-I/O draft and appended
fallback races. Tests were read previously, not rerun for this type-only
follow-up.

The complete corrected P2 draft is
`data/provisional-r28-receipt-fallback-draft-occupancy.md`. It replaces the
incorrect current `Option<true>` description and 4/3 proof while retaining
the payload-bearing target and all migration requirements. Do not mutate
the finalized prior audit or current design to hide this correction.

## Exact proposed row

Pending parent integration and independent correction. The row uses
`confirmed` until the corrected provisional is promoted; this proposal
does not claim that a current 4/3 design already proves the corrected row.
No new id or duplicate cluster is added.

```jsonl
{"schemaVersion":"boolean-creep-inventory/v1","id":"receipt-fallback-draft-occupancy","file":"packages/agents/client/src/Chat.atoms.ts","line":1019,"symbol":"reconcileReceiptFallbacks","kind":"sibling-state","members":["currentDraftOccupied","draftToRestore"],"status":"confirmed","evidence":[{"class":"E1","cite":{"file":"packages/agents/client/src/Chat.atoms.ts","line":1032},"note":"The only Some assignment to draftToRestore is the lazy O.getOrElse thunk, reached only when the const currentDraftOccupied and existing restore candidate are both None."},{"class":"E4","cite":{"file":"packages/agents/client/src/Chat.atoms.ts","line":1019},"note":"Unannotated O.map(..., () => true) infers Option<boolean>, verified with installed native TS7 and TS6 compilers. Its declared None/Some(false)/Some(true) domain times restore absence/presence represents six shapes. The sole producer emits only None/Some(true); lazy O.orElse at1030 prevents any occupancy Some from coexisting with a selected candidate, leaving three legal states."}],"cardinality":{"representable":6,"legal":3},"storage":"stored","exposure":"internal","targetShape":"tagged-union","tier":1,"notes":"Frozen HEAD93217d998f851e2e93d9864e2b5315552eaa58a7/main d1b4d769fbaffddd55717f3b1ba461897dd545c5. Corrects the prior 4/3 presence-only count; Some(false) is representable but has no supported producer and is not equivalent to None. Preserve the complete StreamingTurn, post-I/O draft snapshot, serial identity-based status filtering, first restoration, later retention, concurrent drafts/appended fallbacks, exact order and one revision increment. Target remains available/occupied/selected(turn), without codec/default changes. See data/design-refresh-2026-09-09-r28-receipt-occupancy-type.md and data/provisional-r28-receipt-fallback-draft-occupancy.md; pending independent correction/admission."}
```

## Hashes and validation

SHA-256. Product source and fixture bytes match frozen HEAD. Dependency and
compiler files describe the locally installed proof environment; the Effect
reference is a separate local checkout, outside the scanned product corpus.

| Path | SHA-256 |
| --- | --- |
| `packages/agents/client/src/Chat.atoms.ts` | `91d8040ca676201732ecab34e6a8de8951598b1495ac800529b8609d82a0ad6a` |
| `packages/agents/client/test/run-turn-reconciliation.test.ts` | `d8e2aa5f7ecff76be42fbfae531e0be62ca039dbe0b0ac3f7bb969da57123e2e` |
| `.repos/effect/packages/effect/src/Option.ts` | `852c273cfe37456930806f80c3b886a1e2ee01f0f8e22f0d2fd3175f01485238` |
| `node_modules/effect/src/Option.ts` | `db5876bc08e213e95575ab0d1a71f6a2db0a5fe0e00f90f8fa6f828a039b71eb` |
| `node_modules/effect/dist/Option.d.ts` | `781dcb2d8c7408e03e969a579db017420be5e6646f4ce17ec9e6abbd48501826` |
| `node_modules/@typescript/native/package.json` | `3722b30210616a13a3213ded11575ba6b2dbab10c32a5ef67afca8513e27017e` |
| `node_modules/typescript/package.json` | `9332e97c30d3e53ed54910b89207ed657fb444066484df6e5b6965bf130865e9` |
| private `probe.mts` at the cache path above | `fb16bc8018688c420e99ed08aebe2e26b060bcf1ed16a0c6b40b42c1317e0df4` |
| `designs/receipt-fallback-draft-occupancy.md` | `8e1070589700615ea7b0804716049a44cdfca3eab3a3b8615fe716e1b15a0a2f` |
| `data/design-refresh-2026-09-09-r28-agent-app-owner-boundaries.md` | `a78adcb3630820f2e24837f48abdceaf345c25162261bc9bb4ff6af1fa505510` |
| `data/provisional-r28-hero-clip-playback.md` | `99b2fe197e06678eb50f5f5dee7711050d02904ff95e08068413ce5dfe7d6334` |

Validated the proposed JSONL, six/three state table, exact source anchors,
all eight provisional headings and unchanged prior artifact hashes.
Recorded source/dependency/compiler hashes and the private probe hash also
match. Both compiler proofs are compile-only checks of this bounded
inference question, not product package verification or independent P3.
Graft located all six occurrences of the two actual locals and reported
13,042 tokens saved in this follow-up.
