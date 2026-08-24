# Instance

- id: `ontology-inspector-form-state`
- file:line: `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:399`
- symbol: `OntologyInspectorFormState`
- members: `objectValid`, `predicateValid`, `subjectValid`, `canApplyTriple`, `canApplyGraphGesture`, `showObjectError`, `showPredicateError`, `showSubjectError`
- evidence classes:
  - E3 — `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:605`: every flag is derived in one write site from the sibling draft strings and `objectKind`.
  - E4 — `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:611`: `canApplyTriple` is a stored conjunction of the validity flags; `canApplyGraphGesture` at line 622 implies `canApplyTriple`.

# Current shape

Live declaration at `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:393`:

```ts
export class OntologyInspectorFormState extends S.Class<OntologyInspectorFormState>($I`OntologyInspectorFormState`)(
  {
    object: S.String,
    objectKind: OntologyInspectorObjectKind,
    predicate: S.String,
    subject: S.String,
    objectValid: S.Boolean,
    predicateValid: S.Boolean,
    subjectValid: S.Boolean,
    canApplyTriple: S.Boolean,
    canApplyGraphGesture: S.Boolean,
    showObjectError: S.Boolean,
    showPredicateError: S.Boolean,
    showSubjectError: S.Boolean,
  },
  $I.annote("OntologyInspectorFormState", {
    description: "Inspector draft values and schema-derived validation flags rendered by the UI.",
  })
) {}
```

# Cardinality gap

The eight booleans represent 256 combinations. The three draft fields each have exactly three legal validation states:

- `empty`: no trimmed input, so no error is shown and the field is not valid.
- `invalid`: non-empty input that fails the field's validation, so its error is shown.
- `valid`: input accepted by the field's schema.

That is at most 27 validation combinations. Triple applicability is derived from all three fields being `valid` plus the upstream session being present. Graph-gesture applicability additionally requires `objectKind === "iri"`. The error booleans are exactly the three `invalid` cases. None of those five answers is independent state.

# Target schema

Add one reusable payload-free literal domain and store one value per field. Do not store an applicability literal alongside these fields: applicability also depends on the upstream `O.Option<Session>`, so it remains a derivation at the read boundary.

```ts
export const OntologyInspectorFieldState = LiteralKit(["empty", "invalid", "valid"]).pipe(
  $I.annoteSchema("OntologyInspectorFieldState", {
    description: "Validation state of one trimmed ontology inspector draft field.",
  })
)
export type OntologyInspectorFieldState = typeof OntologyInspectorFieldState.Type

export class OntologyInspectorFormState extends S.Class<OntologyInspectorFormState>($I`OntologyInspectorFormState`)(
  {
    object: S.String,
    objectKind: OntologyInspectorObjectKind,
    objectState: OntologyInspectorFieldState,
    predicate: S.String,
    predicateState: OntologyInspectorFieldState,
    subject: S.String,
    subjectState: OntologyInspectorFieldState,
  },
  $I.annote("OntologyInspectorFormState", {
    description: "Inspector drafts with one schema-owned validation state per field.",
  })
) {}

const inspectorFieldState = (value: string, valid: boolean): OntologyInspectorFieldState =>
  valid ? OntologyInspectorFieldState.Enum.valid : Str.isNonEmpty(Str.trim(value))
    ? OntologyInspectorFieldState.Enum.invalid
    : OntologyInspectorFieldState.Enum.empty

export const ontologyInspectorCanApplyTriple = (
  session: O.Option<Session>,
  form: OntologyInspectorFormState
): boolean =>
  O.isSome(session) &&
  OntologyInspectorFieldState.is.valid(form.subjectState) &&
  OntologyInspectorFieldState.is.valid(form.predicateState) &&
  OntologyInspectorFieldState.is.valid(form.objectState)

export const ontologyInspectorCanApplyGraphGesture = (
  session: O.Option<Session>,
  form: OntologyInspectorFormState
): boolean =>
  ontologyInspectorCanApplyTriple(session, form) && OntologyInspectorObjectKind.is.iri(form.objectKind)
```

