# Instance

- id: `r36-epistemic-ontology-document-toolbar-input`
- file:line: `packages/ontology/ui/src/aggregates/Session/Session.document.tsx:146`
- symbol: `OntologyDocumentRegion.toolbarInput`
- members: `sessionOpen`, `dirty`
- evidence: E4 at `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1531-1541`, with pinned dependency coherence evidence in the reconciliation receipt.

# Current shape

The component's object literal at142-148 has five actual Boolean fields. Only sessionOpen/dirty form this instance. The three AsyncResult waiting observations opening/saving/previewing remain independent axes and are not folded into document lifecycle. This is an actual constructed object, not the excluded anonymous function parameter at74-80. Existing document-toolbar-busy-disabled owns the six returned presentation bits; its14-state output projection remains distinct.

Current component reads dirty at121 and session at123. ontologyDirtyAtom returns false when its session dependency is None. Installed @effect/atom-react4.0.0-rc.117 Hooks.ts snapshots call registry.get; React19.3.0 mount/update useSyncExternalStore call snapshots in the current component invocation. Registry.get calls node.value and synchronous setValue invalidates dependent nodes before returning. The intermediate ontologyPathAtom read is pure keep-alive state; the component does not yield or write session between reads. Therefore these two observations are coherent for this construction. No server override is attached to either atom; getServerValue falls back to registry.get. The new design makes that relation explicit in one derived atom.

# Cardinality gap

The minimal pair represents4 combinations and constructs3: closed=(false,false), saved=(true,false), dirty=(true,true). (false,true) is absent from this component owner. Multiplying by three independent busy bits produces the raw32/24 accounting but does not justify replacing those independent axes. Public documentToolbarState accepts all32 Boolean tuples, including closed+dirty; preserve that supported behavior (neutral badge and disabled session actions).

# Target schema

Use a private annotated LiteralKit and schema-backed internal input in Session.document.tsx. Reuse the identity composer and LiteralKit imports introduced by the existing output design, so there is exactly one composer. No new package, barrel export or public phase API is needed.

```ts
const DocumentToolbarDocument = LiteralKit(["closed", "saved", "dirty"]).pipe(
  $I.annoteSchema("DocumentToolbarDocument", {
    description: "Document availability and save state observed by the toolbar.",
  })
)
type DocumentToolbarDocument = typeof DocumentToolbarDocument.Type

class DocumentToolbarInput extends S.Class<DocumentToolbarInput>($I`DocumentToolbarInput`)(
  {
    opening: S.Boolean,
    saving: S.Boolean,
    previewing: S.Boolean,
    document: DocumentToolbarDocument,
  },
  $I.annote("DocumentToolbarInput", {
    description: "Independent action observations and one coherent document phase.",
  })
) {}

const documentToolbarDocumentAtom = Atom.make((get) =>
  O.match(get(ontologySessionAtom), {
    onNone: DocumentToolbarDocument.thunk.closed,
    onSome: () => get(ontologyDirtyAtom)
      ? DocumentToolbarDocument.Enum.dirty
      : DocumentToolbarDocument.Enum.saved,
  })
)
```

Use the existing effect/unstable/reactivity Atom module in this UI file alongside AsyncResult. Atom reads both facts through the same registry context and creates no stored state or write API. The schema is a derived local carrier, not persisted state.

Extract one private projector documentToolbarStateFromInput taking DocumentToolbarInput. It derives a local sessionOpen answer from `!DocumentToolbarDocument.is.closed(input.document)` solely for action gating. Badge is an exhaustive DocumentToolbarDocument.$match with the three exact existing labels and variants; hint is present only for closed. For the existing output design's final state, open/save/preview use its existing DocumentToolbarActionState and sessionActionState exactly once. Do not construct a second sessionOpen/dirty record inside this projector.

Keep exported documentToolbarState's existing five-Boolean parameter type and barrel export. It becomes a compatibility adapter: preserve the three busy flags; normalize sessionOpen=false to closed regardless of dirty, and sessionOpen=true to dirty/saved according to dirty; construct DocumentToolbarInput and call the same private projector. The adapter accepts all32 tuples. This is not a schema decoder or a new rejection of supported input; normalization exactly matches documentBadge's established precedence. The excluded legacy parameter stays unchanged.

