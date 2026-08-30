# Selective Schema Codec Statics Decisions

This is the durable `/grilling` ledger for the goal. Every answer records the
question, chosen answer, rationale, and rejected alternatives. A changed
decision requires a new dated entry; do not silently edit a ratified answer.

## Locked before round 1

### 2026-08-30 — D0: Effect Schema ownership

**Question:** May the goal implement or wrap its own Schema classes to obtain a
more convenient static API?

**Answer:** No. Use Effect's public `Schema` and `S.Class` implementations.

**Rationale:** The operator explicitly prefers the safe option and has prior
negative experience maintaining custom Schema class implementations.

**Rejected:** Custom Schema subclasses, constructor wrappers, proxies,
decorators, and hand-built AST-compatible schema objects.

### 2026-08-30 — D1: Migration outcome

**Question:** Is this only a new opt-in API, or must it replace the existing
broad helpers?

**Answer:** It is a repository migration. Replace every existing bare
`withCodecStatics` and `with<X>CodecStatics` use with an explicit minimal key
selection, then delete all broad variants and their implementations.

**Rationale:** Broad bundles attach methods schemas do not consume and create
collision and semantic hazards. Explicit selection makes the attached surface
reviewable at each declaration.

**Rejected:** Add the selector while retaining broad helpers; translate every
broad helper to a fixed full tuple; leave compatibility aliases indefinitely.

## Round 1 — locked 2026-08-30

### 2026-08-30 — D2: Explicit-selector compatibility

**Question:** Must `withCodecStatics` require a non-empty key tuple with no
zero-argument compatibility overload?

**Answer:** Yes. Require an explicit non-empty readonly tuple. If a schema needs
no attached helper, remove the selector call rather than writing an empty tuple.

**Rationale:** A bare or empty compatibility path would preserve broad or dead
attachment plumbing and weaken the reviewable-surface invariant.

**Rejected:** A temporary deprecated zero-argument overload; accepting
`withCodecStatics([])` as an identity operation.

### 2026-08-30 — D3: `S.Class` utility shape

**Question:** How should `S.Class` schemas receive a concise selectable helper
surface without replacing Effect's class implementation?

**Answer:** Provide `classStatics(this, keys)`, returning a frozen nested utility
bag whose type exposes exactly the selected helpers. Consumers may destructure
`MyClass.utils`.

**Rationale:** Passing `this` explicitly binds the finished class constructor.
The nested bag avoids constructor mutation, preserves inheritance behavior, and
provides the requested destructuring point.

**Rejected:** Individual explicit fields as the only API; implicit
`classStatics(keys)` binding; lazy flat getters; constructor mutation;
decorators, wrappers, proxies, or custom Schema classes.

### 2026-08-30 — D4: JSON boundary

**Question:** Should JSON-string convenience names participate in the selected
static catalog?

**Answer:** No. Construct a named `S.fromJsonString(schema, formatOptions)`
schema and attach ordinary selected runners to that explicit encoded boundary.
Keep `SchemaAST.ParseOptions` as the runner's per-invocation argument.

**Rationale:** This makes the string boundary and construction-time JSON
options visible, prevents accidental double wrapping, and obtains the intended
hoisting benefit.

**Rejected:** JSON-suffixed keys with bound format options; dynamic wrappers
that rebuild the transformed schema and runner for each invocation.

## Round 2 — locked 2026-08-30

### 2026-08-30 — D5: Schema ownership

**Question:** Should the selector mutate its supplied schema?

**Answer:** No. Create a distinct schema through Effect's public
`self.rebuild(self.ast)` and attach selected properties to that owned rebuild.
Fail closed if applying the selector after custom statics would discard or
misrepresent those properties.

**Rationale:** Effect's public rebuild preserves the AST while returning a
distinct schema. This prevents mutation of shared primitives such as
`S.Unknown` without implementing a custom Schema object.

**Rejected:** Mutating only caller-declared owned inputs; retaining unrestricted
in-place mutation.

### 2026-08-30 — D6: Selected-static catalog names

**Question:** Should the catalog use Effect's native names or preserve the
legacy Beep aliases?