UI error reads use `OntologyInspectorFieldState.is.invalid(form.subjectState)` (and the corresponding field). Action enablement passes the already-authoritative `ontologySessionAtom` option into the two derivations. No hand-written `isEmpty`/`isValid` predicate is added; all literal membership checks come from the kit.

# Migration inventory

- `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:393-411` — replace the eight boolean schema fields with `objectState`, `predicateState`, and `subjectState`; add `OntologyInspectorFieldState` and the two applicability derivations beside the model.
- `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:580` — retain `decodeOntologyInspectorIri`; it remains the source validator used to select field-state literals.
- `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:601-610` — replace the three `*Valid` and three `show*Error` local booleans with three `inspectorFieldState(...)` values. The literal-object rule remains: non-empty literals are valid, while IRI objects use `decodeOntologyInspectorIri`.
- `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:611` — remove the stored `canApplyTriple` conjunction; the atom no longer reads `ontologySessionAtom` merely to persist a duplicated answer.
- `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:613-626` — construct the class with the three state fields and remove all eight boolean writes.
- `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:3098-3105` — also read `ctx(ontologySessionAtom)` and map `addTriple` to `ontologyInspectorCanApplyTriple(session, form)` and graph actions to `ontologyInspectorCanApplyGraphGesture(session, form)`.
- `packages/ontology/ui/src/aggregates/Session/Session.inspector.tsx:9-15` — import `ontologySessionAtom`, `OntologyInspectorFieldState`, and the two applicability derivations from the client package.
- `packages/ontology/ui/src/aggregates/Session/Session.inspector.tsx:62-73` — replace `showSubjectError`, `showPredicateError`, and `showObjectError` with the kit's `.is.invalid` checks on the corresponding state fields.
- `packages/ontology/ui/src/aggregates/Session/Session.inspector.tsx:80-86` — read `ontologySessionAtom` once beside the form atom and derive `canApplyTriple` and `canApplyGraphGesture` once for the render.
- `packages/ontology/ui/src/aggregates/Session/Session.inspector.tsx:94`, `:100`, and `:124` — bind `aria-invalid` to `.is.invalid(form.*State)` rather than the removed error booleans.
- `packages/ontology/ui/src/aggregates/Session/Session.inspector.tsx:134`, `:144`, `:153`, `:162`, and `:171` — use the two render-local applicability answers rather than the removed stored members.
- `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:385-388` — update the model example to show a state field rather than generic fields if the example is expanded during implementation.

Whole-repository search found no other source write or read of the eight members.

# Guard-deletion accounting

- `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:601-604` — delete the paired `valid` plus `non-empty && !valid` projections for subject and predicate; one `empty | invalid | valid` selection replaces each pair.
- `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:605-610` — delete the separately maintained `objectValid` and `showObjectError` coherence pair; one object field state records the result.
- `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:611-622` — delete the stored conjunction and implication writes that must maintain `canApplyGraphGesture => canApplyTriple`.
- `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:3099-3105` — delete the branch over two stored permission booleans; the action match derives permission from the field-state literals plus the upstream session.
- `packages/ontology/ui/src/aggregates/Session/Session.inspector.tsx:76-78` — revise the comment-only invariant claiming validation and action guards are stored together in one snapshot; the snapshot owns validation state and applicability is derived with the upstream session.

# Encoded-side impact

none (internal)

# Test impact

- `packages/ontology/client/test/inspector-actions.test.ts:73-84` — assert `invalid.subjectState === "invalid"`, the three valid-state literals, and applicability through the exported derivations with the mounted session option. Remove assertions on `showSubjectError`, `subjectValid`, `predicateValid`, `objectValid`, and `canApplyGraphGesture`.
- Add the missing `empty` assertion for a blank draft and retain both object-kind branches so the literal-object and IRI-object validation rules remain covered.
- No other test under `packages/**/test/**` or an app `test/` directory reads these members.

# Risk & sequencing

This is a Tier 1 internal refactor spanning `@beep/ontology-client` and `@beep/ontology-ui`. Land the client model, client action derivations, UI reads, and the focused client test atomically because the form class is exported through the Session barrel. Preserve the existing draft strings and `objectKind`; they are the authoritative inputs and must not become duplicated stored state. This design is independent of the other four records in the domains batch.