The component reads `documentToolbarDocumentAtom` once and directly constructs DocumentToolbarInput with that document phase and the three existing AsyncResult waits, then calls the private projector. Retain its separate session read for canUndo/other component uses. Remove the dirty hook if unused after this change. No duplicate raw Boolean pair remains in an internal constructed record.

# Migration inventory

- Session.document.tsx imports: share LiteralKit/$OntologyUiId/$I with existing document-toolbar-busy-disabled proposal; add Atom import through the current Effect module boundary.
- Lines45-54: remove the old two-Boolean documentBadge helper after its only use moves to the phase match. Keep all label and variant text exact.
- Lines74-92: retain public helper signature, route through one schema-backed compatibility adapter and shared projector. Coordinate output-shape migration with document-toolbar-busy-disabled; do not independently rewrite the same six output fields twice.
- Lines121-123: read the new derived document atom; retain session for unrelated canUndo behavior. Remove direct dirty subscription only if no other component use remains.
- Lines142-148: replace the raw five-Boolean object with DocumentToolbarInput carrying document plus three independent waits; call the private projector.
- Session/index.ts17: public helper remains exported. No export is required for the private document kit or input carrier. Existing output action kit export remains the responsibility of the sibling design.
- Session.workbench.test.ts: preserve all current public-helper cases while updating expected output fields as required by the sibling output design.

# Guard-deletion accounting

- Delete the component's parallel sessionOpen146/dirty147 record members; one document value cannot represent closed+dirty.
- Delete documentBadge47-53's separate sessionOpen rejection plus dirty ternary; the shared projector matches one three-case domain.
- Replace sessionHint91's independent sessionOpen test with a closed-phase projection. This remains a meaningful presentation question, not a coherence guard.
- Keep the legacy public adapter's normalization because all32 supported tuples must remain accepted; it is compatibility mapping, not falsely claimed guard deletion.
- Busy/disabled and action-label guard deletion belongs only to document-toolbar-busy-disabled. Do not claim those lines as additional deletion credit here.
- No transport validation, runtime error handling, atom writes or legitimate input checks are removed.

# Encoded-side impact

none (internal). The exported helper keeps its five input properties and accepts all existing tuples. Its output migration is already owned by the sibling design; implement both in one coordinated patch with one final projector. No stored atoms, RPC payloads, schema decoding, sidecars or persistence changes.

# Test impact

- Exhaustively check all32 public-helper inputs against old behavior, including all8 sessionOpen=false/dirty=true cases. Compare exact badge/hint and action busy/disabled semantics; when output design lands, compare its literal phases through the documented UI projection.
- Test private derived state via the component/registry boundary for no session, open clean, open dirty, save-to-clean and close-to-none. Closing a dirty session must produce closed without a dirty closed intermediate committed state.
- Preserve independent action concurrency, including simultaneous waits and busy-without-session precedence. Existing output design's14-case projection test remains its own obligation.
- Run @beep/ontology-ui package verification and affected client/UI tests. No client source change is proposed; the new selector is local UI derived state.
- Share the sibling browser-qa-loop run for Open/Save/Preview gestures and badge transitions; retain the exact enabled/disabled/busy labels and accessibility states. Runtime implementation and visual verification remain future work, not this proposal's credit.

# Risk & sequencing

Land jointly with document-toolbar-busy-disabled or explicitly rebase its pending design onto this shared projector. The two instances are input relation versus output relation; neither cardinality gap is counted twice. Do not expose a narrower public helper or couple independent waits to session availability. Keep the phase atom derived, with no setter/default persistence. Avoid a private helper that merely reconstructs the same sessionOpen/dirty object elsewhere: its inputs must carry document phase and its internals may derive standalone rendering answers only. Preserve no-session+dirty compatibility by normalization at the public adapter. The dependency evidence binds this admission to installed rc.117 and React19.3.0; recheck if those implementations change.