**Answer:** Use the exact Effect runner names plus `is`, `asserts`, the existing
dual `equivalence`, and `toArbitrary`. Migrate `fromUnknown` to
`decodeUnknownSync`; the old unknown-input `decodeOption` uses
`decodeUnknownOption`. Exclude `toStandardSchemaV1` from the catalog and invoke
that mutating conversion explicitly where needed.

**Rationale:** Exact names preserve Effect semantics and signatures, remove the
typed-versus-unknown ambiguity, and keep the codec selector free of a conversion
that mutates its schema by adding `~standard`.

**Rejected:** Legacy aliases alongside native names; an expansive mixed catalog
containing `toStandardSchemaV1` and other special conversions.

### 2026-08-30 — D7: Dual call shape

**Question:** Which invocation forms should `withCodecStatics` support?

**Answer:** Support both `schema.pipe(withCodecStatics(keys))` and
`withCodecStatics(schema, keys)` through one exact typed dual implementation.

**Rationale:** The pipeable form is terse for declarations, while data-first is
useful for programmatic construction and covers the existing data-first call
site without sacrificing explicit selection.

**Rejected:** Pipe-only and data-first-only APIs.

## Round 3 — locked 2026-08-30

### 2026-08-30 — D8: Collision and descriptor policy

**Question:** How should duplicate selections, existing companion statics, and
later overrides behave?

**Answer:** Fail closed with a typed configuration error. Install selected
schema properties as non-enumerable, non-writable, and non-configurable. A key
must be selected or defined exactly once.

**Rationale:** Silent deduplication or replacement hides declaration mistakes
and makes the schema's companion surface order-dependent. Immutable descriptors
make the declaration stable after construction.

**Rejected:** Deduplicating repeated tuple members; same-value replacement;
configurable selected properties; last-write-wins overrides.

### 2026-08-30 — D9: Minimality evidence for exported schemas

**Question:** What evidence determines the minimal selected keys for an
exported schema?

**Answer:** Use repository typechecker consumers, explicit exported contracts,
documentation, and tests. An unused key appearing only in an inferred exported
intersection type is not a preservation requirement.

**Rationale:** Public compatibility must be grounded in an intentional or
observed contract. Preserving every accidentally inferred member would defeat
the selective migration.

**Rejected:** Same-file textual reads only; retaining all currently inferred
members regardless of consumers or declared contract.

### 2026-08-30 — D10: Existing `S.Class` migration scope

**Question:** Must this goal migrate the repository's existing manual class
statics?

**Answer:** No. Implement and prove `classStatics(this, keys)` with one
representative `S.Class` and one representative `S.TaggedClass`. Leave the
separate 253-class manual-static fleet unchanged.

**Rationale:** The helper is required for new ergonomic class declarations,
but a class-fleet migration has different identity and inheritance risks and
would obscure the codec-bundle removal.

**Rejected:** Migrating all schema classes in this goal; proving only a plain
`S.Class` while leaving tagged-class behavior untested.

## Round 4 — locked 2026-08-30

### 2026-08-30 — D11: Inline-compiler lint scope

**Question:** Should this goal promote `beep(no-inline-schema-compile)` to an
error across the repository?

**Answer:** No. Keep the rule at warning, fix every touched finding and the
known `ProvRdf.ts` finding, and prohibit warning growth. After a fresh closing
census, record a mandatory successor goal that owns full cleanup and hard-error
promotion.

**Rationale:** The live census found 2,935 warnings across 533 files: 2,623 in
packages and apps and 312 in scratchpad. Folding that separate cleanup into the
codec migration would make this goal unreviewable.

**Rejected:** Promoting the rule within this goal; ignoring inline compiler
findings in touched code; creating the successor packet before the closing
census is known.

### 2026-08-30 — D12: Delivery shape

**Question:** How should the repository-wide migration be partitioned?

**Answer:** Deliver reviewable family PRs: foundation API and pilots first,
then generator families and authored consumer families, followed by deletion,
ratchet evidence, and closeout.

**Rationale:** Family batches keep generated output coupled to its generator,
make minimal selections auditable, and reduce collision risk.

**Rejected:** One monolithic migration diff; arbitrary file-count batches that
separate generators from their outputs.

### 2026-08-30 — D13: `withStatics` compatibility

**Question:** Should strict selected-static behavior replace the public
`withStatics` semantics?

**Answer:** No. Preserve public `withStatics` behavior. Factor a shared internal
installer with legacy mutable mode for `withStatics` and owned strict mode for
selected codec statics.

**Rationale:** The goal targets codec-static bundles, not every custom
companion-static declaration. Changing public `withStatics` collision behavior
would create an unrelated compatibility break.

**Rejected:** Making all `withStatics` callers strict; duplicating property
installation without a shared internal core.

## Round 5 — locked 2026-08-30

### 2026-08-30 — D14: Migration inventory mechanism

**Question:** How should minimal selections be derived and reviewed at this
scale?

**Answer:** Produce a typechecker-backed, goal-local inventory and a disposable
codemod. Review the inventory before applying changes, and retain the evidence
in the packet rather than promoting the migration tool to a permanent API.

**Rationale:** Symbol-aware reads catch re-exports and indirect consumers that
text search cannot establish, while a disposable transform keeps the large
mechanical edit reproducible without creating permanent tooling debt.

**Rejected:** Text-only nearest-file guesses; hand-editing hundreds of generated
declarations; shipping a general codemod package without a continuing use case.

### 2026-08-30 — D15: Generator defaults

**Question:** What should schema generators emit after broad statics are
removed?

**Answer:** Generators default to no codec statics and consult a reviewed
per-schema override map for the minimal selected keys.

**Rationale:** A broad generator default would recreate the original problem.
Explicit overrides keep generated public surfaces small and reviewable.

**Rejected:** Giving every generated schema a fixed full tuple; inferring
statics from schema shape alone.

### 2026-08-30 — D16: Migration no-growth gate

**Question:** How should concurrent family PRs prevent regression while the
legacy count is not yet zero?

**Answer:** Check a shrinking baseline. Each family PR must reduce or preserve
the recorded legacy count for untouched families and may never introduce new
broad-helper uses or new inline compiler warnings.

**Rationale:** A zero-only gate cannot protect a multi-PR migration until the
last batch. A ratcheting baseline gives every intermediate state a meaningful
acceptance condition.

**Rejected:** Waiting until final deletion for enforcement; allowing temporary
legacy growth between family batches.

## Round 6 — locked 2026-08-30

### 2026-08-30 — D17: `Unknown` compatibility

**Question:** Must `@beep/schema/Unknown` retain its explicit every-runner
contract?

**Answer:** No. Intentionally retire that broad contract and select only the
minimal evidenced helpers for `Unknown`.

**Rationale:** `Unknown` is the clearest example of shared-singleton mutation
and broad accidental surface. Preserving every runner there would undermine
the ownership and minimality decisions.

**Rejected:** Translating the old `Unknown` surface to a full 28-key tuple;
keeping the old surface as compatibility aliases.

### 2026-08-30 — D18: Unknown JSON schemas

**Question:** What JSON boundary should replace `Unknown`'s JSON-suffixed
methods?

**Answer:** Export a compact named `UnknownFromJsonString`. Keep fixed pretty or
custom JSON variants as local named schemas next to their consumers. Do not add
a public dynamic factory or cache in this goal.

**Rationale:** A public compact schema covers the shared boundary while making
construction explicit. Formatting is a construction-time concern and local
fixed variants avoid rebuilding codecs on business calls.

**Rejected:** JSON-suffixed statics; a public options factory; per-call
`S.fromJsonString` construction.

### 2026-08-30 — D19: Successor lint goal timing

**Question:** When should the full inline-compiler cleanup packet be created?

**Answer:** Make a successor goal mandatory at this goal's close, after a fresh
census is recorded. Do not create it now.

**Rationale:** The successor needs an accurate post-migration baseline and
should not be confused with this packet's acceptance criteria.

**Rejected:** Creating a stale successor from the opening census; omitting a
durable follow-on requirement.

## Ratification

On 2026-08-30 the operator explicitly confirmed shared understanding of D0-D19
and authorized implementation. Later changes require a new dated amendment in
this ledger; they must not silently rewrite a locked answer.
